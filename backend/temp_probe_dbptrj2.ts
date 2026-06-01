process.env.LOG_TO_FILE = "false";
process.env.CLEAR_LOGS_ON_STARTUP = "false";
import { Database } from "../backend/src/db/client";
import { Config } from "../backend/src/config";

const stagingDb = Database.getStagingInstance();
const prodDb = Database.getInstance();
const CATALOG = "staging_PTRJ_iFES_Plantware";

async function compareByEmpCode(
  stagingTable: string,
  stagingEmpCol: string,
  stagingDateCol: string,
  prodTable: string,
  prodEmpCol: string,
  prodDateCol: string,
  month: number,
  year: number,
) {
  // Get distinct staging emp codes for period
  const stagingEmps = await stagingDb.query(
    `SELECT DISTINCT TOP 50 [${stagingEmpCol}] as emp FROM [${CATALOG}].[dbo].[${stagingTable}]
     WHERE MONTH([${stagingDateCol}]) = ? AND YEAR([${stagingDateCol}]) = ? AND [${stagingEmpCol}] IS NOT NULL
     ORDER BY [${stagingEmpCol}]`,
    [month, year],
  );
  const empCodes = stagingEmps.map((r: any) => String(r.emp).trim());
  if (empCodes.length === 0) return console.log(`[SKIP] No staging data for ${month}/${year}`);

  const placeholders = empCodes.map(() => "?").join(",");
  const prodEmps = await prodDb.query(
    `SELECT DISTINCT [${prodEmpCol}] as emp FROM [${prodTable}] WITH (NOLOCK)
     WHERE [${prodEmpCol}] IN (${placeholders})`,
    empCodes,
  );
  const prodSet = new Set(prodEmps.map((r: any) => String(r.emp).trim()));
  const missing = empCodes.filter((e) => !prodSet.has(e));
  const matchPct = (((empCodes.length - missing.length) / empCodes.length) * 100).toFixed(1);

  console.log(`\n[EMP MATCH] ${stagingTable} → ${prodTable} (${month}/${year}, top 50)`);
  console.log(`  Staging emps: ${empCodes.length}`);
  console.log(`  Found in prod: ${empCodes.length - missing.length} (${matchPct}%)`);
  if (missing.length > 0) console.log(`  Missing: ${missing.join(", ")}`);
}

async function compareCounts(stagingTable: string, prodTable: string, month?: number, year?: number) {
  const stagingWhere = month ? `WHERE MONTH(TRANSDATE)=${month} AND YEAR(TRANSDATE)=${year}` : "";
  const prodWhere = month ? `WHERE MONTH(TrxDate)=${month} AND YEAR(TrxDate)=${year}` : "";
  const sCnt = await stagingDb.queryOne<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM [${CATALOG}].[dbo].[${stagingTable}] ${stagingWhere}`,
  );
  const pCnt = await prodDb.queryOne<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM ${prodTable} WITH (NOLOCK) ${prodWhere}`,
  );
  console.log(`  Counts: staging=${sCnt?.cnt ?? 0}  prod=${pCnt?.cnt ?? 0}`);
}

async function main() {
  console.log("=== DEEP MAPPING: staging vs db_ptrj ===\n");
  console.log(`${"#".padEnd(4)} ${"Staging".padEnd(30)} ${"Prod".padEnd(35)} ${"Key".padEnd(20)} ${"Match".padEnd(8)}`);

  const mappings: Array<{ s: string; p: string; key: string; match: string }> = [
    // FFB Scanner → Harvester
    { s: "Ffbscannerdata", p: "PR_HARVESTERLN_ARC", key: "WORKERCODE ↔ EmpCode", match: "STRONG (96% count)" },
    { s: "Ffbscannerdata", p: "PR_HARVESTERLN_ACC", key: "WORKERCODE ↔ EmpCode", match: "WEAK (2%)" },
    // GWS → Task Register
    { s: "Gwscannerdata", p: "PR_TASKREGLN", key: "WORKERCODE ↔ EmpCode", match: "LIKELY (GWS jobs)" },
    { s: "Gwscannerdata", p: "PR_TASKREGLN_ACC", key: "WORKERCODE ↔ EmpCode", match: "LIKELY (latest)" },
    { s: "Gwscannerdata", p: "PR_TASKREGLN_ARC", key: "WORKERCODE ↔ EmpCode", match: "LIKELY (archive)" },
    // Overtime → ADTRANS (additional hours)
    { s: "Overtime", p: "PR_ADTRANSLN", key: "WORKERCODE ↔ EmpCode", match: "LIKELY (OT = AD)" },
    { s: "Overtime", p: "PR_ADTRANSLN_ACC", key: "WORKERCODE ↔ EmpCode", match: "LIKELY" },
    { s: "Overtime", p: "PR_MTHRATEDOTLN", key: "WORKERCODE ↔ EmpCode", match: "POSSIBLE" },
    // Mill Weight → FFB Driver
    { s: "iFES_MillWeight", p: "PR_FFBDRIVER", key: "DriverEmpCode ↔ Driver", match: "LIKELY (mill weight)" },
    { s: "iFES_MillWeight", p: "PR_FFBDRIVERLN", key: "DriverEmpCode ↔ EmpCode", match: "LIKELY" },
    { s: "P3_MillWeight", p: "PR_FFBDRIVER", key: "→WBTICKETNO", match: "LIKELY (P3 mill)" },
    // Employee Info → HR_EMPLOYEE
    { s: "Employee_Info", p: "HR_EMPLOYEE", key: "Employee_Code ↔ EmpCode", match: "STRONG (master)" },
    // Workerleave → HR_LEAVETRX
    { s: "Workerleave", p: "HR_LEAVETRX", key: "EMPCODE ↔ EmpCode", match: "LIKELY" },
    // Workerholidays → HR_CPTRX_LEAVE
    { s: "Workerholidays", p: "HR_CPTRX_LEAVE", key: "EMPCODE ↔ EmpCode", match: "LIKELY" },
    // Piecemeal → PR_PIECERATE
    { s: "Piecemeal", p: "PR_PIECERATEALLOCLN", key: "WORKERCODE ↔ EmpCode", match: "POSSIBLE" },
    // Gang Number → PR_GANG/PR_GANGLN
    { s: "Gang_Number", p: "PR_GANGLN", key: "Gang_Number ↔ Gang", match: "LIKELY" },
    // Job_Code → WS_JOB
    { s: "Job_Code", p: "WS_JOBWORKCODE", key: "JobCode ↔ Code", match: "LIKELY" },
    // OC → PR_PAYDIVISION
    { s: "OC", p: "PR_PAYDIVISION", key: "Code ↔ DivCode", match: "LIKELY (estate)" },
    // Field_Profile → PR_TASKCODE
    { s: "Field_Profile", p: "RPT_Fields", key: "Field_No ↔ Field", match: "LIKELY" },
    // Halfdaywork → PR_EMP_ATTN
    { s: "Halfdaywork", p: "PR_ATTENDANCE", key: "EMPCODE ↔ EmpCode", match: "POSSIBLE" },
    // Vehicle_Code → GL_VEHICLE
    { s: "Vehicle_Code", p: "GL_VEHICLE", key: "Vehicle_No ↔ Vehicle", match: "LIKELY" },
    // Route_Path → PR_ROUTE/PR_ROUTEPATH
    { s: "Route_Path", p: "PR_ROUTEPATH", key: "Route_Path ↔ Route", match: "LIKELY" },
    // Allowable_Holidays → HR_LEAVE
    { s: "Allowable_Holidays", p: "HR_LEAVE", key: "Description ↔ Desc", match: "POSSIBLE" },
    // Checkroll_Division → PR_CHECKROLLMASTER
    { s: "Checkroll_Division", p: "PR_CHECKROLLMASTER", key: "CR_Division_Code", match: "POSSIBLE" },
  ];

  for (let i = 0; i < mappings.length; i++) {
    const m = mappings[i];
    console.log(`${String(i + 1).padEnd(4)} ${m.s.padEnd(30)} ${m.p.padEnd(35)} ${m.key.padEnd(20)} ${m.match}`);
  }

  console.log("\n=== VERIFICATION ===\n");

  // 1. Ffbscannerdata vs PR_HARVESTERLN_ARC — by date range and worker
  console.log("--- Ffbscannerdata → PR_HARVESTERLN_ARC ---");
  const sr = await stagingDb.queryOne<any>(
    `SELECT MIN(TRANSDATE) as min_d, MAX(TRANSDATE) as max_d FROM [${CATALOG}].[dbo].[Ffbscannerdata]`,
  );
  const pr = await prodDb.queryOne<any>(
    `SELECT MIN(TrxDate) as min_d, MAX(TrxDate) as max_d FROM PR_HARVESTERLN_ARC WITH (NOLOCK)`,
  );
  console.log(`  Staging range: ${sr?.min_d} → ${sr?.max_d}`);
  console.log(`  Prod range:    ${pr?.min_d} → ${pr?.max_d}`);
  await compareCounts("Ffbscannerdata", "PR_HARVESTERLN_ARC");
  await compareByEmpCode("Ffbscannerdata", "WORKERCODE", "TRANSDATE", "PR_HARVESTERLN_ARC", "EmpCode", "TrxDate", 5, 2026);

  // 2. Employee_Info vs HR_EMPLOYEE — sample EMPCODE match
  console.log("\n--- Employee_Info → HR_EMPLOYEE ---");
  const empStaging = await stagingDb.query(
    `SELECT TOP 10 Employee_Code, Fullname, New_IC FROM [${CATALOG}].[dbo].[Employee_Info] ORDER BY Employee_Code`,
  );
  const empCodes = empStaging.map((r: any) => String(r.Employee_Code).trim());
  const ph = empCodes.map(() => "?").join(",");
  const empProd = await prodDb.query(
    `SELECT TOP 10 EmpCode, EmpName, NewICNo FROM HR_EMPLOYEE WITH (NOLOCK) WHERE EmpCode IN (${ph})`,
    empCodes,
  );
  const empMap = new Map(empProd.map((r: any) => [String(r.EmpCode).trim(), r]));
  for (const s of empStaging) {
    const code = String(s.Employee_Code).trim();
    const p = empMap.get(code);
    console.log(`  ${code}: staging="${String(s.Fullname).trim().slice(0, 30)}" prod="${p ? String(p.EmpName).trim().slice(0, 30) : 'NOT FOUND'}"`);
  }

  // 3. Gwscannerdata — check PR_TASKREGLN_ARC
  console.log("\n--- Gwscannerdata → PR_TASKREGLN_ARC ---");
  try {
    const gwsRange = await stagingDb.queryOne<any>(
      `SELECT MIN(TRANSDATE) as min_d, MAX(TRANSDATE) as max_d FROM [${CATALOG}].[dbo].[Gwscannerdata]`,
    );
    await compareCounts("Gwscannerdata", "PR_TASKREGLN_ARC");
    await compareByEmpCode("Gwscannerdata", "WORKERCODE", "TRANSDATE", "PR_TASKREGLN_ARC", "EmpCode", "TrxDate", 5, 2026);
    // Also check ACC
    await compareCounts("Gwscannerdata", "PR_TASKREGLN_ACC");
    await compareByEmpCode("Gwscannerdata", "WORKERCODE", "TRANSDATE", "PR_TASKREGLN_ACC", "EmpCode", "TrxDate", 5, 2026);
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
  }

  // 4. Overtime → PR_MTHRATEDOTLN or PR_ADTRANSLN
  console.log("\n--- Overtime → PR_ADTRANSLN_ACC ---");
  try {
    await compareCounts("Overtime", "PR_ADTRANSLN_ACC");
    await compareByEmpCode("Overtime", "WORKERCODE", "TRANSDATE", "PR_ADTRANSLN_ACC", "EmpCode", "TrxDate", 5, 2026);
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
  }
  console.log("--- Overtime → PR_MTHRATEDOTLN_ACC ---");
  try {
    await compareCounts("Overtime", "PR_MTHRATEDOTLN_ACC");
    await compareByEmpCode("Overtime", "WORKERCODE", "TRANSDATE", "PR_MTHRATEDOTLN_ACC", "EmpCode", "TrxDate", 5, 2026);
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
  }

  // 5. iFES_MillWeight → PR_FFBDRIVER
  console.log("\n--- iFES_MillWeight → PR_FFBDRIVERLN ---");
  try {
    // Check Driver table columns
    const driverCols = await prodDb.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PR_FFBDRIVERLN'`,
    );
    console.log(`  PR_FFBDRIVERLN cols: ${driverCols.map((c: any) => c.COLUMN_NAME).join(", ")}`);
    // iFES has DriverEmpCode
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
  }

  // 6. Workerleave & Workerholidays
  console.log("\n--- Workerleave → HR_LEAVETRX ---");
  try {
    await compareCounts("Workerleave", "HR_LEAVETRX");
    await compareByEmpCode("Workerleave", "EMPCODE", "LEAVEDATE", "HR_LEAVETRX", "EmpCode", "LeDate", 5, 2026);
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
