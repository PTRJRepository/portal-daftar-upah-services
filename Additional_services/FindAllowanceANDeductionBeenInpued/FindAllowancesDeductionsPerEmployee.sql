-- ============================================================================
-- QUERY: Find All Allowances and Deductions Per Employee
-- ============================================================================
-- Purpose: Melihat semua tunjangan dan potongan yang diinput per karyawan
-- Source Tables: PR_ADTRANS_ARC, PR_ADTRANSLN_ARC, PR_TASKCODE
-- 
-- Usage:
--   1. Update @EmpCode dengan kode karyawan yang ingin dicek
--   2. Update @StartDate dan @EndDate dengan periode yang diinginkan
--   3. Run query untuk melihat breakdown lengkap
-- ============================================================================

DECLARE @EmpCode VARCHAR(50) = 'H0033';  -- Ganti dengan kode karyawan
DECLARE @StartDate DATE = '2025-05-01';   -- Periode mulai
DECLARE @EndDate DATE = '2025-06-01';     -- Periode akhir

-- ============================================================================
-- PART 1: SEMUA KOMPONEN PAYROLL PER KARYAWAN
-- ============================================================================
SELECT 
    RTRIM(t.EmpCode) AS emp_code,
    t.DocDesc AS doc_desc,
    ln.TaskCode AS task_code,
    mt.TaskDesc AS task_desc,
    SUM(ln.Amount) AS amount,
    CASE 
        -- TUNJANGAN (Allowances)
        WHEN UPPER(t.DocDesc) LIKE '%JABATAN%' THEN 'TUNJANGAN_JABATAN'
        WHEN UPPER(t.DocDesc) LIKE '%BERAS%' THEN 'TUNJANGAN_BERAS'
        WHEN UPPER(t.DocDesc) LIKE '%MASA%KERJA%' THEN 'TUNJANGAN_MASA_KERJA'
        WHEN UPPER(t.DocDesc) LIKE '%LEMBUR%' THEN 'TUNJANGAN_LEMBUR'
        
        -- PREMI (Dynamic Allowances)
        WHEN UPPER(t.DocDesc) LIKE '%PREMI%PANEN%' OR UPPER(t.DocDesc) LIKE '%PREMI%AL%' THEN 'PREMI_PANEN'
        WHEN UPPER(t.DocDesc) LIKE '%PREMI%KINERJA%' THEN 'PREMI_KINERJA'
        WHEN UPPER(t.DocDesc) LIKE '%PREMI%BRONDOL%' THEN 'PREMI_BRONDOL'
        WHEN UPPER(t.DocDesc) LIKE '%PREMI%INSENTIF%' THEN 'PREMI_INSENTIF'
        WHEN UPPER(t.DocDesc) LIKE '%PREMI%' AND UPPER(t.DocDesc) NOT LIKE '%PPH%' THEN 'PREMI_LAIN'
        
        -- POTONGAN (Deductions)
        WHEN UPPER(t.DocDesc) LIKE '%PPH%' AND UPPER(t.DocDesc) NOT LIKE '%PREMI%' THEN 'POTONGAN_PPH21'
        WHEN UPPER(t.DocDesc) LIKE '%BPJS%KESEHATAN%' THEN 'POTONGAN_BPJS_KESEHATAN'
        WHEN UPPER(t.DocDesc) LIKE '%BPJS%PENSIUN%' THEN 'POTONGAN_BPJS_PENSIUN'
        WHEN UPPER(t.DocDesc) LIKE '%SPSI%' THEN 'POTONGAN_SPSI'
        WHEN UPPER(t.DocDesc) LIKE '%KOREKSI%' THEN 'POTONGAN_KOREKSI'
        WHEN UPPER(t.DocDesc) LIKE '%PINJAM%' THEN 'POTONGAN_PINJAMAN'
        WHEN UPPER(t.DocDesc) LIKE '%POT%' THEN 'POTONGAN_LAIN'
        WHEN UPPER(t.DocDesc) LIKE '%BPJS%' THEN 'POTONGAN_BPJS'
        
        -- SPECIAL CASES
        WHEN UPPER(t.DocDesc) LIKE '%ACCRUALS%' THEN 'PREMI_PPH_SPECIAL'
        ELSE 'LAINNYA'
    END AS component_category,
    CASE 
        WHEN UPPER(t.DocDesc) LIKE '%JABATAN%' 
             OR UPPER(t.DocDesc) LIKE '%BERAS%' 
             OR UPPER(t.DocDesc) LIKE '%MASA%KERJA%' 
             OR UPPER(t.DocDesc) LIKE '%LEMBUR%'
             OR (UPPER(t.DocDesc) LIKE '%PREMI%' AND UPPER(t.DocDesc) NOT LIKE '%PPH%')
            THEN 'TUNJANGAN'
        WHEN UPPER(t.DocDesc) LIKE '%PPH%' AND UPPER(t.DocDesc) NOT LIKE '%PREMI%'
             OR UPPER(t.DocDesc) LIKE '%BPJS%'
             OR UPPER(t.DocDesc) LIKE '%SPSI%'
             OR UPPER(t.DocDesc) LIKE '%KOREKSI%'
             OR UPPER(t.DocDesc) LIKE '%PINJAM%'
             OR UPPER(t.DocDesc) LIKE '%POT%'
            THEN 'POTONGAN'
        ELSE 'LAINNYA'
    END AS major_category
FROM (
    -- Gabung data dari tabel aktif dan archive
    SELECT EmpCode, ID, DocDesc, DocDate
    FROM PR_ADTRANS
    WHERE RTRIM(EmpCode) = @EmpCode
      AND DocDate >= @StartDate 
      AND DocDate < @EndDate

    UNION ALL

    SELECT EmpCode, ID, DocDesc, DocDate
    FROM PR_ADTRANS_ARC
    WHERE RTRIM(EmpCode) = @EmpCode
      AND DocDate >= @StartDate 
      AND DocDate < @EndDate
) t
JOIN (
    -- Gabung detail dari tabel aktif dan archive
    SELECT MasterID, TaskCode, Amount
    FROM PR_ADTRANSLN
    UNION ALL
    SELECT MasterID, TaskCode, Amount
    FROM PR_ADTRANSLN_ARC
) ln ON t.ID = ln.MasterID
LEFT JOIN PR_TASKCODE mt ON ln.TaskCode = mt.TaskCode
WHERE ln.Amount > 0  -- Hanya yang ada amount positif
GROUP BY RTRIM(t.EmpCode), t.DocDesc, ln.TaskCode, mt.TaskDesc
ORDER BY 
    major_category,
    component_category,
    t.DocDesc;
