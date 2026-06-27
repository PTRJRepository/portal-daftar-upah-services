import { Database } from "./src/db/client";

async function probe() {
    const prodDb = Database.getInstance();

    // HR_LEAVE schema
    console.log("=== HR_LEAVE schema ===");
    const cols = await prodDb.query<any>(`SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'HR_LEAVE' AND TABLE_CATALOG = 'db_ptrj' ORDER BY ORDINAL_POSITION`);
    for (const c of cols) console.log(`  ${c.COLUMN_NAME} (${c.DATA_TYPE})`);

    // HR_LEAVE full data
    console.log("\n=== HR_LEAVE data ===");
    const rows = await prodDb.query<any>(`SELECT * FROM [db_ptrj].[dbo].[HR_LEAVE]`);
    for (const r of rows) console.log(`  ${JSON.stringify(r)}`);

    // HR_LEAVETRX_ARC (archive - maybe has data?)
    console.log("\n=== HR_LEAVETRX_ARC: count ===");
    try {
        const arcCount = await prodDb.query<any>(`SELECT COUNT(*) as cnt FROM [db_ptrj].[dbo].[HR_LEAVETRX_ARC]`);
        console.log(`  Total rows: ${arcCount[0]?.cnt}`);
        const arcSample = await prodDb.query<any>(`SELECT TOP 3 * FROM [db_ptrj].[dbo].[HR_LEAVETRX_ARC]`);
        for (const s of arcSample) console.log(`  ${JSON.stringify(s)}`);
    } catch (e: any) { console.log(`  ERROR: ${e.message}`); }

    // PR_PayslipAttendanceData
    console.log("\n=== PR_PayslipAttendanceData: count ===");
    try {
        const payAttCount = await prodDb.query<any>(`SELECT COUNT(*) as cnt FROM [db_ptrj].[dbo].[PR_PayslipAttendanceData]`);
        console.log(`  Total rows: ${payAttCount[0]?.cnt}`);
        const payAttSample = await prodDb.query<any>(`SELECT TOP 5 * FROM [db_ptrj].[dbo].[PR_PayslipAttendanceData]`);
        for (const s of payAttSample) console.log(`  ${JSON.stringify(s)}`);
    } catch (e: any) { console.log(`  ERROR: ${e.message}`); }

    // HR_CPTRX_LEAVE_TEMP
    console.log("\n=== HR_CPTRX_LEAVE_TEMP: count ===");
    try {
        const tmpCount = await prodDb.query<any>(`SELECT COUNT(*) as cnt FROM [db_ptrj].[dbo].[HR_CPTRX_LEAVE_TEMP]`);
        console.log(`  Total rows: ${tmpCount[0]?.cnt}`);
    } catch (e: any) { console.log(`  ERROR: ${e.message}`); }
}

probe().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
