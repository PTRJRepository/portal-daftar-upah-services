import { Database } from "../db/client";

export interface OtherIncome {
    id?: number;
    nik: string;
    emp_name: string;
    division_code?: string;
    gang_code?: string;
    period_year: number;
    period_month: number;
    income_type: string; // THR, Bonus, Custom
    income_name: string; // Detail name
    amount: number;
    is_paid_in_thp: boolean;
    is_taxable: boolean;
    created_at?: string;
    updated_at?: string;
}

export class OtherIncomesService {
    static async initTable() {
        const db = Database.getExtendedInstance();
        try {
            await db.query(`
                IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'employee_other_incomes' AND TABLE_SCHEMA = 'dbo')
                BEGIN
                    CREATE TABLE employee_other_incomes (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        nik VARCHAR(50) NOT NULL,
                        emp_name VARCHAR(150),
                        division_code VARCHAR(50),
                        gang_code VARCHAR(50),
                        period_year INT NOT NULL,
                        period_month INT NOT NULL,
                        income_type VARCHAR(50) NOT NULL,
                        income_name VARCHAR(150),
                        amount DECIMAL(18, 2) DEFAULT 0,
                        is_paid_in_thp BIT DEFAULT 0,
                        is_taxable BIT DEFAULT 0,
                        created_at DATETIME DEFAULT GETDATE(),
                        updated_at DATETIME DEFAULT GETDATE()
                    );
                    
                    CREATE INDEX IDX_OtherIncomes_Period ON employee_other_incomes(period_year, period_month);
                    CREATE INDEX IDX_OtherIncomes_NIK ON employee_other_incomes(nik);
                END
            `);
            console.log("Verified 'employee_other_incomes' table.");
        } catch (e) {
            console.error("Failed to init 'employee_other_incomes' table:", e);
        }
    }

    static async getIncomes(year: number, month: number, divisionCode?: string, gangCode?: string): Promise<OtherIncome[]> {
        const db = Database.getExtendedInstance();
        try {
            let sql = `SELECT * FROM employee_other_incomes WHERE period_year = @year AND period_month = @month`;
            const params: any = { year, month };

            if (divisionCode && divisionCode !== 'ALL') {
                sql += ` AND division_code = @divisionCode`;
                params.divisionCode = divisionCode;
            }

            if (gangCode && gangCode !== 'ALL') {
                sql += ` AND gang_code = @gangCode`;
                params.gangCode = gangCode;
            }

            const rows = await db.query(sql, params);
            return rows as OtherIncome[];
        } catch (e) {
            console.error("Failed to fetch other incomes:", e);
            return [];
        }
    }

    static async getIncomesForYear(year: number, divisionCode?: string, gangCode?: string): Promise<OtherIncome[]> {
        const db = Database.getExtendedInstance();
        try {
            let sql = `SELECT * FROM employee_other_incomes WHERE period_year = @year`;
            const params: any = { year };

            if (divisionCode && divisionCode !== 'ALL') {
                sql += ` AND division_code = @divisionCode`;
                params.divisionCode = divisionCode;
            }

            if (gangCode && gangCode !== 'ALL') {
                sql += ` AND gang_code = @gangCode`;
                params.gangCode = gangCode;
            }

            const rows = await db.query(sql, params);
            return rows as OtherIncome[];
        } catch (e) {
            console.error("Failed to fetch other incomes for year:", e);
            return [];
        }
    }

    static async getIncomesByNik(year: number, month: number, nik: string): Promise<OtherIncome[]> {
        const db = Database.getExtendedInstance();
        try {
            const sql = `SELECT * FROM employee_other_incomes WHERE period_year = @year AND period_month = @month AND nik = @nik`;
            const rows = await db.query(sql, { year, month, nik });
            return rows as OtherIncome[];
        } catch (e) {
            console.error("Failed to fetch other incomes for nik:", e);
            return [];
        }
    }

    static async addIncome(data: OtherIncome): Promise<OtherIncome | null> {
        const db = Database.getExtendedInstance();
        try {
            const result = await db.query(`
                INSERT INTO employee_other_incomes 
                (nik, emp_name, division_code, gang_code, period_year, period_month, income_type, income_name, amount, is_paid_in_thp, is_taxable, created_at, updated_at)
                OUTPUT INSERTED.*
                VALUES 
                (@nik, @emp_name, @division_code, @gang_code, @period_year, @period_month, @income_type, @income_name, @amount, @is_paid_in_thp, @is_taxable, GETDATE(), GETDATE())
            `, {
                nik: data.nik,
                emp_name: data.emp_name,
                division_code: data.division_code || null,
                gang_code: data.gang_code || null,
                period_year: data.period_year,
                period_month: data.period_month,
                income_type: data.income_type,
                income_name: data.income_name || data.income_type,
                amount: data.amount,
                is_paid_in_thp: data.is_paid_in_thp ? 1 : 0,
                is_taxable: data.is_taxable ? 1 : 0
            });
            return result && result.length > 0 ? (result[0] as OtherIncome) : null;
        } catch (e) {
            console.error("Failed to add income:", e);
            return null;
        }
    }

    static async updateIncome(id: number, data: Partial<OtherIncome>): Promise<boolean> {
        const db = Database.getExtendedInstance();
        try {
            const updates: string[] = [];
            const params: any = { id };

            const updatableFields = ['amount', 'is_paid_in_thp', 'is_taxable', 'income_name', 'income_type'];
            for (const field of updatableFields) {
                if (data[field as keyof OtherIncome] !== undefined) {
                    updates.push(`${field} = @${field}`);
                    const value = data[field as keyof OtherIncome];
                    params[field] = typeof value === 'boolean' ? (value ? 1 : 0) : value;
                }
            }

            if (updates.length > 0) {
                updates.push(`updated_at = GETDATE()`);
                const sql = `UPDATE employee_other_incomes SET ${updates.join(', ')} WHERE id = @id`;
                await db.query(sql, params);
            }
            return true;
        } catch (e) {
            console.error("Failed to update income:", e);
            return false;
        }
    }

    static async deleteIncome(id: number): Promise<boolean> {
        const db = Database.getExtendedInstance();
        try {
            await db.query(`DELETE FROM employee_other_incomes WHERE id = @id`, { id });
            return true;
        } catch (e) {
            console.error("Failed to delete income:", e);
            return false;
        }
    }
}
