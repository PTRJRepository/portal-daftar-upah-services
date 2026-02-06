import { Database } from "../db/client";

const db = Database.getInstance(undefined, "SERVER_PROFILE_2");

const empCode = 'G0034';

console.log('=== CEK GAJI JAMILA (G0034) ===');

// 1. Gaji Pokok dari HR_PAYROLL
const payroll = await db.query(`
  SELECT
    PayRate,
    RiceRation
  FROM HR_PAYROLL
  WHERE RTRIM(EmpCode) = ?
`, [empCode]);

console.log('\n1. HR_PAYROLL:', payroll[0]);

// 2. Cek di aggregation history untuk JAMILA/AB1
const agg = await db.query(`
  SELECT
    COUNT(*) as employee_count,
    SUM(total_upah_bersih) as total_upah_bersih,
    SUM(total_employees) as total_employees
  FROM daftar_upah_aggregation_history
  WHERE division_code = 'AB1'
    AND period_month = 1
    AND period_year = 2026
    AND server_name = 'SERVER_PROFILE_2'
`);

console.log('\n2. Aggregation History (SERVER_PROFILE_2):', agg[0]);

// 3. Cek semua server profiles untuk AB1
const aggAll = await db.query(`
  SELECT
    server_name,
    COUNT(*) as employee_count,
    SUM(total_upah_bersih) as total_upah_bersih
  FROM daftar_upah_aggregation_history
  WHERE division_code = 'AB1'
    AND period_month = 1
    AND period_year = 2026
  GROUP BY server_name
`);

console.log('\n3. Aggregation by Server Profile:');
for (const row of aggAll) {
  console.log(`   ${row.server_name}: ${row.employee_count} employees, Total: ${row.total_upah_bersih}`);
}

// 4. Cek detail gang untuk AB1 di aggregation
const aggByGang = await db.query(`
  SELECT
    gang_code,
    COUNT(*) as employee_count,
    SUM(total_upah_bersih) as total_upah_bersih
  FROM daftar_upah_aggregation_history
  WHERE division_code = 'AB1'
    AND period_month = 1
    AND period_year = 2026
    AND server_name = 'SERVER_PROFILE_2'
  GROUP BY gang_code
  ORDER BY gang_code
`);

console.log('\n4. Aggregation by Gang:');
for (const row of aggByGang) {
  console.log(`   ${row.gang_code}: ${row.employee_count} employees, Total: ${row.total_upah_bersih}`);
}

// 5. Hitung gaji JAMILA jika punya PayRate
const payRate = payroll[0]?.PayRate || 0;
const riceRation = payroll[0]?.RiceRation || 0;

const daysInMonth = 31; // Januari 2026
const gajiPokok = payRate * daysInMonth;

console.log('\n5. Data Gaji:');
console.log(`   PayRate: ${payRate}`);
console.log(`   RiceRation: ${riceRation}`);
console.log(`   Gaji Pokok (31 hari): ${gajiPokok}`);

process.exit(0);
