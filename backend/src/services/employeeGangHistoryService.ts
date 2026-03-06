import { Database } from "../db/client";

export interface EmployeeHistoryEntry {
    emp_code: string;
    nik: string;
    emp_name: string;
    gang_code: string;
    division_code: string;
    period_month: number;
    period_year: number;
    join_date?: string;
}

export class EmployeeGangHistoryService {
    private static instance: EmployeeGangHistoryService;
    private db: Database;
    private extendDb: Database;

    private constructor() {
        this.db = Database.getInstance();
        this.extendDb = Database.getExtendedInstance();
    }

    public static getInstance(): EmployeeGangHistoryService {
        if (!EmployeeGangHistoryService.instance) {
            EmployeeGangHistoryService.instance = new EmployeeGangHistoryService();
        }
        return EmployeeGangHistoryService.instance;
    }

    /**
     * Finds the latest EmpCode for a given NIK (NewICNo) from the live HR system.
     * This is the most reliable way to get the current active code.
     */
    public async getLatestEmpCodeByNik(nik: string): Promise<string | null> {
        try {
            const rows = await this.db.query<{ EmpCode: string }>(`
                SELECT TOP 1 RTRIM(e.EmpCode) as EmpCode
                FROM HR_EMPLOYEE e
                LEFT JOIN HR_EMPLOYMENT em ON e.EmpCode = em.EmpCode
                WHERE RTRIM(e.NewICNo) = ? OR RTRIM(e.EmpCode) = ?
                ORDER BY em.AppJoinDate DESC, e.EmpCode DESC
            `, [nik.trim(), nik.trim()]);

            return rows[0]?.EmpCode || null;
        } catch (e) {
            console.error(`[EmployeeGangHistoryService] Error getting latest emp code for ${nik}:`, e);
            return null;
        }
    }

    /**
     * Bulk resolves the latest EmpCodes for a list of NIKs, optionally considering gang assignments.
     * Returns a Map of NIK -> Latest/Correct EmpCode.
     */
    public async resolveLatestEmpCodes(niks: string[], preferredGangs?: Map<string, string>): Promise<Map<string, string>> {
        if (!niks || niks.length === 0) return new Map();

        const uniqueNiks = [...new Set(niks.map(n => n.trim().toUpperCase()).filter(Boolean))];
        const placeholders = uniqueNiks.map(() => '?').join(',');

        try {
            // Query includes Status and GangCode to help prioritization
            const rows = await this.db.query<{ NewICNo: string; EmpCode: string; Status: string; GangCode: string }>(`
                SELECT RTRIM(e.NewICNo) as NewICNo, RTRIM(e.EmpCode) as EmpCode, e.Status, RTRIM(gl.GangCode) as GangCode
                FROM HR_EMPLOYEE e
                LEFT JOIN HR_EMPLOYMENT em ON e.EmpCode = em.EmpCode
                LEFT JOIN HR_GANGLN gl ON e.EmpCode = gl.GangMember
                WHERE RTRIM(e.NewICNo) IN (${placeholders}) OR RTRIM(e.EmpCode) IN (${placeholders})
                ORDER BY 
                    CASE WHEN e.Status = '1' THEN 0 ELSE 1 END, -- Active first
                    em.AppJoinDate DESC, 
                    e.EmpCode DESC
            `, [...uniqueNiks, ...uniqueNiks]);

            const resultMap = new Map<string, string>();
            
            // First pass: Try to match by Gang if preferredGangs is provided
            if (preferredGangs) {
                rows.forEach(row => {
                    const nikKey = row.NewICNo?.trim().toUpperCase();
                    const prefGang = preferredGangs.get(nikKey);
                    if (nikKey && prefGang && row.GangCode === prefGang && !resultMap.has(nikKey)) {
                        resultMap.set(nikKey, row.EmpCode);
                    }
                });
            }

            // Second pass: Fill in remaining with best available (Status 1 + Latest Date)
            rows.forEach(row => {
                const nikKey = row.NewICNo?.trim().toUpperCase();
                if (nikKey && !resultMap.has(nikKey)) {
                    resultMap.set(nikKey, row.EmpCode);
                }
                const empKey = row.EmpCode?.trim().toUpperCase();
                if (empKey && !resultMap.has(empKey)) {
                    resultMap.set(empKey, row.EmpCode);
                }
            });

            return resultMap;
        } catch (e) {
            console.error(`[EmployeeGangHistoryService] Bulk resolve error:`, e);
            return new Map();
        }
    }

    /**
     * Gets the gang history for a specific person (by NIK or EmpCode) 
     * from the historical tables.
     */
    public async getGangHistory(identifier: string): Promise<EmployeeHistoryEntry[]> {
        try {
            const rows = await this.extendDb.query<EmployeeHistoryEntry>(`
                SELECT 
                    emp_code, nik, emp_name, gang_code, division_code, 
                    period_month, period_year, join_date
                FROM dbo.history_gang_member
                WHERE RTRIM(nik) = ? OR RTRIM(emp_code) = ?
                ORDER BY period_year DESC, period_month DESC
            `, [identifier.trim(), identifier.trim()]);

            return rows;
        } catch (e) {
            console.error(`[EmployeeGangHistoryService] Error getting gang history for ${identifier}:`, e);
            return [];
        }
    }

    /**
     * Gets the latest known gang and emp_code for an employee from history.
     */
    public async getLatestHistoryRecord(identifier: string): Promise<EmployeeHistoryEntry | null> {
        const history = await this.getGangHistory(identifier);
        return history[0] || null;
    }
    /**
     * Finds all EmpCodes ever used by a person, identified by their NIK (NewICNo).
     */
    public async getAllEmpCodesByNik(nik: string): Promise<string[]> {
        try {
            const rows = await this.db.query<{ EmpCode: string }>(`
                SELECT DISTINCT RTRIM(EmpCode) as EmpCode
                FROM HR_EMPLOYEE
                WHERE RTRIM(NewICNo) = ? OR RTRIM(EmpCode) = ?
            `, [nik.trim(), nik.trim()]);

            return rows.map(r => r.EmpCode);
        } catch (e) {
            console.error(`[EmployeeGangHistoryService] Error getting all emp codes for ${nik}:`, e);
            return [];
        }
    }

    /**
     * Gets the current "Official" EmpCode and Gang for a person.
     * Checks HR_EMPLOYMENT for the latest active record.
     */
    public async getCurrentOfficialInfo(nik: string): Promise<{ emp_code: string; gang_code: string; division_code: string } | null> {
        try {
            const rows = await this.db.query<any>(`
                SELECT TOP 1 
                    RTRIM(e.EmpCode) as emp_code, 
                    RTRIM(gl.GangCode) as gang_code,
                    RTRIM(e.LocCode) as division_code
                FROM HR_EMPLOYEE e
                LEFT JOIN HR_EMPLOYMENT em ON e.EmpCode = em.EmpCode
                LEFT JOIN HR_GANGLN gl ON e.EmpCode = gl.GangMember
                WHERE RTRIM(e.NewICNo) = ? OR RTRIM(e.EmpCode) = ?
                ORDER BY em.AppJoinDate DESC, e.EmpCode DESC
            `, [nik.trim(), nik.trim()]);

            if (rows.length === 0) return null;
            return {
                emp_code: rows[0].emp_code,
                gang_code: rows[0].gang_code || 'N/A',
                division_code: rows[0].division_code || 'N/A'
            };
        } catch (e) {
            return null;
        }
    }
}

export const employeeGangHistoryService = EmployeeGangHistoryService.getInstance();
