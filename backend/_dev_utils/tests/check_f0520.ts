import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    
    // Check PR_TASKREGLN for attendance - only for month 3, year 2026
    const task = await db.query<any>(`
        SELECT TOP 10 EmpCode, TrxDate, Hours
        FROM PR_TASKREGLN
        WHERE EmpCode IN ('F0520', 'F0524')
        AND TrxDate >= '2026-03-01' AND TrxDate <= '2026-03-31'
        ORDER BY TrxDate DESC
    `);
    console.log(`PR_TASKREGLN for F0520/F0524 in March 2026: ${task.length} rows`);
    task.forEach(r => console.log(`  ${r.EmpCode} | ${r.TrxDate} | ${r.Hours} hours`));
    
    if (task.length === 0) {
        console.log("\nF0520 and F0524 have NO attendance records in March 2026!");
        console.log("This is why they don't appear in the payroll report.");
    }
}

main().catch(console.error);
