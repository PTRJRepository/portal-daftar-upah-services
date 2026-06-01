-- Migration: Add unique index and computed column for dedup on payroll_manual_adjustments
-- Run this ONCE on the database before deploying the MERGE-based saveAdjustment.
-- Safe to run multiple times (IF NOT EXISTS guards).
--
-- STEP 1: Audit duplicates first (run this SELECT, fix manually if any rows returned)
-- SELECT period_month, period_year, emp_code, adjustment_type,
--        UPPER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(adjustment_name, CHAR(9),' '),CHAR(10),' '),CHAR(13),' ')))) AS norm_name,
--        COUNT(*) AS cnt
-- FROM dbo.payroll_manual_adjustments
-- GROUP BY period_month, period_year, emp_code, adjustment_type,
--          UPPER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(adjustment_name, CHAR(9),' '),CHAR(10),' '),CHAR(13),' '))))
-- HAVING COUNT(*) > 1;

-- STEP 2: Add persisted computed column for normalized name
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE name = 'adjustment_name_norm'
      AND object_id = OBJECT_ID('dbo.payroll_manual_adjustments')
)
BEGIN
    ALTER TABLE dbo.payroll_manual_adjustments
    ADD adjustment_name_norm AS (
        UPPER(LTRIM(RTRIM(
            REPLACE(REPLACE(REPLACE(REPLACE(
                adjustment_name,
                CHAR(9), ' '), CHAR(10), ' '), CHAR(13), ' '), CHAR(160), ' ')
        )))
    ) PERSISTED;
END

-- STEP 3: Add unique index (prevents race condition duplicates)
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UX_pma_dedup'
      AND object_id = OBJECT_ID('dbo.payroll_manual_adjustments')
)
BEGIN
    CREATE UNIQUE INDEX UX_pma_dedup
    ON dbo.payroll_manual_adjustments(period_month, period_year, emp_code, adjustment_type, adjustment_name_norm)
    WHERE emp_code IS NOT NULL;
END

-- STEP 4: Add query performance index
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_pma_period_div_emp'
      AND object_id = OBJECT_ID('dbo.payroll_manual_adjustments')
)
BEGIN
    CREATE INDEX IX_pma_period_div_emp
    ON dbo.payroll_manual_adjustments(period_month, period_year, division_code, emp_code)
    INCLUDE (adjustment_type, adjustment_name, amount);
END
