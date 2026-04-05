/**
 * Debugging Script: Compare upah_bersih between:
 * 1. Direct extraction (same as Daftar Upah)
 * 2. Aggregation table (seeded data, used by Summary Report)
 *
 * Run: cd backend && bun run _dev_utils/scripts/debugging/compare_upah_bersih.ts
 */
import { dataExtractorService } from '../../src/services/dataExtractorService';
import { Database } from '../../src/db';
import { gangService } from '../../src/services/gangService';

const month = parseInt(process.argv[2] || '2');
const year = parseInt(process.argv[3] || '2026');
const division = process.argv[4] || 'PG1A';
const gangCode = process.argv[5] || 'ALL'; // Optional: specific gang

console.log(`\n========================================`);
console.log(`Comparing upah_bersih: ${division} - ${month}/${year} ${gangCode !== 'ALL' ? '(Gang: ' + gangCode + ')' : ''}`);
console.log(`========================================\n`);

// 1. Get gangs for this division
console.log(`[1] Getting gangs for division ${division}...`);
const gangs = await gangService.fetchGangs(division, undefined, 'SERVER_PROFILE_1', 'db_ptrj');
console.log(`  Found ${gangs.length} gangs`);
const gangCodes = gangs.map(g => g.gang_code?.trim()).filter(Boolean);

// 2. Get direct extraction (same data as Daftar Upah uses)
// Pass 'ALL' to get all gangs in one call
console.log(`\n[2] Extracting direct data from dataExtractorService (gangCode='ALL')...`);
const directResult = await dataExtractorService.extractPayrollData(
  month, year, 'ALL', division, null, 'SERVER_PROFILE_1', false
);

let directUpahBersih = 0;
let directEmployees = 0;
let directJumlahUpahKotor = 0;
let directTotalPotongan = 0;
const directGangsFound = new Set<string>();

for (const emp of directResult.data_rows) {
  directEmployees++;
  directUpahBersih += (emp.upah_bersih || 0);
  directJumlahUpahKotor += (emp.jumlah_upah_kotor || 0);
  directTotalPotongan += (emp.total_potongan || 0);
  directGangsFound.add(emp.gang_code || 'UNKNOWN');
}

console.log(`  Direct extraction (${directGangsFound.size} gangs):`);
console.log(`    Employees: ${directEmployees}`);
console.log(`    jumlah_upah_kotor: ${directJumlahUpahKotor.toLocaleString()}`);
console.log(`    total_potongan: ${directTotalPotongan.toLocaleString()}`);
console.log(`    upah_bersih: ${directUpahBersih.toLocaleString()}`);
console.log(`    Gangs: ${[...directGangsFound].sort().join(', ')}`);

// 3. Get aggregation from database
console.log(`\n[3] Fetching from aggregation table...`);
const db = Database.getExtendedInstance();

let aggQuery = `
  SELECT gang_code, division_code,
         total_upah_bersih, total_upah_kotor, total_potongan,
         total_employees, total_hk
  FROM dbo.daftar_upah_aggregation_history
  WHERE period_month = ? AND period_year = ?
`;
const params: any[] = [month, year];

if (division !== 'ALL') {
  aggQuery += ` AND division_code = ?`;
  params.push(division);
}

const aggResult = await db.query<any>(aggQuery, params);

let aggUpahBersih = 0;
let aggEmployees = 0;
let aggUpahKotor = 0;
let aggPotongan = 0;

for (const row of aggResult) {
  aggUpahBersih += (row.total_upah_bersih || 0);
  aggEmployees += (row.total_employees || 0);
  aggUpahKotor += (row.total_upah_kotor || 0);
  aggPotongan += (row.total_potongan || 0);
}

console.log(`  Aggregation table (${aggResult.length} gangs in DB):`);
console.log(`    Employees: ${aggEmployees}`);
console.log(`    jumlah_upah_kotor: ${aggUpahKotor.toLocaleString()}`);
console.log(`    total_potongan: ${aggPotongan.toLocaleString()}`);
console.log(`    upah_bersih: ${aggUpahBersih.toLocaleString()}`);

// 4. Compare
console.log(`\n[4] COMPARISON:`);
console.log(`  ========================================`);
console.log(`  Field              | Direct       | Aggregation  | Difference`);
console.log(`  -------------------|--------------|--------------|------------`);
console.log(`  Employees          | ${String(directEmployees).padEnd(12)} | ${String(aggEmployees).padEnd(12)} | ${aggEmployees - directEmployees}`);
console.log(`  jumlah_upah_kotor | ${directJumlahUpahKotor.toLocaleString().padEnd(12)} | ${aggUpahKotor.toLocaleString().padEnd(12)} | ${(aggUpahKotor - directJumlahUpahKotor).toLocaleString()}`);
console.log(`  total_potongan     | ${directTotalPotongan.toLocaleString().padEnd(12)} | ${aggPotongan.toLocaleString().padEnd(12)} | ${(aggPotongan - directTotalPotongan).toLocaleString()}`);
console.log(`  upah_bersih        | ${directUpahBersih.toLocaleString().padEnd(12)} | ${aggUpahBersih.toLocaleString().padEnd(12)} | ${(aggUpahBersih - directUpahBersih).toLocaleString()}`);
console.log(`  ========================================`);

// 5. Per-gang breakdown (aggregation)
console.log(`\n[5] Per-gang breakdown (aggregation):`);
for (const row of aggResult.slice(0, 20)) {
  console.log(`  Gang ${row.gang_code}: HK=${row.total_hk}, emp=${row.total_employees}, upah_bersih=${(row.total_upah_bersih || 0).toLocaleString()}`);
}
if (aggResult.length > 20) {
  console.log(`  ... and ${aggResult.length - 20} more gangs`);
}

console.log(`\n[6] Gangs in division: ${gangCodes.join(', ')}`);
console.log(`[7] Gangs found in direct data: ${[...directGangsFound].sort().join(', ')}`);

console.log(`\nDone.\n`);