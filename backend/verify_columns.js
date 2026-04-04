// Count columns in INSERT statement
const columns = [
    'history_id', 'period_month', 'period_year', 'division_code', 'gang_code', 'gang_description',
    'total_employees', 'total_hk', 'total_hari_kerja',
    'total_cuti_tahunan', 'total_cuti_sakit', 'total_cuti_minggu', 'total_cuti_nasional',
    'total_upah_dasar', 'total_upah_pokok', 'total_gaji_pokok',
    'total_beras', 'total_jabatan', 'total_masa_kerja', 'total_lembur', 'total_tunjangan',
    'total_premi_brondol', 'total_premi_prunning', 'total_premi_insentif', 'total_premi_kinerja', 'total_premi',
    'dynamic_premi_data', 'total_koreksi', 'total_potongan', 'total_pph21',
    'total_bpjs_pekerja', 'total_bpjs_majikan', 'total_spsi',
    'dynamic_potongan_data', 'total_upah_kotor', 'total_upah_bersih',
    'total_ffb_weight', 'total_weight_tbs', 'informasi_tambahan',
    'created_by', 'source_endpoint', 'is_locked', 'lock_reason', 'created_at'
];

console.log('Column count:', columns.length);

// Count placeholders in VALUES
const placeholders = [
    '?', '?', '?', '?', '?', '?', '?', '?', '?', '?',
    '?', '?', '?', '?', '?', '?', '?', '?', '?', '?',
    '?', '?', '?', '?', '?', '?', '?', '?', '?', '?',
    '?', '?', '?', '?', '?', '?', '?', '?', '?', '?',
    '?', '?', '?', '?', '?'
];

console.log('Placeholder count:', placeholders.length);

// Actual table columns from database
const actualColumns = 45; // id + 44 insert columns
console.log('Actual table columns (excluding id):', actualColumns - 1);

if (columns.length === placeholders.length) {
    console.log('✓ Columns and placeholders match');
} else {
    console.error('✗ MISMATCH:', columns.length, 'columns vs', placeholders.length, 'placeholders');
}
