import { dataExtractorService } from "../../../src/services/dataExtractorService";
import { Database } from "../../../src/db/client";

async function main() {
    const month = 3;
    const year = 2026;
    const testGang = "A1H";
    const testDiv = "P1A";

    console.log(`=== COMPARING total_premi: Live vs History ===\n`);

    // ===== 1. Get live data =====
    console.log("📊 Fetching LIVE data (Daftar Upah)...");
    const liveData = await dataExtractorService.extractPayrollData(
        month, year, testGang, testDiv, null, "SERVER_PROFILE_2", false, false
    );

    const liveRows = liveData.data_rows || [];
    let liveTotalPremi = 0;
    let liveTotalBrondol = 0;
    let livePremiBreakdown: Record<string, number> = {};

    for (const emp of liveRows) {
        liveTotalPremi += emp.total_premi || 0;
        liveTotalBrondol += emp.premi_brondol || 0;

        if (emp.premi && typeof emp.premi === 'object') {
            for (const [key, val] of Object.entries(emp.premi)) {
                if (typeof val === 'number' && val > 0) {
                    livePremiBreakdown[key] = (livePremiBreakdown[key] || 0) + val;
                }
            }
        }
    }

    console.log(`Live employees: ${liveRows.length}`);
    console.log(`Live total_premi: ${liveTotalPremi.toLocaleString('id-ID')}`);
    console.log(`Live premi_brondol: ${liveTotalBrondol.toLocaleString('id-ID')}`);
    console.log(`\nLive premi breakdown:`);
    for (const [key, val] of Object.entries(livePremiBreakdown).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${key}: ${val.toLocaleString('id-ID')}`);
    }

    // ===== 2. Get aggregation history =====
    console.log(`\n📊 Fetching AGGREGATION HISTORY...`);
    const extDb = Database.getExtendedInstance();

    const histRows = await extDb.query<any>(`
        SELECT * FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ? AND gang_code = ?
        ORDER BY id DESC
    `, [month, year, testGang]);

    console.log(`History records: ${histRows.length}`);

    if (histRows.length > 0) {
        const hist = histRows[0];
        console.log(`\nHistory total_premi: ${(hist.total_premi || 0).toLocaleString('id-ID')}`);
        console.log(`History total_premi_brondol: ${(hist.total_premi_brondol || 0).toLocaleString('id-ID')}`);
        console.log(`History total_premi_prunning: ${(hist.total_premi_prunning || 0).toLocaleString('id-ID')}`);
        console.log(`History total_premi_insentif: ${(hist.total_premi_insentif || 0).toLocaleString('id-ID')}`);
        console.log(`History total_premi_kinerja: ${(hist.total_premi_kinerja || 0).toLocaleString('id-ID')}`);

        console.log(`\n=== DIFFERENCE ===`);
        const diff = liveTotalPremi - (hist.total_premi || 0);
        console.log(`Live total_premi: ${liveTotalPremi.toLocaleString('id-ID')}`);
        console.log(`History total_premi: ${(hist.total_premi || 0).toLocaleString('id-ID')}`);
        console.log(`Difference: ${diff > 0 ? '+' : ''}${diff.toLocaleString('id-ID')}`);

        if (Math.abs(diff) > 1) {
            console.log(`\n⚠️ MISMATCH! Total premi berbeda!`);
        } else {
            console.log(`\n✅ Match! (within 1 rounding)`);
        }

        // Check dynamic premi data
        if (hist.dynamic_premi_data) {
            console.log(`\nHistory dynamic_premi_data:`);
            try {
                const dynamicPremi = JSON.parse(hist.dynamic_premi_data);
                if (Array.isArray(dynamicPremi)) {
                    dynamicPremi.forEach((item: any) => {
                        console.log(`  ${item.header}: ${(item.total || 0).toLocaleString('id-ID')}`);
                    });
                }
            } catch (e) {
                console.log(`  (parse error)`);
            }
        }
    } else {
        console.log(`⚠️ No history found for ${testGang}`);
    }
}

main().catch(console.error);
