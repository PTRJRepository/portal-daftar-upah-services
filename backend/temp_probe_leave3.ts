import { Database } from "./src/db/client";

async function probe() {
    const stagingDb = Database.getStagingInstance();
    const prodDb = Database.getInstance();

    // 1. HR_CPTRX_LEAVE sample with CPID details
    console.log("=== HR_CPTRX_LEAVE: sample ===");
    const cpSample = await prodDb.query<any>(`SELECT TOP 10 * FROM [db_ptrj].[dbo].[HR_CPTRX_LEAVE]`);
    for (const s of cpSample) console.log(`  ${JSON.stringify(s)}`);

    // 2. Check if PR_ATTENDANCE exists + has data
    console.log("\n=== PR_ATTENDANCE: check ===");
    try {
        const attCount = await prodDb.query<any>(`SELECT COUNT(*) as cnt FROM [db_ptrj].[dbo].[PR_ATTENDANCE]`);
        console.log(`  Rows: ${attCount[0]?.cnt}`);
        const attSample = await prodDb.query<any>(`SELECT TOP 3 * FROM [db_ptrj].[dbo].[PR_ATTENDANCE]`);
        for (const s of attSample) console.log(`  ${JSON.stringify(s)}`);
    } catch (e: any) { console.log(`  ERROR: ${e.message}`); }

    // 3. Check for any table with 'leave' or 'attend' in name
    console.log("\n=== Tables with 'LEAVE' in name (db_ptrj) ===");
    const leaveTables = await prodDb.query<any>(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_CATALOG = 'db_ptrj' AND TABLE_SCHEMA = 'dbo' AND TABLE_NAME LIKE '%LEAVE%' ORDER BY TABLE_NAME`);
    for (const t of leaveTables) console.log(`  ${t.TABLE_NAME}`);

    console.log("\n=== Tables with 'ATTEND' in name (db_ptrj) ===");
    const attTables = await prodDb.query<any>(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_CATALOG = 'db_ptrj' AND TABLE_SCHEMA = 'dbo' AND TABLE_NAME LIKE '%ATTEND%' ORDER BY TABLE_NAME`);
    for (const t of attTables) console.log(`  ${t.TABLE_NAME}`);

    // 4. Check PR_TASKREGLN for absence-related TaskCodes
    console.log("\n=== PR_TASKREGLN: distinct TaskCode with 'ABSEN' or 'CUTI' or 'SAKIT' or 'ALPHA' or 'IZIN' (May 2026) ===");
    const absenceTasks = await prodDb.query<any>(`SELECT DISTINCT TaskCode, COUNT(*) as cnt FROM PR_TASKREGLN WITH (NOLOCK) WHERE YEAR(TrxDate)=2026 AND MONTH(TrxDate)=5 AND (TaskCode LIKE '%ABSEN%' OR TaskCode LIKE '%CUTI%' OR TaskCode LIKE '%SAKIT%' OR TaskCode LIKE '%ALPHA%' OR TaskCode LIKE '%IZIN%' OR TaskCode LIKE '%LEAVE%' OR TaskCode LIKE '%LBR%' OR TaskCode LIKE '%SICK%') GROUP BY TaskCode`);
    for (const t of absenceTasks) console.log(`  ${t.TaskCode}: ${t.cnt}`);

    // 5. Workerleave 2023 Jan sample (most recent)
    console.log("\n=== Workerleave: Jan 2023 sample (most recent) ===");
    const recent = await stagingDb.query<any>(`SELECT TOP 5 * FROM [staging_PTRJ_iFES_Plantware].[dbo].[Workerleave] WHERE YEAR(LEAVEDATE)=2023 AND MONTH(LEAVEDATE)=1 ORDER BY LEAVEDATE DESC`);
    for (const r of recent) console.log(`  ${JSON.stringify(r)}`);

    // 6. Distinct LEAVETYPE in Workerleave with mapping
    console.log("\n=== Workerleave: LEAVETYPE → HR_LEAVE mapping ===");
    const leaveMap = await prodDb.query<any>(`SELECT ID, Code, Name FROM [db_ptrj].[dbo].[HR_LEAVE] ORDER BY ID`);
    for (const l of leaveMap) console.log(`  HR_LEAVE: ID=${l.ID} Code=${l.Code} Name=${l.Name}`);

    // 7. Workerholidays 2020 Oct sample (most recent)
    console.log("\n=== Workerholidays: Oct 2020 sample (most recent) ===");
    const hRecent = await stagingDb.query<any>(`SELECT TOP 5 * FROM [staging_PTRJ_iFES_Plantware].[dbo].[Workerholidays] WHERE YEAR(HOLIDAYDATE)=2020 AND MONTH(HOLIDAYDATE)=10 ORDER BY HOLIDAYDATE DESC`);
    for (const r of hRecent) console.log(`  ${JSON.stringify(r)}`);

    // 8. PR_ATTENDANCE table count
    console.log("\n=== PR_ATTENDANCE: count ===");
    try {
        const attCount2 = await prodDb.query<any>(`SELECT COUNT(*) as cnt FROM [db_ptrj].[dbo].[PR_ATTENDANCE]`);
        console.log(`  Total rows: ${attCount2[0]?.cnt}`);
    } catch (e: any) { console.log(`  ERROR: ${e.message}`); }

    // 9. HR_CPTRX_LEAVE count per year
    console.log("\n=== HR_CPTRX_LEAVE: count by year (from CPID pattern) ===");
    const cpByYear = await prodDb.query<any>(`SELECT COUNT(*) as cnt FROM [db_ptrj].[dbo].[HR_CPTRX_LEAVE]`);
    console.log(`  Total: ${cpByYear[0]?.cnt}`);
}

probe().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
