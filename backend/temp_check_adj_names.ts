import { Database } from "./src/db/client";

async function main() {
    const db = Database.getExtendedInstance();
    const rows = await db.query<any>(`
        SELECT DISTINCT adjustment_name
        FROM dbo.payroll_manual_adjustments
        WHERE period_month = 5 AND period_year = 2026 AND division_code = 'P2A'
    `);

    console.log("Adjustment names in DB for P2A month 05:");
    for (const r of rows) {
        console.log(`- ${r.adjustment_name}`);
    }
}

main().catch(console.error);
