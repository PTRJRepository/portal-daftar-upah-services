/**
 * Test: Replicate EXACT frontend calculation using PayrollAggregator._sumRows logic
 * Frontend does NOT filter by jumlah_hk > 0 in _sumRows!
 * _sumRows sums ALL rows, then filter happens in flattenData
 */

async function testFrontendLogic() {
    console.log('🧪 Replicating EXACT frontend _sumRows logic...\n');

    try {
        const { dataExtractorService } = await import('./src/services/dataExtractorService');
        const { calculatePayrollTotals } = await import('./src/services/payrollTotalsCalculator');

        // Get data (simulating what frontend receives)
        const result = await dataExtractorService.extractPayrollData(
            3, 2026, 'G1H', 'AB1', null, 'SERVER_PROFILE_2', false, null, null, true
        );

        console.log(`📊 Backend returned: ${result.data_rows.length} employees\n`);

        // Check: Does data already have upah_bersih field at root level?
        const firstEmp = result.data_rows[0];
        console.log('📋 First employee structure:');
        console.log(`  nama: ${firstEmp.nama}`);
        console.log(`  jumlah_hk: ${firstEmp.jumlah_hk}`);
        console.log(`  hari_kerja: ${firstEmp.hari_kerja}`);
        console.log(`  upah_bersih (root): ${firstEmp.upah_bersih?.toLocaleString('id-ID')}`);
        console.log(`  jumlah_upah_kotor (root): ${firstEmp.jumlah_upah_kotor?.toLocaleString('id-ID')}`);
        console.log(`  total_potongan (root): ${firstEmp.total_potongan?.toLocaleString('id-ID')}`);
        console.log('');

        // Frontend _sumRows logic:
        // 1. Flatten nested objects
        // 2. Sum ALL numeric fields
        // 3. Does NOT filter (filtering happens in flattenData before _sumRows is called)
        
        console.log('🧮 Simulating frontend _sumRows (NO filter, sum ALL employees):\n');
        
        const employees = result.data_rows;
        let total_upah_bersih = 0;
        let total_jumlah_upah_kotor = 0;
        let total_potongan = 0;
        let total_gaji_pokok = 0;
        let total_premi = 0;
        let total_tunjangan = 0;
        let total_hari_kerja = 0;
        let total_jumlah_hk = 0;

        employees.forEach((emp, idx) => {
            const ub = Number(emp.upah_bersih || 0);
            const juk = Number(emp.jumlah_upah_kotor || 0);
            const tp = Number(emp.total_potongan || 0);
            const gp = Number(emp.gaji_pokok || 0);
            const pr = Number(emp.total_premi || 0);
            const tj = Number(emp.total_tunjangan || 0);
            const hk = Number(emp.hari_kerja || 0);
            const jhk = Number(emp.jumlah_hk || 0);

            total_upah_bersih += ub;
            total_jumlah_upah_kotor += juk;
            total_potongan += tp;
            total_gaji_pokok += gp;
            total_premi += pr;
            total_tunjangan += tj;
            total_hari_kerja += hk;
            total_jumlah_hk += jhk;

            console.log(`  ${idx + 1}. ${emp.nama?.substring(0, 30).padEnd(30)} | upah_bersih: ${ub.toLocaleString('id-ID').padStart(12)}`);
        });

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 FRONTEND _sumRows Result (NO ROUNDING YET):');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`  upah_bersih (raw sum):    ${total_upah_bersih.toLocaleString('id-ID')}`);
        console.log(`  upah_bersih (rounded):    ${Math.round(total_upah_bersih).toLocaleString('id-ID')}`);
        console.log(`  jumlah_upah_kotor:        ${Math.round(total_jumlah_upah_kotor).toLocaleString('id-ID')}`);
        console.log(`  total_potongan:           ${Math.round(total_potongan).toLocaleString('id-ID')}`);
        console.log(`  gaji_pokok:               ${Math.round(total_gaji_pokok).toLocaleString('id-ID')}`);
        console.log(`  total_premi:              ${Math.round(total_premi).toLocaleString('id-ID')}`);
        console.log(`  total_tunjangan:          ${Math.round(total_tunjangan).toLocaleString('id-ID')}`);
        console.log(`  hari_kerja:               ${Math.round(total_hari_kerja)}`);
        console.log(`  jumlah_hk:                ${Math.round(total_jumlah_hk)}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Backend calculator with jumlah_hk > 0 filter
        console.log('📊 BACKEND calculator (with jumlah_hk > 0 filter):');
        const backendTotals = calculatePayrollTotals(employees, 'TOTAL G1H');
        console.log(`  upah_bersih: ${backendTotals.upah_bersih.toLocaleString('id-ID')}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Expected
        const expected = 176414884;
        const frontendSum = Math.round(total_upah_bersih);
        const backendCalc = backendTotals.upah_bersih;

        console.log('🎯 FINAL COMPARISON:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Expected (frontend displays): ${expected.toLocaleString('id-ID')}`);
        console.log(`Frontend _sumRows (raw sum):  ${frontendSum.toLocaleString('id-ID')}`);
        console.log(`Backend calculator:           ${backendCalc.toLocaleString('id-ID')}`);
        console.log('');
        console.log(`Diff (frontend vs expected):  ${(frontendSum - expected).toLocaleString('id-ID')} (${((frontendSum - expected) / expected * 100).toFixed(2)}%)`);
        console.log(`Diff (backend vs expected):   ${(backendCalc - expected).toLocaleString('id-ID')} (${((backendCalc - expected) / expected * 100).toFixed(2)}%)`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Check: Are employee upah_bersih values ALREADY calculated by backend?
        // If yes, then the difference is in how backend calculates upah_bersih per employee
        console.log('🔍 KEY QUESTION: Where does the 1.48% difference come from?');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Sum of employee.upah_bersih:    ${frontendSum.toLocaleString('id-ID')}`);
        console.log(`Expected total:                 ${expected.toLocaleString('id-ID')}`);
        console.log('');
        console.log('If frontendSum == backendCalc:');
        console.log('  → Backend extractor produces DIFFERENT upah_bersih per employee');
        console.log('  → Backend calculator is summing correctly');
        console.log('  → The issue is in dataExtractorService, not payrollTotalsCalculator');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Manual formula check: upah_bersih = jumlah_upah_kotor - total_potongan + premi_pph
        console.log('🧮 Formula verification (upah_bersih = jumlah_upah_kotor - total_potongan + premi_pph):');
        let totalPremiPph = 0;
        employees.forEach(emp => {
            totalPremiPph += Number(emp.premi_pph || 0);
        });
        const formulaResult = Math.round(total_jumlah_upah_kotor) - Math.round(total_potongan) + Math.round(totalPremiPph);
        console.log(`  jumlah_upah_kotor total: ${Math.round(total_jumlah_upah_kotor).toLocaleString('id-ID')}`);
        console.log(`  total_potongan total:    ${Math.round(total_potongan).toLocaleString('id-ID')}`);
        console.log(`  premi_pph total:         ${Math.round(totalPremiPph).toLocaleString('id-ID')}`);
        console.log(`  Formula result:          ${formulaResult.toLocaleString('id-ID')}`);
        console.log(`  Actual upah_bersih sum:  ${frontendSum.toLocaleString('id-ID')}`);
        console.log(`  Match: ${formulaResult === frontendSum ? '✅ YES' : '❌ NO'}`);

    } catch (error) {
        console.error('❌ Error:', error);
    }

    process.exit(0);
}

testFrontendLogic();
