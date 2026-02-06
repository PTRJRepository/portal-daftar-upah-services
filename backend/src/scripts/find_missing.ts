import { Database } from "../db/client";
import { readFileSync } from "fs";

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

// 2. Baca employee list dari API (137 employees)
const apiEmpCodes = new Set();
try {
  const apiData = JSON.parse(readFileSync('ab1_api_result.json', 'utf-8'));

  // Extract all NIKs from the response
  function extractNiks(obj: any, nikSet: Set<string>) {
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      obj.forEach(item => extractNiks(item, nikSet));
    } else {
      if (obj.nik) {
        nikSet.add(obj.nik);
      }
      for (const key in obj) {
        if (key !== 'nik') {
          extractNiks(obj[key], nikSet);
        }
      }
    }
  }

  extractNiks(apiData, apiEmpCodes);
  console.log('Total employees from API:', apiEmpCodes.size);

  // Cari yang hilang
  const missing: any[] = [];
  for (const emp of employeesInHrGang) {
    if (!apiEmpCodes.has(emp.emp_code)) {
      missing.push(emp);
    }
  }

  console.log('\n=== EMPLOYEE YANG HILANG ===');
  console.log('Total missing:', missing.length);

  if (missing.length > 0) {
    for (const emp of missing) {
      console.log(`  ${emp.emp_code} - ${emp.emp_name} - Gang: ${emp.gang_code}`);
    }
  }

  // Cek ada employee di API yang tidak ada di HR_GANG
  const hrGangCodes = new Set(employeesInHrGang.map((e: any) => e.emp_code));
  const extraInApi: string[] = [];
  for (const code of apiEmpCodes) {
    if (!hrGangCodes.has(code)) {
      extraInApi.push(code);
    }
  }

  if (extraInApi.length > 0) {
    console.log('\n=== EXTRA DI API (tidak ada di HR_GANG) ===');
    for (const code of extraInApi) {
      console.log(`  ${code}`);
    }
  }

} catch (e) {
  console.error('Error reading API response:', e);
}

process.exit(0);
