
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
     * Ensure the table exists
     */
    static async initTable(): Promise<void> {
        const db = Database.getExtendedInstance();
        try {
            await db.query(`
                IF OBJECT_ID('employee_estate', 'U') IS NULL
                BEGIN
                    CREATE TABLE employee_estate (
                        empcode VARCHAR(50) PRIMARY KEY,
                        employee_name VARCHAR(255),
                        gang VARCHAR(50),
                        divisi_id VARCHAR(50),
                        jabatan VARCHAR(100),
                        updated_at DATETIME DEFAULT GETDATE()
                    )
                END
            `);
        } catch (error) {
            console.error('[EmployeeEstateService] Failed to init table:', error);
        }
    }

    /**
     * Save or update employee job titles in bulk
     */
    static async saveEmployeeJobs(jobs: EmployeeJobData[]): Promise<{ success: boolean; count: number }> {
        if (!jobs || jobs.length === 0) return { success: true, count: 0 };

        await this.initTable();
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
     * Update a single employee's job title
     */
    static async updateJobTitle(empCode: string, jobTitle: string): Promise<boolean> {
        await this.initTable();
        const db = Database.getExtendedInstance();

        // We might not have name/gang/divisi if updating from grid just for title.
        // So we merge, but if inserting new (unlikely if strictly updating), we might leave others null/empty
        // But usually we should have basic info. check logic.
        // Actually, if we just want to update JobTitle for existing map, we can use MERGE but with partial match or just UPDATE if exists?
        // But the requirement says "if not in database default to...".
        // Use MERGE. If not matched, insert with minimal info?

        try {
            await db.query(`
                MERGE INTO employee_estate AS target
                USING (SELECT ? AS empcode, ? AS jabatan) AS source
                ON (target.empcode = source.empcode)
                WHEN MATCHED THEN
                    UPDATE SET jabatan = source.jabatan, updated_at = GETDATE()
                WHEN NOT MATCHED THEN
                    INSERT (empcode, jabatan, updated_at)
                    VALUES (source.empcode, source.jabatan, GETDATE());
            `, [empCode, jobTitle]);
            return true;
        } catch (e) {
            console.error('[EmployeeEstateService] Update failed:', e);
            throw e;
        }
    }

    /**
     * Get all employee job titles mapping
     */
    static async getEmployeeJobs(): Promise<Record<string, string>> {
        await this.initTable();
        const db = Database.getExtendedInstance();

        // Return blank object if table query fails (soft fail)
        try {
            const rows = await db.query<{ empcode: string, jabatan: string }>(
                "SELECT empcode, jabatan FROM employee_estate"
            );

            const map: Record<string, string> = {};
            rows.forEach(r => {
                map[r.empcode] = r.jabatan;
            });
            return map;
        } catch (e) {
            console.warn('[EmployeeEstateService] Could not fetch jobs (first run?):', e);
            return {};
        }
    }
}
