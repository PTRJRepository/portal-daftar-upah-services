/**
 * ROOT CAUSE ANALYSIS
 * Compare EXACT same data source between:
 * 1. Daftar Upah UI (live) - via payroll.ts endpoint
 * 2. Aggregation Seeder - via payrollDataService
 * 
 * Goal: Find EXACTLY where upah_bersih diverges
 */

import { dataExtractorService } from "../../../src/services/dataExtractorService";
import { Database } from "../../../src/db/client";

async function main() {
    const gangCode = "G1H"; // HARVESTING TIMUR - contoh yang salah
    const division = "ARB1";
    const month = 3;
    const year = 2026;
    
    console.log(`=== ROOT CAUSE ANALYSIS ===\n`);
    console.log(`Comparing data source for ${gangCode} (${division})`);
    console.log(`Expected upah_bersih: 176.414.884 (from user)\n`);
    
    // ===== SOURCE 1: Live Daftar Upah =====
    console.log(`📊 SOURCE 1: Live Daftar Upah (dataExtractorService.extractPayrollData)`);
    
    const liveResult = await dataExtractorService.extractPayrollData(
        month, year, gangCode, division, null, "SERVER_PROFILE_2", 
        false,  // includeVirtual
        false,  // useHistoryDb
        undefined, // gangPrefix
        true    // skipHarvest (same as seeder)
    );
    
    const liveRows = liveResult.data_rows || [];
    console.log(`  Employees returned: ${liveRows.length}\n`);
    
    let liveTotalKotor = 0;
    let liveTotalPotongan = 0;
    let liveTotalBersih = 0;
    let liveActiveCount = 0;
    
    for (const emp of liveRows.slice(0, 5)) {
        console.log(`  ${emp.emp_code}: hk=${emp.jumlah_hk} | cuti_minggu=${emp.cuti_minggu} | cuti_nasional=${emp.cuti_nasional} | cuti_tahunan=${emp.cuti_tahunan} | cuti_sakit=${emp.cuti_sakit_haid}`);
        console.log(`    kotor=${(emp.jumlah_upah_kotor || 0).toLocaleString('id-ID')} | potongan=${(emp.total_potongan || 0).toLocaleString('id-ID')} | bersih=${(emp.upah_bersih || 0).toLocaleString('id-ID')}`);
        liveTotalKotor += emp.jumlah_upah_kotor || 0;
        liveTotalPotongan += emp.total_potongan || 0;
        liveTotalBersih += emp.upah_bersih || 0;
        liveActiveCount++;
    }
    
    // Get totals from ALL rows
    for (const emp of liveRows) {
        liveTotalKotor += emp.jumlah_upah_kotor || 0;
        liveTotalPotongan += emp.total_potongan || 0;
        liveTotalBersih += emp.upah_bersih || 0;
    }
    // Subtract first 5 (already counted)
    for (const emp of liveRows.slice(0, 5)) {
        liveTotalKotor -= emp.jumlah_upah_kotor || 0;
        liveTotalPotongan -= emp.total_potongan || 0;
        liveTotalBersih -= emp.upah_bersih || 0;
    }
    
    console.log(`\n  LIVE TOTALS (${liveRows.length} employees, ${liveActiveCount} shown):`);
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
    
    if (histRows.length > 0) {
        const hist = histRows[0];
        
        console.log(`| Metric | Live Daftar Upah | Aggregation History | Difference |`);
        console.log(`|--------|-------------------|---------------------|------------|`);
        console.log(`| employees | ${liveRows.length} | ${hist.total_employees} | ${liveRows.length - hist.total_employees} |`);
        console.log(`| upah_kotor | ${liveTotalKotor.toLocaleString('id-ID')} | ${(hist.total_upah_kotor || 0).toLocaleString('id-ID')} | ${(liveTotalKotor - (hist.total_upah_kotor || 0)).toLocaleString('id-ID')} |`);
        console.log(`| potongan | ${liveTotalPotongan.toLocaleString('id-ID')} | ${(hist.total_potongan || 0).toLocaleString('id-ID')} | ${(liveTotalPotongan - (hist.total_potongan || 0)).toLocaleString('id-ID')} |`);
        console.log(`| upah_bersih | ${liveTotalBersih.toLocaleString('id-ID')} | ${(hist.total_upah_bersih || 0).toLocaleString('id-ID')} | ${(liveTotalBersih - (hist.total_upah_bersih || 0)).toLocaleString('id-ID')} |`);
        
        console.log(`\n=== ROOT CAUSE ===`);
        
        const empDiff = liveRows.length - hist.total_employees;
        if (empDiff !== 0) {
            console.log(`❌ DIFFERENT EMPLOYEE COUNT: Live has ${liveRows.length}, History has ${hist.total_employees}`);
            console.log(`   → Aggregation seeder filtered ${Math.abs(empDiff)} employees differently!`);
        } else {
            console.log(`✅ Employee count matches: ${liveRows.length}`);
        }
        
        const kotorDiff = Math.abs(liveTotalKotor - (hist.total_upah_kotor || 0));
        const potonganDiff = Math.abs(liveTotalPotongan - (hist.total_potongan || 0));
        
        if (kotorDiff > 1 || potonganDiff > 1) {
            console.log(`❌ DIFFERENT VALUES despite same employee count`);
            console.log(`   → upah_kotor diff: ${kotorDiff.toLocaleString('id-ID')}`);
            console.log(`   → potongan diff: ${potonganDiff.toLocaleString('id-ID')}`);
            console.log(`   → Possible cause: Different calculation formula or missing data fields`);
        } else {
            console.log(`✅ Values match!`);
        }
    }
}

main().catch(console.error);
