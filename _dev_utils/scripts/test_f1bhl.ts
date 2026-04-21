import { Database } from './src/db/client';

async function test() {
    const db = Database.getInstance();
    const rows = await db.query(`
        SELECT ID, Description FROM PR_GANG WHERE GangID = 'F1BHL'
    `);
    console.log("PR_GANG records:", rows);

    const arc_rows = await db.query(`
        SELECT AccMonth, AccYear, COUNT(*) as Count 
        FROM PR_GANGLN_ARC 
        WHERE MasterID IN (SELECT ID FROM PR_GANG WHERE GangID = 'F1BHL')
        GROUP BY AccMonth, AccYear
    `);
    console.log("PR_GANGLN_ARC counts by month/year:", arc_rows);

    const checkroll_rows = await db.query(`
        SELECT MONTH(TrxDate) as M, YEAR(TrxDate) as Y, COUNT(*) as Count
        FROM PR_TASKREGLN trl
        JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
        WHERE RTRIM(trl.EmpCode) IN (
            SELECT RTRIM(EmpCode) FROM PR_GANGLN_ARC WHERE MasterID IN (SELECT ID FROM PR_GANG WHERE GangID = 'F1BHL')
        )
        GROUP BY MONTH(TrxDate), YEAR(TrxDate)
    `);
    console.log("TaskRegLN (Checkroll Live) counts by month/year:", checkroll_rows);
    process.exit(0);
}
test();
