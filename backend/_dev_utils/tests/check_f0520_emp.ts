import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    
    console.log("=== Check HR_GANGLN for F0520 and F0524 ===\n");
    
    const rows = await db.query<any>(`
        SELECT EmpCode, GangCode
        FROM HR_GANGLN
        WHERE EmpCode IN ('F0520', 'F0524')
    `);
    console.log(`HR_GANGLN: ${rows.length} rows`);
    rows.forEach(r => console.log(`  ${r.EmpCode} | ${r.GangCode}`));
    
    console.log("\n=== Check HR_EMPLOYEE for F0520 and F0524 ===\n");
    const emp = await db.query<any>(`
        SELECT EmpCode, EmpName, LocCode
        FROM HR_EMPLOYEE
        WHERE EmpCode IN ('F0520', 'F0524')
    `);
    console.log(`HR_EMPLOYEE: ${emp.length} rows`);
    emp.forEach(r => console.log(`  ${r.EmpCode} | ${r.EmpName} | ${r.LocCode}`));
}

main().catch(console.error);
