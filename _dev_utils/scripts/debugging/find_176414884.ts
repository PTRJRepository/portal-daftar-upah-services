/**
 * Find where 176,414,884 comes from for G1H
 * Run: cd backend && bun run src/scripts/find_176414884.ts
 */
import { Database } from '../db/client';
import { dataExtractorService } from '../services/dataExtractorService';

const month = 2, year = 2026;
const gangCode = 'G1H';
const divisionCode = 'AB1';

console.log(`\n========================================`);
console.log(`Finding source of 176,414,884 for G1H`);
console.log(`========================================\n`);

const db = Database.getExtendedInstance();

// 1. Check aggregation history for G1H
console.log(`[1] Aggregation table for G1H:`);
const aggRows = await db.query<any>(`
  SELECT gang_code, division_code, total_upah_bersih, total_upah_kotor,
         total_potongan, total_employees, total_hk, total_gaji_pokok,
         total_tunjangan, total_premi, total_lembur, total_koreksi
  FROM dbo.daftar_upah_aggregation_history
  WHERE period_month = ? AND period_year = ? AND gang_code = ?
`, [month, year, gangCode]);

if (aggRows.length > 0) {
  const agg = aggRows[0];
  console.log(`  AGGREGATION (from DB):`);
  console.log(`    total_upah_bersih: ${(agg.total_upah_bersih||0).toLocaleString()}`);
  console.log(`    total_upah_kotor: ${(agg.total_upah_kotor||0).toLocaleString()}`);
  console.log(`    total_potongan: ${(agg.total_potongan||0).toLocaleString()}`);
  console.log(`    total_employees: ${agg.total_employees}`);
  console.log(`    total_gaji_pokok: ${(agg.total_gaji_pokok||0).toLocaleString()}`);
  console.log(`    total_tunjangan: ${(agg.total_tunjangan||0).toLocaleString()}`);
  console.log(`    total_premi: ${(agg.total_premi||0).toLocaleString()}`);
  console.log(`    total_lembur: ${(agg.total_lembur||0).toLocaleString()}`);
  console.log(`    total_koreksi: ${(agg.total_koreksi||0).toLocaleString()}`);
}

// 2. Check if there's any other table or source
console.log(`\n[2] Checking other possible sources...`);

// Check summary_division_summary table if exists
try {
  const summaryRows = await db.query<any>(`
    SELECT TOP 5 * FROM dbo.daftar_upah_summary_divisi
    WHERE period_month = ? AND period_year = ?
  `, [month, year]);
  console.log(`  summary_divisi: ${summaryRows.length} rows`);
} catch (e) {}

// 3. Direct extraction for comparison
console.log(`\n[3] Direct extraction (dataExtractorService):`);
const result = await dataExtractorService.extractPayrollData(
  month, year, gangCode, divisionCode, null, 'SERVER_PROFILE_1', false
);

let sumUpahBersih = 0;
let sumUpahKotor = 0;
let sumPotongan = 0;
let sumGajiPokok = 0;
let sumTunjangan = 0;
let sumPremi = 0;
let sumLembur = 0;
let sumKoreksi = 0;

for (const emp of result.data_rows) {
  sumUpahBersih += (emp.upah_bersih || 0);
  sumUpahKotor += (emp.jumlah_upah_kotor || 0);
  sumPotongan += (emp.total_potongan || 0);
  sumGajiPokok += (emp.gaji_pokok || 0);
  sumTunjangan += (emp.total_tunjangan || 0);
  sumPremi += (emp.total_premi || 0);
  sumLembur += (emp.lembur_jumlah || 0);
  sumKoreksi += (emp.pot_koreksi || 0);
}

console.log(`  Direct extraction:`);
console.log(`    Employees: ${result.data_rows.length}`);
console.log(`    total_upah_bersih: ${sumUpahBersih.toLocaleString()}`);
console.log(`    total_upah_kotor: ${sumUpahKotor.toLocaleString()}`);
console.log(`    total_potongan: ${sumPotongan.toLocaleString()}`);
console.log(`    total_gaji_pokok: ${sumGajiPokok.toLocaleString()}`);
console.log(`    total_tunjangan: ${sumTunjangan.toLocaleString()}`);
console.log(`    total_premi: ${sumPremi.toLocaleString()}`);
console.log(`    total_lembur: ${sumLembur.toLocaleString()}`);
console.log(`    total_koreksi: ${sumKoreksi.toLocaleString()}`);

// 4. Check if there's a difference in how the UI calculates
// The user might be seeing data from a different time or calculation
console.log(`\n[4] Breakdown by employee (showing differences):`);
console.log(`  First 5 employees:`);
for (let i = 0; i < Math.min(5, result.data_rows.length); i++) {
  const emp = result.data_rows[i];
  console.log(`  ${emp.emp_code}:`);
  console.log(`    gaji_pokok=${(emp.gaji_pokok||0).toLocaleString()}, tunjangan=${(emp.total_tunjangan||0).toLocaleString()}`);
  console.log(`    premi=${(emp.total_premi||0).toLocaleString()}, lembur=${(emp.lembur_jumlah||0).toLocaleString()}`);
  console.log(`    kotor=${(emp.jumlah_upah_kotor||0).toLocaleString()}, pot=${(emp.total_potongan||0).toLocaleString()}`);
  console.log(`    BERSIH=${(emp.upah_bersih||0).toLocaleString()}`);
}

console.log(`\nDone.\n`);