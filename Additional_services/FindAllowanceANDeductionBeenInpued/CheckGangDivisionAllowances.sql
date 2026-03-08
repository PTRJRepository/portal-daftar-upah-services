-- ============================================================================
-- QUERY: Check All Employees in Gang/Division - Allowances & Deductions
-- ============================================================================
-- Purpose: Melihat semua tunjangan dan potongan untuk semua karyawan
--          dalam satu gang atau divisi tertentu
-- 
-- Usage:
--   1. Update @GangCode dengan kode gang yang ingin dicek (atau NULL untuk semua)
--   2. Update @DivisionCode dengan kode divisi (atau NULL untuk semua)
--   3. Update @StartDate dan @EndDate dengan periode yang diinginkan
--   4. Run query untuk melihat breakdown per karyawan dalam gang/divisi
-- ============================================================================

DECLARE @GangCode VARCHAR(50) = 'A01';      -- Kode gang (NULL untuk semua)
DECLARE @DivisionCode VARCHAR(50) = 'P1A';  -- Kode divisi (NULL untuk semua)
DECLARE @StartDate DATE = '2025-05-01';     -- Periode mulai
DECLARE @EndDate DATE = '2025-06-01';       -- Periode akhir

-- ============================================================================
-- PART 3: CHECK SEMUA KARYAWAN DALAM GANG/DIVISI
-- ============================================================================
SELECT 
    RTRIM(t.EmpCode) AS emp_code,
    hr.EmpName AS emp_name,
    hr.GangCode AS gang_code,
    hr.LocCode AS division_code,
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
        
        ELSE 'LAINNYA'
    END AS component_category
FROM (
    SELECT EmpCode, ID, DocDesc, DocDate
    FROM PR_ADTRANS
    WHERE DocDate >= @StartDate AND DocDate < @EndDate

    UNION ALL

    SELECT EmpCode, ID, DocDesc, DocDate
    FROM PR_ADTRANS_ARC
    WHERE DocDate >= @StartDate AND DocDate < @EndDate
) t
JOIN (
    SELECT MasterID, TaskCode, Amount
    FROM PR_ADTRANSLN
    UNION ALL
    SELECT MasterID, TaskCode, Amount
    FROM PR_ADTRANSLN_ARC
) ln ON t.ID = ln.MasterID
LEFT JOIN PR_TASKCODE mt ON ln.TaskCode = mt.TaskCode
LEFT JOIN HR_EMPLOYEE hr ON RTRIM(t.EmpCode) = RTRIM(hr.EmpCode)
WHERE ln.Amount > 0
  AND (@GangCode IS NULL OR hr.GangCode = @GangCode)
  AND (@DivisionCode IS NULL OR hr.LocCode = @DivisionCode)
GROUP BY RTRIM(t.EmpCode), hr.EmpName, hr.GangCode, hr.LocCode, t.DocDesc, ln.TaskCode, mt.TaskDesc
ORDER BY hr.GangCode, RTRIM(t.EmpCode), component_category;
