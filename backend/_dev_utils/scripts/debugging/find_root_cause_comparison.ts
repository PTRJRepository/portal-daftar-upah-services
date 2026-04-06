/**
 * FIND ROOT CAUSE: Why aggregation upah_bersih ≠ Daftar Upah upah_bersih
 * 
 * Compare EXACT calculation between:
 * 1. dataExtractorService.extractPayrollData() - feeds Daftar Upah UI
 * 2. payrollDataService.fetchRawTreeData() - feeds aggregation seeder
 * 
 * Goal: Find WHERE and WHY the numbers diverge
 */

import { dataExtractorService } from "../../../src/services/dataExtractorService";
import { PayrollDataService } from "../../../src/services/payrollDataService";

async function main() {
    const division = "ARB1";
    const month = 3;
    const year = 2026;
    
    console.log(`=== ROOT CAUSE ANALYSIS ===\n`);
    console.log(`Comparing: dataExtractorService vs payrollDataService\n`);
    
    // ===== METHOD 1: Via dataExtractorService (Daftar Upah UI source) =====
    console.log(`📊 METHOD 1: dataExtractorService.extractPayrollData`);
    const result1 = await dataExtractorService.extractPayrollData(
        month, year, "ALL", division, null, "SERVER_PROFILE_2", false, false, undefined, true
    );
    
    const rows1 = result1.data_rows || [];
    
    // Group by gang and sum
    const gangs1: Record<string, {count: number, upah_bersih: number}> = {};
    for (const row of rows1) {
        const gc = row.gang_code || 'UNKNOWN';
        if (!gangs1[gc]) gangs1[gc] = { count: 0, upah_bersih: 0 };
        gangs1[gc].count++;
        gangs1[gc].upah_bersih += row.upah_bersih || 0;
    }
    
    // ===== METHOD 2: Via payrollDataService (Aggregation Seeder source) =====
    console.log(`\n📊 METHOD 2: PayrollDataService.fetchRawTreeData`);
    const result2 = await (PayrollDataService as any).fetchRawTreeData(division, month, year, "dummy", false);
    
    const gangsMap2 = result2.data?.gangs || [];
    const gangs2: Record<string, {count: number, upah_bersih: number}> = {};
    for (const g of gangsMap2) {
        gangs2[g.gang_code] = {
            count: g.gang_totals?.employee_count || 0,
            upah_bersih: g.gang_totals?.upah_bersih || 0
        };
    }
    
    // ===== COMPARISON =====
    console.log(`\n=== GANG-BY-GANG COMPARISON ===\n`);
    console.log(`| Gang | Method1 Count | Method2 Count | Method1 Bersih | Method2 Bersih | Diff |`);
    console.log(`|------|--------------|---------------|----------------|----------------|------|`);
    
    const allGangs = new Set([...Object.keys(gangs1), ...Object.keys(gangs2)]);
    let totalDiff = 0;
    let matchCount = 0;
    let mismatchCount = 0;
    
    for (const gc of [...allGangs].sort()) {
        const m1 = gangs1[gc] || { count: 0, upah_bersih: 0 };
        const m2 = gangs2[gc] || { count: 0, upah_bersih: 0 };
        const diff = m1.upah_bersih - m2.upah_bersih;
        totalDiff += diff;
        
        const marker = Math.abs(diff) <= 1 ? '✅' : '❌';
        if (Math.abs(diff) <= 1) matchCount++; else mismatchCount++;
        
        console.log(`| ${gc} | ${m1.count} | ${m2.count} | ${m1.upah_bersih.toLocaleString('id-ID')} | ${m2.upah_bersih.toLocaleString('id-ID')} | ${diff.toLocaleString('id-ID')} | ${marker}`);
    }
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Matching gangs: ${matchCount}`);
    console.log(`Mismatching gangs: ${mismatchCount}`);
    console.log(`Total upah_bersih difference: ${totalDiff.toLocaleString('id-ID')}`);
    
    if (mismatchCount > 0) {
        console.log(`\n❌ ROOT CAUSE: payrollDataService calculates different values than dataExtractorService!`);
        console.log(`\nPossible causes:`);
        console.log(`  1. Different employee filtering (effective_hk vs hari_kerja)`);
        console.log(`  2. Different field names being read`);
        console.log(`  3. Missing dynamic premi/potongan summation`);
    } else {
        console.log(`\n✅ Both methods produce identical results!`);
    }
}

main().catch(console.error);
