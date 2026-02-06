import { Database } from "../db/client";

const db = Database.getInstance(undefined, "SERVER_PROFILE_2");

const empCode = 'G0034';

console.log('=== CEK CUTI JAMILA (G0034) ===');

// Cek di HR_CUTI atau PR_CUTI
const cuti = await db.query(`
  SELECT
    RTRIM(EmpCode) as emp_code,
    LeaveType as leave_type,
    StartDate as start_date,
    EndDate as end_date,
    Days as days
  FROM HR_CUTI
  WHERE RTRIM(EmpCode) = ?
    AND (StartDate >= '2026-01-01' AND StartDate < '2026-02-01')
    OR (EndDate >= '2026-01-01' AND EndDate < '2026-02-01')
`, [empCode]);

console.log('\n1. Cuti dari HR_CUTI:', cuti.length);
if (cuti.length > 0) {
  for (const c of cuti) {
    console.log(`   ${c.leave_type} - ${c.start_date} to ${c.end_date} - ${c.days} hari`);
  }
}

// Cek attendance JAMILA di Januari
const att = await db.query(`
  SELECT COUNT(DISTINCT TrxDate) as hk, SUM(Hours) as total_hours
  FROM PR_TASKREGLN trl
  JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
  WHERE RTRIM(trl.EmpCode) = ?
    AND trl.TrxDate >= '2026-01-01' AND trl.TrxDate < '2026-02-01'
    AND trl.OT = 0
`, [empCode]);

console.log('\n2. Attendance Jan 2026:', att[0].hk, 'HK,', att[0].total_hours, 'jam');

process.exit(0);
