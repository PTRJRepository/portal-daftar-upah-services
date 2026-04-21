/**
 * Test: Verify KONTAN and all pendapatan lainnya are calculated correctly
 */

async function testPendapatanLainnya() {
    console.log('🧪 Testing KONTAN and all pendapatan lainnya...\n');

    try {
        const { dataExtractorService } = await import('./src/services/dataExtractorService');
        const { calculatePayrollTotals } = await import('./src/services/payrollTotalsCalculator');

        const result = await dataExtractorService.extractPayrollData(
            3, 2026, 'G1H', 'AB1', null, 'SERVER_PROFILE_2', false, null, null, true
        );

        const totals = calculatePayrollTotals(result.data_rows, 'TOTAL G1H');

        console.log('📊 Pendapatan Lainnya Totals:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`  pendapatan_thr:       ${(totals as any).pendapatan_thr?.toLocaleString('id-ID') || '0'}`);
        console.log(`  pendapatan_bonus:     ${(totals as any).pendapatan_bonus?.toLocaleString('id-ID') || '0'}`);
        console.log(`  pendapatan_custom:    ${(totals as any).pendapatan_custom?.toLocaleString('id-ID') || '0'}`);
        console.log(`  pendapatan_lainnya:   ${(totals as any).pendapatan_lainnya?.toLocaleString('id-ID') || '0'}`);
        console.log('');
        
        // Check custom types
        Object.keys(totals).forEach(key => {
            if (key.startsWith('pendapatan_') && !['pendapatan_thr', 'pendapatan_bonus', 'pendapatan_custom', 'pendapatan_lainnya'].includes(key)) {
                console.log(`  ${key.padEnd(30)}: ${(totals as any)[key]?.toLocaleString('id-ID') || '0'}`);
            }
        });
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Check other_incomes in first few employees
        console.log('📋 Sample other_incomes from employees:');
        result.data_rows.slice(0, 5).forEach((emp, idx) => {
            if (emp.other_incomes && emp.other_incomes.length > 0) {
                console.log(`  Employee ${idx + 1} (${emp.nama?.substring(0, 20)}):`);
                emp.other_incomes.forEach((oi: any) => {
                    console.log(`    - Type: ${oi.type}, Amount: ${Number(oi.amount || 0).toLocaleString('id-ID')}`);
                });
            }
        });
        console.log('');

        // Check upah_bersih
        console.log('💰 Upah Bersih Totals:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`  upah_bersih: ${(totals as any).upah_bersih?.toLocaleString('id-ID') || '0'}`);
        console.log(`  Expected:    176.414.884`);
        console.log(`  Match: ${(totals as any).upah_bersih === 176414884 ? '✅ YES' : '❌ NO'}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Check grand_total structure
        console.log('📦 Grand Total Structure:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        const totalKeys = Object.keys(totals);
        console.log(`  Total fields: ${totalKeys.length}`);
        console.log(`  Has upah_bersih: ${'upah_bersih' in totals ? '✅' : '❌'}`);
        console.log(`  Has jumlah_upah_kotor: ${'jumlah_upah_kotor' in totals ? '✅' : '❌'}`);
        console.log(`  Has total_potongan: ${'total_potongan' in totals ? '✅' : '❌'}`);
        console.log(`  Has premi (nested): ${'premi' in totals ? '✅' : '❌'}`);
        console.log(`  Pendapatan types: ${totalKeys.filter(k => k.startsWith('pendapatan_')).length}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } catch (error) {
        console.error('❌ Error:', error);
    }

    process.exit(0);
}

testPendapatanLainnya();
