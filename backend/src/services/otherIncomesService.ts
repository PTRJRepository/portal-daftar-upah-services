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
     * Helper to chunk an array into smaller pieces
     */
    private static chunkArray<T>(array: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    /**
     * Helper to safely parse date strings from various formats
     */
    private static parseDate(dateStr: any): Date | null {
        if (!dateStr) return null;
        if (dateStr instanceof Date) return dateStr;
        let d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d;
        
        // Try DD/MM/YYYY
        const parts = String(dateStr).split(/[\/\-]/);
        if (parts.length === 3) {
            if (parts[2].length === 4) { // DD/MM/YYYY
                d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
            } else if (parts[0].length === 4) { // YYYY/MM/DD
                d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            }
            if (!isNaN(d.getTime())) return d;
        }
        return null;
    }

    /**
     * Helper to get earliest valid date between two inputs
     */
    private static getEarliestValidDate(d1: any, d2: any): string | null {
        const date1 = this.parseDate(d1);
        const date2 = this.parseDate(d2);
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
                        const nik = String(row.nik || row.nik_ktp || '').trim().toUpperCase();
                        if (nik) prevDict[nik] = row;
                    }
                }

                const mainDb = Database.getInstance();
                const allNiks = incomes.map(r => String(r.nik || '').trim()).filter(Boolean);
                const hrMap = new Map<string, { join_date: string; emp_code: string; religion: string; sex: string; bank_acc_no: string; bank_code: string }>();
                
                if (allNiks.length > 0) {
                    const nikChunks = this.chunkArray(allNiks, 500);
                    for (const chunk of nikChunks) {
                        const placeholders = chunk.map(() => '?').join(',');
                        const hrRows = await mainDb.query<{ EmpCode: string; NewICNo: string; AppJoinDate: any; AppJoinGrpDate: any; Religion: string; Gender: string; BankAccNo: string; BankCode: string; GangCode: string; GangMember: string; Status: string }>(`
                            SELECT RTRIM(e.EmpCode) as EmpCode, RTRIM(e.NewICNo) as NewICNo, em.AppJoinDate, em.AppJoinGrpDate, e.Religion, e.Gender, e.Status,
                                   RTRIM(p.BankAccNo) as BankAccNo, RTRIM(p.BankCode) as BankCode, RTRIM(gl.GangCode) as GangCode, RTRIM(gl.GangMember) as GangMember
                            FROM HR_EMPLOYEE e
                            LEFT JOIN HR_EMPLOYMENT em ON e.EmpCode = em.EmpCode
                            LEFT JOIN HR_PAYROLL p ON e.EmpCode = p.EmpCode
                            LEFT JOIN HR_GANGLN gl ON e.EmpCode = gl.GangMember
                            WHERE RTRIM(e.NewICNo) IN (${placeholders}) OR RTRIM(e.EmpCode) IN (${placeholders})
                            ORDER BY 
                                CASE WHEN e.Status = '1' THEN 0 ELSE 1 END,
                                em.AppJoinDate DESC, 
                                e.EmpCode DESC
                        `, [...chunk, ...chunk]);

                        const extendDb = Database.getExtendedInstance();
                        const overrideRows = await extendDb.query<{ emp_code: string; bank_acc_no: string; bank_code: string }>(
                            `SELECT emp_code, bank_acc_no, bank_code FROM employee_hr_data WHERE emp_code IN (${placeholders})`,
                            chunk
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
                                bank_acc_no: override?.bank_acc_no || r.BankAccNo || '',
                                bank_code: override?.bank_code || r.BankCode || ''
                            };

                            const nikKey = r.NewICNo?.trim().toUpperCase();
                            const empKey = r.EmpCode.trim().toUpperCase();
                            const resolvedEmpCode = (gangCode && r.GangCode === gangCode && r.GangMember) ? r.GangMember : r.EmpCode;
                            const entry = { join_date: joinDate || '', emp_code: resolvedEmpCode, religion: mappedRel, sex, ...bankInfo, gang_code: r.GangCode };

                            if (gangCode && r.GangCode === gangCode) {
                                if (nikKey) hrMap.set(nikKey, entry);
                                if (empKey) hrMap.set(empKey, entry);
                            } else {
                                if (nikKey && !hrMap.has(nikKey)) hrMap.set(nikKey, entry);
                                if (empKey && !hrMap.has(empKey)) hrMap.set(empKey, entry);
                            }
                        });
                    }
                }

                if (historyData?.data_rows) {
                    for (const row of historyData.data_rows) {
                        const nik = String(row.nik || row.nik_ktp || '').trim().toUpperCase();
                        if (nik) {
                            const hr = hrMap.get(nik);
                            const prev = prevDict[nik];
                            const upahDasar = row.upah_dasar || 0;
                            const joinDateRaw = hr?.join_date || row.join_date;
                            let workingMonths = 12;
                            let proportionFactor = "12/12";

                            if (joinDateRaw) {
                                const jDate = this.parseDate(joinDateRaw);
                                if (jDate) {
                                    const periodDate = new Date(year, month - 1, 1);
                                    let monthsDiff = (periodDate.getFullYear() - jDate.getFullYear()) * 12 + (periodDate.getMonth() - jDate.getMonth());
                                    if (monthsDiff < 12 && monthsDiff >= 0) {
                                        workingMonths = Math.min(12, monthsDiff + 1);
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
                const sourceDivs = await divisionDefinition.getSourceDivisionsForAggregation(divisionCode);
                const allPossibleDivs = new Set<string>([divisionCode]);
                sourceDivs.forEach(sd => {
                    allPossibleDivs.add(sd);
                    if (sd.startsWith('P') && sd.length === 3) allPossibleDivs.add('PG' + sd.substring(1));
                    if (sd.startsWith('PG') && sd.length === 4) allPossibleDivs.add('P' + sd.substring(2));
                });
                const divList = Array.from(allPossibleDivs);
                const placeholders = divList.map(() => '?').join(',');
                sql += ` AND division_code IN (${placeholders})`;
                params.push(...divList);
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
                    if (nikSet.length > 0) {
                        const nikChunks = this.chunkArray(nikSet, 500);
                        const religionMap: Record<string, string> = {
                            'ISLAM': '01 Islam', 'KATHOLIK': '02 Katolik', 'KATOLIK': '02 Katolik',
                            'KRISTEN': '03 Protestan', 'PROTESTAN': '03 Protestan', 'HINDU': '04 Hindu',
                            'BUDHA': '05 Budha', 'BUDDHA': '05 Budha', 'KONGHUCU': '06 Konghucu',
                            '01': '01 Islam', '02': '02 Katolik', '03': '03 Protestan',
                            '04': '04 Hindu', '05': '05 Budha', '06': '06 Konghucu'
                        };
                        const hrMap = new Map<string, { religion: string; status: string; join_date: string; emp_code: string; bank_acc_no: string; bank_code: string; gang_code: string }>();

                        for (const chunk of nikChunks) {
                            const nikPlaceholders = chunk.map(() => '?').join(',');
                            const hrRows = await mainDb.query<{ EmpCode: string; Religion: string; Status: string; AppJoinDate: any; AppJoinGrpDate: any; NewICNo: string; EmpName: string; BankAccNo: string; BankCode: string; GangCode: string; GangMember: string }>(`
                                SELECT RTRIM(e.EmpCode) as EmpCode, RTRIM(e.NewICNo) as NewICNo, RTRIM(e.EmpName) as EmpName, e.Religion, e.Status, em.AppJoinDate, em.AppJoinGrpDate,
                                       RTRIM(p.BankAccNo) as BankAccNo, RTRIM(p.BankCode) as BankCode, RTRIM(gl.GangCode) as GangCode, RTRIM(gl.GangMember) as GangMember
                                FROM HR_EMPLOYEE e
                                LEFT JOIN HR_EMPLOYMENT em ON e.EmpCode = em.EmpCode
                                LEFT JOIN HR_PAYROLL p ON e.EmpCode = p.EmpCode
                                LEFT JOIN HR_GANGLN gl ON e.EmpCode = gl.GangMember
                                WHERE RTRIM(e.EmpCode) IN (${nikPlaceholders}) OR RTRIM(e.NewICNo) IN (${nikPlaceholders})
                                ORDER BY 
                                    CASE WHEN e.Status = '1' THEN 0 ELSE 1 END,
                                    em.AppJoinDate DESC, 
                                    e.EmpCode DESC
                            `, [...chunk, ...chunk]);

                            const extendDb = Database.getExtendedInstance();
                            const overrideRows = await extendDb.query<{ emp_code: string; bank_acc_no: string; bank_code: string }>(
                                `SELECT emp_code, bank_acc_no, bank_code FROM employee_hr_data WHERE emp_code IN (${nikPlaceholders})`,
                                chunk
                            );
                            const overrideMap = new Map<string, { bank_acc_no: string; bank_code: string }>();
                            overrideRows.forEach(o => overrideMap.set(o.emp_code.trim().toUpperCase(), { bank_acc_no: o.bank_acc_no, bank_code: o.bank_code }));

                            hrRows.forEach(r => {
                                const rawRel = (r.Religion || '').trim().toUpperCase();
                                const joinDate = this.getEarliestValidDate(r.AppJoinDate, r.AppJoinGrpDate);
                                const override = overrideMap.get(r.EmpCode.trim().toUpperCase());
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

                                if (gangCode && r.GangCode === gangCode) {
                                    if (empKey) hrMap.set(empKey, data);
                                    if (nikKey) hrMap.set(nikKey, data);
                                } else {
                                    if (empKey && !hrMap.has(empKey)) hrMap.set(empKey, data);
                                    if (nikKey && !hrMap.has(nikKey)) hrMap.set(nikKey, data);
                                }
                            });
                        }

                        for (const income of incomes) {
                            const hrData = hrMap.get(income.nik?.trim()?.toUpperCase() || '');
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

    static async calculateTHRData(year: number, month: number, divisionCode?: string, gangCode?: string): Promise<OtherIncome[]> {
        const historyService = HistoryDatabaseService.getInstance();
        const historyData = await historyService.getHistoricalPayrollDataAsExtractorFormat(month, year, gangCode || 'ALL', divisionCode || undefined);
        if (!historyData?.data_rows?.length) return [];

        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        const prevHistoryData = await historyService.getHistoricalPayrollDataAsExtractorFormat(prevMonth, prevYear, gangCode || 'ALL', divisionCode || undefined);
        const prevHistoryDict: Record<string, any> = {};
        if (prevHistoryData?.data_rows) {
            for (const row of prevHistoryData.data_rows) {
                const nik = String(row.nik || row.nik_ktp || '').trim().toUpperCase();
                if (nik) prevHistoryDict[nik] = row;
            }
        }

        const mainDb = Database.getInstance();
        const allNiks = historyData.data_rows.map(r => String(r.nik || r.nik_ktp || '').trim()).filter(Boolean);
        const hrMap = new Map<string, { join_date: any; emp_code: string; religion: string; sex: string; bank_acc_no: string; bank_code: string }>();
        
        if (allNiks.length > 0) {
            const nikChunks = this.chunkArray(allNiks, 500);
            for (const chunk of nikChunks) {
                const placeholders = chunk.map(() => '?').join(',');
                const hrRows = await mainDb.query<{ EmpCode: string; NewICNo: string; AppJoinDate: any; AppJoinGrpDate: any; Status: string; GangCode: string; GangMember: string; Religion: string; Gender: string; BankAccNo: string; BankCode: string }>(`
                    SELECT RTRIM(e.EmpCode) as EmpCode, RTRIM(e.NewICNo) as NewICNo, em.AppJoinDate, em.AppJoinGrpDate, e.Status, 
                           RTRIM(gl.GangCode) as GangCode, RTRIM(gl.GangMember) as GangMember, e.Religion, e.Gender,
                           RTRIM(p.BankAccNo) as BankAccNo, RTRIM(p.BankCode) as BankCode
                    FROM HR_EMPLOYEE e
                    LEFT JOIN HR_EMPLOYMENT em ON e.EmpCode = em.EmpCode
                    LEFT JOIN HR_PAYROLL p ON e.EmpCode = p.EmpCode
                    LEFT JOIN HR_GANGLN gl ON e.EmpCode = gl.GangMember
                    WHERE RTRIM(e.NewICNo) IN (${placeholders}) OR RTRIM(e.EmpCode) IN (${placeholders})
                    ORDER BY 
                        CASE WHEN e.Status = '1' THEN 0 ELSE 1 END,
                        em.AppJoinDate DESC, 
                        e.EmpCode DESC
                `, [...chunk, ...chunk]);

                const religionMap: Record<string, string> = {
                    'ISLAM': '01 Islam', 'KATHOLIK': '02 Katolik', 'KATOLIK': '02 Katolik',
                    'KRISTEN': '03 Protestan', 'PROTESTAN': '03 Protestan', 'HINDU': '04 Hindu',
                    'BUDHA': '05 Budha', 'BUDDHA': '05 Budha', 'KONGHUCU': '06 Konghucu',
                    '01': '01 Islam', '02': '02 Katolik', '03': '03 Protestan',
                    '04': '04 Hindu', '05': '05 Budha', '06': '06 Konghucu'
                };

                hrRows.forEach(r => {
                    const joinDate = this.getEarliestValidDate(r.AppJoinDate, r.AppJoinGrpDate);
                    const nikKey = r.NewICNo?.trim().toUpperCase();
                    const empKey = r.EmpCode.trim().toUpperCase();
                    const resolvedEmpCode = (gangCode && r.GangCode === gangCode && r.GangMember) ? r.GangMember : r.EmpCode;
                    const rawRel = (r.Religion || '').trim().toUpperCase();
                    
                    const existing = hrMap.get(nikKey || '') || hrMap.get(empKey || '');
                    if (existing && existing.join_date && !joinDate) return;

                    const entry = { 
                        join_date: joinDate, 
                        emp_code: resolvedEmpCode,
                        religion: religionMap[rawRel] || '01 Islam',
                        sex: (r.Gender || '').trim().toUpperCase() === 'FEMALE' ? 'P' : 'L',
                        bank_acc_no: r.BankAccNo || '',
                        bank_code: r.BankCode || ''
                    };

                    if (gangCode && r.GangCode === gangCode) {
                        if (nikKey) hrMap.set(nikKey, entry);
                        if (empKey) hrMap.set(empKey, entry);
                    } else {
                        if (nikKey && !hrMap.has(nikKey)) hrMap.set(nikKey, entry);
                        if (empKey && !hrMap.has(empKey)) hrMap.set(empKey, entry);
                    }
                });
            }
        }

        const formulaConfig = await this.getFormula('THR');
        const results: OtherIncome[] = [];
        const processedNiks = new Set<string>();

        const historyJoinDateMap = new Map<string, string>();
        historyData.data_rows.forEach(r => {
            const nik = String(r.nik || r.nik_ktp || '').trim().toUpperCase();
            if (nik && r.join_date) {
                const currentBest = historyJoinDateMap.get(nik);
                if (!currentBest || new Date(r.join_date) < new Date(currentBest)) historyJoinDateMap.set(nik, r.join_date);
            }
        });

        for (const row of historyData.data_rows) {
            const nik = String(row.nik || row.nik_ktp || '').trim().toUpperCase();
            if (!nik || processedNiks.has(nik)) continue;
            processedNiks.add(nik);

            const hrInfo = hrMap.get(nik);
            const joinDateRaw = hrInfo?.join_date || historyJoinDateMap.get(nik) || row.join_date;
            
            let masaKerjaTahun = row.masa_kerja_tahun || 0;
            let masaKerjaJumlah = (row.masa_kerja_jumlah || 0) || (prevHistoryDict[nik]?.masa_kerja_jumlah || 0);
            if (masaKerjaTahun === 0 && prevHistoryDict[nik]) masaKerjaTahun = prevHistoryDict[nik].masa_kerja_tahun || 0;

            const upahDasar = row.upah_dasar || 0;
            const berasRate = row.beras_rate || 0;
            const mathVars = {
                UPAH_DASAR: upahDasar, GAJI_POKOK: upahDasar * 30, BERAS_RATE: berasRate,
                MASA_KERJA_JUMLAH: masaKerjaJumlah, MASA_KERJA_TAHUN: masaKerjaTahun, HK: 30
            };
            
            let fullThrAmount = 0;
            try {
                const evaluator = new Function(...Object.keys(mathVars), `return ${formulaConfig.formula};`);
                fullThrAmount = evaluator(...Object.values(mathVars));
            } catch { continue; }

            let thrAmount = fullThrAmount;
            let proportionDesc = '';
            let workingMonths = 12;
            let proportionFactor = "12/12";
            
            if (joinDateRaw) {
                const jDate = this.parseDate(joinDateRaw);
                if (jDate) {
                    const periodDate = new Date(year, month - 1, 1);
                    let monthsDiff = (periodDate.getFullYear() - jDate.getFullYear()) * 12 + (periodDate.getMonth() - jDate.getMonth());
                    
                    if (monthsDiff < 12 && monthsDiff >= 0) {
                        workingMonths = Math.min(12, monthsDiff + 1);
                        if (workingMonths < 12) {
                            proportionFactor = `${workingMonths}/12`;
                            thrAmount = Math.round((fullThrAmount * workingMonths) / 12);
                            proportionDesc = ` (Proporsi ${workingMonths}/12)`;
                        }
                    }
                }
            }

            if (thrAmount > 0) {
                const finalDivisionCode = (divisionCode && divisionCode !== 'ALL') ? divisionCode : (row.division_code || row.loc_code);
                results.push({
                    nik: nik,
                    emp_name: row.nama || row.emp_name || '',
                    division_code: finalDivisionCode,
                    gang_code: row.gang_code || gangCode || null,
                    period_year: year,
                    period_month: month,
                    income_type: 'THR',
                    income_name: `Tunjangan Hari Raya${proportionDesc}`,
                    amount: thrAmount,
                    is_paid_in_thp: formulaConfig.is_paid_in_thp ? true : false,
                    is_taxable: formulaConfig.is_taxable ? true : false,
                    details: {
                        formula: formulaConfig.formula,
                        variables: {
                            ...mathVars,
                            JOIN_DATE: joinDateRaw,
                            WORKING_MONTHS: workingMonths,
                            PROPORTION_FACTOR: proportionFactor,
                            RELIGION: hrInfo?.religion,
                            SEX: hrInfo?.sex || (row.sex === 'FEMALE' ? 'P' : 'L'),
                            BANK_ACC_NO: hrInfo?.bank_acc_no,
                            BANK_CODE: hrInfo?.bank_code,
                            EMP_CODE: hrInfo?.emp_code || row.emp_code
                        }
                    }
                });
            }
        }
        return results;
    }

    static async calculateAndSaveTHR(year: number, month: number, divisionCode?: string, gangCode?: string): Promise<{ success: boolean; count: number; message?: string }> {
        try {
            const calculatedRows = await this.calculateTHRData(year, month, divisionCode, gangCode);
            if (calculatedRows.length === 0) return { success: false, count: 0, message: "No data calculated." };

            const db = Database.getExtendedInstance();
            for (const row of calculatedRows) {
                await db.query(`DELETE FROM employee_other_incomes WHERE period_year = ? AND period_month = ? AND nik = ? AND income_type = 'THR'`, [year, month, row.nik]);
                await db.query(`INSERT INTO employee_other_incomes (nik, emp_name, division_code, gang_code, period_year, period_month, income_type, income_name, amount, is_paid_in_thp, is_taxable, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'THR', ?, ?, ?, ?, GETDATE(), GETDATE())`, 
                    [row.nik, row.emp_name, row.division_code, row.gang_code, year, month, row.income_name, row.amount, row.is_paid_in_thp ? 1 : 0, row.is_taxable ? 1 : 0]);
            }
            return { success: true, count: calculatedRows.length };
        } catch (e: any) { return { success: false, count: 0, message: e.message }; }
    }

    static async bulkSaveIncomes(incomes: OtherIncome[]): Promise<{ success: boolean; count: number }> {
        const db = Database.getExtendedInstance();
        let count = 0;
        try {
            for (const inc of incomes) {
                await db.query(`DELETE FROM employee_other_incomes WHERE period_year = ? AND period_month = ? AND nik = ? AND income_type = ? AND income_name = ?`, 
                    [inc.period_year, inc.period_month, inc.nik, inc.income_type, inc.income_name]);
                
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

    static async updateIncome(id: number, data: any): Promise<boolean> {
        const db = Database.getExtendedInstance();
        try {
            await db.query(`UPDATE employee_other_incomes SET nik = ?, emp_name = ?, amount = ?, income_name = ?, is_paid_in_thp = ?, is_taxable = ?, updated_at = GETDATE() WHERE id = ?`,
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
