/**
 * Deep comparison script to find WHERE the 1.48% difference comes from
 * Compare each employee and each field to find discrepancy
 */

async function deepComparison() {
    console.log('🔬 Deep Comparison: Finding source of 1.48% difference...\n');

    try {
        const { dataExtractorService } = await import('./src/services/dataExtractorService');
        const { calculatePayrollTotals } = await import('./src/services/payrollTotalsCalculator');

        // Get data
        const result = await dataExtractorService.extractPayrollData(
            3, 2026, 'G1H', 'AB1', null, 'SERVER_PROFILE_2', false, null, null, true
        );

        console.log(`📊 Total employees from backend: ${result.data_rows.length}`);
        console.log(`📊 Total hari_kerja: ${result.data_rows.reduce((sum, e) => sum + Number(e.hari_kerja || 0), 0)}\n`);

        // Check if data has nested structures
        const firstEmp = result.data_rows[0];
        console.log('🔍 Checking data structure:');
        console.log(`  - Has premi (nested): ${firstEmp.premi && typeof firstEmp.premi === 'object' ? 'YES' : 'NO (flat)'}`);
        console.log(`  - Has potongan_upah_kotor (nested): ${firstEmp.potongan_upah_kotor && typeof firstEmp.potongan_upah_kotor === 'object' ? 'YES' : 'NO (flat)'}`);
        console.log(`  - Has potongan_upah_bersih (nested): ${firstEmp.potongan_upah_bersih && typeof firstEmp.potongan_upah_bersih === 'object' ? 'YES' : 'NO (flat)'}`);
        console.log(`  - Has other_incomes (array): ${Array.isArray(firstEmp.other_incomes) ? 'YES' : 'NO'}\n`);

        // Show first employee structure
        console.log('📋 First employee key fields:');
        const keyFields = ['nama', 'nik', 'hari_kerja', 'jumlah_hk', 'gaji_pokok', 'total_tunjangan', 'total_premi', 
                          'jumlah_upah_kotor', 'total_potongan', 'upah_bersih', 'pot_koreksi', 'pendapatan_lainnya'];
        keyFields.forEach(field => {
            const val = firstEmp[field];
            if (val !== undefined && val !== null) {
                console.log(`  ${field}: ${typeof val === 'number' ? val.toLocaleString('id-ID') : val}`);
            }
        });
        console.log('');

        // Check for other_incomes in first employee
        if (firstEmp.other_incomes && Array.isArray(firstEmp.other_incomes) && firstEmp.other_incomes.length > 0) {
            console.log('💰 First employee other_incomes:');
            firstEmp.other_incomes.forEach(oi => {
                console.log(`  - Type: ${oi.type}, Amount: ${Number(oi.amount || 0).toLocaleString('id-ID')}`);
            });
            console.log('');
        }

        // Check for nested premi
        if (firstEmp.premi && typeof firstEmp.premi === 'object') {
            console.log('💰 First employee premi (nested):');
            Object.entries(firstEmp.premi).forEach(([key, val]) => {
                console.log(`  - ${key}: ${Number(val || 0).toLocaleString('id-ID')}`);
            });
            console.log('');
        }

        // Calculate totals using backend calculator
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        const backendTotals = calculatePayrollTotals(result.data_rows, 'TOTAL G1H');
        console.log('✅ Backend calculator (with hari_kerja > 0 filter):');
        console.log(`  upah_bersih: ${backendTotals.upah_bersih.toLocaleString('id-ID')}`);
        console.log(`  hari_kerja: ${backendTotals.hari_kerja}`);
        console.log(`  gaji_pokok: ${backendTotals.gaji_pokok.toLocaleString('id-ID')}`);
        console.log(`  total_premi: ${backendTotals.total_premi.toLocaleString('id-ID')}`);
        console.log(`  total_potongan: ${backendTotals.total_potongan.toLocaleString('id-ID')}`);
        console.log(`  jumlah_upah_kotor: ${backendTotals.jumlah_upah_kotor.toLocaleString('id-ID')}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Manual calculation to verify
        console.log('🧮 Manual verification (sum each field individually):');
        const employees = result.data_rows; // All have hari_kerja > 0 based on earlier check

        const manualSum = (field) => {
            const sum = employees.reduce((total, emp) => {
                const val = Number(emp[field] || 0);
                return total + val;
            }, 0);
            return Math.round(sum);
        };

        console.log(`  gaji_pokok: ${manualSum('gaji_pokok').toLocaleString('id-ID')}`);
        console.log(`  beras_jumlah: ${manualSum('beras_jumlah').toLocaleString('id-ID')}`);
        console.log(`  jabatan_jumlah: ${manualSum('jabatan_jumlah').toLocaleString('id-ID')}`);
        console.log(`  masa_kerja_jumlah: ${manualSum('masa_kerja_jumlah').toLocaleString('id-ID')}`);
        console.log(`  lembur_jumlah: ${manualSum('lembur_jumlah').toLocaleString('id-ID')}`);
        console.log(`  total_tunjangan: ${manualSum('total_tunjangan').toLocaleString('id-ID')}`);
        console.log(`  premi_brondol: ${manualSum('premi_brondol').toLocaleString('id-ID')}`);
        console.log(`  total_premi: ${manualSum('total_premi').toLocaleString('id-ID')}`);
        console.log(`  pot_koreksi: ${manualSum('pot_koreksi').toLocaleString('id-ID')}`);
        console.log(`  jumlah_upah_kotor: ${manualSum('jumlah_upah_kotor').toLocaleString('id-ID')}`);
        console.log(`  pot_pph21: ${manualSum('pot_pph21').toLocaleString('id-ID')}`);
        console.log(`  total_potongan: ${manualSum('total_potongan').toLocaleString('id-ID')}`);
        console.log(`  upah_bersih: ${manualSum('upah_bersih').toLocaleString('id-ID')}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Expected vs Actual
        const expected = 176414884;
        const actual = backendTotals.upah_bersih;

        console.log('🎯 Final Comparison:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Expected (from where?): ${expected.toLocaleString('id-ID')}`);
        console.log(`Backend calculates:     ${actual.toLocaleString('id-ID')}`);
        console.log(`Difference:             ${(actual - expected).toLocaleString('id-ID')} (${((actual - expected) / expected * 100).toFixed(2)}%)`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // List ALL employee upah_bersih values
        console.log('📋 All employees upah_bersih:');
        employees.forEach((emp, idx) => {
            const ub = Number(emp.upah_bersih || 0);
            const hk = Number(emp.hari_kerja || emp.kehadiran || 0);
            console.log(`  ${idx + 1}. ${emp.nama?.substring(0, 30).padEnd(30)} | HK: ${hk.toString().padStart(2)} | upah_bersih: ${ub.toLocaleString('id-ID').padStart(12)}`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
        if (error instanceof Error) {
            console.error('Error message:', error.message);
        }
    }

    process.exit(0);
}

deepComparison();
