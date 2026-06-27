import { Database } from "./src/db/client";

async function main() {
    const extDb = Database.getExtendedInstance();
    const rows = await extDb.query<any>(`
        SELECT id, emp_code, emp_name, amount, remarks, metadata_json
        FROM dbo.payroll_manual_adjustments
        WHERE period_month = 5 AND period_year = 2026 AND division_code = 'P2A' AND adjustment_name = 'PREMI PRUNING'
        ORDER BY emp_code
    `);

    console.log(`Total rows in DB: ${rows.length}`);
    for (const r of rows) {
        console.log(`Emp: ${r.emp_code.trim()} | Name: ${r.emp_name.trim()} | Amount: ${r.amount} | Remarks: ${r.remarks} | Meta: ${r.metadata_json}`);
    }
}

main().catch(console.error);
