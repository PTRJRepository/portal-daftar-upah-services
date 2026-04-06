import { dataExtractorService } from "../../../src/services/dataExtractorService";
import { Database } from "../../../src/db/client";

async function main() {
    const gangCode = "H1H"; // HARVESTING AIK BANGEK (ARB2)
    const division = "ARB2";
    const month = 3;
    const year = 2026;
    const expectedUpahBersih = 176414884; // Value yang diminta user
    
    console.log(`=== TRACING H1H (ARB2) upah_bersih ===\n`);
    console.log(`Expected upah_bersih: ${expectedUpahBersih.toLocaleString('id-ID')}\n`);
    
    // ===== SOURCE 1: Live Daftar Upah =====
    console.log(`📊 SOURCE 1: Live Daftar Upah (dataExtractorService)`);
    
    const liveResult = await dataExtractorService.extractPayrollData(
        month, year, gangCode, division, null, "SERVER_PROFILE_2", 
        false, false, undefined, true
    );
    
    const liveRows = liveResult.data_rows || [];
    console.log(`  Employees: ${liveRows.length}\n`);
    
    let liveTotalKotor = 0;
    let liveTotalPotongan = 0;
    let liveTotalBersih = 0;
    
    for (const emp of liveRows) {
        liveTotalKotor += emp.jumlah_upah_kotor || 0;
        liveTotalPotongan += emp.total_potongan || 0;
        liveTotalBersih += emp.upah_bersih || 0;
    }
    
    console.log(`  LIVE TOTALS:`);
    console.log(`    upah_kotor: ${liveTotalKotor.toLocaleString('id-ID')}`);
    console.log(`    potongan: ${liveTotalPotongan.toLocaleString('id-ID')}`);
    console.log(`    upah_bersih: ${liveTotalBersih.toLocaleString('id-ID')}`);
    
    // ===== SOURCE 2: Aggregation History =====
    console.log(`\n📊 SOURCE 2: Aggregation History (payrollDataService → aggregation table)`);
    
    const extDb = Database.getExtendedInstance();
    const histRows = await extDb.query<any>(`
        SELECT total_employees, total_upah_kotor, total_potongan, total_upah_bersih
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ? AND gang_code = ?
    `, [month, year, gangCode]);
    
    if (histRows.length > 0) {
        const hist = histRows[0];
        console.log(`  Employees: ${hist.total_employees}`);
        console.log(`  upah_kotor: ${(hist.total_upah_kotor || 0).toLocaleString('id-ID')}`);
        console.log(`  potongan: ${(hist.total_potongan || 0).toLocaleString('id-ID')}`);
        console.log(`  upah_bersih: ${(hist.total_upah_bersih || 0).toLocaleString('id-ID')}`);
    }
    
    // ===== COMPARISON =====
    console.log(`\n=== COMPARISON ===\n`);
    
    console.log(`| Metric | Live Daftar Upah | Aggregation History | Difference |`);
    console.log(`|--------|-------------------|---------------------|------------|`);
    
    if (histRows.length > 0) {
        const hist = histRows[0];
        console.log(`| employees | ${liveRows.length} | ${hist.total_employees} | ${liveRows.length - hist.total_employees} |`);
        console.log(`| upah_kotor | ${liveTotalKotor.toLocaleString('id-ID')} | ${(hist.total_upah_kotor || 0).toLocaleString('id-ID')} | ${(liveTotalKotor - (hist.total_upah_kotor || 0)).toLocaleString('id-ID')} |`);
        console.log(`| potongan | ${liveTotalPotongan.toLocaleString('id-ID')} | ${(hist.total_potongan || 0).toLocaleString('id-ID')} | ${(liveTotalPotongan - (hist.total_potongan || 0)).toLocaleString('id-ID')} |`);
        console.log(`| upah_bersih | ${liveTotalBersih.toLocaleString('id-ID')} | ${(hist.total_upah_bersih || 0).toLocaleString('id-ID')} | ${(liveTotalBersih - (hist.total_upah_bersih || 0)).toLocaleString('id-ID')} |`);
        
        console.log(`\n=== MATCH STATUS ===`);
        console.log(`Expected: ${expectedUpahBersih.toLocaleString('id-ID')}`);
        console.log(`Live Daftar Upah: ${liveTotalBersih.toLocaleString('id-ID')}`);
        console.log(`Aggregation History: ${(hist.total_upah_bersih || 0).toLocaleString('id-ID')}`);
        
        if (Math.abs(liveTotalBersih - expectedUpahBersih) <= 1) {
            console.log(`\n✅ Live Daftar Upah MATCHES expected!`);
        } else {
            console.log(`\n❌ Live Daftar Upah differs by ${(liveTotalBersih - expectedUpahBersih).toLocaleString('id-ID')}`);
        }
        
        if (Math.abs((hist.total_upah_bersih || 0) - expectedUpahBersih) <= 1) {
            console.log(`✅ Aggregation History MATCHES expected!`);
        } else {
            console.log(`❌ Aggregation History differs by ${((hist.total_upah_bersih || 0) - expectedUpahBersih).toLocaleString('id-ID')}`);
        }
    } else {
        console.log(`❌ No aggregation history found for H1H`);
    }
}

main().catch(console.error);
