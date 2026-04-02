
import { Database } from "../db/client";

/**
 * IMPORTANT: DATA APPEND-ONLY PATTERN RULES (Immutable History)
 *
 * PRINSIP: Sistem TIDAK menimpa atau mengedit data existing. Selalu tambahkan record baru.
 *
 * PENERAPAN:
 * 1. NIK (empcode) TIDAK BISA di-update - Jika empcode sudah ada di database,
 *    JANGAN update meskipun nilainya berubah di Plantware/db_ptrj.
 *    Data lama tetap disimpan untuk histori.
 * 2. Hanya INSERT data baru jika empcode belum ada.
 * 3. Untuk tracking perubahan, pertimbangkan menambahkan version_index atau history table.
 *
 * Kenapa penting:
 * - NIK adalah identifier utama karyawan - tidak boleh berubah
 * - History data karyawan tetap utuh
 * - Audit trail lengkap untuk semua perubahan data
 */

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
                IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'employee_estate')
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

                IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'history_employee_jabatan_changelog')
                BEGIN
                    CREATE TABLE history_employee_jabatan_changelog (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        empcode VARCHAR(50) NOT NULL,
                        jabatan_lama VARCHAR(100) NULL,
                        jabatan_baru VARCHAR(100) NOT NULL,
                        changed_at DATETIME DEFAULT GETDATE(),
                        changed_by VARCHAR(100) NULL
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
            // Always trim all fields to handle spaces in identifiers
            const empcode = (job.empcode || '').trim();
            const jabatan = (job.jabatan || 'karyawan panen').trim();
            const employee_name = (job.employee_name || '').trim();
            const gang = (job.gang || '').trim();
            const divisi_id = (job.divisi_id || '').trim();

            return {
                sql: `
                    MERGE INTO employee_estate AS target
                    USING (SELECT ? AS empcode) AS source
                    ON (RTRIM(target.empcode) = RTRIM(source.empcode))
                    WHEN MATCHED THEN
                        UPDATE SET
                            jabatan = ?,
                            employee_name = ?,
                            gang = ?,
                            divisi_id = ?,
                            updated_at = GETDATE()
                    WHEN NOT MATCHED THEN
                        INSERT (empcode, employee_name, gang, divisi_id, jabatan, updated_at)
                        VALUES (?, ?, ?, ?, ?, GETDATE());
                `,
                params: [
                    empcode,
                    jabatan,
                    employee_name,
                    gang,
                    divisi_id,
                    empcode,
                    employee_name,
                    gang,
                    divisi_id,
                    jabatan
                ]
            };
        });

        // Execute in batch/transaction
        const result = await db.transaction(queries);
        return { success: result, count: jobs.length };
    }

    /**
     * Update a single employee's job title
     */
    static async updateJobTitle(rawEmpCode: string, jobTitle: string, changedBy: string = 'system'): Promise<boolean> {
        await this.initTable();
        const db = Database.getExtendedInstance();

        // Always trim to handle spaces in input
        const empCode = (rawEmpCode || '').trim();
        const jabatan = (jobTitle || '').trim();

        try {
            // First get the old job title
            const oldRecord = await db.query<{ jabatan: string }>(
                "SELECT jabatan FROM employee_estate WHERE RTRIM(empcode) = ?",
                [empCode]
            );
            const jabatanLama = oldRecord.length > 0 ? (oldRecord[0].jabatan || '').trim() : null;

            // Save to history changelog if it actually changed or is new
            if (jabatanLama !== jabatan) {
                await db.query(`
                    INSERT INTO history_employee_jabatan_changelog
                    (empcode, jabatan_lama, jabatan_baru, changed_by)
                    VALUES (?, ?, ?, ?)
                `, [empCode, jabatanLama, jabatan, changedBy]);
            }

            await db.query(`
                MERGE INTO employee_estate AS target
                USING (SELECT ? AS empcode, ? AS jabatan) AS source
                ON (RTRIM(target.empcode) = RTRIM(source.empcode))
                WHEN MATCHED THEN
                    UPDATE SET jabatan = source.jabatan, updated_at = GETDATE()
                WHEN NOT MATCHED THEN
                    INSERT (empcode, jabatan, updated_at)
                    VALUES (source.empcode, source.jabatan, GETDATE());
            `, [empCode, jabatan]);
            return true;
        } catch (e) {
            console.error(`[EmployeeEstateService] Update failed for '${rawEmpCode}':`, e);
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
                // Always trim empcode and jabatan to handle spaces in data
                map[(r.empcode || '').trim()] = (r.jabatan || '').trim();
            });
            return map;
        } catch (e) {
            console.warn('[EmployeeEstateService] Could not fetch jobs (first run?):', e);
            return {};
        }
    }
}
