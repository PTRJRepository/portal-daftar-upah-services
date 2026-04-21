/**
 * Test API call with PG2A + gang C1B (mimicking exact frontend behavior)
 */

import { taxReportService } from './backend/src/services/taxReportService';

async function testPG2AWithC1B() {
    console.log('='.repeat(80));
    console.log('TESTING PG2A + C1B - MARET 2026');
    console.log('='.repeat(80));

    // Test 1: PG2A only (no gang filter)
    console.log('\n[TEST 1] PG2A tanpa filter gang...');
    try {
        const result1 = await taxReportService.getMonthlyTaxReport(2026, 3, 'PG2A');
        console.log(`✅ Result: ${result1.employees.length} employees, data_source=${result1.data_source}`);
    } catch (error: any) {
        console.log(`❌ Error: ${error.message}`);
    }

    // Test 2: PG2A + gang C1B
    console.log('\n[TEST 2] PG2A + gang C1B...');
    try {
        const result2 = await taxReportService.getMonthlyTaxReport(2026, 3, 'PG2A', 'C1B');
        console.log(`✅ Result: ${result2.employees.length} employees, data_source=${result2.data_source}`);
        
        if (result2.employees.length > 0) {
            console.log(`   First employee: ${result2.employees[0].nama || result2.employees[0].emp_code}`);
            console.log(`   Total PPH21: ${result2.total_pph21}`);
        }
    } catch (error: any) {
        console.log(`❌ Error: ${error.message}`);
        console.error(error);
    }

    // Test 3: PG2A + gang ALL
    console.log('\n[TEST 3] PG2A + gang ALL...');
    try {
        const result3 = await taxReportService.getMonthlyTaxReport(2026, 3, 'PG2A', 'ALL');
        console.log(`✅ Result: ${result3.employees.length} employees, data_source=${result3.data_source}`);
    } catch (error: any) {
        console.log(`❌ Error: ${error.message}`);
    }

    console.log('\n' + '='.repeat(80));
}

testPG2AWithC1B()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
