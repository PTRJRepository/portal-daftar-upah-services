/**
 * Debug script to trace payroll calculation for specific employee
 * Employee: B0073
 * Expected Jumlah Upah Kotor: 8,894,750
 */

import { Database } from './src/db/client';
import { PayrollCalculator } from './src/services/payroll/components/PayrollCalculator';

// Configuration
const EMPLOYEE_CODE = 'B0073';
const PERIOD_MONTH = 3; // March
const PERIOD_YEAR = 2026;

async function debugEmployee() {
    console.log('='.repeat(80));
    console.log(`DEBUGGING EMPLOYEE: ${EMPLOYEE_CODE}`);
    console.log(`PERIOD: ${PERIOD_MONTH}/${PERIOD_YEAR}`);
    console.log('='.repeat(80));
    console.log('');

    try {
        const db = Database.getInstance();

        // Step 1: Get employee basic data from HR_GANGLN
        console.log('📋 STEP 1: Employee Basic Data (HR_GANGLN)');
        console.log('-'.repeat(80));
        
        const empQuery = `
            SELECT EmpCode, EmpName, LocCode, GangCode, PayRate
            FROM HR_GANGLN
            WHERE EmpCode = ?
        `;
        const empResult = await db.query(empQuery, [EMPLOYEE_CODE]);
        
        if (!empResult.success || !empResult.data?.recordset?.length) {
            console.log('❌ Employee not found in HR_GANGLN');
            return;
        }
        
        const emp = empResult.data.recordset[0];
        console.log(`EmpCode: ${emp.EmpCode}`);
        console.log(`EmpName: ${emp.EmpName}`);
        console.log(`LocCode: ${emp.LocCode}`);
        console.log(`GangCode: ${emp.GangCode}`);
        console.log(`PayRate: ${emp.PayRate}`);
        console.log('');

        // Step 2: Get attendance data (PR_TASKREGLN)
        console.log('📋 STEP 2: Attendance Data (PR_TASKREGLN)');
        console.log('-'.repeat(80));
        
        const attQuery = `
            SELECT 
                EmpCode,
                PeriodMonth,
                PeriodYear,
                COUNT(*) as TotalDays,
                SUM(HK) as TotalHK,
                SUM(Amount) as TotalAmount
            FROM PR_TASKREGLN
            WHERE EmpCode = ? AND PeriodMonth = ? AND PeriodYear = ?
            GROUP BY EmpCode, PeriodMonth, PeriodYear
        `;
        const attResult = await db.query(attQuery, [EMPLOYEE_CODE, PERIOD_MONTH, PERIOD_YEAR]);
        
        const attData = attResult.data?.recordset?.[0] || {};
        console.log(`Total Days: ${attData.TotalDays || 0}`);
        console.log(`Total HK: ${attData.TotalHK || 0}`);
        console.log(`Total Amount: ${attData.TotalAmount || 0}`);
        console.log('');

        // Step 3: Get BERAS (rice allowance)
        console.log('📋 STEP 3: BERAS Allowance (PR_ADTRANS)');
        console.log('-'.repeat(80));
        
        const berasQuery = `
            SELECT 
                EmpCode,
                PeriodMonth,
                PeriodYear,
                SUM(Amount) as TotalBeras
            FROM PR_ADTRANS
            WHERE EmpCode = ? AND PeriodMonth = ? AND PeriodYear = ?
                AND TaskDesc LIKE '%BERAS%'
            GROUP BY EmpCode, PeriodMonth, PeriodYear
        `;
        const berasResult = await db.query(berasQuery, [EMPLOYEE_CODE, PERIOD_MONTH, PERIOD_YEAR]);
        
        const berasAmount = berasResult.data?.recordset?.[0]?.TotalBeras || 0;
        console.log(`Beras Total: ${berasAmount}`);
        console.log('');

        // Step 4: Get JABATAN (position allowance)
        console.log('📋 STEP 4: JABATAN Allowance (PR_ADTRANS)');
        console.log('-'.repeat(80));
        
        const jabatanQuery = `
            SELECT 
                EmpCode,
                PeriodMonth,
                PeriodYear,
                SUM(Amount) as TotalJabatan
            FROM PR_ADTRANS
            WHERE EmpCode = ? AND PeriodMonth = ? AND PeriodYear = ?
                AND TaskDesc LIKE '%JABATAN%'
            GROUP BY EmpCode, PeriodMonth, PeriodYear
        `;
        const jabatanResult = await db.query(jabatanQuery, [EMPLOYEE_CODE, PERIOD_MONTH, PERIOD_YEAR]);
        
        const jabatanAmount = jabatanResult.data?.recordset?.[0]?.TotalJabatan || 0;
        console.log(`Jabatan Total: ${jabatanAmount}`);
        console.log('');

        // Step 5: Get MASA KERJA (service years allowance)
        console.log('📋 STEP 5: MASA KERJA Allowance (PR_ADTRANS)');
        console.log('-'.repeat(80));
        
        const masaKerjaQuery = `
            SELECT 
                EmpCode,
                PeriodMonth,
                PeriodYear,
                SUM(Amount) as TotalMasaKerja
            FROM PR_ADTRANS
            WHERE EmpCode = ? AND PeriodMonth = ? AND PeriodYear = ?
                AND TaskDesc LIKE '%MASA KERJA%'
            GROUP BY EmpCode, PeriodMonth, PeriodYear
        `;
        const masaKerjaResult = await db.query(masaKerjaQuery, [EMPLOYEE_CODE, PERIOD_MONTH, PERIOD_YEAR]);
        
        const masaKerjaAmount = masaKerjaResult.data?.recordset?.[0]?.TotalMasaKerja || 0;
        console.log(`Masa Kerja Total: ${masaKerjaAmount}`);
        console.log('');

        // Step 6: Get LEMBUR (overtime)
        console.log('📋 STEP 6: LEMBUR/Overtime (PR_TASKREGLN where OT=1)');
        console.log('-'.repeat(80));
        
        const lemburQuery = `
            SELECT 
                EmpCode,
                PeriodMonth,
                PeriodYear,
                SUM(Jumlah) as TotalLemburJumlah,
                SUM(Jam) as TotalLemburJam
            FROM PR_TASKREGLN
            WHERE EmpCode = ? AND PeriodMonth = ? AND PeriodYear = ? AND OT = 1
            GROUP BY EmpCode, PeriodMonth, PeriodYear
        `;
        const lemburResult = await db.query(lemburQuery, [EMPLOYEE_CODE, PERIOD_MONTH, PERIOD_YEAR]);
        
        const lemburJumlah = lemburResult.data?.recordset?.[0]?.TotalLemburJumlah || 0;
        const lemburJam = lemburResult.data?.recordset?.[0]?.TotalLemburJam || 0;
        console.log(`Lembur Amount: ${lemburJumlah}`);
        console.log(`Lembur Hours: ${lemburJam}`);
        console.log('');

        // Step 7: Get PREMI (premiums/bonuses)
        console.log('📋 STEP 7: PREMI/Premiums (PR_ADTRANS)');
        console.log('-'.repeat(80));
        
        const premiQuery = `
            SELECT 
                TaskDesc,
                SUM(Amount) as Amount
            FROM PR_ADTRANS
            WHERE EmpCode = ? AND PeriodMonth = ? AND PeriodYear = ?
                AND (TaskDesc LIKE '%PREMI%' OR TaskDesc LIKE '%LOOSE%')
                AND TaskDesc NOT LIKE '%KOREKSI%'
            GROUP BY TaskDesc
        `;
        const premiResult = await db.query(premiQuery, [EMPLOYEE_CODE, PERIOD_MONTH, PERIOD_YEAR]);
        
        let totalPremi = 0;
        const premiDetails: any[] = premiResult.data?.recordset || [];
        premiDetails.forEach((p: any) => {
            console.log(`  ${p.TaskDesc}: ${p.Amount}`);
            totalPremi += p.Amount;
        });
        console.log(`Total Premi: ${totalPremi}`);
        console.log('');

        // Step 8: Get KOREKSI (corrections/deductions)
        console.log('📋 STEP 8: KOREKSI/Corrections (PR_ADTRANS)');
        console.log('-'.repeat(80));
        
        const koreksiQuery = `
            SELECT 
                TaskDesc,
                SUM(Amount) as Amount
            FROM PR_ADTRANS
            WHERE EmpCode = ? AND PeriodMonth = ? AND PeriodYear = ?
                AND TaskDesc LIKE '%KOREKSI%'
            GROUP BY TaskDesc
        `;
        const koreksiResult = await db.query(koreksiQuery, [EMPLOYEE_CODE, PERIOD_MONTH, PERIOD_YEAR]);
        
        let totalKoreksi = 0;
        const koreksiDetails: any[] = koreksiResult.data?.recordset || [];
        koreksiDetails.forEach((k: any) => {
            console.log(`  ${k.TaskDesc}: ${k.Amount}`);
            totalKoreksi += Math.abs(k.Amount);
        });
        console.log(`Total Koreksi (abs): ${totalKoreksi}`);
        console.log('');

        // Step 9: Calculate manually
        console.log('='.repeat(80));
        console.log('📊 MANUAL CALCULATION');
        console.log('='.repeat(80));
        
        const hk = attData.TotalHK || 0;
        const payRate = emp.PayRate || 0;
        const berasRate = hk > 0 ? berasAmount / hk : 0;
        
        const gaji_pokok_aktual = attData.TotalAmount || 0;
        const beras_jumlah = berasAmount;
        const jabatan_jumlah = jabatanAmount;
        const masa_kerja_jumlah = masaKerjaAmount;
        const total_tunjangan = beras_jumlah + jabatan_jumlah + masa_kerja_jumlah;
        const lembur_jumlah = lemburJumlah;
        const total_premi = totalPremi;
        const pot_koreksi = totalKoreksi;
        
        console.log('');
        console.log('Components:');
        console.log(`  Gaji Pokok Aktual:    ${gaji_pokok_aktual.toLocaleString('id-ID')}`);
        console.log(`  Beras Jumlah:         ${beras_jumlah.toLocaleString('id-ID')} (${berasRate.toFixed(2)}/hari × ${hk} hari)`);
        console.log(`  Jabatan Jumlah:       ${jabatan_jumlah.toLocaleString('id-ID')}`);
        console.log(`  Masa Kerja Jumlah:    ${masa_kerja_jumlah.toLocaleString('id-ID')}`);
        console.log(`  ─────────────────────────────────────`);
        console.log(`  Total Tunjangan:      ${total_tunjangan.toLocaleString('id-ID')}`);
        console.log('');
        console.log(`  Lembur Jumlah:        ${lembur_jumlah.toLocaleString('id-ID')}`);
        console.log(`  Total Premi:          ${total_premi.toLocaleString('id-ID')}`);
        console.log(`  Pot Koreksi:          -${pot_koreksi.toLocaleString('id-ID')}`);
        console.log('');
        
        // Calculate UPAH KOTOR (base gross)
        const upah_kotor = gaji_pokok_aktual + total_tunjangan + total_premi;
        console.log('UPAH KOTOR = Gaji Pokok + Total Tunjangan + Total Premi');
        console.log(`  = ${gaji_pokok_aktual.toLocaleString('id-ID')} + ${total_tunjangan.toLocaleString('id-ID')} + ${total_premi.toLocaleString('id-ID')}`);
        console.log(`  = ${upah_kotor.toLocaleString('id-ID')}`);
        console.log('');
        
        // Calculate JUMLAH UPAH KOTOR (display gross)
        const jumlah_upah_kotor = upah_kotor + lembur_jumlah - pot_koreksi;
        console.log('JUMLAH UPAH KOTOR = UPAH KOTOR + Lembur - Koreksi');
        console.log(`  = ${upah_kotor.toLocaleString('id-ID')} + ${lembur_jumlah.toLocaleString('id-ID')} - ${pot_koreksi.toLocaleString('id-ID')}`);
        console.log(`  = ${jumlah_upah_kotor.toLocaleString('id-ID')}`);
        console.log('');
        
        console.log('='.repeat(80));
        console.log(`EXPECTED: 8,894,750`);
        console.log(`CALCULATED: ${jumlah_upah_kotor.toLocaleString('id-ID')}`);
        const diff = jumlah_upah_kotor - 8894750;
        console.log(`DIFFERENCE: ${diff > 0 ? '+' : ''}${diff.toLocaleString('id-ID')}`);
        console.log('='.repeat(80));
        console.log('');
        
        // Step 10: Calculate using PayrollCalculator
        console.log('📊 PAYROLLCALCULATOR RESULT');
        console.log('-'.repeat(80));
        
        const calcResult = PayrollCalculator.calculate({
            gaji_pokok_aktual,
            beras_jumlah,
            jabatan_jumlah,
            masa_kerja_jumlah,
            lembur_jumlah,
            total_tunjangan,
            total_premi,
            pot_koreksi: -pot_koreksi, // Negate because it's a deduction
            pendapatan_lainnya: 0,
            pot_astek_pekerja: 0,
            pot_bpjs_kesehatan_pekerja: 0,
            pot_bpjs_pensiun_pekerja: 0,
            pot_spsi: 0,
            pot_pph21: 0,
            other_potongan: 0,
            pot_premi_pph: 0,
            astek_majikan: 0,
            bpjs_majikan: 0,
        }, '-');
        
        console.log(`Jumlah Upah Kotor: ${calcResult.jumlah_upah_kotor.toLocaleString('id-ID')}`);
        console.log(`Upah Kotor: ${calcResult.upah_kotor.toLocaleString('id-ID')}`);
        console.log(`Komponen breakdown:`);
        console.log(`  Gaji Pokok: ${calcResult.komponen_kotor.gaji_pokok.toLocaleString('id-ID')}`);
        console.log(`  Tunjangan: ${calcResult.komponen_kotor.tunjangan.toLocaleString('id-ID')}`);
        console.log(`  Lembur: ${calcResult.komponen_kotor.lembur.toLocaleString('id-ID')}`);
        console.log(`  Premi: ${calcResult.komponen_kotor.premi.toLocaleString('id-ID')}`);
        console.log(`  Koreksi: ${calcResult.komponen_kotor.koreksi.toLocaleString('id-ID')}`);
        console.log(`  Subtotal: ${calcResult.komponen_kotor.subtotal.toLocaleString('id-ID')}`);
        console.log(`  Grand Subtotal: ${calcResult.komponen_kotor.grand_subtotal.toLocaleString('id-ID')}`);
        console.log('');
        
        // Check for PENDAPATAN LAINNYA
        console.log('📋 STEP 11: Check PENDAPATAN LAINNYA (THR, Bonus, Custom)');
        console.log('-'.repeat(80));
        
        const otherIncomeQuery = `
            SELECT 
                income_type,
                SUM(amount) as TotalAmount
            FROM other_incomes
            WHERE emp_code = ? AND YEAR(tanggal) = ? AND MONTH(tanggal) = ?
            GROUP BY income_type
        `;
        const otherIncomeResult = await db.query(otherIncomeQuery, [EMPLOYEE_CODE, PERIOD_YEAR, PERIOD_MONTH]);
        
        let totalPendapatanLainnya = 0;
        const otherIncomes: any[] = otherIncomeResult.data?.recordset || [];
        if (otherIncomes.length > 0) {
            otherIncomes.forEach((oi: any) => {
                console.log(`  ${oi.income_type}: ${oi.TotalAmount}`);
                totalPendapatanLainnya += oi.TotalAmount;
            });
            console.log(`  Total Pendapatan Lainnya: ${totalPendapatanLainnya}`);
        } else {
            console.log('  No other income found');
        }
        console.log('');
        
        // Final calculation with pendapatan lainnya
        const finalJumlahUpahKotor = jumlah_upah_kotor + totalPendapatanLainnya;
        console.log('='.repeat(80));
        console.log('🎯 FINAL CALCULATION');
        console.log('='.repeat(80));
        console.log(`JUMLAH UPAH KOTOR (base): ${jumlah_upah_kotor.toLocaleString('id-ID')}`);
        console.log(`+ Pendapatan Lainnya: ${totalPendapatanLainnya.toLocaleString('id-ID')}`);
        console.log(`= FINAL JUMLAH UPAH KOTOR: ${finalJumlahUpahKotor.toLocaleString('id-ID')}`);
        console.log('');
        console.log(`EXPECTED: 8,894,750`);
        const finalDiff = finalJumlahUpahKotor - 8894750;
        console.log(`DIFFERENCE: ${finalDiff > 0 ? '+' : ''}${finalDiff.toLocaleString('id-ID')}`);
        console.log('='.repeat(80));
        
        if (Math.abs(finalDiff) > 0) {
            console.log('');
            console.log('⚠️  DISCREPANCY DETECTED!');
            console.log('Possible causes:');
            console.log('  1. Missing data from database queries');
            console.log('  2. Different calculation logic in actual system');
            console.log('  3. Additional allowances/deductions not queried');
            console.log('  4. Data from different period or tables');
            console.log('');
            console.log('Next steps:');
            console.log('  - Check actual payroll query used in dataExtractorService');
            console.log('  - Verify all components are included');
            console.log('  - Check if there are additional dynamic columns');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
        if (error instanceof Error) {
            console.error('Message:', error.message);
            console.error('Stack:', error.stack);
        }
    }
}

// Run the debug
debugEmployee().then(() => {
    console.log('\n✅ Debug completed');
    process.exit(0);
}).catch((error) => {
    console.error('\n❌ Debug failed:', error);
    process.exit(1);
});
