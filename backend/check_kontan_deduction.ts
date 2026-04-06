/**
 * Check if KONTAN is properly deducted in upah_bersih
 */

async function checkKontanDeduction() {
    console.log('🔍 Checking KONTAN deduction in upah_bersih...\n');

    try {
        const { dataExtractorService } = await import('./src/services/dataExtractorService');

        const result = await dataExtractorService.extractPayrollData(
            3, 2026, 'G1H', 'AB1', null, 'SERVER_PROFILE_2', false, null, null, true
        );

        console.log(`📊 Total employees: ${result.data_rows.length}\n`);

        // Check first employee structure for KONTAN
        const firstEmp = result.data_rows[0];
        console.log('📋 First employee potongan fields:');
        Object.keys(firstEmp).forEach(key => {
            if (key.toLowerCase().includes('kontan') || key.toLowerCase().includes('koreksi')) {
                console.log(`  ${key}: ${Number(firstEmp[key] || 0).toLocaleString('id-ID')}`);
            }
        });
        console.log('');

        // Check potongan_upah_kotor structure
        if (firstEmp.potongan_upah_kotor) {
            console.log('📋 potongan_upah_kotor structure:');
            console.log(`  Type: ${typeof firstEmp.potongan_upah_kotor}`);
            if (typeof firstEmp.potongan_upah_kotor === 'object') {
                console.log(`  Keys: ${Object.keys(firstEmp.potongan_upah_kotor).join(', ')}`);
                console.log(`  Has KONTAN: ${firstEmp.potongan_upah_kotor.pot_kontan || firstEmp.potongan_upah_kotor.KONTAN || 'NO'}`);
            }
            console.log('');
        }

        // Sum ALL potongan-related fields
        console.log('🧮 Summing ALL potongan-related fields for all employees:\n');
        
        let total_pot_kontan = 0;
        let total_pot_koreksi = 0;
        let total_pot_pph21 = 0;
        let total_pot_astek = 0;
        let total_pot_spsi = 0;
        let total_pot_pinjam = 0;
        let total_pot_bpjs_pekerja = 0;
        let total_potongan_lainnya = 0;

        result.data_rows.forEach((emp, idx) => {
            const kontan = Number(emp.pot_kontan || 0);
            const koreksi = Number(emp.pot_koreksi || 0);
            const pph21 = Number(emp.pot_pph21 || 0);
            const astek = Number(emp.pot_astek || 0);
            const spsi = Number(emp.pot_spsi || 0);
            const pinjam = Number(emp.pot_pinjam || 0);
            const bpjsPek = Number(emp.pot_bpjs_pekerja_total || 0);

            total_pot_kontan += kontan;
            total_pot_koreksi += koreksi;
            total_pot_pph21 += pph21;
            total_pot_astek += astek;
            total_pot_spsi += spsi;
            total_pot_pinjam += pinjam;
            total_pot_bpjs_pekerja += bpjsPek;

            // Show if kontan > 0
            if (kontan > 0 && idx < 10) {
                console.log(`  ${idx + 1}. ${emp.nama?.substring(0, 30).padEnd(30)} | pot_kontan: ${kontan.toLocaleString('id-ID').padStart(10)}`);
            }
        });

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 TOTAL POTONGAN FIELDS:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`  pot_kontan:            ${Math.round(total_pot_kontan).toLocaleString('id-ID')}`);
        console.log(`  pot_koreksi:           ${Math.round(total_pot_koreksi).toLocaleString('id-ID')}`);
        console.log(`  pot_pph21:             ${Math.round(total_pot_pph21).toLocaleString('id-ID')}`);
        console.log(`  pot_astek:             ${Math.round(total_pot_astek).toLocaleString('id-ID')}`);
        console.log(`  pot_spsi:              ${Math.round(total_pot_spsi).toLocaleString('id-ID')}`);
        console.log(`  pot_pinjam:            ${Math.round(total_pot_pinjam).toLocaleString('id-ID')}`);
        console.log(`  pot_bpjs_pekerja_total: ${Math.round(total_pot_bpjs_pekerja).toLocaleString('id-ID')}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Check if total_potongan already includes pot_kontan
        let total_potongan_from_employees = 0;
        result.data_rows.forEach(emp => {
            total_potongan_from_employees += Number(emp.total_potongan || 0);
        });

        console.log('🔍 COMPARISON:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`  total_potongan (from employees): ${Math.round(total_potongan_from_employees).toLocaleString('id-ID')}`);
        console.log(`  Sum of individual potongan:      ${Math.round(total_pot_kontan + total_pot_koreksi + total_pot_pph21 + total_pot_astek + total_pot_spsi + total_pot_pinjam + total_pot_bpjs_pekerja).toLocaleString('id-ID')}`);
        console.log('');

        // Calculate: jumlah_upah_kotor - total_potongan - pot_kontan (if not included)
        let total_juk = 0;
        result.data_rows.forEach(emp => {
            total_juk += Number(emp.jumlah_upah_kotor || 0);
        });

        console.log('🧮 If KONTAN is NOT included in total_potongan:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`  jumlah_upah_kotor:              ${Math.round(total_juk).toLocaleString('id-ID')}`);
        console.log(`  - total_potongan:               ${Math.round(total_potongan_from_employees).toLocaleString('id-ID')}`);
        console.log(`  - pot_kontan (additional):      ${Math.round(total_pot_kontan).toLocaleString('id-ID')}`);
        console.log(`  = Result:                       ${(Math.round(total_juk) - Math.round(total_potongan_from_employees) - Math.round(total_pot_kontan)).toLocaleString('id-ID')}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        console.log('🧮 If KONTAN IS included in total_potongan:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`  jumlah_upah_kotor:              ${Math.round(total_juk).toLocaleString('id-ID')}`);
        console.log(`  - total_potongan:               ${Math.round(total_potongan_from_employees).toLocaleString('id-ID')}`);
        console.log(`  = Result:                       ${(Math.round(total_juk) - Math.round(total_potongan_from_employees)).toLocaleString('id-ID')}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        const expected = 176414884;
        const actualSum = result.data_rows.reduce((sum, emp) => sum + Number(emp.upah_bersih || 0), 0);

        console.log('🎯 TARGET COMPARISON:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`  Expected (frontend):             ${expected.toLocaleString('id-ID')}`);
        console.log(`  Actual sum of upah_bersih:       ${Math.round(actualSum).toLocaleString('id-ID')}`);
        console.log(`  If subtract KONTAN:              ${(Math.round(actualSum) - Math.round(total_pot_kontan)).toLocaleString('id-ID')}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Check if subtracting KONTAN makes it match
        const withKontanSubtracted = Math.round(actualSum) - Math.round(total_pot_kontan);
        if (withKontanSubtracted === expected) {
            console.log('✅✅✅ FOUND IT! KONTAN is being DOUBLE-DUCTED!');
            console.log('   - Backend already includes KONTAN in upah_bersih');
            console.log('   - Frontend is subtracting KONTAN AGAIN from the sum');
            console.log('   - This causes the 2.6M difference!');
        } else {
            console.log(`❌ Not a direct match. Difference: ${(withKontanSubtracted - expected).toLocaleString('id-ID')}`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }

    process.exit(0);
}

checkKontanDeduction();
