import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    
    console.log("=== Check HR_EMPLOYEE columns ===\n");
    const cols = await db.query<any>(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'HR_EMPLOYEE'
    `);
    console.log(`HR_EMPLOYEE columns: ${cols.length}`);
    cols.forEach(r => console.log(`  ${r.COLUMN_NAME}`));
    
    console.log("\n=== Check F0520 ===\n");
    const emp = await db.query<any>(`
        SELECT EmpCode FROM HR_EMPLOYEE WHERE EmpCode = 'F0520'
    `);
    console.log(`F0520 found: ${emp.length}`);
}

main().catch(console.error);
