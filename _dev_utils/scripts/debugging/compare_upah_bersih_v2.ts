/**
 * Simple Debugging Script: Compare upah_bersih between direct extraction and DB aggregation
 * Run: cd backend && bun run _dev_utils/scripts/debugging/compare_upah_bersih_v2.ts MONTH YEAR
 * Example: bun run _dev_utils/scripts/debugging/compare_upah_bersih_v2.ts 2 2026
 */
import { Database } from '../../src/db';
import { dataExtractorService } from '../../src/services/dataExtractorService';
import { gangService } from '../../src/services/gangService';
import { divisionConfigService } from '../../src/services/config/DivisionConfigService';

const month = parseInt(process.argv[2] || '2');
const year = parseInt(process.argv[3] || '2026');

console.log(`\n========================================`);
console.log(`Comparing upah_bersih: ${month}/${year}`);
console.log(`========================================\n`);

const db = Database.getExtendedInstance();

// Get all divisions in aggregation
const divisions = await db.query<any>(`
  SELECT DISTINCT division_code, COUNT(*) as gang_count, SUM(total_employees) as emp_count, SUM(total_upah_bersih) as total_upah_bersih
  FROM dbo.daftar_upah_aggregation_history
  WHERE period_month = ? AND period_year = ?
  GROUP BY division_code
  ORDER BY division_code
`, [month, year]);

console.log(`[AGGREGATION TABLE] Divisions found: ${divisions.length}`);
for (const div of divisions) {
  console.log(`  ${div.division_code}: ${div.gang_count} gangs, ${div.emp_count} employees, upah_bersih=${(div.total_upah_bersih || 0).toLocaleString()}`);
}

// Pick first division to compare
const firstDiv = divisions[0];
if (!firstDiv) {
  console.log(`No aggregation data found for ${month}/${year}`);
  process.exit(0);
}

const divCode = firstDiv.division_code;
console.log(`\n========================================`);
console.log(`DEEP DIVE: Division ${divCode}`);
console.log(`========================================\n`);

// Get all gangs in this division from DB aggregation
const gangsInAgg = await db.query<any>(`
  SELECT gang_code, total_employees, total_hk, total_upah_bersih, total_upah_kotor, total_potongan
  FROM dbo.daftar_upah_aggregation_history
  WHERE period_month = ? AND period_year = ? AND division_code = ?
  ORDER BY gang_code
`, [month, year, divCode]);

console.log(`[AGGREGATION] ${gangsInAgg.length} gangs in DB:`);
let aggTotalUpahBersih = 0;
let aggTotalUpahKotor = 0;
let aggTotalPotongan = 0;
let aggTotalEmployees = 0;

for (const g of gangsInAgg) {
  console.log(`  ${g.gang_code}: ${g.total_employees} emp, HK=${g.total_hk}, kotor=${(g.total_upah_kotor||0).toLocaleString()}, pot=${(g.total_potongan||0).toLocaleString()}, bersih=${(g.total_upah_bersih||0).toLocaleString()}`);
  aggTotalUpahBersih += (g.total_upah_bersih || 0);
  aggTotalUpahKotor += (g.total_upah_kotor || 0);
  aggTotalPotongan += (g.total_potongan || 0);
  aggTotalEmployees += (g.total_employees || 0);
}

console.log(`\n[AGGREGATION TOTALS]: ${aggTotalEmployees} employees`);
console.log(`  total_upah_kotor: ${aggTotalUpahKotor.toLocaleString()}`);
console.log(`  total_potongan: ${aggTotalPotongan.toLocaleString()}`);
console.log(`  total_upah_bersih: ${aggTotalUpahBersih.toLocaleString()}`);

// Now get live data using PayrollDataService approach
console.log(`\n[LIVE DATA] Extracting via dataExtractorService...`);

try {
  // Get gangs for this division using divisionConfigService
  const resolvedDiv = divisionConfigService.resolveCode(divCode);
  console.log(`  Resolved division: ${divCode} -> ${resolvedDiv}`);

  // Get gangs from gangService
  const gangs = await gangService.fetchGangs(resolvedDiv, undefined, 'SERVER_PROFILE_1', 'db_ptrj');
  console.log(`  Found ${gangs.length} gangs in gangService`);

  // Extract for first gang only to see structure
  if (gangs.length > 0) {
    const firstGang = gangs[0].gang_code?.trim() || '';
    console.log(`\n  Testing with first gang: ${firstGang}`);

    const result = await dataExtractorService.extractPayrollData(
      month, year, firstGang, resolvedDiv, null, 'SERVER_PROFILE_1', false
    );

    console.log(`  Result: ${result.data_rows.length} employees`);

    // Show first 3 employees
    for (let i = 0; i < Math.min(3, result.data_rows.length); i++) {
      const emp = result.data_rows[i];
      console.log(`  EMP ${emp.emp_code} (${emp.nama}):`);
      console.log(`    gang_code=${emp.gang_code}, jumlah_hk=${emp.jumlah_hk}`);
      console.log(`    jumlah_upah_kotor=${(emp.jumlah_upah_kotor||0).toLocaleString()}`);
      console.log(`    total_potongan=${(emp.total_potongan||0).toLocaleString()}`);
      console.log(`    upah_bersih=${(emp.upah_bersih||0).toLocaleString()}`);
    }

    // Sum all employees from this gang
    let sumUpahBersih = 0;
    let sumUpahKotor = 0;
    let sumPotongan = 0;
    for (const emp of result.data_rows) {
      sumUpahBersih += (emp.upah_bersih || 0);
      sumUpahKotor += (emp.jumlah_upah_kotor || 0);
      sumPotongan += (emp.total_potongan || 0);
    }

    console.log(`\n  SUM for gang ${firstGang}:`);
    console.log(`    Employees: ${result.data_rows.length}`);
    console.log(`    jumlah_upah_kotor: ${sumUpahKotor.toLocaleString()}`);
    console.log(`    total_potongan: ${sumPotongan.toLocaleString()}`);
    console.log(`    upah_bersih: ${sumUpahBersih.toLocaleString()}`);

    // Compare with aggregation for this gang
    const aggForGang = gangsInAgg.find(g => g.gang_code === firstGang);
    if (aggForGang) {
      console.log(`\n  AGGREGATION for gang ${firstGang}:`);
      console.log(`    Employees: ${aggForGang.total_employees}`);
      console.log(`    jumlah_upah_kotor: ${(aggForGang.total_upah_kotor||0).toLocaleString()}`);
      console.log(`    total_potongan: ${(aggForGang.total_potongan||0).toLocaleString()}`);
      console.log(`    upah_bersih: ${(aggForGang.total_upah_bersih||0).toLocaleString()}`);

      console.log(`\n  DIFFERENCE for gang ${firstGang}:`);
      console.log(`    Employees diff: ${aggForGang.total_employees - result.data_rows.length}`);
      console.log(`    kotor diff: ${((aggForGang.total_upah_kotor||0) - sumUpahKotor).toLocaleString()}`);
      console.log(`    pot diff: ${((aggForGang.total_potongan||0) - sumPotongan).toLocaleString()}`);
      console.log(`    bersih diff: ${((aggForGang.total_upah_bersih||0) - sumUpahBersih).toLocaleString()}`);
    }
  }
} catch (e: any) {
  console.error(`Error: ${e.message}`);
}

console.log(`\nDone.\n`);