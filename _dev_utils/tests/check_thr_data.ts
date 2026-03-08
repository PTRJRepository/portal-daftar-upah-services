import { Database } from "../../backend/src/db/client";

async function main() {
    const db = Database.getExtendedInstance();

    // Check if details_json column exists
    const cols = await db.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'employee_other_incomes' AND COLUMN_NAME = 'details_json'`) as any[];
    console.log(`details_json column exists: ${cols.length > 0}`);

    // Check latest saved records (ordered by updated_at DESC)
    const latest = await db.query(`SELECT TOP 5 nik, emp_name, division_code, gang_code, amount, updated_at, 
        CASE WHEN details_json IS NULL THEN 'NULL' ELSE LEFT(details_json, 100) END as details_preview
        FROM employee_other_incomes WHERE income_type = 'THR' AND period_month = 2 AND period_year = 2026
        ORDER BY updated_at DESC`) as any[];

    console.log("\n=== Latest 5 THR records (by updated_at DESC) ===");
    for (const r of latest) {
        console.log(`  ${r.emp_name} | div=${r.division_code} | gang=${r.gang_code} | amt=${r.amount} | updated=${r.updated_at}`);
        console.log(`    details: ${r.details_preview}`);
    }

    // Count with/without details_json
    const stats = await db.query(`SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN details_json IS NOT NULL THEN 1 ELSE 0 END) as with_details,
        SUM(CASE WHEN details_json IS NULL THEN 1 ELSE 0 END) as without_details
        FROM employee_other_incomes WHERE income_type = 'THR' AND period_month = 2 AND period_year = 2026`) as any[];
    console.log(`\nTotal: ${stats[0]?.total}, With details: ${stats[0]?.with_details}, Without: ${stats[0]?.without_details}`);

    process.exit(0);
}
main();
