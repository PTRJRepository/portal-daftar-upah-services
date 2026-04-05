// Verify placeholder count matches values count
const sql = `
        INSERT INTO dbo.daftar_upah_aggregation_history (
            period_month, period_year, division_code, gang_code, gang_description,
            total_employees, total_hk, total_hari_kerja,
            total_cuti_tahunan, total_cuti_sakit, total_cuti_minggu, total_cuti_nasional,
            total_upah_dasar, total_upah_pokok, total_gaji_pokok,
            total_beras, total_jabatan, total_masa_kerja, total_lembur, total_tunjangan,
            total_premi_brondol, total_premi_prunning, total_premi_insentif, total_premi_kinerja, total_premi,
            total_potongan, total_pph21, total_bpjs_pekerja, total_bpjs_majikan, total_spsi,
            total_upah_kotor, total_upah_bersih, total_ffb_weight, total_weight_tbs,
            dynamic_premi_data, informasi_tambahan, total_koreksi,
            created_at, updated_at, source_endpoint
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE(), ?
        )
    `;

const values = [
        "month", "year", "divisionCode",
        "gang_code", "gang_description",
        "total_employees", "total_hk", "total_hari_kerja",
        "total_cuti_tahunan", "total_cuti_sakit",
        "total_cuti_minggu", "total_cuti_nasional",
        "total_upah_dasar", "total_upah_pokok", "total_gaji_pokok",
        "total_beras", "total_jabatan",
        "total_masa_kerja", "total_lembur", "total_tunjangan",
        "total_premi_brondol", "total_premi_prunning",
        "total_premi_insentif", "total_premi_kinerja", "total_premi",
        "total_potongan", "total_pph21",
        "total_bpjs_pekerja", "total_bpjs_majikan", "total_spsi",
        "total_upah_kotor", "total_upah_bersih",
        "total_ffb_weight", "total_weight_tbs",
        "dynamic_premi_data", "informasi_tambahan",
        "total_koreksi", "sourceEndpoint"
    ];

// Count columns
const colMatch = sql.match(/INSERT INTO.*?\((.*?)\)\s*VALUES/s);
const columns = colMatch ? colMatch[1].split(',').map(c => c.trim()).filter(c => c) : [];
console.log(`Columns: ${columns.length}`);

// Count placeholders
const placeholderCount = (sql.match(/\?/g) || []).length;
console.log(`? placeholders: ${placeholderCount}`);

// Count GETDATE()
const getDateCount = (sql.match(/GETDATE\(\)/g) || []).length;
console.log(`GETDATE(): ${getDateCount}`);

// Total values
const totalValues = placeholderCount + getDateCount;
console.log(`Total values: ${totalValues}`);
console.log(`Values array: ${values.length}`);

console.log(`\n${'='.repeat(60)}`);
if (columns.length === totalValues && columns.length === values.length) {
    console.log(`✅ MATCH! ${columns.length} columns = ${totalValues} values = ${values.length} array items`);
} else {
    console.log(`❌ MISMATCH!`);
    console.log(`  Columns: ${columns.length}`);
    console.log(`  Placeholders + GETDATE(): ${totalValues}`);
    console.log(`  Values array: ${values.length}`);
    console.log(`\nMissing: ${columns.length - totalValues}`);
}
