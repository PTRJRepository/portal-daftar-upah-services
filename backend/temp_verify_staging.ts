process.env.LOG_TO_FILE = "false";
process.env.CLEAR_LOGS_ON_STARTUP = "false";
import { Database } from "../backend/src/db/client";

const stagingDb = Database.getStagingInstance();
const prodDb = Database.getInstance();
const CATALOG = "staging_PTRJ_iFES_Plantware";

async function main() {
  console.log("=".repeat(100));
  console.log("VERIFIKASI KEHADIRAN STAGING di db_ptrj");
  console.log("Gwscannerdata → PR_TASKREGLN / PR_TASKREGLN_ARC");
  console.log("Overtime → PR_TASKREGLN (OT=true) / PR_MTHRATEDOTLN");
  console.log("=".repeat(100));

  // ============================================================
  // VERIFIKASI 1: Gwscannerdata → PR_TASKREGLN
  // ============================================================
  console.log("\n\n=== GWS: Cek JOBCODE yang ada di staging ===");
  const gwsTaskCodes = await stagingDb.query<any>(
    `SELECT DISTINCT TOP 20 JOBCODE FROM [${CATALOG}].[dbo].[Gwscannerdata] WHERE JOBCODE IS NOT NULL AND JOBCODE != ''`,
  );
  for (const tc of gwsTaskCodes) {
    const jc = String(tc.JOBCODE).trim();
    const prodTc = await prodDb.queryOne<any>(
      "SELECT TaskCode FROM PR_TASKCODE WHERE TaskCode LIKE ?",
      [`%${jc}%`],
    );
    console.log(`  Staging JOBCODE: '${jc}' → PR_TASKCODE: ${prodTc ? prodTc.TaskCode : 'NOT FOUND'}`);
  }

  // Check PR_TASKCODE sample
  const taskCodes = await prodDb.query("SELECT TOP 10 TaskCode FROM PR_TASKCODE");
  console.log("\nPR_TASKCODE samples:", taskCodes.map((r: any) => r.TaskCode).join("\n  "));

  // ============================================================
  // VERIFIKASI 2: Match by WORKERCODE+TRANS_DATE+JOBCODE
  // ============================================================
  console.log("\n\n=== GWS: Match by WORKERCODE+DATE ===");
  // Pick ONE day: May 28, 2026
  const testDate = "2026-05-28";
  const stagingGwsDay = await stagingDb.query<any>(
    `SELECT TOP 20 WORKERCODE, JOBCODE, TRANSNO, TRANSDATE, FIELDNO
     FROM [${CATALOG}].[dbo].[Gwscannerdata]
     WHERE CAST(TRANSDATE AS DATE) = '${testDate}'
       AND WORKERCODE IS NOT NULL
       AND JOBCODE IS NOT NULL
     ORDER BY WORKERCODE`,
  );
  console.log(`Staging GWS data for ${testDate}: ${stagingGwsDay.length} rows`);

  let matchCount = 0;
  let missCount = 0;
  for (const s of stagingGwsDay.slice(0, 10)) {
    const empCode = String(s.WORKERCODE).trim();
    const jobCode = String(s.JOBCODE).trim();

    // Check in PR_TASKREGLN (current month-end)
    const lnMatch = await prodDb.queryOne<any>(
      `SELECT ID, EmpCode, TaskCode, Hours, Amount, OT
       FROM PR_TASKREGLN WITH (NOLOCK)
       WHERE EmpCode = ? AND CAST(TrxDate AS DATE) = ? AND TaskCode LIKE ?
       ORDER BY ID DESC`,
      [empCode, testDate, `%${jobCode}%`],
    );
    if (lnMatch) {
      matchCount++;
      console.log(`  ✓ ${empCode} | ${jobCode} → TASKREGLN: TaskCode=${lnMatch.TaskCode} Hours=${lnMatch.Hours} OT=${lnMatch.OT}`);
    } else {
      // Check in ARC
      const arcMatch = await prodDb.queryOne<any>(
        `SELECT ID, EmpCode, TaskCode, Hours, Amount, OT
         FROM PR_TASKREGLN_ARC WITH (NOLOCK)
         WHERE EmpCode = ? AND CAST(TrxDate AS DATE) = ? AND TaskCode LIKE ?
         ORDER BY ID DESC`,
        [empCode, testDate, `%${jobCode}%`],
      );
      if (arcMatch) {
        matchCount++;
        console.log(`  ~ ${empCode} | ${jobCode} → TASKREGLN_ARC: TaskCode=${arcMatch.TaskCode} Hours=${arcMatch.Hours} OT=${arcMatch.OT}`);
      } else {
        missCount++;
        console.log(`  ✗ ${empCode} | ${jobCode} → NOT FOUND in TASKREGLN or ARC`);
        // Check just by EmpCode+Date to see what's there
        const anyWork = await prodDb.query<any>(
          `SELECT TOP 3 TaskCode, OT, Hours FROM PR_TASKREGLN WITH (NOLOCK)
           WHERE EmpCode = ? AND CAST(TrxDate AS DATE) = ?`,
          [empCode, testDate],
        );
        if (anyWork.length > 0) {
          console.log(`    Found other work for ${empCode}: ${anyWork.map((r: any) => `${r.TaskCode}(OT=${r.OT},H=${r.Hours})`).join(", ")}`);
        }
      }
    }
  }
  console.log(`Match: ${matchCount}, Not found: ${missCount}`);

  // ============================================================
  // VERIFIKASI 3: Overtime → PR_TASKREGLN (OT=true) or PR_MTHRATEDOTLN
  // ============================================================
  console.log("\n\n=== OVERTIME: Verify where OT goes in db_ptrj ===");
  console.log(`\nStaging Overtime data for ${testDate}:`);

  const stagingOTDay = await stagingDb.query<any>(
    `SELECT TOP 10 WORKERCODE, JOBCODE, HOURS, BASICRATE, ADDRATE, TRANSNO, TRANSDATE
     FROM [${CATALOG}].[dbo].[Overtime]
     WHERE CAST(TRANSDATE AS DATE) = '${testDate}'
     ORDER BY WORKERCODE`,
  );
  console.log(`Found ${stagingOTDay.length} overtime rows for ${testDate}`);

  for (const s of stagingOTDay) {
    const empCode = String(s.WORKERCODE).trim();
    const jobCode = String(s.JOBCODE || "").trim();

    // Check in PR_TASKREGLN where OT=true
    const taskOtmatch = await prodDb.queryOne<any>(
      `SELECT ID, EmpCode, TaskCode, Hours, Rate, Amount
       FROM PR_TASKREGLN WITH (NOLOCK)
       WHERE EmpCode = ? AND CAST(TrxDate AS DATE) = ? AND OT = 1
       ORDER BY ID DESC`,
      [empCode, testDate],
    );
    if (taskOtmatch) {
      console.log(`  ✓ ${empCode} | ${jobCode} | H=${s.HOURS} → TASKREGLN(OT=true): TaskCode=${taskOtmatch.TaskCode} H=${taskOtmatch.Hours}`);
      continue;
    }

    // Check PR_MTHRATEDOTLN
    const dotMatch = await prodDb.queryOne<any>(
      `SELECT ID, EmpCode, Hours, Rate, Amount
       FROM PR_MTHRATEDOTLN WITH (NOLOCK)
       WHERE EmpCode = ? AND CAST(StartDate AS DATE) = ?
       ORDER BY ID DESC`,
      [empCode, testDate],
    );
    if (dotMatch) {
      console.log(`  ✓ ${empCode} | ${jobCode} | H=${s.HOURS} → MTHRATEDOTLN: H=${dotMatch.Hours}`);
      continue;
    }

    // Check ARC
    const arcOtMatch = await prodDb.queryOne<any>(
      `SELECT ID, EmpCode, TaskCode, Hours
       FROM PR_TASKREGLN_ARC WITH (NOLOCK)
       WHERE EmpCode = ? AND CAST(TrxDate AS DATE) = ? AND OT = 1
       ORDER BY ID DESC`,
      [empCode, testDate],
    );
    if (arcOtMatch) {
      console.log(`  ~ ${empCode} | ${jobCode} | H=${s.HOURS} → TASKREGLN_ARC(OT=true): H=${arcOtMatch.Hours}`);
    } else {
      console.log(`  ✗ ${empCode} | ${jobCode} | H=${s.HOURS} → NOT FOUND anywhere`);
      // Show all TASKREGLN entries for this emp+date
      const anyWork = await prodDb.query<any>(
        `SELECT TOP 5 TaskCode, OT, Hours FROM PR_TASKREGLN WITH (NOLOCK) WHERE EmpCode = ? AND CAST(TrxDate AS DATE) = ?`,
        [empCode, testDate],
      );
      if (anyWork.length > 0) {
        console.log(`    Found: ${anyWork.map((r: any) => `${r.TaskCode}(OT=${r.OT},H=${r.Hours})`).join(", ")}`);
      }
    }
  }

  // ============================================================
  // VERIFIKASI 4: Count per day comparison for May 2026
  // ============================================================
  console.log("\n\n=== DAILY COMPARISON (May 2026, top 10 days) ===");
  const stagingDailyGws = await stagingDb.query<any>(
    `SELECT CAST(TRANSDATE AS DATE) as tgl, COUNT(*) as cnt
     FROM [${CATALOG}].[dbo].[Gwscannerdata]
     WHERE YEAR(TRANSDATE)=2026 AND MONTH(TRANSDATE)=5
     GROUP BY CAST(TRANSDATE AS DATE) ORDER BY cnt DESC`,
  );
  const stagingDailyMap = new Map(stagingDailyGws.map((r: any) => [r.tgl, r.cnt]));
  console.log(`  ${"Date".padEnd(14)} ${"Staging GWS".padEnd(14)} ${"Prod TASKREGLN".padEnd(18)} ${"Prod ARC".padEnd(14)}`);
  for (const row of stagingDailyGws.slice(0, 10)) {
    const dt = row.tgl;
    const prod = await prodDb.queryOne<any>(
      "SELECT COUNT(*) as cnt FROM PR_TASKREGLN WITH (NOLOCK) WHERE CAST(TrxDate AS DATE) = ?", [dt],
    );
    const arc = await prodDb.queryOne<any>(
      "SELECT COUNT(*) as cnt FROM PR_TASKREGLN_ARC WITH (NOLOCK) WHERE CAST(TrxDate AS DATE) = ?", [dt],
    );
    console.log(`  ${String(dt).padEnd(14)} ${String(row.cnt).padEnd(14)} ${String(prod?.cnt ?? 0).padEnd(18)} ${String(arc?.cnt ?? 0).padEnd(14)}`);
  }

  console.log("\n\n=== OVERTIME Daily Comparison (May 2026, top 10 days) ===");
  const stagingDailyOT = await stagingDb.query<any>(
    `SELECT CAST(TRANSDATE AS DATE) as tgl, COUNT(*) as cnt,
            SUM(HOURS) as total_hours
     FROM [${CATALOG}].[dbo].[Overtime]
     WHERE YEAR(TRANSDATE)=2026 AND MONTH(TRANSDATE)=5
     GROUP BY CAST(TRANSDATE AS DATE) ORDER BY cnt DESC`,
  );
  for (const row of stagingDailyOT.slice(0, 10)) {
    const dt = row.tgl;
    const taskReg = await prodDb.queryOne<any>(
      "SELECT COUNT(*) as cnt, SUM(Hours) as total_hours FROM PR_TASKREGLN WITH (NOLOCK) WHERE CAST(TrxDate AS DATE) = ? AND OT=1",
      [dt],
    );
    const dotReg = await prodDb.queryOne<any>(
      "SELECT COUNT(*) as cnt, SUM(Hours) as total_hours FROM PR_MTHRATEDOTLN WITH (NOLOCK) WHERE CAST(StartDate AS DATE) = ?",
      [dt],
    );
    console.log(`  ${String(dt).padEnd(14)} staging:${String(row.cnt).padStart(6)}h=${String(row.total_hours).padStart(8)} taskreg:${String(taskReg?.cnt ?? 0).padStart(6)}h=${String(taskReg?.total_hours ?? 0).padStart(8)} ratedot:${String(dotReg?.cnt ?? 0).padStart(6)}h=${String(dotReg?.total_hours ?? 0).padStart(8)}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
