import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    
    console.log("=== PG1A gangs in HR_GANG ===\n");
    const gangs = await db.query<any>(`
        SELECT g.GangCode, g.Description, g.LocCode
        FROM HR_GANG g
        WHERE g.LocCode = 'P1A'
        ORDER BY g.GangCode
    `);
    console.log(`HR_GANG with LocCode=P1A: ${gangs.length}`);
    gangs.forEach(r => console.log(`  ${r.GangCode} | ${r.LocCode} | ${r.Description}`));
    
    console.log("\n=== PG1A gangs with members in HR_GANGLN ===\n");
    const withMembers = await db.query<any>(`
        SELECT DISTINCT g.GangCode, g.Description, g.LocCode
        FROM HR_GANG g
        INNER JOIN HR_GANGLN gl ON g.GangCode = gl.GangCode
        WHERE g.LocCode = 'P1A'
        ORDER BY g.GangCode
    `);
    console.log(`HR_GANG with LocCode=P1A and members: ${withMembers.length}`);
    withMembers.forEach(r => console.log(`  ${r.GangCode} | ${r.LocCode} | ${r.Description}`));
    
    console.log("\n=== Employee LocCodes with A prefix ===\n");
    const locs = await db.query<any>(`
        SELECT DISTINCT LocCode FROM HR_EMPLOYEE WHERE LocCode LIKE 'P%' ORDER BY LocCode
    `);
    console.log(`Employee LocCodes: ${locs.length}`);
    locs.forEach(r => console.log(`  ${r.LocCode}`));
}

main().catch(console.error);
