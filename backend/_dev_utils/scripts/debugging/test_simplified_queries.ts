import { Database } from "../../../src/db/client";

async function main() {
    const db = Database.getExtendedInstance();

    console.log("=== Testing Simplified Queries (No version_index) ===\n");

    // Test 1: Gang comparison (getGangComparison equivalent)
    console.log("1. Gang Comparison Query (March 2026):");
    try {
        const rows = await db.query(`
            SELECT TOP 5
                agg.gang_code,
                RTRIM(g.Description) as gang_description,
                SUM(ISNULL(agg.total_upah_bersih, 0)) as total_wage,
                SUM(ISNULL(agg.total_hk, 0)) as total_hk,
                SUM(ISNULL(agg.total_employees, 0)) as headcount
            FROM dbo.daftar_upah_aggregation_history agg
            LEFT JOIN db_ptrj.dbo.HR_GANG g ON RTRIM(agg.gang_code) = RTRIM(g.GangCode)
            WHERE agg.period_month = 3 AND agg.period_year = 2026
            GROUP BY agg.gang_code, g.Description
            HAVING SUM(ISNULL(agg.total_employees, 0)) >= 0
            ORDER BY total_wage DESC
        `, []);
        console.log(`   SUCCESS: ${rows.length} rows`);
        rows.forEach((r: any) => console.log(`   - ${r.gang_code}: ${r.headcount} emp, Rp ${r.total_wage?.toLocaleString('id-ID')}`));
    } catch (e: any) {
        console.log(`   ERROR: ${e.message}`);
    }

    // Test 2: Division breakdown (getDivisionBreakdown equivalent)
    console.log("\n2. Division Breakdown Query (March 2026):");
    try {
        const rows = await db.query(`
            SELECT
                h.division_code,
                SUM(ISNULL(h.total_upah_bersih, 0)) as total_wage,
                SUM(ISNULL(h.total_lembur, 0)) as total_ot,
                SUM(ISNULL(h.total_employees, 0)) as headcount
            FROM dbo.daftar_upah_aggregation_history h
            WHERE h.period_month = 3 AND h.period_year = 2026
            GROUP BY h.division_code
            ORDER BY total_wage DESC
        `, []);
        console.log(`   SUCCESS: ${rows.length} rows`);
        rows.forEach((r: any) => console.log(`   - ${r.division_code}: ${r.headcount} emp, Rp ${r.total_wage?.toLocaleString('id-ID')}`));
    } catch (e: any) {
        console.log(`   ERROR: ${e.message}`);
    }

    // Test 3: Filter options divisions (getFilterOptions equivalent)
    console.log("\n3. Available Divisions (March 2026):");
    try {
        const rows = await db.query(`
            SELECT DISTINCT h.division_code
            FROM dbo.daftar_upah_aggregation_history h
            WHERE h.period_month = 3 AND h.period_year = 2026
            ORDER BY h.division_code
        `, []);
        console.log(`   SUCCESS: ${rows.length} divisions`);
        console.log(`   Divisions: ${rows.map((r: any) => r.division_code).join(', ')}`);
    } catch (e: any) {
        console.log(`   ERROR: ${e.message}`);
    }

    // Test 4: All divisions recap (wagesRoutes recap-all equivalent)
    console.log("\n4. Wages Recap All (March 2026):");
    try {
        const rows = await db.query(`
            SELECT
                division_code,
                SUM(total_employees) as total_karyawan,
                SUM(total_hk) as total_hk,
                SUM(total_upah_pokok) as total_upah_pokok,
                SUM(total_tunjangan) as total_tunjangan,
                SUM(total_premi) as total_premi,
                SUM(total_lembur) as total_lembur,
                SUM(total_potongan) as total_potongan,
                SUM(total_upah_bersih) as total_upah_bersih
            FROM dbo.daftar_upah_aggregation_history
            WHERE period_month = 3 AND period_year = 2026
            GROUP BY division_code
        `, []);
        console.log(`   SUCCESS: ${rows.length} divisions`);
        let grandTotal = { karyawan: 0, hk: 0, upah_bersih: 0 };
        rows.forEach((r: any) => {
            grandTotal.karyawan += r.total_karyawan || 0;
            grandTotal.hk += r.total_hk || 0;
            grandTotal.upah_bersih += r.total_upah_bersih || 0;
            console.log(`   - ${r.division_code}: ${r.total_karyawan} emp, Rp ${(r.total_upah_bersih || 0).toLocaleString('id-ID')}`);
        });
        console.log(`   GRAND TOTAL: ${grandTotal.karyawan} emp, Rp ${grandTotal.upah_bersih.toLocaleString('id-ID')}`);
    } catch (e: any) {
        console.log(`   ERROR: ${e.message}`);
    }

    console.log("\n=== All tests completed ===");
}

main().catch(console.error);