import { Database } from "../../../src/db/client";

async function main() {
    const extDb = Database.getExtendedInstance();
    
    const gangCode = "G1H"; // HARVESTING TIMUR
    const division = "P1A";
    const correctUpahBersih = 176414884;
    const month = 3;
    const year = 2026;
    
    console.log(`🔧 Updating upah_bersih for ${gangCode} (HARVESTING TIMUR)...\n`);
    
    // 1. Check current value
    const currentRow = await extDb.query<any>(`
        SELECT id, gang_code, total_upah_bersih, total_upah_kotor, total_potongan, total_employees
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ? AND gang_code = ?
    `, [month, year, gangCode]);
    
    if (currentRow.length === 0) {
        console.log(`❌ No record found for ${gangCode}`);
        return;
    }
    
    const current = currentRow[0];
    console.log(`Current upah_bersih: ${(current.total_upah_bersih || 0).toLocaleString('id-ID')}`);
    console.log(`Correct upah_bersih: ${correctUpahBersih.toLocaleString('id-ID')}`);
    console.log(`Difference: ${((current.total_upah_bersih || 0) - correctUpahBersih).toLocaleString('id-ID')}`);
    
    // 2. Update aggregation history
    await extDb.query(`
        UPDATE dbo.daftar_upah_aggregation_history
        SET total_upah_bersih = ?
        WHERE period_month = ? AND period_year = ? AND gang_code = ?
    `, [correctUpahBersih, month, year, gangCode]);
    
    console.log(`\n✅ Updated aggregation history!`);
    
    // 3. Update payroll_history_header (all headers for this gang/period)
    const headerCount = await extDb.query<any>(`
        UPDATE dbo.payroll_history_header
        SET total_upah_bersih = ?
        WHERE period_month = ? AND period_year = ? AND gang_code = ?
    `, [correctUpahBersih, month, year, gangCode]);
    
    console.log(`✅ Updated ${headerCount} header record(s)!`);
    
    // 4. Verify
    const verifyRow = await extDb.query<any>(`
        SELECT total_upah_bersih
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ? AND gang_code = ?
    `, [month, year, gangCode]);
    
    console.log(`\nVerified: ${(verifyRow[0].total_upah_bersih || 0).toLocaleString('id-ID')}`);
}

main().catch(console.error);
