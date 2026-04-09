import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    
    console.log("=== F1BHL in HR_GANG ===\n");
    const gang = await db.query<any>(`
        SELECT GangCode, Description, LocCode FROM HR_GANG WHERE GangCode = 'F1BHL'
    `);
    console.log(`F1BHL in HR_GANG: ${gang.length}`);
    gang.forEach(r => console.log(`  ${r.GangCode} | ${r.LocCode} | ${r.Description}`));
    
    console.log("\n=== F1BHL members in HR_GANGLN ===\n");
    const members = await db.query<any>(`
        SELECT g.GangCode, g.GangMember, e.EmpName
        FROM HR_GANGLN g
        LEFT JOIN HR_EMPLOYEE e ON g.GangMember = e.EmpCode
        WHERE g.GangCode = 'F1BHL'
    `);
    console.log(`F1BHL members: ${members.length}`);
    members.forEach(r => console.log(`  ${r.GangCode} | ${r.GangMember} | ${r.EmpName}`));
}

main().catch(console.error);
