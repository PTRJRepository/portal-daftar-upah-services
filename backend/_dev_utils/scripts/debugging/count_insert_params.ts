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

// Count columns
const colMatch = sql.match(/INSERT INTO.*?\((.*?)\)/s);
const columns = colMatch ? colMatch[1].split(',').map(c => c.trim()).filter(c => c) : [];
console.log(`Columns: ${columns.length}`);

// Count placeholders
const placeholderCount = (sql.match(/\?/g) || []).length;
console.log(`Placeholders (?): ${placeholderCount}`);

// Count GETDATE()
const getDateCount = (sql.match(/GETDATE\(\)/g) || []).length;
console.log(`GETDATE(): ${getDateCount}`);

// Total values
console.log(`Total values: ${placeholderCount + getDateCount}`);
console.log(`\nDifference: ${columns.length - (placeholderCount + getDateCount)}`);

if (columns.length !== placeholderCount + getDateCount) {
    console.log(`\n❌ MISMATCH: ${columns.length} columns but only ${placeholderCount + getDateCount} values`);
} else {
    console.log(`\n✅ MATCH`);
}

// Now check the actual values array
const valuesArray = `
            month,
            year,
            dbDivisionCode, // Use mapped code
            aggregation.gang_code,
            aggregation.gang_description,
            aggregation.total_employees,
            aggregation.total_hk,
            aggregation.total_hari_kerja,
            aggregation.total_cuti_tahunan,
            aggregation.total_cuti_sakit,
            aggregation.total_cuti_minggu,
            aggregation.total_cuti_nasional,
            aggregation.total_upah_dasar,
            aggregation.total_upah_pokok,
            aggregation.total_gaji_pokok,
            aggregation.total_beras,
            aggregation.total_jabatan,
            aggregation.total_masa_kerja,
            aggregation.total_lembur,
            aggregation.total_tunjangan,
            aggregation.total_premi_brondol,
            aggregation.total_premi_prunning,
            aggregation.total_premi_insentif,
            aggregation.total_premi_kinerja,
            aggregation.total_premi,
            aggregation.total_potongan,
            aggregation.total_pph21,
            aggregation.total_bpjs_pekerja,
            aggregation.total_bpjs_majikan,
            aggregation.total_spsi,
            aggregation.total_upah_kotor,
            aggregation.total_upah_bersih,
            aggregation.total_ffb_weight,
            aggregation.total_weight_tbs,
            aggregation.dynamic_premi_data,
            aggregation.informasi_tambahan,
            aggregation.total_koreksi,
            sourceEndpoint
        `;

const values = valuesArray.split(',').map(v => v.trim()).filter(v => v && !v.startsWith('//'));
console.log(`\nValues in array: ${values.length}`);
