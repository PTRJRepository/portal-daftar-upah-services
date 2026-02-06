import { Database } from "../db/client";

const db = Database.getInstance(undefined, "SERVER_PROFILE_2");

// Cari semua employee dengan LocCode AB1
const employees = await db.query(`
  SELECT DISTINCT
    RTRIM(e.EmpCode) as emp_code,
    e.EmpName as emp_name,
    RTRIM(e.LocCode) as loc_code,
    RTRIM(gl.GangCode) as gang_code,
    g.GangCode as hr_gang_code,
    g.Description as gang_description
  FROM HR_EMPLOYEE e
  LEFT JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
  LEFT JOIN HR_GANG g ON RTRIM(g.GangCode) = RTRIM(gl.GangCode)
  WHERE RTRIM(e.LocCode) = 'AB1'
`);

console.log('Total employees AB1:', employees.length);
const gangCounts: Record<string, number> = {};
for (const emp of employees) {
  const gc = emp.gang_code || 'NULL';
  gangCounts[gc] = (gangCounts[gc] || 0) + 1;
}
console.log('Employees by Gang:', gangCounts);

// Cari gang yang ada di HR_GANGLN tapi tidak di HR_GANG
const gangsInHrGang = await db.query(`
  SELECT DISTINCT GangCode, LocCode
  FROM HR_GANG
  WHERE RTRIM(LocCode) = 'AB1'
`);
console.log('\nGangs in HR_GANG for AB1:', gangsInHrGang.map((g: any) => g.GangCode));

// List all unique gang codes from HR_GANGLN
const uniqueGangCodes = new Set<string>();
for (const emp of employees) {
  if (emp.gang_code) uniqueGangCodes.add(emp.gang_code);
}
console.log('\nAll unique gang codes from HR_GANGLN:', Array.from(uniqueGangCodes).sort());

// Find employees with gang not in HR_GANG
const missingGangs: any[] = [];
for (const emp of employees) {
  if (emp.gang_code && !emp.hr_gang_code) {
    missingGangs.push(emp);
  }
}
console.log('\nEmployees with gang not in HR_GANG:', missingGangs.length);
if (missingGangs.length > 0) {
  console.log(missingGangs.map((e: any) => `${e.emp_code} - ${e.emp_name} - ${e.gang_code}`).join('\n'));
}

process.exit(0);
