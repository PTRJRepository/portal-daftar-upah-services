/**
 * Compare H1H (HARVESTING TIMUR) between direct extraction and aggregation
 * Run: cd backend && bun run src/scripts/compare_h1h.ts
 */
import { Database } from '../db/client';
import { dataExtractorService } from '../services/dataExtractorService';
import { divisionConfigService } from '../services/config/DivisionConfigService';

const month = 2, year = 2026;
const gangCode = 'H1H';

console.log(`\n========================================`);
console.log(`Comparing H1H (HARVESTING TIMUR): ${month}/${year}`);
console.log(`========================================\n`);

const db = Database.getExtendedInstance();

// 1. Get aggregation data for H1H
console.log(`[1] Fetching aggregation for gang ${gangCode}...`);
const aggRows = await db.query<any>(`
  SELECT gang_code, division_code, total_upah_bersih, total_upah_kotor, total_potongan,
         total_employees, total_hk, total_premi, total_lembur
  FROM dbo.daftar_upah_aggregation_history
  WHERE period_month = ? AND period_year = ? AND gang_code = ?
`, [month, year, gangCode]);

if (aggRows.length === 0) {
  console.log(`No aggregation found for ${gangCode}`);
  process.exit(0);
}

const agg = aggRows[0];
console.log(`  Aggregation DB:`);
console.log(`    employees: ${agg.total_employees}`);
console.log(`    HK: ${agg.total_hk}`);
console.log(`    total_upah_kotor: ${(agg.total_upah_kotor||0).toLocaleString()}`);
console.log(`    total_potongan: ${(agg.total_potongan||0).toLocaleString()}`);
console.log(`    total_upah_bersih: ${(agg.total_upah_bersih||0).toLocaleString()}`);
console.log(`    total_premi: ${(agg.total_premi||0).toLocaleString()}`);
console.log(`    total_lembur: ${(agg.total_lembur||0).toLocaleString()}`);

// 2. Get division for this gang
console.log(`\n[2] Finding division for gang ${gangCode}...`);
const divCode = agg.division_code;
console.log(`  Division from aggregation: ${divCode}`);

// 3. Get direct extraction
console.log(`\n[3] Direct extraction via dataExtractorService...`);
try {
  const result = await dataExtractorService.extractPayrollData(
    month, year, gangCode, divCode, null, 'SERVER_PROFILE_1', false
  );

  let sumUpahBersih = 0;
  let sumUpahKotor = 0;
  let sumPotongan = 0;
  let sumPremi = 0;
  let sumLembur = 0;
  let sumHk = 0;

  console.log(`  Direct extraction: ${result.data_rows.length} employees`);
  for (const emp of result.data_rows) {
    sumUpahBersih += (emp.upah_bersih || 0);
    sumUpahKotor += (emp.jumlah_upah_kotor || 0);
    sumPotongan += (emp.total_potongan || 0);
    sumPremi += (emp.total_premi || 0);
    sumLembur += (emp.lembur_jumlah || 0);
    sumHk += (emp.jumlah_hk || 0);
  }

  console.log(`    employees: ${result.data_rows.length}`);
  console.log(`    HK: ${sumHk}`);
  console.log(`    total_upah_kotor: ${sumUpahKotor.toLocaleString()}`);
  console.log(`    total_potongan: ${sumPotongan.toLocaleString()}`);
  console.log(`    total_upah_bersih: ${sumUpahBersih.toLocaleString()}`);
  console.log(`    total_premi: ${sumPremi.toLocaleString()}`);
  console.log(`    total_lembur: ${sumLembur.toLocaleString()}`);

  // 4. Compare
  console.log(`\n[4] DIFFERENCE (Aggregation - Direct):`);
  console.log(`  =======================================`);
  console.log(`  Field              | Aggregation    | Direct        | Difference`);
  console.log(`  -------------------|----------------|---------------|------------`);
  console.log(`  Employees          | ${String(agg.total_employees).padEnd(14)} | ${String(result.data_rows.length).padEnd(13)} | ${agg.total_employees - result.data_rows.length}`);
  console.log(`  HK                 | ${String(agg.total_hk).padEnd(14)} | ${String(sumHk).padEnd(13)} | ${(agg.total_hk||0) - sumHk}`);
  console.log(`  upah_kotor         | ${(agg.total_upah_kotor||0).toString().padEnd(14)} | ${sumUpahKotor.toString().padEnd(13)} | ${((agg.total_upah_kotor||0) - sumUpahKotor).toLocaleString()}`);
  console.log(`  total_potongan     | ${(agg.total_potongan||0).toString().padEnd(14)} | ${sumPotongan.toString().padEnd(13)} | ${((agg.total_potongan||0) - sumPotongan).toLocaleString()}`);
  console.log(`  total_upah_bersih  | ${(agg.total_upah_bersih||0).toString().padEnd(14)} | ${sumUpahBersih.toString().padEnd(13)} | ${((agg.total_upah_bersih||0) - sumUpahBersih).toLocaleString()}`);
  console.log(`  =======================================`);

  // 5. Show breakdown by employee
  console.log(`\n[5] Employee breakdown (first 10):`);
  for (let i = 0; i < Math.min(10, result.data_rows.length); i++) {
    const emp = result.data_rows[i];
    const diff = (emp.upah_bersih || 0);
    console.log(`  ${emp.emp_code} (${emp.nama}): HK=${emp.jumlah_hk}, kotor=${(emp.jumlah_upah_kotor||0).toLocaleString()}, pot=${(emp.total_potongan||0).toLocaleString()}, bersih=${(emp.upah_bersih||0).toLocaleString()}`);
  }

} catch (e: any) {
  console.error(`Error: ${e.message}`);
}

console.log(`\nDone.\n`);