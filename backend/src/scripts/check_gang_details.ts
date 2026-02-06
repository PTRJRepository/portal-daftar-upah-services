import { Database } from "../db/client";

const db = Database.getInstance(undefined, "SERVER_PROFILE_2");

// Semua employee AB1 dengan gang assignment yang punya attendance
const allWithAttendance = await db.query(`
  SELECT DISTINCT
    RTRIM(e.EmpCode) as emp_code,
    e.EmpName as emp_name,
    RTRIM(gl.GangCode) as gang_code
  FROM HR_EMPLOYEE e
  INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
  WHERE RTRIM(e.LocCode) = 'AB1'
    AND gl.GangCode IS NOT NULL AND gl.GangCode != ''
`);

console.log('Total AB1 employees with gang assignment:', allWithAttendance.length);

// Cari employee yang punya attendance di Januari 2026
const empCodes = allWithAttendance.map((e: any) => `'${e.emp_code}'`).join(',');

const attendance = await db.query(`
  SELECT RTRIM(trl.EmpCode) as emp_code, COUNT(DISTINCT trl.TrxDate) as hk
  FROM PR_TASKREGLN trl
  JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
  WHERE RTRIM(trl.EmpCode) IN (${empCodes})
    AND trl.TrxDate >= '2026-01-01' AND trl.TrxDate < '2026-02-01'
    AND trl.OT = 0
  GROUP BY RTRIM(trl.EmpCode)
`);

console.log('Total AB1 with gang assignment AND attendance:', attendance.length);

// Group by gang
const gangCounts: Record<string, number> = {};
const empWithAttByGang: Record<string, string[]> = {};

for (const att of attendance) {
  // Find gang for this employee
  const emp = allWithAttendance.find((e: any) => e.emp_code === att.emp_code);
  if (emp) {
    const gc = emp.gang_code;
    gangCounts[gc] = (gangCounts[gc] || 0) + 1;
    if (!empWithAttByGang[gc]) empWithAttByGang[gc] = [];
    empWithAttByGang[gc].push(att.emp_code);
  }
}

console.log('\nEmployees with attendance by Gang:', gangCounts);
console.log('Total:', Object.values(gangCounts).reduce((a, b) => a + b, 0));

// Compare with HR_GANG
const gangsInHrGang = await db.query(`
  SELECT DISTINCT GangCode
  FROM HR_GANG
  WHERE RTRIM(LocCode) = 'AB1'
`);

const hrGangCodes = new Set(gangsInHrGang.map((g: any) => g.GangCode.trim()));

console.log('\nGangs in HR_GANG for AB1:', Array.from(hrGangCodes).sort());

// Find employees with attendance whose gang is NOT in HR_GANG
console.log('\nEmployees with attendance but gang NOT in HR_GANG:');
let countNotInHrGang = 0;
for (const att of attendance) {
  const emp = allWithAttendance.find((e: any) => e.emp_code === att.emp_code);
  if (emp && !hrGangCodes.has(emp.gang_code)) {
    console.log(`  ${att.emp_code} - ${emp.emp_name} - Gang: ${emp.gang_code} - HK: ${att.hk}`);
    countNotInHrGang++;
  }
}
console.log('Total:', countNotInHrGang);

process.exit(0);
