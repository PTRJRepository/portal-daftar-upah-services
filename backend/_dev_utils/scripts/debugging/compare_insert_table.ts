// Columns in INSERT statement
const insertColumns = [
    'period_month', 'period_year', 'division_code', 'gang_code', 'gang_description',
    'total_employees', 'total_hk', 'total_hari_kerja',
    'total_cuti_tahunan', 'total_cuti_sakit', 'total_cuti_minggu', 'total_cuti_nasional',
    'total_upah_dasar', 'total_upah_pokok', 'total_gaji_pokok',
    'total_beras', 'total_jabatan', 'total_masa_kerja', 'total_lembur', 'total_tunjangan',
    'total_premi_brondol', 'total_premi_prunning', 'total_premi_insentif', 'total_premi_kinerja', 'total_premi',
    'total_potongan', 'total_pph21', 'total_bpjs_pekerja', 'total_bpjs_majikan', 'total_spsi',
    'total_upah_kotor', 'total_upah_bersih', 'total_ffb_weight', 'total_weight_tbs',
    'dynamic_premi_data', 'informasi_tambahan', 'total_koreksi',
    'created_at', 'updated_at', 'source_endpoint'
];

// Actual table columns (from schema check)
const tableColumns = [
    'id', // auto-increment, not in INSERT
    'period_month', 'period_year', 'division_code', 'gang_code', 'gang_description',
    'total_employees', 'total_hk', 'total_hari_kerja',
    'total_cuti_tahunan', 'total_cuti_sakit', 'total_cuti_minggu', 'total_cuti_nasional',
    'total_upah_dasar', 'total_upah_pokok', 'total_gaji_pokok',
    'total_beras', 'total_jabatan', 'total_masa_kerja', 'total_lembur', 'total_tunjangan',
    'total_premi_brondol', 'total_premi_prunning', 'total_premi',
    'total_potongan', 'total_pph21', 'total_bpjs_pekerja', 'total_bpjs_majikan', 'total_spsi',
    'total_upah_kotor', 'total_upah_bersih',
    'created_at', 'updated_at', 'source_endpoint',
    'dynamic_premi_data', 'total_koreksi', 'informasi_tambahan',
    'total_ffb_weight', 'total_weight_tbs',
    'total_premi_insentif', 'total_premi_kinerja'
];

console.log(`INSERT columns count: ${insertColumns.length}`);
console.log(`Table columns count (excluding id): ${tableColumns.length - 1}`);

// Find missing columns in INSERT
const missingInInsert = tableColumns.filter(c => c !== 'id' && !insertColumns.includes(c));
console.log(`\nMissing columns in INSERT statement: ${missingInInsert.length}`);
missingInInsert.forEach(c => console.log(`  - ${c}`));

// Find extra columns in INSERT
const extraInInsert = insertColumns.filter(c => !tableColumns.includes(c));
console.log(`\nExtra columns in INSERT (not in table): ${extraInInsert.length}`);
extraInInsert.forEach(c => console.log(`  - ${c}`));
