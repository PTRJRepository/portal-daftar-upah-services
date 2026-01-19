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
    "AREC": ["J"],
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
    } = {}): Promise<Employee[]> {
        const { skip = 0, limit = 100, gangCode, locCode, division } = options;

        try {
            const gc = gangCode?.trim().toUpperCase() || null;

            let employees: Employee[] = [];

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

                const placeholders = params.map((_, i) => `?`).join(", ");
                const sql = `
                    SELECT DISTINCT
                        e.EmpCode AS nik,
                        e.EmpName AS nama,
                        e.Gender AS jenis_kelamin,
                        e.LocCode AS loc_code,
                        g.GangCode AS gang_code,
                        p.PayRate as upah_dasar
                    FROM HR_EMPLOYEE e
                    JOIN HR_GANGLN g ON g.GangMember = e.EmpCode
                    LEFT JOIN HR_PAYROLL p ON p.EmpCode = e.EmpCode
                    ${whereClause}
                    ORDER BY e.EmpName
                `;

                const rows = await this.db.query<any>(sql, params);
                employees = rows.map((r: any) => ({
                    nik: r.nik?.trim() || "",
                    nama: r.nama?.trim() || "",
                    jenis_kelamin: mapGender(r.jenis_kelamin),
                    loc_code: r.loc_code?.trim() || "",
                    gang_code: r.gang_code?.trim() || "",
                    upah_dasar: r.upah_dasar || 0
                }));
            } else {
                // Specific gang
                const rows = await this.db.query<any>(`
                    SELECT DISTINCT
                        e.EmpCode AS nik,
                        e.EmpName AS nama,
                        e.Gender AS jenis_kelamin,
                        e.LocCode AS loc_code,
                        g.GangCode AS gang_code,
                        p.PayRate as upah_dasar
                    FROM HR_EMPLOYEE e
                    JOIN HR_GANGLN g ON g.GangMember = e.EmpCode
                    LEFT JOIN HR_PAYROLL p ON p.EmpCode = e.EmpCode
                    WHERE g.GangCode = ?
                    ORDER BY e.EmpName
                `, [gc]);

                employees = rows.map((r: any) => ({
                    nik: r.nik?.trim() || "",
                    nama: r.nama?.trim() || "",
                    jenis_kelamin: mapGender(r.jenis_kelamin),
                    loc_code: r.loc_code?.trim() || "",
                    gang_code: r.gang_code?.trim() || gc || "",
                    upah_dasar: r.upah_dasar || 0
                }));
            }

            // Apply locCode filter if specified
            if (locCode) {
                const lcClean = locCode.trim().toUpperCase();
                employees = employees.filter(e => e.loc_code.toUpperCase() === lcClean);
            }

            // Apply pagination
            return employees.slice(skip, skip + limit);
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
     * Get available gang codes
     */
    public async getAvailableGangs(): Promise<string[]> {
        const cacheKey = "available_gangs";
        const cached = cacheService.get<string[]>(cacheKey);
        if (cached) return cached;

        try {
            const rows = await this.db.query<{ GangCode: string }>(`
                SELECT DISTINCT GangCode FROM HR_GANGLN
                WHERE GangCode IS NOT NULL AND GangCode != ''
                ORDER BY GangCode
            `);
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
    public async search(term: string, limit: number = 50): Promise<Employee[]> {
        if (!term || term.length < 2) return [];

        try {
            const rows = await this.db.query<any>(`
                SELECT DISTINCT TOP ${limit}
                    e.EmpCode AS nik,
                    e.EmpName AS nama,
                    e.Gender AS jenis_kelamin,
                    e.LocCode AS loc_code,
                    g.GangCode AS gang_code
                FROM HR_EMPLOYEE e
                LEFT JOIN HR_GANGLN g ON g.GangMember = e.EmpCode
                WHERE e.EmpCode LIKE ? OR e.EmpName LIKE ?
                ORDER BY e.EmpName
            `, [`%${term}%`, `%${term}%`]);

            return rows.map((r: any) => ({
                nik: r.nik?.trim() || "",
                nama: r.nama?.trim() || "",
                jenis_kelamin: mapGender(r.jenis_kelamin),
                loc_code: r.loc_code?.trim() || "",
                gang_code: r.gang_code?.trim() || ""
            }));
        } catch (e) {
            console.error("[EmployeeRepository] search failed:", e);
            return [];
        }
    }
}

export const employeeRepository = EmployeeRepository.getInstance();
