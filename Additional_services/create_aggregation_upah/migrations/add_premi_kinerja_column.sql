-- Migration: Add total_premi_kinerja column to daftar_upah_aggregation_history
-- Date: 2026-02-03
-- Description: Add column to track kinerja (performance bonuses) separately from dynamic_premi_data
-- This column stores the sum of all premi headers containing "KINERJA"

USE extend_db_ptrj;
GO

-- Check if column exists, if not add it
IF NOT EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.daftar_upah_aggregation_history')
    AND name = 'total_premi_kinerja'
)
BEGIN
    ALTER TABLE dbo.daftar_upah_aggregation_history
    ADD total_premi_kinerja DECIMAL(18,2) NULL;

    PRINT 'Column total_premi_kinerja added successfully.';
END
ELSE
BEGIN
    PRINT 'Column total_premi_kinerja already exists.';
END
GO

-- Update existing records: calculate total_premi_kinerja from dynamic_premi_data
-- This extracts all headers containing "KINERJA" from the JSON data
UPDATE dbo.daftar_upah_aggregation_history
SET total_premi_kinerja = (
    SELECT SUM(CAST(JSON_VALUE(value, '$.total') AS DECIMAL(18,2)))
    FROM OPENJSON(dynamic_premi_data)
    WHERE JSON_VALUE(value, '$.header') LIKE '%KINERJA%'
)
WHERE dynamic_premi_data IS NOT NULL
  AND ISJSON(dynamic_premi_data) = 1;
GO

PRINT 'Migration completed: Existing records updated with total_premi_kinerja values.';
GO
