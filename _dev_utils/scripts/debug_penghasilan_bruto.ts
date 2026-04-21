/**
 * Debug penghasilan_bruto calculation for gang A1H
 * Compare actual values from database vs calculation
 */

import { currentPeriodService } from './backend/src/services/currentPeriodService';
import { DataExtractorService } from './backend/src/services/dataExtractorService';
import { ptkpTaxService } from './backend/src/services/ptkpTaxService';
import { getCarumanForPph21 } from './backend/src/services/carumanDefinitions';
import { pph21TerService } from './backend/src/services/pph21TerService';

function formatRupiah(amount: number): string {
    return `Rp ${amount.toLocaleString('id-ID')}`;
}

async function debugPenghasilanBruto() {
    console.log('='.repeat(80));
    console.log('[Debug] Penghasilan Bruto Calculation - Gang A1H');
    console.log('='.repeat(80));

    const currentPeriod = await currentPeriodService.getCurrentPeriod();
    const { month, year } = currentPeriod;

    const ptkpMaster = await ptkpTaxService.getPtkpByYear(year);
    const ptkpMap = new Map<string, string>();
    for (const p of ptkpMaster) {
        ptkpMap.set(p.emp_code.trim(), p.ptkp_status);
    }

    const extractor = DataExtractorService.getInstance();
    const payrollData = await extractor.extractPayrollData(
        month, year, 'A1H', 'PG1A', null, undefined, false,
        undefined, undefined, true, true
    );

    if (!payrollData || payrollData.data_rows.length === 0) {
        console.log('No data found');
        return;
    }

    console.log(`\nFound ${payrollData.data_rows.length} employees\n`);

    // Check first 3 employees in detail
    for (let i = 0; i < Math.min(3, payrollData.data_rows.length); i++) {
        const row = payrollData.data_rows[i];
        const empCode = row.emp_code?.trim() || '';
        const empName = row.nama || row.emp_name || '';

        console.log(`\n${'='.repeat(80)}`);
        console.log(`Employee ${i + 1}: ${empCode} - ${empName}`);
        console.log('='.repeat(80));

        console.log('\n📊 RAW DATA FROM EXTRACTOR:');
        console.log(`  gaji_pokok_aktual: ${formatRupiah(row.gaji_pokok_aktual || 0)}`);
        console.log(`  gaji_pokok: ${formatRupiah(row.gaji_pokok || 0)}`);
        console.log(`  beras_jumlah: ${formatRupiah(row.beras_jumlah || 0)}`);
        console.log(`  jabatan_jumlah: ${formatRupiah(row.jabatan_jumlah || 0)}`);
        console.log(`  masa_kerja_jumlah: ${formatRupiah(row.masa_kerja_jumlah || 0)}`);
        console.log(`  lembur_jumlah: ${formatRupiah(row.lembur_jumlah || 0)}`);
        console.log(`  total_premi: ${formatRupiah(row.total_premi || 0)}`);
        console.log(`  pot_koreksi: ${formatRupiah(row.pot_koreksi || 0)}`);
        console.log(`  upah_dasar: ${formatRupiah(row.upah_dasar || 0)}`);
        console.log(`  pendapatan_lainnya: ${formatRupiah(row.pendapatan_lainnya || 0)}`);
        console.log(`  jumlah_upah_kotor (from DB): ${formatRupiah(row.jumlah_upah_kotor || 0)}`);
        console.log(`  upah_kotor_pajak (from DB): ${formatRupiah(row.upah_kotor_pajak || 0)}`);
        console.log(`  penghasilan_bruto (from DB): ${formatRupiah(row.penghasilan_bruto || 0)}`);

        // Calculate using MY extraction method
        console.log('\n🧮 CALCULATION (Extraction Script Method):');
        const gajiPokokAktual = row.gaji_pokok_aktual || row.gaji_pokok || 0;
        const tunjanganBeras = row.beras_jumlah || 0;
        const tunjanganJabatan = row.jabatan_jumlah || 0;
        const tunjanganMasaKerja = row.masa_kerja_jumlah || 0;
        const tunjanganLembur = row.lembur_jumlah || 0;
        const totalPremi = row.total_premi || 0;
        const upahDasar = row.upah_dasar || 0;
        const potKoreksiForTax = -(row.pot_koreksi || 0);
        const pendapatanLainnya = row.pendapatan_lainnya || 0;

        const caruman = getCarumanForPph21(upahDasar, tunjanganMasaKerja);
        const astek084 = caruman.astek_majikan_084;
        const bpjsKesMajikan = caruman.bpjs_kes_majikan_4;

        console.log(`  astek_majikan_0.84%: ${formatRupiah(astek084)}`);
        console.log(`  bpjs_kes_majikan_4%: ${formatRupiah(bpjsKesMajikan)}`);
        console.log(`  pot_koreksi (negated): ${formatRupiah(potKoreksiForTax)}`);
        console.log(`  pendapatan_lainnya: ${formatRupiah(pendapatanLainnya)}`);

        const grossIncomeMyMethod = pph21TerService.calculatePenghasilanBruto(
            gajiPokokAktual,
            tunjanganBeras,
            tunjanganJabatan,
            tunjanganMasaKerja,
            tunjanganLembur,
            totalPremi,
            astek084,
            bpjsKesMajikan,
            potKoreksiForTax,
            pendapatanLainnya
        );

        console.log(`  → Gross Income (My Method): ${formatRupiah(grossIncomeMyMethod)}`);

        // Calculate using UI/PayrollCalculator method: jumlah_upah_kotor + astek + bpjs
        console.log('\n🧮 CALCULATION (UI/PayrollCalculator Method):');
        const jumlahUpahKotor = row.jumlah_upah_kotor || 0;
        const astekMajikan = caruman.astek_majikan_jkk_jkm || caruman.astek_majikan_084;
        const bpjsMajikan = caruman.bpjs_kes_majikan || caruman.bpjs_kes_majikan_4;

        const grossIncomeUIMethod = jumlahUpahKotor + astekMajikan + bpjsMajikan;

        console.log(`  jumlah_upah_kotor: ${formatRupiah(jumlahUpahKotor)}`);
        console.log(`  + astek_majikan: ${formatRupiah(astekMajikan)}`);
        console.log(`  + bpjs_majikan: ${formatRupiah(bpjsMajikan)}`);
        console.log(`  → Gross Income (UI Method): ${formatRupiah(grossIncomeUIMethod)}`);

        // Compare with DB value
        const dbPenghasilanBruto = row.penghasilan_bruto || 0;
        console.log(`\n📊 COMPARISON:`);
        console.log(`  DB penghasilan_bruto: ${formatRupiah(dbPenghasilanBruto)}`);
        console.log(`  My calculation: ${formatRupiah(grossIncomeMyMethod)}`);
        console.log(`  UI calculation: ${formatRupiah(grossIncomeUIMethod)}`);
        console.log(`  Diff (DB vs My): ${formatRupiah(dbPenghasilanBruto - grossIncomeMyMethod)}`);
        console.log(`  Diff (DB vs UI): ${formatRupiah(dbPenghasilanBruto - grossIncomeUIMethod)}`);

        // Calculate PPh21 with both methods
        const ptkpStatus = ptkpMap.get(empCode) || row.status_ptkp || 'TK/0';
        const pphMyMethod = pph21TerService.calculatePph21Ter(grossIncomeMyMethod, ptkpStatus);
        const pphUIMethod = pph21TerService.calculatePph21Ter(grossIncomeUIMethod, ptkpStatus);

        console.log(`\n💰 PPh21 TER Comparison:`);
        console.log(`  My Method: ${formatRupiah(pphMyMethod.tax_amount)} (${pphMyMethod.rate_percent}%)`);
        console.log(`  UI Method: ${formatRupiah(pphUIMethod.tax_amount)} (${pphUIMethod.rate_percent}%)`);
    }

    // Now check totals for all employees in A1H
    console.log(`\n${'='.repeat(80)}`);
    console.log('SUMMARY - All Employees in A1H');
    console.log('='.repeat(80));

    let totalGrossMyMethod = 0;
    let totalGrossUIMethod = 0;
    let totalGrossDB = 0;
    let totalPphMyMethod = 0;
    let totalPphUIMethod = 0;

    for (const row of payrollData.data_rows) {
        const empCode = row.emp_code?.trim() || '';
        const ptkpStatus = ptkpMap.get(empCode) || row.status_ptkp || 'TK/0';

        const gajiPokokAktual = row.gaji_pokok_aktual || row.gaji_pokok || 0;
        const tunjanganBeras = row.beras_jumlah || 0;
        const tunjanganJabatan = row.jabatan_jumlah || 0;
        const tunjanganMasaKerja = row.masa_kerja_jumlah || 0;
        const tunjanganLembur = row.lembur_jumlah || 0;
        const totalPremi = row.total_premi || 0;
        const upahDasar = row.upah_dasar || 0;
        const potKoreksiForTax = -(row.pot_koreksi || 0);
        const pendapatanLainnya = row.pendapatan_lainnya || 0;

        const caruman = getCarumanForPph21(upahDasar, tunjanganMasaKerja);

        // My method
        const grossMyMethod = pph21TerService.calculatePenghasilanBruto(
            gajiPokokAktual, tunjanganBeras, tunjanganJabatan, tunjanganMasaKerja,
            tunjanganLembur, totalPremi, caruman.astek_majikan_084,
            caruman.bpjs_kes_majikan_4, potKoreksiForTax, pendapatanLainnya
        );
        const pphMyMethod = pph21TerService.calculatePph21Ter(grossMyMethod, ptkpStatus);

        // UI method
        const jumlahUpahKotor = row.jumlah_upah_kotor || 0;
        const grossUIMethod = jumlahUpahKotor + (caruman.astek_majikan_jkk_jkm || caruman.astek_majikan_084) + (caruman.bpjs_kes_majikan || caruman.bpjs_kes_majikan_4);
        const pphUIMethod = pph21TerService.calculatePph21Ter(grossUIMethod, ptkpStatus);

        // DB
        const grossDB = row.penghasilan_bruto || 0;

        totalGrossMyMethod += grossMyMethod;
        totalGrossUIMethod += grossUIMethod;
        totalGrossDB += grossDB;
        totalPphMyMethod += pphMyMethod.tax_amount;
        totalPphUIMethod += pphUIMethod.tax_amount;
    }

    console.log('\nTotal Penghasilan Bruto:');
    console.log(`  My Method: ${formatRupiah(totalGrossMyMethod)}`);
    console.log(`  UI Method: ${formatRupiah(totalGrossUIMethod)}`);
    console.log(`  DB Value:  ${formatRupiah(totalGrossDB)}`);

    console.log('\nTotal PPh21 TER:');
    console.log(`  My Method: ${formatRupiah(totalPphMyMethod)}`);
    console.log(`  UI Method: ${formatRupiah(totalPphUIMethod)}`);
    console.log(`  Expected:  Rp 8.719.772`);

    console.log('\nDifferences:');
    console.log(`  My vs UI Gross: ${formatRupiah(totalGrossMyMethod - totalGrossUIMethod)}`);
    console.log(`  My vs DB Gross: ${formatRupiah(totalGrossMyMethod - totalGrossDB)}`);
    console.log(`  UI vs DB Gross: ${formatRupiah(totalGrossUIMethod - totalGrossDB)}`);
    console.log(`  My vs Expected PPh: ${formatRupiah(totalPphMyMethod - 8719772)}`);
    console.log(`  UI vs Expected PPh: ${formatRupiah(totalPphUIMethod - 8719772)}`);
}

debugPenghasilanBruto()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
