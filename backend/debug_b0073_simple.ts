/**
 * Simple debug script to trace payroll calculation for employee B0073
 * Uses existing payroll extraction to see actual values
 */

import { dataExtractorService } from './src/services/dataExtractorService';

async function debugB0073() {
    console.log('='.repeat(80));
    console.log('DEBUGGING EMPLOYEE B0073 - PAYROLL EXTRACTION');
    console.log('='.repeat(80));
    console.log('');

    try {
        // Extract payroll data for division P1B (we'll filter B0073)
        console.log('📊 Extracting payroll data for period 3/2026, division P1B...');
        const result = await dataExtractorService.extractPayrollData(3, 2026, '', 'P1B');
        
        console.log(`✅ Extraction complete: ${result.data_rows.length} rows`);
        console.log('');
        
        // Find employee B0073
        const emp = result.data_rows.find((row: any) => 
            row.emp_code === 'B0073' || row.EmpCode === 'B0073'
        );
        
        if (!emp) {
            console.log('❌ Employee B0073 not found in payroll data');
            console.log('Available employees:', result.data_rows.slice(0, 10).map((e: any) => e.emp_code || e.EmpCode).join(', '));
            return;
        }
        
        console.log('='.repeat(80));
        console.log('📋 EMPLOYEE B0073 DATA');
        console.log('='.repeat(80));
        console.log('');
        
        // Basic info
        console.log('Basic Info:');
        console.log(`  emp_code: ${emp.emp_code}`);
        console.log(`  emp_name: ${emp.emp_name || emp.nama}`);
        console.log(`  gang_code: ${emp.gang_code}`);
        console.log('');
        
        // Attendance
        console.log('Attendance:');
        console.log(`  jumlah_hk: ${emp.jumlah_hk || 0}`);
        console.log(`  hari_kerja: ${emp.hari_kerja || 0}`);
        console.log('');
        
        // Earnings components
        console.log('Earnings Components:');
        console.log(`  upah_dasar: ${emp.upah_dasar || 0}`);
        console.log(`  gaji_pokok: ${emp.gaji_pokok || 0}`);
        console.log(`  gaji_pokok_aktual: ${emp.gaji_pokok_aktual || 0}`);
        console.log(`  gaji_pokok_ideal: ${emp.gaji_pokok_ideal || 0}`);
        console.log(`  beras_rate: ${emp.beras_rate || 0}`);
        console.log(`  beras_jumlah: ${emp.beras_jumlah || 0}`);
        console.log(`  jabatan_jumlah: ${emp.jabatan_jumlah || 0}`);
        console.log(`  masa_kerja_jumlah: ${emp.masa_kerja_jumlah || 0}`);
        console.log(`  total_tunjangan: ${emp.total_tunjangan || 0}`);
        console.log(`  lembur_jumlah: ${emp.lembur_jumlah || 0}`);
        console.log(`  total_premi: ${emp.total_premi || 0}`);
        console.log('');
        
        // Deductions
        console.log('Deductions:');
        console.log(`  pot_koreksi: ${emp.pot_koreksi || 0}`);
        console.log(`  potongan_upah_kotor: ${emp.potongan_upah_kotor || 0}`);
        console.log(`  pot_astek: ${emp.pot_astek || 0}`);
        console.log(`  bpjs_kes: ${emp.bpjs_kes || 0}`);
        console.log(`  spsi: ${emp.spsi || 0}`);
        console.log(`  pph21: ${emp.pph21 || 0}`);
        console.log(`  total_potongan: ${emp.total_potongan || 0}`);
        console.log(`  total_potongan_bersih: ${emp.total_potongan_bersih || 0}`);
        console.log('');
        
        // Gross pay
        console.log('Gross Pay (Upah Kotor):');
        console.log(`  upah_kotor: ${emp.upah_kotor || 0}`);
        console.log(`  jumlah_upah_kotor: ${emp.jumlah_upah_kotor || 0}`);
        console.log(`  upah_kotor_pajak: ${emp.upah_kotor_pajak || 0}`);
        console.log(`  penghasilan_bruto: ${emp.penghasilan_bruto || 0}`);
        console.log('');
        
        // Net pay
        console.log('Net Pay:');
        console.log(`  upah_bersih: ${emp.upah_bersih || 0}`);
        console.log('');
        
        // Additional info
        console.log('Additional Info:');
        console.log(`  pendapatan_lainnya: ${emp.pendapatan_lainnya || 0}`);
        
        // Check pendapatan_lainnya breakdown
        if (emp.pendapatan_lainnya_details) {
            console.log('  Pendapatan Lainnya Breakdown:');
            if (Array.isArray(emp.pendapatan_lainnya_details)) {
                emp.pendapatan_lainnya_details.forEach((item: any) => {
                    console.log(`    ${item.type || item.jenis}: ${item.amount || item.jumlah}`);
                });
            } else if (typeof emp.pendapatan_lainnya_details === 'object') {
                for (const [key, value] of Object.entries(emp.pendapatan_lainnya_details)) {
                    console.log(`    ${key}: ${value}`);
                }
            }
        }
        
        console.log(`  koreksi_hk: ${emp.koreksi_hk || 0}`);
        console.log(`  status_ptkp: ${emp.status_ptkp || '-'}`);
        console.log(`  tarif_pajak_ter: ${emp.tarif_pajak_ter || 0}%`);
        console.log(`  pph21_ter: ${emp.pph21_ter || 0}`);
        console.log('');
        
        // Manual calculation
        console.log('='.repeat(80));
        console.log('🔢 MANUAL VERIFICATION');
        console.log('='.repeat(80));
        console.log('');
        
        const gp = emp.gaji_pokok_aktual || emp.gaji_pokok || 0;
        const beras = emp.beras_jumlah || 0;
        const jabatan = emp.jabatan_jumlah || 0;
        const masaKerja = emp.masa_kerja_jumlah || 0;
        const totalTunjangan = emp.total_tunjangan || 0;
        const lembur = emp.lembur_jumlah || 0;
        const premi = emp.total_premi || 0;
        const koreksi = emp.pot_koreksi || 0;
        const pendapatanLainnya = emp.pendapatan_lainnya || 0;
        
        console.log('Formula:');
        console.log(`  UPAH KOTOR = Gaji Pokok + Total Tunjangan + Total Premi`);
        console.log(`             = ${gp} + ${totalTunjangan} + ${premi}`);
        console.log(`             = ${gp + totalTunjangan + premi}`);
        console.log('');
        
        console.log(`  JUMLAH UPAH KOTOR = UPAH KOTOR + Lembur - Koreksi + Pendapatan Lainnya`);
        console.log(`                    = ${(gp + totalTunjangan + premi)} + ${lembur} - ${koreksi} + ${pendapatanLainnya}`);
        console.log(`                    = ${(gp + totalTunjangan + premi) + lembur - koreksi + pendapatanLainnya}`);
        console.log('');
        
        const expectedJumlah = 8894750;
        const calculatedJumlah = (gp + totalTunjangan + premi) + lembur - koreksi + pendapatanLainnya;
        const diff = calculatedJumlah - expectedJumlah;
        
        console.log('='.repeat(80));
        console.log(`EXPECTED: ${expectedJumlah.toLocaleString('id-ID')}`);
        console.log(`CALCULATED: ${calculatedJumlah.toLocaleString('id-ID')}`);
        console.log(`DIFFERENCE: ${diff > 0 ? '+' : ''}${diff.toLocaleString('id-ID')}`);
        console.log('='.repeat(80));
        console.log('');
        
        if (Math.abs(diff) > 0) {
            console.log('⚠️  DISCREPANCY FOUND!');
            console.log('');
            console.log('Checking component breakdown...');
            console.log('');
            
            // Show all premi details
            if (emp.premi && typeof emp.premi === 'object') {
                console.log('Premi Details:');
                for (const [key, value] of Object.entries(emp.premi)) {
                    console.log(`  ${key}: ${value}`);
                }
                console.log('');
            }
            
            // Show all potongan details
            if (emp.potongan && typeof emp.potongan === 'object') {
                console.log('Potongan Details:');
                for (const [key, value] of Object.entries(emp.potongan)) {
                    console.log(`  ${key}: ${value}`);
                }
                console.log('');
            }
            
            // Check if there are dynamic columns
            console.log('Dynamic Premi Headers:', result.dynamic_premi_headers);
            console.log('Dynamic Potongan Headers:', result.dynamic_potongan_headers);
            console.log('');
            
            // Check dynamic premi values for this employee
            console.log('Employee Dynamic Premi Values:');
            result.dynamic_premi_headers.forEach((header: string) => {
                const value = emp[header] || 0;
                console.log(`  ${header}: ${value}`);
            });
            console.log('');
            
            // Check if total_premi includes all dynamic premi
            let dynamicPremiTotal = 0;
            result.dynamic_premi_headers.forEach((header: string) => {
                dynamicPremiTotal += emp[header] || 0;
            });
            console.log(`Dynamic Premi Total: ${dynamicPremiTotal}`);
            console.log(`total_premi (from emp): ${emp.total_premi || 0}`);
            console.log(`Difference: ${dynamicPremiTotal - (emp.total_premi || 0)}`);
            console.log('');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
        if (error instanceof Error) {
            console.error('Message:', error.message);
            console.error('Stack:', error.stack);
        }
    }
}

debugB0073().then(() => {
    console.log('\n✅ Debug completed');
    process.exit(0);
}).catch((error) => {
    console.error('\n❌ Debug failed:', error);
    process.exit(1);
});
