import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    const loc = "P1A";
    
    console.log(`Researching P1A (${loc})...`);
    
    // 1. Raw HR_GANG check
    const rawGangs = await db.query(`SELECT RTRIM(GangCode) as code, Description, LocCode FROM HR_GANG WHERE LocCode = ?`, [loc]);
    console.log(`Total gangs in HR_GANG for ${loc}: ${rawGangs.length}`);
    if (rawGangs.length > 0) {
        console.log("Sample HR_GANG:", rawGangs[0]);
    }

    // 2. HR_GANGLN check for membership
    const membershipSample = await db.query(`SELECT TOP 5 * FROM HR_GANGLN`);
    console.log("HR_GANGLN sample:", membershipSample);

    // 3. Test the exact join that returned 0
    const joinedTest = await db.query(`
        SELECT COUNT(DISTINCT gl.GangCode) as count
        FROM HR_GANGLN gl
        INNER JOIN HR_GANG g ON gl.GangCode = g.GangCode
        INNER JOIN HR_EMPLOYEE e ON gl.GangMember = e.EmpCode
        WHERE RTRIM(g.LocCode) = ?
    `, [loc]);
    console.log(`Joined members count for ${loc} (g.LocCode): ${joinedTest[0].count}`);

    const joinedTestByE = await db.query(`
        SELECT COUNT(DISTINCT gl.GangCode) as count
        FROM HR_GANGLN gl
        INNER JOIN HR_GANG g ON gl.GangCode = g.GangCode
        INNER JOIN HR_EMPLOYEE e ON gl.GangMember = e.EmpCode
        WHERE RTRIM(e.LocCode) = ?
    `, [loc]);
    console.log(`Joined members count for ${loc} (e.LocCode): ${joinedTestByE[0].count}`);
    
    // 4. Check for mismatches in GangMember vs EmpCode
    const mismatchCheck = await db.query(`
        SELECT TOP 5 gl.GangMember, gl.GangCode
        FROM HR_GANGLN gl
        LEFT JOIN HR_EMPLOYEE e ON gl.GangMember = e.EmpCode
        WHERE e.EmpCode IS NULL
    `);
    console.log("Mismatched GangMembers (not in HR_EMPLOYEE):", mismatchCheck);
}

main().catch(console.error).finally(() => process.exit(0));
