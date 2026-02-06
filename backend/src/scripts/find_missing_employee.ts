import { Database } from "../db/client";

const db = Database.getInstance(undefined, "SERVER_PROFILE_2");

// Cari semua employee AB1 yang ada di aggregation tapi mungkin tidak ada di query langsung
// Aggregation dihitung berdasarkan gang di HR_GANG

// 1. Dapatkan semua gang di HR_GANG untuk AB1
const gangsInHrGang = await db.query(`
  SELECT DISTINCT RTRIM(GangCode) as GangCode, RTRIM(Description) as Description
  FROM HR_GANG
  WHERE RTRIM(LocCode) = 'AB1'
`);

console.log('Gangs in HR_GANG for AB1:', gangsInHrGang.length);
for (const g of gangsInHrGang) {
  console.log(`  ${g.GangCode} - ${g.Description}`);
}

// 2. Dapatkan semua employee dari HR_GANGLN untuk gang-gang tersebut
const gangCodes = gangsInHrGang.map((g: any) => `'${g.GangCode}'`).join(',');

const employeesFromGang = await db.query(`
  SELECT DISTINCT
    RTRIM(e.EmpCode) as emp_code,
    e.EmpName as emp_name,
    RTRIM(gl.GangCode) as gang_code
  FROM HR_EMPLOYEE e
  INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
  WHERE RTRIM(gl.GangCode) IN (${gangCodes})
`);

console.log('\nEmployees from HR_GANGLN with gang in HR_GANG:', employeesFromGang.length);

// 3. Dapatkan semua employee dari HR_GANGLN dengan LocCode AB1 (termasuk yang gang-nya tidak di HR_GANG)
const employeesFromLocCode = await db.query(`
  SELECT DISTINCT
    RTRIM(e.EmpCode) as emp_code,
    e.EmpName as emp_name,
    RTRIM(e.LocCode) as loc_code,
    RTRIM(gl.GangCode) as gang_code
  FROM HR_EMPLOYEE e
  INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
  WHERE RTRIM(e.LocCode) = 'AB1'
`);

console.log('Employees from HR_GANGLN with LocCode AB1:', employeesFromLocCode.length);

// 4. Cari employee yang ada di query LocCode tapi tidak ada di query Gang
const empFromLoc = new Set(employeesFromLocCode.map((e: any) => e.emp_code));
const empFromGang = new Set(employeesFromGang.map((e: any) => e.emp_code));

const missingFromGangQuery = employeesFromLocCode.filter((e: any) => !empFromGang.has(e.emp_code));
const inGangOnly = employeesFromGang.filter((e: any) => !empFromLoc.has(e.emp_code));

console.log('\nEmployees with LocCode AB1 but gang NOT in HR_GANG:', missingFromGangQuery.length);
if (missingFromGangQuery.length > 0) {
  for (const e of missingFromGangQuery) {
    console.log(`  ${e.emp_code} - ${e.emp_name} - Gang: ${e.gang_code}`);
  }
}

console.log('\nEmployees in HR_GANG query but NOT in LocCode AB1:', inGangOnly.length);
if (inGangOnly.length > 0) {
  for (const e of inGangOnly) {
    console.log(`  ${e.emp_code} - ${e.emp_name} - Gang: ${e.gang_code}`);
  }
}

// 5. Perbedaan total: 145 vs 137 = 8 employee
// Mari kita cari tahu 8 employee apa yang tidak terhitung

console.log('\n=== SUMMARY ===');
console.log('Total unique employees with LocCode AB1:', employeesFromLocCode.length);
console.log('Total unique employees with gang in HR_GANG AB1:', employeesFromGang.length);
console.log('Difference:', employeesFromLocCode.length - employeesFromGang.length);

process.exit(0);
