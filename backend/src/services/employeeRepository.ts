import { Database } from "../db/client";
import { cacheService } from "./cacheService";
import { Config } from "../config";

// Gender mapping: 1=L (Laki-laki), 2=P (Perempuan)
function mapGender(value: any): string {
    try {
        const i = parseInt(value);
        if (i === 1) return "L";
        if (i === 2) return "P";
        return "L";
    } catch {
        return "L";
    }
}

export interface Employee {
    nik: string;
    nama: string;
    jenis_kelamin: string;
    loc_code: string;
    gang_code: string;
    phone?: string;
    upah_dasar?: number;
    actual_nik?: string; // Expose permanent ICNo for history linking
    religion?: string;
    status?: string;
    employee_type?: string;
    birth_date?: string; // DOB from HR_EMPLOYEE
    join_date?: string;
}

// Division to GangCode prefix mapping
const DIVISION_PREFIX_MAP: Record<string, string[]> = {
    "PG1A": ["A"],
    "PG1B": ["B"],
    "PG2A": ["C"],
    "PG2B": ["D"],
    "DME": ["E"],
    "ARA": ["F"],
    "ARB1": ["G"],
    "ARB2": ["H"],
    "INFRA": ["I"],
    "ARC": ["J"],
    "IJL": ["L"],
    "STF-OFFICE": ["O"],
    "SECURITY": ["SEC"]
};

export class EmployeeRepository {
    private static instance: EmployeeRepository;
    private db: Database;

    private constructor() {
        this.db = Database.getInstance();
    }

    public static getInstance(): EmployeeRepository {
        if (!EmployeeRepository.instance) {
            EmployeeRepository.instance = new EmployeeRepository();
        }
        return EmployeeRepository.instance;
    }

    /**
     * Get history database instance for fallback
     */
    private getHistoryDb(): Database {
        return Database.getInstance(Config.DB_EXTEND_DATABASE, Config.DB_EXTEND_PROFILE);
    }

    /**
     * List employees from history database (fallback source)
     */
    private async listFromHistory(options: {
        skip?: number;
        limit?: number;
        gangCode?: string;
        division?: string;
        religion?: string;
        status?: string;
    } = {}): Promise<Employee[]> {
        const { skip = 0, limit = 100, gangCode, division, religion, status } = options;
        const histDb = this.getHistoryDb();

        try {
            let params: any[] = [];
            let whereClauses: string[] = [];

            if (division) {
                const prefixes = DIVISION_PREFIX_MAP[division] || [];
                if (prefixes.length > 0) {
                    const conditions = prefixes.map((p) => `UPPER(RTRIM(gang_code)) LIKE ?`);
                    whereClauses.push(`(${conditions.join(" OR ")})`);
                    params.push(...prefixes.map(p => p + "%"));
                }
            }

            if (gangCode && gangCode !== "ALL" && gangCode.trim()) {
                whereClauses.push(`UPPER(RTRIM(gang_code)) = ?`);
                params.push(gangCode.trim().toUpperCase());
            }

            if (religion) {
                whereClauses.push(`UPPER(RTRIM(religion)) = ?`);
                params.push(religion.trim().toUpperCase());
            }

            if (status) {
                whereClauses.push(`UPPER(RTRIM(status)) = ?`);
                params.push(status.trim().toUpperCase());
            }

            const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

            // Get latest record per employee
            const sql = `
                SELECT
                    RTRIM(emp_code) AS nik,
                    RTRIM(nik) AS actual_nik,
                    emp_name AS nama,
                    gender AS jenis_kelamin,
                    RTRIM(loc_code) AS loc_code,
                    RTRIM(gang_code) AS gang_code,
                    RTRIM(religion) AS religion,
                    RTRIM(status) AS status,
                    RTRIM(employee_type) AS employee_type,
                    CONVERT(VARCHAR, birth_date, 23) AS birth_date
                FROM dbo.history_hr_employee h
                ${whereClause}
                AND period_year = (SELECT MAX(period_year) FROM dbo.history_hr_employee h2 WHERE h2.emp_code = h.emp_code)
                AND period_month = (SELECT MAX(period_month) FROM dbo.history_hr_employee h3
                    WHERE h3.emp_code = h.emp_code AND h3.period_year = h.period_year)
                ORDER BY emp_name
            `;

            const rows = await histDb.query<any>(sql, params);
            const all = rows.map((r: any) => ({
                nik: r.nik?.trim() || "",
                actual_nik: r.actual_nik?.trim() || r.nik?.trim() || "",
                nama: r.nama?.trim() || "",
                jenis_kelamin: r.jenis_kelamin?.trim() || "L",
                loc_code: r.loc_code?.trim() || "",
                gang_code: r.gang_code?.trim() || "",
                religion: r.religion?.trim() || "",
                status: r.status?.trim() || "",
                employee_type: r.employee_type?.trim() || "",
                birth_date: r.birth_date || undefined
            }));

            return all.slice(skip, skip + limit);
        } catch (e) {
            console.error("[EmployeeRepository] listFromHistory failed:", e);
            return [];
        }
    }

    /**
     * List employees with optional filters
     */
    public async list(options: {
        skip?: number;
        limit?: number;
        gangCode?: string;
        locCode?: string;
        division?: string;
        religion?: string;
        status?: string;
        forceHistory?: boolean;
    } = {}): Promise<{ employees: Employee[]; dataSource: string }> {
        const { skip = 0, limit = 100, gangCode, locCode, division, religion, status, forceHistory = false } = options;

        try {
            console.log(`[EmployeeRepository] list() called with:`, { gangCode, division, religion, status, skip, limit, forceHistory });
            const gc = gangCode?.trim().toUpperCase() || null;

            let employees: Employee[] = [];
            let dataSource = "origin";

            // Try origin DB first (unless forceHistory is set)
            if (!forceHistory) {
                employees = await this._listFromOrigin(options);

                // Fallback to history DB if origin returns 0 rows
                if (employees.length === 0) {
                    console.log(`[EmployeeRepository] Origin DB returned 0 rows, falling back to history DB`);
                    employees = await this.listFromHistory({ skip, limit, gangCode, division, religion, status });
                    dataSource = employees.length > 0 ? "history" : "origin";
                }
            } else {
                // Force history mode
                employees = await this.listFromHistory({ skip, limit, gangCode, division, religion, status });
                dataSource = employees.length > 0 ? "history" : "origin";
            }

            // Apply locCode filter if specified
            if (locCode) {
                const lcClean = locCode.trim().toUpperCase();
                employees = employees.filter(e => e.loc_code.toUpperCase() === lcClean);
            }

            // Apply religion filter if specified
            if (religion) {
                const relClean = religion.trim().toUpperCase();
                employees = employees.filter(e => (e.religion || '').toUpperCase() === relClean);
            }

            // Apply status filter if specified
            if (status) {
                const statClean = status.trim().toUpperCase();
                employees = employees.filter(e => (e.status || '').toUpperCase() === statClean);
            }

            console.log(`[EmployeeRepository] Returning ${employees.length} employees from ${dataSource}`);
            return { employees: employees.slice(skip, skip + limit), dataSource };
        } catch (e) {
            console.error("[EmployeeRepository] list failed:", e);
            return { employees: [], dataSource: "origin" };
        }
    }

    /**
     * Internal: list from origin database (HR_EMPLOYEE, HR_GANGLN)
     */
    private async _listFromOrigin(options: {
        skip?: number;
        limit?: number;
        gangCode?: string;
        division?: string;
        religion?: string;
        status?: string;
    } = {}): Promise<Employee[]> {
        const { gangCode, division } = options;
        const gc = gangCode?.trim().toUpperCase() || null;

        if (gc === "ALL" || !gc) {
            let params: any[] = [];
            let whereClause = "";

            if (division && DIVISION_PREFIX_MAP[division]) {
                const prefixes = DIVISION_PREFIX_MAP[division];
                const conditions = prefixes.map((p) => `UPPER(g.GangCode) LIKE ?`);
                whereClause = `WHERE (${conditions.join(" OR ")})`;
                params = prefixes.map(p => p + "%");
            }

            const sql = `
                SELECT DISTINCT
                    e.EmpCode AS nik,
                    e.NewICNo AS actual_nik,
                    e.EmpName AS nama,
                    e.Gender AS jenis_kelamin,
                    e.LocCode AS loc_code,
                    g.GangCode AS gang_code,
                    p.PayRate as upah_dasar,
                    e.Religion AS religion,
                    e.Status AS status,
                    e.HREmpType AS employee_type,
                    CONVERT(VARCHAR, e.DOB, 23) AS birth_date
                FROM HR_EMPLOYEE e
                JOIN HR_GANGLN g ON g.GangMember = e.EmpCode
                LEFT JOIN HR_PAYROLL p ON p.EmpCode = e.EmpCode
                ${whereClause}
                ORDER BY e.EmpName
            `;

            const rows = await this.db.query<any>(sql, params);
            return rows.map((r: any) => ({
                nik: r.nik?.trim() || "",
                actual_nik: r.actual_nik?.trim() || r.nik?.trim() || "",
                nama: r.nama?.trim() || "",
                jenis_kelamin: mapGender(r.jenis_kelamin),
                loc_code: r.loc_code?.trim() || "",
                gang_code: r.gang_code?.trim() || "",
                upah_dasar: r.upah_dasar || 0,
                religion: r.religion?.trim() || "",
                status: r.status?.trim() || "",
                employee_type: r.employee_type?.trim() || "",
                birth_date: r.birth_date || undefined
            }));
        } else {
            const rows = await this.db.query<any>(`
                SELECT DISTINCT
                    e.EmpCode AS nik,
                    e.NewICNo AS actual_nik,
                    e.EmpName AS nama,
                    e.Gender AS jenis_kelamin,
                    e.LocCode AS loc_code,
                    g.GangCode AS gang_code,
                    p.PayRate as upah_dasar,
                    e.Religion AS religion,
                    e.Status AS status,
                    e.HREmpType AS employee_type,
                    CONVERT(VARCHAR, e.DOB, 23) AS birth_date
                FROM HR_EMPLOYEE e
                JOIN HR_GANGLN g ON g.GangMember = e.EmpCode
                LEFT JOIN HR_PAYROLL p ON p.EmpCode = e.EmpCode
                WHERE g.GangCode = ?
                ORDER BY e.EmpName
            `, [gc]);

            return rows.map((r: any) => ({
                nik: r.nik?.trim() || "",
                actual_nik: r.actual_nik?.trim() || r.nik?.trim() || "",
                nama: r.nama?.trim() || "",
                jenis_kelamin: mapGender(r.jenis_kelamin),
                loc_code: r.loc_code?.trim() || "",
                gang_code: r.gang_code?.trim() || gc || "",
                upah_dasar: r.upah_dasar || 0,
                religion: r.religion?.trim() || "",
                status: r.status?.trim() || "",
                employee_type: r.employee_type?.trim() || "",
                birth_date: r.birth_date || undefined
            }));
        }
    }

    /**
     * Get employee by NIK
     */
    public async getByNik(nik: string): Promise<Employee | null> {
        try {
            const rows = await this.db.query<any>(`
                SELECT 
                    e.EmpCode, e.EmpName, e.Gender, e.LocCode,
                    g.GangCode, p.PayRate
                FROM HR_EMPLOYEE e
                LEFT JOIN HR_GANGLN g ON g.GangMember = e.EmpCode
                LEFT JOIN HR_PAYROLL p ON p.EmpCode = e.EmpCode
                WHERE e.EmpCode = ?
            `, [nik.trim()]);
            const row = rows[0];

            if (!row) return null;

            return {
                nik: row.EmpCode?.trim() || "",
                nama: row.EmpName?.trim() || "",
                jenis_kelamin: mapGender(row.Gender),
                loc_code: row.LocCode?.trim() || "",
                gang_code: row.GangCode?.trim() || "",
                upah_dasar: row.PayRate || 0
            };
        } catch (e) {
            console.error("[EmployeeRepository] getByNik failed:", e);
            return null;
        }
    }

    /**
     * Get available gang codes, optionally filtered by division prefix
     */
    public async getAvailableGangs(division?: string): Promise<string[]> {
        try {
            let sql = `
                SELECT DISTINCT g.GangCode FROM HR_GANGLN g
                JOIN HR_EMPLOYEE e ON e.EmpCode = g.GangMember
                WHERE g.GangCode IS NOT NULL AND g.GangCode != ''
            `;
            const params: any[] = [];

            if (division && DIVISION_PREFIX_MAP[division]) {
                const prefixes = DIVISION_PREFIX_MAP[division];
                const conditions = prefixes.map((p) => `UPPER(g.GangCode) LIKE ?`);
                sql += ` AND (${conditions.join(" OR ")})`;
                params.push(...prefixes.map(p => p + "%"));
            }

            sql += ` ORDER BY g.GangCode`;

            const rows = await this.db.query<{ GangCode: string }>(sql, params);
            let gangs = rows.map(r => r.GangCode?.trim()).filter(Boolean) as string[];

            // Fallback to history DB if origin returns 0
            if (gangs.length === 0) {
                console.log(`[EmployeeRepository] getAvailableGangs origin returned 0, falling back to history DB`);
                gangs = await this._getAvailableGangsFromHistory(division);
            }

            return gangs;
        } catch (e) {
            console.error("[EmployeeRepository] getAvailableGangs failed:", e);
            return [];
        }
    }

    private async _getAvailableGangsFromHistory(division?: string): Promise<string[]> {
        try {
            const histDb = this.getHistoryDb();
            let sql = `SELECT DISTINCT RTRIM(gang_code) AS gang_code FROM dbo.history_hr_employee WHERE gang_code IS NOT NULL AND RTRIM(gang_code) != ''`;
            const params: any[] = [];

            if (division) {
                const prefixes = DIVISION_PREFIX_MAP[division] || [];
                if (prefixes.length > 0) {
                    const conditions = prefixes.map(() => `UPPER(RTRIM(gang_code)) LIKE ?`);
                    sql += ` AND (${conditions.join(" OR ")})`;
                    params.push(...prefixes.map(p => p + "%"));
                }
            }

            sql += ` ORDER BY gang_code`;
            const rows = await histDb.query<{ gang_code: string }>(sql, params);
            return rows.map(r => r.gang_code?.trim()).filter(Boolean) as string[];
        } catch (e) {
            console.error("[EmployeeRepository] _getAvailableGangsFromHistory failed:", e);
            return [];
        }
    }

    /**
     * Get employees count by gang
     */
    public async getEmployeeCountByGang(gangCode: string): Promise<number> {
        try {
            const rows = await this.db.query<{ count: number }>(`
                SELECT COUNT(*) as count FROM HR_GANGLN WHERE GangCode = ?
            `, [gangCode.trim()]);
            const row = rows[0];
            return row?.count || 0;
        } catch (e) {
            return 0;
        }
    }

    /**
     * Search employees by name or NIK
     */
    public async search(term: string, limit: number = 50, division?: string): Promise<{ employees: Employee[]; dataSource: string }> {
        if (!term || term.length < 2) return { employees: [], dataSource: "origin" };

        try {
            let whereClause = `(e.EmpCode LIKE ? OR e.EmpName LIKE ? OR e.NewICNo LIKE ?)`;
            let params: any[] = [`%${term}%`, `%${term}%`, `%${term}%`];

            if (division && DIVISION_PREFIX_MAP[division]) {
                const prefixes = DIVISION_PREFIX_MAP[division];
                const conditions = prefixes.map(() => `UPPER(g.GangCode) LIKE ?`);
                whereClause = `(${whereClause}) AND (${conditions.join(" OR ")})`;
                prefixes.forEach(p => params.push(p + "%"));
            }

            const sql = `
                SELECT DISTINCT TOP ${limit}
                    e.EmpCode AS nik,
                    e.NewICNo AS actual_nik,
                    e.EmpName AS nama,
                    e.Gender AS jenis_kelamin,
                    e.LocCode AS loc_code,
                    g.GangCode AS gang_code,
                    e.Religion AS religion,
                    e.Status AS status,
                    e.HREmpType AS employee_type,
                    p.PayRate as upah_dasar,
                    CONVERT(VARCHAR, e.DOB, 23) AS birth_date
                FROM HR_EMPLOYEE e
                LEFT JOIN HR_GANGLN g ON g.GangMember = e.EmpCode
                LEFT JOIN HR_PAYROLL p ON p.EmpCode = e.EmpCode
                WHERE ${whereClause}
                ORDER BY e.EmpName
            `;
            const rows = await this.db.query<any>(sql, params);

            const originEmployees = rows.map((r: any) => ({
                nik: r.nik?.trim() || "",
                actual_nik: r.actual_nik?.trim() || r.nik?.trim() || "",
                nama: r.nama?.trim() || "",
                jenis_kelamin: mapGender(r.jenis_kelamin),
                loc_code: r.loc_code?.trim() || "",
                gang_code: r.gang_code?.trim() || "",
                religion: r.religion?.trim() || "",
                status: r.status?.trim() || "",
                employee_type: r.employee_type?.trim() || "",
                upah_dasar: r.upah_dasar || 0,
                birth_date: r.birth_date || undefined
            }));

            // Fallback to history DB if origin returns 0
            if (originEmployees.length === 0) {
                console.log(`[EmployeeRepository] search origin returned 0, falling back to history DB`);
                const histEmployees = await this._searchFromHistory(term, limit, division);
                return {
                    employees: histEmployees,
                    dataSource: histEmployees.length > 0 ? "history" : "origin"
                };
            }

            return { employees: originEmployees, dataSource: "origin" };
        } catch (e) {
            console.error("[EmployeeRepository] search failed:", e);
            return { employees: [], dataSource: "origin" };
        }
    }

    /**
     * Search from history database
     */
    private async _searchFromHistory(term: string, limit: number, division?: string): Promise<Employee[]> {
        try {
            const histDb = this.getHistoryDb();
            let params: any[] = [`%${term}%`, `%${term}%`, `%${term}%`];
            let whereClause = `(emp_code LIKE ? OR emp_name LIKE ? OR nik LIKE ?)`;

            if (division) {
                const prefixes = DIVISION_PREFIX_MAP[division] || [];
                if (prefixes.length > 0) {
                    const conditions = prefixes.map(() => `UPPER(RTRIM(gang_code)) LIKE ?`);
                    whereClause += ` AND (${conditions.join(" OR ")})`;
                    params.push(...prefixes.map(p => p + "%"));
                }
            }

            const sql = `
                SELECT TOP ${limit}
                    RTRIM(emp_code) AS nik,
                    RTRIM(nik) AS actual_nik,
                    emp_name AS nama,
                    gender AS jenis_kelamin,
                    RTRIM(loc_code) AS loc_code,
                    RTRIM(gang_code) AS gang_code,
                    RTRIM(religion) AS religion,
                    RTRIM(status) AS status,
                    RTRIM(employee_type) AS employee_type,
                    CONVERT(VARCHAR, birth_date, 23) AS birth_date
                FROM dbo.history_hr_employee
                WHERE ${whereClause}
                ORDER BY emp_name
            `;
            const rows = await histDb.query<any>(sql, params);
            return rows.map((r: any) => ({
                nik: r.nik?.trim() || "",
                actual_nik: r.actual_nik?.trim() || r.nik?.trim() || "",
                nama: r.nama?.trim() || "",
                jenis_kelamin: r.jenis_kelamin?.trim() || "L",
                loc_code: r.loc_code?.trim() || "",
                gang_code: r.gang_code?.trim() || "",
                religion: r.religion?.trim() || "",
                status: r.status?.trim() || "",
                employee_type: r.employee_type?.trim() || "",
                birth_date: r.birth_date || undefined
            }));
        } catch (e) {
            console.error("[EmployeeRepository] _searchFromHistory failed:", e);
            return [];
        }
    }
    /**
     * Get available religions for filter dropdown
     */
    public async getAvailableReligions(): Promise<string[]> {
        try {
            const rows = await this.db.query<{ Religion: string }>(`
                SELECT DISTINCT Religion FROM HR_EMPLOYEE
                WHERE Religion IS NOT NULL AND RTRIM(Religion) != ''
                ORDER BY Religion
            `);
            let religions = rows.map(r => r.Religion?.trim()).filter(Boolean) as string[];

            // Fallback to history DB if origin returns 0
            if (religions.length === 0) {
                religions = await this._getAvailableReligionsFromHistory();
            }

            return religions;
        } catch (e) {
            console.error("[EmployeeRepository] getAvailableReligions failed:", e);
            return [];
        }
    }

    private async _getAvailableReligionsFromHistory(): Promise<string[]> {
        try {
            const histDb = this.getHistoryDb();
            const rows = await histDb.query<{ religion: string }>(`
                SELECT DISTINCT RTRIM(religion) AS religion
                FROM dbo.history_hr_employee
                WHERE religion IS NOT NULL AND RTRIM(religion) != ''
                ORDER BY religion
            `);
            return rows.map(r => r.religion?.trim()).filter(Boolean) as string[];
        } catch (e) {
            console.error("[EmployeeRepository] _getAvailableReligionsFromHistory failed:", e);
            return [];
        }
    }

    /**
     * Get available statuses for filter dropdown
     */
    public async getAvailableStatuses(): Promise<string[]> {
        try {
            const rows = await this.db.query<{ Status: string }>(`
                SELECT DISTINCT Status FROM HR_EMPLOYEE
                WHERE Status IS NOT NULL AND RTRIM(Status) != ''
                ORDER BY Status
            `);
            let statuses = rows.map(r => r.Status?.trim()).filter(Boolean) as string[];

            // Fallback to history DB if origin returns 0
            if (statuses.length === 0) {
                statuses = await this._getAvailableStatusesFromHistory();
            }

            return statuses;
        } catch (e) {
            console.error("[EmployeeRepository] getAvailableStatuses failed:", e);
            return [];
        }
    }

    private async _getAvailableStatusesFromHistory(): Promise<string[]> {
        try {
            const histDb = this.getHistoryDb();
            const rows = await histDb.query<{ status: string }>(`
                SELECT DISTINCT RTRIM(status) AS status
                FROM dbo.history_hr_employee
                WHERE status IS NOT NULL AND RTRIM(status) != ''
                ORDER BY status
            `);
            return rows.map(r => r.status?.trim()).filter(Boolean) as string[];
        } catch (e) {
            console.error("[EmployeeRepository] _getAvailableStatusesFromHistory failed:", e);
            return [];
        }
    }
}

export const employeeRepository = EmployeeRepository.getInstance();
