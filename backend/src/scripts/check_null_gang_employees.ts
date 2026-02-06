import { Database } from "../db/client";

const db = Database.getInstance(undefined, "SERVER_PROFILE_2");

// Cari employee AB1 dengan gang NULL/empty yang punya attendance di Januari 2026
const employeesWithNullGang = await db.query(`
  SELECT DISTINCT
    RTRIM(e.EmpCode) as emp_code,
    e.EmpName as emp_name,
    RTRIM(e.LocCode) as loc_code,
    RTRIM(gl.GangCode) as gang_code
  FROM HR_EMPLOYEE e
  LEFT JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
  WHERE RTRIM(e.LocCode) = 'AB1'
    AND (gl.GangCode IS NULL OR gl.GangCode = '')
`);

console.log('AB1 employees with NULL/empty gang:', employeesWithNullGang.length);

if (employeesWithNullGang.length > 0) {
  const empCodes = employeesWithNullGang.map((e: any) => `'${e.emp_code}'`).join(',');

  // Cek attendance
  const attendance = await db.query(`
    SELECT RTRIM(EmpCode) as emp_code, COUNT(DISTINCT TrxDate) as hk
    FROM PR_TASKREGLN trl
    JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
    WHERE RTRIM(trl.EmpCode) IN (${empCodes})
      AND trl.TrxDate >= '2026-01-01' AND trl.TrxDate < '2026-02-01'
      AND trl.OT = 0
    GROUP BY RTRIM(EmpCode)
  `);

  console.log('NULL gang employees with attendance in Jan 2026:', attendance.length);
  for (const att of attendance) {
    console.log(`  ${att.emp_code} - HK: ${att.hk}`);
  }
}

// Cari employee yang punya attendance tapi gang-nya tidak ada di HR_GANG untuk AB1
const allAb1WithAttendance = await db.query(`
  SELECT DISTINCT
    RTRIM(e.EmpCode) as emp_code,
    e.EmpName as emp_name,
    RTRIM(gl.GangCode) as gang_code
  FROM HR_EMPLOYEE e
  INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
  WHERE RTRIM(e.LocCode) = 'AB1'
    AND gl.GangCode IS NOT NULL AND gl.GangCode != ''
`);

console.log('\nTotal AB1 employees with gang assignment:', allAb1WithAttendance.length);

// Cek apakah ada gang dari HR_GANGLN yang tidak ada di HR_GANG AB1
const gangsInHrGang = await db.query(`
  SELECT DISTINCT GangCode
  FROM HR_GANG
  WHERE RTRIM(LocCode) = 'AB1'
`);

const hrGangCodes = new Set(gangsInHrGang.map((g: any) => g.GangCode.trim()));

const missingGangs: Record<string, string[]> = {};
for (const emp of allAb1WithAttendance) {
  if (!hrGangCodes.has(emp.gang_code)) {
    if (!missingGangs[emp.gang_code]) missingGangs[emp.gang_code] = [];
    missingGangs[emp.gang_code].push(emp.emp_code);
  }
}

console.log('\nGangs in HR_GANGLN but NOT in HR_GANG for AB1:', Object.keys(missingGangs));
for (const [gang, emps] of Object.entries(missingGangs)) {
  console.log(`  ${gang}: ${emps.length} employees`);
}

process.exit(0);
