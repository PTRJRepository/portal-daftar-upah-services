/**
 * Test script to verify backend aggregation totals
 * Tests division AB1, gang G1H, March 2026
 * Expected upah_bersih: 176,414,884
 */

import { Database } from './src/db/client';

async function testAggregation() {
    console.log('🧪 Testing Backend Aggregation for AB1, G1H, March 2026...\n');

    try {
        // Test 1: Call the dataExtractorService to get raw data
        const { dataExtractorService } = await import('./src/services/dataExtractorService');
        const { calculatePayrollTotals } = await import('./src/services/payrollTotalsCalculator');

        console.log('📊 Extracting payroll data...');
        const result = await dataExtractorService.extractPayrollData(
            3,    // March
            2026, // Year 2026
            'G1H', // Gang code
            'AB1', // Division code
            null,
            'SERVER_PROFILE_2', // Main payroll DB
            false,
            null,
            null,
            true  // skipHarvest
        );

        console.log(`✅ Extracted ${result.data_rows.length} employee rows\n`);

        // Group by gang
        const gangsMap: Record<string, any[]> = {};
        result.data_rows.forEach((row: any) => {
            const gang = row.gang_code || 'UNKNOWN';
            if (!gangsMap[gang]) gangsMap[gang] = [];
            gangsMap[gang].push(row);
        });

        console.log(`📊 Found ${Object.keys(gangsMap).length} gangs:`, Object.keys(gangsMap).sort());

        // Find G1H gang
        const g1hEmployees = gangsMap['G1H'];
        if (!g1hEmployees || g1hEmployees.length === 0) {
            console.log('⚠️  Gang G1H not found in the data');
            console.log('📊 Available gangs:', Object.keys(gangsMap).sort());
            return;
        }

        console.log(`\n🎯 Gang G1H has ${g1hEmployees.length} employees`);

        // Calculate totals for G1H
        const g1hTotals = calculatePayrollTotals(g1hEmployees, 'TOTAL G1H');

        console.log('\n💰 Gang G1H Totals:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`upah_bersih: ${g1hTotals.upah_bersih.toLocaleString('id-ID')}`);
        console.log(`hari_kerja: ${g1hTotals.hari_kerja.toLocaleString('id-ID')}`);
        console.log(`gaji_pokok: ${g1hTotals.gaji_pokok.toLocaleString('id-ID')}`);
        console.log(`total_tunjangan: ${g1hTotals.total_tunjangan.toLocaleString('id-ID')}`);
        console.log(`total_premi: ${g1hTotals.total_premi.toLocaleString('id-ID')}`);
        console.log(`jumlah_upah_kotor: ${g1hTotals.jumlah_upah_kotor.toLocaleString('id-ID')}`);
        console.log(`total_potongan: ${g1hTotals.total_potongan.toLocaleString('id-ID')}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Calculate grand total for all gangs in AB1
        const grandTotal = calculatePayrollTotals(result.data_rows, 'GRAND TOTAL AB1');

        console.log('💰 Division AB1 Grand Total:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`upah_bersih: ${grandTotal.upah_bersih.toLocaleString('id-ID')}`);
        console.log(`hari_kerja: ${grandTotal.hari_kerja.toLocaleString('id-ID')}`);
        console.log(`total_employees: ${result.data_rows.length}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Expected value
        const expected = 176414884;
        const actual = g1hTotals.upah_bersih;

        console.log('✅ Verification:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Expected upah_bersih (G1H): ${expected.toLocaleString('id-ID')}`);
        console.log(`Actual upah_bersih (G1H):   ${actual.toLocaleString('id-ID')}`);
        
        if (actual === expected) {
            console.log('✅ MATCH! Values are identical.');
        } else {
            const diff = actual - expected;
            const diffPercent = ((diff / expected) * 100).toFixed(2);
            console.log(`❌ MISMATCH! Difference: ${diff.toLocaleString('id-ID')} (${diffPercent}%)`);
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Show first 3 employees for debugging
        console.log('📋 Sample employees in G1H:');
        g1hEmployees.slice(0, 3).forEach((emp: any, idx: number) => {
            console.log(`  ${idx + 1}. ${emp.nama} (NIK: ${emp.nik})`);
            console.log(`     hari_kerja: ${emp.hari_kerja}`);
            console.log(`     gaji_pokok: ${emp.gaji_pokok?.toLocaleString('id-ID')}`);
            console.log(`     upah_bersih: ${emp.upah_bersih?.toLocaleString('id-ID')}`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Stack:', error.stack);
        }
    }

    process.exit(0);
}

testAggregation();
