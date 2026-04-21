/**
 * Debug script to compare Tax Report data with Daftar Upah data
 * Run: cd backend && bun run src/scripts/debug_tax_export_consistency.ts
 */

import { DataExtractorService } from '../services/dataExtractorService';
import { taxReportService } from '../services/taxReportService';

const MONTH = 3;
const YEAR = 2026;
const DIVISION = 'AB1';
const GANG = 'ALL';

async function main() {
    console.log('='.repeat(80));
    console.log('[DEBUG] Comparing Tax Report with Daftar Upah data');
    console.log(`Period: ${MONTH}/${YEAR}, Division: ${DIVISION}, Gang: ${GANG}`);
    console.log('='.repeat(80));

    // Get Daftar Upah data (UI source)
    console.log('\n[1] Fetching Daftar Upah data (UI source)...');
    const extractor = DataExtractorService.getInstance();
    const daftarUpahData = await extractor.extractPayrollData(
        MONTH, YEAR, GANG, DIVISION, null, undefined, false, undefined, undefined, true, true
    );
    console.log(`    Found ${daftarUpahData.data_rows.length} employees in Daftar Upah`);

    // Get Tax Report data
    console.log('\n[2] Fetching Tax Report data...');
    const taxData = await taxReportService.getMonthlyTaxReport(YEAR, MONTH, DIVISION, GANG, undefined, false);
    console.log(`    Found ${taxData.employees.length} employees in Tax Report`);

    // Compare
    console.log('\n[3] Comparing data...');
    
    // Compare employee count
    console.log(`\n    Employee count: Daftar Upah=${daftarUpahData.data_rows.length}, Tax=${taxData.employees.length}`);
    
    // Compare first 5 employees
    console.log('\n    First 5 employees comparison:');
    console.log('    -------------------------------------------------------------------------------------------');
    console.log('    # | Daftar Upah                    | Tax Report                      | Match?');
    console.log('    -------------------------------------------------------------------------------------------');
    
    let matchCount = 0;
    for (let i = 0; i < Math.min(5, daftarUpahData.data_rows.length); i++) {
        const du = daftarUpahData.data_rows[i];
        const tax = taxData.employees[i];
        
        const duName = du.nama || du.emp_name || 'N/A';
        const taxName = tax?.emp_name || 'N/A';
        const match = duName === taxName ? '✓' : '✗';
        
        if (duName === taxName) matchCount++;
        
        console.log(`    ${i+1} | ${duName.substring(0, 28).padEnd(28)} | ${taxName.substring(0, 28).padEnd(28)} | ${match}`);
    }
    console.log('    -------------------------------------------------------------------------------------------');

    // Compare PPh21 values for first 5 employees
    console.log('\n    PPh21 TER comparison (first 5):');
    console.log('    -------------------------------------------------------------------------------------------');
    console.log('    # | Daftar Upah PPh21 | Tax Report PPh21 | Match?');
    console.log('    -------------------------------------------------------------------------------------------');
    
    for (let i = 0; i < Math.min(5, daftarUpahData.data_rows.length); i++) {
        const du = daftarUpahData.data_rows[i];
        const tax = taxData.employees[i];
        
        const duPph = du.pph21_ter ?? 0;
        const taxPph = tax?.pph21_ter ?? 0;
        const match = duPph === taxPph ? '✓' : '✗';
        
        console.log(`    ${i+1} | ${String(duPph).padEnd(16)} | ${String(taxPph).padEnd(16)} | ${match}`);
    }
    console.log('    -------------------------------------------------------------------------------------------');

    // Compare all employees
    console.log('\n    Full comparison:');
    const allMatch = [];
    const mismatchDetails = [];
    
    for (let i = 0; i < daftarUpahData.data_rows.length; i++) {
        const du = daftarUpahData.data_rows[i];
        const tax = taxData.employees[i];
        
        const nameMatch = (du.nama || du.emp_name) === (tax?.emp_name);
        const pphMatch = (du.pph21_ter ?? 0) === (tax?.pph21_ter ?? 0);
        
        allMatch.push(nameMatch && pphMatch);
        
        if (!nameMatch || !pphMatch) {
            mismatchDetails.push({
                index: i,
                du_name: du.nama || du.emp_name,
                tax_name: tax?.emp_name,
                du_pph21: du.pph21_ter,
                tax_pph21: tax?.pph21_ter,
                name_match: nameMatch,
                pph_match: pphMatch
            });
        }
    }

    const totalMatch = allMatch.filter(x => x).length;
    const totalMismatch = mismatchDetails.length;
    
    console.log(`    Total employees: ${allMatch.length}`);
    console.log(`    Matches: ${totalMatch}`);
    console.log(`    Mismatches: ${totalMismatch}`);
    
    if (totalMismatch > 0) {
        console.log(`\n    Mismatch details (first 10):`);
        mismatchDetails.slice(0, 10).forEach(m => {
            console.log(`      [${m.index}] ${m.du_name} vs ${m.tax_name}`);
            console.log(`                PPh21: ${m.du_pph21} vs ${m.tax_pph21}`);
        });
    }

    console.log('\n' + '='.repeat(80));
    console.log('[DEBUG] Comparison complete');
    console.log('='.repeat(80));
}

main().catch(console.error);