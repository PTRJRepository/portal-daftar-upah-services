import { Database } from "./src/db/client";

async function main() {
    const db = Database.getExtendedInstance();
    const rows = await db.query<any>(`
        SELECT emp_code, COUNT(*) as count
        FROM dbo.payroll_manual_adjustments
        WHERE period_month = 5 AND period_year = 2026 AND adjustment_name = 'PREMI PRUNING'
        GROUP BY emp_code
        HAVING COUNT(*) > 1
    `);

    console.log("Global duplicates count for PREMI PRUNING in month 05:", rows.length);
    for (const r of rows) {
        console.log(`Emp: ${r.emp_code} | Count: ${r.count}`);
    }
}

main().catch(console.error);
