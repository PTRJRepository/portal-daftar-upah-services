import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();

    console.log("Checking HR_GANG for J1P...");
    const rows = await db.query(`
        SELECT GangCode, Description FROM HR_GANG 
        WHERE Description LIKE '%J1P%' OR GangCode LIKE '%J1P%' OR Description LIKE '%PERCOBAAN%'
    `);
    console.table(rows);

    console.log("Checking J0843's attendance Gang context in PR_TASKREG & PR_ADTRANS...");
    // Let's see DocID of PR_TASKREG
    const taskDocs = await db.query(`
        SELECT top 5 tr.DocID as TaskReg_DocID
        FROM PR_TASKREG tr 
        JOIN PR_TASKREGLN trl ON tr.ID = trl.MasterID 
        WHERE RTRIM(trl.EmpCode) = 'J0843'
        ORDER BY trl.TrxDate DESC
    `);
    console.table(taskDocs);

    // Let's see if J0843 had PR_GANGLN_ARC for J1P
    const arcGangs = await db.query(`
        SELECT * FROM PR_GANGLN_ARC WHERE RTRIM(EmpCode) = 'J0843'
    `);
    console.table(arcGangs);
}

main().catch(console.error).finally(() => process.exit(0));
