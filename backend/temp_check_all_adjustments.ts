import { Database } from "./src/db/client";

async function main() {
    const db = Database.getExtendedInstance();
    const rows = await db.query<any>(`
        SELECT id, emp_code, emp_name, adjustment_name, amount, remarks, metadata_json
        FROM dbo.payroll_manual_adjustments
        WHERE period_month = 5 AND period_year = 2026 AND division_code = 'P2A'
        ORDER BY emp_code, adjustment_name
    `);

    console.log(`Total adjustments in DB for P2A month 05: ${rows.length}`);
    const counts = new Map<string, number>();
    for (const r of rows) {
        const key = `${r.emp_code.trim()}-${r.adjustment_name.trim()}`;
        counts.set(key, (counts.get(key) || 0) + 1);
        if ((counts.get(key) || 0) > 1) {
            console.log(`DUPLICATE key found in DB! Emp: ${r.emp_code} | Name: ${r.adjustment_name} | Amount: ${r.amount}`);
        }
    }
}

main().catch(console.error);
