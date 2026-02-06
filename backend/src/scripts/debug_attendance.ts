import { Database } from "../db/client";

const db = Database.getInstance(undefined, "SERVER_PROFILE_2");

// Coba sederhana - employee dengan attendance Jan 2025
const result = await db.query(`
  SELECT TOP 10
    RTRIM(trl.EmpCode) as emp_code,
    COUNT(DISTINCT trl.TrxDate) as hk
  FROM PR_TASKREGLN trl
  WHERE trl.TrxDate >= '2025-01-01' AND trl.TrxDate < '2025-02-01'
    AND trl.OT = 0
  GROUP BY RTRIM(trl.EmpCode)
`);

console.log('Sample employees with attendance Jan 2026:', result.length);

for (const row of result) {
  console.log(`  ${row.emp_code} - HK: ${row.hk}`);
}

// Cek LocCode untuk employee ini
const empCode = result[0]?.emp_code;
if (empCode) {
  const emp = await db.query(`
    SELECT RTRIM(EmpCode) as emp_code, EmpName, RTRIM(LocCode) as loc_code
    FROM HR_EMPLOYEE
    WHERE RTRIM(EmpCode) = ?
  `, [empCode]);

  console.log('\nSample employee LocCode:', emp[0]);
}

process.exit(0);
