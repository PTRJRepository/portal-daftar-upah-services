/**
 * Check G1H via direct data extraction
 * Run: cd backend && bun run src/scripts/check_g1h.ts
 */
import { Database } from '../db/client';
import { dataExtractorService } from '../services/dataExtractorService';

const month = 2, year = 2026;
const gangCode = 'G1H';
const divisionCode = 'AB1';

console.log(`\n========================================`);
console.log(`Checking G1H via direct data extraction`);
console.log(`========================================\n`);

// 1. Get direct data via dataExtractorService
console.log(`[1] Extracting data via dataExtractorService...`);
const result = await dataExtractorService.extractPayrollData(
  month, year, gangCode, divisionCode, null, 'SERVER_PROFILE_1', false
);

console.log(`  Employees returned: ${result.data_rows.length}`);

// Sum all employees
let sumUpahBersih = 0;
let sumUpahKotor = 0;
let sumPotongan = 0;
let sumPremi = 0;
let sumHk = 0;
let sumGajiPokok = 0;
let sumTunjangan = 0;
let empCount = 0;

for (const emp of result.data_rows) {
  empCount++;
  sumUpahBersih += (emp.upah_bersih || 0);
  sumUpahKotor += (emp.jumlah_upah_kotor || 0);
  sumPotongan += (emp.total_potongan || 0);
  sumPremi += (emp.total_premi || 0);
  sumHk += (emp.jumlah_hk || 0);
  sumGajiPokok += (emp.gaji_pokok || 0);
  sumTunjangan += (emp.total_tunjangan || 0);
}

console.log(`\n  DIRECT EXTRACTION (calculated fresh):`);
console.log(`    Employees: ${empCount}`);
console.log(`    HK: ${sumHk}`);
console.log(`    gaji_pokok: ${sumGajiPokok.toLocaleString()}`);
console.log(`    tunjangan: ${sumTunjangan.toLocaleString()}`);
console.log(`    total_premi: ${sumPremi.toLocaleString()}`);
console.log(`    upah_kotor: ${sumUpahKotor.toLocaleString()}`);
console.log(`    total_potongan: ${sumPotongan.toLocaleString()}`);
console.log(`    UPAH BERSIH: ${sumUpahBersih.toLocaleString()}`);

// 2. Compare with aggregation
console.log(`\n[2] Comparison with aggregation table...`);
const db = Database.getExtendedInstance();
const aggRows = await db.query<any>(`
  SELECT gang_code, division_code, total_upah_bersih, total_upah_kotor, total_potongan,
         total_employees, total_hk, total_premi, total_gaji_pokok, total_tunjangan
  FROM dbo.daftar_upah_aggregation_history
  WHERE period_month = ? AND period_year = ? AND gang_code = ?
`, [month, year, gangCode]);

if (aggRows.length > 0) {
  const agg = aggRows[0];
  console.log(`\n  AGGREGATION (from DB - stale data):`);
  console.log(`    Employees: ${agg.total_employees}`);
  console.log(`    HK: ${agg.total_hk}`);
  console.log(`    gaji_pokok: ${(agg.total_gaji_pokok||0).toLocaleString()}`);
  console.log(`    tunjangan: ${(agg.total_tunjangan||0).toLocaleString()}`);
  console.log(`    total_premi: ${(agg.total_premi||0).toLocaleString()}`);
  console.log(`    upah_kotor: ${(agg.total_upah_kotor||0).toLocaleString()}`);
  console.log(`    total_potongan: ${(agg.total_potongan||0).toLocaleString()}`);
  console.log(`    UPAH BERSIH: ${(agg.total_upah_bersih||0).toLocaleString()}`);

  console.log(`\n  DIFFERENCE (Aggregation - Direct):`);
  console.log(`    Employees: ${agg.total_employees - empCount}`);
  console.log(`    HK: ${(agg.total_hk||0) - sumHk}`);
  console.log(`    gaji_pokok: ${((agg.total_gaji_pokok||0) - sumGajiPokok).toLocaleString()}`);
  console.log(`    tunjangan: ${((agg.total_tunjangan||0) - sumTunjangan).toLocaleString()}`);
  console.log(`    total_premi: ${((agg.total_premi||0) - sumPremi).toLocaleString()}`);
  console.log(`    upah_kotor: ${((agg.total_upah_kotor||0) - sumUpahKotor).toLocaleString()}`);
  console.log(`    total_potongan: ${((agg.total_potongan||0) - sumPotongan).toLocaleString()}`);
  console.log(`    UPAH BERSIH: ${((agg.total_upah_bersih||0) - sumUpahBersih).toLocaleString()}`);
} else {
  console.log(`  No aggregation data found for G1H`);
}

console.log(`\nDone.\n`);