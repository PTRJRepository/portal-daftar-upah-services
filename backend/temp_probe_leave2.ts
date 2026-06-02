import { Database } from "./src/db/client";

async function probe() {
    const stagingDb = Database.getStagingInstance();
    const prodDb = Database.getInstance();

    // 1. Workerleave: date range + LEAVETYPE codes
    console.log("=== Workerleave: date range ===");
    const dateRange = await stagingDb.query<any>(`SELECT MIN(LEAVEDATE) as min_d, MAX(LEAVEDATE) as max_d, COUNT(*) as cnt FROM [staging_PTRJ_iFES_Plantware].[dbo].[Workerleave]`);
    console.log(dateRange[0]);

    console.log("\n=== Workerleave: LEAVETYPE codes ===");
    const leaveCodes = await stagingDb.query<any>(`SELECT LEAVETYPE, COUNT(*) as cnt FROM [staging_PTRJ_iFES_Plantware].[dbo].[Workerleave] GROUP BY LEAVETYPE ORDER BY cnt DESC`);
    for (const c of leaveCodes) console.log(`  ${c.LEAVETYPE}: ${c.cnt}`);

    // 2. Workerleave for May 2026
    console.log("\n=== Workerleave: May 2026 ===");
    const mayLeave = await stagingDb.query<any>(`SELECT LEAVETYPE, COUNT(*) as cnt FROM [staging_PTRJ_iFES_Plantware].[dbo].[Workerleave] WHERE YEAR(LEAVEDATE)=2026 AND MONTH(LEAVEDATE)=5 GROUP BY LEAVETYPE ORDER BY cnt DESC`);
    for (const c of mayLeave) console.log(`  ${c.LEAVETYPE}: ${c.cnt}`);

    // 3. Workerholidays for May 2026
    console.log("\n=== Workerholidays: May 2026 ===");
    const mayHolidays = await stagingDb.query<any>(`SELECT * FROM [staging_PTRJ_iFES_Plantware].[dbo].[Workerholidays] WHERE YEAR(HOLIDAYDATE)=2026 AND MONTH(HOLIDAYDATE)=5`);
    for (const h of mayHolidays) console.log(`  ${h.EMPCODE} ${h.HOLIDAYNAME} ${h.HOLIDAYDATE}`);

    // 4. HR_LEAVETRX: date range + count
    console.log("\n=== HR_LEAVETRX: date range ===");
    const trRange = await prodDb.query<any>(`SELECT MIN(Date) as min_d, MAX(Date) as max_d, COUNT(*) as cnt FROM [db_ptrj].[dbo].[HR_LEAVETRX]`);
    console.log(trRange[0]);

    // 5. HR_LEAVETRX: for May 2026
    console.log("\n=== HR_LEAVETRX: May 2026 ===");
    const mayTrx = await prodDb.query<any>(`SELECT COUNT(*) as cnt FROM [db_ptrj].[dbo].[HR_LEAVETRX] WHERE YEAR(Date)=2026 AND MONTH(Date)=5`);
    console.log(mayTrx[0]);

    // 6. HR_LEAVE table: leave type definitions
    console.log("\n=== HR_LEAVE: leave types ===");
    const leaveTypes = await prodDb.query<any>(`SELECT TOP 20 * FROM [db_ptrj].[dbo].[HR_LEAVE]`);
    for (const lt of leaveTypes) console.log(`  ID=${lt.ID} ${lt.LeaveCode || lt.Code || ''} ${lt.LeaveName || lt.Name || ''}`);

    // 7. Workerleave May 2026 sample rows
    console.log("\n=== Workerleave: May 2026 sample ===");
    const maySample = await stagingDb.query<any>(`SELECT TOP 10 * FROM [staging_PTRJ_iFES_Plantware].[dbo].[Workerleave] WHERE YEAR(LEAVEDATE)=2026 AND MONTH(LEAVEDATE)=5`);
    for (const s of maySample) console.log(`  ${JSON.stringify(s)}`);

    // 8. HR_LEAVETRX May 2026 sample rows
    console.log("\n=== HR_LEAVETRX: May 2026 sample ===");
    const trSample = await prodDb.query<any>(`SELECT TOP 10 * FROM [db_ptrj].[dbo].[HR_LEAVETRX] WHERE YEAR(Date)=2026 AND MONTH(Date)=5`);
    for (const s of trSample) console.log(`  ${JSON.stringify(s)}`);

    // 9. Workerholidays: date range
    console.log("\n=== Workerholidays: date range ===");
    const hRange = await stagingDb.query<any>(`SELECT MIN(HOLIDAYDATE) as min_d, MAX(HOLIDAYDATE) as max_d, COUNT(*) as cnt FROM [staging_PTRJ_iFES_Plantware].[dbo].[Workerholidays]`);
    console.log(hRange[0]);

    // 10. HR_CPTRX_LEAVE: count + sample
    console.log("\n=== HR_CPTRX_LEAVE: count ===");
    const cpCount = await prodDb.query<any>(`SELECT COUNT(*) as cnt FROM [db_ptrj].[dbo].[HR_CPTRX_LEAVE]`);
    console.log(cpCount[0]);
}

probe().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
