import { dataExtractorService } from "../../../src/services/dataExtractorService";
import { Database } from "../../../src/db/client";

async function main() {
    const gangCode = "G1H"; // HARVESTING TIMUR (ARB1 / AB1)
    const division = "ARB1";
    const month = 3;
    const year = 2026;
    
    console.log(`=== CHECKING G1H (HARVESTING TIMUR / ARB1) ===\n`);
    
    // 1. Live Daftar Upah
    console.log(`📊 SOURCE 1: Live Daftar Upah`);
    const liveResult = await dataExtractorService.extractPayrollData(
        month, year, gangCode, division, null, "SERVER_PROFILE_2", 
        false, false, undefined, true
    );
    
    const liveRows = liveResult.data_rows || [];
    let liveKotor = 0, livePotongan = 0, liveBersih = 0;
    for (const emp of liveRows) {
        liveKotor += emp.jumlah_upah_kotor || 0;
        livePotongan += emp.total_potongan || 0;
        liveBersih += emp.upah_bersih || 0;
    }
    console.log(`  Employees: ${liveRows.length}`);
    console.log(`  upah_bersih: ${liveBersih.toLocaleString('id-ID')}`);
    
    // 2. Aggregation History
    console.log(`\n📊 SOURCE 2: Aggregation History`);
    const extDb = Database.getExtendedInstance();
    const histRows = await extDb.query<any>(`
        SELECT total_employees, total_upah_bersih
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ? AND gang_code = ?
    `, [month, year, gangCode]);
    
    if (histRows.length > 0) {
        console.log(`  Employees: ${histRows[0].total_employees}`);
        console.log(`  upah_bersih: ${(histRows[0].total_upah_bersih || 0).toLocaleString('id-ID')}`);
    }
    
    console.log(`\n=== STATUS ===`);
    console.log(`Expected: 176.414.884`);
    console.log(`Live: ${liveBersih.toLocaleString('id-ID')}`);
}

main().catch(console.error);
