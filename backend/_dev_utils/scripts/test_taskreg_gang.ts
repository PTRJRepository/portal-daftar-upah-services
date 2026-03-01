import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    console.log("Checking PR_TASKREG for J0843...");

    const rows = await db.query(`
        SELECT top 10 tr.GangCode, trl.TrxDate, trl.Hours, trl.Amount 
        FROM PR_TASKREG tr 
        JOIN PR_TASKREGLN trl ON tr.ID = trl.MasterID 
        WHERE RTRIM(trl.EmpCode) = 'J0843'
        ORDER BY trl.TrxDate DESC
    `);
    console.table(rows);

    const arcRows = await db.query(`
        SELECT top 10 tr.GangCode, trl.TrxDate, trl.Hours, trl.Amount 
        FROM PR_TASKREG_ARC tr 
        JOIN PR_TASKREGLN_ARC trl ON tr.ID = trl.MasterID 
        WHERE RTRIM(trl.EmpCode) = 'J0843'
        ORDER BY trl.TrxDate DESC
    `);
    console.table(arcRows);
}

main().catch(console.error).finally(() => process.exit(0));
