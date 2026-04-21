import { Database } from "./src/db/client";

async function testTransactionQuery() {
    const db = Database.getInstance();
    
    // Test getting a small sample of emp codes
    console.log("\n=== Getting sample emp codes ===");
    const empCodes = await db.query<any>(`
        SELECT TOP 5 DISTINCT RTRIM(EmpCode) as emp_code
        FROM PR_TASKREG
        WHERE EmpCode IS NOT NULL
    `, []);
    
    console.log("Sample emp codes:", empCodes.map(r => r.emp_code));
    
    if (empCodes.length === 0) {
        console.log("No emp codes found!");
        process.exit(0);
        return;
    }
    
    const empList = empCodes.map(e => `'${e.emp_code}'`).join(',');
    const startDate = '2026-03-01';
    const endDate = '2026-04-01';
    
    console.log("\n=== Testing PR_TASKREG query ===");
    try {
        const taskregRows = await db.query<any>(`
            SELECT TOP 10
                tr.ID as master_id, tr.RegNo, tr.RegDate, tr.EmpCode,
                trl.ID as line_id, trl.TrxDate, trl.TaskCode,
                trl.Hours, trl.OT, trl.Rate, trl.Amount
            FROM PR_TASKREG tr
            JOIN PR_TASKREGLN trl ON tr.ID = trl.MasterID
            WHERE tr.EmpCode IN (${empList})
              AND trl.TrxDate >= '${startDate}' AND trl.TrxDate < '${endDate}'
        `, []);
        
        console.log(`✓ PR_TASKREG query succeeded: ${taskregRows.length} rows`);
        if (taskregRows.length > 0) {
            console.log("First row columns:", Object.keys(taskregRows[0]));
        }
    } catch (error: any) {
        console.error(`✗ PR_TASKREG query failed:`, error.message);
    }
    
    console.log("\n=== Testing PR_ADTRANS query ===");
    try {
        const adtransRows = await db.query<any>(`
            SELECT TOP 10
                t.ID as master_id, t.DocNo, t.DocDate, t.DocDesc, t.EmpCode,
                ln.ID as line_id, ln.TaskCode, ln.Amount
            FROM PR_ADTRANS t
            JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
            WHERE t.EmpCode IN (${empList})
              AND t.DocDate >= '${startDate}' AND t.DocDate < '${endDate}'
        `, []);
        
        console.log(`✓ PR_ADTRANS query succeeded: ${adtransRows.length} rows`);
        if (adtransRows.length > 0) {
            console.log("First row columns:", Object.keys(adtransRows[0]));
        }
    } catch (error: any) {
        console.error(`✗ PR_ADTRANS query failed:`, error.message);
    }
    
    process.exit(0);
}

testTransactionQuery().catch(err => {
    console.error(err);
    process.exit(1);
});
