/**
 * Check H1H via API endpoint (same as frontend)
 * Run: cd backend && bun run src/scripts/check_h1h_api.ts
 */
import { Database } from '../db/client';
import { dataExtractorService } from '../services/dataExtractorService';
import { divisionConfigService } from '../services/config/DivisionConfigService';

const month = 2, year = 2026;
const gangCode = 'H1H';
const divisionCode = 'AB2';

console.log(`\n========================================`);
console.log(`Checking H1H via direct data extraction`);
console.log(`========================================\n`);

// 1. Get direct data via dataExtractorService (same as daftar upah API)
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
let empCount = 0;

for (const emp of result.data_rows) {
  empCount++;
  sumUpahBersih += (emp.upah_bersih || 0);
  sumUpahKotor += (emp.jumlah_upah_kotor || 0);
  sumPotongan += (emp.total_potongan || 0);
  sumPremi += (emp.total_premi || 0);
  sumHk += (emp.jumlah_hk || 0);
}

console.log(`  SUM (direct extraction):`);
console.log(`    Employees: ${empCount}`);
console.log(`    HK: ${sumHk}`);
console.log(`    total_upah_kotor: ${sumUpahKotor.toLocaleString()}`);
console.log(`    total_potongan: ${sumPotongan.toLocaleString()}`);
console.log(`    total_premi: ${sumPremi.toLocaleString()}`);
console.log(`    total_upah_bersih: ${sumUpahBersih.toLocaleString()}`);

// 2. Compare with aggregation
console.log(`\n[2] Comparison with aggregation table...`);
const db = Database.getExtendedInstance();
const aggRows = await db.query<any>(`
  SELECT gang_code, division_code, total_upah_bersih, total_upah_kotor, total_potongan,
         total_employees, total_hk, total_premi
  FROM dbo.daftar_upah_aggregation_history
  WHERE period_month = ? AND period_year = ? AND gang_code = ?
`, [month, year, gangCode]);

if (aggRows.length > 0) {
  const agg = aggRows[0];
  console.log(`  AGGREGATION (from DB):`);
  console.log(`    Employees: ${agg.total_employees}`);
  console.log(`    HK: ${agg.total_hk}`);
  console.log(`    total_upah_kotor: ${(agg.total_upah_kotor||0).toLocaleString()}`);
  console.log(`    total_potongan: ${(agg.total_potongan||0).toLocaleString()}`);
  console.log(`    total_premi: ${(agg.total_premi||0).toLocaleString()}`);
  console.log(`    total_upah_bersih: ${(agg.total_upah_bersih||0).toLocaleString()}`);

  console.log(`\n  DIFFERENCE (Aggregation - Direct):`);
  console.log(`    Employees: ${agg.total_employees - empCount}`);
  console.log(`    HK: ${(agg.total_hk||0) - sumHk}`);
  console.log(`    upah_kotor: ${((agg.total_upah_kotor||0) - sumUpahKotor).toLocaleString()}`);
  console.log(`    potongan: ${((agg.total_potongan||0) - sumPotongan).toLocaleString()}`);
  console.log(`    premi: ${((agg.total_premi||0) - sumPremi).toLocaleString()}`);
  console.log(`    upah_bersih: ${((agg.total_upah_bersih||0) - sumUpahBersih).toLocaleString()}`);
}

console.log(`\nDone.\n`);