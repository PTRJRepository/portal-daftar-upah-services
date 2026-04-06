/**
 * Debug script to check employee hari_kerja values
 */

import { Database } from './src/db/client';

async function checkEmployeeAttendance() {
    console.log('🔍 Checking employee attendance for AB1, G1H, March 2026...\n');

    try {
        const { dataExtractorService } = await import('./src/services/dataExtractorService');

        const result = await dataExtractorService.extractPayrollData(
            3, 2026, 'G1H', 'AB1', null, 'SERVER_PROFILE_2', false, null, null, true
        );

        console.log(`Total employees: ${result.data_rows.length}\n`);

        // Check hari_kerja distribution
        let zeroHk = 0;
        let positiveHk = 0;
        let totalHk = 0;

        result.data_rows.forEach((emp: any) => {
            const hk = Number(emp.hari_kerja || emp.kehadiran || 0);
            totalHk += hk;
            if (hk === 0) {
                zeroHk++;
                console.log(`⚠️  ZERO HK: ${emp.nama} (NIK: ${emp.nik})`);
                console.log(`    jumlah_hk: ${emp.jumlah_hk}`);
                console.log(`    cuti_tahunan: ${emp.cuti_tahunan || 0}`);
                console.log(`    cuti_sakit_haid: ${emp.cuti_sakit_haid || 0}`);
                console.log(`    cuti_minggu: ${emp.cuti_minggu || 0}`);
                console.log(`    cuti_nasional: ${emp.cuti_nasional || 0}`);
                console.log(`    upah_bersih: ${emp.upah_bersih?.toLocaleString('id-ID')}`);
                console.log('');
            } else {
                positiveHk++;
            }
        });

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`✅ Employees with hari_kerja > 0: ${positiveHk}`);
        console.log(`⚠️  Employees with hari_kerja = 0: ${zeroHk}`);
        console.log(`📊 Total hari_kerja: ${totalHk}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Now calculate with filter
        const { calculatePayrollTotals } = await import('./src/services/payrollTotalsCalculator');
        const totals = calculatePayrollTotals(result.data_rows, 'TOTAL G1H');

        console.log('💰 Calculated Totals (with filter applied):');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`upah_bersih: ${totals.upah_bersih.toLocaleString('id-ID')}`);
        console.log(`hari_kerja: ${totals.hari_kerja}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        const expected = 176414884;
        const actual = totals.upah_bersih;

        console.log('✅ Final Verification:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Expected: ${expected.toLocaleString('id-ID')}`);
        console.log(`Actual:   ${actual.toLocaleString('id-ID')}`);
        
        if (actual === expected) {
            console.log('✅✅✅ MATCH! Values are identical.');
        } else {
            const diff = actual - expected;
            const diffPercent = ((diff / expected) * 100).toFixed(2);
            console.log(`❌ MISMATCH! Difference: ${diff.toLocaleString('id-ID')} (${diffPercent}%)`);
            console.log('\n⚠️  Possible reasons:');
            console.log('   1. Frontend uses different calculation logic');
            console.log('   2. Frontend applies additional filters');
            console.log('   3. Frontend uses different data source');
            console.log('   4. Backend calculation has bug');
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } catch (error) {
        console.error('❌ Error:', error);
    }

    process.exit(0);
}

checkEmployeeAttendance();
