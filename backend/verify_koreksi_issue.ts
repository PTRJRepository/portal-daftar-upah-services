/**
 * Verify: Koreksi is causing double counting
 */

async function verifyKoreksiIssue() {
    console.log('🔬 Verifying Koreksi double counting issue...\n');

    try {
        const { dataExtractorService } = await import('./src/services/dataExtractorService');

        const result = await dataExtractorService.extractPayrollData(
            3, 2026, 'G1H', 'AB1', null, 'SERVER_PROFILE_2', false, null, null, true
        );

        let totalJuk = 0;
        let totalPotongan = 0;
        let totalUpahBersih = 0;
        let totalKoreksi = 0;
        let totalPremiKoreksi = 0;
        let totalKoreksiPanen = 0;
        let totalPendapatanKontan = 0;

        result.data_rows.forEach((emp, idx) => {
            const juk = Number(emp.jumlah_upah_kotor || 0);
            const pot = Number(emp.total_potongan || 0);
            const ub = Number(emp.upah_bersih || 0);
            const koreksi = Number(emp.pot_koreksi || 0);
            const premiKoreksi = Number(emp.premi_koreksi || 0);
            const koreksiPanen = Number(emp.KOREKSI_PANEN || 0);
            const pendapatanKontan = Number(emp.pendapatan_kontan || 0);

            totalJuk += juk;
            totalPotongan += pot;
            totalUpahBersih += ub;
            totalKoreksi += koreksi;
            totalPremiKoreksi += premiKoreksi;
            totalKoreksiPanen += koreksiPanen;
            totalPendapatanKontan += pendapatanKontan;

            // Show first 3 employees with koreksi
            if ((koreksi > 0 || premiKoreksi > 0 || koreksiPanen > 0) && idx < 5) {
                console.log(`Employee ${idx + 1}: ${emp.nama?.substring(0, 30)}`);
                console.log(`  jumlah_upah_kotor: ${juk.toLocaleString('id-ID')}`);
                console.log(`  total_potongan:    ${pot.toLocaleString('id-ID')}`);
                console.log(`  upah_bersih:       ${ub.toLocaleString('id-ID')}`);
                console.log(`  pot_koreksi:       ${koreksi.toLocaleString('id-ID')}`);
                console.log(`  premi_koreksi:     ${premiKoreksi.toLocaleString('id-ID')}`);
                console.log(`  KOREKSI_PANEN:     ${koreksiPanen.toLocaleString('id-ID')}`);
                console.log(`  pendapatan_kontan: ${pendapatanKontan.toLocaleString('id-ID')}`);
                console.log('');
            }
        });

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 TOTALS:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`  jumlah_upah_kotor:        ${Math.round(totalJuk).toLocaleString('id-ID')}`);
        console.log(`  total_potongan:           ${Math.round(totalPotongan).toLocaleString('id-ID')}`);
        console.log(`  upah_bersih (current):    ${Math.round(totalUpahBersih).toLocaleString('id-ID')}`);
        console.log('');
        console.log(`  pot_koreksi:              ${Math.round(totalKoreksi).toLocaleString('id-ID')}`);
        console.log(`  premi_koreksi:            ${Math.round(totalPremiKoreksi).toLocaleString('id-ID')}`);
        console.log(`  KOREKSI_PANEN:            ${Math.round(totalKoreksiPanen).toLocaleString('id-ID')}`);
        console.log(`  ALL KOREKSI:              ${Math.round(totalKoreksi + totalPremiKoreksi).toLocaleString('id-ID')}`);
        console.log(`  pendapatan_kontan:        ${Math.round(totalPendapatanKontan).toLocaleString('id-ID')}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Formulas
        const formula1 = Math.round(totalJuk) - Math.round(totalPotongan);
        const formula2 = formula1 - Math.round(totalKoreksi);  // Subtract koreksi
        const formula3 = formula1 - Math.round(totalKoreksi + totalPremiKoreksi);  // Subtract ALL koreksi
        const formula4 = formula1 - Math.round(totalKoreksi + totalPremiKoreksi + totalPendapatanKontan);  // Subtract koreksi + kontan

        console.log('🧮 FORMULA TESTS:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`  Formula 1 (juk - pot):              ${formula1.toLocaleString('id-ID')}`);
        console.log(`  Formula 2 (f1 - koreksi):           ${formula2.toLocaleString('id-ID')} | Diff from expected: ${(formula2 - 176414884).toLocaleString('id-ID')}`);
        console.log(`  Formula 3 (f1 - all koreksi):       ${formula3.toLocaleString('id-ID')} | Diff from expected: ${(formula3 - 176414884).toLocaleString('id-ID')}`);
        console.log(`  Formula 4 (f1 - koreksi+kontan):    ${formula4.toLocaleString('id-ID')} | Diff from expected: ${(formula4 - 176414884).toLocaleString('id-ID')}`);
        console.log('');
        console.log(`  Expected:                           176.414.884`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        if (formula3 === 176414884) {
            console.log('✅✅✅ FOUND IT! Formula 3 MATCHES!');
            console.log('');
            console.log('The issue is:');
            console.log('  1. KOREKSI_PANEN is ADDED to jumlah_upah_kotor (+1,302,635)');
            console.log('  2. premi_koreksi is ADDED to total_premi (+1,302,635)');
            console.log('  3. BOTH are included in jumlah_upah_kotor');
            console.log('  4. But they are NOT SUBTRACTED in total_potongan');
            console.log('  5. So upah_bersih is OVERSTATED by 2,605,270');
            console.log('');
            console.log('Solution:');
            console.log('  - Backend calculator must SUBTRACT ALL KOREKSI from upah_bersih');
            console.log('  - Or total_potongan must INCLUDE koreksi');
        } else if (formula2 === 176414884) {
            console.log('✅✅✅ Formula 2 MATCHES!');
            console.log('  - Only pot_koreksi needs to be subtracted');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }

    process.exit(0);
}

verifyKoreksiIssue();
