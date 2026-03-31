import { Database } from "../db/client";
import { Config } from "../config";

export interface ManualAdjustment {
    id?: number;
    period_month: number;
    period_year: number;
    emp_code: string;
    gang_code: string;
    division_code?: string;
    adjustment_type: 'PREMI' | 'POTONGAN_KOTOR' | 'POTONGAN_BERSIH' | 'PENDAPATAN_LAINNYA';
    adjustment_name: string;
    amount: number;
    remarks?: string;
    created_at?: Date;
    created_by?: string;
    updated_at?: Date;
    updated_by?: string;
}

export class ManualAdjustmentService {
    private static instance: ManualAdjustmentService;

    private constructor() { }

    public static getInstance(): ManualAdjustmentService {
        if (!ManualAdjustmentService.instance) {
            ManualAdjustmentService.instance = new ManualAdjustmentService();
        }
        return ManualAdjustmentService.instance;
    }

    private getDatabase(): Database {
        return Database.getInstance(Config.DB_EXTEND_DATABASE, Config.DB_EXTEND_PROFILE);
    }

    /**
     * Get all manual adjustments for a specific period and gang
     */
    public async getAdjustments(
        month: number,
        year: number,
        gangCode?: string,
        empCode?: string
    ): Promise<ManualAdjustment[]> {
        const db = this.getDatabase();
        let query = `
            SELECT * FROM dbo.payroll_manual_adjustments
            WHERE period_month = ? AND period_year = ?
        `;
        const params: any[] = [month, year];

        if (gangCode && gangCode !== 'ALL') {
            query += ` AND gang_code = ?`;
            params.push(gangCode);
        }

        if (empCode) {
            query += ` AND emp_code = ?`;
            params.push(empCode);
        }

        return await db.query<ManualAdjustment>(query, params);
    }

    /**
     * Save PENDAPATAN_LAINNYA (e.g. KONTAN) to employee_other_incomes table.
     * Uses upsert logic: update if exists (same nik + period + income_name), insert if not.
     */
    private async saveOtherIncome(db: Database, data: ManualAdjustment, parsedAmount: number, user?: string): Promise<number> {
        const incomeType = data.adjustment_name; // e.g. 'KONTAN'
        const incomeName = data.adjustment_name; // e.g. 'KONTAN'

        // Check if existing record exists
        const existing = await db.queryOne<{ id: number }>(`
            SELECT id FROM dbo.employee_other_incomes
            WHERE nik = ? AND period_month = ? AND period_year = ? AND income_name = ?
        `, [data.emp_code, data.period_month, data.period_year, incomeName]);

        if (existing) {
            if (parsedAmount === 0) {
                // Delete if amount is 0
                await db.query(`DELETE FROM dbo.employee_other_incomes WHERE id = ?`, [existing.id]);
                console.log(`[saveOtherIncome] Deleted ${incomeName} for ${data.emp_code} (amount=0)`);
                return existing.id;
            }
            // Update existing
            await db.query(`
                UPDATE dbo.employee_other_incomes
                SET amount = ?, updated_at = GETDATE()
                WHERE id = ?
            `, [parsedAmount, existing.id]);
            console.log(`[saveOtherIncome] Updated ${incomeName} for ${data.emp_code}: Rp${parsedAmount}`);
            return existing.id;
        } else {
            if (parsedAmount === 0) return 0; // Don't insert zero

            // Insert new record
            const result = await db.query(`
                INSERT INTO dbo.employee_other_incomes (
                    nik, emp_name, division_code, gang_code,
                    period_year, period_month, income_type, income_name,
                    amount, is_paid_in_thp, is_taxable,
                    created_at, updated_at
                ) OUTPUT INSERTED.id VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE()
                )
            `, [
                data.emp_code,
                null, // emp_name - let it be null, will be enriched by data extractor
                data.division_code || null,
                data.gang_code,
                data.period_year,
                data.period_month,
                incomeType,        // income_type = 'KONTAN'
                incomeName,        // income_name = 'KONTAN'
                parsedAmount,
                0,                 // is_paid_in_thp = false (added to gross wage, not THP)
                0,                 // is_taxable = false (not taxable)
            ]);
            const id = result[0]?.id;
            console.log(`[saveOtherIncome] Inserted ${incomeName} for ${data.emp_code}: Rp${parsedAmount}, ID=${id}`);
            return id;
        }
    }

    /**
     * Save a manual adjustment (Insert or Update)
     *
     * Special handling for PENDAPATAN_LAINNYA:
     * - Saves to employee_other_incomes table (like THR, Bonus, Custom)
     * - is_paid_in_thp = false (added to gross wage, not THP)
     * - is_taxable = false (not taxable income)
     */
    public async saveAdjustment(data: ManualAdjustment, user?: string): Promise<number> {
        const db = this.getDatabase();

        // Ensure amount is a valid float
        const parsedAmount = parseFloat(data.amount.toString()) || 0;

        // --- PENDAPATAN_LAINNYA: Save to employee_other_incomes ---
        if (data.adjustment_type === 'PENDAPATAN_LAINNYA') {
            return await this.saveOtherIncome(db, data, parsedAmount, user);
        }

        // --- Standard adjustments: Save to payroll_manual_adjustments ---

        // Check if an exact match exists
        const existing = await db.queryOne<{ id: number }>(`
            SELECT id FROM dbo.payroll_manual_adjustments
            WHERE period_month = ? AND period_year = ? 
            AND emp_code = ? AND adjustment_type = ? AND adjustment_name = ?
        `, [data.period_month, data.period_year, data.emp_code, data.adjustment_type, data.adjustment_name]);

        if (existing) {
            if (parsedAmount === 0 && !data.remarks?.includes('INIT_COLUMN')) {
                // If amount is 0, delete it from the table
                await db.query(`DELETE FROM dbo.payroll_manual_adjustments WHERE id = ?`, [existing.id]);
                return existing.id;
            } else {
                // Update
                await db.query(`
                    UPDATE dbo.payroll_manual_adjustments
                    SET amount = ?, remarks = ?, updated_at = GETDATE(), updated_by = ?
                    WHERE id = ?
                `, [parsedAmount, data.remarks || null, user || 'system', existing.id]);
                return existing.id;
            }
        } else {
            if (parsedAmount === 0 && !data.remarks?.includes('INIT_COLUMN')) return 0; // Don't insert zero

            // Insert
            const result = await db.query(`
                INSERT INTO dbo.payroll_manual_adjustments (
                    period_month, period_year, emp_code, gang_code, division_code,
                    adjustment_type, adjustment_name, amount, remarks, created_by
                ) OUTPUT INSERTED.id VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                )
            `, [
                data.period_month, data.period_year, data.emp_code, data.gang_code, data.division_code || null,
                data.adjustment_type, data.adjustment_name, parsedAmount, data.remarks || null, user || 'system'
            ]);
            return result[0]?.id;
        }
    }

    /**
     * Delete an adjustment by id
     */
    public async deleteAdjustment(id: number): Promise<void> {
        const db = this.getDatabase();
        await db.query(`DELETE FROM dbo.payroll_manual_adjustments WHERE id = ?`, [id]);
    }
}

export const manualAdjustmentService = ManualAdjustmentService.getInstance();
