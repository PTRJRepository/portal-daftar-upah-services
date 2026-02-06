import { Database } from "../db/client";

const db = Database.getInstance(undefined, "SERVER_PROFILE_2");

// 1. Dapatkan 138 employee dari HR_GANG AB1
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
  ORDER BY RTRIM(gl.GangCode), RTRIM(e.EmpCode)
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
  console.log(`${gang}: ${emps.length} employees`);
}

// Save emp codes for comparison
const empCodes = employeesInHrGang.map((e: any) => e.emp_code).sort();

console.log('\nTotal employee codes:', empCodes.length);
console.log('First 10:', empCodes.slice(0, 10));
console.log('Last 10:', empCodes.slice(-10));

// Simpan ke file untuk bisa dibandingkan dengan hasil API
const fs = require('fs');
fs.writeSync('/tmp/hr_gang_ab1_employees.txt', empCodes.join('\n'));

console.log('\nSaved to /tmp/hr_gang_ab1_employees.txt');

process.exit(0);
