import { Database } from "../db/client";
import { HistoryDatabaseService } from "./historyDatabaseService";
import { divisionDefinition } from "./divisionDefinition";
import { employeeHrDataService } from "./employeeHrDataService";

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
    original_religion?: string; // Track religion BEFORE enrichment (for frontend filtering)
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

    /**
     * Get the LATEST/MOST RECENT valid date from two date values.
     * Used for getting the most current join date.
     */
    private static getLatestValidDate(d1: any, d2: any): string | null {
        const date1 = this.parseDate(d1); const date2 = this.parseDate(d2);
        const isValid = (d: Date | null) => d && !isNaN(d.getTime()) && d.getFullYear() > 1905;
        const v1 = isValid(date1) ? date1 : null; const v2 = isValid(date2) ? date2 : null;
        let latest: Date | null = null;
        if (v1 && v2) latest = v1.getTime() > v2.getTime() ? v1 : v2;
        else latest = v1 || v2;
        return latest ? latest.toISOString() : null;
    }

    /**
     * Check if a bank account number is valid.
     * Rejects: null, empty, all-zeros, date-like strings, non-numeric values.
     * Bank accounts should be numeric (digits only, optionally with dashes/spaces), min 5 digits.
     */
    private static isValidBankAccNo(val: string | null | undefined): boolean {
        if (!val) return false;
        const trimmed = val.trim();
        if (!trimmed) return false;
        // Reject all-zero strings (e.g., '0', '00', '000')
        if (/^0+$/.test(trimmed)) return false;
        // Reject date-like patterns (e.g., '2024-01-15', '15/01/2024', 'Jan 2024')
        if (/\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/.test(trimmed)) return false;
        if (/\d{1,2}[-\/]\d{1,2}[-\/]\d{4}/.test(trimmed)) return false;
        if (/[A-Za-z]{3,}\s+\d{4}/.test(trimmed)) return false; // 'Jan 2024' etc.
        // Extract only digits
        const digitsOnly = trimmed.replace(/[-\s]/g, '');
        // Must be all digits (after removing dashes/spaces)
        if (!/^\d+$/.test(digitsOnly)) return false;
        // Bank account numbers should have at least 5 digits
        if (digitsOnly.length < 5) return false;
        return true;
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

                -- Add details_json column if it doesn't exist
                IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'employee_other_incomes' AND COLUMN_NAME = 'details_json')
                BEGIN
                    ALTER TABLE employee_other_incomes ADD details_json NVARCHAR(MAX) NULL;
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

                IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'employee_other_incomes_blacklist' AND TABLE_SCHEMA = 'dbo')
                BEGIN
                    CREATE TABLE employee_other_incomes_blacklist (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        nik VARCHAR(50) NOT NULL,
                        emp_name VARCHAR(150),
                        period_year INT NOT NULL,
                        period_month INT NOT NULL,
                        income_type VARCHAR(50) NOT NULL,
                        reason VARCHAR(255),
                        created_at DATETIME DEFAULT GETDATE()
                    );
                    CREATE INDEX IX_blacklist_nik_period ON employee_other_incomes_blacklist(nik, period_year, period_month);
                END
            `);
        } catch (e) { console.error("Init table error:", e); }
    }

    static async addToBlacklist(nik: string, name: string, year: number, month: number, type: string, reason: string = 'User deleted'): Promise<boolean> {
        const db = Database.getExtendedInstance();
        try {
            const existing = await db.query(`SELECT id FROM employee_other_incomes_blacklist WHERE nik = ? AND period_year = ? AND period_month = ? AND income_type = ?`, [nik, year, month, type]);
            if (existing && existing.length > 0) return true;
            await db.query(`INSERT INTO employee_other_incomes_blacklist (nik, emp_name, period_year, period_month, income_type, reason) VALUES (?, ?, ?, ?, ?, ?)`, [nik, name, year, month, type, reason]);
            return true;
        } catch (e) { return false; }
    }

    static async removeFromBlacklist(id: number): Promise<boolean> {
        const db = Database.getExtendedInstance();
        try {
            await db.query(`DELETE FROM employee_other_incomes_blacklist WHERE id = ?`, [id]);
            return true;
        } catch (e) { return false; }
    }

    static async getBlacklist(year: number, month: number, type: string): Promise<any[]> {
        const db = Database.getExtendedInstance();
        try {
            return await db.query(`SELECT * FROM employee_other_incomes_blacklist WHERE period_year = ? AND period_month = ? AND income_type = ? ORDER BY emp_name`, [year, month, type]);
        } catch (e) { return []; }
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
                // Use unified mapping for consistent division handling
                const allPossibleDivs = new Set<string>();
                let virtualGangs: string[] = [];

                try {
                    const { gangService } = await import('./gangService');

                    // Check if this is a virtual division - handle separately
                    if (gangService.isVirtualDivision(divisionCode)) {
                        // For virtual divisions, filter by gang_code instead
                        virtualGangs = await gangService.getVirtualDivisionGangs(divisionCode);
                        if (virtualGangs.length > 0) {
                            sql += ` AND gang_code IN (${virtualGangs.map(() => '?').join(',')})`;
                            params.push(...virtualGangs);
                        }
                    } else {
                        // Regular division - use unified mapping
                        const aliases = gangService.getAllDivisionAliases(divisionCode);
                        aliases.forEach(a => allPossibleDivs.add(a));
                        // Also get from source divisions
                        const sourceDivs = await divisionDefinition.getSourceDivisionsForAggregation(divisionCode);
                        for (const sd of sourceDivs) {
                            allPossibleDivs.add(sd);
                            const srcAliases = gangService.getAllDivisionAliases(sd);
                            srcAliases.forEach(a => allPossibleDivs.add(a));
                        }
                        const divList = Array.from(allPossibleDivs);
                        sql += ` AND division_code IN (${divList.map(() => '?').join(',')})`;
                        params.push(...divList);
                    }
                } catch { /* gangService not available */ }
            }
            if (gangCode && gangCode !== 'ALL') { sql += ` AND gang_code = ?`; params.push(gangCode); }

            const rows = (await db.query(sql, params)) as any[];

            // AGGRESSIVE DEDUPLICATION: Ensure one record per NIK
            const uniqueMap = new Map<string, OtherIncome>();
            rows.forEach(r => {
                const key = (r.nik || '').trim().toUpperCase();
                // Parse details_json back into details object
                if (r.details_json) {
                    try { r.details = JSON.parse(r.details_json); } catch { r.details = null; }
                }
                if (key && !uniqueMap.has(key)) uniqueMap.set(key, r);
            });
            return Array.from(uniqueMap.values());
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
                '01': '01 Islam', '02': '02 Katolik', '03': '03 Protestan',
                '04': '04 Hindu', '05': '05 Budha', '06': '06 Konghucu',
                'ISLAM': '01 Islam', 'KATHOLIK': '02 Katolik', 'KATOLIK': '02 Katolik',
                'KRISTEN': '03 Protestan', 'PROTESTAN': '03 Protestan', 'HINDU': '04 Hindu',
                'BUDHA': '05 Budha', 'BUDDHA': '05 Budha', 'KONGHUCU': '06 Konghucu'
            };
            const hrMap = new Map<string, any>();

            for (const chunk of nikChunks) {
                const placeholders = chunk.map(() => '?').join(',');
                // Get employee data with their gang assignments
                // ORDER BY ensures the last record we process is the most recent
                const hrRows = await mainDb.query<any>(`
                    SELECT
                        RTRIM(e.EmpCode) as EmpCode,
                        RTRIM(e.NewICNo) as NewICNo,
                        RTRIM(e.EmpName) as EmpName,
                        e.Religion,
                        e.Gender,
                        e.Status,
                        e.CreateDate,
                        em.AppJoinDate,
                        em.AppJoinGrpDate,
                        RTRIM(p.BankAccNo) as BankAccNo,
                        RTRIM(p.BankCode) as BankCode,
                        COALESCE(p.PayRate, 0) as PayRate,
                        COALESCE(p.RiceRation, 0) as RiceRation,
                        gl.GangCode as GangCode,
                        gl.GangMember as GangMember
                    FROM HR_EMPLOYEE e
                    LEFT JOIN HR_EMPLOYMENT em ON e.EmpCode = em.EmpCode
                    LEFT JOIN HR_PAYROLL p ON e.EmpCode = p.EmpCode
                    LEFT JOIN HR_GANGLN gl ON e.EmpCode = gl.GangMember
                    WHERE RTRIM(e.EmpCode) IN (${placeholders}) OR RTRIM(e.NewICNo) IN (${placeholders})
                    ORDER BY
                        CASE WHEN e.Status = '1' THEN 0 ELSE 1 END, -- Active employees first
                        em.AppJoinDate DESC, -- Most recent join date first
                        e.EmpCode DESC -- Then by EmpCode descending
                `, [...chunk, ...chunk]);

                // Group by employee and get the LATEST gang
                // Since we ORDER BY AppJoinDate DESC, the FIRST row we see is the most recent
                // So we only set if NOT already set (keep the first/latest, ignore rest)
                const empGangMap = new Map<string, any>();
                hrRows.forEach(r => {
                    const empKey = r.EmpCode?.trim().toUpperCase();
                    if (!empKey) return;
                    // Only set if not already set - this keeps the FIRST (most recent due to ORDER BY DESC)
                    if (!empGangMap.has(empKey)) {
                        empGangMap.set(empKey, { gangCode: r.GangCode, gangMember: r.GangMember });
                    }
                });

                hrRows.forEach(r => {
                    const rawRel = (r.Religion || '').trim().toUpperCase();
                    // Use LATEST join date (most recent) instead of earliest
                    const rawJD = this.getLatestValidDate(r.AppJoinDate, r.AppJoinGrpDate) || r.CreateDate;
                    let joinDateStr = null;
                    if (rawJD) {
                        try {
                            const d = new Date(rawJD);
                            if (!isNaN(d.getTime())) joinDateStr = d.toISOString();
                        } catch (e) { }
                    }

                    // Get the LATEST gang from the map (most recent gang assignment)
                    const empKey = r.EmpCode?.trim().toUpperCase();
                    const latestGang = empKey ? empGangMap.get(empKey) : null;

                    // Save ORIGINAL religion before mapping/defaulting - this is used by frontend to detect "no religion"
                    const originalReligion = r.Religion || '';
                    const data = {
                        religion: religionMap[rawRel] || r.Religion || '01 Islam',
                        original_religion: originalReligion, // Store original for frontend filtering
                        join_date: joinDateStr,
                        // Use latest gang's GangMember as emp_code (most recent assignment)
                        // If there's a latest gang, use its GangMember, otherwise fall back to EmpCode
                        emp_code: (latestGang?.gangMember?.trim()) || (r.EmpCode?.trim() || ''),
                        // Also store the latest gang code for reference
                        latest_gang_code: latestGang?.gangCode?.trim() || '',
                        bank_acc_no: this.isValidBankAccNo(r.BankAccNo) ? r.BankAccNo : '', bank_code: r.BankCode || '',
                        sex: (r.Gender || '').trim().toUpperCase() === 'FEMALE' ? 'P' : 'L',
                        upah_dasar: r.PayRate || 0, beras_rate: r.RiceRation || 0, emp_name: r.EmpName
                    };
                    const empKeyUpper = r.EmpCode.trim().toUpperCase(); const nikKey = r.NewICNo?.trim().toUpperCase();
                    if (!hrMap.has(empKeyUpper)) hrMap.set(empKeyUpper, data);
                    if (nikKey && !hrMap.has(nikKey)) hrMap.set(nikKey, data);
                });
            }

            // Collect all NIKs/empcodes and emp_names to query HR_EMPLOYEE for empcode history
            const keysForBankLookup = new Set<string>();
            const empNamesForBankLookup = new Set<string>();
            hrMap.forEach((hrData, key) => {
                keysForBankLookup.add(key);
                if (hrData.emp_name) {
                    empNamesForBankLookup.add(hrData.emp_name.trim().toUpperCase());
                }
            });

            // Query HR_EMPLOYEE to find ALL empcodes for each NIK (ordered by CreateDate DESC - newest first)
            const allEmpCodesByKey = new Map<string, string[]>(); // key: original key, value: array of empcodes (newest first)
            if (keysForBankLookup.size > 0 || empNamesForBankLookup.size > 0) {
                try {
                    const keysArray = Array.from(keysForBankLookup);

                    // Get all empcodes ordered by CreateDate DESC (newest first) - by empcode/NIK
                    let empRows: any[] = [];
                    if (keysArray.length > 0) {
                        const placeholders = keysArray.map(() => '?').join(',');
                        empRows = await mainDb.query<any>(`
                            SELECT
                                RTRIM(e.EmpCode) as EmpCode,
                                RTRIM(e.NewICNo) as NewICNo,
                                RTRIM(e.EmpName) as EmpName,
                                e.CreateDate
                            FROM HR_EMPLOYEE e
                            WHERE RTRIM(e.EmpCode) IN (${placeholders}) OR RTRIM(e.NewICNo) IN (${placeholders})
                            ORDER BY e.CreateDate DESC
                        `, [...keysArray, ...keysArray]);
                    }

                    // Also query by emp_name to find related empcodes
                    const namesArray = Array.from(empNamesForBankLookup);
                    if (namesArray.length > 0) {
                        const namePlaceholders = namesArray.map(() => '?').join(',');
                        const nameRows = await mainDb.query<any>(`
                            SELECT
                                RTRIM(e.EmpCode) as EmpCode,
                                RTRIM(e.EmpName) as EmpName,
                                e.CreateDate
                            FROM HR_EMPLOYEE e
                            WHERE RTRIM(e.EmpName) IN (${namePlaceholders})
                            ORDER BY e.CreateDate DESC
                        `, namesArray);

                        // Combine both results
                        empRows = [...empRows, ...nameRows];
                    }

                    // Build map of empName -> list of empcodes
                    const empNameToCodes = new Map<string, string[]>();
                    for (const row of empRows) {
                        const empCode = row.EmpCode?.trim().toUpperCase();
                        const empName = row.EmpName?.trim().toUpperCase();

                        if (empName && empCode) {
                            if (!empNameToCodes.has(empName)) {
                                empNameToCodes.set(empName, []);
                            }
                            const arr = empNameToCodes.get(empName)!;
                            if (!arr.includes(empCode)) arr.push(empCode);
                        }
                    }

                    // Collect all empcodes for each key (newest first)
                    for (const row of empRows) {
                        const empCode = row.EmpCode?.trim().toUpperCase();
                        const nik = row.NewICNo?.trim().toUpperCase();
                        const empName = row.EmpName?.trim().toUpperCase();

                        if (empCode) {
                            if (!allEmpCodesByKey.has(empCode)) {
                                allEmpCodesByKey.set(empCode, []);
                            }
                            // Add to front if not exists (newer entries come first)
                            const arr = allEmpCodesByKey.get(empCode)!;
                            if (!arr.includes(empCode)) arr.unshift(empCode);
                        }
                        if (nik) {
                            if (!allEmpCodesByKey.has(nik)) {
                                allEmpCodesByKey.set(nik, []);
                            }
                            const arr = allEmpCodesByKey.get(nik)!;
                            if (!arr.includes(empCode)) arr.unshift(empCode);
                        }
                        // Also add by emp_name - try all empcodes with same name
                        if (empName && empNameToCodes.has(empName)) {
                            const relatedCodes = empNameToCodes.get(empName)!;
                            if (!allEmpCodesByKey.has(empName)) {
                                allEmpCodesByKey.set(empName, relatedCodes);
                            }
                        }
                    }
                } catch (e) {
                    console.error("[OtherIncomesService] Error fetching empcode history from HR_EMPLOYEE:", e);
                }
            }

            // Fetch bank account data for ALL empcodes (we'll try fallback later)
            const hrDataMap = new Map<string, any>();
            const payrollBankMap = new Map<string, any>();
            const payrollBankByNameMap = new Map<string, any>(); // Fallback by name

            // Collect ALL unique empcodes from the history
            const allUniqueEmpCodes = new Set<string>();
            allEmpCodesByKey.forEach((empCodes) => {
                empCodes.forEach(ec => allUniqueEmpCodes.add(ec));
            });

            // Also add emp_codes from hrMap
            hrMap.forEach((hrData) => {
                if (hrData.emp_code) {
                    allUniqueEmpCodes.add(hrData.emp_code.toUpperCase());
                }
            });

            const empCodeArray = Array.from(allUniqueEmpCodes).filter(Boolean);
            if (empCodeArray.length > 0) {
                // Query employee_hr_data table for all empcodes
                try {
                    const hrDataResult = await employeeHrDataService.getHrDataBulk(empCodeArray);
                    hrDataResult.forEach((value, key) => {
                        hrDataMap.set(key, value);
                    });
                } catch (e) {
                    console.error("[OtherIncomesService] Error fetching HR data for bank accounts:", e);
                }

                // Query HR_PAYROLL table for all empcodes
                try {
                    const placeholders = empCodeArray.map(() => '?').join(',');
                    const payrollRows = await mainDb.query<any>(`
                        SELECT
                            RTRIM(EmpCode) as EmpCode,
                            RTRIM(BankAccNo) as BankAccNo,
                            RTRIM(BankCode) as BankCode
                        FROM HR_PAYROLL
                        WHERE RTRIM(EmpCode) IN (${placeholders})
                    `, empCodeArray);

                    for (const row of payrollRows) {
                        const empCodeKey = row.EmpCode?.trim().toUpperCase();
                        const bankAccNo = row.BankAccNo?.trim() || '';
                        // Store ALL entries (valid or '0') - prefer valid ones later
                        if (empCodeKey && bankAccNo) {
                            const existing = payrollBankMap.get(empCodeKey);
                            if (!existing) {
                                payrollBankMap.set(empCodeKey, { bank_acc_no: bankAccNo, bank_code: row.BankCode?.trim() || '' });
                            } else if (this.isValidBankAccNo(bankAccNo) && !this.isValidBankAccNo(existing.bank_acc_no)) {
                                // Replace '0' with valid if we find one
                                payrollBankMap.set(empCodeKey, { bank_acc_no: bankAccNo, bank_code: row.BankCode?.trim() || '' });
                            }
                        }
                    }
                } catch (e) {
                    console.error("[OtherIncomesService] Error fetching bank from HR_PAYROLL:", e);
                }
            }

            // Also query HR_PAYROLL by emp_name for additional bank account lookup
            const empNamesForQuery = new Set<string>();
            hrMap.forEach((hrData, key) => {
                if (hrData.emp_name) {
                    empNamesForQuery.add(hrData.emp_name.trim().toUpperCase());
                }
            });

            if (empNamesForQuery.size > 0) {
                try {
                    const nameArray = Array.from(empNamesForQuery);
                    const namePlaceholders = nameArray.map(() => '?').join(',');

                    // Query HR_PAYROLL by emp_name to get bank accounts
                    // Join with HR_EMPLOYEE to get emp_name
                    const payrollByNameRows = await mainDb.query<any>(`
                        SELECT
                            RTRIM(p.EmpCode) as EmpCode,
                            RTRIM(e.EmpName) as EmpName,
                            RTRIM(p.BankAccNo) as BankAccNo,
                            RTRIM(p.BankCode) as BankCode
                        FROM HR_PAYROLL p
                        LEFT JOIN HR_EMPLOYEE e ON p.EmpCode = e.EmpCode
                        WHERE RTRIM(e.EmpName) IN (${namePlaceholders})
                    `, nameArray);

                    for (const row of payrollByNameRows) {
                        const empName = row.EmpName?.trim().toUpperCase();
                        const empCode = row.EmpCode?.trim().toUpperCase();
                        const bankAccNo = row.BankAccNo?.trim() || '';

                        // Store ALL entries (valid or '0') - prefer valid ones later
                        if (empName && bankAccNo) {
                            const existing = payrollBankByNameMap.get(empName);
                            if (!existing) {
                                payrollBankByNameMap.set(empName, { bank_acc_no: bankAccNo, bank_code: row.BankCode?.trim() || '', emp_code: empCode });
                            } else if (this.isValidBankAccNo(bankAccNo) && !this.isValidBankAccNo(existing.bank_acc_no)) {
                                // Replace '0' with valid if we find one
                                payrollBankByNameMap.set(empName, { bank_acc_no: bankAccNo, bank_code: row.BankCode?.trim() || '', emp_code: empCode });
                            }
                        }
                    }
                } catch (e) {
                    console.error("[OtherIncomesService] Error fetching bank from HR_PAYROLL by name:", e);
                }
            }

            // Override bank info with FALLBACK mechanism: try each empcode until we find one with bank account
            hrMap.forEach((hrData, key) => {
                // Get all empcodes for this key (newest first)
                const empCodesToTry = allEmpCodesByKey.get(key) || (hrData.emp_code ? [hrData.emp_code.toUpperCase()] : []);

                // Try each empcode in order (newest first) until we find bank account
                for (const empCode of empCodesToTry) {
                    if (!empCode) continue;

                    // First try employee_hr_data
                    if (hrDataMap.has(empCode)) {
                        const hrDataEntry = hrDataMap.get(empCode);
                        if (this.isValidBankAccNo(hrDataEntry?.bank_acc_no)) {
                            hrData.bank_acc_no = hrDataEntry.bank_acc_no;
                            hrData.bank_code = hrDataEntry.bank_code;
                            break; // Found valid bank account, stop trying
                        }
                    }

                    // Then try HR_PAYROLL
                    if (payrollBankMap.has(empCode)) {
                        const payrollEntry = payrollBankMap.get(empCode);
                        if (this.isValidBankAccNo(payrollEntry?.bank_acc_no)) {
                            hrData.bank_acc_no = payrollEntry.bank_acc_no;
                            hrData.bank_code = payrollEntry.bank_code;
                            break; // Found valid bank account, stop trying
                        }
                    }
                }

                // Last fallback: try by emp_name in HR_PAYROLL
                if (!this.isValidBankAccNo(hrData.bank_acc_no) && hrData.emp_name && payrollBankByNameMap.has(hrData.emp_name.toUpperCase())) {
                    const byNameEntry = payrollBankByNameMap.get(hrData.emp_name.toUpperCase());
                    if (this.isValidBankAccNo(byNameEntry?.bank_acc_no)) {
                        hrData.bank_acc_no = byNameEntry.bank_acc_no;
                        hrData.bank_code = byNameEntry.bank_code;
                    }
                }
            });

            // Only fetch blacklist if we have data to filter
            const periodYear = incomes[0].period_year;
            const periodMonth = incomes[0].period_month;
            const blacklist = await this.getBlacklist(periodYear, periodMonth, 'THR');
            const blacklistedNIKs = new Set(blacklist.map(b => String(b.nik || '').trim().toUpperCase()));

            const filteredIncomes = incomes.filter(inc => {
                const nik = (inc.nik || '').trim().toUpperCase();
                return !blacklistedNIKs.has(nik);
            });

            filteredIncomes.forEach(inc => {
                const hr = hrMap.get(inc.nik?.trim().toUpperCase());
                if (hr) {
                    inc.religion = hr.religion;
                    inc.original_religion = hr.original_religion; // Pass original religion to frontend
                    inc.emp_code = hr.emp_code; inc.bank_acc_no = hr.bank_acc_no; inc.bank_code = hr.bank_code;
                    if (!inc.join_date) inc.join_date = hr.join_date;
                    if (!inc.emp_name || inc.emp_name === inc.nik) inc.emp_name = hr.emp_name;
                    (inc as any).upah_dasar = hr.upah_dasar; (inc as any).beras_rate = hr.beras_rate; (inc as any).sex = hr.sex;
                }

                // PERSISTENCE RULE: Auto-recalculate THR proportion for saved data if needed
                if (inc.income_type === 'THR' && inc.join_date) {
                    const jd = this.parseDate(inc.join_date);
                    if (jd) {
                        const periodDate = new Date(inc.period_year, inc.period_month - 1, 1);
                        const diff = (periodDate.getFullYear() - jd.getFullYear()) * 12 + (periodDate.getMonth() - jd.getMonth());
                        if (diff < 12 && diff >= 0) {
                            const workingMonths = Math.min(12, diff + 1);
                            if (workingMonths < 12) {
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
            return filteredIncomes;
        } catch (e) { console.error("Enrich error:", e); return incomes; }
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
            const recalcVars: any = {
                UPAH_DASAR: upahDasar,
                GAJI_POKOK: upahDasar * 30,
                BERAS_RATE: h?.beras_rate || (inc as any).beras_rate || 0,
                MASA_KERJA_JUMLAH: h?.masa_kerja_jumlah || 0,
                MASA_KERJA_TAHUN: h?.masa_kerja_tahun || 0,
                JOIN_DATE: inc.join_date || h?.join_date,
                PROPORTION_FACTOR: "12/12",
                SEX: (inc as any).sex || (h?.gender === 'FEMALE' ? 'P' : 'L'),
                BANK_ACC_NO: this.isValidBankAccNo(inc.bank_acc_no) ? inc.bank_acc_no : (this.isValidBankAccNo(h?.bank_acc_no) ? h.bank_acc_no : ''),
                BANK_CODE: inc.bank_code || h?.bank_code,
                EMP_CODE: inc.emp_code || h?.emp_code
            };
            const jd = this.parseDate(recalcVars.JOIN_DATE);
            if (jd) {
                const periodDate = new Date(year, month - 1, 1);
                const diff = (periodDate.getFullYear() - jd.getFullYear()) * 12 + (periodDate.getMonth() - jd.getMonth());
                if (diff < 12 && diff >= 0) { recalcVars.PROPORTION_FACTOR = `${Math.min(12, diff + 1)}/12`; }
            }
            // Merge: saved details_json variables (from calculateTHRData) take precedence
            // This preserves JABATAN_JUMLAH, TOTAL_TUNJANGAN_JABATAN, TOTAL_TUNJANGAN_BERAS, IS_FULL, etc.
            const savedVars = (inc as any).details?.variables || {};
            const vars = { ...recalcVars, ...savedVars };
            return { ...inc, details: { formula: thrFormula.formula, variables: vars } };
        });
    }

    static async calculateTHRData(year: number, month: number, divisionCode?: string, gangCode?: string): Promise<OtherIncome[]> {
        const historyService = HistoryDatabaseService.getInstance();

        // NOTE: Do NOT resolve virtual division to source!
        // The history service already handles virtual division filtering correctly.
        // If we resolve WKS_AR -> AB2 here, the history service will treat it as a real division
        // and won't apply the virtual gang filtering.
        // Instead, pass the virtual division code as-is to let history service handle it.

        const historyData = await historyService.getHistoricalPayrollDataAsExtractorFormat(month, year, gangCode || 'ALL', divisionCode || undefined);
        if (!historyData?.data_rows?.length) {
            console.log(`[OtherIncomes] No history data for ${divisionCode}, gang: ${gangCode}, period: ${month}/${year}`);
            return [];
        }

        // The history service already filtered by virtual division gangs (if applicable)
        // No additional filtering needed here
        const filteredDataRows = historyData.data_rows;
        const formulaConfig = await this.getFormula('THR');

        // Fetch blacklist for this period
        const blacklist = await this.getBlacklist(year, month, 'THR');
        const blacklistedNIKs = new Set(blacklist.map(b => String(b.nik || '').trim().toUpperCase()));

        // AGGRESSIVE DEDUPLICATION: Ensure unique NIK before calculation
        const uniqueHistoryMap = new Map<string, any>();
        filteredDataRows.forEach(row => {
            const nik = String(row.nik || '').trim().toUpperCase();
            if (nik && !uniqueHistoryMap.has(nik) && !blacklistedNIKs.has(nik)) {
                uniqueHistoryMap.set(nik, row);
            }
        });

        // Summary counters
        let fullWorkers = 0; // 12/12
        let proportionalWorkers = 0;

        const results: OtherIncome[] = [];
        for (const row of uniqueHistoryMap.values()) {
            const nik = String(row.nik || '').trim().toUpperCase();
            const upahDasar = row.upah_dasar || 0;
            const berasRate = row.beras_rate || 0;
            const jabatanRate = row.jabatan_rate || 0;
            const masaKerjaJumlah = row.masa_kerja_jumlah || 0;

            // Calculate component values
            const gajiPokok = upahDasar * 30;
            const tunjanganBeras = berasRate * 30;
            const tunjanganJabatan = row.jabatan_jumlah || (jabatanRate * 30);
            const tunjanganMasaKerja = masaKerjaJumlah;

            const mathVars = {
                UPAH_DASAR: upahDasar,
                GAJI_POKOK: gajiPokok,
                BERAS_RATE: berasRate,
                BERAS_JUMLAH: tunjanganBeras,
                JABATAN_RATE: jabatanRate,
                JABATAN_JUMLAH: tunjanganJabatan,
                MASA_KERJA_JUMLAH: tunjanganMasaKerja,
                MASA_KERJA_TAHUN: row.masa_kerja_tahun || 0,
                HK: 30
            };
            let fullThr = 0;
            try {
                const evalFn = new Function(...Object.keys(mathVars), `return ${formulaConfig.formula};`);
                fullThr = evalFn(...Object.values(mathVars));
            } catch { fullThr = gajiPokok + tunjanganBeras + tunjanganMasaKerja; }

            let thrAmt = fullThr;
            let propDesc = '';
            let workingMonths = 12;
            let propFactor = "12/12";
            const jd = this.parseDate(row.join_date);
            if (jd) {
                const periodDate = new Date(year, month - 1, 1);
                let diff = (periodDate.getFullYear() - jd.getFullYear()) * 12 + (periodDate.getMonth() - jd.getMonth());
                if (diff < 12 && diff >= 0) {
                    workingMonths = Math.min(12, diff + 1);
                    if (workingMonths < 12) {
                        propFactor = `${workingMonths}/12`;
                        thrAmt = Math.round((fullThr * workingMonths) / 12);
                        propDesc = ` (Proporsi ${workingMonths}/12)`;
                        proportionalWorkers++;
                    } else {
                        fullWorkers++;
                    }
                } else {
                    fullWorkers++;
                }
            } else {
                fullWorkers++;
            }

            let relRow = row.religion || '';
            const rawRowRel = relRow.trim().toUpperCase();
            const religionMap: Record<string, string> = {
                '01': '01 Islam', '02': '02 Katolik', '03': '03 Protestan',
                '04': '04 Hindu', '05': '05 Budha', '06': '06 Konghucu',
                'ISLAM': '01 Islam', 'KATHOLIK': '02 Katolik', 'KATOLIK': '02 Katolik',
                'KRISTEN': '03 Protestan', 'PROTESTAN': '03 Protestan', 'HINDU': '04 Hindu',
                'BUDHA': '05 Budha', 'BUDDHA': '05 Budha', 'KONGHUCU': '06 Konghucu'
            };
            const mappedRel = religionMap[rawRowRel] || relRow || '01 Islam';

            results.push({
                nik,
                emp_name: row.nama || row.emp_name || '',
                division_code: divisionCode || row.loc_code || row.division_code,
                gang_code: row.gang_code,
                period_year: year,
                period_month: month,
                income_type: 'THR',
                income_name: `Tunjangan Hari Raya${propDesc}`,
                amount: thrAmt,
                is_paid_in_thp: true,
                is_taxable: true,
                original_religion: row.religion || '',
                details: {
                    formula: formulaConfig.formula,
                    variables: {
                        ...mathVars,
                        JOIN_DATE: row.join_date,
                        WORKING_MONTHS: workingMonths,
                        PROPORTION_FACTOR: propFactor,
                        RELIGION: mappedRel,
                        SEX: row.jenis_kelamin === 'FEMALE' ? 'P' : 'L',
                        EMP_CODE: row.emp_code,
                        // Summary values
                        TOTAL_GAJI_POKOK: gajiPokok,
                        TOTAL_TUNJANGAN_BERAS: tunjanganBeras,
                        TOTAL_TUNJANGAN_JABATAN: tunjanganJabatan,
                        TOTAL_TUNJANGAN_MASA_KERJA: tunjanganMasaKerja,
                        IS_FULL: workingMonths === 12
                    }
                }
            });
        }
        // enrichWithHrData already handles filtering by blacklist
        return this.enrichWithHrData(results, gangCode);
    }

    static async bulkSaveIncomes(incomes: OtherIncome[]): Promise<{ success: boolean; count: number }> {
        if (!incomes.length) return { success: true, count: 0 };
        const db = Database.getExtendedInstance(); let count = 0;
        try {
            // Process in smaller batches to avoid connection timeouts for large datasets
            const batchSize = 50;
            for (let i = 0; i < incomes.length; i += batchSize) {
                const batch = incomes.slice(i, i + batchSize);
                for (const inc of batch) {
                    // 1. Delete existing record for this NIK + Period + Type
                    // This ensures absolute uniqueness regardless of gang/division changes
                    await db.query(`
                        DELETE FROM employee_other_incomes 
                        WHERE period_year = ? 
                          AND period_month = ? 
                          AND RTRIM(nik) = ? 
                          AND income_type = ?
                    `, [inc.period_year, inc.period_month, inc.nik.trim(), inc.income_type]);

                    // 2. Insert new calculated record (including details_json)
                    const detailsJson = inc.details ? JSON.stringify(inc.details) : null;
                    await db.query(`
                        INSERT INTO employee_other_incomes (
                            nik, emp_name, division_code, gang_code, 
                            period_year, period_month, income_type, 
                            income_name, amount, is_paid_in_thp, is_taxable, 
                            details_json, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())
                    `, [
                        inc.nik, inc.emp_name, inc.division_code, inc.gang_code,
                        inc.period_year, inc.period_month, inc.income_type,
                        inc.income_name, inc.amount,
                        inc.is_paid_in_thp ? 1 : 0, inc.is_taxable ? 1 : 0,
                        detailsJson
                    ]);
                    count++;
                }
            }
            return { success: true, count };
        } catch (e) {
            console.error("Bulk save error:", e);
            return { success: false, count };
        }
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
        try {
            const rows = await db.query(`SELECT nik, emp_name, period_year, period_month, income_type FROM employee_other_incomes WHERE id = ?`, [id]);
            if (rows && rows.length > 0) {
                const r = rows[0];
                await this.addToBlacklist(r.nik, r.emp_name, r.period_year, r.period_month, r.income_type);
            }
            await db.query(`DELETE FROM employee_other_incomes WHERE id = ?`, [id]);
            return true;
        }
        catch (e) { return false; }
    }

    static async deleteIncomesByPeriod(year: number, month: number, divisionCode?: string, gangCode?: string): Promise<{ success: boolean; count: number }> {
        const db = Database.getExtendedInstance();
        try {
            console.log(`[OtherIncomesService] Request DELETE by period: ${month}/${year}, Div: ${divisionCode}, Gang: ${gangCode}`);

            let sql = `DELETE FROM employee_other_incomes WHERE period_year = ? AND period_month = ?`;
            const params: any[] = [year, month];

            if (divisionCode && divisionCode !== 'ALL') {
                // Use unified mapping for consistent handling
                const allPossibleDivs = new Set<string>();
                let virtualGangs: string[] = [];

                try {
                    const { gangService } = await import('./gangService');

                    // Check if this is a virtual division - handle separately
                    if (gangService.isVirtualDivision(divisionCode)) {
                        // For virtual divisions, filter by gang_code
                        virtualGangs = await gangService.getVirtualDivisionGangs(divisionCode);
                        if (virtualGangs.length > 0) {
                            sql += ` AND gang_code IN (${virtualGangs.map(() => '?').join(',')})`;
                            params.push(...virtualGangs);
                            console.log(`[OtherIncomesService] Deleting for virtual division gangs: ${virtualGangs.join(', ')}`);
                        }
                    } else {
                        // Regular division - use unified mapping
                        const aliases = gangService.getAllDivisionAliases(divisionCode);
                        aliases.forEach(a => allPossibleDivs.add(a));

                        // Also get from source divisions
                        const sourceDivs = await divisionDefinition.getSourceDivisionsForAggregation(divisionCode);
                        for (const sd of sourceDivs) {
                            allPossibleDivs.add(sd);
                            const srcAliases = gangService.getAllDivisionAliases(sd);
                            srcAliases.forEach(a => allPossibleDivs.add(a));

                            // Include virtual divisions for source
                            const virtuals = await divisionDefinition.getVirtualDivisionsForSource(sd);
                            virtuals.forEach(v => {
                                const config = divisionDefinition.getVirtualDivisionConfig(v);
                                if (!config?.exclude_from_source || v === divisionCode) {
                                    allPossibleDivs.add(v);
                                }
                            });
                        }
                        const divList = Array.from(allPossibleDivs);
                        console.log(`[OtherIncomesService] Deleting for divisions: ${divList.join(', ')}`);
                        sql += ` AND division_code IN (${divList.map(() => '?').join(',')})`;
                        params.push(...divList);
                    }
                } catch { /* gangService not available */ }
            }

            if (gangCode && gangCode !== 'ALL') {
                sql += ` AND gang_code = ?`;
                params.push(gangCode);
            }

            const result = await db.query(sql, params);
            console.log(`[OtherIncomesService] DELETE successful for ${month}/${year}`);
            return { success: true, count: 0 };
        } catch (e: any) {
            console.error("[OtherIncomesService] deleteIncomesByPeriod error:", e);
            return { success: false, error: e.message, count: 0 } as any;
        }
    }

    // calculateAndSaveTHR: calculates THR for all employees and saves to DB
    // Always deletes old data first for the selected period/division/gang, then saves new data
    // This ensures no duplicates and data is always fresh
    static async calculateAndSaveTHR(year: number, month: number, divisionCode?: string, gangCode?: string): Promise<{ success: boolean; count?: number; error?: string; summary?: { total_karyawan: number; full_workers: number; proportional_workers: number; total_thr: number; total_gaji_pokok: number; total_tunjangan_beras: number; total_tunjangan_jabatan: number } }> {
        try {
            // 1. Calculate THR data
            const data = await this.calculateTHRData(year, month, divisionCode, gangCode);
            if (!data.length) return { success: false, error: 'Tidak ada data karyawan untuk periode ini.' };

            // 2. Calculate summary
            let fullWorkers = 0;
            let proportionalWorkers = 0;
            let totalThr = 0;
            let totalGajiPokok = 0;
            let totalTunjanganBeras = 0;
            let totalTunjanganJabatan = 0;

            for (const inc of data) {
                totalThr += inc.amount || 0;
                const vars = (inc as any).details?.variables || {};
                totalGajiPokok += vars.TOTAL_GAJI_POKOK || 0;
                totalTunjanganBeras += vars.TOTAL_TUNJANGAN_BERAS || 0;
                totalTunjanganJabatan += vars.TOTAL_TUNJANGAN_JABATAN || 0;
                if (vars.IS_FULL) {
                    fullWorkers++;
                } else {
                    proportionalWorkers++;
                }
            }

            const summary = {
                total_karyawan: data.length,
                full_workers: fullWorkers,
                proportional_workers: proportionalWorkers,
                total_thr: totalThr,
                total_gaji_pokok: totalGajiPokok,
                total_tunjangan_beras: totalTunjanganBeras,
                total_tunjangan_jabatan: totalTunjanganJabatan
            };

            // 3. Delete existing data for this period/division/gang FIRST
            const db = Database.getExtendedInstance();
            let deleteSql = `DELETE FROM employee_other_incomes WHERE period_year = ? AND period_month = ? AND income_type = 'THR'`;
            const deleteParams: any[] = [year, month];

            if (divisionCode && divisionCode !== 'ALL') {
                // Use unified mapping for consistent division handling
                const allPossibleDivs = new Set<string>();
                let virtualGangs: string[] = [];

                try {
                    const { gangService } = await import('./gangService');

                    // Check if this is a virtual division - handle separately
                    if (gangService.isVirtualDivision(divisionCode)) {
                        // For virtual divisions, filter by gang_code
                        virtualGangs = await gangService.getVirtualDivisionGangs(divisionCode);
                        if (virtualGangs.length > 0) {
                            deleteSql += ` AND gang_code IN (${virtualGangs.map(() => '?').join(',')})`;
                            deleteParams.push(...virtualGangs);
                        }
                    } else {
                        // Regular division - use unified mapping
                        const aliases = gangService.getAllDivisionAliases(divisionCode);
                        aliases.forEach(a => allPossibleDivs.add(a));

                        // Also get from source divisions
                        const sourceDivs = await divisionDefinition.getSourceDivisionsForAggregation(divisionCode);
                        for (const sd of sourceDivs) {
                            allPossibleDivs.add(sd);
                            const srcAliases = gangService.getAllDivisionAliases(sd);
                            srcAliases.forEach(a => allPossibleDivs.add(a));
                        }
                        const divList = Array.from(allPossibleDivs);
                        deleteSql += ` AND division_code IN (${divList.map(() => '?').join(',')})`;
                        deleteParams.push(...divList);
                    }
                } catch { /* gangService not available */ }
            }

            if (gangCode && gangCode !== 'ALL') {
                deleteSql += ` AND gang_code = ?`;
                deleteParams.push(gangCode);
            }

            await db.query(deleteSql, deleteParams);

            // 4. Insert new data
            const result = await this.bulkSaveIncomes(data);
            return { success: result.success, count: result.count, summary };
        } catch (e: any) { return { success: false, error: e.message }; }
    }

    // Alias for frontend compatibility if needed
    static async bulkSave(incomes: OtherIncome[]) { return this.bulkSaveIncomes(incomes); }
    static async previewTHR(year: number, month: number, division?: string, gang?: string) {
        try { const data = await this.calculateTHRData(year, month, division, gang); return { success: true, data }; }
        catch (e: any) { return { success: false, error: e.message }; }
    }

    /**
     * Get summary of saved THR data grouped by gang
     * Automatically excludes blacklisted employees (done via getIncomesWithDetails)
     */
    static async getThrSummary(year: number, month: number, divisionCode?: string) {
        try {
            // Use getRawIncomes directly - avoid heavy full recalculation
            const raw = await this.getRawIncomes(year, month, divisionCode);
            // Filter to THR only
            const incomes = raw.filter(r => r.income_type === 'THR');

            if (!incomes || incomes.length === 0) {
                return { data: [], grand_total: null };
            }

            // Build a history dict for records that DON'T have details_json
            // This provides fallback masa_kerja and beras data
            const needsHistory = incomes.filter(inc => !(inc as any).details?.variables);
            let historyDict: Record<string, any> = {};
            if (needsHistory.length > 0) {
                try {
                    const historyService = HistoryDatabaseService.getInstance();
                    // Fetch ALL divisions' history at once (pass undefined for div)
                    const historyData = await historyService.getHistoricalPayrollDataAsExtractorFormat(month, year, 'ALL', undefined);
                    if (historyData?.data_rows) {
                        historyData.data_rows.forEach((row: any) => {
                            const nik = String(row.nik || '').trim().toUpperCase();
                            if (nik) historyDict[nik] = row;
                        });
                    }
                } catch (e) { /* ignore history fallback errors */ }
            }

            const gangMap = new Map<string, {
                gang_code: string;
                gang_description?: string;
                total_employees: number;
                full_workers: number;
                prop_workers: number;
                total_thr: number;
                total_tunjangan_beras: number;
                total_masa_kerja: number;
            }>();

            const grandTotal = {
                total_employees: 0,
                full_workers: 0,
                prop_workers: 0,
                total_thr: 0,
                total_tunjangan_beras: 0,
                total_masa_kerja: 0
            };

            for (const inc of incomes) {
                const gangCode = inc.gang_code || 'UNKNOWN';
                const amt = inc.amount || 0;
                let vars = (inc as any).details?.variables || {};

                // Fallback: if no details_json, use history data
                if (Object.keys(vars).length === 0) {
                    const nikKey = inc.nik?.trim().toUpperCase();
                    const h = historyDict[nikKey || ''];
                    if (h) {
                        vars = {
                            BERAS_RATE: h.beras_rate || 0,
                            BERAS_JUMLAH: (h.beras_rate || 0) * 30,
                            MASA_KERJA_JUMLAH: h.masa_kerja_jumlah || 0,
                            PROPORTION_FACTOR: '12/12'
                        };
                    }
                }

                // Always detect proportion from income_name as override
                // This fixes cases where details_json has incorrect PROPORTION_FACTOR
                const propMatch = inc.income_name?.match(/Proporsi\s+(\d+)\/12/i);
                if (propMatch) {
                    vars.PROPORTION_FACTOR = `${propMatch[1]}/12`;
                    vars.WORKING_MONTHS = parseInt(propMatch[1]);
                }

                // Determine if full or proportional
                // Use PROPORTION_FACTOR as primary source (if not '12/12', it's proportional)
                const propFactor = vars.PROPORTION_FACTOR || '12/12';
                const isFull = propFactor === '12/12';

                // Get tunjangan values
                const tunjanganBeras = vars.TOTAL_TUNJANGAN_BERAS || vars.BERAS_JUMLAH || ((vars.BERAS_RATE || 0) * 30);
                const masaKerja = vars.MASA_KERJA_JUMLAH || 0;

                if (!gangMap.has(gangCode)) {
                    gangMap.set(gangCode, {
                        gang_code: gangCode,
                        gang_description: gangCode,
                        total_employees: 0,
                        full_workers: 0,
                        prop_workers: 0,
                        total_thr: 0,
                        total_tunjangan_beras: 0,
                        total_masa_kerja: 0
                    });
                }

                const gangSum = gangMap.get(gangCode)!;
                gangSum.total_employees += 1;
                gangSum.total_thr += amt;
                gangSum.total_tunjangan_beras += tunjanganBeras;
                gangSum.total_masa_kerja += masaKerja;

                if (isFull) {
                    gangSum.full_workers += 1;
                    grandTotal.full_workers += 1;
                } else {
                    gangSum.prop_workers += 1;
                    grandTotal.prop_workers += 1;
                }

                grandTotal.total_employees += 1;
                grandTotal.total_thr += amt;
                grandTotal.total_tunjangan_beras += tunjanganBeras;
                grandTotal.total_masa_kerja += masaKerja;
            }

            const data = Array.from(gangMap.values()).sort((a, b) => a.gang_code.localeCompare(b.gang_code));

            return {
                data,
                grand_total: grandTotal
            };

        } catch (error: any) {
            console.error("Error in getThrSummary:", error);
            throw error;
        }
    }

    /**
     * Get summary of saved THR data grouped by division (for Rebinmas-wide recap)
     * Automatically excludes blacklisted employees
     */
    static async getThrRecapAll(year: number, month: number) {
        try {
            // Use getRawIncomes directly for all divisions
            const raw = await this.getRawIncomes(year, month);
            // Filter to THR only
            const incomes = raw.filter(r => r.income_type === 'THR');

            if (!incomes || incomes.length === 0) {
                return { divisions: [], grand_total: null };
            }

            // Build a history dict for records that DON'T have details_json
            const needsHistory = incomes.filter(inc => !(inc as any).details?.variables);
            let historyDict: Record<string, any> = {};
            if (needsHistory.length > 0) {
                try {
                    const historyService = HistoryDatabaseService.getInstance();
                    const historyData = await historyService.getHistoricalPayrollDataAsExtractorFormat(month, year, 'ALL', undefined);
                    if (historyData?.data_rows) {
                        historyData.data_rows.forEach((row: any) => {
                            const nik = String(row.nik || '').trim().toUpperCase();
                            if (nik) historyDict[nik] = row;
                        });
                    }
                } catch (e) { /* ignore history fallback errors */ }
            }

            const divMap = new Map<string, any>();

            const grandTotal = {
                total_employees: 0,
                full_workers: 0,
                prop_workers: 0,
                total_thr: 0,
                total_tunjangan_beras: 0,
                total_masa_kerja: 0
            };

            for (const inc of incomes) {
                // Group by division instead of gang
                const divCode = inc.division_code || 'UNKNOWN';
                const amt = inc.amount || 0;
                let vars = (inc as any).details?.variables || {};

                // Fallback: if no details_json, use history data
                if (Object.keys(vars).length === 0) {
                    const nikKey = inc.nik?.trim().toUpperCase();
                    const h = historyDict[nikKey || ''];
                    if (h) {
                        vars = {
                            BERAS_RATE: h.beras_rate || 0,
                            BERAS_JUMLAH: (h.beras_rate || 0) * 30,
                            MASA_KERJA_JUMLAH: h.masa_kerja_jumlah || 0,
                            PROPORTION_FACTOR: '12/12'
                        };
                    }
                }

                // Always detect proportion from income_name as override
                const propMatch = inc.income_name?.match(/Proporsi\s+(\d+)\/12/i);
                if (propMatch) {
                    vars.PROPORTION_FACTOR = `${propMatch[1]}/12`;
                    vars.WORKING_MONTHS = parseInt(propMatch[1]);
                }

                const propFactor = vars.PROPORTION_FACTOR || '12/12';
                const isFull = propFactor === '12/12';

                const tunjanganBeras = vars.TOTAL_TUNJANGAN_BERAS || vars.BERAS_JUMLAH || ((vars.BERAS_RATE || 0) * 30);
                const masaKerja = vars.MASA_KERJA_JUMLAH || 0;

                if (!divMap.has(divCode)) {
                    divMap.set(divCode, {
                        division: divCode,
                        gang_description: divCode, // Add this so frontend can show description if requested
                        karyawan_count: 0,
                        full_workers: 0,
                        prop_workers: 0,
                        total_thr: 0,
                        total_tunjangan_beras: 0,
                        total_masa_kerja: 0
                    });
                }

                const divSum = divMap.get(divCode)!;
                divSum.karyawan_count += 1;
                divSum.total_thr += amt;
                divSum.total_tunjangan_beras += tunjanganBeras;
                divSum.total_masa_kerja += masaKerja;

                if (isFull) {
                    divSum.full_workers += 1;
                    grandTotal.full_workers += 1;
                } else {
                    divSum.prop_workers += 1;
                    grandTotal.prop_workers += 1;
                }

                grandTotal.total_employees += 1;
                grandTotal.total_thr += amt;
                grandTotal.total_tunjangan_beras += tunjanganBeras;
                grandTotal.total_masa_kerja += masaKerja;
            }

            const divisions = Array.from(divMap.values()).sort((a, b) => a.division.localeCompare(b.division));

            return {
                divisions,
                grand_total: grandTotal
            };

        } catch (error: any) {
            console.error("Error in getThrRecapAll:", error);
            throw error;
        }
    }
}
