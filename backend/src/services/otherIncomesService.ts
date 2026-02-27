import { Database } from "../db/client";
import { HistoryDatabaseService } from "./historyDatabaseService";

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
    details?: any; // For detailed reporting (formula variables)
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
                
                IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'employee_other_incomes_formulas' AND TABLE_SCHEMA = 'dbo')
                BEGIN
                    CREATE TABLE employee_other_incomes_formulas (
                        income_type VARCHAR(50) PRIMARY KEY,
                        formula_string VARCHAR(500) NOT NULL,
                        updated_at DATETIME DEFAULT GETDATE()
                    );
                    
                    INSERT INTO employee_other_incomes_formulas (income_type, formula_string) 
                    VALUES ('THR', '(UPAH_DASAR * 30) + (BERAS_RATE * 30) + MASA_KERJA_JUMLAH');
                END
            `);
            console.log("Verified 'employee_other_incomes' and 'employee_other_incomes_formulas' tables.");
        } catch (e) {
            console.error("Failed to init 'employee_other_incomes' table:", e);
        }
    }

    static async getFormula(incomeType: string): Promise<{ formula: string; is_paid_in_thp: boolean; is_taxable: boolean }> {
        const db = Database.getExtendedInstance();
        try {
            const rows = await db.query(`SELECT formula_string FROM employee_other_incomes_formulas WHERE income_type = ?`, [incomeType]);
            if (rows && rows.length > 0) {
                const raw = rows[0].formula_string;
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed.formula !== undefined) {
                        return {
                            formula: parsed.formula,
                            is_paid_in_thp: parsed.is_paid_in_thp ?? true,
                            is_taxable: parsed.is_taxable ?? true
                        };
                    }
                } catch {
                    // Raw string legacy format
                    return { formula: raw, is_paid_in_thp: true, is_taxable: true };
                }
            }
            return { formula: '', is_paid_in_thp: true, is_taxable: true };
        } catch (e) {
            console.error("Failed to fetch formula:", e);
            return { formula: '', is_paid_in_thp: true, is_taxable: true };
        }
    }

    static async saveFormula(incomeType: string, formulaString: string | { formula: string; is_paid_in_thp: boolean; is_taxable: boolean }): Promise<boolean> {
        const db = Database.getExtendedInstance();
        try {
            let configToSave = '';
            if (typeof formulaString === 'string') {
                configToSave = JSON.stringify({ formula: formulaString, is_paid_in_thp: true, is_taxable: true });
            } else {
                configToSave = JSON.stringify(formulaString);
            }

            const existing = await db.query(`SELECT income_type FROM employee_other_incomes_formulas WHERE income_type = ?`, [incomeType]);
            if (existing && existing.length > 0) {
                await db.query(`UPDATE employee_other_incomes_formulas SET formula_string = ?, updated_at = GETDATE() WHERE income_type = ?`, [configToSave, incomeType]);
            } else {
                await db.query(`INSERT INTO employee_other_incomes_formulas (income_type, formula_string, updated_at) VALUES (?, ?, GETDATE())`, [incomeType, configToSave]);
            }
            return true;
        } catch (e) {
            console.error("Failed to save formula:", e);
            return false;
        }
    }

    static async getIncomesWithDetails(year: number, month: number, divisionCode?: string, gangCode?: string, incomeType?: string): Promise<OtherIncome[]> {
        let incomes = await this.getIncomes(year, month, divisionCode, gangCode);
        if (incomeType && incomeType !== 'ALL') {
            incomes = incomes.filter(inc => inc.income_type === incomeType);
        }

        const hasTHR = incomes.some(inc => inc.income_type === 'THR');
        const historyDict: Record<string, any> = {};

        if (hasTHR) {
            try {
                const historyService = HistoryDatabaseService.getInstance();
                const historyData = await historyService.getHistoricalPayrollDataAsExtractorFormat(
                    month, year, gangCode || 'ALL', divisionCode || undefined
                );
                if (historyData && historyData.data_rows) {
                    for (const row of historyData.data_rows) {
                        const nik = String(row.nik_ktp || row.nik || '').trim().toUpperCase();
                        if (nik) {
                            historyDict[nik] = {
                                UPAH_DASAR: row.upah_dasar || 0,
                                BERAS_RATE: row.beras_rate || 0,
                                MASA_KERJA_JUMLAH: row.masa_kerja_jumlah || 0,
                                MASA_KERJA_TAHUN: row.masa_kerja_tahun || 0,
                                HK: row.jumlah_hk || 0
                            };
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to fetch history for detailed incomes:", e);
            }
        }

        const thrFormula = hasTHR ? await this.getFormula('THR') : null;

        for (const inc of incomes) {
            if (inc.income_type === 'THR') {
                inc.details = {
                    formula: thrFormula?.formula || '',
                    variables: historyDict[inc.nik.trim().toUpperCase()] || null
                };
            }
        }

        return incomes;
    }

    static async getIncomes(year: number, month: number, divisionCode?: string, gangCode?: string): Promise<OtherIncome[]> {
        const db = Database.getExtendedInstance();
        try {
            let sql = `SELECT * FROM employee_other_incomes WHERE period_year = ? AND period_month = ?`;
            const params: any[] = [year, month];

            if (divisionCode && divisionCode !== 'ALL') {
                sql += ` AND division_code = ?`;
                params.push(divisionCode);
            }

            if (gangCode && gangCode !== 'ALL') {
                sql += ` AND gang_code = ?`;
                params.push(gangCode);
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
            let sql = `SELECT * FROM employee_other_incomes WHERE period_year = ?`;
            const params: any[] = [year];

            if (divisionCode && divisionCode !== 'ALL') {
                sql += ` AND division_code = ?`;
                params.push(divisionCode);
            }

            if (gangCode && gangCode !== 'ALL') {
                sql += ` AND gang_code = ?`;
                params.push(gangCode);
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
            const sql = `SELECT * FROM employee_other_incomes WHERE period_year = ? AND period_month = ? AND nik = ?`;
            const rows = await db.query(sql, [year, month, nik]);
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
                (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())
            `, [
                data.nik,
                data.emp_name,
                data.division_code || null,
                data.gang_code || null,
                data.period_year,
                data.period_month,
                data.income_type,
                data.income_name || data.income_type,
                data.amount,
                data.is_paid_in_thp ? 1 : 0,
                data.is_taxable ? 1 : 0
            ]);
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
            const params: any[] = [];

            const updatableFields = ['amount', 'is_paid_in_thp', 'is_taxable', 'income_name', 'income_type'];
            for (const field of updatableFields) {
                if (data[field as keyof OtherIncome] !== undefined) {
                    updates.push(`${field} = ?`);
                    const value = data[field as keyof OtherIncome];
                    params.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
                }
            }

            if (updates.length > 0) {
                updates.push(`updated_at = GETDATE()`);
                const sql = `UPDATE employee_other_incomes SET ${updates.join(', ')} WHERE id = ?`;
                params.push(id);
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
            await db.query(`DELETE FROM employee_other_incomes WHERE id = ?`, [id]);
            return true;
        } catch (e) {
            console.error("Failed to delete income:", e);
            return false;
        }
    }

    static async calculateAndSaveTHR(year: number, month: number, divisionCode?: string, gangCode?: string): Promise<{ success: boolean; count: number; message?: string }> {
        try {
            const historyService = HistoryDatabaseService.getInstance();
            const historyData = await historyService.getHistoricalPayrollDataAsExtractorFormat(
                month, year, gangCode || 'ALL', divisionCode || undefined
            );

            if (!historyData || historyData.data_rows.length === 0) {
                return { success: false, count: 0, message: "No history data found for the given period to calculate THR." };
            }

            const formulaConfig = await this.getFormula('THR');
            if (!formulaConfig || !formulaConfig.formula) {
                return { success: false, count: 0, message: "Formula THR belum dikonfigurasi di pengaturan." };
            }

            const formulaString = formulaConfig.formula;
            const isPaidInThp = formulaConfig.is_paid_in_thp ? 1 : 0;
            const isTaxable = formulaConfig.is_taxable ? 1 : 0;

            let insertedCount = 0;
            const db = Database.getExtendedInstance();

            for (const row of historyData.data_rows) {
                const nik = String(row.nik_ktp || row.nik || '').trim().toUpperCase();
                const empName = row.nama || row.emp_name || '';
                const divCode = row.division_code || divisionCode;
                const gCode = row.gang_code || gangCode;
                const masaKerjaTahun = row.masa_kerja_tahun || 0;

                if (masaKerjaTahun >= 1 && nik) {
                    const upahDasar = row.upah_dasar || 0;
                    const berasRate = row.beras_rate || 0;
                    const masaKerjaJumlah = row.masa_kerja_jumlah || 0;
                    const hk = row.jumlah_hk || 0;

                    let thrAmount = 0;
                    try {
                        // Safe evaluation approach using Function constructor
                        const mathVars = {
                            UPAH_DASAR: upahDasar,
                            BERAS_RATE: berasRate,
                            MASA_KERJA_JUMLAH: masaKerjaJumlah,
                            MASA_KERJA_TAHUN: masaKerjaTahun,
                            HK: hk
                        };
                        const evaluator = new Function(...Object.keys(mathVars), `return ${formulaString};`);
                        thrAmount = evaluator(...Object.values(mathVars));
                    } catch (err) {
                        console.error("Failed to evaluate THR Formula:", err);
                        continue;
                    }

                    if (thrAmount > 0) {
                        const existing = await db.query(`SELECT id FROM employee_other_incomes WHERE period_year = ? AND period_month = ? AND nik = ? AND income_type = 'THR'`, [year, month, nik]);

                        if (existing && existing.length > 0) {
                            await db.query(`UPDATE employee_other_incomes SET amount = ?, updated_at = GETDATE() WHERE id = ?`, [thrAmount, existing[0].id]);
                        } else {
                            await db.query(`
                                INSERT INTO employee_other_incomes
                                (nik, emp_name, division_code, gang_code, period_year, period_month, income_type, income_name, amount, is_paid_in_thp, is_taxable, created_at, updated_at)
                                VALUES 
                                (?, ?, ?, ?, ?, ?, 'THR', 'Tunjangan Hari Raya', ?, ?, ?, GETDATE(), GETDATE())
                            `, [
                                nik,
                                empName,
                                divCode || null,
                                gCode || null,
                                year,
                                month,
                                thrAmount,
                                isPaidInThp,
                                isTaxable
                            ]);
                        }
                        insertedCount++;
                    }
                }
            }
            return { success: true, count: insertedCount };
        } catch (e: any) {
            console.error("Failed to calculate and save THR:", e);
            return { success: false, count: 0, message: e.message };
        }
    }
}
