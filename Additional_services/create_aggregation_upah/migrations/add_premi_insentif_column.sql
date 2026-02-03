-- Migration: Add total_premi_insentif column to daftar_upah_aggregation_history
-- Date: 2026-02-03
-- Description: Add column to track insentif panen (harvest incentives) separately from dynamic_premi_data
-- This column stores the sum of all premi headers containing "INSENTIF"

USE extend_db_ptrj;
GO

-- Check if column exists, if not add it
IF NOT EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.daftar_upah_aggregation_history')
    AND name = 'total_premi_insentif'
)
BEGIN
    ALTER TABLE dbo.daftar_upah_aggregation_history
    ADD total_premi_insentif DECIMAL(18,2) NULL;

    PRINT 'Column total_premi_insentif added successfully.';
END
ELSE
BEGIN
    PRINT 'Column total_premi_insentif already exists.';
END
GO

-- Update existing records: calculate total_premi_insentif from dynamic_premi_data
-- This extracts all headers containing "INSENTIF" from the JSON data
UPDATE dbo.daftar_upah_aggregation_history
SET total_premi_insentif = (
    SELECT SUM(CAST(JSON_VALUE(value, '$.total') AS DECIMAL(18,2)))
    FROM OPENJSON(dynamic_premi_data)
    WHERE JSON_VALUE(value, '$.header') LIKE '%INSENTIF%'
)
WHERE dynamic_premi_data IS NOT NULL
  AND ISJSON(dynamic_premi_data) = 1;
GO

PRINT 'Migration completed: Existing records updated with total_premi_insentif values.';
GO
