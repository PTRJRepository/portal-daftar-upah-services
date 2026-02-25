import { Database } from "../db/client";
import { Config } from "../config";

export interface ManualAdjustment {
    id?: number;
    period_month: number;
    period_year: number;
    emp_code: string;
    gang_code: string;
    division_code?: string;
    adjustment_type: 'PREMI' | 'POTONGAN_KOTOR' | 'POTONGAN_BERSIH';
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
     * Save a manual adjustment (Insert or Update)
     */
    public async saveAdjustment(data: ManualAdjustment, user?: string): Promise<number> {
        const db = this.getDatabase();

        // Ensure amount is a valid float
        const parsedAmount = parseFloat(data.amount.toString()) || 0;

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
