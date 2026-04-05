import { Database } from "../../../src/db/client";

async function main() {
    const extDb = Database.getExtendedInstance();
    const month = 3;
    const year = 2026;
    
    console.log(`=== CHECKING AB1 (Air Ruak B1) DATA ===\n`);
    
    // Get all AB1 gangs
    const rows = await extDb.query<any>(`
        SELECT gang_code, total_employees, total_upah_kotor, total_potongan, total_upah_bersih
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ? AND division_code = 'AB1'
        ORDER BY gang_code
    `, [month, year]);
    
    console.log(`Current AB1 gang records:\n`);
    
    let totalKotor = 0;
    let totalPotongan = 0;
    let totalBersih = 0;
    let totalEmployees = 0;
    
    for (const row of rows) {
        console.log(`${row.gang_code}: emp=${row.total_employees} | kotor=${(row.total_upah_kotor || 0).toLocaleString('id-ID')} | potongan=${(row.total_potongan || 0).toLocaleString('id-ID')} | bersih=${(row.total_upah_bersih || 0).toLocaleString('id-ID')}`);
        totalKotor += row.total_upah_kotor || 0;
        totalPotongan += row.total_potongan || 0;
        totalBersih += row.total_upah_bersih || 0;
        totalEmployees += row.total_employees || 0;
    }
    
    console.log(`\n=== CURRENT TOTALS ===`);
    console.log(`Gangs: ${rows.length}`);
    console.log(`Employees: ${totalEmployees}`);
    console.log(`upah_kotor: ${totalKotor.toLocaleString('id-ID')}`);
    console.log(`potongan: ${totalPotongan.toLocaleString('id-ID')}`);
    console.log(`upah_bersih: ${totalBersih.toLocaleString('id-ID')}`);
    
    console.log(`\n=== EXPECTED ===`);
    console.log(`upah_bersih: 690.397.043`);
    console.log(`Difference: ${(totalBersih - 690397043).toLocaleString('id-ID')}`);
    
    if (Math.abs(totalBersih - 690397043) > 1) {
        console.log(`\n❌ MISMATCH! Need to fix.`);
    } else {
        console.log(`\n✅ MATCH! No fix needed.`);
    }
}

main().catch(console.error);
