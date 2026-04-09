import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    
    console.log("=== Check F0520 and F0524 in payroll tables ===\n");
    
    // Check HR_PAYROLL for these employees
    const payroll = await db.query<any>(`
        SELECT TOP 5 EmpCode, GangCode, Month, Year, Status
        FROM HR_PAYROLL
        WHERE EmpCode IN ('F0520', 'F0524')
        ORDER BY Year DESC, Month DESC
    `);
    console.log(`HR_PAYROLL for F0520/F0524: ${payroll.length} rows`);
    payroll.forEach(r => console.log(`  ${r.EmpCode} | ${r.GangCode} | ${r.Month}/${r.Year} | ${r.Status}`));
    
    // Check PR_TASKREGLN for attendance
    const task = await db.query<any>(`
        SELECT TOP 5 EmpCode, TrxDate, Hours
        FROM PR_TASKREGLN
        WHERE EmpCode IN ('F0520', 'F0524')
        ORDER BY TrxDate DESC
    `);
    console.log(`\nPR_TASKREGLN for F0520/F0524: ${task.length} rows`);
    task.forEach(r => console.log(`  ${r.EmpCode} | ${r.TrxDate} | ${r.Hours} hours`));
}

main().catch(console.error);
