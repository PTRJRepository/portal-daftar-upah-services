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
    /**
     * Helper to get earliest valid date between two inputs, ignoring year 1900
     */
    private static getEarliestValidDate(d1: any, d2: any): string | null {
        const date1 = d1 ? new Date(d1) : null;
        const date2 = d2 ? new Date(d2) : null;
        const isValid = (d: Date | null) => d && !isNaN(d.getTime()) && d.getFullYear() > 1905;
        const v1 = isValid(date1) ? date1 : null;
        const v2 = isValid(date2) ? date2 : null;
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
            return { formula: '', is_paid_in_thp: true, is_taxable: true };
        } catch (e) { return { formula: '', is_paid_in_thp: true, is_taxable: true }; }
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

    static async getIncomesWithDetails(year: number, month: number, divisionCode?: string, gangCode?: string, incomeType?: string): Promise<OtherIncome[]> {
        let incomes = await this.getIncomes(year, month, divisionCode, gangCode);
        if (incomeType && incomeType !== 'ALL') incomes = incomes.filter(inc => inc.income_type === incomeType);

        const hasTHR = incomes.some(inc => inc.income_type === 'THR');
        const historyDict: Record<string, any> = {};

        if (hasTHR) {
            try {
                const historyService = HistoryDatabaseService.getInstance();
                const historyData = await historyService.getHistoricalPayrollDataAsExtractorFormat(month, year, gangCode || 'ALL', divisionCode || undefined);
                const prevMonth = month === 1 ? 12 : month - 1;
                const prevYear = month === 1 ? year - 1 : year;
                const prevHistoryData = await historyService.getHistoricalPayrollDataAsExtractorFormat(prevMonth, prevYear, gangCode || 'ALL', divisionCode || undefined);
                const prevDict: Record<string, any> = {};
                if (prevHistoryData?.data_rows) {
                    for (const row of prevHistoryData.data_rows) {
                        const nik = String(row.nik_ktp || row.nik || '').trim().toUpperCase();
                        if (nik) prevDict[nik] = row;
                    }
                }

                const mainDb = Database.getInstance();
                const allNiks = incomes.map(r => String(r.nik || '').trim()).filter(Boolean);
                const hrMap = new Map<string, { join_date: string; emp_code: string; religion: string; sex: string }>();
                if (allNiks.length > 0) {
                    const placeholders = allNiks.map(() => '?').join(',');
                    const hrRows = await mainDb.query<{ EmpCode: string; NewICNo: string; AppJoinDate: any; AppJoinGrpDate: any; Religion: string; Gender: string }>(`
                        SELECT RTRIM(e.EmpCode) as EmpCode, RTRIM(e.NewICNo) as NewICNo, em.AppJoinDate, em.AppJoinGrpDate, e.Religion, e.Gender
                        FROM HR_EMPLOYEE e
                        LEFT JOIN HR_EMPLOYMENT em ON e.EmpCode = em.EmpCode
                        WHERE RTRIM(e.NewICNo) IN (${placeholders}) OR RTRIM(e.EmpCode) IN (${placeholders})
                    `, [...allNiks, ...allNiks]);

                    const religionMap: Record<string, string> = {
                        'ISLAM': '01 Islam', 'KATHOLIK': '02 Katolik', 'KATOLIK': '02 Katolik',
                        'KRISTEN': '03 Protestan', 'PROTESTAN': '03 Protestan', 'HINDU': '04 Hindu',
                        'BUDHA': '05 Budha', 'BUDDHA': '05 Budha', 'KONGHUCU': '06 Konghucu',
                        '01': '01 Islam', '02': '02 Katolik', '03': '03 Protestan',
                        '04': '04 Hindu', '05': '05 Budha', '06': '06 Konghucu'
                    };

                    hrRows.forEach(r => {
                        const rawRel = (r.Religion || '').trim().toUpperCase();
                        const mappedRel = religionMap[rawRel] || '01 Islam';
                        const sex = (r.Gender || '').trim().toUpperCase() === 'FEMALE' ? 'P' : 'L';
                        const joinDate = this.getEarliestValidDate(r.AppJoinDate, r.AppJoinGrpDate);
                        if (r.NewICNo) hrMap.set(r.NewICNo.trim().toUpperCase(), { join_date: joinDate || '', emp_code: r.EmpCode, religion: mappedRel, sex });
                        if (r.EmpCode) hrMap.set(r.EmpCode.trim().toUpperCase(), { join_date: joinDate || '', emp_code: r.EmpCode, religion: mappedRel, sex });
                    });
                }

                if (historyData?.data_rows) {
                    for (const row of historyData.data_rows) {
                        const nik = String(row.nik_ktp || row.nik || '').trim().toUpperCase();
                        if (nik) {
                            const hr = hrMap.get(nik);
                            const prev = prevDict[nik];
                            const upahDasar = row.upah_dasar || 0;
                            const joinDateRaw = hr?.join_date;
                            let workingMonths = 12;
                            let proportionFactor = "12/12";

                            if ((row.masa_kerja_tahun || 0) === 0 && joinDateRaw) {
                                const jDate = new Date(joinDateRaw);
                                if (!isNaN(jDate.getTime())) {
                                    const periodDate = new Date(year, month - 1, 1);
                                    let monthsDiff = (periodDate.getFullYear() - jDate.getFullYear()) * 12 + (periodDate.getMonth() - jDate.getMonth());
                                    if (monthsDiff < 12) {
                                        workingMonths = Math.min(12, Math.max(0, monthsDiff) + 1);
                                        proportionFactor = `${workingMonths}/12`;
                                    }
                                }
                            }

                            historyDict[nik] = {
                                UPAH_DASAR: upahDasar,
                                GAJI_POKOK: upahDasar * 30, // Standard 30 days
                                BERAS_RATE: row.beras_rate || 0,
                                MASA_KERJA_JUMLAH: (row.masa_kerja_jumlah || 0) || (prev?.masa_kerja_jumlah || 0),
                                MASA_KERJA_TAHUN: (row.masa_kerja_tahun || 0) || (prev?.masa_kerja_tahun || 0),
                                HK: row.jumlah_hk || 30,
                                EMP_CODE: hr?.emp_code || row.emp_code,
                                JOIN_DATE: joinDateRaw,
                                RELIGION: hr?.religion,
                                SEX: hr?.sex || (row.sex === 'FEMALE' ? 'P' : 'L'),
                                WORKING_MONTHS: workingMonths,
                                PROPORTION_FACTOR: proportionFactor
                            };
                        }
                    }
                }
            } catch (e) { console.error("History fetch error:", e); }
        }

        const thrFormula = hasTHR ? await this.getFormula('THR') : null;
        for (const inc of incomes) {
            if (inc.income_type === 'THR') {
                const nikKey = inc.nik?.trim().toUpperCase() || '';
                const variables = historyDict[nikKey] || null;
                inc.details = { formula: thrFormula?.formula || '', variables: variables };
                // Enrich religion: prefer historyDict, keep existing from getIncomes() as fallback
                if (variables?.RELIGION) (inc as any).religion = variables.RELIGION;
                if (variables?.JOIN_DATE && !(inc as any).join_date) (inc as any).join_date = variables.JOIN_DATE;
                // If religion still missing, try to look it up from emp_code
                if (!(inc as any).religion && variables?.EMP_CODE) {
                    const empKey = String(variables.EMP_CODE).trim().toUpperCase();
                    const hrLookup = historyDict[empKey];
                    if (hrLookup?.RELIGION) (inc as any).religion = hrLookup.RELIGION;
                }
            }
        }
        // Debug: Log any rows that are still missing religion
        const missingReligion = incomes.filter(inc => !(inc as any).religion);
        if (missingReligion.length > 0) {
            console.warn(`[THR] ${missingReligion.length} row(s) missing religion:`, missingReligion.map(r => r.nik).slice(0, 5));
        }
        // Detailed debug: show religion values for first 5 rows
        console.log(`[THR-DEBUG] Returning ${incomes.length} rows. Religion sampling:`);
        incomes.slice(0, 5).forEach((inc, i) => {
            console.log(`  [${i}] nik="${inc.nik}" name="${(inc as any).emp_name}" religion="${(inc as any).religion}" has_variables=${!!(inc as any).details?.variables}`);
        });
        return incomes;
    }

    static async getIncomes(year: number, month: number, divisionCode?: string, gangCode?: string): Promise<OtherIncome[]> {
        const db = Database.getExtendedInstance();
        try {
            let sql = `SELECT * FROM employee_other_incomes WHERE period_year = ? AND period_month = ?`;
            const params: any[] = [year, month];
            if (divisionCode && divisionCode !== 'ALL') { sql += ` AND division_code = ?`; params.push(divisionCode); }
            if (gangCode && gangCode !== 'ALL') { sql += ` AND gang_code = ?`; params.push(gangCode); }

            const incomes = (await db.query(sql, params)) as OtherIncome[];
            if (incomes.length > 0) {
                try {
                    const mainDb = Database.getInstance();
                    // Collect all possible identifiers: nik (which is nik_ktp) AND emp_name
                    const nikSet = [...new Set(incomes.map(i => i.nik?.trim()).filter(Boolean))];
                    const nameSet = [...new Set(incomes.map(i => (i as any).emp_name?.trim()).filter(Boolean))];
                    if (nikSet.length > 0) {
                        const nikPlaceholders = nikSet.map(() => '?').join(',');
                        // Also try matching by name if nik lookup fails
                        let nameClause = '';
                        const queryParams: any[] = [...nikSet, ...nikSet];
                        if (nameSet.length > 0) {
                            const namePlaceholders = nameSet.map(() => '?').join(',');
                            nameClause = ` OR RTRIM(e.EmpName) IN (${namePlaceholders})`;
                            queryParams.push(...nameSet);
                        }
                        const hrRows = await mainDb.query<{ EmpCode: string; Religion: string; Status: string; AppJoinDate: any; AppJoinGrpDate: any; NewICNo: string; EmpName: string }>(`
                            SELECT RTRIM(e.EmpCode) as EmpCode, RTRIM(e.NewICNo) as NewICNo, RTRIM(e.EmpName) as EmpName, e.Religion, e.Status, em.AppJoinDate, em.AppJoinGrpDate
                            FROM HR_EMPLOYEE e
                            LEFT JOIN HR_EMPLOYMENT em ON e.EmpCode = em.EmpCode
                            WHERE RTRIM(e.EmpCode) IN (${nikPlaceholders}) OR RTRIM(e.NewICNo) IN (${nikPlaceholders})${nameClause}
                        `, queryParams);

                        const religionMap: Record<string, string> = {
                            'ISLAM': '01 Islam', 'KATHOLIK': '02 Katolik', 'KATOLIK': '02 Katolik',
                            'KRISTEN': '03 Protestan', 'PROTESTAN': '03 Protestan', 'HINDU': '04 Hindu',
                            'BUDHA': '05 Budha', 'BUDDHA': '05 Budha', 'KONGHUCU': '06 Konghucu',
                            '01': '01 Islam', '02': '02 Katolik', '03': '03 Protestan',
                            '04': '04 Hindu', '05': '05 Budha', '06': '06 Konghucu'
                        };

                        const hrMap = new Map<string, { religion: string; status: string; join_date: string; emp_code: string }>();
                        hrRows.forEach(r => {
                            const rawRel = (r.Religion || '').trim().toUpperCase();
                            const joinDate = this.getEarliestValidDate(r.AppJoinDate, r.AppJoinGrpDate);
                            const data = {
                                religion: religionMap[rawRel] || '01 Islam',
                                status: r.Status?.trim() || '',
                                join_date: joinDate || '',
                                emp_code: r.EmpCode?.trim() || ''
                            };
                            if (r.EmpCode) hrMap.set(r.EmpCode.trim().toUpperCase(), data);
                            if (r.NewICNo) hrMap.set(r.NewICNo.trim().toUpperCase(), data);
                            if (r.EmpName) hrMap.set(r.EmpName.trim().toUpperCase(), data);
                        });

                        for (const income of incomes) {
                            // Try nik first, then emp_name
                            const hrData = hrMap.get(income.nik?.trim()?.toUpperCase() || '')
                                || hrMap.get(((income as any).emp_name || '').trim().toUpperCase());
                            if (hrData) {
                                (income as any).religion = hrData.religion;
                                (income as any).emp_status = hrData.status;
                                if (!((income as any).join_date)) (income as any).join_date = hrData.join_date;
                                if (!((income as any).emp_code)) (income as any).emp_code = hrData.emp_code;
                            }
                        }
                        // Debug: report unmatched
                        const unmatched = incomes.filter(inc => !(inc as any).religion);
                        if (unmatched.length > 0) {
                            console.warn(`[getIncomes] ${unmatched.length} rows still missing religion after enrichment:`, unmatched.map(r => ({ nik: r.nik, name: (r as any).emp_name })).slice(0, 5));
                        }
                    }
                } catch (hrErr) { console.error("Enrich error:", hrErr); }
            }
            return incomes;
        } catch (e) { return []; }
    }

    static async calculateAndSaveTHR(year: number, month: number, divisionCode?: string, gangCode?: string): Promise<{ success: boolean; count: number; message?: string }> {
        try {
            const historyService = HistoryDatabaseService.getInstance();
            const historyData = await historyService.getHistoricalPayrollDataAsExtractorFormat(month, year, gangCode || 'ALL', divisionCode || undefined);
            if (!historyData?.data_rows?.length) return { success: false, count: 0, message: "No history data found." };

            const prevMonth = month === 1 ? 12 : month - 1;
            const prevYear = month === 1 ? year - 1 : year;
            const prevHistoryData = await historyService.getHistoricalPayrollDataAsExtractorFormat(prevMonth, prevYear, gangCode || 'ALL', divisionCode || undefined);
            const prevHistoryDict: Record<string, any> = {};
            if (prevHistoryData?.data_rows) {
                for (const row of prevHistoryData.data_rows) {
                    const nik = String(row.nik_ktp || row.nik || '').trim().toUpperCase();
                    if (nik) prevHistoryDict[nik] = row;
                }
            }

            const mainDb = Database.getInstance();
            const allNiks = historyData.data_rows.map(r => String(r.nik_ktp || r.nik || '').trim()).filter(Boolean);
            const hrMap = new Map<string, { join_date: any; emp_code: string }>();
            if (allNiks.length > 0) {
                const placeholders = allNiks.map(() => '?').join(',');
                const hrRows = await mainDb.query<{ EmpCode: string; NewICNo: string; AppJoinDate: any; AppJoinGrpDate: any }>(`
                    SELECT RTRIM(e.EmpCode) as EmpCode, RTRIM(e.NewICNo) as NewICNo, em.AppJoinDate, em.AppJoinGrpDate
                    FROM HR_EMPLOYEE e
                    LEFT JOIN HR_EMPLOYMENT em ON e.EmpCode = em.EmpCode
                    WHERE RTRIM(e.NewICNo) IN (${placeholders}) OR RTRIM(e.EmpCode) IN (${placeholders})
                `, [...allNiks, ...allNiks]);
                hrRows.forEach(r => {
                    const joinDate = this.getEarliestValidDate(r.AppJoinDate, r.AppJoinGrpDate);
                    if (r.NewICNo) hrMap.set(r.NewICNo.trim().toUpperCase(), { join_date: joinDate, emp_code: r.EmpCode });
                    if (r.EmpCode) hrMap.set(r.EmpCode.trim().toUpperCase(), { join_date: joinDate, emp_code: r.EmpCode });
                });
            }

            const formulaConfig = await this.getFormula('THR');
            if (!formulaConfig?.formula) return { success: false, count: 0, message: "Formula THR belum dikonfigurasi." };

            const db = Database.getExtendedInstance();
            let insertedCount = 0;

            for (const row of historyData.data_rows) {
                const nik = String(row.nik_ktp || row.nik || '').trim().toUpperCase();
                const hrInfo = hrMap.get(nik);
                const joinDateRaw = hrInfo?.join_date;
                let masaKerjaTahun = row.masa_kerja_tahun || 0;
                let masaKerjaJumlah = (row.masa_kerja_jumlah || 0) || (prevHistoryDict[nik]?.masa_kerja_jumlah || 0);
                if (masaKerjaTahun === 0 && prevHistoryDict[nik]) masaKerjaTahun = prevHistoryDict[nik].masa_kerja_tahun || 0;

                if (nik) {
                    const upahDasar = row.upah_dasar || 0;
                    const berasRate = row.beras_rate || 0;
                    // Formula Base: (UPAH_DASAR * 30) + (BERAS_RATE * 30) + MASA_KERJA_JUMLAH
                    const mathVars = {
                        UPAH_DASAR: upahDasar,
                        GAJI_POKOK: upahDasar * 30,
                        BERAS_RATE: berasRate,
                        MASA_KERJA_JUMLAH: masaKerjaJumlah,
                        MASA_KERJA_TAHUN: masaKerjaTahun,
                        HK: 30
                    };

                    let thrAmount = 0;
                    try {
                        const evaluator = new Function(...Object.keys(mathVars), `return ${formulaConfig.formula};`);
                        thrAmount = evaluator(...Object.values(mathVars));
                    } catch { continue; }

                    let proportionDesc = '';
                    // PROPORSI LOGIC: (Upah Pokok + Masa Kerja + Beras) * (Bulan + 1)/12
                    if (masaKerjaTahun === 0 && joinDateRaw) {
                        const jDate = new Date(joinDateRaw);
                        if (!isNaN(jDate.getTime())) {
                            const periodDate = new Date(year, month - 1, 1);
                            let monthsDiff = (periodDate.getFullYear() - jDate.getFullYear()) * 12 + (periodDate.getMonth() - jDate.getMonth());
                            if (monthsDiff < 12) {
                                const workingMonths = Math.min(12, Math.max(0, monthsDiff) + 1);
                                thrAmount = (thrAmount * workingMonths) / 12;
                                proportionDesc = ` (Proporsi ${workingMonths}/12)`;
                            }
                        }
                    }

                    if (thrAmount > 0) {
                        const incomeName = `Tunjangan Hari Raya${proportionDesc}`;
                        const existing = await db.query(`SELECT id FROM employee_other_incomes WHERE period_year = ? AND period_month = ? AND nik = ? AND income_type = 'THR'`, [year, month, nik]);
                        if (existing?.length) {
                            await db.query(`UPDATE employee_other_incomes SET amount = ?, income_name = ?, updated_at = GETDATE() WHERE id = ?`, [thrAmount, incomeName, existing[0].id]);
                        }
                        else {
                            await db.query(`INSERT INTO employee_other_incomes (nik, emp_name, division_code, gang_code, period_year, period_month, income_type, income_name, amount, is_paid_in_thp, is_taxable, created_at, updated_at)
                                VALUES (?, ?, ?, ?, ?, ?, 'THR', ?, ?, ?, ?, GETDATE(), GETDATE())`,
                                [nik, row.nama || row.emp_name || '', row.division_code || divisionCode || null, row.gang_code || gangCode || null, year, month, incomeName, thrAmount, formulaConfig.is_paid_in_thp ? 1 : 0, formulaConfig.is_taxable ? 1 : 0]);
                        }
                        insertedCount++;
                    }
                }
            }
            return { success: true, count: insertedCount };
        } catch (e: any) { return { success: false, count: 0, message: e.message }; }
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
                params.push(id);
                await db.query(`UPDATE employee_other_incomes SET ${updates.join(', ')} WHERE id = ?`, params);
            }
            return true;
        } catch (e) { return false; }
    }

    static async deleteIncome(id: number): Promise<boolean> {
        const db = Database.getExtendedInstance();
        try { await db.query(`DELETE FROM employee_other_incomes WHERE id = ?`, [id]); return true; }
        catch (e) { return false; }
    }
}
