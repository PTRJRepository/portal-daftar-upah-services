/**
 * Deep dive: Find ALL deductions that could cause 2.6M difference
 * Check KONTAN, KOREKSI PANEN, and other fields
 */

async function findAllDeductions() {
    console.log('🔬 Deep Dive: Finding ALL deductions that could cause 2.6M difference...\n');

    try {
        const { dataExtractorService } = await import('./src/services/dataExtractorService');

        const result = await dataExtractorService.extractPayrollData(
            3, 2026, 'G1H', 'AB1', null, 'SERVER_PROFILE_2', false, null, null, true
        );

        console.log(`📊 Total employees: ${result.data_rows.length}\n`);

        // Check ALL numeric fields in first employee
        const firstEmp = result.data_rows[0];
        console.log('📋 ALL numeric fields in first employee:');
        const numericFields = [];
        Object.keys(firstEmp).forEach(key => {
            const val = firstEmp[key];
            if (typeof val === 'number' && val !== 0) {
                numericFields.push({ key, value: val });
                console.log(`  ${key}: ${val.toLocaleString('id-ID')}`);
            }
        });
        console.log('');

        // Sum EVERYTHING
        console.log('🧮 Summing ALL possible deduction fields across all employees:\n');

        const fieldSums: Record<string, number> = {};
        
        result.data_rows.forEach((emp, empIdx) => {
            Object.keys(emp).forEach(key => {
                const val = Number(emp[key] || 0);
                if (val !== 0 && typeof val === 'number' && isFinite(val)) {
                    if (!fieldSums[key]) fieldSums[key] = 0;
                    fieldSums[key] += val;
                }
            });
        });

        // Sort by total value (descending)
        const sortedFields = Object.entries(fieldSums)
            .filter(([key, val]) => {
                // Skip non-monetary fields
                if (['jumlah_hk', 'hari_kerja', 'masa_kerja_tahun', 'no', 'koreksi_hk', 'cuti_tahunan_hari', 'cuti_sakit_haid_hari', 'cuti_minggu_hari', 'cuti_nasional_hari'].includes(key)) {
                    return false;
                }
                return true;
            })
            .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 ALL FIELDS (sorted by total value):');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        sortedFields.forEach(([key, total]) => {
            const marker = key.toLowerCase().includes('kontan') || key.toLowerCase().includes('koreksi') ? ' ⚠️' : '';
            console.log(`  ${key.padEnd(40)}: ${Math.round(total).toLocaleString('id-ID').padStart(15)}${marker}`);
        });
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Focus on KONTAN and KOREKSI
        console.log('🔍 DEDICATED CHECK FOR KONTAN & KOREKSI:\n');
        
        let totalKontan = 0;
        let totalKoreksi = 0;
        let totalKoreksiPanen = 0;
        let totalPremiKoreksi = 0;
        
        result.data_rows.forEach((emp, idx) => {
            // Check all possible KONTAN fields
            const kontanFields = ['pot_kontan', 'kontan', 'KONTAN', 'potongan_kontan'];
            kontanFields.forEach(field => {
                const val = Number(emp[field] || 0);
                if (val > 0) {
                    totalKontan += val;
                    console.log(`  Employee ${idx + 1} - ${field}: ${val.toLocaleString('id-ID')}`);
                }
            });

            // Check all possible KOREKSI fields
            const koreksiFields = ['pot_koreksi', 'koreksi', 'KOREKSI', 'koreksi_hk', 'premi_koreksi'];
            koreksiFields.forEach(field => {
                const val = Number(emp[field] || 0);
                if (val > 0) {
                    totalKoreksi += val;
                    if (field === 'pot_koreksi') totalKoreksiPanen += val;
                    if (field === 'premi_koreksi') totalPremiKoreksi += val;
                }
            });

            // Check nested potongan_upah_kotor
            if (emp.potongan_upah_kotor && typeof emp.potongan_upah_kotor === 'object') {
                Object.entries(emp.potongan_upah_kotor).forEach(([key, val]) => {
                    if (key.toLowerCase().includes('kontan')) {
                        const v = Number(val || 0);
                        if (v > 0) {
                            totalKontan += v;
                            console.log(`  Employee ${idx + 1} - potongan_upah_kotor.${key}: ${v.toLocaleString('id-ID')}`);
                        }
                    }
                });
            }
        });

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 SUMMARY:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`  pot_kontan (total):         ${Math.round(totalKontan).toLocaleString('id-ID')}`);
        console.log(`  pot_koreksi (total):        ${Math.round(totalKoreksiPanen).toLocaleString('id-ID')}`);
        console.log(`  premi_koreksi (total):      ${Math.round(totalPremiKoreksi).toLocaleString('id-ID')}`);
        console.log(`  ALL KOREKSI (total):        ${Math.round(totalKoreksi).toLocaleString('id-ID')}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Calculate formula variations
        let totalJuk = 0;
        let totalPotongan = 0;
        let totalUpahBersih = 0;
        let totalPremiPph = 0;

        result.data_rows.forEach(emp => {
            totalJuk += Number(emp.jumlah_upah_kotor || 0);
            totalPotongan += Number(emp.total_potongan || 0);
            totalUpahBersih += Number(emp.upah_bersih || 0);
            totalPremiPph += Number(emp.premi_pph || 0);
        });

        console.log('🧮 FORMULA VARIATIONS:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`  jumlah_upah_kotor:                  ${Math.round(totalJuk).toLocaleString('id-ID')}`);
        console.log(`  - total_potongan:                   -${Math.round(totalPotongan).toLocaleString('id-ID')}`);
        console.log(`  + premi_pph:                        +${Math.round(totalPremiPph).toLocaleString('id-ID')}`);
        console.log(`  = Formula 1 (upah_bersih):           ${Math.round(totalJuk - totalPotongan + totalPremiPph).toLocaleString('id-ID')}`);
        console.log('');
        console.log(`  Sum of upah_bersih from employees:  ${Math.round(totalUpahBersih).toLocaleString('id-ID')}`);
        console.log('');
        console.log(`  Formula 1 - pot_kontan:             ${(Math.round(totalJuk - totalPotongan + totalPremiPph) - Math.round(totalKontan)).toLocaleString('id-ID')}`);
        console.log(`  Formula 1 - pot_koreksi:            ${(Math.round(totalJuk - totalPotongan + totalPremiPph) - Math.round(totalKoreksiPanen)).toLocaleString('id-ID')}`);
        console.log(`  Formula 1 - (kontan+koreksi):       ${(Math.round(totalJuk - totalPotongan + totalPremiPph) - Math.round(totalKontan + totalKoreksiPanen)).toLocaleString('id-ID')}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        const expected = 176414884;
        console.log('🎯 MATCH CHECK:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`  Expected:                                    ${expected.toLocaleString('id-ID')}`);
        console.log(`  Sum upah_bersih:                             ${Math.round(totalUpahBersih).toLocaleString('id-ID')} | Diff: ${(Math.round(totalUpahBersih) - expected).toLocaleString('id-ID')}`);
        console.log(`  Sum - pot_kontan:                            ${(Math.round(totalUpahBersih) - Math.round(totalKontan)).toLocaleString('id-ID')} | Diff: ${(Math.round(totalUpahBersih) - Math.round(totalKontan) - expected).toLocaleString('id-ID')}`);
        console.log(`  Sum - pot_koreksi:                           ${(Math.round(totalUpahBersih) - Math.round(totalKoreksiPanen)).toLocaleString('id-ID')} | Diff: ${(Math.round(totalUpahBersih) - Math.round(totalKoreksiPanen) - expected).toLocaleString('id-ID')}`);
        console.log(`  Sum - (kontan+koreksi):                      ${(Math.round(totalUpahBersih) - Math.round(totalKontan + totalKoreksiPanen)).toLocaleString('id-ID')} | Diff: ${(Math.round(totalUpahBersih) - Math.round(totalKontan + totalKoreksiPanen) - expected).toLocaleString('id-ID')}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Check: Is total_potongan ALREADY including kontan and koreksi?
        console.log('🔍 CHECKING: Is total_potongan already complete?');
        const manualPotongan = totalKontan + totalKoreksiPanen + 
                              Number(fieldSums['pot_pph21'] || 0) + 
                              Number(fieldSums['pot_astek'] || 0) +
                              Number(fieldSums['pot_spsi'] || 0) +
                              Number(fieldSums['pot_bpjs_pekerja_total'] || 0);

        console.log(`  Sum of individual potongan: ${Math.round(manualPotongan).toLocaleString('id-ID')}`);
        console.log(`  total_potongan from emp:    ${Math.round(totalPotongan).toLocaleString('id-ID')}`);
        console.log(`  Difference:                 ${(Math.round(totalPotongan) - Math.round(manualPotongan)).toLocaleString('id-ID')}`);
        console.log('');

        if (Math.round(totalPotongan) !== Math.round(manualPotongan)) {
            console.log('⚠️  MISMATCH! total_potongan TIDAK sama dengan sum of individual potongan');
            console.log('   → Ada potongan yang BELUM terhitung di individual fields');
            console.log('   → Atau total_potongan sudah termasuk yang lain-lain\n');
        } else {
            console.log('✅ MATCH! total_potongan sudah mencakup semua individual potongan\n');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }

    process.exit(0);
}

findAllDeductions();
