/**
 * Verify PPh21 TER for Gang A1H in Division PG1A
 * Expected total: 8.719.772
 */

import * as fs from 'fs';
import * as path from 'path';
import { currentPeriodService } from './backend/src/services/currentPeriodService';
import { DataExtractorService } from './backend/src/services/dataExtractorService';
import { pph21TerService } from './backend/src/services/pph21TerService';
import { ptkpTaxService, mapPTKPToTER } from './backend/src/services/ptkpTaxService';
import { getCarumanForPph21 } from './backend/src/services/carumanDefinitions';

function formatRupiah(amount: number): string {
    return `Rp ${amount.toLocaleString('id-ID')}`;
}

async function verifyA1H() {
    console.log('='.repeat(80));
    console.log('[Verification] Gang A1H - Division PG1A');
    console.log('='.repeat(80));
    console.log('Expected Total PPh21 TER: Rp 8.719.772\n');

    // Get current period
    const currentPeriod = await currentPeriodService.getCurrentPeriod();
    const { month, year } = currentPeriod;
    console.log(`Period: Month ${month}, Year ${year}`);

    // Get PTKP mapping
    const ptkpMaster = await ptkpTaxService.getPtkpByYear(year);
    const ptkpMap = new Map<string, string>();
    for (const p of ptkpMaster) {
        ptkpMap.set(p.emp_code.trim(), p.ptkp_status);
    }

    // Fetch payroll data for gang A1H
    console.log('\nFetching payroll data for gang A1H...');
    const extractor = DataExtractorService.getInstance();

    const payrollData = await extractor.extractPayrollData(
        month,
        year,
        'A1H', // Specific gang
        'PG1A',
        null,
        undefined,
        false,
        undefined,
        undefined,
        true,
        true
    );

    if (!payrollData || payrollData.data_rows.length === 0) {
        console.log('❌ No data found for gang A1H');
        return;
    }

    console.log(`✓ Found ${payrollData.data_rows.length} employees in gang A1H\n`);

    let totalPph21 = 0;
    let totalGrossIncome = 0;
    const employees: any[] = [];

    for (const row of payrollData.data_rows) {
        const empCode = row.emp_code?.trim() || '';
        const empName = row.nama || row.emp_name || '';
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

        const pph21Caruman = getCarumanForPph21(upahDasar, tunjanganMasaKerja);
        const astek084 = pph21Caruman.astek_majikan_084;
        const bpjsKesehatanMajikan4Pct = pph21Caruman.bpjs_kes_majikan_4;

        const grossIncome = pph21TerService.calculatePenghasilanBruto(
            gajiPokokAktual,
            tunjanganBeras,
            tunjanganJabatan,
            tunjanganMasaKerja,
            tunjanganLembur,
            totalPremi,
            astek084,
            bpjsKesehatanMajikan4Pct,
            potKoreksiForTax,
            pendapatanLainnya
        );

        const pphResult = pph21TerService.calculatePph21Ter(grossIncome, ptkpStatus);
        const pph21Amount = pphResult.tax_amount;

        totalPph21 += pph21Amount;
        totalGrossIncome += grossIncome;

        employees.push({
            emp_code: empCode,
            emp_name: empName,
            ptkp_status: ptkpStatus,
            ter_category: mapPTKPToTER(ptkpStatus),
            gross_income: grossIncome,
            pph21_amount: pph21Amount,
            tax_rate_percent: pphResult.rate_percent
        });
    }

    // Display results
    console.log('Employee Details:');
    console.log('-'.repeat(80));
    console.log(
        'EmpCode'.padEnd(10) +
        'Name'.padEnd(30) +
        'PTKP'.padEnd(8) +
        'Gross Income'.padEnd(18) +
        'Rate'.padEnd(8) +
        'PPh21 TER'
    );
    console.log('-'.repeat(80));

    for (const emp of employees) {
        console.log(
            emp.emp_code.padEnd(10) +
            emp.emp_name.substring(0, 28).padEnd(30) +
            emp.ptkp_status.padEnd(8) +
            formatRupiah(emp.gross_income).padEnd(18) +
            `${emp.tax_rate_percent}%`.padEnd(8) +
            formatRupiah(emp.pph21_amount)
        );
    }

    console.log('-'.repeat(80));
    console.log('\nSummary:');
    console.log(`  Total Employees: ${employees.length}`);
    console.log(`  Total Gross Income: ${formatRupiah(totalGrossIncome)}`);
    console.log(`  Total PPh21 TER: ${formatRupiah(totalPph21)}`);
    console.log(`  Expected:          Rp 8.719.772`);
    
    const diff = totalPph21 - 8719772;
    console.log(`  Difference:        ${formatRupiah(diff)}`);
    
    if (Math.abs(diff) < 100) {
        console.log('\n✅ MATCH! PPh21 TER calculation is correct.');
    } else {
        console.log(`\n❌ MISMATCH! Difference: ${formatRupiah(diff)}`);
        console.log('Need to investigate the calculation formula.');
    }

    // Also check the saved JSON file
    const pph21File = path.resolve(process.cwd(), 'update_pajak/PG1A_pajak.json');
    if (fs.existsSync(pph21File)) {
        console.log('\n' + '='.repeat(80));
        console.log('Checking saved PG1A_pajak.json file...');
        console.log('='.repeat(80));
        
        const savedData = JSON.parse(fs.readFileSync(pph21File, 'utf-8'));
        console.log(`Total employees in file: ${savedData.length}`);
        console.log('(This includes ALL gangs in PG1A, not just A1H)');
    }
}

verifyA1H()
    .then(() => {
        console.log('\n✅ Verification complete');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Verification failed:', error);
        process.exit(1);
    });
