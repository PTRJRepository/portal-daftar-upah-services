import { Database } from "../db/client";
import { cacheService } from "./cacheService";

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
    } = {}): Promise<Employee[]> {
        const { skip = 0, limit = 100, gangCode, locCode, division, religion, status } = options;

        try {
            console.log(`[EmployeeRepository] list() called with:`, { gangCode, division, religion, status, skip, limit });
            const gc = gangCode?.trim().toUpperCase() || null;

            let employees: Employee[] = [];

            console.log(`[EmployeeRepository] gc=${gc}, going to ${gc === "ALL" || !gc ? "ALL" : "SPECIFIC"} branch`);

            if (gc === "ALL" || !gc) {
                // Fetch all or by division
                let params: any[] = [];
                let whereClause = "";

                if (division && DIVISION_PREFIX_MAP[division]) {
                    const prefixes = DIVISION_PREFIX_MAP[division];
                    const conditions = prefixes.map((p, i) => `UPPER(g.GangCode) LIKE ?`);
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
                employees = rows.map((r: any) => ({
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
                // Specific gang
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

                employees = rows.map((r: any) => ({
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

            console.log(`[EmployeeRepository] Query returned ${rows.length} raw rows`);
            // Apply pagination
            const result = employees.slice(skip, skip + limit);
            console.log(`[EmployeeRepository] Returning ${result.length} employees`);
            return result;
        } catch (e) {
            console.error("[EmployeeRepository] list failed:", e);
            return [];
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
        const cacheKey = division ? `available_gangs_${division}` : "available_gangs_all";
        const cached = cacheService.get<string[]>(cacheKey);
        if (cached) return cached;

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
            const gangs = rows.map(r => r.GangCode?.trim()).filter(Boolean) as string[];
            cacheService.set(cacheKey, gangs, 300);
            return gangs;
        } catch (e) {
            console.error("[EmployeeRepository] getAvailableGangs failed:", e);
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
    public async search(term: string, limit: number = 50, division?: string): Promise<Employee[]> {
        if (!term || term.length < 2) return [];

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

            return rows.map((r: any) => ({
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
        } catch (e) {
            console.error("[EmployeeRepository] search failed:", e);
            return [];
        }
    }
    /**
     * Get available religions for filter dropdown
     */
    public async getAvailableReligions(): Promise<string[]> {
        const cacheKey = "available_religions";
        const cached = cacheService.get<string[]>(cacheKey);
        if (cached) return cached;

        try {
            const rows = await this.db.query<{ Religion: string }>(`
                SELECT DISTINCT Religion FROM HR_EMPLOYEE
                WHERE Religion IS NOT NULL AND RTRIM(Religion) != ''
                ORDER BY Religion
            `);
            const religions = rows.map(r => r.Religion?.trim()).filter(Boolean) as string[];
            cacheService.set(cacheKey, religions, 600);
            return religions;
        } catch (e) {
            console.error("[EmployeeRepository] getAvailableReligions failed:", e);
            return [];
        }
    }

    /**
     * Get available statuses for filter dropdown
     */
    public async getAvailableStatuses(): Promise<string[]> {
        const cacheKey = "available_statuses";
        const cached = cacheService.get<string[]>(cacheKey);
        if (cached) return cached;

        try {
            const rows = await this.db.query<{ Status: string }>(`
                SELECT DISTINCT Status FROM HR_EMPLOYEE
                WHERE Status IS NOT NULL AND RTRIM(Status) != ''
                ORDER BY Status
            `);
            const statuses = rows.map(r => r.Status?.trim()).filter(Boolean) as string[];
            cacheService.set(cacheKey, statuses, 600);
            return statuses;
        } catch (e) {
            console.error("[EmployeeRepository] getAvailableStatuses failed:", e);
            return [];
        }
    }
}

export const employeeRepository = EmployeeRepository.getInstance();
