import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    const locCodes = ["P1A", "P1B", "P2A", "P2B", "AB1", "AB2"];
    const placeholders = locCodes.map(() => "?").join(",");
    
    console.log(`Comparing counts for LocCodes: ${locCodes.join(", ")}`);

    // 1. HR MASTER MEMBERSHIP
    const hrCount = await db.query(`
        SELECT COUNT(DISTINCT gl.GangMember) as count
        FROM HR_GANGLN gl
        INNER JOIN HR_GANG g ON gl.GangCode = g.GangCode
        WHERE RTRIM(g.LocCode) IN (${placeholders})
    `, locCodes);
    console.log(`HR_GANGLN Count (by g.LocCode): ${hrCount[0].count}`);

    // 2. PR PAYROLL MEMBERSHIP (Current Open Month)
    // First, find what PR_GANGLN looks like
    try {
        const prCount = await db.query(`
            SELECT COUNT(DISTINCT gl.EmpCode) as count
            FROM PR_GANGLN gl
            INNER JOIN PR_GANG g ON gl.MasterID = g.ID
            WHERE RTRIM(g.LocCode) IN (${placeholders})
        `, locCodes);
        console.log(`PR_GANGLN Count (Current Payroll): ${prCount[0].count}`);
        
        // Find members in PR but NOT in HR
        const missingInHR = await db.query(`
            SELECT COUNT(DISTINCT gl.EmpCode) as count
            FROM PR_GANGLN gl
            INNER JOIN PR_GANG g ON gl.MasterID = g.ID
            LEFT JOIN HR_GANGLN hgl ON gl.EmpCode = hgl.GangMember
            WHERE RTRIM(g.LocCode) IN (${placeholders})
              AND hgl.GangMember IS NULL
        `, locCodes);
        console.log(`Members in PR but MISSING in HR_GANGLN: ${missingInHR[0].count}`);

    } catch (e: any) {
        console.log("PR_GANGLN check failed:", e.message);
    }
    
    // 3. TASK REGISTRATION (Who actually worked)
    try {
        const taskRegCount = await db.query(`
            SELECT COUNT(DISTINCT tr.EmpCode) as count
            FROM PR_TASKREGLN tr
            INNER JOIN HR_GANG g ON tr.GangCode = g.GangCode
            WHERE RTRIM(g.LocCode) IN (${placeholders})
        `, locCodes);
        console.log(`PR_TASKREGLN Count (Actual Workers): ${taskRegCount[0].count}`);
    } catch (e: any) {
        console.log("PR_TASKREGLN check failed:", e.message);
    }
}

main().catch(console.error).finally(() => process.exit(0));
