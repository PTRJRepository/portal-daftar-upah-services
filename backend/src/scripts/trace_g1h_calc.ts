/**
 * Trace G1H calculation through the seeder pipeline
 * Run: cd backend && bun run src/scripts/trace_g1h_calc.ts
 */
import { dataExtractorService } from '../services/dataExtractorService';
import { PayrollDataService } from '../services/payrollDataService';

const month = 2, year = 2026;
const gangCode = 'G1H';
const divisionCode = 'AB1';

console.log(`\n========================================`);
console.log(`Tracing G1H calculation through seeder pipeline`);
console.log(`========================================\n`);

// 1. Get raw data from dataExtractorService
console.log(`[1] Raw data from dataExtractorService...`);
const rawResult = await dataExtractorService.extractPayrollData(
  month, year, gangCode, divisionCode, null, 'SERVER_PROFILE_1', false
);

console.log(`  Raw employees: ${rawResult.data_rows.length}`);

// 2. Simulate what calculateTotals does in PayrollDataService
console.log(`\n[2] Simulating calculateTotals (like PayrollDataService does)...`);

const activeEmployees = rawResult.data_rows.filter((emp: any) => {
  const totalCuti = (emp.cuti_tahunan || 0) + (emp.cuti_sakit_haid || 0) +
                    (emp.cuti_minggu || 0) + (emp.cuti_nasional || 0);
  const hari_kerja = Math.max(0, (parseFloat(emp.jumlah_hk) || 0) - totalCuti);
  return hari_kerja > 0;
});

console.log(`  Active employees after filter: ${activeEmployees.length}`);

const numericFields = [
  'jumlah_hk', 'hari_kerja', 'gaji_pokok', 'gaji_pokok_ideal', 'gaji_pokok_aktual',
  'beras_jumlah', 'jabatan_jumlah', 'masa_kerja_tahun', 'masa_kerja_jumlah', 'lembur_jumlah',
  'total_tunjangan', 'premi_brondol', 'total_premi', 'pot_koreksi',
  'potongan_upah_kotor_total', 'jumlah_upah_kotor',
  'pot_astek', 'pot_astek_maj', 'pot_bpjs_kesehatan_pekerja', 'pot_bpjs_kesehatan_majikan',
  'pot_bpjs_pensiun_pekerja', 'pot_bpjs_pensiun_majikan', 'pot_bpjs_pekerja_total',
  'pot_spsi', 'pot_pph21', 'premi_pph', 'total_potongan', 'total_potongan_bersih',
  'upah_bersih', 'koreksi_hk', 'pph21_ter', 'tarif_pajak_ter'
];

const totals: any = {};
for (const field of numericFields) totals[field] = 0;
totals['employee_count'] = activeEmployees.length;

for (const emp of activeEmployees) {
  for (const field of numericFields) {
    const val = emp[field];
    if (val !== null && val !== undefined) totals[field] += parseFloat(val) || 0;
  }

  // Sum dynamic fields
  for (const key of Object.keys(emp)) {
    if ((key.startsWith('premi_') && !['premi_brondol', 'premi_pph', 'premi_koreksi'].includes(key)) ||
        key.startsWith('KOREKSI') || key.startsWith('POTONGAN')) {
      const val = emp[key];
      if (typeof val === 'number') {
        if (!totals[key]) totals[key] = 0;
        totals[key] += val;
      }
    }
  }
}

console.log(`  Calculated totals:`);
console.log(`    employee_count: ${totals.employee_count}`);
console.log(`    jumlah_hk: ${totals.jumlah_hk}`);
console.log(`    gaji_pokok: ${totals.gaji_pokok}`);
console.log(`    gaji_pokok_aktual: ${totals.gaji_pokok_aktual}`);
console.log(`    total_tunjangan: ${totals.total_tunjangan}`);
console.log(`    total_premi: ${totals.total_premi}`);
console.log(`    pot_koreksi: ${totals.pot_koreksi}`);
console.log(`    jumlah_upah_kotor: ${totals.jumlah_upah_kotor}`);
console.log(`    total_potongan: ${totals.total_potongan}`);
console.log(`    upah_bersih: ${totals.upah_bersih}`);

// 3. Check what mapGangTotalsToAggregation produces
console.log(`\n[3] Simulating mapGangTotalsToAggregation...`);
console.log(`  Using totals.jumlah_upah_kotor: ${totals.jumlah_upah_kotor}`);
console.log(`  Using totals.upah_bersih: ${totals.upah_bersih}`);

// 4. Manual verification - recalculate from individual employees
console.log(`\n[4] Manual verification...`);
let manualUpahKotor = 0;
let manualPotongan = 0;
let manualUpahBersih = 0;

for (const emp of activeEmployees) {
  manualUpahKotor += (emp.jumlah_upah_kotor || 0);
  manualPotongan += (emp.total_potongan || 0);
  manualUpahBersih += (emp.upah_bersih || 0);
}

console.log(`  Manual sum from employees:`);
console.log(`    jumlah_upah_kotor: ${manualUpahKotor.toLocaleString()}`);
console.log(`    total_potongan: ${manualPotongan.toLocaleString()}`);
console.log(`    upah_bersih: ${manualUpahBersih.toLocaleString()}`);

console.log(`\n  Difference (calc - manual):`);
console.log(`    jumlah_upah_kotor: ${(totals.jumlah_upah_kotor - manualUpahKotor).toLocaleString()}`);
console.log(`    total_potongan: ${(totals.total_potongan - manualPotongan).toLocaleString()}`);
console.log(`    upah_bersih: ${(totals.upah_bersih - manualUpahBersih).toLocaleString()}`);

// 5. Check DB aggregation after re-seed
console.log(`\n[5] Checking DB aggregation after re-seed...`);
const { Database } = require('../db/client');
const db = Database.getExtendedInstance();
const aggRows = await db.query(`
  SELECT gang_code, total_upah_bersih, total_upah_kotor, total_potongan,
         total_employees, total_gaji_pokok, total_tunjangan, total_premi, total_koreksi
  FROM dbo.daftar_upah_aggregation_history
  WHERE period_month = ? AND period_year = ? AND gang_code = ?
`, [month, year, gangCode]);

if (aggRows.length > 0) {
  const agg = aggRows[0];
  console.log(`  DB Aggregation (after seed):`);
  console.log(`    total_upah_bersih: ${(agg.total_upah_bersih||0).toLocaleString()}`);
  console.log(`    total_upah_kotor: ${(agg.total_upah_kotor||0).toLocaleString()}`);
  console.log(`    total_potongan: ${(agg.total_potongan||0).toLocaleString()}`);
  console.log(`    total_gaji_pokok: ${(agg.total_gaji_pokok||0).toLocaleString()}`);
  console.log(`    total_tunjangan: ${(agg.total_tunjangan||0).toLocaleString()}`);
  console.log(`    total_premi: ${(agg.total_premi||0).toLocaleString()}`);
  console.log(`    total_koreksi: ${(agg.total_koreksi||0).toLocaleString()}`);

  console.log(`\n  Comparing (DB - Manual):`);
  console.log(`    upah_bersih: ${((agg.total_upah_bersih||0) - manualUpahBersih).toLocaleString()}`);
  console.log(`    upah_kotor: ${((agg.total_upah_kotor||0) - manualUpahKotor).toLocaleString()}`);
  console.log(`    total_potongan: ${((agg.total_potongan||0) - manualPotongan).toLocaleString()}`);
  console.log(`    total_koreksi: ${((agg.total_koreksi||0) - (totals.pot_koreksi || 0)).toLocaleString()}`);
}

console.log(`\nDone.\n`);