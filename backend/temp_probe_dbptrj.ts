process.env.LOG_TO_FILE = "false";
process.env.CLEAR_LOGS_ON_STARTUP = "false";
import { Database } from "../backend/src/db/client";

const db = Database.getInstance();

async function go() {
  // Check PR_HARVESTERLN_ACC columns
  const haccCols = await db.query(
    "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PR_HARVESTERLN_ACC'",
  );
  console.log("PR_HARVESTERLN_ACC:", haccCols.map((c: any) => c.COLUMN_NAME).join(", "));

  // PR_HARVESTERLN_ARC columns
  const harcCols = await db.query(
    "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PR_HARVESTERLN_ARC'",
  );
  console.log("\nPR_HARVESTERLN_ARC:", harcCols.map((c: any) => c.COLUMN_NAME).join(", "));

  // List ALL db_ptrj tables
  const tables = await db.query(
    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_CATALOG = 'db_ptrj' AND TABLE_SCHEMA = 'dbo' AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME",
  );
  const names = tables.map((t: any) => t.TABLE_NAME);
  console.log("\nTotal tables in db_ptrj:", names.length);

  // Keyword search
  const keywords = ["GWS", "OVERTIME", "LEAVE", "HOLIDAY", "EMPLOYEE", "SCANNER", "MILL", "FIELD", "VEHICLE", "PIECEMEAL", "HALFDAY", "ALLOWABLE", "ATTENDANCE", "TASKREG", "ADTRANS", "WEIGHT", "JOB", "WDR", "PIECE", "HOLIDAY"];
  for (const kw of keywords) {
    const found = names.filter((n: string) => n.toUpperCase().includes(kw));
    if (found.length) {
      console.log(`  [${kw}] ${found.join(", ")}`);
    }
  }

  // Show all PR_ tables
  const prTables = names.filter((n: string) => n.startsWith("PR_"));
  console.log(`\nAll PR_ tables (${prTables.length}):`);
  prTables.forEach((t: string) => console.log("  " + t));
}

go()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
