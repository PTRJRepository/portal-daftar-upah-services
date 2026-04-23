-- Migration: Add HR History Tables
-- This script creates the tables for storing Employee and Gang history snapshots
-- Run this against extend_db_ptrj

-- 1. Table for Employee HR History
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[history_hr_employee]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[history_hr_employee] (
        [id] [int] IDENTITY(1,1) NOT NULL,
        [history_id] [varchar](50) NOT NULL,
        [period_month] [int] NOT NULL,
        [period_year] [int] NOT NULL,
        [nik] [varchar](50) NULL,
        [emp_code] [varchar](20) NOT NULL,
        [emp_name] [varchar](100) NULL,
        [company_code] [varchar](10) NULL,
        [division_code] [varchar](10) NULL,
        [loc_code] [varchar](20) NULL,
        [gang_code] [varchar](20) NULL,
        [job_code] [varchar](20) NULL,
        [position] [varchar](50) NULL,
        [jabatan] [varchar](100) NULL,
        [is_spsi_member] [bit] NULL,
        [join_date] [datetime] NULL,
        [terminate_date] [datetime] NULL,
        [status] [varchar](20) NULL,
        [employee_type] [varchar](20) NULL,
        [gender] [varchar](10) NULL,
        [religion] [varchar](20) NULL,
        [birth_place] [varchar](50) NULL,
        [birth_date] [datetime] NULL,
        [marital_status] [varchar](20) NULL,
        [tax_status] [varchar](20) NULL,
        [ptkp_beras] [varchar](20) NULL,
        [ptkp_pajak] [varchar](20) NULL,
        [upah_dasar] [decimal](18, 4) NULL,
        [total_hk] [decimal](10, 2) NULL,
        [source_table] [varchar](50) NOT NULL,
        [created_at] [datetime] DEFAULT GETDATE(),
        CONSTRAINT [PK_history_hr_employee] PRIMARY KEY CLUSTERED ([id] ASC)
    );
    
    CREATE NONCLUSTERED INDEX [IX_history_hr_employee_period] ON [dbo].[history_hr_employee]
    ([period_year] ASC, [period_month] ASC);
    
    CREATE NONCLUSTERED INDEX [IX_history_hr_employee_code] ON [dbo].[history_hr_employee]
    ([emp_code] ASC);
    
    CREATE NONCLUSTERED INDEX [IX_history_hr_employee_nik] ON [dbo].[history_hr_employee]
    ([nik] ASC);
END
GO

IF NOT EXISTS (
    SELECT *
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'history_hr_employee'
      AND COLUMN_NAME = 'jabatan'
)
BEGIN
    ALTER TABLE [dbo].[history_hr_employee]
    ADD [jabatan] [varchar](100) NULL;
END
GO

IF NOT EXISTS (
    SELECT *
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'history_hr_employee'
      AND COLUMN_NAME = 'is_spsi_member'
)
BEGIN
    ALTER TABLE [dbo].[history_hr_employee]
    ADD [is_spsi_member] [bit] NULL;
END
GO

-- 2. Table for Gang HR History
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[history_hr_gang]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[history_hr_gang] (
        [id] [int] IDENTITY(1,1) NOT NULL,
        [history_id] [varchar](50) NOT NULL,
        [period_month] [int] NOT NULL,
        [period_year] [int] NOT NULL,
        [division_code] [varchar](10) NULL,
        [loc_code] [varchar](20) NULL,
        [gang_code] [varchar](20) NOT NULL,
        [gang_description] [varchar](100) NULL,
        [mandor_code] [varchar](20) NULL,
        [mandor_name] [varchar](100) NULL,
        [mandor_1_code] [varchar](20) NULL,
        [mandor_1_name] [varchar](100) NULL,
        [assistant_code] [varchar](20) NULL,
        [assistant_name] [varchar](100) NULL,
        [total_members] [int] NULL,
        [is_active] [bit] NULL,
        [source_table] [varchar](50) NOT NULL,
        [created_at] [datetime] DEFAULT GETDATE(),
        CONSTRAINT [PK_history_hr_gang] PRIMARY KEY CLUSTERED ([id] ASC)
    );
    
    CREATE NONCLUSTERED INDEX [IX_history_hr_gang_period] ON [dbo].[history_hr_gang]
    ([period_year] ASC, [period_month] ASC);
    
    CREATE NONCLUSTERED INDEX [IX_history_hr_gang_code] ON [dbo].[history_hr_gang]
    ([gang_code] ASC);
END
GO
