-- Migration: Add immutable snapshot version columns to payroll history tables
-- This script upgrades existing payroll snapshot tables so multiple snapshot
-- versions can coexist without overwriting previous history rows.

IF NOT EXISTS (
    SELECT *
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo'
      AND TABLE_NAME = 'payroll_history_header'
      AND COLUMN_NAME = 'snapshot_batch_id'
)
BEGIN
    ALTER TABLE dbo.payroll_history_header
    ADD snapshot_batch_id BIGINT NULL;
END
GO

IF NOT EXISTS (
    SELECT *
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo'
      AND TABLE_NAME = 'payroll_history_header'
      AND COLUMN_NAME = 'snapshot_version'
)
BEGIN
    ALTER TABLE dbo.payroll_history_header
    ADD snapshot_version INT NULL;
END
GO

IF NOT EXISTS (
    SELECT *
    FROM sys.indexes
    WHERE name = 'IX_payroll_history_header_scope_snapshot'
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_payroll_history_header_scope_snapshot
    ON dbo.payroll_history_header (
        period_year ASC,
        period_month ASC,
        division_code ASC,
        gang_code ASC,
        snapshot_version DESC
    );
END
GO

IF NOT EXISTS (
    SELECT *
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo'
      AND TABLE_NAME = 'payroll_history_detail'
      AND COLUMN_NAME = 'snapshot_batch_id'
)
BEGIN
    ALTER TABLE dbo.payroll_history_detail
    ADD snapshot_batch_id BIGINT NULL;
END
GO

IF NOT EXISTS (
    SELECT *
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo'
      AND TABLE_NAME = 'payroll_history_detail'
      AND COLUMN_NAME = 'snapshot_version'
)
BEGIN
    ALTER TABLE dbo.payroll_history_detail
    ADD snapshot_version INT NULL;
END
GO

IF NOT EXISTS (
    SELECT *
    FROM sys.indexes
    WHERE name = 'IX_payroll_history_detail_master_snapshot'
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_payroll_history_detail_master_snapshot
    ON dbo.payroll_history_detail (
        master_id ASC,
        snapshot_version DESC
    );
END
GO

PRINT 'PAYROLL_SNAPSHOT_VERSION_COLUMNS_READY';
