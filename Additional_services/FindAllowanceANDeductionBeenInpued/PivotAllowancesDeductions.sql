-- ============================================================================
-- QUERY: Pivot Table - Allowances & Deductions Summary
-- ============================================================================
-- Purpose: Menampilkan ringkasan tunjangan dan potongan dalam format pivot
--          (satu baris per karyawan dengan semua kolom komponen)
-- 
-- Usage:
--   1. Update @EmpList dengan list kode karyawan yang ingin dicek
--   2. Update @StartDate dan @EndDate dengan periode yang diinginkan
--   3. Run query untuk melihat summary semua karyawan dalam satu tabel
-- ============================================================================

DECLARE @EmpList VARCHAR(MAX) = '''H0033'',''H0034'',''H0035''';  -- List karyawan
DECLARE @StartDate DATE = '2025-05-01';   -- Periode mulai
DECLARE @EndDate DATE = '2025-06-01';     -- Periode akhir

-- ============================================================================
-- PART 2: PIVOT TABLE - SUMMARY SEMUA KOMPONEN
-- ============================================================================
SELECT 
    emp_code,
    -- TUNJANGAN TETAP
    MAX(CASE WHEN component_key = 'JABATAN' THEN amount ELSE 0 END) AS tunjangan_jabatan,
    MAX(CASE WHEN component_key = 'BERAS' THEN amount ELSE 0 END) AS tunjangan_beras,
    MAX(CASE WHEN component_key = 'MASA_KERJA' THEN amount ELSE 0 END) AS tunjangan_masa_kerja,
    MAX(CASE WHEN component_key = 'LEMBUR' THEN amount ELSE 0 END) AS tunjangan_lembur,
    
    -- PREMI DINAMIS
    MAX(CASE WHEN component_key = 'PREMI_PANEN' THEN amount ELSE 0 END) AS premi_panen,
    MAX(CASE WHEN component_key = 'PREMI_KINERJA' THEN amount ELSE 0 END) AS premi_kinerja,
    MAX(CASE WHEN component_key = 'PREMI_BRONDOL' THEN amount ELSE 0 END) AS premi_brondol,
    MAX(CASE WHEN component_key = 'PREMI_INSENTIF' THEN amount ELSE 0 END) AS premi_insentif,
    
    -- POTONGAN
    MAX(CASE WHEN component_key = 'PPH21' THEN amount ELSE 0 END) AS potongan_pph21,
    MAX(CASE WHEN component_key = 'BPJS_KESEHATAN' THEN amount ELSE 0 END) AS potongan_bpjs_kesehatan,
    MAX(CASE WHEN component_key = 'BPJS_PENSIUN' THEN amount ELSE 0 END) AS potongan_bpjs_pensiun,
    MAX(CASE WHEN component_key = 'SPSI' THEN amount ELSE 0 END) AS potongan_spsi,
    MAX(CASE WHEN component_key = 'KOREKSI' THEN amount ELSE 0 END) AS potongan_koreksi,
    MAX(CASE WHEN component_key = 'PINJAMAN' THEN amount ELSE 0 END) AS potongan_pinjaman,
    
    -- TOTALS
    (
        MAX(CASE WHEN component_key = 'JABATAN' THEN amount ELSE 0 END) +
        MAX(CASE WHEN component_key = 'BERAS' THEN amount ELSE 0 END) +
        MAX(CASE WHEN component_key = 'MASA_KERJA' THEN amount ELSE 0 END) +
        MAX(CASE WHEN component_key = 'LEMBUR' THEN amount ELSE 0 END) +
        MAX(CASE WHEN component_key = 'PREMI_PANEN' THEN amount ELSE 0 END) +
        MAX(CASE WHEN component_key = 'PREMI_KINERJA' THEN amount ELSE 0 END) +
        MAX(CASE WHEN component_key = 'PREMI_BRONDOL' THEN amount ELSE 0 END) +
        MAX(CASE WHEN component_key = 'PREMI_INSENTIF' THEN amount ELSE 0 END)
    ) AS total_tunjangan,
    
    (
        MAX(CASE WHEN component_key = 'PPH21' THEN amount ELSE 0 END) +
        MAX(CASE WHEN component_key = 'BPJS_KESEHATAN' THEN amount ELSE 0 END) +
        MAX(CASE WHEN component_key = 'BPJS_PENSIUN' THEN amount ELSE 0 END) +
        MAX(CASE WHEN component_key = 'SPSI' THEN amount ELSE 0 END) +
        MAX(CASE WHEN component_key = 'KOREKSI' THEN amount ELSE 0 END) +
        MAX(CASE WHEN component_key = 'PINJAMAN' THEN amount ELSE 0 END)
    ) AS total_potongan

FROM (
    SELECT 
        RTRIM(t.EmpCode) AS emp_code,
        -- Normalisasi DocDesc menjadi component key
        CASE 
            -- TUNJANGAN
            WHEN UPPER(t.DocDesc) LIKE '%JABATAN%' THEN 'JABATAN'
            WHEN UPPER(t.DocDesc) LIKE '%BERAS%' THEN 'BERAS'
            WHEN UPPER(t.DocDesc) LIKE '%MASA%KERJA%' THEN 'MASA_KERJA'
            WHEN UPPER(t.DocDesc) LIKE '%LEMBUR%' THEN 'LEMBUR'
            
            -- PREMI
            WHEN UPPER(t.DocDesc) LIKE '%PREMI%PANEN%' OR UPPER(t.DocDesc) LIKE '%PREMI%AL%' THEN 'PREMI_PANEN'
            WHEN UPPER(t.DocDesc) LIKE '%PREMI%KINERJA%' THEN 'PREMI_KINERJA'
            WHEN UPPER(t.DocDesc) LIKE '%PREMI%BRONDOL%' THEN 'PREMI_BRONDOL'
            WHEN UPPER(t.DocDesc) LIKE '%PREMI%INSENTIF%' THEN 'PREMI_INSENTIF'
            WHEN UPPER(t.DocDesc) LIKE '%PREMI%' AND UPPER(t.DocDesc) NOT LIKE '%PPH%' THEN 'PREMI_LAIN'
            
            -- POTONGAN
            WHEN UPPER(t.DocDesc) LIKE '%PPH%' AND UPPER(t.DocDesc) NOT LIKE '%PREMI%' THEN 'PPH21'
            WHEN UPPER(t.DocDesc) LIKE '%BPJS%KESEHATAN%' THEN 'BPJS_KESEHATAN'
            WHEN UPPER(t.DocDesc) LIKE '%BPJS%PENSIUN%' THEN 'BPJS_PENSIUN'
            WHEN UPPER(t.DocDesc) LIKE '%SPSI%' THEN 'SPSI'
            WHEN UPPER(t.DocDesc) LIKE '%KOREKSI%' THEN 'KOREKSI'
            WHEN UPPER(t.DocDesc) LIKE '%PINJAM%' THEN 'PINJAMAN'
            
            -- LAINNYA
            ELSE 'LAINNYA'
        END AS component_key,
        SUM(ln.Amount) AS amount
    FROM (
        SELECT EmpCode, ID, DocDesc, DocDate
        FROM PR_ADTRANS
        WHERE RTRIM(EmpCode) IN (@EmpList)
          AND DocDate >= @StartDate AND DocDate < @EndDate

        UNION ALL

        SELECT EmpCode, ID, DocDesc, DocDate
        FROM PR_ADTRANS_ARC
        WHERE RTRIM(EmpCode) IN (@EmpList)
          AND DocDate >= @StartDate AND DocDate < @EndDate
    ) t
    JOIN (
        SELECT MasterID, TaskCode, Amount
        FROM PR_ADTRANSLN
        UNION ALL
        SELECT MasterID, TaskCode, Amount
        FROM PR_ADTRANSLN_ARC
    ) ln ON t.ID = ln.MasterID
    GROUP BY RTRIM(t.EmpCode), t.DocDesc
) AS SourceTable
GROUP BY emp_code
ORDER BY emp_code;
