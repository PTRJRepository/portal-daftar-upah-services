/**
 * Find the exact employees that have different PPh21
 * Shows full details for debugging
 */

import { DataExtractorService } from './backend/src/services/dataExtractorService';
import { taxReportService } from './backend/src/services/taxReportService';

async function findDiffEmployees() {
    console.log('='.repeat(80));
    console.log('Finding employees with different PPh21 (ALL gangs in AB2)');
    console.log('='.repeat(80));
    console.log();

    const year = 2026;
    const month = 3;
    const divisionCode = 'AB2';
    const gangCode = 'ALL';

    const [daftarUpahData, taxReportResult] = await Promise.all([
        DataExtractorService.getInstance().extractPayrollData(
            month, year, gangCode, divisionCode, null, undefined, false, undefined, undefined, true, true
        ),
        taxReportService.getMonthlyTaxReport(year, month, divisionCode, gangCode)
    ]);

    console.log(`Daftar Upah: ${daftarUpahData.data_rows.length} employees`);
    console.log(`Tax Report:  ${taxReportResult.employees.length} employees`);
    console.log();

    // Build maps
    const daftarUpahMap = new Map();
    for (const emp of daftarUpahData.data_rows) {
        const key = (emp.emp_code || emp.nik || '').trim().toUpperCase();
        daftarUpahMap.set(key, emp);
    }

    const taxReportMap = new Map();
    for (const emp of taxReportResult.employees) {
        const key = (emp.emp_code || emp.nik || '').trim().toUpperCase();
        taxReportMap.set(key, emp);
    }

    // Find employees in Daftar Upah but NOT in Tax Report
    console.log('🔍 Employees in Daftar Upah but MISSING from Tax Report:');
    console.log('-'.repeat(80));
    let missingCount = 0;
    for (const [key, emp] of daftarUpahMap) {
        if (!taxReportMap.has(key)) {
            missingCount++;
            console.log(`  ${key} | ${emp.nama || emp.emp_name} | Gang: ${emp.gang_code} | PPh21: ${emp.pph21_ter || 0}`);
        }
    }
    console.log(`Total missing: ${missingCount}`);
    console.log();

    // Find employees with different PPh21
    console.log('🔍 Employees with DIFFERENT PPh21 values:');
    console.log('-'.repeat(80));
    
    for (const [key, taxEmp] of taxReportMap) {
        const daftarEmp = daftarUpahMap.get(key);
        if (!daftarEmp) continue;

        const taxPph = taxEmp.pph21_ter || 0;
        const daftarPph = daftarEmp.pph21_ter || 0;
        
        if (Math.abs(taxPph - daftarPph) > 0) {
            console.log(`\n❌ ${key} | ${taxEmp.emp_name || daftarEmp.nama}`);
            console.log(`   Gang: ${taxEmp.gang_code || daftarEmp.gang_code}`);
            console.log(`   PPh21 Tax Report:  Rp ${taxPph.toLocaleString('id-ID')}`);
            console.log(`   PPh21 Daftar Upah: Rp ${daftarPph.toLocaleString('id-ID')}`);
            console.log(`   Difference:        Rp ${(taxPph - daftarPph).toLocaleString('id-ID')}`);
            console.log();
            console.log(`   Details Tax Report:`);
            console.log(`     Penghasilan Bruto: Rp ${(taxEmp.penghasilan_bruto || 0).toLocaleString('id-ID')}`);
            console.log(`     PTKP: ${taxEmp.status_ptkp || 'N/A'}`);
            console.log(`     TARIF: ${taxEmp.tarif_pajak_ter || 'N/A'}%`);
            console.log(`     Pendapatan Lain: Rp ${(taxEmp.pendapatan_lainnya || taxEmp.total_pendapatan_lainnya || 0).toLocaleString('id-ID')}`);
            console.log();
            console.log(`   Details Daftar Upah:`);
            console.log(`     Penghasilan Bruto: Rp ${(daftarEmp.penghasilan_bruto || 0).toLocaleString('id-ID')}`);
            console.log(`     PTKP: ${daftarEmp.status_ptkp || 'N/A'}`);
            console.log(`     TARIF: ${daftarEmp.tarif_pajak_ter || 'N/A'}%`);
            console.log(`     Jumlah Upah Kotor: Rp ${(daftarEmp.jumlah_upah_kotor || 0).toLocaleString('id-ID')}`);
            console.log();
        }
    }

    console.log('-'.repeat(80));
    console.log();
    console.log('✅ Analysis complete');
}

findDiffEmployees().catch(console.error);
