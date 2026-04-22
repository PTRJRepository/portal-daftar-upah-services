-- Migration: Add append-only payroll overlay history and snapshot batch tables
-- This script creates overlay tables for editable payroll fields and immutable
-- snapshot batch metadata in extend_db_ptrj.

-- ============================================================================
-- 1. employee_profile_override_history
-- ============================================================================
IF NOT EXISTS (
    SELECT *
    FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[dbo].[employee_profile_override_history]')
      AND type IN (N'U')
)
BEGIN
    CREATE TABLE [dbo].[employee_profile_override_history] (
        [id] BIGINT IDENTITY(1,1) NOT NULL,
        [emp_code] NVARCHAR(32) NOT NULL,
        [nik] NVARCHAR(32) NULL,
        [is_spsi_member] BIT NOT NULL,
        [effective_start_date] DATE NULL,
        [employee_status_at_change] NVARCHAR(32) NULL,
        [update_index] INT NOT NULL,
        [change_source] NVARCHAR(64) NOT NULL,
        [change_reason] NVARCHAR(255) NULL,
        [changed_by] NVARCHAR(128) NOT NULL,
        [created_at] DATETIME2 NOT NULL
            CONSTRAINT [DF_profile_override_created_at] DEFAULT SYSUTCDATETIME(),
        [is_active_record] BIT NOT NULL
            CONSTRAINT [DF_profile_override_active] DEFAULT 1,
        CONSTRAINT [PK_employee_profile_override_history]
            PRIMARY KEY CLUSTERED ([id] ASC)
    );

    CREATE NONCLUSTERED INDEX [IX_profile_override_emp_update]
        ON [dbo].[employee_profile_override_history] ([emp_code] ASC, [update_index] DESC);
END
GO

-- ============================================================================
-- 2. payroll_value_override_history
-- ============================================================================
IF NOT EXISTS (
    SELECT *
    FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[dbo].[payroll_value_override_history]')
      AND type IN (N'U')
)
BEGIN
    CREATE TABLE [dbo].[payroll_value_override_history] (
        [id] BIGINT IDENTITY(1,1) NOT NULL,
        [period_month] INT NOT NULL,
        [period_year] INT NOT NULL,
        [division_code] NVARCHAR(32) NOT NULL,
        [gang_code] NVARCHAR(32) NOT NULL,
        [emp_code] NVARCHAR(32) NOT NULL,
        [nik] NVARCHAR(32) NULL,
        [field_name] NVARCHAR(64) NOT NULL,
        [field_group] NVARCHAR(32) NOT NULL,
        [numeric_value] DECIMAL(18,2) NULL,
        [text_value] NVARCHAR(255) NULL,
        [update_index] INT NOT NULL,
        [change_source] NVARCHAR(64) NOT NULL,
        [change_reason] NVARCHAR(255) NULL,
        [changed_by] NVARCHAR(128) NOT NULL,
        [created_at] DATETIME2 NOT NULL
            CONSTRAINT [DF_value_override_created_at] DEFAULT SYSUTCDATETIME(),
        [is_active_record] BIT NOT NULL
            CONSTRAINT [DF_value_override_active] DEFAULT 1,
        CONSTRAINT [PK_payroll_value_override_history]
            PRIMARY KEY CLUSTERED ([id] ASC)
    );

    CREATE NONCLUSTERED INDEX [IX_payroll_value_override_scope_update]
        ON [dbo].[payroll_value_override_history] (
            [period_year] ASC,
            [period_month] ASC,
            [division_code] ASC,
            [gang_code] ASC,
            [emp_code] ASC,
            [field_name] ASC,
            [update_index] DESC
        );
END
GO

-- ============================================================================
-- 3. payroll_snapshot_batch
-- ============================================================================
IF NOT EXISTS (
    SELECT *
    FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[dbo].[payroll_snapshot_batch]')
      AND type IN (N'U')
)
BEGIN
    CREATE TABLE [dbo].[payroll_snapshot_batch] (
        [id] BIGINT IDENTITY(1,1) NOT NULL,
        [period_month] INT NOT NULL,
        [period_year] INT NOT NULL,
        [division_code] NVARCHAR(32) NOT NULL,
        [gang_code] NVARCHAR(32) NOT NULL,
        [snapshot_version] INT NOT NULL,
        [base_source] NVARCHAR(64) NOT NULL,
        [overlay_profile_cutoff] DATETIME2 NULL,
        [overlay_value_cutoff] DATETIME2 NULL,
        [created_by] NVARCHAR(128) NOT NULL,
        [created_at] DATETIME2 NOT NULL
            CONSTRAINT [DF_snapshot_batch_created_at] DEFAULT SYSUTCDATETIME(),
        [status] NVARCHAR(32) NOT NULL,
        [notes] NVARCHAR(255) NULL,
        CONSTRAINT [PK_payroll_snapshot_batch]
            PRIMARY KEY CLUSTERED ([id] ASC)
    );

    CREATE UNIQUE NONCLUSTERED INDEX [IX_payroll_snapshot_batch_scope_version]
        ON [dbo].[payroll_snapshot_batch] (
            [period_year] ASC,
            [period_month] ASC,
            [division_code] ASC,
            [gang_code] ASC,
            [snapshot_version] ASC
        );
END
GO

PRINT 'PAYROLL_OVERLAY_HISTORY_TABLES_READY';
