import { Database } from "../db/client";

const db = Database.getInstance(undefined, "SERVER_PROFILE_2");

// Cari semua employee AB1 yang punya attendance di Januari 2026
const employeesWithAtt = await db.query(`
  SELECT DISTINCT
    RTRIM(trl.EmpCode) as emp_code,
    COUNT(DISTINCT trl.TrxDate) as hk
  FROM PR_TASKREGLN trl
  JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
  JOIN HR_EMPLOYEE e ON RTRIM(e.EmpCode) = RTRIM(trl.EmpCode)
  WHERE RTRIM(e.LocCode) = 'AB1'
    AND trl.TrxDate >= '2026-01-01' AND trl.TrxDate < '2026-02-01'
    AND trl.OT = 0
  GROUP BY RTRIM(trl.EmpCode)
`);

console.log('Employees with attendance:', employeesWithAtt.length);

const empCodes = employeesWithAtt.map((e: any) => `'${e.emp_code}'`).join(',');

// Cek berapa yang punya HK = 0 tapi mungkin ada cuti (otomatis di-generate oleh sistem untuk minggu/libur)
const zeroHkEmployees = employeesWithAtt.filter((e: any) => e.hk === 0);
console.log('Employees with 0 HK:', zeroHkEmployees.length);

// Cari employee yang punya HK dari weekdays (bukan minggu/libur)
const weekdayHk = await db.query(`
  SELECT RTRIM(trl.EmpCode) as emp_code, COUNT(DISTINCT trl.TrxDate) as hk
  FROM PR_TASKREGLN trl
  JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
  WHERE RTRIM(trl.EmpCode) IN (${empCodes})
    AND trl.TrxDate >= '2026-01-01' AND trl.TrxDate < '2026-02-01'
    AND trl.OT = 0
    AND DATENAME(weekday, trl.TrxDate) NOT IN ('Sunday', 'Jumat')
  GROUP BY RTRIM(trl.EmpCode)
`);

console.log('Employees with weekday HK:', weekdayHk.length);

// Group by HK value
const hkCounts: Record<number, number> = {};
for (const emp of employeesWithAtt) {
  const hk = emp.hk;
  hkCounts[hk] = (hkCounts[hk] || 0) + 1;
}

console.log('\nDistribution by HK:');
for (const [hk, count] of Object.entries(hkCounts).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
  console.log(`  ${hk} HK: ${count} employees`);
}

process.exit(0);
