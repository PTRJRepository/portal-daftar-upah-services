import { Database } from "../../../src/db/client";

async function main() {
    const extDb = Database.getExtendedInstance();
    const gangCode = "H1H";
    const month = 3;
    const year = 2026;
    const expected = 176414884;
    
    console.log(`=== CHECKING ALL H1H RECORDS ===\n`);
    console.log(`Expected upah_bersih: ${expected.toLocaleString('id-ID')}\n`);
    
    // Get ALL H1H records (including old ones if any)
    const rows = await extDb.query<any>(`
        SELECT id, total_employees, total_upah_kotor, total_potongan, total_upah_bersih, created_at
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ? AND gang_code = ?
        ORDER BY id DESC
    `, [month, year, gangCode]);
    
    console.log(`Found ${rows.length} records for H1H:\n`);
    
    for (const row of rows) {
        const diff = (row.total_upah_bersih || 0) - expected;
        const marker = Math.abs(diff) <= 1 ? '✅ MATCH' : `❌ Diff: ${diff.toLocaleString('id-ID')}`;
        
        console.log(`ID ${row.id}:`);
        console.log(`  employees: ${row.total_employees}`);
        console.log(`  kotor: ${(row.total_upah_kotor || 0).toLocaleString('id-ID')}`);
        console.log(`  potongan: ${(row.total_potongan || 0).toLocaleString('id-ID')}`);
        console.log(`  bersih: ${(row.total_upah_bersih || 0).toLocaleString('id-ID')} ${marker}`);
        console.log(`  created: ${row.created_at}`);
        console.log();
    }
    
    // Also check if there's data for April (month 4) that might match
    console.log(`\n=== CHECKING APRIL 2026 DATA ===\n`);
    const aprilRows = await extDb.query<any>(`
        SELECT id, total_employees, total_upah_bersih, created_at
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = 4 AND period_year = 2026 AND gang_code = ?
    `, [gangCode]);
    
    if (aprilRows.length > 0) {
        for (const row of aprilRows) {
            const diff = (row.total_upah_bersih || 0) - expected;
            console.log(`April ID ${row.id}: bersih=${(row.total_upah_bersih || 0).toLocaleString('id-ID')} | diff=${diff.toLocaleString('id-ID')}`);
        }
    } else {
        console.log(`No April data for H1H`);
    }
}

main().catch(console.error);
