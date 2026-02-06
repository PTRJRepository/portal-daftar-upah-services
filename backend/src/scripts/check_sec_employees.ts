import { Database } from "../db/client";

const db = Database.getInstance(undefined, "SERVER_PROFILE_2");

// Cari employee SEC yang punya LocCode AB1
const secEmployees = await db.query(`
  SELECT DISTINCT
    RTRIM(e.EmpCode) as emp_code,
    e.EmpName as emp_name,
    RTRIM(e.LocCode) as loc_code,
    RTRIM(gl.GangCode) as gang_code
  FROM HR_EMPLOYEE e
  INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
  WHERE RTRIM(e.LocCode) = 'AB1'
    AND RTRIM(gl.GangCode) = 'SEC'
`);

console.log('SEC employees with LocCode AB1:', secEmployees.length);
for (const emp of secEmployees) {
  console.log(`  ${emp.emp_code} - ${emp.emp_name}`);
}

// Cek apakah employee SEC punya attendance di Januari 2026
const empCodes = secEmployees.map((e: any) => `'${e.emp_code}'`).join(',');
const attendance = await db.query(`
  SELECT RTRIM(EmpCode) as emp_code, COUNT(DISTINCT TrxDate) as hk
  FROM PR_TASKREGLN trl
  JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
  WHERE RTRIM(trl.EmpCode) IN (${empCodes})
    AND trl.TrxDate >= '2026-01-01' AND trl.TrxDate < '2026-02-01'
    AND trl.OT = 0
  GROUP BY RTRIM(EmpCode)
`);

console.log('\nSEC employees with attendance in Jan 2026:', attendance.length);
for (const att of attendance) {
  console.log(`  ${att.emp_code} - HK: ${att.hk}`);
}

process.exit(0);
