/**
 * TRACE MISSING FIELDS
 * Find which fields are in live data but NOT being summed by aggregation
 */

import { dataExtractorService } from "../../../src/services/dataExtractorService";

async function main() {
    const gangCode = "G1H";
    const division = "ARB1";
    const month = 3;
    const year = 2026;
    
    console.log(`=== TRACING MISSING FIELDS ===\n`);
    
    const liveResult = await dataExtractorService.extractPayrollData(
        month, year, gangCode, division, null, "SERVER_PROFILE_2", 
        false, false, undefined, true
    );
    
    const liveRows = liveResult.data_rows || [];
    
    // Get FIRST employee and show ALL fields
    const emp = liveRows[0];
    
    console.log(`Sample employee: ${emp.emp_code} (${emp.emp_name})\n`);
    console.log(`ALL fields in employee object:\n`);
    
    // Group fields by category
    const fieldGroups: Record<string, string[]> = {
        'attendance': [],
        'leave': [],
        'income': [],
        'deductions': [],
        'premi': [],
        'bpjs': [],
        'tax': [],
        'totals': [],
        'other': []
    };
    
    for (const [key, value] of Object.entries(emp)) {
        if (typeof value === 'number' && value !== 0) {
            if (key.includes('hk') || key.includes('hari') || key.includes('jam')) {
                fieldGroups.attendance.push(key);
            } else if (key.includes('cuti')) {
                fieldGroups.leave.push(key);
            } else if (key.startsWith('premi_') || key.includes('brondol')) {
                fieldGroups.premi.push(key);
            } else if (key.startsWith('pot_') || key.startsWith('bpjs_') || key.includes('astek')) {
                fieldGroups.deductions.push(key);
            } else if (key.includes('pph') || key.includes('tax') || key.includes('pajak')) {
                fieldGroups.tax.push(key);
            } else if (key.includes('total') || key.includes('jumlah') || key.includes('kotor') || key.includes('bersih')) {
                fieldGroups.totals.push(key);
            } else if (key.includes('gaji') || key.includes('upah') || key.includes('beras') || key.includes('jabatan') || key.includes('masa') || key.includes('lembur')) {
                fieldGroups.income.push(key);
            } else {
                fieldGroups.other.push(key);
            }
        }
    }
    
    for (const [group, fields] of Object.entries(fieldGroups)) {
        if (fields.length > 0) {
            console.log(`\n[${group.toUpperCase()}]`);
            for (const field of fields) {
                const val = emp[field];
                if (typeof val === 'number') {
                    console.log(`  ${field}: ${val.toLocaleString('id-ID')}`);
                } else {
                    console.log(`  ${field}: ${val}`);
                }
            }
        }
    }
    
    // Now check what payrollDataService.calculateTotals is reading
    console.log(`\n\n=== CHECKING payrollDataService.calculateTotals NUMERIC FIELDS ===\n`);
    
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
    
    console.log(`Fields that payrollDataService.calculateTotals reads:\n`);
    for (const field of numericFields) {
        const val = emp[field];
        const exists = val !== undefined && val !== null;
        const marker = exists ? '✅' : '❌';
        console.log(`  ${marker} ${field}: ${exists ? (typeof val === 'number' ? val.toLocaleString('id-ID') : val) : 'NOT FOUND'}`);
    }
    
    // Find fields that ARE in employee but NOT in calculateTotals numericFields
    console.log(`\n\n=== FIELDS IN EMPLOYEE BUT NOT READ BY CALCULATETOTALS ===\n`);
    
    const missingFields: string[] = [];
    for (const [key, value] of Object.entries(emp)) {
        if (typeof value === 'number' && value !== 0 && !numericFields.includes(key)) {
            missingFields.push(key);
        }
    }
    
    console.log(`Missing fields (${missingFields.length}):\n`);
    for (const field of missingFields.sort()) {
        console.log(`  ${field}: ${(emp[field] as number).toLocaleString('id-ID')}`);
    }
}

main().catch(console.error);
