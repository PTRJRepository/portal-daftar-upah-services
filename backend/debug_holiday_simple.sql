-- DEBUG: Check 2026-01-16 holiday data in HR_GPH
-- Run this query in SSMS or your database tool

-- 1. Check specific date 2026-01-16
SELECT
    HolidayDate,
    Description,
    IsRegionPH,
    Status,
    CASE
        WHEN IsRegionPH = 1 THEN 'Libur Keagamaan (3-4-4 pattern)'
        ELSE 'Libur Umum (2-3-4 pattern)'
    END AS HolidayType,
    CASE
        WHEN Status = 1 THEN 'Aktif'
        ELSE 'Tidak Aktif'
    END AS StatusDesc
FROM HR_GPH
WHERE HolidayDate = '2026-01-16'

-- 2. Check all holidays in January 2026
SELECT
    HolidayDate,
    Description,
    IsRegionPH,
    Status,
    CASE
        WHEN IsRegionPH = 1 THEN 'Libur Keagamaan'
        ELSE 'Libur Umum'
    END AS HolidayType
FROM HR_GPH
WHERE YEAR(HolidayDate) = 2026
  AND MONTH(HolidayDate) = 1
  AND Status = 1
ORDER BY HolidayDate

-- 3. Check if there are duplicate records for same date
SELECT
    HolidayDate,
    COUNT(*) AS RecordCount,
    STRING_AGG(GPHCode, ', ') AS GPHCodes
FROM HR_GPH
WHERE HolidayDate = '2026-01-16'
GROUP BY HolidayDate

-- 4. Sample calculation comparison
-- For 10 jam overtime with UPJ 17257:
DECLARE @UPJ DECIMAL(18,2) = 17257
DECLARE @Hours INT = 10

-- Regular Holiday (2-3-4): 7h @ 2x + 1h @ 3x + 2h @ 4x
DECLARE @RegularAmount DECIMAL(18,2) = (@UPJ * 2.0 * 7) + (@UPJ * 3.0 * 1) + (@UPJ * 4.0 * 2)

-- Religious Holiday (3-4-4): 7h @ 3x + 3h @ 4x
DECLARE @ReligiousAmount DECIMAL(18,2) = (@UPJ * 3.0 * 7) + (@UPJ * 4.0 * 3)

SELECT
    @UPJ AS UPJ,
    @Hours AS JamLembur,
    @RegularAmount AS RegularHolidayAmount,
    @ReligiousAmount AS ReligiousHolidayAmount,
    @ReligiousAmount - @RegularAmount AS Selisih
