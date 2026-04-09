import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    
    console.log("=== Check HR_GANGLN for F1BHL and similar patterns ===\n");
    const f1bhl = await db.query<any>(`
        SELECT DISTINCT g.GangCode, g.GangMember, h.Description
        FROM HR_GANGLN g
        JOIN HR_GANG h ON g.GangCode = h.GangCode
        WHERE g.GangCode LIKE 'F1B%'
        ORDER BY g.GangCode, g.GangMember
    `);
    console.log(`F1B* in HR_GANGLN: ${f1bhl.length} rows`);
    f1bhl.forEach(r => console.log(`  ${r.GangCode} | ${r.GangMember} | ${r.Description?.trim()}`));
    
    console.log("\n=== Check if F1BHL exists in HR_GANG ===\n");
    const f1bhlGang = await db.query<any>(`
        SELECT GangCode, Description, LocCode FROM HR_GANG WHERE GangCode = 'F1BHL'
    `);
    console.log(`F1BHL in HR_GANG: ${f1bhlGang.length} rows`);
    f1bhlGang.forEach(r => console.log(`  ${r.GangCode} | ${r.LocCode} | ${r.Description}`));
    
    console.log("\n=== Check Employee data for PERCOBAAN ===\n");
    const empPercobaan = await db.query<any>(`
        SELECT TOP 20 g.GangCode, g.GangMember, h.Description, e.FName, e.LName
        FROM HR_GANGLN g
        JOIN HR_GANG h ON g.GangCode = h.GangCode
        JOIN HR_EMPLOYEE e ON g.GangMember = e.EmpCode
        WHERE h.Description LIKE '%PERCOBAAN%'
        ORDER BY g.GangCode
    `);
    console.log(`PERCOBAAN employees: ${empPercobaan.length} rows`);
    empPercobaan.forEach(r => {
        console.log(`  ${r.GangCode} | ${r.GangMember} | ${r.FName} ${r.LName} | ${r.Description?.trim()}`);
    });
}

main().catch(console.error);
