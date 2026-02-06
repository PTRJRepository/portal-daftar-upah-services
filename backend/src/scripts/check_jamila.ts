import { Database } from "../db/client";

const db = Database.getInstance(undefined, "SERVER_PROFILE_2");

const empCode = 'G0034';

// Cek data JAMILA
console.log('=== DATA JAMILA (G0034) ===');

// 1. Data employee
const emp = await db.query(`
  SELECT
    RTRIM(e.EmpCode) as emp_code,
    e.EmpName as emp_name,
    RTRIM(e.LocCode) as loc_code,
    RTRIM(gl.GangCode) as gang_code
  FROM HR_EMPLOYEE e
  INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
  WHERE RTRIM(e.EmpCode) = ?
`, [empCode]);

console.log('\n1. Employee Data:', emp[0]);

// 2. Cek apakah punya attendance di Januari 2026
const att = await db.query(`
  SELECT COUNT(DISTINCT trl.TrxDate) as hk
  FROM PR_TASKREGLN trl
  JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
  WHERE RTRIM(trl.EmpCode) = ?
    AND trl.TrxDate >= '2026-01-01' AND trl.TrxDate < '2026-02-01'
    AND trl.OT = 0
`, [empCode]);

console.log('2. Attendance Jan 2026:', att[0].hk, 'HK');

// 3. Cek di hasil API - cari JAMILA
const apiData = JSON.parse(require('fs').readFileSync('ab1_api_result.json', 'utf-8'));

function findEmployee(obj: any, targetCode: string): any {
  if (!obj || typeof obj !== 'object') return null;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findEmployee(item, targetCode);
      if (found) return found;
    }
  } else {
    if (obj.nik === targetCode) {
      return obj;
    }
    for (const key in obj) {
      if (key !== 'nik') {
        const found = findEmployee(obj[key], targetCode);
        if (found) return found;
      }
    }
  }
  return null;
}

const jamilaInApi = findEmployee(apiData, empCode);
console.log('\n3. JAMILA in API:', jamilaInApi ? 'YES' : 'NO');

if (jamilaInApi) {
  console.log('   Data:', {
    nik: jamilaInApi.nik,
    nama: jamilaInApi.nama,
    gang_code: jamilaInApi.gang_code,
    jumlah_hk: jamilaInApi.jumlah_hk,
    hari_kerja: jamilaInApi.hari_kerja,
    upah_bersih: jamilaInApi.upah_bersih
  });
} else {
  console.log('   JAMILA NOT FOUND in API response!');
  console.log('   This means JAMILA was filtered out by the query logic');
}

// 4. Cek apakah ada gang lain untuk JAMILA
const allGangs = await db.query(`
  SELECT RTRIM(gl.GangCode) as gang_code, g.Description as gang_desc, RTRIM(g.LocCode) as loc_code
  FROM HR_GANGLN gl
  LEFT JOIN HR_GANG g ON RTRIM(g.GangCode) = RTRIM(gl.GangCode)
  WHERE RTRIM(gl.GangMember) = ?
`, [empCode]);

console.log('\n4. All Gang Assignments for JAMILA:');
for (const g of allGangs) {
  console.log(`   ${g.gang_code} - ${g.gang_desc || 'NO DESC'} - Loc: ${g.loc_code || 'NO LOC'}`);
}

process.exit(0);
