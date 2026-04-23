import { Database } from "../db/client";
import { Config } from "../config";
import {
    normalizeStoredAdjustmentName,
    shouldDeleteStoredAdjustment
} from "./payroll/manualAdjustments/manualAdjustmentNaming";

function buildNormalizedSqlNameExpression(columnName: string): string {
    let expression = `UPPER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(REPLACE(${columnName}, CHAR(9), ' '), CHAR(10), ' '), CHAR(13), ' '), CHAR(160), ' '))))`;

    for (let i = 0; i < 4; i += 1) {
        expression = `REPLACE(${expression}, '  ', ' ')`;
    }

    return expression;
}

export interface ManualAdjustment {
    id?: number;
    period_month: number;
    period_year: number;
    nik?: string;       // Real NIK (KTP) - primary identifier
    emp_code: string;   // Emp code (B0065, etc.) - for lookup
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
        empCode?: string,
        divisionCode?: string
    ): Promise<ManualAdjustment[]> {
        const db = this.getDatabase();
        let query = `
            SELECT * FROM dbo.payroll_manual_adjustments
            WHERE period_month = ? AND period_year = ?
        `;
        const params: any[] = [month, year];

        if (divisionCode) {
            query += ` AND division_code = ?`;
            params.push(divisionCode);
        }

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
     * Uses upsert logic: update if exists (same nik/emp_code + period + income_name), insert if not.
     *
     * STORAGE STRATEGY:
     * - nik: Real NIK (KTP) - primary stable identifier for data extractor lookup
     * - emp_code: Employee code (B0065, etc.) - for emp_code-based lookup fallback
     * - Both fields stored so data extractor can find by either
     *
     * The frontend sends both `nik` (real NIK) and `emp_code` (B0065, etc.)
     * to ensure the data extractor can find the record.
     */
    private async saveOtherIncome(db: Database, data: ManualAdjustment, parsedAmount: number, user?: string): Promise<number> {
        const incomeType = data.adjustment_name; // e.g. 'KONTAN'
        const incomeName = normalizeStoredAdjustmentName(data.adjustment_name); // e.g. 'KONTAN'
        // Use real NIK for nik field, emp_code for emp_code field
        const realNik = (data.nik || '').trim().toUpperCase() || (data.emp_code || '').trim().toUpperCase();
        const empCodeVal = (data.emp_code || '').trim().toUpperCase();

        console.log(`[saveOtherIncome] Saving: nik=${realNik}, emp_code=${empCodeVal}, income=${incomeName}, amount=${parsedAmount}`);

        // Check for existing record: try by nik, then by emp_code
        let existing = await db.queryOne<{ id: number; nik: string; emp_code: string }>(`
            SELECT id, nik, emp_code FROM dbo.employee_other_incomes
            WHERE nik = ? AND period_month = ? AND period_year = ?
            AND ${buildNormalizedSqlNameExpression('income_name')} = ?
        `, [realNik, data.period_month, data.period_year, incomeName]);

        // Fallback: check by emp_code if not found by nik
        if (!existing) {
            existing = await db.queryOne<{ id: number; nik: string; emp_code: string }>(`
                SELECT id, nik, emp_code FROM dbo.employee_other_incomes
                WHERE emp_code = ? AND period_month = ? AND period_year = ?
                AND ${buildNormalizedSqlNameExpression('income_name')} = ?
            `, [empCodeVal, data.period_month, data.period_year, incomeName]);
        }

        if (existing) {
            if (parsedAmount === 0) {
                await db.query(`DELETE FROM dbo.employee_other_incomes WHERE id = ?`, [existing.id]);
                console.log(`[saveOtherIncome] Deleted ${incomeName} for nik=${realNik}, emp_code=${empCodeVal}`);
                return existing.id;
            }
            // Update existing: store BOTH nik and emp_code for consistent lookups
            await db.query(`
                UPDATE dbo.employee_other_incomes
                SET nik = ?, emp_code = ?, amount = ?, updated_at = GETDATE()
                WHERE id = ?
            `, [realNik, empCodeVal, parsedAmount, existing.id]);
            console.log(`[saveOtherIncome] Updated ${incomeName}: nik=${realNik}, emp_code=${empCodeVal}: Rp${parsedAmount}`);
            return existing.id;
        } else {
            if (parsedAmount === 0) return 0; // Don't insert zero

            // Insert new record with BOTH nik and emp_code
            const result = await db.query(`
                INSERT INTO dbo.employee_other_incomes (
                    nik, emp_code, emp_name, division_code, gang_code,
                    period_year, period_month, income_type, income_name,
                    amount, is_paid_in_thp, is_taxable,
                    created_at, updated_at
                ) OUTPUT INSERTED.id VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE()
                )
            `, [
                realNik,            // nik = real NIK (KTP) - primary lookup key
                empCodeVal,         // emp_code = emp_code - secondary lookup key
                null,               // emp_name - null, enriched by data extractor
                data.division_code || null,
                data.gang_code,
                data.period_year,
                data.period_month,
                incomeType,         // income_type = 'KONTAN'
                incomeName,         // income_name = 'KONTAN'
                parsedAmount,
                0,                  // is_paid_in_thp = false (added to gross wage, not THP)
                0,                  // is_taxable = false (not taxable income)
            ]);
            const id = result[0]?.id;
            console.log(`[saveOtherIncome] Inserted ${incomeName}: nik=${realNik}, emp_code=${empCodeVal}: Rp${parsedAmount}, ID=${id}`);
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
        const normalizedAdjustmentName = normalizeStoredAdjustmentName(data.adjustment_name);
        const normalizedAdjustmentNameSql = buildNormalizedSqlNameExpression('adjustment_name');

        // --- PENDAPATAN_LAINNYA: Save to employee_other_incomes ---
        if (data.adjustment_type === 'PENDAPATAN_LAINNYA') {
            console.log(`[saveAdjustment] PENDAPATAN_LAINNYA: emp_code=${data.emp_code}, gang=${data.gang_code}, name=${normalizedAdjustmentName}, amount=${parsedAmount}`);
            return await this.saveOtherIncome(db, { ...data, adjustment_name: normalizedAdjustmentName }, parsedAmount, user);
        }

        // --- Standard adjustments: Save to payroll_manual_adjustments ---

        // Check if an exact match exists
        const existing = await db.queryOne<{ id: number }>(`
            SELECT id FROM dbo.payroll_manual_adjustments
            WHERE period_month = ? AND period_year = ? 
            AND emp_code = ? AND adjustment_type = ?
            AND ${normalizedAdjustmentNameSql} = ?
        `, [data.period_month, data.period_year, data.emp_code, data.adjustment_type, normalizedAdjustmentName]);

        if (existing) {
            if (shouldDeleteStoredAdjustment(parsedAmount, data.remarks)) {
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
            if (shouldDeleteStoredAdjustment(parsedAmount, data.remarks)) return 0; // Don't insert zero

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
                data.adjustment_type, normalizedAdjustmentName, parsedAmount, data.remarks || null, user || 'system'
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
