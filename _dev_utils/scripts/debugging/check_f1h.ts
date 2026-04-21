/**
 * Check F1H - find where it is and compare aggregation vs direct
 * Run: cd backend && bun run src/scripts/check_f1h.ts
 */
import { Database } from '../db/client';
import { dataExtractorService } from '../services/dataExtractorService';
import { gangService } from '../services/gangService';

const month = 2, year = 2026;
const gangCode = 'F1H';

console.log(`\n========================================`);
console.log(`Checking F1H`);
console.log(`========================================\n`);

const db = Database.getExtendedInstance();

// 1. Find F1H in aggregation
console.log(`[1] Finding F1H in aggregation...`);
const aggRows = await db.query<any>(`
  SELECT gang_code, division_code, total_upah_bersih, total_upah_kotor,
         total_potongan, total_employees, total_hk, total_koreksi
  FROM dbo.daftar_upah_aggregation_history
  WHERE period_month = ? AND period_year = ? AND gang_code = ?
`, [month, year, gangCode]);

if (aggRows.length === 0) {
  console.log(`  F1H not found in aggregation for ${month}/${year}`);

  // Search all months
  const allRows = await db.query<any>(`
    SELECT TOP 5 period_month, period_year, gang_code, division_code, total_upah_bersih
    FROM dbo.daftar_upah_aggregation_history
    WHERE gang_code = ?
    ORDER BY period_year DESC, period_month DESC
  `, [gangCode]);

  console.log(`  Search result for F1H in all periods:`);
  for (const r of allRows) {
    console.log(`    ${r.period_month}/${r.period_year}: div=${r.division_code}, bersih=${(r.total_upah_bersih||0).toLocaleString()}`);
  }
} else {
  const agg = aggRows[0];
  console.log(`  AGGREGATION (from DB):`);
  console.log(`    Division: ${agg.division_code}`);
  console.log(`    Employees: ${agg.total_employees}`);
  console.log(`    HK: ${agg.total_hk}`);
  console.log(`    total_upah_kotor: ${(agg.total_upah_kotor||0).toLocaleString()}`);
  console.log(`    total_potongan: ${(agg.total_potongan||0).toLocaleString()}`);
  console.log(`    total_koreksi: ${(agg.total_koreksi||0).toLocaleString()}`);
  console.log(`    total_upah_bersih: ${(agg.total_upah_bersih||0).toLocaleString()}`);

  // 2. Get division for this gang
  const divCode = agg.division_code;

  // 3. Get direct extraction
  console.log(`\n[2] Direct extraction for F1H (division ${divCode})...`);
  const result = await dataExtractorService.extractPayrollData(
    month, year, gangCode, divCode, null, 'SERVER_PROFILE_1', false
  );

  let sumUpahBersih = 0;
  let sumUpahKotor = 0;
  let sumPotongan = 0;
  let sumKoreksi = 0;

  for (const emp of result.data_rows) {
    sumUpahBersih += (emp.upah_bersih || 0);
    sumUpahKotor += (emp.jumlah_upah_kotor || 0);
    sumPotongan += (emp.total_potongan || 0);
    sumKoreksi += (emp.pot_koreksi || 0);
  }

  console.log(`  DIRECT EXTRACTION:`);
  console.log(`    Employees: ${result.data_rows.length}`);
  console.log(`    total_upah_kotor: ${sumUpahKotor.toLocaleString()}`);
  console.log(`    total_potongan: ${sumPotongan.toLocaleString()}`);
  console.log(`    total_koreksi: ${sumKoreksi.toLocaleString()}`);
  console.log(`    total_upah_bersih: ${sumUpahBersih.toLocaleString()}`);

  console.log(`\n  DIFFERENCE (Aggregation - Direct):`);
  console.log(`    kotor: ${((agg.total_upah_kotor||0) - sumUpahKotor).toLocaleString()}`);
  console.log(`    pot: ${((agg.total_potongan||0) - sumPotongan).toLocaleString()}`);
  console.log(`    koreksi: ${((agg.total_koreksi||0) - sumKoreksi).toLocaleString()}`);
  console.log(`    bersih: ${((agg.total_upah_bersih||0) - sumUpahBersih).toLocaleString()}`);
}

console.log(`\nDone.\n`);