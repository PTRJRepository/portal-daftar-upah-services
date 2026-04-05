import { Database } from "../../../src/db/client";

async function main() {
    const extDb = Database.getExtendedInstance();
    
    const fixes = [
        { gangCode: "F1H", correctUpahBersih: 169000000 },
        { gangCode: "F1M", correctUpahBersih: 101462767 },
    ];
    
    console.log(`🔧 Batch fixing upah_bersih for multiple gangs...\n`);
    
    for (const fix of fixes) {
        console.log(`${fix.gangCode}:`);
        
        // Update aggregation history
        await extDb.query(`
            UPDATE dbo.daftar_upah_aggregation_history
            SET total_upah_bersih = ?
            WHERE period_month = 3 AND period_year = 2026 AND gang_code = ?
        `, [fix.correctUpahBersih, fix.gangCode]);
        
        // Update payroll_history_header
        await extDb.query(`
            UPDATE dbo.payroll_history_header
            SET total_upah_bersih = ?
            WHERE period_month = 3 AND period_year = 2026 AND gang_code = ?
        `, [fix.correctUpahBersih, fix.gangCode]);
        
        // Verify
        const verifyRow = await extDb.query<any>(`
            SELECT total_upah_bersih
            FROM dbo.daftar_upah_aggregation_history
            WHERE period_month = 3 AND period_year = 2026 AND gang_code = ?
        `, [fix.gangCode]);
        
        console.log(`  ✅ Updated to: ${(verifyRow[0].total_upah_bersih || 0).toLocaleString('id-ID')}\n`);
    }
    
    console.log(`✅ All fixes applied!`);
}

main().catch(console.error);
