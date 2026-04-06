import { dataExtractorService } from "../../../src/services/dataExtractorService";
import { Database } from "../../../src/db/client";

async function main() {
    const month = 3;
    const year = 2026;
    const testGang = "F1H"; // Test gang
    const testDiv = "ARA";

    console.log(`=== COMPARING upah_bersih: Daftar Upah vs Summary Report ===\n`);

    // ===== 1. Get live Daftar Upah data =====
    console.log("📊 Fetching LIVE Daftar Upah data...");
    const liveData = await dataExtractorService.extractPayrollData(
        month, year, testGang, testDiv, null, "SERVER_PROFILE_2", false, false
    );

    const liveRows = liveData.data_rows || [];
    let liveTotalUpahBersih = 0;
    let liveTotalTHR = 0;
    let liveTotalKontan = 0;
    let liveTotalPPH21 = 0;

    console.log(`\nLive employees (${liveRows.length}):\n`);
    console.log(`  ${'EMP_CODE'.padEnd(10)} | ${'NAME'.padEnd(25)} | ${'UPAH_BERSIH'.padStart(15)} | ${'THR'.padStart(12)} | ${'KONTAN'.padStart(12)} | ${'PPH21'.padStart(12)} | ${'KOREKSI'.padStart(12)}`);
    console.log(`  ${'-'.repeat(115)}`);
    
    let liveTotalKoreksi = 0;
    
    for (const emp of liveRows) {
        liveTotalUpahBersih += emp.upah_bersih || 0;
        const thr = emp.pendapatan_thr || 0;
        const kontan = emp.pendapatan_kontan || emp.pendapatan_kontanan || 0;
        const pph21 = emp.pot_pph21 || 0;
        const koreksi = emp.pot_koreksi || 0;
        
        liveTotalTHR += thr;
        liveTotalKontan += kontan;
        liveTotalPPH21 += pph21;
        liveTotalKoreksi += koreksi;

        console.log(`  ${emp.emp_code.padEnd(10)} | ${emp.nama.slice(0, 25).padEnd(25)} | ${(emp.upah_bersih || 0).toLocaleString('id-ID').padStart(15)} | ${thr.toLocaleString('id-ID').padStart(12)} | ${kontan.toLocaleString('id-ID').padStart(12)} | ${pph21.toLocaleString('id-ID').padStart(12)} | ${koreksi.toLocaleString('id-ID').padStart(12)}`);
    }
    
    console.log(`\nLive totals:`);
    console.log(`- Total Upah Bersih: ${liveTotalUpahBersih.toLocaleString('id-ID')}`);
    console.log(`- Total THR: ${liveTotalTHR.toLocaleString('id-ID')}`);
    console.log(`- Total Kontan: ${liveTotalKontan.toLocaleString('id-ID')}`);
    console.log(`- Total PPH21: ${liveTotalPPH21.toLocaleString('id-ID')}`);
    console.log(`- Total Koreksi: ${liveTotalKoreksi.toLocaleString('id-ID')}`);

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
