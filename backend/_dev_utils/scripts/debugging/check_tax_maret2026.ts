/**
 * Debug script untuk cek kenapa data pajak tidak tampil di report-pajak
 * Untuk Maret 2026
 */
import { Database } from "../../../src/db/client";

async function main() {
    console.log("=== DEBUG: Cek Data Pajak Maret 2026 ===\n");

    const db = Database.getInstance('extend_db_ptrj', 'SERVER_PROFILE_1');

    // 1. Cek header
    console.log("1. Headers untuk Maret 2026:");
    const allHeaders = await db.query(`
        SELECT h.id, h.gang_code, h.division_code, COUNT(d.id) as detail_count
        FROM dbo.payroll_history_header h
        LEFT JOIN dbo.payroll_history_detail d ON d.master_id = h.id
        WHERE h.period_month = 3 AND h.period_year = 2026
        GROUP BY h.id, h.gang_code, h.division_code
    `);
    console.log("   Total headers:", allHeaders.length);
    console.log("   Sample:", allHeaders.slice(0, 5));

    // 2. Cek total record dengan pph21_ter > 0
    console.log("\n2. Total pph21_ter di history_detail:");
    const total = await db.query(`
        SELECT
            COUNT(*) as total,
            SUM(pph21_ter) as total_pph21,
            SUM(CASE WHEN pph21_ter > 0 THEN 1 ELSE 0 END) as rows_with_pph21
        FROM dbo.payroll_history_detail d
        WHERE master_id IN (SELECT id FROM dbo.payroll_history_header WHERE period_month = 3 AND period_year = 2026)
    `);
    console.log("   ", total[0]);

    // 3. Cek distribusi per division_code di detail
    console.log("\n3. Distribusi per d.division_code di detail:");
    const byDiv = await db.query(`
        SELECT d.division_code, COUNT(*) as cnt, SUM(pph21_ter) as total_pph21
        FROM dbo.payroll_history_detail d
        WHERE master_id IN (SELECT id FROM dbo.payroll_history_header WHERE period_month = 3 AND period_year = 2026)
        GROUP BY d.division_code
        ORDER BY total_pph21 DESC
    `);
    byDiv.forEach((r: any) => {
        console.log(`   ${r.division_code}: ${r.cnt} rows, Rp ${Math.round(r.total_pph21 || 0).toLocaleString()}`);
    });

    // 4. Sample 5 employee dengan pph21_ter terbesar
    console.log("\n4. Top 5 employees dengan pph21_ter tertinggi:");
    const top5 = await db.query(`
        SELECT TOP 5 emp_code, nik, emp_name, gang_code, d.division_code, pph21_ter, pot_pph21, penghasilan_bruto
        FROM dbo.payroll_history_detail d
        WHERE master_id IN (SELECT id FROM dbo.payroll_history_header WHERE period_month = 3 AND period_year = 2026)
        AND pph21_ter > 0
        ORDER BY pph21_ter DESC
    `);
    top5.forEach((r: any) => {
        console.log(`   ${r.emp_code} | ${r.emp_name} | Gang: ${r.gang_code} | Div: ${r.division_code} | PPh21: Rp ${Math.round(r.pph21_ter).toLocaleString()}`);
    });

    // 5. Cek apakah ada filter division_code yang salah di query
    console.log("\n5. Simulasi query dengan division_code='P1A' (seperti di data):");
    const p1aData = await db.query(`
        SELECT COUNT(*) as cnt, SUM(pph21_ter) as total
        FROM dbo.payroll_history_detail d
        WHERE master_id IN (SELECT id FROM dbo.payroll_history_header WHERE period_month = 3 AND period_year = 2026)
        AND d.division_code = 'P1A'
    `);
    console.log("   P1A:", p1aData[0]);

    // 6. Cek apakah ada filter yang salah ketika division='ALL'
    console.log("\n6. Jika frontend pakai division='ALL' tanpa gang filter:");
    const allData = await db.query(`
        SELECT COUNT(*) as cnt, SUM(pph21_ter) as total
        FROM dbo.payroll_history_detail d
        WHERE master_id IN (SELECT id FROM dbo.payroll_history_header WHERE period_month = 3 AND period_year = 2026 AND division_code = 'ALL')
    `);
    console.log("   ALL div, ALL gang:", allData[0]);

    console.log("\n=== END ===");
}

main().catch(console.error);
