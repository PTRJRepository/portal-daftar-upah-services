import { Database } from "../db/client";
import { HistoryDatabaseService } from "./historyDatabaseService";
import { divisionDefinition } from "./divisionDefinition";

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
    religion?: string;
    join_date?: string;
    emp_code?: string;
    bank_acc_no?: string;
    bank_code?: string;
}

export class OtherIncomesService {
    private static chunkArray<T>(array: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size));
        return chunks;
    }

    private static parseDate(dateStr: any): Date | null {
        if (!dateStr) return null;
        if (dateStr instanceof Date) return dateStr;
        let d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d;
        const parts = String(dateStr).split(/[\/\-]/);
        if (parts.length === 3) {
            if (parts[2].length === 4) d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
            else if (parts[0].length === 4) d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            if (!isNaN(d.getTime())) return d;
        }
        return null;
    }

    private static getEarliestValidDate(d1: any, d2: any): string | null {
        const date1 = this.parseDate(d1); const date2 = this.parseDate(d2);
        const isValid = (d: Date | null) => d && !isNaN(d.getTime()) && d.getFullYear() > 1905;
        const v1 = isValid(date1) ? date1 : null; const v2 = isValid(date2) ? date2 : null;
        let earliest: Date | null = null;
        if (v1 && v2) earliest = v1.getTime() < v2.getTime() ? v1 : v2;
        else earliest = v1 || v2;
        return earliest ? earliest.toISOString() : null;
    }

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
        } catch (e) { console.error("Init table error:", e); }
    }

    static async getFormula(incomeType: string): Promise<{ formula: string; is_paid_in_thp: boolean; is_taxable: boolean }> {
        const db = Database.getExtendedInstance();
        try {
            const rows = await db.query(`SELECT formula_string FROM employee_other_incomes_formulas WHERE income_type = ?`, [incomeType]);
            if (rows && rows.length > 0) {
                const raw = rows[0].formula_string;
                try {
                    const parsed = JSON.parse(raw);
                    return { formula: parsed.formula, is_paid_in_thp: parsed.is_paid_in_thp ?? true, is_taxable: parsed.is_taxable ?? true };
                } catch { return { formula: raw, is_paid_in_thp: true, is_taxable: true }; }
            }
            return { formula: '(UPAH_DASAR * 30) + (BERAS_RATE * 30) + MASA_KERJA_JUMLAH', is_paid_in_thp: true, is_taxable: true };
        } catch (e) { return { formula: '(UPAH_DASAR * 30) + (BERAS_RATE * 30) + MASA_KERJA_JUMLAH', is_paid_in_thp: true, is_taxable: true }; }
    }

    static async saveFormula(incomeType: string, formulaString: string | { formula: string; is_paid_in_thp: boolean; is_taxable: boolean }): Promise<boolean> {
        const db = Database.getExtendedInstance();
        try {
            const configToSave = typeof formulaString === 'string' ? JSON.stringify({ formula: formulaString, is_paid_in_thp: true, is_taxable: true }) : JSON.stringify(formulaString);
            const existing = await db.query(`SELECT income_type FROM employee_other_incomes_formulas WHERE income_type = ?`, [incomeType]);
            if (existing && existing.length > 0) await db.query(`UPDATE employee_other_incomes_formulas SET formula_string = ?, updated_at = GETDATE() WHERE income_type = ?`, [configToSave, incomeType]);
            else await db.query(`INSERT INTO employee_other_incomes_formulas (income_type, formula_string, updated_at) VALUES (?, ?, GETDATE())`, [incomeType, configToSave]);
            return true;
        } catch (e) { return false; }
    }

    static async getRawIncomes(year: number, month: number, divisionCode?: string, gangCode?: string): Promise<OtherIncome[]> {
        const db = Database.getExtendedInstance();
        try {
            let sql = `SELECT * FROM employee_other_incomes WHERE period_year = ? AND period_month = ?`;
            const params: any[] = [year, month];
            if (divisionCode && divisionCode !== 'ALL') {
                const sourceDivs = await divisionDefinition.getSourceDivisionsForAggregation(divisionCode);
                const allPossibleDivs = new Set<string>([divisionCode]);
                sourceDivs.forEach(sd => {
                    allPossibleDivs.add(sd);
                    if (sd.startsWith('P') && sd.length === 3) allPossibleDivs.add('PG' + sd.substring(1));
                    if (sd.startsWith('PG') && sd.length === 4) allPossibleDivs.add('P' + sd.substring(2));
                });
                const divList = Array.from(allPossibleDivs);
                sql += ` AND division_code IN (${divList.map(() => '?').join(',')})`;
                params.push(...divList);
            }
            if (gangCode && gangCode !== 'ALL') { sql += ` AND gang_code = ?`; params.push(gangCode); }
            return (await db.query(sql, params)) as OtherIncome[];
        } catch (e) { return []; }
    }

    static async getIncomes(year: number, month: number, divisionCode?: string, gangCode?: string): Promise<OtherIncome[]> {
        // Lightweight: only fetch from local DB + enrich with HR data (no HistoryDB hit)
        // This keeps the page load fast. Details are fetched separately when needed.
        const raw = await this.getRawIncomes(year, month, divisionCode, gangCode);
        if (raw.length === 0) return [];
        return this.enrichWithHrData(raw, gangCode);
    }

    private static async enrichWithHrData(incomes: OtherIncome[], gangCode?: string): Promise<OtherIncome[]> {
        if (incomes.length === 0) return incomes;
        try {
            const mainDb = Database.getInstance();
            const nikSet = [...new Set(incomes.map(i => i.nik?.trim()).filter(Boolean))];
            const nikChunks = this.chunkArray(nikSet, 500);
            const religionMap: Record<string, string> = {
                'ISLAM': '01 Islam', 'KATHOLIK': '02 Katolik', 'KATOLIK': '02 Katolik',
                'KRISTEN': '03 Protestan', 'PROTESTAN': '03 Protestan', 'HINDU': '04 Hindu',
                'BUDHA': '05 Budha', 'BUDDHA': '05 Budha', 'KONGHUCU': '06 Konghucu'
            };
            const hrMap = new Map<string, any>();
            for (const chunk of nikChunks) {
                const placeholders = chunk.map(() => '?').join(',');
                const hrRows = await mainDb.query<any>(`
                    SELECT RTRIM(e.EmpCode) as EmpCode, RTRIM(e.NewICNo) as NewICNo, RTRIM(e.EmpName) as EmpName, e.Religion, e.Gender, e.Status, em.AppJoinDate, em.AppJoinGrpDate,
                           RTRIM(p.BankAccNo) as BankAccNo, RTRIM(p.BankCode) as BankCode, RTRIM(gl.GangCode) as GangCode, RTRIM(gl.GangMember) as GangMember,
                           COALESCE(p.PayRate, 0) as PayRate, COALESCE(p.RiceRation, 0) as RiceRation
                    FROM HR_EMPLOYEE e
                    LEFT JOIN HR_EMPLOYMENT em ON e.EmpCode = em.EmpCode
                    LEFT JOIN HR_PAYROLL p ON e.EmpCode = p.EmpCode
                    LEFT JOIN HR_GANGLN gl ON e.EmpCode = gl.GangMember
                    WHERE RTRIM(e.EmpCode) IN (${placeholders}) OR RTRIM(e.NewICNo) IN (${placeholders})
                    ORDER BY CASE WHEN e.Status = '1' THEN 0 ELSE 1 END, em.AppJoinDate DESC
                `, [...chunk, ...chunk]);

                hrRows.forEach(r => {
                    const rawRel = (r.Religion || '').trim().toUpperCase();
                    const data = {
                        religion: religionMap[rawRel] || rawRel,
                        join_date: this.getEarliestValidDate(r.AppJoinDate, r.AppJoinGrpDate),
                        emp_code: (gangCode && r.GangCode === gangCode && r.GangMember) ? r.GangMember : (r.EmpCode?.trim() || ''),
                        bank_acc_no: r.BankAccNo || '', bank_code: r.BankCode || '',
                        sex: (r.Gender || '').trim().toUpperCase() === 'FEMALE' ? 'P' : 'L',
                        upah_dasar: r.PayRate || 0, beras_rate: r.RiceRation || 0, emp_name: r.EmpName
                    };
                    const empKey = r.EmpCode.trim().toUpperCase(); const nikKey = r.NewICNo?.trim().toUpperCase();
                    if (!hrMap.has(empKey)) hrMap.set(empKey, data);
                    if (nikKey && !hrMap.has(nikKey)) hrMap.set(nikKey, data);
                });
            }
            incomes.forEach(inc => {
                const hr = hrMap.get(inc.nik?.trim().toUpperCase());
                if (hr) {
                    inc.religion = hr.religion; inc.emp_code = hr.emp_code; inc.bank_acc_no = hr.bank_acc_no; inc.bank_code = hr.bank_code;
                    if (!inc.join_date) inc.join_date = hr.join_date;
                    if (!inc.emp_name || inc.emp_name === inc.nik) inc.emp_name = hr.emp_name;
                    (inc as any).upah_dasar = hr.upah_dasar; (inc as any).beras_rate = hr.beras_rate; (inc as any).sex = hr.sex;
                }

                // Force recalculate THR proportion if it hasn't been applied or wasn't correctly applied during seeding
                if (inc.income_type === 'THR' && inc.join_date) {
                    const jd = this.parseDate(inc.join_date);
                    if (jd) {
                        const periodDate = new Date(inc.period_year, inc.period_month - 1, 1);
                        const diff = (periodDate.getFullYear() - jd.getFullYear()) * 12 + (periodDate.getMonth() - jd.getMonth());
                        if (diff < 12 && diff >= 0) {
                            const workingMonths = Math.min(12, diff + 1);
                            if (workingMonths < 12) {
                                // If the name does not explicitly state it's proportioned, apply it.
                                if (!inc.income_name || !inc.income_name.toLowerCase().includes('proporsi')) {
                                    const fullAmt = inc.amount || 0;
                                    inc.amount = Math.round((fullAmt * workingMonths) / 12);
                                    inc.income_name = `Tunjangan Hari Raya (Proporsi ${workingMonths}/12)`;

                                    if (inc.details && inc.details.variables) {
                                        inc.details.variables.WORKING_MONTHS = workingMonths;
                                        inc.details.variables.PROPORTION_FACTOR = `${workingMonths}/12`;
                                    }
                                }
                            }
                        }
                    }
                }
            });
        } catch (e) { console.error("Enrich error:", e); }
        return incomes;
    }

    static async getIncomesWithDetails(year: number, month: number, divisionCode?: string, gangCode?: string, incomeType?: string): Promise<OtherIncome[]> {
        // BUG FIX: Call getRawIncomes directly (not getIncomes) to avoid infinite loop.
        // getIncomes used to call getIncomesWithDetails → infinite recursion.
        const raw = await this.getRawIncomes(year, month, divisionCode, gangCode);
        if (raw.length === 0) return [];
        const enriched = await this.enrichWithHrData(raw, gangCode);
        const filtered = incomeType && incomeType !== 'ALL' ? enriched.filter(inc => inc.income_type === incomeType) : enriched;
        if (filtered.length === 0) return [];

        // Only fetch heavy HistoryDB data when we specifically need details
        const historyDict: Record<string, any> = {};
        try {
            const historyService = HistoryDatabaseService.getInstance();
            const historyData = await historyService.getHistoricalPayrollDataAsExtractorFormat(month, year, gangCode || 'ALL', divisionCode || undefined);
            if (historyData?.data_rows) historyData.data_rows.forEach((row: any) => { const nik = String(row.nik || '').trim().toUpperCase(); if (nik) historyDict[nik] = row; });
        } catch (e) { console.error("History fetch error:", e); }
        const thrFormula = await this.getFormula('THR');
        return filtered.map(inc => {
            const nikKey = inc.nik?.trim().toUpperCase(); const h = historyDict[nikKey];
            const upahDasar = h?.upah_dasar || (inc as any).upah_dasar || 0;
            const vars = {
                UPAH_DASAR: upahDasar,
                GAJI_POKOK: upahDasar * 30,
                BERAS_RATE: h?.beras_rate || (inc as any).beras_rate || 0,
                MASA_KERJA_JUMLAH: h?.masa_kerja_jumlah || 0,
                MASA_KERJA_TAHUN: h?.masa_kerja_tahun || 0,
                JOIN_DATE: inc.join_date || h?.join_date,
                PROPORTION_FACTOR: "12/12",
                SEX: (inc as any).sex || (h?.gender === 'FEMALE' ? 'P' : 'L'),
                BANK_ACC_NO: inc.bank_acc_no || h?.bank_acc_no,
                BANK_CODE: inc.bank_code || h?.bank_code,
                EMP_CODE: inc.emp_code || h?.emp_code
            };
            const jd = this.parseDate(vars.JOIN_DATE);
            if (jd) {
                const periodDate = new Date(year, month - 1, 1);
                const diff = (periodDate.getFullYear() - jd.getFullYear()) * 12 + (periodDate.getMonth() - jd.getMonth());
                if (diff < 12 && diff >= 0) { vars.PROPORTION_FACTOR = `${Math.min(12, diff + 1)}/12`; }
            }
            return { ...inc, details: { formula: thrFormula.formula, variables: vars } };
        });
    }

    static async calculateTHRData(year: number, month: number, divisionCode?: string, gangCode?: string): Promise<OtherIncome[]> {
        const historyService = HistoryDatabaseService.getInstance();
        const historyData = await historyService.getHistoricalPayrollDataAsExtractorFormat(month, year, gangCode || 'ALL', divisionCode || undefined);
        if (!historyData?.data_rows?.length) return [];
        const formulaConfig = await this.getFormula('THR');
        const results: OtherIncome[] = [];
        for (const row of historyData.data_rows) {
            const nik = String(row.nik || '').trim().toUpperCase();
            const upahDasar = row.upah_dasar || 0;
            const mathVars = { UPAH_DASAR: upahDasar, GAJI_POKOK: upahDasar * 30, BERAS_RATE: row.beras_rate || 0, MASA_KERJA_JUMLAH: row.masa_kerja_jumlah || 0, MASA_KERJA_TAHUN: row.masa_kerja_tahun || 0, HK: 30 };
            let fullThr = 0;
            try {
                const evalFn = new Function(...Object.keys(mathVars), `return ${formulaConfig.formula};`);
                fullThr = evalFn(...Object.values(mathVars));
            } catch { fullThr = (upahDasar * 30) + (row.beras_rate * 30) + (row.masa_kerja_jumlah || 0); }
            let thrAmt = fullThr; let propDesc = ''; let workingMonths = 12; let propFactor = "12/12";
            const jd = this.parseDate(row.join_date);
            if (jd) {
                const periodDate = new Date(year, month - 1, 1);
                let diff = (periodDate.getFullYear() - jd.getFullYear()) * 12 + (periodDate.getMonth() - jd.getMonth());
                if (diff < 12 && diff >= 0) {
                    workingMonths = Math.min(12, diff + 1);
                    if (workingMonths < 12) { propFactor = `${workingMonths}/12`; thrAmt = Math.round((fullThr * workingMonths) / 12); propDesc = ` (Proporsi ${workingMonths}/12)`; }
                }
            }
            let relRow = row.religion || '';
            const rawRowRel = relRow.trim().toUpperCase();
            const religionMap: Record<string, string> = {
                'ISLAM': '01 Islam', 'KATHOLIK': '02 Katolik', 'KATOLIK': '02 Katolik',
                'KRISTEN': '03 Protestan', 'PROTESTAN': '03 Protestan', 'HINDU': '04 Hindu',
                'BUDHA': '05 Budha', 'BUDDHA': '05 Budha', 'KONGHUCU': '06 Konghucu'
            };
            const mappedRel = religionMap[rawRowRel] || relRow;

            results.push({
                nik, emp_name: row.nama || row.emp_name || '', division_code: divisionCode || row.loc_code, gang_code: row.gang_code, period_year: year, period_month: month, income_type: 'THR', income_name: `Tunjangan Hari Raya${propDesc}`, amount: thrAmt, is_paid_in_thp: true, is_taxable: true,
                details: { formula: formulaConfig.formula, variables: { ...mathVars, JOIN_DATE: row.join_date, WORKING_MONTHS: workingMonths, PROPORTION_FACTOR: propFactor, RELIGION: mappedRel, SEX: row.jenis_kelamin === 'FEMALE' ? 'P' : 'L', EMP_CODE: row.emp_code } }
            });
        }
        return this.enrichWithHrData(results, gangCode);
    }

    static async bulkSaveIncomes(incomes: OtherIncome[]): Promise<{ success: boolean; count: number }> {
        const db = Database.getExtendedInstance(); let count = 0;
        try {
            for (const inc of incomes) {
                await db.query(`DELETE FROM employee_other_incomes WHERE period_year = ? AND period_month = ? AND nik = ? AND income_type = ?`, [inc.period_year, inc.period_month, inc.nik, inc.income_type]);
                await db.query(`INSERT INTO employee_other_incomes (nik, emp_name, division_code, gang_code, period_year, period_month, income_type, income_name, amount, is_paid_in_thp, is_taxable, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())`,
                    [inc.nik, inc.emp_name, inc.division_code, inc.gang_code, inc.period_year, inc.period_month, inc.income_type, inc.income_name, inc.amount, inc.is_paid_in_thp ? 1 : 0, inc.is_taxable ? 1 : 0]);
                count++;
            }
            return { success: true, count };
        } catch (e) { return { success: false, count }; }
    }

    static async addIncome(data: any): Promise<OtherIncome | null> {
        const db = Database.getExtendedInstance();
        try {
            const result = await db.query(`INSERT INTO employee_other_incomes (nik, emp_name, division_code, gang_code, period_year, period_month, income_type, income_name, amount, is_paid_in_thp, is_taxable, created_at, updated_at) OUTPUT INSERTED.* VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())`,
                [data.nik, data.emp_name, data.division_code, data.gang_code, data.period_year, data.period_month, data.income_type, data.income_name, data.amount, data.is_paid_in_thp ? 1 : 0, data.is_taxable ? 1 : 0]);
            return result[0];
        } catch (e) { return null; }
    }

    static async updateIncome(id: number, data: Partial<OtherIncome>): Promise<boolean> {
        const db = Database.getExtendedInstance();
        try {
            const fields: string[] = [];
            const values: any[] = [];
            if (data.amount !== undefined) { fields.push('amount = ?'); values.push(data.amount); }
            if (data.income_name !== undefined) { fields.push('income_name = ?'); values.push(data.income_name); }
            if (data.is_paid_in_thp !== undefined) { fields.push('is_paid_in_thp = ?'); values.push(data.is_paid_in_thp ? 1 : 0); }
            if (data.is_taxable !== undefined) { fields.push('is_taxable = ?'); values.push(data.is_taxable ? 1 : 0); }
            if (data.gang_code !== undefined) { fields.push('gang_code = ?'); values.push(data.gang_code); }
            if (data.division_code !== undefined) { fields.push('division_code = ?'); values.push(data.division_code); }
            if (fields.length === 0) return true;
            fields.push('updated_at = GETDATE()');
            values.push(id);
            await db.query(`UPDATE employee_other_incomes SET ${fields.join(', ')} WHERE id = ?`, values);
            return true;
        } catch (e) { console.error('updateIncome error:', e); return false; }
    }

    static async deleteIncome(id: number): Promise<boolean> {
        const db = Database.getExtendedInstance();
        try { await db.query(`DELETE FROM employee_other_incomes WHERE id = ?`, [id]); return true; }
        catch (e) { return false; }
    }

    // calculateAndSaveTHR: calculates THR for all employees and saves to DB
    static async calculateAndSaveTHR(year: number, month: number, divisionCode?: string, gangCode?: string): Promise<{ success: boolean; count?: number; error?: string }> {
        try {
            const data = await this.calculateTHRData(year, month, divisionCode, gangCode);
            if (!data.length) return { success: false, error: 'Tidak ada data karyawan untuk periode ini.' };
            const result = await this.bulkSaveIncomes(data);
            return result;
        } catch (e: any) { return { success: false, error: e.message }; }
    }

    // Alias for frontend compatibility if needed
    static async bulkSave(incomes: OtherIncome[]) { return this.bulkSaveIncomes(incomes); }
    static async previewTHR(year: number, month: number, division?: string, gang?: string) {
        try { const data = await this.calculateTHRData(year, month, division, gang); return { success: true, data }; }
        catch (e: any) { return { success: false, error: e.message }; }
    }
}
