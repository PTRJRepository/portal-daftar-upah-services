import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    
    console.log("=== F1BHL employees ===\n");
    const emp = await db.query<any>(`
        SELECT gl.GangCode, gl.GangMember, e.EmpName, e.LocCode
        FROM HR_GANGLN gl
        INNER JOIN HR_EMPLOYEE e ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
        WHERE gl.GangCode = 'F1BHL'
    `);
    console.log(`F1BHL employees: ${emp.length}`);
    emp.forEach(r => console.log(`  ${r.GangCode} | ${r.GangMember} | ${r.EmpName} | LocCode=${r.LocCode}`));
    
    console.log("\n=== Check if F0520 and F0524 exist in HR_EMPLOYEE ===");
    const f0520 = await db.query<any>(`
        SELECT EmpCode, EmpName, LocCode FROM HR_EMPLOYEE WHERE EmpCode = 'F0520'
    `);
    const f0524 = await db.query<any>(`
        SELECT EmpCode, EmpName, LocCode FROM HR_EMPLOYEE WHERE EmpCode = 'F0524'
    `);
    console.log(`F0520: ${JSON.stringify(f0520[0])}`);
    console.log(`F0524: ${JSON.stringify(f0524[0])}`);
}

main().catch(console.error);
