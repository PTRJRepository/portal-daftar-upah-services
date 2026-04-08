/**
 * Diagnostic script: Compare tax totals when querying ALL gangs vs specific gang F1
 * Expected: total_pph21 for gang F1 alone = 10,544,345
 * Actual when all gangs: 10,669,988
 * 
 * This tests the getMonthlyTaxReport function with different gang filters
 * to find the discrepancy source.
 */

import { Config } from '../../src/config';
import * as fs from 'fs';
import * as path from 'path';

const logLines: string[] = [];
function log(msg: string) {
    logLines.push(msg);
    console.log(msg);
}

async function main() {
    const { DataExtractorService } = await import('../../src/services/dataExtractorService');
    
    const month = 3; // Adjust as needed
    const year = 2026;
    const division = 'P1A'; // Adjust - this is the division containing F1 gangs
    
    log('=== TAX GANG DISCREPANCY DIAGNOSTIC ===');
    log(`Period: ${month}/${year}, Division: ${division}`);
    log('');
    
    // Step 1: Fetch ALL data for the division
    log('--- STEP 1: Fetching ALL gangs for division ---');
    const allData = await DataExtractorService.getInstance().extractPayrollData(
        month, year, 'ALL', division, null, Config.DB_PROFILE, false, undefined, undefined, true, false
    );
    
    log(`Total rows (ALL): ${allData.data_rows.length}`);
    
    // Group by gang_code
    const gangMap = new Map<string, any[]>();
    for (const row of allData.data_rows) {
        const gc = (row.gang_code || '').trim();
        if (!gangMap.has(gc)) gangMap.set(gc, []);
        gangMap.get(gc)!.push(row);
    }
    
    log(`\nGangs found: ${Array.from(gangMap.keys()).sort().join(', ')}`);
    log(`\nPer-gang employee count and PPh21:`);
    
    let grandTotalPph21 = 0;
    for (const [gc, rows] of Array.from(gangMap.entries()).sort()) {
        const activeRows = rows.filter(r => Number(r.jumlah_hk || r.hk || 0) > 0);
        const totalPph21 = activeRows.reduce((s, r) => s + (Number(r.pot_pph21) || Number(r.pph21_ter) || 0), 0);
        grandTotalPph21 += totalPph21;
        log(`  ${gc}: ${rows.length} total, ${activeRows.length} active, PPh21=${totalPph21.toLocaleString()}`);
    }
    
    log(`\nGrand Total PPh21 (summing all gangs): ${grandTotalPph21.toLocaleString()}`);

    // Step 2: Calculate total PPh21 for ALL active employees
    const allActive = allData.data_rows.filter((r: any) => Number(r.jumlah_hk || r.hk || 0) > 0);
    const totalPph21All = allActive.reduce((s: number, r: any) => s + (Number(r.pot_pph21) || Number(r.pph21_ter) || 0), 0);
    log(`Total PPh21 (all active rows direct): ${totalPph21All.toLocaleString()}`);
    
    // Step 3: Filter to F1 gangs only
    const f1Gangs = Array.from(gangMap.keys()).filter(gc => gc.startsWith('F1'));
    log(`\n--- STEP 3: F1 gangs ---`);
    log(`F1 gangs found: ${f1Gangs.join(', ')}`);
    
    let totalPph21F1 = 0;
    for (const gc of f1Gangs) {
        const rows = gangMap.get(gc) || [];
        const activeRows = rows.filter(r => Number(r.jumlah_hk || r.hk || 0) > 0);
        const gangPph21 = activeRows.reduce((s, r) => s + (Number(r.pot_pph21) || Number(r.pph21_ter) || 0), 0);
        totalPph21F1 += gangPph21;
        log(`  ${gc}: ${activeRows.length} active, PPh21=${gangPph21.toLocaleString()}`);
    }
    log(`Total PPh21 (F1 gangs only): ${totalPph21F1.toLocaleString()}`);
    log(`Discrepancy (ALL - F1): ${(totalPph21All - totalPph21F1).toLocaleString()}`);
    
    // Step 4: Non-F1 gangs 
    log(`\n--- STEP 4: Non-F1 gangs in this division ---`);
    const nonF1Gangs = Array.from(gangMap.keys()).filter(gc => !gc.startsWith('F1'));
    for (const gc of nonF1Gangs.sort()) {
        const rows = gangMap.get(gc) || [];
        const activeRows = rows.filter(r => Number(r.jumlah_hk || r.hk || 0) > 0);
        const gangPph21 = activeRows.reduce((s, r) => s + (Number(r.pot_pph21) || Number(r.pph21_ter) || 0), 0);
        log(`  ${gc}: ${activeRows.length} active, PPh21=${gangPph21.toLocaleString()}`);
    }
    
    // Step 5: Check for duplicate emp_codes
    log('\n--- STEP 5: Checking for duplicate emp_codes ---');
    const empCodeGangMap = new Map<string, string[]>();
    for (const row of allData.data_rows) {
        const ec = (row.emp_code || '').trim();
        const gc = (row.gang_code || '').trim();
        if (!empCodeGangMap.has(ec)) empCodeGangMap.set(ec, []);
        empCodeGangMap.get(ec)!.push(gc);
    }
    
    const duplicates = Array.from(empCodeGangMap.entries()).filter(([, gangs]) => gangs.length > 1);
    if (duplicates.length > 0) {
        log(`Found ${duplicates.length} employees appearing in multiple gangs:`);
        for (const [ec, gangs] of duplicates.slice(0, 20)) {
            const matchRows = allData.data_rows.filter((r: any) => (r.emp_code || '').trim() === ec);
            const totalPph = matchRows.reduce((s: number, r: any) => s + (Number(r.pot_pph21) || Number(r.pph21_ter) || 0), 0);
            log(`  ${ec}: gangs=[${gangs.join(', ')}], Total PPh21=${totalPph}`);
        }
    } else {
        log('No duplicate emp_codes found across gangs.');
    }
    
    // Step 6: Now fetch specifically with gangCode=F1 (as the export would)
    log('\n--- STEP 6: Fetch specifically gangCode=F1 ---');
    try {
        const f1Data = await DataExtractorService.getInstance().extractPayrollData(
            month, year, 'F1', division, null, Config.DB_PROFILE, false, undefined, undefined, true, false
        );
        log(`F1 specific fetch: ${f1Data.data_rows.length} rows`);
        
        const f1Active = f1Data.data_rows.filter((r: any) => Number(r.jumlah_hk || r.hk || 0) > 0);
        const pph21F1Specific = f1Active.reduce((s: number, r: any) => s + (Number(r.pot_pph21) || Number(r.pph21_ter) || 0), 0);
        log(`PPh21 (F1 specific fetch): ${pph21F1Specific.toLocaleString()}`);
        
        const f1SpecGangs = new Set(f1Data.data_rows.map((r: any) => (r.gang_code || '').trim()));
        log(`Gang codes in F1 specific: ${Array.from(f1SpecGangs).sort().join(', ')}`);
    } catch (e: any) {
        log(`Error fetching F1 specific: ${e.message}`);
    }
    
    // Step 7: Check numbers against user values
    log('\n--- STEP 7: Compare with user's expected values ---');
    log(`User said ALL gangs export total: 10,669,988`);
    log(`User said F1 daftar upah shows:   10,544,345`);
    log(`Our ALL gangs total:               ${totalPph21All.toLocaleString()}`);
    log(`Our F1 gangs total:                ${totalPph21F1.toLocaleString()}`);
    
    log('\n=== DIAGNOSTIC COMPLETE ===');
    
    // Write results to file
    const outputPath = path.resolve(__dirname, 'tax_discrepancy_results.txt');
    fs.writeFileSync(outputPath, logLines.join('\n'), 'utf-8');
    log(`\nResults saved to: ${outputPath}`);
}

main().catch(e => {
    log(`FATAL ERROR: ${e.message}`);
    console.error(e);
});
