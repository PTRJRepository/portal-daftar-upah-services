-- Migration: Add TBS Weight Column to Aggregation History Table
-- Date: 2026-01-05
-- Purpose: Support month-over-month comparison feature with TBS (FFB) weight tracking

-- Add total_weight_tbs column to store FFB weight in tons
ALTER TABLE [extend_db_ptrj].[dbo].[daftar_upah_aggregation_history]
ADD total_weight_tbs DECIMAL(18, 2) NULL;

-- Add comment explaining the column
EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'Total TBS (Fresh Fruit Bunch / FFB) weight in tons for the division/gang, fetched from WM_TICKET table by seeder', 
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'daftar_upah_aggregation_history',
    @level2type = N'COLUMN', @level2name = N'total_weight_tbs';

PRINT 'Successfully added total_weight_tbs column to daftar_upah_aggregation_history';
