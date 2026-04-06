/**
 * Check why PG2A Maret 2026 tax report isn't showing data
 */

import { taxReportService } from './backend/src/services/taxReportService';
import { historyDatabaseService } from './backend/src/services/historyDatabaseService';
import { DataExtractorService } from './backend/src/services/dataExtractorService';
import { divisionDefinition } from './backend/src/services/divisionDefinition';

async function checkPG2AMaret2026() {
    console.log('='.repeat(80));
    console.log('CHECKING PG2A - MARET 2026 (3/2026)');
    console.log('='.repeat(80));

    // Step 1: Check if PG2A is a virtual division
    console.log('\n[STEP 1] Division alias check...');
    console.log(`PG2A is virtual division: ${divisionDefinition.isVirtualDivision('PG2A')}`);
    
    if (divisionDefinition.isVirtualDivision('PG2A')) {
        const sourceDivs = await divisionDefinition.getSourceDivisionsForAggregation('PG2A');
        console.log(`PG2A resolves to source divisions: ${sourceDivs.join(', ')}`);
    }

    // Step 2: Check LIVE data for PG2A
    console.log('\n[STEP 2] Checking LIVE data for PG2A...');
    try {
        const liveData = await DataExtractorService.getInstance().extractPayrollData(
            3, 2026, 'ALL', 'PG2A', null, undefined, false, undefined, undefined, true, true
        );

        if (liveData && liveData.data_rows.length > 0) {
            console.log(`✅ LIVE data found: ${liveData.data_rows.length} rows`);
        } else {
            console.log('❌ No LIVE data found');
        }
    } catch (error: any) {
        console.log(`❌ LIVE data error: ${error.message}`);
    }

    // Step 3: Check HISTORY data for PG2A
    console.log('\n[STEP 3] Checking HISTORY data for PG2A...');
    try {
        const historyData = await historyDatabaseService.getHistoricalPayrollDataAsExtractorFormat(
            3, 2026, 'ALL', 'PG2A'
        );

        if (historyData && historyData.data_rows.length > 0) {
            console.log(`✅ HISTORY data found: ${historyData.data_rows.length} rows`);
        } else {
            console.log('❌ No HISTORY data found for PG2A');
            
            // Try with P2A (source division)
            console.log('\n   Trying with P2A (source division)...');
            const historyDataP2A = await historyDatabaseService.getHistoricalPayrollDataAsExtractorFormat(
                3, 2026, 'ALL', 'P2A'
            );
            
            if (historyDataP2A && historyDataP2A.data_rows.length > 0) {
                console.log(`✅ HISTORY data found for P2A: ${historyDataP2A.data_rows.length} rows`);
                console.log('   → This means PG2A needs to query using P2A!');
            } else {
                console.log('❌ No HISTORY data found for P2A either');
            }
        }
    } catch (error: any) {
        console.log(`❌ HISTORY data error: ${error.message}`);
    }

    // Step 4: Call the actual tax report service
    console.log('\n[STEP 4] Calling Tax Report Service for PG2A...');
    try {
        const result = await taxReportService.getMonthlyTaxReport(2026, 3, 'PG2A');
        
        console.log(`\nResult:`);
        console.log(`  Data Source: ${result.data_source}`);
        console.log(`  Total Employees: ${result.employees.length}`);
        console.log(`  Total PPH21: ${result.total_pph21}`);
        
        if (result.employees.length > 0) {
            console.log(`\n  First 3 employees:`);
            result.employees.slice(0, 3).forEach((emp, idx) => {
                console.log(`    ${idx + 1}. ${emp.nama || emp.emp_code} - PPH21: ${emp.pph21_bulanan || 0}`);
            });
        }
    } catch (error: any) {
        console.log(`❌ Tax report error: ${error.message}`);
        console.error(error);
    }

    console.log('\n' + '='.repeat(80));
}

checkPG2AMaret2026()
    .then(() => {
        console.log('\n✅ Check complete');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    });
