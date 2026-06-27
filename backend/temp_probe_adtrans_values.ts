import { Database } from "./src/db/client";

async function main() {
    const extDb = Database.getExtendedInstance(); // SERVER_PROFILE_1, extend_db_ptrj
    const db = Database.getInstance(); // SERVER_PROFILE_2, db_ptrj

    const p2aAdjustments = await extDb.query<any>(`
        SELECT DISTINCT emp_code, emp_name, amount, remarks
        FROM dbo.payroll_manual_adjustments
        WHERE period_month = 5 AND period_year = 2026 AND division_code = 'P2A' AND adjustment_name = 'PREMI PRUNING'
    `);

    const empCodes = p2aAdjustments.map(r => r.emp_code.trim());
    if (empCodes.length === 0) {
        console.log("No adjustments found in extend_db_ptrj!");
        return;
    }

    const empList = empCodes.map(code => `'${code}'`).join(",");

    // Query PR_ADTRANS + PR_ADTRANSLN including ARC tables from db_ptrj (SERVER_PROFILE_2) without DocDesc filter
    const rows = await db.query<any>(`
        SELECT RTRIM(t.EmpCode) as emp_code, t.DocDesc as doc_desc, SUM(ln.Amount) as amount
        FROM (
            SELECT EmpCode, ID, DocDesc, DocDate FROM dbo.PR_ADTRANS
            UNION ALL
            SELECT EmpCode, ID, DocDesc, DocDate FROM dbo.PR_ADTRANS_ARC
        ) t
        JOIN (
            SELECT MasterID, Amount FROM dbo.PR_ADTRANSLN
            UNION ALL
            SELECT MasterID, Amount FROM dbo.PR_ADTRANSLN_ARC
        ) ln ON t.ID = ln.MasterID
        WHERE t.DocDate >= '2026-05-01' AND t.DocDate < '2026-06-01'
          AND RTRIM(t.EmpCode) IN (${empList})
        GROUP BY t.EmpCode, t.DocDesc
        ORDER BY t.EmpCode
    `);

    console.log(`Found ${rows.length} rows in PR_ADTRANS/ARC + PR_ADTRANSLN/ARC for these employees:`);
    for (const r of rows) {
        const dbAdj = p2aAdjustments.find(a => a.emp_code.trim() === r.emp_code);
        console.log(`Emp: ${r.emp_code} | DocDesc: ${r.doc_desc} | Amount: ${r.amount} | DB Manual Adj Amount: ${dbAdj ? dbAdj.amount : 'N/A'}`);
    }
}

main().catch(console.error);
