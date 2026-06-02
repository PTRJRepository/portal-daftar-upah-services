import { Database } from "./src/db/client";

async function main() {
    const db = Database.getExtendedInstance();
    const rows = await db.query<any>(`
        SELECT id, emp_code, emp_name, division_code, gang_code, amount, remarks, metadata_json
        FROM dbo.payroll_manual_adjustments
        WHERE period_month = 5 AND period_year = 2026 AND division_code = 'P2A' AND adjustment_name = 'PREMI PRUNING'
        ORDER BY emp_code
    `);

    console.log(`Found ${rows.length} P2A pruning adjustments:`);
    for (const r of rows.slice(0, 15)) {
        console.log(`ID: ${r.id} | Emp: ${r.emp_code} (${r.emp_name}) | Gang: ${r.gang_code} | Amount: ${r.amount}`);
        console.log(`  Remarks: ${r.remarks}`);
        console.log(`  Meta: ${r.metadata_json}`);
    }
}

main().catch(console.error);
