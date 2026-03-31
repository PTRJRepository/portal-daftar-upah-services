import { Database } from "./src/db/client";

async function run() {
    const db = Database.getInstance();

    console.log(`Checking data for MILL (Gangs starting with M) in March 2026...`);

    const rows = await db.query(`
        SELECT COUNT(*) as count
        FROM PR_TASKREGLN trl
        WHERE trl.TrxDate >= '2026-03-01' AND trl.TrxDate < '2026-04-01'
        AND RTRIM(trl.TaskCode) LIKE 'M%'
    `);
    console.log(`Transactions with TaskCode starting with M in March 2026: ${rows[0].count}`);

    const gangRows = await db.query(`
        SELECT DISTINCT RTRIM(gl.GangCode) as GangCode
        FROM HR_GANGLN gl
        WHERE RTRIM(gl.GangCode) LIKE 'M%'
    `);
    console.log(`Gangs starting with M in HR_GANGLN:`, gangRows.map(g => g.GangCode));

    const trGangRows = await db.query(`
        SELECT DISTINCT RTRIM(gl.GangCode) as GangCode
        FROM PR_TASKREGLN trl
        JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(trl.EmpCode)
        WHERE trl.TrxDate >= '2026-03-01' AND trl.TrxDate < '2026-04-01'
        AND RTRIM(gl.GangCode) LIKE 'M%'
    `);
    console.log(`Gangs starting with M with transactions in March 2026:`, trGangRows.map(g => g.GangCode));

    process.exit(0);
}

run().catch(console.error);
