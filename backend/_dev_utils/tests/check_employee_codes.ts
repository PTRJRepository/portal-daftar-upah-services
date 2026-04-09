import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    
    console.log("=== Check if F0520 is an employee ===\n");
    const emp = await db.query<any>(`
        SELECT EmpCode, FName, GangCode FROM HR_EMPLOYEE WHERE EmpCode = 'F0520'
    `);
    console.log(`F0520 as employee: ${emp.length} rows`);
    emp.forEach(r => console.log(`  ${r.EmpCode} | ${r.FName} | Gang: ${r.GangCode}`));
    
    console.log("\n=== Check HR_GANGLN for F1BHL pattern ===\n");
    const f1bhl = await db.query<any>(`
        SELECT DISTINCT g.GangCode, g.GangMember, h.Description
        FROM HR_GANGLN g
        JOIN HR_GANG h ON g.GangCode = h.GangCode
        WHERE g.GangCode = 'F1BHL'
    `);
    console.log(`F1BHL directly: ${f1bhl.length} rows`);
    f1bhl.forEach(r => console.log(`  ${r.GangCode} | ${r.GangMember} | ${r.Description}`));
    
    console.log("\n=== All distinct GangCode in HR_GANGLN ===\n");
    const gangs = await db.query<any>(`
        SELECT DISTINCT GangCode FROM HR_GANGLN ORDER BY GangCode
    `);
    console.log(`Total distinct gangs in HR_GANGLN: ${gangs.length}`);
    gangs.forEach(r => console.log(`  ${r.GangCode}`));
}

main().catch(console.error);
