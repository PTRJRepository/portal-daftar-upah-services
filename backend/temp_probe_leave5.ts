import { Database } from "./src/db/client";

async function probe() {
    const prodDb = Database.getInstance();

    // 1. HR_LEAVETRX_ARC: date range + per year counts
    console.log("=== HR_LEAVETRX_ARC: date range ===");
    const dr = await prodDb.query<any>(`SELECT MIN(Date) as min_d, MAX(Date) as max_d, COUNT(*) as cnt FROM [db_ptrj].[dbo].[HR_LEAVETRX_ARC]`);
    console.log(dr[0]);

    // 2. Per year
    console.log("\n=== HR_LEAVETRX_ARC: by year ===");
    const yr = await prodDb.query<any>(`SELECT YEAR(Date) as yr, COUNT(*) as cnt FROM [db_ptrj].[dbo].[HR_LEAVETRX_ARC] GROUP BY YEAR(Date) ORDER BY yr`);
    for (const r of yr) console.log(`  ${r.yr}: ${r.cnt}`);

    // 3. By LeaveID
    console.log("\n=== HR_LEAVETRX_ARC: by LeaveID ===");
    const lid = await prodDb.query<any>(`SELECT LeaveID, COUNT(*) as cnt FROM [db_ptrj].[dbo].[HR_LEAVETRX_ARC] GROUP BY LeaveID ORDER BY LeaveID`);
    for (const r of lid) console.log(`  LeaveID ${r.LeaveID}: ${r.cnt}`);

    // 4. PR_TASKREGLN: confirm 2026 data exists
    console.log("\n=== PR_TASKREGLN: 2026 check ===");
    const tr2026 = await prodDb.query<any>(`SELECT YEAR(TrxDate) as yr, OT, COUNT(*) as cnt FROM PR_TASKREGLN WITH (NOLOCK) WHERE YEAR(TrxDate)=2026 AND MONTH(TrxDate)=5 GROUP BY YEAR(TrxDate), OT`);
    for (const r of tr2026) console.log(`  ${r.yr} OT=${r.OT}: ${r.cnt} rows`);
}

probe().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
