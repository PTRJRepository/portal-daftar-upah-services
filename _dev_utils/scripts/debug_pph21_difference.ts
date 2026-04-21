/**
 * Debug script to compare PPh21 calculation between:
 * 1. Tax Report (report-pajak)
 * 2. Daftar Upah (main payroll report)
 * 
 * Target: AB2 H!H employee with ~4.6M difference
 */

import { DataExtractorService } from './backend/src/services/dataExtractorService';
import { taxReportService } from './backend/src/services/taxReportService';
import { pph21TerService } from './backend/src/services/pph21TerService';
import { getCarumanForPph21 } from './backend/src/services/carumanDefinitions';

async function debugPph21Difference() {
    console.log('='.repeat(80));
    console.log('PPh21 DEBUG: Tax Report vs Daftar Upah');
    console.log('Target: AB2 division, H!H gang');
    console.log('='.repeat(80));
    console.log();

    // Parameters - adjust month/year as needed
    const year = 2026;
    const month = 3; // March (THR month)
    const divisionCode = 'AB2';
    const gangCode = 'H1H'; // HARVESTING AIK BANGEK (NOT H!H)

    // 1. Get data from daftar upah (dataExtractorService)
    console.log('📊 Step 1: Fetching Daftar Upah data...');
    const daftarUpahData = await DataExtractorService.getInstance().extractPayrollData(
        month, year, gangCode, divisionCode, null, undefined, false, undefined, undefined, true, true
    );

    console.log(`   Found ${daftarUpahData.data_rows.length} employees`);
    console.log();

    // 2. Get data from tax report
    console.log('📊 Step 2: Fetching Tax Report data...');
    const taxReportResult = await taxReportService.getMonthlyTaxReport(
        year, month, divisionCode, gangCode
    );

    console.log(`   Found ${taxReportResult.employees.length} employees`);
    console.log(`   Total PPh21 (Tax Report): Rp ${taxReportResult.total_pph21.toLocaleString('id-ID')}`);
    console.log();

    // 3. Find matching employees and compare
    console.log('🔍 Step 3: Comparing PPh21 for each employee...');
    console.log('-'.repeat(80));

    const daftarUpahMap = new Map();
    for (const emp of daftarUpahData.data_rows) {
        const key = (emp.emp_code || emp.nik || '').trim().toUpperCase();
        daftarUpahMap.set(key, emp);
    }

    let totalDiff = 0;
    let diffCount = 0;

    for (const taxEmp of taxReportResult.employees) {
        const empKey = (taxEmp.emp_code || taxEmp.nik || '').trim().toUpperCase();
        const daftarUpahEmp = daftarUpahMap.get(empKey);

        if (!daftarUpahEmp) {
            console.log(`⚠️  ${empKey} (${taxEmp.nama}) - NOT FOUND in Daftar Upah`);
            continue;
        }

        const taxReportPph = taxEmp.pph21_ter || 0;
        const daftarUpahPph = daftarUpahEmp.pph21_ter || 0;
        const diff = taxReportPph - daftarUpahPph;

        if (Math.abs(diff) > 1) { // Only show if difference > 1 rupiah
            diffCount++;
            totalDiff += diff;

            console.log(`\n❌ DIFF FOUND: ${empKey} - ${taxEmp.nama}`);
            console.log(`   Gang: ${taxEmp.gang_code}`);
            console.log(`   PPh21 Tax Report:  Rp ${taxReportPph.toLocaleString('id-ID')}`);
            console.log(`   PPh21 Daftar Upah: Rp ${daftarUpahPph.toLocaleString('id-ID')}`);
            console.log(`   Difference:        Rp ${diff.toLocaleString('id-ID')}`);
            console.log();

            // Show income components
            console.log('   Income Components:');
            console.log(`     Gaji Pokok:      Rp ${(taxEmp.gaji_pokok_aktual || 0).toLocaleString('id-ID')}`);
            console.log(`     Beras:           Rp ${(taxEmp.beras_jumlah || 0).toLocaleString('id-ID')}`);
            console.log(`     Jabatan:         Rp ${(taxEmp.jabatan_jumlah || 0).toLocaleString('id-ID')}`);
            console.log(`     Masa Kerja:      Rp ${(taxEmp.masa_kerja_jumlah || 0).toLocaleString('id-ID')}`);
            console.log(`     Lembur:          Rp ${(taxEmp.lembur_jumlah || 0).toLocaleString('id-ID')}`);
            console.log(`     Premi:           Rp ${(taxEmp.total_premi || 0).toLocaleString('id-ID')}`);
            console.log(`     Pot Koreksi:     Rp ${(taxEmp.pot_koreksi || 0).toLocaleString('id-ID')}`);
            console.log(`     Pendapatan Lain: Rp ${(taxEmp.pendapatan_lainnya || taxEmp.total_pendapatan_lainnya || 0).toLocaleString('id-ID')}`);
            console.log();

            console.log('   Penghasilan Bruto:');
            console.log(`     Tax Report:      Rp ${(taxEmp.penghasilan_bruto || 0).toLocaleString('id-ID')}`);
            console.log(`     Daftar Upah:     Rp ${(daftarUpahEmp.penghasilan_bruto || 0).toLocaleString('id-ID')}`);
            console.log(`     Diff Bruto:      Rp ${((taxEmp.penghasilan_bruto || 0) - (daftarUpahEmp.penghasilan_bruto || 0)).toLocaleString('id-ID')}`);
            console.log();

            console.log('   Tax Details:');
            console.log(`     PTKP:            ${taxEmp.status_ptkp || 'N/A'}`);
            console.log(`     TER Category:    ${taxEmp.tarif_pajak_ter || 'N/A'}%`);
            console.log(`     Daftar Upah PTKP: ${daftarUpahEmp.status_ptkp || 'N/A'}`);
            console.log();
        }
    }

    console.log('-'.repeat(80));
    console.log(`\n📊 Summary:`);
    console.log(`   Total employees compared: ${taxReportResult.employees.length}`);
    console.log(`   Employees with diff > Rp 1: ${diffCount}`);
    console.log(`   Total difference: Rp ${totalDiff.toLocaleString('id-ID')}`);
    console.log(`   Average diff per employee: Rp ${diffCount > 0 ? Math.abs(totalDiff / diffCount).toLocaleString('id-ID') : 0}`);
    console.log();
}

// Run the debug
debugPph21Difference().catch(console.error);
