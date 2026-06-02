import { Database } from "./src/db/client";

async function main() {
    const db = Database.getExtendedInstance();
    const rows = await db.query<any>(`
        SELECT emp_code, metadata_json
        FROM dbo.payroll_manual_adjustments
        WHERE period_month = 5 AND period_year = 2026 AND metadata_json LIKE '%offset%'
           OR metadata_json LIKE '%no%'
           OR metadata_json LIKE '%penyesuaian%'
    `);

    console.log(`Found matching metadata patterns: ${rows.length}`);
    for (const r of rows.slice(0, 10)) {
        console.log(`Emp: ${r.emp_code} | Meta: ${r.metadata_json}`);
    }
}

main().catch(console.error);
