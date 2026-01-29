
import { Database } from "../db/client";

export interface EmployeeJobData {
    empcode: string;
    employee_name: string;
    gang: string;
    divisi_id: string;
    jabatan: string;
}

export class EmployeeEstateService {

    /**
     * Save or update employee job titles in bulk
     */
    static async saveEmployeeJobs(jobs: EmployeeJobData[]): Promise<{ success: boolean; count: number }> {
        if (!jobs || jobs.length === 0) return { success: true, count: 0 };

        const db = Database.getExtendedInstance();

        // Use a transaction of upsert statements
        // Since SQL Gateway handles batching, we can construct a robust MERGE or simple upsert loop
        // Given SQL Server, MERGE is appropriate.

        const queries = jobs.map(job => {
            return {
                sql: `
                    MERGE INTO employee_estate AS target
                    USING (SELECT @empcode AS empcode) AS source
                    ON (target.empcode = source.empcode)
                    WHEN MATCHED THEN
                        UPDATE SET 
                            jabatan = @jabatan,
                            employee_name = @employee_name,
                            gang = @gang,
                            divisi_id = @divisi_id,
                            updated_at = GETDATE()
                    WHEN NOT MATCHED THEN
                        INSERT (empcode, employee_name, gang, divisi_id, jabatan, updated_at)
                        VALUES (@empcode, @employee_name, @gang, @divisi_id, @jabatan, GETDATE());
                `,
                params: {
                    empcode: job.empcode,
                    employee_name: job.employee_name,
                    gang: job.gang,
                    divisi_id: job.divisi_id,
                    jabatan: job.jabatan || 'Karyawan'
                }
            };
        });

        // Execute in batch/transaction
        const result = await db.transaction(queries);
        return { success: result, count: jobs.length };
    }

    /**
     * Get all employee job titles mapping
     */
    static async getEmployeeJobs(): Promise<Record<string, string>> {
        const db = Database.getExtendedInstance();
        const rows = await db.query<{ empcode: string, jabatan: string }>(
            "SELECT empcode, jabatan FROM employee_estate"
        );

        const map: Record<string, string> = {};
        rows.forEach(r => {
            map[r.empcode] = r.jabatan;
        });
        return map;
    }
}
