import { Database } from "../../../src/db/client";

async function main() {
    const db = Database.getInstance();
    const rows = await db.query<any>(`
        SELECT TOP 20 emp_code, pot_koreksi 
        FROM dbo.employee_payroll_data 
        WHERE pot_koreksi != 0
    `);
    
    console.log(`Found ${rows.length} records with non-zero pot_koreksi:`);
    for (const row of rows) {
        console.log(`  ${row.emp_code}: ${row.pot_koreksi}`);
    }
}

main().catch(console.error);
