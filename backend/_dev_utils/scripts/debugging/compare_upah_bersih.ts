import { dataExtractorService } from "../../../src/services/dataExtractorService";
import { Database } from "../../../src/db/client";

async function main() {
    const month = 3;
    const year = 2026;
    const testGang = "C1H"; // Test gang
    const testDiv = "P2A";

    console.log(`=== COMPARING upah_bersih: Daftar Upah vs Summary Report ===\n`);

    // ===== 1. Get live Daftar Upah data =====
    console.log("📊 Fetching LIVE Daftar Upah data...");
    const liveData = await dataExtractorService.extractPayrollData(
        month, year, testGang, testDiv, null, "SERVER_PROFILE_2", false, false
    );

    const liveRows = liveData.data_rows || [];
    let liveTotalUpahBersih = 0;

    console.log(`\nLive employees (${liveRows.length}):\n`);
    for (const emp of liveRows.slice(0, 5)) {
        console.log(`  ${emp.emp_code}: upah_bersih = ${(emp.upah_bersih || 0).toLocaleString('id-ID')}`);
        liveTotalUpahBersih += emp.upah_bersih || 0;
    }
    if (liveRows.length > 5) console.log(`  ... and ${liveRows.length - 5} more`);
    
    console.log(`\nLive total_upah_bersih: ${liveTotalUpahBersih.toLocaleString('id-ID')}`);

    // ===== 2. Get aggregation history data =====
    console.log(`\n📊 Fetching AGGREGATION HISTORY (Summary Report source)...`);
    const extDb = Database.getExtendedInstance();

    const histRows = await extDb.query<any>(`
        SELECT gang_code, total_upah_bersih, total_employees
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ? AND gang_code = ?
        ORDER BY id DESC
    `, [month, year, testGang]);

    if (histRows.length > 0) {
        const hist = histRows[0];
        console.log(`History total_upah_bersih: ${(hist.total_upah_bersih || 0).toLocaleString('id-ID')}`);
        console.log(`History total_employees: ${hist.total_employees}`);
        
        console.log(`\n=== DIFFERENCE ===`);
        const diff = liveTotalUpahBersih - (hist.total_upah_bersih || 0);
        console.log(`Live upah_bersih: ${liveTotalUpahBersih.toLocaleString('id-ID')}`);
        console.log(`History upah_bersih: ${(hist.total_upah_bersih || 0).toLocaleString('id-ID')}`);
        console.log(`Difference: ${diff > 0 ? '+' : ''}${diff.toLocaleString('id-ID')}`);
        
        if (Math.abs(diff) > 1) {
            console.log(`\n⚠️ MISMATCH! Upah bersih berbeda!`);
        } else {
            console.log(`\n✅ Match! (within 1 rounding)`);
        }
    } else {
        console.log(`⚠️ No history found for gang ${testGang}`);
    }
}

main().catch(console.error);
