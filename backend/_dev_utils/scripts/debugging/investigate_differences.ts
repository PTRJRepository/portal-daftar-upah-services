import { dataExtractorService } from "../../../src/services/dataExtractorService";
import { Database } from "../../../src/db/client";

async function main() {
    const month = 3;
    const year = 2026;
    const testGang = "A1H";
    const testDiv = "P1A";

    console.log(`=== DETAILED INVESTIGATION: ${testGang} ===\n`);

    // 1. Get live data
    const liveData = await dataExtractorService.extractPayrollData(
        month, year, testGang, testDiv, null, "SERVER_PROFILE_2", false, false
    );

    const liveRows = liveData.data_rows || [];
    console.log(`Live employees: ${liveRows.length}\n`);

    // ===== INVESTIGATE KOREKSI =====
    console.log("=== KOREKSI ANALYSIS ===");
    let totalKoreksiLive = 0;
    const koreksiEmployees: any[] = [];

    for (const emp of liveRows) {
        const koreksi = emp.pot_koreksi || 0;
        const allKoreksi: Record<string, number> = {};

        // Check all KOREKSI fields
        for (const [key, val] of Object.entries(emp)) {
            if (key.toUpperCase().startsWith('KOREKSI') && typeof val === 'number' && val !== 0) {
                allKoreksi[key] = val;
            }
        }

        if (koreksi > 0 || Object.keys(allKoreksi).length > 0) {
            totalKoreksiLive += koreksi;
            koreksiEmployees.push({
                emp_code: emp.emp_code,
                emp_name: emp.emp_name || emp.nama,
                pot_koreksi: koreksi,
                details: allKoreksi
            });
        }
    }

    console.log(`Employees with Koreksi: ${koreksiEmployees.length}`);
    console.log(`Total Koreksi (live): ${totalKoreksiLive.toLocaleString('id-ID')}`);
    console.log("\nBreakdown:");
    for (const emp of koreksiEmployees.slice(0, 10)) {
        console.log(`  ${emp.emp_code} (${emp.emp_name}): pot_koreksi=${emp.pot_koreksi.toLocaleString('id-ID')}`);
        for (const [key, val] of Object.entries(emp.details)) {
            console.log(`    ${key}: ${val.toLocaleString('id-ID')}`);
        }
    }

    // Check history detail for koreksi
    const extDb = Database.getExtendedInstance();
    const histDetails = await extDb.query<any>(`
        SELECT emp_code, pot_koreksi, potongan_detail 
        FROM dbo.payroll_history_detail
        WHERE master_id IN (
            SELECT id FROM dbo.payroll_history_master
            WHERE period_month = ? AND period_year = ? AND gang_code = ?
        )
        AND (pot_koreksi IS NOT NULL AND pot_koreksi != 0)
    `, [month, year, testGang]);

    console.log(`\nHistory employees with pot_koreksi > 0: ${histDetails.length}`);
    let totalKoreksiHist = 0;
    for (const d of histDetails.slice(0, 10)) {
        totalKoreksiHist += d.pot_koreksi || 0;
        console.log(`  ${d.emp_code}: pot_koreksi=${(d.pot_koreksi || 0).toLocaleString('id-ID')}`);
        if (d.potongan_detail) {
            console.log(`    potongan_detail: ${d.potongan_detail}`);
        }
    }
    console.log(`Total Koreksi (history sample): ${totalKoreksiHist.toLocaleString('id-ID')}`);

    // ===== INVESTIGATE PREMI =====
    console.log("\n=== PREMI ANALYSIS ===");
    let totalPremiLive = 0;
    let totalPremiBrondol = 0;
    let totalPremiPruning = 0;

    for (const emp of liveRows) {
        totalPremiLive += emp.total_premi || 0;
        totalPremiBrondol += emp.premi_brondol || 0;
        totalPremiPruning += emp.premi_pruning || 0;
    }

    console.log(`Total Premi (live): ${totalPremiLive.toLocaleString('id-ID')}`);
    console.log(`  - Brondol: ${totalPremiBrondol.toLocaleString('id-ID')}`);
    console.log(`  - Pruning: ${totalPremiPruning.toLocaleString('id-ID')}`);

    // Check what's in dynamic premi
    const premiBreakdown: Record<string, number> = {};
    for (const emp of liveRows) {
        if (emp.premi && typeof emp.premi === 'object') {
            for (const [key, val] of Object.entries(emp.premi)) {
                if (typeof val === 'number') {
                    premiBreakdown[key] = (premiBreakdown[key] || 0) + val;
                }
            }
        }
    }

    console.log(`\nDynamic Premi Breakdown:`);
    for (const [key, val] of Object.entries(premiBreakdown).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${key}: ${val.toLocaleString('id-ID')}`);
    }

    // Check history detail for premi (correct column names)
    const histPremiDetails = await extDb.query<any>(`
        SELECT emp_code, premi_brondol, premi_dynamic_1, premi_dynamic_2, premi_dynamic_3, 
               premi_dynamic_4, premi_dynamic_5, premi_dynamic_6, premi_dynamic_7, premi_detail
        FROM dbo.payroll_history_detail
        WHERE master_id IN (
            SELECT id FROM dbo.payroll_history_master
            WHERE period_month = ? AND period_year = ? AND gang_code = ?
        )
    `, [month, year, testGang]);

    let histBrondol = 0;
    let histDynamicTotal = 0;
    for (const d of histPremiDetails) {
        histBrondol += d.premi_brondol || 0;
        histDynamicTotal += (d.premi_dynamic_1 || 0) + (d.premi_dynamic_2 || 0) + 
                           (d.premi_dynamic_3 || 0) + (d.premi_dynamic_4 || 0) +
                           (d.premi_dynamic_5 || 0) + (d.premi_dynamic_6 || 0) +
                           (d.premi_dynamic_7 || 0);
    }

    console.log(`\nHistory Premi:`);
    console.log(`  - Brondol: ${histBrondol.toLocaleString('id-ID')}`);
    console.log(`  - Dynamic Premi: ${histDynamicTotal.toLocaleString('id-ID')}`);
    console.log(`  - History records: ${histPremiDetails.length}`);

    // Sample premi_detail
    const withPremiDetail = histPremiDetails.filter(d => d.premi_detail);
    console.log(`\nEmployees with premi_detail: ${withPremiDetail.length}`);
    if (withPremiDetail.length > 0) {
        console.log(`  Sample: ${withPremiDetail[0].premi_detail}`);
    }

    // ===== INVESTIGATE PPH21 =====
    console.log("\n=== PPH21 ANALYSIS ===");
    let totalPph21Live = 0;
    let totalPph21TerLive = 0;
    const pph21Diffs: any[] = [];

    for (const emp of liveRows) {
        const pph21 = emp.pot_pph21 || 0;
        const pph21Ter = emp.pph21_ter || 0;
        totalPph21Live += pph21;
        totalPph21TerLive += pph21Ter;

        if (Math.abs(pph21 - pph21Ter) > 1) {
            pph21Diffs.push({
                emp_code: emp.emp_code,
                emp_name: emp.emp_name || emp.nama,
                pot_pph21: pph21,
                pph21_ter: pph21Ter,
                diff: pph21 - pph21Ter
            });
        }
    }

    console.log(`Total pot_pph21 (live): ${totalPph21Live.toLocaleString('id-ID')}`);
    console.log(`Total pph21_ter (live): ${totalPph21TerLive.toLocaleString('id-ID')}`);
    console.log(`Employees with pot_pph21 != pph21_ter: ${pph21Diffs.length}`);

    if (pph21Diffs.length > 0) {
        console.log("\nDifferences:");
        for (const d of pph21Diffs.slice(0, 10)) {
            console.log(`  ${d.emp_code}: pot_pph21=${d.pot_pph21.toLocaleString('id-ID')}, pph21_ter=${d.pph21_ter.toLocaleString('id-ID')}, diff=${d.diff.toLocaleString('id-ID')}`);
        }
    }

    // Check history detail
    const histPph21Details = await extDb.query<any>(`
        SELECT emp_code, pot_pph21, pph21_ter
        FROM dbo.payroll_history_detail
        WHERE master_id IN (
            SELECT id FROM dbo.payroll_history_master
            WHERE period_month = ? AND period_year = ? AND gang_code = ?
        )
    `, [month, year, testGang]);

    let histPph21 = 0;
    let histPph21Ter = 0;
    for (const d of histPph21Details) {
        histPph21 += d.pot_pph21 || 0;
        histPph21Ter += d.pph21_ter || 0;
    }

    console.log(`\nHistory PPh21:`);
    console.log(`  - pot_pph21: ${histPph21.toLocaleString('id-ID')}`);
    console.log(`  - pph21_ter: ${histPph21Ter.toLocaleString('id-ID')}`);
    console.log(`  - History records: ${histPph21Details.length}`);
}

main().catch(console.error);
