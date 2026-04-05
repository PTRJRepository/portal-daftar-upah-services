import { Database } from '../db/client';
const db = Database.getExtendedInstance();

const rows = await db.query<any>(`
  SELECT gang_code, total_upah_bersih, total_upah_kotor, total_potongan
  FROM dbo.daftar_upah_aggregation_history
  WHERE period_month = 2 AND period_year = 2026 AND division_code = 'AB2'
  ORDER BY gang_code
`);

let totalBersih = 0;
let totalKotor = 0;
let totalPotongan = 0;

console.log('AB2 Gangs:');
for (const r of rows) {
  console.log(`  ${r.gang_code}: kotor=${(r.total_upah_kotor||0).toLocaleString()}, pot=${(r.total_potongan||0).toLocaleString()}, bersih=${(r.total_upah_bersih||0).toLocaleString()}`);
  totalBersih += (r.total_upah_bersih||0);
  totalKotor += (r.total_upah_kotor||0);
  totalPotongan += (r.total_potongan||0);
}

console.log(`\nTOTAL AB2:`);
console.log(`  kotor: ${totalKotor.toLocaleString()}`);
console.log(`  pot: ${totalPotongan.toLocaleString()}`);
console.log(`  bersih: ${totalBersih.toLocaleString()}`);

// Now get direct extraction total for AB2
import { dataExtractorService } from '../services/dataExtractorService';
import { gangService } from '../services/gangService';

console.log(`\nDirect extraction for AB2...`);
const gangs = await gangService.fetchGangs('AB2', undefined, 'SERVER_PROFILE_1', 'db_ptrj');

let directBersih = 0;
let directKotor = 0;
let directPotongan = 0;
let empCount = 0;

for (const gang of gangs) {
  const gc = gang.gang_code?.trim() || '';
  const result = await dataExtractorService.extractPayrollData(2, 2026, gc, 'AB2', null, 'SERVER_PROFILE_1', false);
  for (const emp of result.data_rows) {
    empCount++;
    directBersih += (emp.upah_bersih || 0);
    directKotor += (emp.jumlah_upah_kotor || 0);
    directPotongan += (emp.total_potongan || 0);
  }
}

console.log(`  Employees: ${empCount}`);
console.log(`  kotor: ${directKotor.toLocaleString()}`);
console.log(`  pot: ${directPotongan.toLocaleString()}`);
console.log(`  bersih: ${directBersih.toLocaleString()}`);

console.log(`\nDIFFERENCE (Agg - Direct):`);
console.log(`  kotor: ${(totalKotor - directKotor).toLocaleString()}`);
console.log(`  pot: ${(totalPotongan - directPotongan).toLocaleString()}`);
console.log(`  bersih: ${(totalBersih - directBersih).toLocaleString()}`);