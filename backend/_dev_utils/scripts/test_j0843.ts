import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    console.log("Checking PR_TASKREGLN for J0843...");

    const rows = await db.query(`
        SELECT top 50 
            TrxDate, TaskCode, Hours, Amount, OT, 'LIVE' as source 
        FROM PR_TASKREGLN
        WHERE RTRIM(EmpCode) = 'J0843'
        ORDER BY TrxDate DESC
    `);

    console.log("Live Rows:", rows.length);
    console.table(rows);

    const arcRows = await db.query(`
        SELECT top 50 
            TrxDate, TaskCode, Hours, Amount, OT, 'ARC' as source 
        FROM PR_TASKREGLN_ARC
        WHERE RTRIM(EmpCode) = 'J0843'
        ORDER BY TrxDate DESC
    `);

    console.log("Archive Rows:", arcRows.length);
    console.table(arcRows);

    console.log("Checking Gang History:");
    const gangRows = await db.query(`
        SELECT 'LIVE' as src, GangCode, AppJoinGrpDate FROM HR_GANGLN WHERE RTRIM(GangMember) = 'J0843'
        UNION ALL
        SELECT 'ARC' as src, CAST(MasterID as varchar), NULL FROM PR_GANGLN_ARC WHERE RTRIM(EmpCode) = 'J0843'
    `);
    console.table(gangRows);
}

main().catch(console.error).finally(() => process.exit(0));
