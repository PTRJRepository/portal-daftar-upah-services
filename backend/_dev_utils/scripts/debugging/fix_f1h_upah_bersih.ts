import { Database } from "../../../src/db/client";

async function main() {
    const extDb = Database.getExtendedInstance();
    
    const gangCode = "F1H";
    const correctUpahBersih = 169000000; // 169 juta
    const month = 3;
    const year = 2026;
    
    console.log(`🔧 Updating upah_bersih for ${gangCode}...\n`);
    
    // Check current value
    const currentRow = await extDb.query<any>(`
        SELECT id, gang_code, total_upah_bersih, total_upah_kotor, total_potongan
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ? AND gang_code = ?
    `, [month, year, gangCode]);
    
    if (currentRow.length === 0) {
        console.log(`❌ No record found for ${gangCode}`);
        return;
    }
    
    const current = currentRow[0];
    console.log(`Gang: ${current.gang_code}`);
    console.log(`Current upah_bersih: ${(current.total_upah_bersih || 0).toLocaleString('id-ID')}`);
    console.log(`Correct upah_bersih: ${correctUpahBersih.toLocaleString('id-ID')}`);
    console.log(`Difference: ${((current.total_upah_bersih || 0) - correctUpahBersih).toLocaleString('id-ID')}`);
    
    // Update
    await extDb.query(`
        UPDATE dbo.daftar_upah_aggregation_history
        SET total_upah_bersih = ?
        WHERE id = ?
    `, [correctUpahBersih, current.id]);
    
    console.log(`\n✅ Updated successfully!`);
    
    // Verify
    const verifyRow = await extDb.query<any>(`
        SELECT total_upah_bersih
        FROM dbo.daftar_upah_aggregation_history
        WHERE id = ?
    `, [current.id]);
    
    console.log(`Verified: ${(verifyRow[0].total_upah_bersih || 0).toLocaleString('id-ID')}`);
}

main().catch(console.error);
