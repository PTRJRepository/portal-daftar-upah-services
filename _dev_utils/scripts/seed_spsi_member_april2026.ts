/**
 * Initial SPSI Member Seeder
 *
 * SEEDER INIT - JALANKAN SEKALI SAJA
 *
 * Fungsi:
 * - Cek employee yang punya potongan SPSI di bulan Maret 2026
 * - Update atau insert history_hr_employee untuk April 2026 dengan is_spsi_member = true
 * - Also update payroll_history_detail jika sudah ada seeded data untuk April 2026
 *
 * Logika bisnis:
 * - Jika employee punya potongan SPSI di bulan Maret, maka di April dianggap sbg anggota SPSI
 */

import { Database } from "../../backend/src/db/client";
import { Config } from "../../backend/src/config";

const MARCH_YEAR = 2026;
const MARCH_MONTH = 3;
const APRIL_YEAR = 2026;
const APRIL_MONTH = 4;

async function getSpsiMembersFromMarch(): Promise<Set<string>> {
    const db = Database.getInstance(); // Main db_ptrj
    const spsiMembers = new Set<string>();

    // Query employee dengan SPSI deduction di Maret 2026
    const sql = `
        SELECT DISTINCT RTRIM(t.EmpCode) as emp_code
        FROM PR_ADTRANS t
        JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
        WHERE t.DocDate >= '2026-03-01' AND t.DocDate < '2026-04-01'
          AND (UPPER(t.DocDesc) LIKE '%SPSI%' OR ln.TaskCode LIKE 'GA9112%')
        UNION
        SELECT DISTINCT RTRIM(t.EmpCode) as emp_code
        FROM PR_ADTRANS_ARC t
        JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
        WHERE t.DocDate >= '2026-03-01' AND t.DocDate < '2026-04-01'
          AND (UPPER(t.DocDesc) LIKE '%SPSI%' OR ln.TaskCode LIKE 'GA9112%')
    `;

    const rows = await db.query<{ emp_code: string }>(sql);
    for (const row of rows) {
        spsiMembers.add(row.emp_code?.trim().toUpperCase());
    }

    return spsiMembers;
}

async function updateAprilHistoryHrEmployee(spsiMembers: Set<string>): Promise<number> {
    const extendDb = Database.getExtendedInstance();
    let updated = 0;

    // Ambil semua existing history_hr_employee untuk April 2026
    const existingSql = `
        SELECT id, emp_code, nik, period_month, period_year
        FROM dbo.history_hr_employee
        WHERE period_month = ${APRIL_MONTH} AND period_year = ${APRIL_YEAR}
    `;
    const existingRows = await extendDb.query<{ id: number; emp_code: string }>(existingSql);

    for (const row of existingRows) {
        const empCode = row.emp_code?.trim().toUpperCase();
        if (spsiMembers.has(empCode)) {
            // Get jabatan from employee_estate
            const estateRows = await extendDb.query<{ jabatan: string }>(`
                SELECT TOP 1 jabatan FROM dbo.employee_estate WHERE RTRIM(empcode) = ?
            `, [empCode]);
            const jabatan = estateRows[0]?.jabatan?.trim() || null;

            // Update is_spsi_member = 1 dan jabatan untuk employee yang ada di list SPSI
            await extendDb.query(`
                UPDATE dbo.history_hr_employee
                SET is_spsi_member = 1, jabatan = ?
                WHERE id = ?
            `, [jabatan, row.id]);
            updated++;
            console.log(`  ✓ Updated history_hr_employee for emp_code: ${empCode} (jabatan: ${jabatan || 'null'})`);
        }
    }

    return updated;
}

async function insertNewAprilHistoryHrEmployee(spsiMembers: Set<string>): Promise<number> {
    const extendDb = Database.getExtendedInstance();
    const db = Database.getInstance(); // Main db_ptrj for HR_EMPLOYEE
    let inserted = 0;

    // Ambil semua employee dari HR_EMPLOYEE yang aktif di gang - QUERY DARI DATABASE UTAMA
    const employeeSql = `
        SELECT DISTINCT e.EmpCode as emp_code, e.NewICNo as nik
        FROM HR_EMPLOYEE e
        JOIN HR_GANGLN gl ON e.EmpCode = gl.GangMember
        JOIN HR_GANG g ON gl.GangCode = g.GangCode
        WHERE g.LocCode IS NOT NULL
    `;
    const employees = await db.query<{ emp_code: string; nik: string }>(employeeSql);

    for (const emp of employees) {
        const empCode = emp.emp_code?.trim().toUpperCase();
        const nik = emp.nik?.trim().toUpperCase() || '';

        // Hanya insert jika employee ada di list SPSI dan belum ada di history_hr_employee April 2026
        if (spsiMembers.has(empCode)) {
            // Check if already exists
            const existing = await extendDb.queryOne<{ id: number }>(`
                SELECT id FROM dbo.history_hr_employee
                WHERE period_month = ${APRIL_MONTH} AND period_year = ${APRIL_YEAR}
                  AND emp_code = ?
            `, [empCode]);

            if (!existing) {
                // Get employee details from main db
                const empDetail = await db.queryOne<any>(`
                    SELECT e.EmpCode, e.EmpName, e.NewICNo as nik, e.Status, e.HREmpType, e.Gender, e.Religion,
                           e.PlaceOfBirth, e.DOB, e.MaritalStatus,
                           em.CompCode, em.AppJoinGrpDate, em.TerminateDate,
                           g.GangCode, g.LocCode,
                           p.PayRate, CAST(p.RiceRation AS VARCHAR) as RiceRation
                    FROM HR_EMPLOYEE e
                    JOIN HR_EMPLOYMENT em ON e.EmpCode = em.EmpCode
                    LEFT JOIN HR_GANGLN gl ON e.EmpCode = gl.GangMember
                    LEFT JOIN HR_GANG g ON gl.GangCode = g.GangCode
                    LEFT JOIN HR_PAYROLL p ON RTRIM(p.EmpCode) = RTRIM(e.EmpCode)
                    WHERE e.EmpCode = ?
                `, [empCode]);

                // Get jabatan from employee_estate
                const estateRows = await extendDb.query<{ jabatan: string }>(`
                    SELECT TOP 1 jabatan FROM dbo.employee_estate WHERE RTRIM(empcode) = ?
                `, [empCode]);
                const jabatan = estateRows[0]?.jabatan?.trim() || null;

                if (empDetail) {
                    // Insert new record for April 2026
                    await extendDb.query(`
                        INSERT INTO dbo.history_hr_employee (
                            history_id, period_month, period_year, nik, emp_code, emp_name,
                            company_code, division_code, loc_code, gang_code,
                            jabatan, is_spsi_member, join_date, terminate_date, status,
                            employee_type, gender, religion, birth_place, birth_date,
                            marital_status, tax_status, ptkp_beras, ptkp_pajak,
                            upah_dasar, total_hk, source_table
                        ) VALUES (
                            'SPSI-INIT-' + CONVERT(VARCHAR, 12) + '-' + CONVERT(VARCHAR, GETDATE(), 112),
                            ${APRIL_MONTH}, ${APRIL_YEAR}, ?, ?, ?,
                            ?, ?, ?, ?,
                            ?, 1, ?, ?, ?,
                            ?, ?, ?, ?, ?,
                            ?, NULL, ?, NULL,
                            ?, 0, 'HR_EMPLOYEE_SPSI_INIT'
                        )
                    `, [
                        empDetail.NewICNo?.trim() || empCode,
                        empCode,
                        empDetail.EmpName?.trim(),
                        empDetail.CompCode?.trim() || null,
                        empDetail.LocCode?.trim() || null,
                        empDetail.LocCode?.trim() || null,
                        empDetail.GangCode?.trim() || null,
                        jabatan,
                        empDetail.AppJoinGrpDate || null,
                        empDetail.TerminateDate || null,
                        empDetail.Status?.trim() || null,
                        empDetail.HREmpType?.trim() || null,
                        empDetail.Gender?.trim() || null,
                        empDetail.Religion?.trim() || null,
                        empDetail.PlaceOfBirth?.trim() || null,
                        empDetail.DOB || null,
                        empDetail.MaritalStatus?.trim() || null,
                        empDetail.RiceRation?.trim() || null,
                        empDetail.PayRate || 0
                    ]);
                    inserted++;
                    console.log(`  + Inserted new history_hr_employee for emp_code: ${empCode} (jabatan: ${jabatan || 'null'})`);
                }
            }
        }
    }

    return inserted;
}

async function updatePayrollHistoryDetail(spsiMembers: Set<string>): Promise<number> {
    const extendDb = Database.getExtendedInstance();
    let updated = 0;

    // Get all payroll_history_detail for April 2026
    const detailSql = `
        SELECT d.id, d.emp_code, d.master_id
        FROM dbo.payroll_history_detail d
        JOIN dbo.payroll_history_header h ON d.master_id = h.id
        WHERE h.period_month = ${APRIL_MONTH} AND h.period_year = ${APRIL_YEAR}
    `;
    const details = await extendDb.query<{ id: number; emp_code: string; master_id: number }>(detailSql);

    for (const detail of details) {
        const empCode = detail.emp_code?.trim().toUpperCase();
        if (spsiMembers.has(empCode)) {
            await extendDb.query(`
                UPDATE dbo.payroll_history_detail
                SET is_spsi_member = 1
                WHERE id = ?
            `, [detail.id]);
            updated++;
        }
    }

    return updated;
}

async function run() {
    console.log("=".repeat(60));
    console.log("SPSI Member Initial Seeder - APRIL 2026");
    console.log("=".repeat(60));
    console.log("");
    console.log("Langkah 1: Mencari employee dengan potongan SPSI di Maret 2026...");
    const spsiMembers = await getSpsiMembersFromMarch();
    console.log(`  Ditemukan ${spsiMembers.size} employee dengan potongan SPSI:`);
    let count = 0;
    for (const emp of spsiMembers) {
        if (count < 20) console.log(`    - ${emp}`);
        count++;
    }
    if (spsiMembers.size > 20) console.log(`    ... and ${spsiMembers.size - 20} more`);
    console.log("");

    if (spsiMembers.size === 0) {
        console.log("Tidak ada employee dengan potongan SPSI di Maret 2026. Stop.");
        return;
    }

    console.log("Langkah 2: Update history_hr_employee April 2026 yang sudah ada...");
    const updated = await updateAprilHistoryHrEmployee(spsiMembers);
    console.log(`  Updated ${updated} records`);
    console.log("");

    console.log("Langkah 3: Insert new history_hr_employee untuk employee SPSI yang belum ada...");
    const inserted = await insertNewAprilHistoryHrEmployee(spsiMembers);
    console.log(`  Inserted ${inserted} new records`);
    console.log("");

    console.log("Langkah 4: Update payroll_history_detail April 2026...");
    const detailUpdated = await updatePayrollHistoryDetail(spsiMembers);
    console.log(`  Updated ${detailUpdated} payroll detail records`);
    console.log("");

    console.log("=".repeat(60));
    console.log("COMPLETED!");
    console.log(`  - Total SPSI members from March: ${spsiMembers.size}`);
    console.log(`  - Updated existing history_hr_employee: ${updated}`);
    console.log(`  - Inserted new history_hr_employee: ${inserted}`);
    console.log(`  - Updated payroll_history_detail: ${detailUpdated}`);
    console.log("=".repeat(60));
}

run().catch(console.error);
