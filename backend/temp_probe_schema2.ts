process.env.LOG_TO_FILE = "false";
process.env.CLEAR_LOGS_ON_STARTUP = "false";
import { Database } from "../backend/src/db/client";

const prodDb = Database.getInstance();

async function main() {
  // PR_TASKREG columns
  let cols = await prodDb.query(
    "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PR_TASKREG'",
  );
  console.log("PR_TASKREG:", cols.map((c: any) => c.COLUMN_NAME).join(", "));

  // PR_TASKREGLN columns
  cols = await prodDb.query(
    "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PR_TASKREGLN'",
  );
  console.log("\nPR_TASKREGLN:", cols.map((c: any) => c.COLUMN_NAME).join(", "));

  // PR_TASKREGLN_ACC columns
  cols = await prodDb.query(
    "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PR_TASKREGLN_ACC'",
  );
  console.log("\nPR_TASKREGLN_ACC:", cols.map((c: any) => c.COLUMN_NAME).join(", "));

  // PR_TASKREGLN_ARC columns
  cols = await prodDb.query(
    "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PR_TASKREGLN_ARC'",
  );
  console.log("\nPR_TASKREGLN_ARC:", cols.map((c: any) => c.COLUMN_NAME).join(", "));

  // PR_ADTRANS columns
  cols = await prodDb.query(
    "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PR_ADTRANS'",
  );
  console.log("\nPR_ADTRANS:", cols.map((c: any) => c.COLUMN_NAME).join(", "));

  // PR_ADTRANSLN columns
  cols = await prodDb.query(
    "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PR_ADTRANSLN'",
  );
  console.log("\nPR_ADTRANSLN:", cols.map((c: any) => c.COLUMN_NAME).join(", "));

  // PR_ADTRANSLN_ACC columns
  cols = await prodDb.query(
    "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PR_ADTRANSLN_ACC'",
  );
  console.log("\nPR_ADTRANSLN_ACC:", cols.map((c: any) => c.COLUMN_NAME).join(", "));

  // Sample PR_TASKREG row
  const sample = await prodDb.query("SELECT TOP 3 * FROM PR_TASKREG ORDER BY ID DESC");
  console.log("\nPR_TASKREG sample:", JSON.stringify(sample, null, 2).slice(0, 1000));

  // Sample PR_TASKREGLN row
  const sample2 = await prodDb.query("SELECT TOP 3 * FROM PR_TASKREGLN ORDER BY ID DESC");
  console.log("\nPR_TASKREGLN sample:", JSON.stringify(sample2, null, 2).slice(0, 1000));

  // Sample PR_ADTRANS row
  const sample3 = await prodDb.query("SELECT TOP 3 * FROM PR_ADTRANS ORDER BY ID DESC");
  console.log("\nPR_ADTRANS sample:", JSON.stringify(sample3, null, 2).slice(0, 1000));

  // Check how overtime is stored in PR_ADTRANS — look for DocDesc like OT, LEMBUR
  const otTypes = await prodDb.query(
    "SELECT DISTINCT TOP 20 DocDesc FROM PR_ADTRANS WHERE DocDesc LIKE '%LEMBUR%' OR DocDesc LIKE '%OT%' OR DocDesc LIKE '%OVERTIME%'",
  );
  console.log("\nPR_ADTRANS DocDesc (OT related):", otTypes.map((r: any) => r.DocDesc));

  // Overtime also could be in PR_MTHRATEDOT
  cols = await prodDb.query(
    "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PR_MTHRATEDOT'",
  );
  console.log("\nPR_MTHRATEDOT:", cols.map((c: any) => c.COLUMN_NAME).join(", "));

  // PR_MTHRATEDOTLN columns
  cols = await prodDb.query(
    "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PR_MTHRATEDOTLN'",
  );
  console.log("\nPR_MTHRATEDOTLN:", cols.map((c: any) => c.COLUMN_NAME).join(", "));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
