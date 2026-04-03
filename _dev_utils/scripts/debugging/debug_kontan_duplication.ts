/**
 * Debug Script: Verifikasi Duplikasi Perhitungan KONTAN / Pendapatan Lainnya
 *
 * USER: Jalankan ini secara OFFLINE (tanpa internet/database)
 * Script ini akan:
 * 1. Mengambil sample employee dengan KONTAN dari API
 * 2. Menampilkan nilai aktual di setiap kolom terkait
 * 3. Menunjukkan duplikasi di API totals vs frontend grid
 *
 * Run: cd backend && bun run src/scripts/debug_kontan_duplication.ts
 *
 * NOTE: Script ini butuh koneksi ke backend server (localhost:8002).
 * Jika backend offline, hasilnya tetap bisa dianalisis dari data JSON.
 */

import { Database } from '../db/client';
import { dataExtractorService } from '../services/dataExtractorService';

const TEST_GANG = process.env.DEFAULT_GANG || 'H1H';
const TEST_MONTH = parseInt(process.env.DEFAULT_MONTH || '2');
const TEST_YEAR = parseInt(process.env.DEFAULT_YEAR || '2026');

async function main() {
    console.log('='.repeat(80));
    console.log('DEBUG: Kontan / Pendapatan Lainnya - Verifikasi Duplikasi');
    console.log(`Gang: ${TEST_GANG}, Month: ${TEST_MONTH}, Year: ${TEST_YEAR}`);
    console.log('='.repeat(80));

    try {
        // Step 1: Extract payroll data (sama seperti API /payroll/report endpoint)
        console.log('\n[Step 1] Extracting payroll data...');
        const result = await dataExtractorService.extractPayrollData(TEST_GANG, TEST_MONTH, TEST_YEAR);

        if (!result.data_rows || result.data_rows.length === 0) {
            console.log('❌ No data rows returned');
            return;
        }
        console.log(`✅ Got ${result.data_rows.length} rows`);

        // Step 2: Find employees with KONTAN or custom income types
        console.log('\n[Step 2] Scanning for employees with KONTAN / custom income...');
        const kontanEmployees: any[] = [];

        for (const row of result.data_rows) {
            const rowKeys = Object.keys(row);
            const customIncomeKeys = rowKeys.filter(k => k.startsWith('pendapatan_'));
            const hasKontan = customIncomeKeys.some(k => k.toLowerCase().includes('kontan'));

            if (hasKontan || customIncomeKeys.length > 0) {
                kontanEmployees.push({ row, customIncomeKeys });
            }
        }

        if (kontanEmployees.length === 0) {
            console.log('⚠️  No employees found with custom income types (KONTAN, etc.)');
            console.log('   Checking all employees for any pendapatan_* keys...');
            const sampleRow = result.data_rows[0];
            const allPendapatanKeys = Object.keys(sampleRow).filter(k => k.startsWith('pendapatan_'));
            console.log(`   Sample row has ${allPendapatanKeys.length} pendapatan_* keys:`);
            allPendapatanKeys.forEach(k => {
                console.log(`     - ${k} = ${(sampleRow as any)[k]}`);
            });
            return;
        }

        console.log(`✅ Found ${kontanEmployees.length} employees with custom income\n`);

        // Step 3: Detailed analysis per employee
        for (const { row, customIncomeKeys } of kontanEmployees) {
            console.log('-'.repeat(80));
            console.log(`Employee: ${row.nama} (NIK: ${row.nik}, EmpCode: ${row.emp_code})`);
            console.log(`Gang: ${row.gang_code}`);

            // Collect all relevant fields
            const pendapatan_kontan = (row as any)['pendapatan_kontan'] || 0;
            const pendapatan_lainnya = (row as any)['pendapatan_lainnya'] || 0;
            const pot_pendapatan_lainnya = (row as any)['pot_pendapatan_lainnya'] || 0;
            const total_potongan = (row as any)['total_potongan'] || 0;
            const total_potongan_bersih = (row as any)['total_potongan_bersih'] || 0;
            const jumlah_upah_kotor = (row as any)['jumlah_upah_kotor'] || 0;
            const upah_bersih = (row as any)['upah_bersih'] || 0;

            console.log('\n  --- Kolom Pendapatan (INCOME) ---');
            for (const key of customIncomeKeys) {
                const val = (row as any)[key];
                if (val && val !== 0) {
                    console.log(`    ${key} = Rp ${val.toLocaleString('id-ID')}`);
                }
            }

            console.log('\n  --- Kolom Potongan (DEDUCTION) ---');
            const dynamicPotKeys = Object.keys(row).filter(k =>
                (k.startsWith('POTONGAN') || k.startsWith('pot_')) &&
                (k.toLowerCase().includes('kontan') || k.toLowerCase().includes('kont'))
            );
            if (dynamicPotKeys.length > 0) {
                for (const key of dynamicPotKeys) {
                    const val = (row as any)[key];
                    if (val && val !== 0) {
                        console.log(`    ${key} = Rp ${val.toLocaleString('id-ID')}`);
                    }
                }
            } else {
                console.log('    (tidak ada potongan dengan keyword KONTAN)');
            }

            console.log('\n  --- Total Calculation ---');
            console.log(`    pendapatan_kontan          = Rp ${pendapatan_kontan.toLocaleString('id-ID')}`);
            console.log(`    pendapatan_lainnya         = Rp ${pendapatan_lainnya.toLocaleString('id-ID')}`);
            console.log(`    pot_pendapatan_lainnya     = Rp ${pot_pendapatan_lainnya.toLocaleString('id-ID')}`);
            console.log(`    total_potongan             = Rp ${total_potongan.toLocaleString('id-ID')}`);
            console.log(`    total_potongan_bersih      = Rp ${total_potongan_bersih.toLocaleString('id-ID')}`);
            console.log(`    jumlah_upah_kotor          = Rp ${jumlah_upah_kotor.toLocaleString('id-ID')}`);
            console.log(`    upah_bersih                = Rp ${upah_bersih.toLocaleString('id-ID')}`);

            // DUPLICASI CHECK
            console.log('\n  --- DUPLICASI CHECK ---');
            const customTypeTotal = customIncomeKeys
                .filter(k => !['pendapatan_thr', 'pendapatan_bonus', 'pendapatan_custom', 'pendapatan_lainnya', 'pendapatan_tidak_tetap_thp', 'pendapatan_tidak_tetap_taxable'].includes(k))
                .reduce((sum: number, k: string) => sum + ((row as any)[k] || 0), 0);

            if (customTypeTotal > 0) {
                console.log(`    ⚠️  Custom types (e.g. KONTAN) TOTAL = Rp ${customTypeTotal.toLocaleString('id-ID')}`);
                console.log(`    ⚠️  pendapatan_lainnya INCLUDES this = Rp ${pendapatan_lainnya.toLocaleString('id-ID')}`);
                console.log(`    ⚠️  [POTENSIAL DUPLIKASI] Di API totals:`);
                console.log(`        - pendapatan_lainnya (numericFields) = Rp ${pendapatan_lainnya.toLocaleString('id-ID')} ✅`);
                console.log(`        - pendapatan_kontan (dynamic loop)  = Rp ${pendapatan_kontan.toLocaleString('id-ID')} ❌ (DUPLICATE!)`);
                console.log(`        - TOTAL counted = ${pendapatan_lainnya + pendapatan_kontan} instead of ${pendapatan_lainnya}`);
            }

            // Check if KONTAN is also in PR_ADTRANS (potongan)
            const allDynamicPotKeys = Object.keys(row).filter(k =>
                (k.startsWith('POTONGAN') || k.startsWith('pot_')) &&
                !['pot_astek', 'pot_bpjs_kesehatan_pekerja', 'pot_bpjs_pensiun_pekerja',
                  'pot_spsi', 'pot_pph21', 'pot_astek_pekerja', 'pot_bpjs_pekerja_total',
                  'pot_koreksi', 'pot_astek_maj', 'pot_astek_majikan', 'pot_bpjs_kesehatan_majikan',
                  'pot_bpjs_pensiun_majikan', 'pot_bpjs_pensiun_majikan', 'pot_bpjs_kesehatan_jumlah',
                  'pot_bpjs_pensiun_jumlah', 'pot_astek_jumlah', 'pot_pendapatan_lainnya'].includes(k)
            );
            if (allDynamicPotKeys.length > 0) {
                console.log(`    ⚠️  KONTAN juga ada di PR_ADTRANS (potongan):`);
                for (const key of allDynamicPotKeys) {
                    const val = (row as any)[key];
                    if (val && val !== 0) {
                        console.log(`        ${key} = Rp ${val.toLocaleString('id-ID')}`);
                    }
                }
                console.log(`    ⚠️  [POTENSIAL DUPLIKASI 2] KONTAN di pot_potongan + di total_potongan`);
            }
        }

        // Step 4: Show dynamic headers for potongan
        console.log('\n' + '='.repeat(80));
        console.log('[Step 4] Dynamic Potongan Headers (PR_ADTRANS KONTAN)');
        console.log('='.repeat(80));
        if (result.dynamic_potongan_headers && result.dynamic_potongan_headers.length > 0) {
            console.log(`Total: ${result.dynamic_potongan_headers.length} dynamic potongan columns`);
            const kontanHeaders = (result.dynamic_potongan_headers as string[]).filter(h =>
                h.toLowerCase().includes('kontan') || h.toLowerCase().includes('kont')
            );
            if (kontanHeaders.length > 0) {
                console.log('KONTAN-related headers:');
                kontanHeaders.forEach(h => console.log(`  - ${h}`));
            }
        }

        // Step 5: Simulate API totals calculation
        console.log('\n' + '='.repeat(80));
        console.log('[Step 5] Simulate API calculateTotals() - Where DUPLICATION occurs');
        console.log('='.repeat(80));

        const numericFields = [
            'jumlah_hk', 'hari_kerja', 'gaji_pokok', 'gaji_pokok_ideal', 'gaji_pokok_aktual',
            'beras_jumlah', 'jabatan_jumlah', 'masa_kerja_jumlah', 'lembur_jumlah',
            'total_tunjangan', 'premi_brondol', 'total_premi', 'pot_koreksi',
            'potongan_upah_kotor_total', 'jumlah_upah_kotor',
            'pot_astek', 'pot_astek_maj', 'pot_bpjs_kesehatan_pekerja', 'pot_bpjs_kesehatan_majikan',
            'pot_bpjs_pensiun_pekerja', 'pot_bpjs_pensiun_majikan', 'pot_bpjs_pekerja_total',
            'pot_spsi', 'pot_pph21', 'premi_pph', 'total_potongan', 'total_potongan_bersih',
            'upah_bersih', 'koreksi_hk',
            'pendapatan_thr', 'pendapatan_bonus', 'pendapatan_custom',
            'pendapatan_lainnya', 'pot_pendapatan_lainnya'
        ];

        let simulatedTotals: Record<string, number> = {};
        for (const field of numericFields) {
            simulatedTotals[field] = 0;
        }

        for (const row of result.data_rows) {
            const hk = parseFloat((row as any).jumlah_hk) || 0;
            if (hk <= 0) continue;

            for (const field of numericFields) {
                const val = (row as any)[field];
                simulatedTotals[field] += parseFloat(val) || 0;
            }

            // Dynamic loop (ISSUE #1)
            for (const key of Object.keys(row)) {
                if (key.startsWith('pendapatan_') && !numericFields.includes(key)) {
                    const val = (row as any)[key];
                    if (val !== null && val !== undefined && typeof val === 'number' && val !== 0) {
                        if (!simulatedTotals[key]) simulatedTotals[key] = 0;
                        simulatedTotals[key] += val;
                        console.log(`    ⚠️  [DUPLICATE] Dynamic "${key}" counted = Rp ${val.toLocaleString('id-ID')}`);
                        console.log(`        Already counted in "pendapatan_lainnya" numericFields!`);
                    }
                }
            }
        }

        console.log('\n  Simulated Totals (partial):');
        console.log(`    pendapatan_lainnya = Rp ${(simulatedTotals['pendapatan_lainnya'] || 0).toLocaleString('id-ID')}`);
        console.log(`    pot_pendapatan_lainnya = Rp ${(simulatedTotals['pot_pendapatan_lainnya'] || 0).toLocaleString('id-ID')}`);
        console.log(`    total_potongan = Rp ${(simulatedTotals['total_potongan'] || 0).toLocaleString('id-ID')}`);
        console.log(`    upah_bersih = Rp ${(simulatedTotals['upah_bersih'] || 0).toLocaleString('id-ID')}`);

        // Check if duplicate exists in simulated totals
        const duplicateKeys = Object.keys(simulatedTotals).filter(k => k.startsWith('pendapatan_') && k !== 'pendapatan_lainnya');
        if (duplicateKeys.length > 0) {
            console.log('\n  ⚠️  DUPLICATE DETECTED:');
            const duplicateTotal = duplicateKeys.reduce((sum, k) => sum + (simulatedTotals[k] || 0), 0);
            console.log(`    ${duplicateKeys.length} dynamic pendapatan_* fields found in totals:`);
            duplicateKeys.forEach(k => {
                console.log(`      - ${k} = Rp ${(simulatedTotals[k] || 0).toLocaleString('id-ID')}`);
            });
            console.log(`    Total counted TWICE: Rp ${duplicateTotal.toLocaleString('id-ID')}`);
            console.log(`    Correct total should be: Rp ${(simulatedTotals['pendapatan_lainnya'] || 0).toLocaleString('id-ID')}`);
        } else {
            console.log('\n  ✅ No duplicate detected in this data');
        }

        console.log('\n' + '='.repeat(80));
        console.log('END OF DEBUG REPORT');
        console.log('='.repeat(80));

    } catch (err: any) {
        console.error('❌ Error:', err.message);
        console.error(err.stack);
    }
}

main();