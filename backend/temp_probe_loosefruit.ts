process.env.LOG_TO_FILE = "false";
process.env.CLEAR_LOGS_ON_STARTUP = "false";
import { Database } from "../backend/src/db/client";

const stagingDb = Database.getStagingInstance();
const prodDb = Database.getInstance();
const CATALOG = "staging_PTRJ_iFES_Plantware";

async function main() {
  // 1. Cek semua tabel LOOSEFRUIT di db_ptrj
  for (const tbl of ["PR_LOOSEFRUIT", "PR_LOOSEFRUIT_ARC", "PR_LOOSEFRUITLN", "PR_LOOSEFRUITLN_ACC", "PR_LOOSEFRUITLN_ARC"]) {
    try {
      const cols = await prodDb.query(
        `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${tbl}'`,
      );
      console.log(`\n${tbl}:`, cols.map((c: any) => c.COLUMN_NAME).join(", "));

      const sample = await prodDb.query(`SELECT TOP 3 * FROM ${tbl} ORDER BY ID DESC`);
      console.log(`  Sample:`, JSON.stringify(sample, null, 2).slice(0, 800));
    } catch (e: any) {
      console.log(`\n${tbl}: ERROR - ${e.message}`);
    }
  }

  // 2. Cek Ffbscannerdata: LOOSEFRUIT distribution
  const lfStats = await stagingDb.query<any>(
    `SELECT
       SUM(CAST(LOOSEFRUIT AS INT)) as total_loosefruit,
       COUNT(*) as total_trx,
       COUNT(DISTINCT WORKERCODE) as distinct_workers,
       COUNT(DISTINCT CAST(TRANSDATE AS DATE)) as distinct_days,
       MIN(TRANSDATE) as min_date, MAX(TRANSDATE) as max_date
     FROM [${CATALOG}].[dbo].[Ffbscannerdata]
     WHERE CAST(LOOSEFRUIT AS INT) > 0`,
  );
  console.log(`\n\n=== Ffbscannerdata LOOSEFRUIT stats ===`);
  console.log(`  Total LF: ${lfStats?.[0]?.total_loosefruit ?? 0}`);
  console.log(`  Trx with LF>0: ${lfStats?.[0]?.total_trx ?? 0}`);
  console.log(`  Workers: ${lfStats?.[0]?.distinct_workers ?? 0}`);
  console.log(`  Days: ${lfStats?.[0]?.distinct_days ?? 0}`);
  console.log(`  Range: ${lfStats?.[0]?.min_date} → ${lfStats?.[0]?.max_date}`);

  // 3. Sample staging rows with LOOSEFRUIT > 0
  const sampleLf = await stagingDb.query<any>(
    `SELECT TOP 10 ID, FROMOCCODE, WORKERCODE, FIELDNO, TASKNO,
            RIPE, UNRIPE, LOOSEFRUIT, TRANSNO, TRANSDATE
     FROM [${CATALOG}].[dbo].[Ffbscannerdata]
     WHERE CAST(LOOSEFRUIT AS INT) > 0
     ORDER BY TRANSDATE DESC`,
  );
  console.log(`\n=== Sample staging LF rows ===`);
  for (const r of sampleLf) {
    console.log(`  ${r.TRANSDATE} | ${r.WORKERCODE} | field=${r.FIELDNO} | ripe=${r.RIPE} | LF=${r.LOOSEFRUIT} | transno=${r.TRANSNO}`);
  }

  // 4. Check PR_LOOSEFRUIT sample
  const samplePl = await prodDb.query<any>("SELECT TOP 5 * FROM PR_LOOSEFRUIT ORDER BY ID DESC");
  console.log(`\n=== PR_LOOSEFRUIT sample ===`);
  for (const r of samplePl) {
    console.log(`  ${JSON.stringify(r).slice(0, 300)}`);
  }

  // 5. Check count: Ffbscannerdata LOOSEFRUIT vs PR_LOOSEFRUIT
  const totalLfStaging = await stagingDb.queryOne<any>(
    `SELECT COUNT(*) as cnt, SUM(CAST(LOOSEFRUIT AS INT)) as total
     FROM [${CATALOG}].[dbo].[Ffbscannerdata]
     WHERE CAST(LOOSEFRUIT AS INT) > 0`,
  );
  const totalLfProd = await prodDb.queryOne<any>(
    `SELECT COUNT(*) as cnt FROM PR_LOOSEFRUIT WITH (NOLOCK)`,
  );
  const totalLfLnProd = await prodDb.queryOne<any>(
    `SELECT COUNT(*) as cnt FROM PR_LOOSEFRUITLN WITH (NOLOCK)`,
  );
  console.log(`\n=== Total counts ===`);
  console.log(`  Ffbscannerdata (LF>0): ${totalLfStaging?.cnt ?? 0} rows, ${totalLfStaging?.total ?? 0} total`);
  console.log(`  PR_LOOSEFRUIT: ${totalLfProd?.cnt ?? 0} rows`);
  console.log(`  PR_LOOSEFRUITLN: ${totalLfLnProd?.cnt ?? 0} rows`);

  // 6. Try to match by TRANSNO (Ffbscannerdata) with something in PR_LOOSEFRUIT
  const sampleTransNo = sampleLf.map((r: any) => String(r.TRANSNO).trim());
  if (sampleTransNo.length > 0) {
    const ph = sampleTransNo.map(() => "?").join(",");
    // Check if TRANSNO maps to any field in PR_LOOSEFRUIT
    const colsPl = await prodDb.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PR_LOOSEFRUIT'",
    );
    const colNames = colsPl.map((c: any) => c.COLUMN_NAME);
    console.log(`\n  Trying to match TRANSNO against PR_LOOSEFRUIT columns: ${colNames.join(", ")}`);

    // Try matching TRANSNO against various columns
    for (const col of colNames) {
      try {
        const matchCount = await prodDb.queryOne<any>(
          `SELECT COUNT(*) as cnt FROM PR_LOOSEFRUIT WITH (NOLOCK) WHERE [${col}] IN (${ph})`,
          sampleTransNo,
        );
        if (matchCount && matchCount.cnt > 0) {
          console.log(`  MATCH: PR_LOOSEFRUIT.${col} matches ${matchCount.cnt}/${sampleTransNo.length} staging TRANSNO`);
        }
      } catch {}
    }
  }

  // 7. Ffbscannerdata → PR_HARVESTERLN_ARC: check LOOSEFRUIT match for same worker+date
  console.log(`\n\n=== Ffbscannerdata LOOSEFRUIT vs PR_HARVESTERLN_ARC (LF field) ===`);

  // Check if PR_HARVESTERLN_ARC has a loosefruit field
  const harcCols = await prodDb.query(
    "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PR_HARVESTERLN_ARC'",
  );
  const harcNames = harcCols.map((c: any) => c.COLUMN_NAME);
  console.log(`PR_HARVESTERLN_ARC has LooseFruit? ${harcNames.includes("LooseFruit") || harcNames.includes("LOOSEFRUIT")}`);
  console.log(`Columns: ${harcNames.join(", ")}`);

  // Check PR_HARVESTERLN_ACC
  const haccCols = await prodDb.query(
    "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PR_HARVESTERLN_ACC'",
  );
  const haccNames = haccCols.map((c: any) => c.COLUMN_NAME);
  console.log(`\nPR_HARVESTERLN_ACC columns: ${haccNames.join(", ")}`);

  // Check if TRANSNO from Ffbscanner maps to TrxID in PR_HARVESTERLN_ACC
  console.log(`\n  Trying TRANSNO → PR_HARVESTERLN_ACC.TrxID...`);
  try {
    const match = await prodDb.queryOne<any>(
      `SELECT COUNT(*) as cnt FROM PR_HARVESTERLN_ACC WITH (NOLOCK) WHERE TrxID IN (${sampleTransNo.map(() => "?").join(",")})`,
      sampleTransNo,
    );
    console.log(`  Match: ${match?.cnt ?? 0}/${sampleTransNo.length}`);
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
  }

  // 8. Check PR_HARVESTERLN_ARC for a loosefruit-type column
  // The staging has LooseFruit, maybe in HARVESTERLN_ARC it's stored as ABW or TotalBunches or similar?
  const arcSample = await prodDb.query<any>(
    `SELECT TOP 3 * FROM PR_HARVESTERLN_ARC ORDER BY ID DESC`,
  );
  console.log(`\nPR_HARVESTERLN_ARC sample:`);
  for (const r of arcSample) {
    console.log(`  ${JSON.stringify(r).slice(0, 500)}`);
  }

  // 9. Try to link Ffbscannerdata.PM_* to PR_TASKCODE to understand what PM codes mean
  // PM codes are likely "Panen Manual" / harvesting related
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
