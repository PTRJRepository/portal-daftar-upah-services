import { Database } from "./src/db/client";

async function run() {
    const db = Database.getInstance();

    console.log("Checking for employees with transactions in March 2026 but missing from HR_GANGLN...");

    const rows = await db.query(`
        SELECT DISTINCT RTRIM(EmpCode) as EmpCode, RTRIM(EmpName) as EmpName
        FROM PR_TASKREGLN
        WHERE TrxDate >= '2026-03-01' AND TrxDate < '2026-04-01'
        AND RTRIM(EmpCode) NOT IN (SELECT RTRIM(GangMember) FROM HR_GANGLN)
    `);

    console.log(`Employees with transactions but NOT in HR_GANGLN: ${rows.length}`);
    if (rows.length > 0) {
        console.log("First 10 missing employees:");
        console.log(rows.slice(0, 10).map(r => `${r.EmpCode}: ${r.EmpName}`).join('\n'));
    }

    const totalInMarch = await db.query(`
        SELECT COUNT(DISTINCT EmpCode) as count
        FROM PR_TASKREGLN
        WHERE TrxDate >= '2026-03-01' AND TrxDate < '2026-04-01'
    `);
    console.log(`Total unique employees with transactions in March 2026: ${totalInMarch[0].count}`);

    const totalInHrGangln = await db.query(`
        SELECT COUNT(DISTINCT GangMember) as count
        FROM HR_GANGLN
    `);
    console.log(`Total unique employees in HR_GANGLN: ${totalInHrGangln[0].count}`);

    process.exit(0);
}

run().catch(console.error);
