
import { Database } from "../../src/db/client";

async function checkLivePph21() {
    const db = Database.getInstance();
    
    // Check March 2026 (Calendar Month 3)
    const startDate = '2026-03-01';
    const endDate = '2026-04-01';

    console.log(`Checking live PR_ADTRANS for period ${startDate} to ${endDate}...`);

    const rows = await db.query(`
        SELECT 
            t.EmpCode, 
            e.EmpName,
            t.DocDesc, 
            ln.TaskCode, 
            mt.TaskDesc, 
            ln.Amount
        FROM PR_ADTRANS t
        JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
        JOIN HR_EMPLOYEE e ON t.EmpCode = e.EmpCode
        LEFT JOIN PR_TASKCODE mt ON ln.TaskCode = mt.TaskCode
        WHERE t.DocDate >= ? AND t.DocDate < ?
          AND (t.DocDesc LIKE '%PPH%' OR ln.TaskCode LIKE '%DEPH21%' OR mt.TaskDesc LIKE '%PPH%')
        ORDER BY t.EmpCode
    `, [startDate, endDate]);

    console.log(`Found ${rows.length} records in live PR_ADTRANS.`);
    
    if (rows.length > 0) {
        console.log('Sample records (first 10):');
        console.table(rows.slice(0, 10));
        
        const totalAmount = rows.reduce((sum: number, r: any) => sum + r.Amount, 0);
        console.log(`Total PPH21 amount in live DB: ${totalAmount}`);
    } else {
        console.log('No PPH21 records found in live PR_ADTRANS for this period.');
    }

    process.exit(0);
}

checkLivePph21().catch(console.error);
