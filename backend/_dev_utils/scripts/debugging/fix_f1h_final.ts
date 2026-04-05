import { Database } from "../../../src/db/client";

async function main() {
    const extDb = Database.getExtendedInstance();
    
    const gangCode = "F1H";
    const correctUpahBersih = 169000000;
    const month = 3;
    const year = 2026;
    
    console.log(`🔧 Updating upah_bersih for ${gangCode} to ${correctUpahBersih.toLocaleString('id-ID')}...\n`);
    
    // 1. Update aggregation history
    const aggCount = await extDb.query<any>(`
        UPDATE dbo.daftar_upah_aggregation_history
        SET total_upah_bersih = ?
        WHERE period_month = ? AND period_year = ? AND gang_code = ?
    `, [correctUpahBersih, month, year, gangCode]);
    
    console.log(`✅ Updated ${aggCount} aggregation record(s)`);
    
    // 2. Update payroll_history_header (all headers for this gang/period)
    const headerCount = await extDb.query<any>(`
        UPDATE dbo.payroll_history_header
        SET total_upah_bersih = ?
        WHERE period_month = ? AND period_year = ? AND gang_code = ?
    `, [correctUpahBersih, month, year, gangCode]);
    
    console.log(`✅ Updated ${headerCount} header record(s)`);
    
    console.log(`\n✅ DONE! ${gangCode} upah_bersih is now ${correctUpahBersih.toLocaleString('id-ID')}`);
}

main().catch(console.error);
