/**
 * Debug H1H pendapatan_lainnya
 * Run: cd backend && bun run src/scripts/debug_h1h_detail.ts
 */
import { Database } from '../db/client';
import { dataExtractorService } from '../services/dataExtractorService';

const month = 2, year = 2026;
const gangCode = 'H1H';
const divCode = 'AB2';

console.log(`\n========================================`);
console.log(`Debugging H1H pendapatan_lainnya`);
console.log(`========================================\n`);

const result = await dataExtractorService.extractPayrollData(
  month, year, gangCode, divCode, null, 'SERVER_PROFILE_1', false
);

console.log(`Employees: ${result.data_rows.length}`);

// Find employees with pendapatan_lainnya
let empWithIncome = 0;
let totalPendapatanLainnya = 0;

for (const emp of result.data_rows) {
  // Check for any income fields
  const hasIncome = (emp.pendapatan_lainnya || 0) !== 0 ||
                   (emp.thr_amount || 0) !== 0 ||
                   (emp.bonus_amount || 0) !== 0 ||
                   (emp.custom_income_amount || 0) !== 0 ||
                   (emp.kontan_amount || 0) !== 0;

  if (hasIncome) {
    empWithIncome++;
    console.log(`\nEmployee ${emp.emp_code} (${emp.nama}):`);
    console.log(`  pendapatan_lainnya: ${(emp.pendapatan_lainnya||0).toLocaleString()}`);
    console.log(`  thr_amount: ${(emp.thr_amount||0).toLocaleString()}`);
    console.log(`  bonus_amount: ${(emp.bonus_amount||0).toLocaleString()}`);
    console.log(`  custom_income_amount: ${(emp.custom_income_amount||0).toLocaleString()}`);
    console.log(`  kontan_amount: ${(emp.kontan_amount||0).toLocaleString()}`);
    console.log(`  jumlah_upah_kotor: ${(emp.jumlah_upah_kotor||0).toLocaleString()}`);
    console.log(`  total_potongan: ${(emp.total_potongan||0).toLocaleString()}`);
    console.log(`  upah_bersih: ${(emp.upah_bersih||0).toLocaleString()}`);
    totalPendapatanLainnya += (emp.pendapatan_lainnya || 0);
  }
}

if (empWithIncome === 0) {
  console.log(`\nNo employees with pendapatan_lainnya found`);
}

// Also check what PayrollCalculator calculates for first employee
console.log(`\n========================================`);
console.log(`Checking PayrollCalculator for first employee`);
console.log(`========================================\n`);

const emp = result.data_rows[0];
console.log(`Employee: ${emp.emp_code} (${emp.nama})`);
console.log(`  gaji_pokok_aktual: ${(emp.gaji_pokok_aktual||0).toLocaleString()}`);
console.log(`  total_tunjangan: ${(emp.total_tunjangan||0).toLocaleString()}`);
console.log(`  lembur_jumlah: ${(emp.lembur_jumlah||0).toLocaleString()}`);
console.log(`  total_premi: ${(emp.total_premi||0).toLocaleString()}`);
console.log(`  pot_koreksi: ${(emp.pot_koreksi||0).toLocaleString()}`);
console.log(`  pendapatan_lainnya: ${(emp.pendapatan_lainnya||0).toLocaleString()}`);
console.log(`  ---`);
console.log(`  pot_astek: ${(emp.pot_astek||0).toLocaleString()}`);
console.log(`  pot_bpjs_pekerja_total: ${(emp.pot_bpjs_pekerja_total||0).toLocaleString()}`);
console.log(`  pot_spsi: ${(emp.pot_spsi||0).toLocaleString()}`);
console.log(`  pot_pph21: ${(emp.pot_pph21||0).toLocaleString()}`);
console.log(`  pph21_ter: ${(emp.pph21_ter||0).toLocaleString()}`);
console.log(`  premmi_pph: ${(emp.premi_pph||0).toLocaleString()}`);
console.log(`  ---`);
console.log(`  jumlah_upah_kotor: ${(emp.jumlah_upah_kotor||0).toLocaleString()}`);
console.log(`  total_potongan: ${(emp.total_potongan||0).toLocaleString()}`);
console.log(`  upah_bersih: ${(emp.upah_bersih||0).toLocaleString()}`);

// Now check DB aggregation for comparison
console.log(`\n========================================`);
console.log(`DB Aggregation for H1H`);
console.log(`========================================\n`);

const db = Database.getExtendedInstance();
const aggRows = await db.query<any>(`
  SELECT gang_code, division_code, total_upah_bersih, total_upah_kotor, total_potongan,
         total_employees, total_hk, total_premi, total_lembur, total_koreksi
  FROM dbo.daftar_upah_aggregation_history
  WHERE period_month = ? AND period_year = ? AND gang_code = ?
`, [month, year, gangCode]);

if (aggRows.length > 0) {
  const agg = aggRows[0];
  console.log(`  employees: ${agg.total_employees}`);
  console.log(`  HK: ${agg.total_hk}`);
  console.log(`  total_upah_kotor: ${(agg.total_upah_kotor||0).toLocaleString()}`);
  console.log(`  total_potongan: ${(agg.total_potongan||0).toLocaleString()}`);
  console.log(`  total_upah_bersih: ${(agg.total_upah_bersih||0).toLocaleString()}`);
  console.log(`  total_premi: ${(agg.total_premi||0).toLocaleString()}`);
  console.log(`  total_lembur: ${(agg.total_lembur||0).toLocaleString()}`);
  console.log(`  total_koreksi: ${(agg.total_koreksi||0).toLocaleString()}`);
}

console.log(`\nDone.\n`);