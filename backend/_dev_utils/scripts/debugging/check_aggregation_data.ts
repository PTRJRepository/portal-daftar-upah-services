import { Database } from "../../../src/db/client";

async function main() {
    console.log("=== Checking Aggregation Data for March 2026 ===");
    const db = Database.getExtendedInstance();

    // Check what periods have data
    const periods = await db.query(`
        SELECT TOP 10 period_year, period_month, COUNT(*) as cnt, SUM(total_employees) as total_emp, SUM(total_upah_bersih) as total_wage
        FROM dbo.daftar_upah_aggregation_history
        GROUP BY period_year, period_month
        ORDER BY period_year DESC, period_month DESC
    `);
    console.log("Available periods in aggregation history:");
    periods.forEach(p => {
        console.log(`  ${p.period_year}-${String(p.period_month).padStart(2, '0')}: ${p.cnt} gangs, ${p.total_emp} employees, Rp ${(p.total_wage || 0).toLocaleString('id-ID')}`);
    });

    // Check March 2026 specifically
    const march2026 = await db.query(`
        SELECT TOP 5 gang_code, division_code, period_month, period_year, total_employees, total_upah_bersih, version_index
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = 3 AND period_year = 2026
    `);
    console.log(`\nMarch 2026 data: ${march2026.length} rows`);
    if (march2026.length > 0) {
        march2026.forEach(r => console.log(`  ${r.gang_code} / ${r.division_code}: ${r.total_employees} emp, Rp ${r.total_upah_bersih?.toLocaleString('id-ID')}, v${r.version_index}`));
    }

    // Check what the WagesSummaryRebinmasPage expects
    console.log("\n=== Summary Report Data Check ===");
    const summarySvc = await db.query(`
        SELECT TOP 5 *
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = 3 AND period_year = 2026
    `);
    console.log(`Summary check: ${summarySvc.length} rows`);
}

main().catch(console.error);