-- =============================================================================
-- MIGRATION: Create History Metadata Table
-- Database: extend_db_ptrj_transaksi
-- Description: Tracking semua operasi history (create, update, delete, lock)
-- =============================================================================

USE extend_db_ptrj_transaksi;
GO

-- =============================================================================
-- TABEL: history_metadata
-- Tracking semua operasi history untuk audit trail
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[history_metadata]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[history_metadata] (
        [id] [bigint] IDENTITY(1,1) NOT NULL,
        [history_id] [varchar](50) NOT NULL,              -- UUID grouping
        [operation] [varchar](50) NOT NULL,               -- 'CREATE', 'UPDATE', 'DELETE', 'LOCK', 'UNLOCK', 'ARCHIVE', 'RESTORE'
        [entity_type] [varchar](50) NOT NULL,             -- 'PAYROLL_MASTER', 'PAYROLL_DETAIL', 'TASKREG', 'ADTRANS', 'GANG_MEMBER', 'BATCH'
        [entity_id] [bigint] NULL,                        -- ID spesifik entity (jika ada)
        
        -- Data Period
        [period_month] [int] NOT NULL,
        [period_year] [int] NOT NULL,
        [division_code] [varchar](50) NULL,
        [gang_code] [varchar](50) NULL,
        
        -- Detail Operasi
        [description] [nvarchar](1000) NULL,
        [old_values] [nvarchar](max) NULL,                -- JSON (untuk UPDATE)
        [new_values] [nvarchar](max) NULL,                -- JSON
        [record_count] [int] NULL,                        -- Jumlah record yang terpengaruh
        
        -- Error/Status tracking
        [status] [varchar](50) NOT NULL DEFAULT 'SUCCESS', -- 'SUCCESS', 'FAILED', 'PENDING', 'ROLLBACK'
        [error_message] [nvarchar](2000) NULL,
        
        -- Audit
        [performed_by] [varchar](100) NOT NULL,
        [performed_at] [datetime] NOT NULL DEFAULT GETDATE(),
        [ip_address] [varchar](50) NULL,
        [user_agent] [varchar](500) NULL,
        [session_id] [varchar](100) NULL,
        
        CONSTRAINT [PK_history_metadata] PRIMARY KEY CLUSTERED ([id] ASC)
    );
    
    PRINT 'Table history_metadata created successfully.';
END
ELSE
BEGIN
    PRINT 'Table history_metadata already exists.';
END
GO

-- Indexes untuk history_metadata
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_history_metadata_history_id' AND object_id = OBJECT_ID('dbo.history_metadata'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_history_metadata_history_id] 
        ON [dbo].[history_metadata] ([history_id]);
    PRINT 'Index IX_history_metadata_history_id created.';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_history_metadata_period' AND object_id = OBJECT_ID('dbo.history_metadata'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_history_metadata_period] 
        ON [dbo].[history_metadata] ([period_year], [period_month]);
    PRINT 'Index IX_history_metadata_period created.';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_history_metadata_operation' AND object_id = OBJECT_ID('dbo.history_metadata'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_history_metadata_operation] 
        ON [dbo].[history_metadata] ([operation], [performed_at]);
    PRINT 'Index IX_history_metadata_operation created.';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_history_metadata_entity' AND object_id = OBJECT_ID('dbo.history_metadata'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_history_metadata_entity] 
        ON [dbo].[history_metadata] ([entity_type], [entity_id]);
    PRINT 'Index IX_history_metadata_entity created.';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_history_metadata_performed_by' AND object_id = OBJECT_ID('dbo.history_metadata'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_history_metadata_performed_by] 
        ON [dbo].[history_metadata] ([performed_by], [performed_at]);
    PRINT 'Index IX_history_metadata_performed_by created.';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_history_metadata_status' AND object_id = OBJECT_ID('dbo.history_metadata'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_history_metadata_status] 
        ON [dbo].[history_metadata] ([status], [performed_at]);
    PRINT 'Index IX_history_metadata_status created.';
END
GO

-- =============================================================================
-- VIEW: Untuk memudahkan monitoring history operations
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sys.views WHERE name = 'vw_history_operations_summary')
BEGIN
    EXEC('
    CREATE VIEW [dbo].[vw_history_operations_summary] AS
    SELECT 
        period_year,
        period_month,
        division_code,
        gang_code,
        operation,
        entity_type,
        status,
        COUNT(*) as operation_count,
        SUM(CASE WHEN status = ''SUCCESS'' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status = ''FAILED'' THEN 1 ELSE 0 END) as failed_count,
        MAX(performed_at) as last_operation_at,
        MAX(performed_by) as last_performed_by
    FROM dbo.history_metadata
    GROUP BY period_year, period_month, division_code, gang_code, operation, entity_type, status
    ');
    PRINT 'View vw_history_operations_summary created.';
END
ELSE
BEGIN
    PRINT 'View vw_history_operations_summary already exists.';
END
GO

-- =============================================================================
-- STORED PROCEDURE: Get history audit trail
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_get_history_audit_trail')
BEGIN
    EXEC('
    CREATE PROCEDURE [dbo].[sp_get_history_audit_trail]
        @history_id VARCHAR(50) = NULL,
        @period_month INT = NULL,
        @period_year INT = NULL,
        @division_code VARCHAR(50) = NULL,
        @gang_code VARCHAR(50) = NULL,
        @operation VARCHAR(50) = NULL,
        @performed_by VARCHAR(100) = NULL,
        @start_date DATETIME = NULL,
        @end_date DATETIME = NULL
    AS
    BEGIN
        SET NOCOUNT ON;
        
        SELECT 
            id,
            history_id,
            operation,
            entity_type,
            entity_id,
            period_month,
            period_year,
            division_code,
            gang_code,
            description,
            old_values,
            new_values,
            record_count,
            status,
            error_message,
            performed_by,
            performed_at,
            ip_address,
            user_agent
        FROM dbo.history_metadata
        WHERE (@history_id IS NULL OR history_id = @history_id)
          AND (@period_month IS NULL OR period_month = @period_month)
          AND (@period_year IS NULL OR period_year = @period_year)
          AND (@division_code IS NULL OR division_code = @division_code)
          AND (@gang_code IS NULL OR gang_code = @gang_code)
          AND (@operation IS NULL OR operation = @operation)
          AND (@performed_by IS NULL OR performed_by = @performed_by)
          AND (@start_date IS NULL OR performed_at >= @start_date)
          AND (@end_date IS NULL OR performed_at <= @end_date)
        ORDER BY performed_at DESC;
    END
    ');
    PRINT 'Stored procedure sp_get_history_audit_trail created.';
END
ELSE
BEGIN
    PRINT 'Stored procedure sp_get_history_audit_trail already exists.';
END
GO

PRINT 'Migration 003 completed successfully.';
GO
