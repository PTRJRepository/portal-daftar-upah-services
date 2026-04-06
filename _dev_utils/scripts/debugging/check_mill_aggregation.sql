-- Check MILL aggregation data stored
SELECT
    division_code,
    gang_code,
    total_employees,
    total_hk,
    total_gaji_pokok,
    total_lembur,
    total_tunjangan,
    total_upah_kotor,
    total_potongan,
    total_pph21,
    total_upah_bersih,
    informasi_tambahan
FROM [extend_db_ptrj].[dbo].[daftar_upah_aggregation_history]
WHERE division_code = 'MILL'
  AND period_month = 3
  AND period_year = 2026;