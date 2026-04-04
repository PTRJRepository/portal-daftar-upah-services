/**
 * Test script to verify tunjangan jabatan is now showing for IJL division
 * Run: cd backend && bun run ../_dev_utils/scripts/debugging/test_ijl_jabatan_fix.ts
 */

import { dataExtractorService } from '../../backend/src/services/dataExtractorService';

async function testIjlJabatan() {
    console.log('=== Testing IJL Tunjangan Jabatan Fix ===\n');

    const divisionCode = 'IJL';
    const gangCode = 'ALL';
    const month = 3; // March 2026
    const year = 2026;

    console.log(`Extracting payroll data for:`);
    console.log(`  Division: ${divisionCode}`);
    console.log(`  Gang: ${gangCode}`);
    console.log(`  Period: ${month}/${year}\n`);

    try {
        const result = await dataExtractorService.extractPayrollData(
            divisionCode,
            gangCode,
            month,
            year
        );

        console.log(`\n✅ Extraction successful!`);
        console.log(`Total employees found: ${result.data_rows.length}\n`);

        // Check for employees with jabatan_jumlah > 0
        const employeesWithJabatan = result.data_rows.filter(
            (emp: any) => emp.jabatan_jumlah && emp.jabatan_jumlah > 0
        );

        console.log(`Employees with tunjangan jabatan > 0: ${employeesWithJabatan.length}\n`);

        if (employeesWithJabatan.length > 0) {
            console.log('Sample employees with jabatan:');
            employeesWithJabatan.slice(0, 5).forEach((emp: any, idx: number) => {
                console.log(`  ${idx + 1}. ${emp.emp_name || emp.nama} (${emp.nik})`);
                console.log(`     Jabatan: Rp ${(emp.jabatan_jumlah || 0).toLocaleString('id-ID')}`);
                console.log(`     Total Tunjangan: Rp ${(emp.total_tunjangan || 0).toLocaleString('id-ID')}`);
            });
        } else {
            console.log('⚠️  No employees with tunjangan jabatan found.');
            console.log('\nThis could mean:');
            console.log('  1. Data truly does not exist in PR_ADTRANS/PR_ADTRANS_ARC for IJL');
            console.log('  2. The DocDesc pattern does not contain "JABATAN"');
            console.log('  3. Employee codes are not matching');
        }

        // Show first employee structure
        if (result.data_rows.length > 0) {
            console.log('\n--- First Employee Data Structure ---');
            const firstEmp = result.data_rows[0] as any;
            const relevantFields = Object.keys(firstEmp).filter(
                k => k.includes('jabatan') || k.includes('tunjangan') || k.includes('beras') || k.includes('masa_kerja')
            );
            console.log('Allowance-related fields:');
            relevantFields.forEach(field => {
                console.log(`  ${field}: ${firstEmp[field]}`);
            });
        }

    } catch (error) {
        console.error('❌ Error during extraction:', error);
    }
}

testIjlJabatan()
    .then(() => {
        console.log('\n=== Test Complete ===');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Test failed:', error);
        process.exit(1);
    });
