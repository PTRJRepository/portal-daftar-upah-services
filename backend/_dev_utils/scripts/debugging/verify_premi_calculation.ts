/**
 * VERIFY: Is total_premi missing dynamic premi items?
 */

import { dataExtractorService } from "../../../src/services/dataExtractorService";

async function main() {
    const gangCode = "G1H";
    const division = "ARB1";
    const month = 3;
    const year = 2026;
    
    const liveResult = await dataExtractorService.extractPayrollData(
        month, year, gangCode, division, null, "SERVER_PROFILE_2", 
        false, false, undefined, true
    );
    
    const liveRows = liveResult.data_rows || [];
    
    console.log(`=== CHECKING total_premi CALCULATION ===\n`);
    
    let sumTotalPremi = 0;
    let sumIndividualPremi = 0;
    
    for (const emp of liveRows.slice(0, 3)) {
        console.log(`\nEmployee: ${emp.emp_code}`);
        console.log(`  total_premi (field): ${(emp.total_premi || 0).toLocaleString('id-ID')}`);
        
        // Sum all premi_ fields
        let individualSum = 0;
        const premiFields: string[] = [];
        
        for (const [key, value] of Object.entries(emp)) {
            if (key.startsWith('premi_') && typeof value === 'number' && value > 0) {
                premiFields.push(`${key}=${value.toLocaleString('id-ID')}`);
                individualSum += value;
            }
        }
        
        console.log(`  Individual premi fields: ${premiFields.join(', ')}`);
        console.log(`  Sum of individual premi: ${individualSum.toLocaleString('id-ID')}`);
        console.log(`  Match: ${individualSum === (emp.total_premi || 0) ? '✅ YES' : '❌ NO'}`);
        
        sumTotalPremi += emp.total_premi || 0;
        sumIndividualPremi += individualSum;
    }
    
    console.log(`\n=== TOTALS (first 3 employees) ===`);
    console.log(`Sum of total_premi field: ${sumTotalPremi.toLocaleString('id-ID')}`);
    console.log(`Sum of individual premi fields: ${sumIndividualPremi.toLocaleString('id-ID')}`);
    console.log(`Difference: ${(sumIndividualPremi - sumTotalPremi).toLocaleString('id-ID')}`);
    
    // Now calculate what payrollDataService.calculateTotals would produce
    console.log(`\n=== WHAT payrollDataService.calculateTotals PRODUCES ===`);
    
    const totals: Record<string, number> = {};
    const numericFields = [
        'jumlah_hk', 'hari_kerja', 'gaji_pokok', 'gaji_pokok_ideal', 'gaji_pokok_aktual',
        'beras_jumlah', 'jabatan_jumlah', 'masa_kerja_tahun', 'masa_kerja_jumlah', 'lembur_jumlah',
        'total_tunjangan', 'premi_brondol', 'total_premi', 'pot_koreksi',
        'potongan_upah_kotor_total', 'jumlah_upah_kotor',
        'pot_astek', 'pot_astek_maj', 'pot_bpjs_kesehatan_pekerja', 'pot_bpjs_kesehatan_majikan',
        'pot_bpjs_pensiun_pekerja', 'pot_bpjs_pensiun_majikan', 'pot_bpjs_pekerja_total',
        'pot_spsi', 'pot_pph21', 'premi_pph', 'total_potongan', 'total_potongan_bersih',
        'upah_bersih', 'koreksi_hk', 'pph21_ter', 'tarif_pajak_ter'
    ];
    
    for (const field of numericFields) totals[field] = 0;
    totals['employee_count'] = liveRows.length;
    
    for (const emp of liveRows) {
        for (const field of numericFields) {
            const val = emp[field];
            if (val !== null && val !== undefined) totals[field] += parseFloat(val) || 0;
        }
        
        // Sum dynamic premi and potongan (EXACTLY as payrollDataService does)
        for (const key of Object.keys(emp)) {
            if ((key.startsWith('premi_') && !['premi_brondol', 'premi_pph', 'premi_koreksi'].includes(key)) ||
                key.startsWith('KOREKSI') || key.startsWith('POTONGAN')) {
                const val = emp[key];
                if (typeof val === 'number') {
                    if (!totals[key]) totals[key] = 0;
                    totals[key] += val;
                }
            }
        }
    }
    
    console.log(`\ntotal_premi (from calculateTotals): ${totals.total_premi.toLocaleString('id-ID')}`);
    console.log(`premi_brondol: ${totals.premi_brondol.toLocaleString('id-ID')}`);
    
    // Show dynamic premi totals
    console.log(`\nDynamic premi totals:`);
    for (const [key, value] of Object.entries(totals)) {
        if (key.startsWith('premi_') && key !== 'premi_brondol' && key !== 'premi_pph' && key !== 'premi_koreksi' && value > 0) {
            console.log(`  ${key}: ${value.toLocaleString('id-ID')}`);
        }
    }
}

main().catch(console.error);
