import { Database } from "../db/client";

const db = Database.getInstance(undefined, "SERVER_PROFILE_2");

// Dapatkan 138 employee yang ada di HR_GANG AB1
const employeesInHrGang = await db.query(`
  SELECT DISTINCT
    RTRIM(e.EmpCode) as emp_code,
    e.EmpName as emp_name,
    RTRIM(e.LocCode) as loc_code,
    RTRIM(gl.GangCode) as gang_code
  FROM HR_EMPLOYEE e
  INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
  INNER JOIN HR_GANG g ON RTRIM(g.GangCode) = RTRIM(gl.GangCode)
  WHERE RTRIM(g.LocCode) = 'AB1'
`);

console.log('Total employees in HR_GANG AB1:', employeesInHrGang.length);

// Group by gang
const byGang: Record<string, any[]> = {};
for (const emp of employeesInHrGang) {
  const gc = emp.gang_code;
  if (!byGang[gc]) byGang[gc] = [];
  byGang[gc].push(emp);
}

for (const [gang, emps] of Object.entries(byGang)) {
  console.log(`\n${gang}: ${emps.length} employees`);
}

// Cek attendance untuk semua 138 employee
const empCodes = employeesInHrGang.map((e: any) => `'${e.emp_code}'`).join(',');

const attendance = await db.query(`
  SELECT RTRIM(trl.EmpCode) as emp_code, COUNT(DISTINCT trl.TrxDate) as hk
  FROM PR_TASKREGLN trl
  JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
  WHERE RTRIM(trl.EmpCode) IN (${empCodes})
    AND trl.TrxDate >= '2026-01-01' AND trl.TrxDate < '2026-02-01'
    AND trl.OT = 0
  GROUP BY RTRIM(trl.EmpCode)
`);

console.log('\nEmployees with attendance in Jan 2026:', attendance.length);

// Employee dengan attendance, grouped by gang
const attByGang: Record<string, number> = {};
for (const att of attendance) {
  const emp = employeesInHrGang.find((e: any) => e.emp_code === att.emp_code);
  if (emp) {
    attByGang[emp.gang_code] = (attByGang[emp.gang_code] || 0) + 1;
  }
}

console.log('\nEmployees with attendance by Gang:');
for (const [gang, count] of Object.entries(attByGang).sort()) {
  const total = byGang[gang]?.length || 0;
  console.log(`  ${gang}: ${count}/${total} (missing: ${total - count})`);
}

// Cari employee yang TIDAK punya attendance
const empWithAtt = new Set(attendance.map((a: any) => a.emp_code));
const empWithoutAtt = employeesInHrGang.filter((e: any) => !empWithAtt.has(e.emp_code));

console.log('\nEmployees in HR_GANG AB1 WITHOUT attendance in Jan 2026:', empWithoutAtt.length);
if (empWithoutAtt.length > 0) {
  for (const emp of empWithoutAtt) {
    console.log(`  ${emp.emp_code} - ${emp.emp_name} - Gang: ${emp.gang_code}`);
  }
}

// Total yang harusnya terhitung = employees with attendance
console.log('\n=== FINAL COUNT ===');
console.log('Total in HR_GANG AB1:', employeesInHrGang.length);
console.log('With attendance:', attendance.length);
console.log('Without attendance:', empWithoutAtt.length);

process.exit(0);
