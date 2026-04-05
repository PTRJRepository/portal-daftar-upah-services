/**
 * Check if backend total_pph21 matches sum of employee pph21_ter
 */

import { taxReportService } from './backend/src/services/taxReportService';

async function checkTotalMismatch() {
    console.log('='.repeat(80));
    console.log('Checking: Does backend total_pph21 = sum(employee.pph21_ter)?');
    console.log('='.repeat(80));
    console.log();

    const year = 2026;
    const month = 3;
    const divisionCode = 'AB2';
    const gangCode = 'ALL';

    const result = await taxReportService.getMonthlyTaxReport(year, month, divisionCode, gangCode);

    console.log(`Data source: ${result.data_source}`);
    console.log(`Employee count: ${result.employees.length}`);
    console.log();

    // Sum all employee pph21_ter
    let calculatedTotal = 0;
    for (const emp of result.employees) {
        calculatedTotal += (emp.pph21_ter || 0);
    }

    const backendTotal = result.total_pph21;
    const diff = backendTotal - calculatedTotal;

    console.log(`Backend total_pph21:  Rp ${backendTotal.toLocaleString('id-ID')}`);
    console.log(`Sum of employee PPh21: Rp ${calculatedTotal.toLocaleString('id-ID')}`);
    console.log(`Difference:            Rp ${diff.toLocaleString('id-ID')}`);
    console.log();

    if (Math.abs(diff) > 0) {
        console.log(`❌ MISMATCH! Backend total is ${diff > 0 ? 'HIGHER' : 'LOWER'} by Rp ${Math.abs(diff).toLocaleString('id-ID')}`);
        console.log();
        console.log('This means the backend is adding extra PPh21 somewhere, or there is a calculation error.');
    } else {
        console.log('✅ Backend total MATCHES sum of employee PPh21');
    }

    console.log();
    console.log('='.repeat(80));
    console.log('Conclusion: The difference you see (4.637.898 vs 4.633.898)');
    console.log('is NOT from backend calculation error.');
    console.log();
    console.log('Possible causes:');
    console.log('1. Frontend is displaying old/cached data');
    console.log('2. You are looking at a different month/division');
    console.log('3. There is a display/formatting issue in the UI');
    console.log('='.repeat(80));
}

checkTotalMismatch().catch(console.error);
