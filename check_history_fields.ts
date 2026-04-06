/**
 * Check what fields are actually in history data rows
 */

import { historyDatabaseService } from './backend/src/services/historyDatabaseService';

async function checkHistoryDataFields() {
    console.log('='.repeat(80));
    console.log('CHECKING HISTORY DATA FIELDS FOR PG2A - MARET 2026');
    console.log('='.repeat(80));

    console.log('\nFetching history data for PG2A...');
    const historyData = await historyDatabaseService.getHistoricalPayrollDataAsExtractorFormat(
        3, 2026, 'ALL', 'PG2A'
    );

    if (!historyData || historyData.data_rows.length === 0) {
        console.log('❌ No history data found!');
        return;
    }

    console.log(`✅ Found ${historyData.data_rows.length} employee rows\n`);

    // Get first row and show ALL fields
    const firstRow = historyData.data_rows[0];
    console.log('FIRST ROW - ALL FIELDS:');
    console.log('='.repeat(80));
    
    const allKeys = Object.keys(firstRow).sort();
    console.log(`Total fields: ${allKeys.length}\n`);
    
    // Group fields by category
    const categories = {
        'Identity': ['emp_code', 'nik', 'nik_ktp', 'nama', 'emp_name', 'actual_nik', 'gender', 'jenis_kelamin', 'pajak_npwp', 'res_address'],
        'Work': ['gang_code', 'division_code', 'jabatan_estate', 'status_ptkp', 'upah_dasar', 'beras_rate'],
        'Pay - Core': ['gaji_pokok_aktual', 'gaji_pokok', 'gaji_pokok_ideal', 'jumlah_hk', 'hk', 'koreksi_hk', 'jumlah_upah_kotor', 'upah_kotor'],
        'Tunjangan': ['beras_jumlah', 'jabatan_jumlah', 'masa_kerja_jumlah', 'lembur_jumlah', 'total_tunjangan'],
        'Premi': ['total_premi', 'premi_pph', 'premi_pph21', 'premi_detail', 'premi_brondol', ...(allKeys.filter(k => k.startsWith('premi_')))],
        'Potongan': ['pot_pph21', 'pot_spsi', 'pot_koreksi', 'total_potongan_kotor'],
        'Tax': ['pph21_ter', 'tarif_pajak_ter', 'penghasilan_bruto'],
        'Other': ['pendapatan_lainnya', 'total_pendapatan_lainnya']
    };

    for (const [cat, keys] of Object.entries(categories)) {
        const present = keys.filter(k => firstRow[k] !== undefined && firstRow[k] !== null);
        const missing = keys.filter(k => firstRow[k] === undefined && firstRow[k] === null);
        
        console.log(`\n${cat}:`);
        if (present.length > 0) {
            console.log(`  ✅ Present: ${present.join(', ')}`);
        }
        if (missing.length > 0) {
            console.log(`  ❌ Missing: ${missing.join(', ')}`);
        }
    }

    // Show sample values for critical fields
    console.log('\n' + '='.repeat(80));
    console.log('CRITICAL FIELD VALUES (first row):');
    console.log('='.repeat(80));
    
    const criticalFields = ['emp_code', 'nama', 'emp_name', 'nik', 'nik_ktp', 'actual_nik', 'gang_code', 'status_ptkp', 'pph21_ter', 'penghasilan_bruto'];
    for (const field of criticalFields) {
        const val = firstRow[field];
        console.log(`  ${field}: ${val !== undefined && val !== null ? JSON.stringify(val) : 'UNDEFINED'}`);
    }

    console.log('\n' + '='.repeat(80));
}

checkHistoryDataFields()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
