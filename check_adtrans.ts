import { Database } from "./backend/src/db/client";

async function run() {
    const db = Database.getInstance();
    try {
        const result = await db.query(`
            SELECT TOP 5 
                t.DocID, 
                t.DocDesc, 
                ln.TaskCode, 
                mt.TaskDesc 
            FROM PR_ADTRANS t
            JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
            LEFT JOIN PR_TASKCODE mt ON ln.TaskCode = mt.TaskCode
            WHERE t.DocDesc LIKE '%PREMI%'
        `);
        console.log("Joined samples:", result);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
