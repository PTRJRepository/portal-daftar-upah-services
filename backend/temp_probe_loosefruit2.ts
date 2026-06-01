process.env.LOG_TO_FILE = "false";
process.env.CLEAR_LOGS_ON_STARTUP = "false";
import { Database } from "../backend/src/db/client";

const stagingDb = Database.getStagingInstance();
const prodDb = Database.getInstance();
const CATALOG = "staging_PTRJ_iFES_Plantware";

async function main() {
  console.log("=".repeat(100));
  console.log("LOOSEFRUIT COMPARISON: Staging vs db_ptrj");
  console.log("=".repeat(100));

  const testDate = "2026-05-28";
  const testMonth = 5;
  const testYear = 2026;

  // 1. Stage: aggregate Ffbscannerdata LOOSEFRUIT per worker per day
  console.log(`\n=== 1. Staging: Ffbscannerdata LOOSEFRUIT per worker (${testDate}) ===`);
  const stagingLF = await stagingDb.query<any>(
    `SELECT WORKERCODE, FROMOCCODE,
            COUNT(*) as trx_count,
            SUM(CAST(LOOSEFRUIT AS INT)) as total_lf,
            SUM(CAST(RIPE AS INT)) as total_ripe,
            SUM(CAST(UNRIPE AS INT)) as total_unripe,
            SUM(CAST(ROTTEN AS INT)) as total_rotten
     FROM [${CATALOG}].[dbo].[Ffbscannerdata]
     WHERE CAST(TRANSDATE AS DATE) = '${testDate}'
       AND CAST(LOOSEFRUIT AS INT) > 0
     GROUP BY WORKERCODE, FROMOCCODE
     ORDER BY WORKERCODE`,
  );
  console.log(`Total workers with LF: ${stagingLF.length}`);
  for (const r of stagingLF.slice(0, 15)) {
    console.log(`  ${r.WORKERCODE} | ${r.FROMOCCODE} | trx=${r.trx_count} LF=${r.total_lf} ripe=${r.total_ripe}`);
  }

  // 2. PR_LOOSEFRUITLN for same date
  console.log(`\n=== 2. db_ptrj: PR_LOOSEFRUITLN (${testDate}) ===`);
  const prodLF = await prodDb.query<any>(
    `SELECT EmpCode, ChargeTo, TaskCode,
            COUNT(*) as trx_count,
            SUM(MT) as total_mt,
            SUM(Amount) as total_amount
     FROM PR_LOOSEFRUITLN WITH (NOLOCK)
     WHERE CAST(TrxDate AS DATE) = '${testDate}'
     GROUP BY EmpCode, ChargeTo, TaskCode
     ORDER BY EmpCode`,
  );
  console.log(`Total workers with LF: ${prodLF.length}`);
  for (const r of prodLF.slice(0, 15)) {
    console.log(`  ${r.EmpCode} | ${r.ChargeTo} | ${r.TaskCode} | trx=${r.trx_count} MT=${r.total_mt}`);
  }

  // 3. Match staging LF workers against PR_LOOSEFRUITLN
  console.log(`\n=== 3. CROSS-MATCH by EMPCODE+DATE ===`);
  const stagingMap = new Map(stagingLF.map((r: any) => [String(r.WORKERCODE).trim(), r]));
  const prodMap = new Map(prodLF.map((r: any) => [String(r.EmpCode).trim(), r]));

  let matchCount = 0;
  let stagingOnly = 0;
  let prodOnly = 0;

  // Staging workers
  for (const [empCode, s] of stagingMap) {
    if (prodMap.has(empCode)) {
      matchCount++;
      const p = prodMap.get(empCode)!;
      console.log(`  ✓ ${empCode}: staging LF=${s.total_lf} bunches | prod MT=${p.total_mt} (task=${p.TaskCode})`);
    } else {
      stagingOnly++;
      console.log(`  ✗ ${empCode}: staging LF=${s.total_lf} bunches → NOT FOUND in PR_LOOSEFRUITLN`);
    }
  }

  // Workers only in prod (not in staging FFB — could be from other source)
  for (const [empCode, p] of prodMap) {
    if (!stagingMap.has(empCode)) {
      prodOnly++;
      if (prodOnly <= 10) {
        console.log(`  ? ${empCode}: only in PR_LOOSEFRUITLN (MT=${p.total_mt}) — not in Ffbscannerdata`);
      }
    }
  }

  console.log(`\n  Match: ${matchCount}, Staging only (missing prod): ${stagingOnly}, Prod only (other source): ${prodOnly}`);

  // 4. Check iFES_MillWeight has Loosefruits column and compare
  console.log(`\n=== 4. iFES_MillWeight → Loosefruits (${testDate}) ===`);
  const iFesLF = await stagingDb.query<any>(
    `SELECT TOP 10 ID, FromOc, DriverEmpCode, VehicleNo, Weight, Bunches, Loosefruits, DateHarvesting
     FROM [${CATALOG}].[dbo].[iFES_MillWeight]
     WHERE CAST(DateHarvesting AS DATE) = '${testDate}' AND ISNULL(Loosefruits,0) > 0
     ORDER BY Weight DESC`,
  );
  console.log(`iFES_MillWeight with Loosefruits on ${testDate}: ${iFesLF.length} rows`);
  for (const r of iFesLF) {
    console.log(`  Driver=${r.DriverEmpCode} | Wt=${r.Weight} | Bunch=${r.Bunches} | LF=${r.Loosefruits} | field=${r.FieldNo}`);
  }

  // 5. Total monthly comparison (May 2026)
  console.log(`\n=== 5. Monthly summary: May 2026 ===`);

  // Staging total LF
  const stagingMonthly = await stagingDb.queryOne<any>(
    `SELECT SUM(CAST(LOOSEFRUIT AS INT)) as total_lf, COUNT(DISTINCT WORKERCODE) as workers
     FROM [${CATALOG}].[dbo].[Ffbscannerdata]
     WHERE YEAR(TRANSDATE)=${testYear} AND MONTH(TRANSDATE)=${testMonth}
       AND CAST(LOOSEFRUIT AS INT) > 0`,
  );
  console.log(`Staging Ffbscannerdata May 2026: LF=${stagingMonthly?.total_lf ?? 0} bunches, workers=${stagingMonthly?.workers ?? 0}`);

  // Prod total LF
  const prodMonthly = await prodDb.queryOne<any>(
    `SELECT SUM(MT) as total_mt, COUNT(DISTINCT EmpCode) as workers,
            COUNT(*) as total_trx
     FROM PR_LOOSEFRUITLN WITH (NOLOCK)
     WHERE YEAR(TrxDate)=${testYear} AND MONTH(TrxDate)=${testMonth}`,
  );
  console.log(`PR_LOOSEFRUITLN May 2026: MT=${prodMonthly?.total_mt ?? 0}, workers=${prodMonthly?.workers ?? 0}, trx=${prodMonthly?.total_trx ?? 0}`);

  // PR_LOOSEFRUIT (header) monthly
  const prodHeader = await prodDb.queryOne<any>(
    `SELECT COUNT(*) as cnt, SUM(TotalMT) as total_mt
     FROM PR_LOOSEFRUIT WITH (NOLOCK)
     WHERE PhyMonth=${testMonth} AND PhyYear=${testYear}`,
  );
  console.log(`PR_LOOSEFRUIT (header) May 2026: ${prodHeader?.cnt ?? 0} docs, ${prodHeader?.total_mt ?? 0} MT`);

  // Check PR_LOOSEFRUIT_ARC too
  const prodArcHeader = await prodDb.queryOne<any>(
    `SELECT COUNT(*) as cnt, SUM(TotalMT) as total_mt
     FROM PR_LOOSEFRUIT_ARC WITH (NOLOCK)
     WHERE PhyMonth=${testMonth} AND PhyYear=${testYear}`,
  );
  console.log(`PR_LOOSEFRUIT_ARC May 2026: ${prodArcHeader?.cnt ?? 0} docs, ${prodArcHeader?.total_mt ?? 0} MT`);

  // Total prod LF (both tables)
  const prodLnArc = await prodDb.queryOne<any>(
    `SELECT SUM(MT) as total_mt, COUNT(DISTINCT EmpCode) as workers
     FROM PR_LOOSEFRUITLN_ARC WITH (NOLOCK)
     WHERE YEAR(TrxDate)=${testYear} AND MONTH(TrxDate)=${testMonth}`,
  );
  console.log(`PR_LOOSEFRUITLN_ARC May 2026: MT=${prodLnArc?.total_mt ?? 0}, workers=${prodLnArc?.workers ?? 0}`);

  // 6. Try to find the link: staging TRANSNO → PR_LOOSEFRUITLN
  // Check if iFES_MillWeight.Loosefruits aggregates from Ffbscannerdata
  console.log(`\n=== 6. iFES_MillWeight vs Ffbscannerdata LOOSEFRUIT ===`);
  const iFesMonthly = await stagingDb.queryOne<any>(
    `SELECT SUM(ISNULL(Loosefruits,0)) as total_lf,
            COUNT(DISTINCT DriverEmpCode) as drivers
     FROM [${CATALOG}].[dbo].[iFES_MillWeight]
     WHERE YEAR(DateHarvesting)=${testYear} AND MONTH(DateHarvesting)=${testMonth}`,
  );
  console.log(`iFES_MillWeight May 2026: LF=${iFesMonthly?.total_lf ?? 0}, drivers=${iFesMonthly?.drivers ?? 0}`);

  // 7. Try to match Ffbscannerdata WORKERCODE → PR_LOOSEFRUITLN EmpCode for a specific division
  console.log(`\n=== 7. Division-level match: P1A on ${testDate} ===`);
  const stagingDiv = await stagingDb.query<any>(
    `SELECT WORKERCODE, SUM(CAST(LOOSEFRUIT AS INT)) as total_lf
     FROM [${CATALOG}].[dbo].[Ffbscannerdata]
     WHERE CAST(TRANSDATE AS DATE) = '${testDate}'
       AND FROMOCCODE = 'P1A'
       AND CAST(LOOSEFRUIT AS INT) > 0
     GROUP BY WORKERCODE`,
  );
  console.log(`Staging P1A workers with LF: ${stagingDiv.length}`);
  for (const r of stagingDiv.slice(0, 20)) {
    const ec = String(r.WORKERCODE).trim();
    const prodRow = await prodDb.queryOne<any>(
      "SELECT EmpCode, MT FROM PR_LOOSEFRUITLN WITH (NOLOCK) WHERE EmpCode = ? AND CAST(TrxDate AS DATE) = ?",
      [ec, testDate],
    );
    if (prodRow) {
      console.log(`  ✓ ${ec}: staging LF=${r.total_lf} bunches → prod MT=${prodRow.MT}`);
    } else {
      console.log(`  ✗ ${ec}: staging LF=${r.total_lf} bunches → NOT in PR_LOOSEFRUITLN`);
    }
  }

  // 8. Check if PR_HARVESTERLN_ACC stores LooseFruit
  console.log(`\n=== 8. PR_HARVESTERLN_ACC: LooseFruit field check ===`);
  // Check column names for loosefruit
  const haccCols = await prodDb.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PR_HARVESTERLN_ACC'",
  );
  const haccNames = haccCols.map((c: any) => c.COLUMN_NAME);
  const lfRelated = haccNames.filter((n: string) => n.includes("Fruit") || n.includes("LOOSE") || n.includes("Loose"));
  console.log(`LooseFruit-related columns in PR_HARVESTERLN_ACC: ${lfRelated.length > 0 ? lfRelated.join(", ") : "NONE"}`);

  // Check PR_HARVESTER_ACC (master) for loosefruit
  try {
    const haccMasterCols = await prodDb.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PR_HARVESTER_ACC'",
    );
    const mNames = haccMasterCols.map((c: any) => c.COLUMN_NAME);
    const mLf = mNames.filter((n: string) => n.includes("Fruit") || n.includes("LOOSE"));
    console.log(`PR_HARVESTER_ACC LF cols: ${mLf.length > 0 ? mLf.join(", ") : "NONE"}`);
    console.log(`PR_HARVESTER_ACC: ${mNames.join(", ")}`);
    const mSample = await prodDb.query("SELECT TOP 2 * FROM PR_HARVESTER_ACC");
    console.log(`PR_HARVESTER_ACC sample: ${JSON.stringify(mSample).slice(0, 500)}`);
  } catch {}
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
