/**
 * Diagnostic script: Compare tax totals when querying ALL gangs vs specific gang F1
 * Expected: total_pph21 for gang F1 alone = 10,544,345
 * Actual when all gangs: 10,669,988
 * 
 * This tests the getMonthlyTaxReport function with different gang filters
 * to find the discrepancy source.
 */

import { Config } from '../../src/config';

async function main() {
    // First, let's import the services we need
    const { DataExtractorService } = await import('../../src/services/dataExtractorService');
    
    const month = 3; // Adjust as needed
    const year = 2026;
    const division = 'P1A'; // Adjust - this is the division containing F1 gangs
    
    console.log('=== TAX GANG DISCREPANCY DIAGNOSTIC ===');
    console.log(`Period: ${month}/${year}, Division: ${division}`);
    console.log('');
    
    // Step 1: Fetch ALL data for the division
    console.log('--- STEP 1: Fetching ALL gangs for division ---');
    const allData = await DataExtractorService.getInstance().extractPayrollData(
        month, year, 'ALL', division, null, Config.DB_PROFILE, false, undefined, undefined, true, false
    );
    
    console.log(`Total rows (ALL): ${allData.data_rows.length}`);
    
    // Group by gang_code
    const gangMap = new Map<string, any[]>();
    for (const row of allData.data_rows) {
        const gc = (row.gang_code || '').trim();
        if (!gangMap.has(gc)) gangMap.set(gc, []);
        gangMap.get(gc)!.push(row);
    }
    
    console.log(`\nGangs found: ${Array.from(gangMap.keys()).sort().join(', ')}`);
    console.log(`\nPer-gang employee count:`);
    for (const [gc, rows] of Array.from(gangMap.entries()).sort()) {
        const activeRows = rows.filter(r => Number(r.jumlah_hk || r.hk || 0) > 0);
        const totalPph21 = activeRows.reduce((s, r) => s + (Number(r.pot_pph21) || Number(r.pph21_ter) || 0), 0);
        console.log(`  ${gc}: ${rows.length} total, ${activeRows.length} active, PPh21=${totalPph21.toLocaleString()}`);
    }
    
    // Step 2: Calculate total PPh21 for ALL active employees
    const allActive = allData.data_rows.filter((r: any) => Number(r.jumlah_hk || r.hk || 0) > 0);
    const totalPph21All = allActive.reduce((s: number, r: any) => s + (Number(r.pot_pph21) || Number(r.pph21_ter) || 0), 0);
    console.log(`\nTotal PPh21 (ALL gangs, active): ${totalPph21All.toLocaleString()}`);
    
    // Step 3: Filter to F1 gangs only (gang codes starting with 'F1' or exactly 'F1')
    const f1Gangs = Array.from(gangMap.keys()).filter(gc => gc.startsWith('F1') || gc === 'F1');
    console.log(`\nF1 gangs: ${f1Gangs.join(', ')}`);
    
    let totalPph21F1 = 0;
    for (const gc of f1Gangs) {
        const rows = gangMap.get(gc) || [];
        const activeRows = rows.filter(r => Number(r.jumlah_hk || r.hk || 0) > 0);
        totalPph21F1 += activeRows.reduce((s, r) => s + (Number(r.pot_pph21) || Number(r.pph21_ter) || 0), 0);
    }
    console.log(`Total PPh21 (F1 gangs only): ${totalPph21F1.toLocaleString()}`);
    console.log(`\nDiscrepancy: ${(totalPph21All - totalPph21F1).toLocaleString()}`);
    
    // Step 4: Now fetch specifically for gang "F1"
    console.log('\n--- STEP 4: Fetch specifically for gang=F1 ---');
    try {
        const f1Data = await DataExtractorService.getInstance().extractPayrollData(
            month, year, 'F1', division, null, Config.DB_PROFILE, false, undefined, undefined, true, false
        );
        console.log(`F1 specific fetch: ${f1Data.data_rows.length} rows`);
        
        const f1Active = f1Data.data_rows.filter((r: any) => Number(r.jumlah_hk || r.hk || 0) > 0);
        const pph21F1Specific = f1Active.reduce((s: number, r: any) => s + (Number(r.pot_pph21) || Number(r.pph21_ter) || 0), 0);
        console.log(`PPh21 (F1 specific): ${pph21F1Specific.toLocaleString()}`);
        
        // Show gang_codes in F1 specific fetch
        const f1SpecGangs = new Set(f1Data.data_rows.map((r: any) => (r.gang_code || '').trim()));
        console.log(`Gang codes in F1 specific: ${Array.from(f1SpecGangs).sort().join(', ')}`);
    } catch (e: any) {
        console.error(`Error fetching F1 specific: ${e.message}`);
    }
    
    // Step 5: Check for duplicate emp_codes across gangs
    console.log('\n--- STEP 5: Checking for duplicate emp_codes across gangs ---');
    const empCodeGangMap = new Map<string, string[]>();
    for (const row of allData.data_rows) {
        const ec = (row.emp_code || '').trim();
        const gc = (row.gang_code || '').trim();
        if (!empCodeGangMap.has(ec)) empCodeGangMap.set(ec, []);
        empCodeGangMap.get(ec)!.push(gc);
    }
    
    const duplicates = Array.from(empCodeGangMap.entries()).filter(([, gangs]) => gangs.length > 1);
    if (duplicates.length > 0) {
        console.log(`Found ${duplicates.length} employees appearing in multiple gangs:`);
        for (const [ec, gangs] of duplicates.slice(0, 20)) {
            const row = allData.data_rows.find((r: any) => (r.emp_code || '').trim() === ec);
            const pph21 = Number(row?.pot_pph21) || Number(row?.pph21_ter) || 0;
            console.log(`  ${ec}: gangs=[${gangs.join(', ')}], PPh21=${pph21}`);
        }
    } else {
        console.log('No duplicate emp_codes found across gangs.');
    }
    
    // Step 6: Check gangs that start with numbers (Group 1 = asistensi 1)
    console.log('\n--- STEP 6: Group 1 gangs (asistensi=1) ---');
    const group1Gangs = Array.from(gangMap.keys()).filter(gc => {
        // Extract the numeric part for asistensi grouping
        const match = gc.match(/^([A-Za-z]+)(\d+)/);
        if (match) {
            return match[2] === '1' || match[2].startsWith('1');
        }
        return gc.startsWith('1');
    });
    console.log(`Group 1 gangs: ${group1Gangs.sort().join(', ')}`);
    
    let totalPph21Group1 = 0;
    for (const gc of group1Gangs) {
        const rows = gangMap.get(gc) || [];
        const activeRows = rows.filter(r => Number(r.jumlah_hk || r.hk || 0) > 0);
        const gangPph21 = activeRows.reduce((s, r) => s + (Number(r.pot_pph21) || Number(r.pph21_ter) || 0), 0);
        totalPph21Group1 += gangPph21;
        console.log(`  ${gc}: ${activeRows.length} active, PPh21=${gangPph21.toLocaleString()}`);
    }
    console.log(`Total PPh21 (Group 1): ${totalPph21Group1.toLocaleString()}`);
    
    console.log('\n=== DIAGNOSTIC COMPLETE ===');
}

main().catch(console.error);
