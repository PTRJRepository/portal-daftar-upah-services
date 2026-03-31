import { Database } from "./src/db/client";

async function run() {
    const db = Database.getInstance();
    const division = "AB1";

    console.log(`Checking data for Division ${division} in March 2026...`);

    const rows = await db.query(`
        SELECT COUNT(*) as count
        FROM PR_TASKREGLN trl
        JOIN HR_EMPLOYEE e ON RTRIM(e.EmpCode) = RTRIM(trl.EmpCode)
        WHERE trl.TrxDate >= '2026-03-01' AND trl.TrxDate < '2026-04-01'
        AND RTRIM(e.LocCode) = ?
    `, [division]);

    console.log(`Transactions for ${division} in March 2026: ${rows[0].count}`);

    const employees = await db.query(`
        SELECT COUNT(DISTINCT trl.EmpCode) as count
        FROM PR_TASKREGLN trl
        JOIN HR_EMPLOYEE e ON RTRIM(e.EmpCode) = RTRIM(trl.EmpCode)
        WHERE trl.TrxDate >= '2026-03-01' AND trl.TrxDate < '2026-04-01'
        AND RTRIM(e.LocCode) = ?
    `, [division]);
    console.log(`Unique employees for ${division} in March 2026: ${employees[0].count}`);

    process.exit(0);
}

run().catch(console.error);
