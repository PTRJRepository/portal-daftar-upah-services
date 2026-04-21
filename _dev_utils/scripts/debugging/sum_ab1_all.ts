/**
 * Sum all gangs in AB1 to see total
 * Run: cd backend && bun run src/scripts/sum_ab1_all.ts
 */
import { Database } from '../db/client';

const month = 2, year = 2026;

console.log(`\n========================================`);
console.log(`Summing all gangs in AB1`);
console.log(`========================================\n`);

const db = Database.getExtendedInstance();

const rows = await db.query<any>(`
  SELECT gang_code, total_upah_bersih, total_upah_kotor, total_potongan,
         total_employees, total_gaji_pokok, total_tunjangan, total_premi, total_koreksi
  FROM dbo.daftar_upah_aggregation_history
  WHERE period_month = ? AND period_year = ? AND division_code = 'AB1'
  ORDER BY gang_code
`, [month, year]);

let totalBersih = 0;
let totalKotor = 0;
let totalPotongan = 0;
let totalKoreksi = 0;

console.log(`G1H Breakdown (for reference):`);
for (const r of rows) {
  if (r.gang_code === 'G1H') {
    console.log(`  G1H: kotor=${(r.total_upah_kotor||0).toLocaleString()}, pot=${(r.total_potongan||0).toLocaleString()}, koreksi=${(r.total_koreksi||0).toLocaleString()}, bersih=${(r.total_upah_bersih||0).toLocaleString()}`);
  }
}

console.log(`\nAll gangs in AB1:`);
for (const r of rows) {
  console.log(`  ${r.gang_code}: kotor=${(r.total_upah_kotor||0).toLocaleString()}, koreksi=${(r.total_koreksi||0).toLocaleString()}, bersih=${(r.total_upah_bersih||0).toLocaleString()}`);
  totalBersih += (r.total_upah_bersih || 0);
  totalKotor += (r.total_upah_kotor || 0);
  totalPotongan += (r.total_potongan || 0);
  totalKoreksi += (r.total_koreksi || 0);
}

console.log(`\nTOTAL AB1 (from aggregation):`);
console.log(`  total_upah_kotor: ${totalKotor.toLocaleString()}`);
console.log(`  total_potongan: ${totalPotongan.toLocaleString()}`);
console.log(`  total_koreksi: ${totalKoreksi.toLocaleString()}`);
console.log(`  total_upah_bersih: ${totalBersih.toLocaleString()}`);

// Now get direct extraction total for AB1
import { dataExtractorService } from '../services/dataExtractorService';
import { gangService } from '../services/gangService';

console.log(`\nDirect extraction for AB1 (all gangs)...`);
const gangs = await gangService.fetchGangs('AB1', undefined, 'SERVER_PROFILE_1', 'db_ptrj');

let directBersih = 0;
let directKotor = 0;
let directPotongan = 0;
let directKoreksi = 0;
let empCount = 0;

for (const gang of gangs) {
  const gc = gang.gang_code?.trim() || '';
  const result = await dataExtractorService.extractPayrollData(month, year, gc, 'AB1', null, 'SERVER_PROFILE_1', false);
  for (const emp of result.data_rows) {
    empCount++;
    directBersih += (emp.upah_bersih || 0);
    directKotor += (emp.jumlah_upah_kotor || 0);
    directPotongan += (emp.total_potongan || 0);
    directKoreksi += (emp.pot_koreksi || 0);
  }
}

console.log(`  Employees: ${empCount}`);
console.log(`  total_upah_kotor: ${directKotor.toLocaleString()}`);
console.log(`  total_potongan: ${directPotongan.toLocaleString()}`);
console.log(`  total_koreksi: ${directKoreksi.toLocaleString()}`);
console.log(`  total_upah_bersih: ${directBersih.toLocaleString()}`);

console.log(`\nDIFFERENCE (Aggregation - Direct):`);
console.log(`  kotor: ${(totalKotor - directKotor).toLocaleString()}`);
console.log(`  pot: ${(totalPotongan - directPotongan).toLocaleString()}`);
console.log(`  koreksi: ${(totalKoreksi - directKoreksi).toLocaleString()}`);
console.log(`  bersih: ${(totalBersih - directBersih).toLocaleString()}`);

console.log(`\nDone.\n`);