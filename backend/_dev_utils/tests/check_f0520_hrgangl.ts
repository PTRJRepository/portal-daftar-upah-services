import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    
    console.log("=== Check HR_GANGLN for F0520 and F0524 ===\n");
    
    const rows = await db.query<any>(`
        SELECT EmpCode, GangCode, GangJabatan
        FROM HR_GANGLN
        WHERE EmpCode IN ('F0520', 'F0524')
    `);
    console.log(`HR_GANGLN: ${rows.length} rows`);
    rows.forEach(r => console.log(`  ${r.EmpCode} | ${r.GangCode} | ${r.GangJabatan}`));
    
    console.log("\n=== Check employee details ===\n");
    const emp = await db.query<any>(`
        SELECT EmpCode, EmpName, LocCode, Status
        FROM HR_EMPLOYEE
        WHERE EmpCode IN ('F0520', 'F0524')
    `);
    console.log(`HR_EMPLOYEE: ${emp.length} rows`);
    emp.forEach(r => console.log(`  ${r.EmpCode} | ${r.EmpName} | ${r.LocCode} | Status=${r.Status}`));
}

main().catch(console.error);
