import { dataExtractorService } from "../../../src/services/dataExtractorService";
import { Database } from "../../../src/db/client";

async function main() {
    const month = 3;
    const year = 2026;
    const testGang = "A1H";
    const testDiv = "P1A";

    console.log(`=== DETAILED COMPARISON: Live vs Aggregation ===\n`);

    // ===== 1. Get LIVE employee data =====
    console.log("📊 Fetching LIVE employee data...");
    const liveData = await dataExtractorService.extractPayrollData(
        month, year, testGang, testDiv, null, "SERVER_PROFILE_2", false, false
    );

    const liveRows = liveData.data_rows || [];
    let liveTotalKotor = 0;
    let liveTotalPotongan = 0;
    let liveTotalUpahBersih = 0;

    console.log(`\nLive employees (${liveRows.length}):\n`);
    for (const emp of liveRows) {
        const kotor = emp.jumlah_upah_kotor || 0;
        const potongan = emp.total_potongan || 0;
        const bersih = emp.upah_bersih || 0;
        if (liveRows.indexOf(emp) < 5) {
            console.log(`${emp.emp_code}: kotor=${kotor.toLocaleString('id-ID')} | potongan=${potongan.toLocaleString('id-ID')} | bersih=${bersih.toLocaleString('id-ID')}`);
        }
        liveTotalKotor += kotor;
        liveTotalPotongan += potongan;
        liveTotalUpahBersih += bersih;
    }

    console.log(`\nLIVE TOTALS:`);
    console.log(`  upah_kotor: ${liveTotalKotor.toLocaleString('id-ID')}`);
    console.log(`  potongan: ${liveTotalPotongan.toLocaleString('id-ID')}`);
    console.log(`  upah_bersih: ${liveTotalUpahBersih.toLocaleString('id-ID')}`);
    console.log(`  verify (kotor - potongan): ${(liveTotalKotor - liveTotalPotongan).toLocaleString('id-ID')}`);

    // ===== 2. Get aggregation history =====
    console.log(`\n📊 Fetching AGGREGATION HISTORY...`);
    const extDb = Database.getExtendedInstance();

    const histRows = await extDb.query<any>(`
        SELECT total_upah_kotor, total_potongan, total_upah_bersih, total_employees
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ? AND gang_code = ?
        ORDER BY id DESC
    `, [month, year, testGang]);

    if (histRows.length > 0) {
        const hist = histRows[0];
        console.log(`\nAGGREGATION TOTALS:`);
        console.log(`  upah_kotor: ${(hist.total_upah_kotor || 0).toLocaleString('id-ID')}`);
        console.log(`  potongan: ${(hist.total_potongan || 0).toLocaleString('id-ID')}`);
        console.log(`  upah_bersih: ${(hist.total_upah_bersih || 0).toLocaleString('id-ID')}`);
        console.log(`  employees: ${hist.total_employees}`);
        
        console.log(`\n=== DIFFERENCES ===`);
        console.log(`upah_kotor diff: ${(liveTotalKotor - (hist.total_upah_kotor || 0)).toLocaleString('id-ID')}`);
        console.log(`potongan diff: ${(liveTotalPotongan - (hist.total_potongan || 0)).toLocaleString('id-ID')}`);
        console.log(`upah_bersih diff: ${(liveTotalUpahBersih - (hist.total_upah_bersih || 0)).toLocaleString('id-ID')}`);
    }
}

main().catch(console.error);
