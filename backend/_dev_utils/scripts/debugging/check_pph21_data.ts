import { Database } from "../../../src/db/client";
import { Config } from "../../../src/config";

async function main() {
    const db = Database.getInstance();
    
    // Check if PPH21 exists in PR_ADTRANS for current period
    const month = 3;
    const year = 2026;
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;
    
    console.log(`Checking PPH21 in PR_ADTRANS for ${startDate} to ${endDate}...`);
    
    // Count PPH21 transactions
    const pph21Count = await db.query<any>(`
        SELECT COUNT(*) as cnt, SUM(Amount) as total
        FROM PR_ADTRANSLN ln
        JOIN PR_ADTRANS t ON t.ID = ln.MasterID
        WHERE t.DocDate >= '${startDate}' AND t.DocDate < '${endDate}'
          AND UPPER(t.DocDesc) LIKE '%PPH21%'
    `);
    
    console.log(`PPH21 transactions: ${JSON.stringify(pph21Count)}`);
    
    // Sample some PPH21 records
    const pph21Samples = await db.query<any>(`
        SELECT TOP 10 t.EmpCode, t.DocDesc, ln.Amount, ln.TaskCode
        FROM PR_ADTRANSLN ln
        JOIN PR_ADTRANS t ON t.ID = ln.MasterID
        WHERE t.DocDate >= '${startDate}' AND t.DocDate < '${endDate}'
          AND UPPER(t.DocDesc) LIKE '%PPH21%'
        ORDER BY ln.Amount DESC
    `);
    
    console.log(`\nSample PPH21 records:`);
    pph21Samples.forEach((r: any) => {
        console.log(`  ${r.EmpCode}: ${r.DocDesc} = ${r.Amount}`);
    });
    
    // Check general potongan for a sample gang
    const potonganSample = await db.query<any>(`
        SELECT TOP 20 t.EmpCode, t.DocDesc, ln.Amount
        FROM PR_ADTRANSLN ln
        JOIN PR_ADTRANS t ON t.ID = ln.MasterID
        WHERE t.DocDate >= '${startDate}' AND t.DocDate < '${endDate}'
          AND (UPPER(t.DocDesc) LIKE '%POT%' OR UPPER(t.DocDesc) LIKE '%PPH%')
        ORDER BY t.EmpCode, t.DocDate
    `);
    
    console.log(`\nSample potongan records:`);
    potonganSample.forEach((r: any) => {
        console.log(`  ${r.EmpCode}: ${r.DocDesc} = ${r.Amount}`);
    });
}

main().catch(console.error);
