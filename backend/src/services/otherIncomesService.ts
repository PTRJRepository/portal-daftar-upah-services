import { Database } from "../db/client";
import { HistoryDatabaseService } from "./historyDatabaseService";
import { divisionDefinition } from "./divisionDefinition";
import { employeeGangHistoryService } from "./employeeGangHistoryService";

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
                    // Prioritize active and gang match in HR query
                    const hrRows = await mainDb.query<{ EmpCode: string; NewICNo: string; AppJoinDate: any; AppJoinGrpDate: any; Religion: string; Gender: string; BankAccNo: string; BankCode: string; GangCode: string; GangMember: string }>(`
                        SELECT RTRIM(e.EmpCode) as EmpCode, RTRIM(e.NewICNo) as NewICNo, em.AppJoinDate, em.AppJoinGrpDate, e.Religion, e.Gender, 
                               RTRIM(p.BankAccNo) as BankAccNo, RTRIM(p.BankCode) as BankCode, RTRIM(gl.GangCode) as GangCode, RTRIM(gl.GangMember) as GangMember
                        FROM HR_EMPLOYEE e
                        LEFT JOIN HR_EMPLOYMENT em ON e.EmpCode = em.EmpCode
                        LEFT JOIN HR_PAYROLL p ON e.EmpCode = p.EmpCode
                        LEFT JOIN HR_GANGLN gl ON e.EmpCode = gl.GangMember
                        WHERE RTRIM(e.NewICNo) IN (${placeholders}) OR RTRIM(e.EmpCode) IN (${placeholders})
                        ORDER BY 
                            CASE WHEN e.Status = '1' THEN 0 ELSE 1 END,
                            CASE WHEN gl.GangCode = '${gangCode || ''}' THEN 0 ELSE 1 END,
                            em.AppJoinDate DESC, 
                            e.EmpCode DESC
                    `, [...allNiks, ...allNiks]);

                    // Fetch overrides from extend_db_ptrj
                    const extendDb = Database.getExtendedInstance();
                    const overrideRows = await extendDb.query<{ emp_code: string; bank_acc_no: string; bank_code: string }>(
                        `SELECT emp_code, bank_acc_no, bank_code FROM employee_hr_data WHERE emp_code IN (${placeholders})`,
                        allNiks
                    );
                    const overrideMap = new Map<string, { bank_acc_no: string; bank_code: string }>();
                    overrideRows.forEach(o => overrideMap.set(o.emp_code.trim().toUpperCase(), { bank_acc_no: o.bank_acc_no, bank_code: o.bank_code }));

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

                        const override = overrideMap.get(r.EmpCode.trim().toUpperCase());
                        const bankInfo = {
                            bank_acc_no: override?.bank_acc_no || r.BankAccNo,
                            bank_code: override?.bank_code || r.BankCode
                        };

                        const nikKey = r.NewICNo?.trim().toUpperCase();
                        const empKey = r.EmpCode.trim().toUpperCase();
                        // Use GangMember as emp_code when gang matches (it's the correct EmpCode for that gang)
                        const resolvedEmpCode = (gangCode && r.GangCode === gangCode && r.GangMember) ? r.GangMember : r.EmpCode;
                        const entry = { join_date: joinDate || '', emp_code: resolvedEmpCode, religion: mappedRel, sex, ...bankInfo, gang_code: r.GangCode };

                        // If gangCode specified, strictly prefer the one in that gang
                        if (gangCode && r.GangCode === gangCode) {
                            if (nikKey) hrMap.set(nikKey, entry);
                            if (empKey) hrMap.set(empKey, entry);
                        } else {
                            // Otherwise standard latest-active resolution
                            if (nikKey && !hrMap.has(nikKey)) hrMap.set(nikKey, entry);
                            if (empKey && !hrMap.has(empKey)) hrMap.set(empKey, entry);
                        }
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
                                PROPORTION_FACTOR: proportionFactor,
                                BANK_ACC_NO: hr?.bank_acc_no,
                                BANK_CODE: hr?.bank_code
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
                if (variables?.RELIGION) (inc as any).religion = variables.RELIGION;
                if (variables?.JOIN_DATE && !(inc as any).join_date) (inc as any).join_date = variables.JOIN_DATE;
                if (variables?.BANK_ACC_NO) (inc as any).bank_acc_no = variables.BANK_ACC_NO;
                if (variables?.BANK_CODE) (inc as any).bank_code = variables.BANK_CODE;
                if (variables?.EMP_CODE) (inc as any).emp_code = variables.EMP_CODE;
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
                // Handle virtual divisions by also searching for source divisions
                const sourceDivs = await divisionDefinition.getSourceDivisionsForAggregation(divisionCode);
                const allPossibleDivs = [...new Set([divisionCode, ...sourceDivs])];
                const placeholders = allPossibleDivs.map(() => '?').join(',');
                sql += ` AND division_code IN (${placeholders})`;
                params.push(...allPossibleDivs);
            }
            
            if (gangCode && gangCode !== 'ALL') { 
                sql += ` AND gang_code = ?`; 
                params.push(gangCode); 
            }

            const incomes = (await db.query(sql, params)) as OtherIncome[];
            if (incomes.length > 0) {
                try {
                    const mainDb = Database.getInstance();
                    const nikSet = [...new Set(incomes.map(i => i.nik?.trim()).filter(Boolean))];
                    const nameSet = [...new Set(incomes.map(i => (i as any).emp_name?.trim()).filter(Boolean))];
                    if (nikSet.length > 0) {
                        const nikPlaceholders = nikSet.map(() => '?').join(',');
                        let nameClause = '';
                        const queryParams: any[] = [...nikSet, ...nikSet];
                        if (nameSet.length > 0) {
                            const namePlaceholders = nameSet.map(() => '?').join(',');
                            nameClause = ` OR RTRIM(e.EmpName) IN (${namePlaceholders})`;
                            queryParams.push(...nameSet);
                        }
                        const hrRows = await mainDb.query<{ EmpCode: string; Religion: string; Status: string; AppJoinDate: any; AppJoinGrpDate: any; NewICNo: string; EmpName: string; BankAccNo: string; BankCode: string; GangCode: string; GangMember: string }>(`
                            SELECT RTRIM(e.EmpCode) as EmpCode, RTRIM(e.NewICNo) as NewICNo, RTRIM(e.EmpName) as EmpName, e.Religion, e.Status, em.AppJoinDate, em.AppJoinGrpDate,
                                   RTRIM(p.BankAccNo) as BankAccNo, RTRIM(p.BankCode) as BankCode, RTRIM(gl.GangCode) as GangCode, RTRIM(gl.GangMember) as GangMember
                            FROM HR_EMPLOYEE e
                            LEFT JOIN HR_EMPLOYMENT em ON e.EmpCode = em.EmpCode
                            LEFT JOIN HR_PAYROLL p ON e.EmpCode = p.EmpCode
                            LEFT JOIN HR_GANGLN gl ON e.EmpCode = gl.GangMember
                            WHERE RTRIM(e.EmpCode) IN (${nikPlaceholders}) OR RTRIM(e.NewICNo) IN (${nikPlaceholders})${nameClause}
                            ORDER BY 
                                CASE WHEN e.Status = '1' THEN 0 ELSE 1 END,
                                CASE WHEN gl.GangCode = '${gangCode || ''}' THEN 0 ELSE 1 END,
                                em.AppJoinDate DESC, 
                                e.EmpCode DESC
                        `, queryParams);

                        const extendDb = Database.getExtendedInstance();
                        const overrideRows = await extendDb.query<{ emp_code: string; bank_acc_no: string; bank_code: string }>(
                            `SELECT emp_code, bank_acc_no, bank_code FROM employee_hr_data WHERE emp_code IN (${nikPlaceholders})`,
                            nikSet
                        );
                        const overrideMap = new Map<string, { bank_acc_no: string; bank_code: string }>();
                        overrideRows.forEach(o => overrideMap.set(o.emp_code.trim().toUpperCase(), { bank_acc_no: o.bank_acc_no, bank_code: o.bank_code }));

                        const religionMap: Record<string, string> = {
                            'ISLAM': '01 Islam', 'KATHOLIK': '02 Katolik', 'KATOLIK': '02 Katolik',
                            'KRISTEN': '03 Protestan', 'PROTESTAN': '03 Protestan', 'HINDU': '04 Hindu',
                            'BUDHA': '05 Budha', 'BUDDHA': '05 Budha', 'KONGHUCU': '06 Konghucu',
                            '01': '01 Islam', '02': '02 Katolik', '03': '03 Protestan',
                            '04': '04 Hindu', '05': '05 Budha', '06': '06 Konghucu'
                        };

                        const hrMap = new Map<string, { religion: string; status: string; join_date: string; emp_code: string; bank_acc_no: string; bank_code: string; gang_code: string }>();
                        hrRows.forEach(r => {
                            const rawRel = (r.Religion || '').trim().toUpperCase();
                            const joinDate = this.getEarliestValidDate(r.AppJoinDate, r.AppJoinGrpDate);
                            const override = overrideMap.get(r.EmpCode.trim().toUpperCase());

                            // Use GangMember as emp_code when gang matches
                            const resolvedEmpCode = (gangCode && r.GangCode === gangCode && r.GangMember) ? r.GangMember : (r.EmpCode?.trim() || '');
                            const data = {
                                religion: religionMap[rawRel] || '01 Islam',
                                status: r.Status?.trim() || '',
                                join_date: joinDate || '',
                                emp_code: resolvedEmpCode,
                                bank_acc_no: override?.bank_acc_no || r.BankAccNo || '',
                                bank_code: override?.bank_code || r.BankCode || '',
                                gang_code: r.GangCode || ''
                            };

                            const empKey = r.EmpCode.trim().toUpperCase();
                            const nikKey = r.NewICNo?.trim().toUpperCase();
                            const nameKey = r.EmpName?.trim().toUpperCase();

                            // Logic: match by GangCode first if possible
                            if (gangCode && r.GangCode === gangCode) {
                                if (empKey) hrMap.set(empKey, data);
                                if (nikKey) hrMap.set(nikKey, data);
                                if (nameKey) hrMap.set(nameKey, data);
                            } else {
                                if (empKey && !hrMap.has(empKey)) hrMap.set(empKey, data);
                                if (nikKey && !hrMap.has(nikKey)) hrMap.set(nikKey, data);
                                if (nameKey && !hrMap.has(nameKey)) hrMap.set(nameKey, data);
                            }
                        });

                        for (const income of incomes) {
                            const hrData = hrMap.get(income.nik?.trim()?.toUpperCase() || '')
                                || hrMap.get(((income as any).emp_name || '').trim().toUpperCase());
                            if (hrData) {
                                (income as any).religion = hrData.religion;
                                (income as any).emp_status = hrData.status;
                                if (!((income as any).join_date)) (income as any).join_date = hrData.join_date;
                                (income as any).emp_code = hrData.emp_code;
                                (income as any).bank_acc_no = hrData.bank_acc_no;
                                (income as any).bank_code = hrData.bank_code;
                            }
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
                const hrRows = await mainDb.query<{ EmpCode: string; NewICNo: string; AppJoinDate: any; AppJoinGrpDate: any; Status: string; GangCode: string; GangMember: string }>(`
                    SELECT RTRIM(e.EmpCode) as EmpCode, RTRIM(e.NewICNo) as NewICNo, em.AppJoinDate, em.AppJoinGrpDate, e.Status, RTRIM(gl.GangCode) as GangCode, RTRIM(gl.GangMember) as GangMember
                    FROM HR_EMPLOYEE e
                    LEFT JOIN HR_EMPLOYMENT em ON e.EmpCode = em.EmpCode
                    LEFT JOIN HR_GANGLN gl ON e.EmpCode = gl.GangMember
                    WHERE RTRIM(e.NewICNo) IN (${placeholders}) OR RTRIM(e.EmpCode) IN (${placeholders})
                    ORDER BY 
                        CASE WHEN e.Status = '1' THEN 0 ELSE 1 END,
                        CASE WHEN gl.GangCode = '${gangCode || ''}' THEN 0 ELSE 1 END,
                        em.AppJoinDate DESC, 
                        e.EmpCode DESC
                `, [...allNiks, ...allNiks]);
                hrRows.forEach(r => {
                    const joinDate = this.getEarliestValidDate(r.AppJoinDate, r.AppJoinGrpDate);
                    const nikKey = r.NewICNo?.trim().toUpperCase();
                    const empKey = r.EmpCode.trim().toUpperCase();

                    // Use GangMember as emp_code when gang matches
                    const resolvedEmpCode = (gangCode && r.GangCode === gangCode && r.GangMember) ? r.GangMember : r.EmpCode;
                    const entry = { join_date: joinDate, emp_code: resolvedEmpCode };

                    if (gangCode && r.GangCode === gangCode) {
                        if (nikKey) hrMap.set(nikKey, entry);
                        if (empKey) hrMap.set(empKey, entry);
                    } else {
                        if (nikKey && !hrMap.has(nikKey)) hrMap.set(nikKey, entry);
                        if (empKey && !hrMap.has(empKey)) hrMap.set(empKey, entry);
                    }
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

                        // Prioritize the requested divisionCode (e.g. NRS) if it's specific
                        const finalDivisionCode = (divisionCode && divisionCode !== 'ALL') ? divisionCode : (row.division_code || row.loc_code);

                        if (existing?.length) { 
                            await db.query(`UPDATE employee_other_incomes SET amount = ?, income_name = ?, division_code = ?, updated_at = GETDATE() WHERE id = ?`, [thrAmount, incomeName, finalDivisionCode, existing[0].id]); 
                        }
                        else {
                            await db.query(`INSERT INTO employee_other_incomes (nik, emp_name, division_code, gang_code, period_year, period_month, income_type, income_name, amount, is_paid_in_thp, is_taxable, created_at, updated_at)
                                VALUES (?, ?, ?, ?, ?, ?, 'THR', ?, ?, ?, ?, GETDATE(), GETDATE())`, 
                                [nik, row.nama || row.emp_name || '', finalDivisionCode, row.gang_code || gangCode || null, year, month, incomeName, thrAmount, formulaConfig.is_paid_in_thp ? 1 : 0, formulaConfig.is_taxable ? 1 : 0]);
                        }
                        insertedCount++;
                    }                }
            }
            return { success: true, count: insertedCount };
        } catch (e: any) { return { success: false, count: 0, message: e.message }; }
    }

    static async addIncome(data: any): Promise<OtherIncome | null> {
        const db = Database.getExtendedInstance();
        try {
            const result = await db.query(`INSERT INTO employee_other_incomes 
                (nik, emp_name, division_code, gang_code, period_year, period_month, income_type, income_name, amount, is_paid_in_thp, is_taxable, created_at, updated_at)
                OUTPUT INSERTED.*
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())`,
                [data.nik, data.emp_name, data.division_code, data.gang_code, data.period_year, data.period_month, data.income_type, data.income_name, data.amount, data.is_paid_in_thp ? 1 : 0, data.is_taxable ? 1 : 0]);
            return result[0];
        } catch (e) { return null; }
    }

    static async updateIncome(id: number, data: any): Promise<boolean> {
        const db = Database.getExtendedInstance();
        try {
            await db.query(`UPDATE employee_other_incomes SET 
                nik = ?, emp_name = ?, amount = ?, income_name = ?, is_paid_in_thp = ?, is_taxable = ?, updated_at = GETDATE()
                WHERE id = ?`,
                [data.nik, data.emp_name, data.amount, data.income_name, data.is_paid_in_thp ? 1 : 0, data.is_taxable ? 1 : 0, id]);
            return true;
        } catch (e) { return false; }
    }

    static async deleteIncome(id: number): Promise<boolean> {
        const db = Database.getExtendedInstance();
        try { await db.query(`DELETE FROM employee_other_incomes WHERE id = ?`, [id]); return true; }
        catch (e) { return false; }
    }
}
