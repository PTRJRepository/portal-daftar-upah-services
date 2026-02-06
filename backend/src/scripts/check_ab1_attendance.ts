import { Database } from "../db/client";

const db = Database.getInstance(undefined, "SERVER_PROFILE_2");

// Cari langsung: employee AB1 dengan attendance di Januari 2026, beserta gang mereka
const result = await db.query(`
  SELECT DISTINCT
    RTRIM(e.EmpCode) as emp_code,
    e.EmpName as emp_name,
    RTRIM(e.LocCode) as loc_code,
    RTRIM(gl.GangCode) as gang_code,
    COUNT(DISTINCT trl.TrxDate) as hk
  FROM PR_TASKREGLN trl
  JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
  JOIN HR_EMPLOYEE e ON RTRIM(e.EmpCode) = RTRIM(trl.EmpCode)
  LEFT JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
  WHERE RTRIM(e.LocCode) = 'AB1'
    AND trl.TrxDate >= '2026-01-01' AND trl.TrxDate < '2026-02-01'
    AND trl.OT = 0
  GROUP BY RTRIM(e.EmpCode), e.EmpName, RTRIM(e.LocCode), RTRIM(gl.GangCode)
  ORDER BY RTRIM(gl.GangCode)
`);

console.log('Total AB1 employees with attendance in Jan 2026:', result.length);

const gangCounts: Record<string, number> = {};
const allEmpCodes: string[] = [];

for (const row of result) {
  const gc = row.gang_code || 'NULL';
  gangCounts[gc] = (gangCounts[gc] || 0) + 1;
  allEmpCodes.push(row.emp_code);
}

console.log('\nBy Gang:', gangCounts);
console.log('Total:', result.length);

// Cek HR_GANG
const gangsInHrGang = await db.query(`
  SELECT DISTINCT RTRIM(GangCode) as GangCode
  FROM HR_GANG
  WHERE RTRIM(LocCode) = 'AB1'
`);

const hrGangCodes = new Set(gangsInHrGang.map((g: any) => g.GangCode));
console.log('\nGangs in HR_GANG:', Array.from(hrGangCodes).sort());

// Employee yang gang-nya TIDAK ada di HR_GANG
console.log('\nEmployees with attendance but gang NOT in HR_GANG:');
let countNotInHrGang = 0;
for (const row of result) {
  if (row.gang_code && !hrGangCodes.has(row.gang_code)) {
    console.log(`  ${row.emp_code} - ${row.emp_name} - Gang: ${row.gang_code} - HK: ${row.hk}`);
    countNotInHrGang++;
  }
}
console.log('Total NOT in HR_GANG:', countNotInHrGang);

process.exit(0);
