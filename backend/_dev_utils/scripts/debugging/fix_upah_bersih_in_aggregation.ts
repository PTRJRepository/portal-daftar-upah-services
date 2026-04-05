/**
 * One-time fix for incorrect upah_bersih in aggregation history
 * 
 * Problem: upah_bersih was calculated as (jumlah_upah_kotor - total_potongan + premi_pph)
 * Correct: upah_bersih = jumlah_upah_kotor - total_potongan
 * 
 * This updates the existing data WITHOUT full re-seeding
 */

import { Database } from "../../../src/db/client";

async function main() {
    const extDb = Database.getExtendedInstance();
    
    console.log("🔧 Starting one-time upah_bersih correction...\n");
    
    // Get all records for March 2026
    const rows = await extDb.query<any>(`
        SELECT id, gang_code, total_upah_bersih, total_upah_kotor, total_potongan
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = 3 AND period_year = 2026
    `);
    
    console.log(`Found ${rows.length} records to check\n`);
    
    let corrected = 0;
    let unchanged = 0;
    
    for (const row of rows) {
        const current = row.total_upah_bersih || 0;
        const upahKotor = row.total_upah_kotor || 0;
        const potongan = row.total_potongan || 0;
        const correct = upahKotor - potongan;
        
        if (Math.abs(current - correct) > 1) {
            // Update with correct value
            await extDb.query(`
                UPDATE dbo.daftar_upah_aggregation_history
                SET total_upah_bersih = ?
                WHERE id = ?
            `, [correct, row.id]);
            
            console.log(`✅ ${row.gang_code}: ${current.toLocaleString('id-ID')} → ${correct.toLocaleString('id-ID')}`);
            corrected++;
        } else {
            unchanged++;
        }
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Correction complete!`);
    console.log(`   Corrected: ${corrected} records`);
    console.log(`   Unchanged: ${unchanged} records`);
    console.log(`${'='.repeat(60)}`);
}

main().catch(console.error);
