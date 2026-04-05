import { Database } from '../db/client';

const db = Database.getExtendedInstance();
const month = 2, year = 2026;

// Get all gangs in aggregation
const gangs = await db.query<any>(`
  SELECT DISTINCT gang_code, division_code, total_upah_bersih, total_employees
  FROM dbo.daftar_upah_aggregation_history
  WHERE period_month = ? AND period_year = ?
  ORDER BY division_code, gang_code
`, [month, year]);

console.log('ALL GANGS in aggregation:');
let found = 0;
for (const g of gangs) {
  const gc = g.gang_code?.toUpperCase() || '';
  if (gc.includes('TIMUR') || gc.includes('HARVEST')) {
    console.log(`  FOUND: ${g.gang_code} | div=${g.division_code} | bersih=${(g.total_upah_bersih||0).toLocaleString()}`);
    found++;
  }
}

if (found === 0) {
  console.log('  No gangs containing TIMUR or HARVEST');
  console.log('\nAll divisions:');
  const divs = [...new Set(gangs.map(g => g.division_code))];
  console.log(divs.join(', '));

  console.log('\nAll gangs (first 30):');
  for (let i = 0; i < Math.min(30, gangs.length); i++) {
    console.log(`  ${gangs[i].gang_code} | ${gangs[i].division_code}`);
  }
}