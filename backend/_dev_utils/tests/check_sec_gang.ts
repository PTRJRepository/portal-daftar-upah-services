import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    
    console.log("=== Check SEC gang in HR_GANG ===\n");
    const sec = await db.query<any>(`
        SELECT GangCode, Description, LocCode FROM HR_GANG WHERE GangCode = 'SEC'
    `);
    console.log(`SEC in HR_GANG: ${sec.length}`);
    sec.forEach(r => console.log(`  ${r.GangCode} | ${r.LocCode} | ${r.Description}`));
    
    console.log("\n=== Check HR_GANGLN for SEC ===\n");
    const secMembers = await db.query<any>(`
        SELECT DISTINCT g.GangCode, g.GangMember, e.LocCode
        FROM HR_GANGLN g
        LEFT JOIN HR_EMPLOYEE e ON g.GangMember = e.EmpCode
        WHERE g.GangCode = 'SEC'
    `);
    console.log(`SEC in HR_GANGLN: ${secMembers.length}`);
    secMembers.forEach(r => console.log(`  ${r.GangCode} | ${r.GangMember} | Emp LocCode: ${r.LocCode}`));
}

main().catch(console.error);
