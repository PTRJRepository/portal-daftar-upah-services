-- =============================================================================
-- MIGRATION: Create Transaction History Tables
-- Database: extend_db_ptrj_transaksi
-- Description: Tabel untuk menyimpan detail transaksi (Taskreg, ADTrans, Gang)
-- =============================================================================

USE extend_db_ptrj_transaksi;
GO

-- =============================================================================
-- TABEL 1: history_taskreg
-- Menyimpan data transaksi absensi/kehadiran dari PR_TASKREG dan PR_TASKREGLN
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[history_taskreg]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[history_taskreg] (
        [id] [bigint] IDENTITY(1,1) NOT NULL,
        [history_id] [varchar](50) NOT NULL,              -- Grouping dengan payroll_history
        
        -- Data dari PR_TASKREG
        [original_master_id] [bigint] NULL,               -- ID asli dari PR_TASKREG (jika ada)
        [reg_no] [varchar](50) NULL,
        [reg_date] [datetime] NULL,
        [emp_code] [varchar](50) NOT NULL,
        [gang_code] [varchar](50) NULL,
        [division_code] [varchar](50) NULL,
        
        -- Data dari PR_TASKREGLN
        [original_line_id] [bigint] NULL,                 -- ID asli dari PR_TASKREGLN (jika ada)
        [line_no] [int] NULL,
        [trx_date] [date] NOT NULL,
        [task_code] [varchar](50) NULL,
        [task_desc] [nvarchar](255) NULL,
        [hours] [decimal](18, 2) NOT NULL DEFAULT 0,
        [ot] [bit] NOT NULL DEFAULT 0,                    -- Overtime flag
        [rate] [decimal](18, 2) NULL,
        [amount] [decimal](18, 2) NOT NULL DEFAULT 0,
        [tapping_type] [varchar](50) NULL,
        [location_code] [varchar](50) NULL,
        [status] [varchar](50) NULL,
        
        -- Kategori (diklasifikasikan saat insert)
        [is_cuti_tahunan] [bit] NOT NULL DEFAULT 0,
        [is_cuti_sakit] [bit] NOT NULL DEFAULT 0,
        [is_cuti_minggu] [bit] NOT NULL DEFAULT 0,
        [is_cuti_nasional] [bit] NOT NULL DEFAULT 0,
        [is_hari_kerja] [bit] NOT NULL DEFAULT 0,
        [is_lembur] [bit] NOT NULL DEFAULT 0,
        
        -- Metadata
        [period_month] [int] NOT NULL,
        [period_year] [int] NOT NULL,
        [created_at] [datetime] NOT NULL DEFAULT GETDATE(),
        [source_table] [varchar](50) NOT NULL,            -- 'PR_TASKREG' atau 'PR_TASKREG_ARC'
        
        CONSTRAINT [PK_history_taskreg] PRIMARY KEY CLUSTERED ([id] ASC)
    );
    
    PRINT 'Table history_taskreg created successfully.';
END
ELSE
BEGIN
    PRINT 'Table history_taskreg already exists.';
END
GO

-- Indexes untuk history_taskreg
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_history_taskreg_history_id' AND object_id = OBJECT_ID('dbo.history_taskreg'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_history_taskreg_history_id] 
        ON [dbo].[history_taskreg] ([history_id]);
    PRINT 'Index IX_history_taskreg_history_id created.';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_history_taskreg_emp' AND object_id = OBJECT_ID('dbo.history_taskreg'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_history_taskreg_emp] 
        ON [dbo].[history_taskreg] ([emp_code], [period_year], [period_month]);
    PRINT 'Index IX_history_taskreg_emp created.';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_history_taskreg_date' AND object_id = OBJECT_ID('dbo.history_taskreg'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_history_taskreg_date] 
        ON [dbo].[history_taskreg] ([trx_date]);
    PRINT 'Index IX_history_taskreg_date created.';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_history_taskreg_period' AND object_id = OBJECT_ID('dbo.history_taskreg'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_history_taskreg_period] 
        ON [dbo].[history_taskreg] ([period_year], [period_month]);
    PRINT 'Index IX_history_taskreg_period created.';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_history_taskreg_gang' AND object_id = OBJECT_ID('dbo.history_taskreg'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_history_taskreg_gang] 
        ON [dbo].[history_taskreg] ([gang_code]);
    PRINT 'Index IX_history_taskreg_gang created.';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_history_taskreg_task' AND object_id = OBJECT_ID('dbo.history_taskreg'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_history_taskreg_task] 
        ON [dbo].[history_taskreg] ([task_code]);
    PRINT 'Index IX_history_taskreg_task created.';
END
GO

-- =============================================================================
-- TABEL 2: history_adtrans
-- Menyimpan data transaksi tunjangan/potongan/premi dari PR_ADTRANS dan PR_ADTRANSLN
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[history_adtrans]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[history_adtrans] (
        [id] [bigint] IDENTITY(1,1) NOT NULL,
        [history_id] [varchar](50) NOT NULL,              -- Grouping dengan payroll_history
        
        -- Data dari PR_ADTRANS
        [original_master_id] [bigint] NULL,               -- ID asli dari PR_ADTRANS
        [doc_no] [varchar](50) NULL,
        [doc_date] [date] NOT NULL,
        [doc_desc] [nvarchar](500) NULL,                  -- Deskripsi dokumen
        [emp_code] [varchar](50) NOT NULL,
        [gang_code] [varchar](50) NULL,
        [division_code] [varchar](50) NULL,
        
        -- Data dari PR_ADTRANSLN
        [original_line_id] [bigint] NULL,                 -- ID asli dari PR_ADTRANSLN
        [line_no] [int] NULL,
        [task_code] [varchar](50) NULL,
        [task_desc] [nvarchar](255) NULL,
        [amount] [decimal](18, 2) NOT NULL DEFAULT 0,
        [quantity] [decimal](18, 2) NULL,
        [uom] [varchar](50) NULL,
        
        -- Kategori (diklasifikasikan saat insert)
        [category] [varchar](50) NOT NULL,                -- 'TUNJANGAN', 'POTONGAN', 'PREMI'
        [sub_category] [varchar](100) NULL,               -- 'BERAS', 'JABATAN', 'MASA_KERJA', 'LEMBUR', 'BRONDOL', 'PPH21', 'SPSI', 'BPJS', 'KOREKSI', dll
        [is_dynamic] [bit] NOT NULL DEFAULT 0,            -- Apakah ini dynamic header
        [dynamic_header_name] [nvarchar](255) NULL,       -- Nama header jika dynamic
        
        -- Flag khusus
        [is_premi_pph] [bit] NOT NULL DEFAULT 0,          -- TaskDesc = 'ACCRUALS-CHECKROLL'
        [is_koreksi] [bit] NOT NULL DEFAULT 0,            -- DocDesc mengandung 'KOREKSI'
        [is_potongan] [bit] NOT NULL DEFAULT 0,           -- DocDesc mengandung 'POT' atau 'POTONGAN'
        [is_premi] [bit] NOT NULL DEFAULT 0,              -- DocDesc mengandung 'PREMI'
        
        -- Metadata
        [period_month] [int] NOT NULL,
        [period_year] [int] NOT NULL,
        [created_at] [datetime] NOT NULL DEFAULT GETDATE(),
        [source_table] [varchar](50) NOT NULL,            -- 'PR_ADTRANS' atau 'PR_ADTRANS_ARC'
        
        CONSTRAINT [PK_history_adtrans] PRIMARY KEY CLUSTERED ([id] ASC)
    );
    
    PRINT 'Table history_adtrans created successfully.';
END
ELSE
BEGIN
    PRINT 'Table history_adtrans already exists.';
END
GO

-- Indexes untuk history_adtrans
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_history_adtrans_history_id' AND object_id = OBJECT_ID('dbo.history_adtrans'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_history_adtrans_history_id] 
        ON [dbo].[history_adtrans] ([history_id]);
    PRINT 'Index IX_history_adtrans_history_id created.';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_history_adtrans_emp' AND object_id = OBJECT_ID('dbo.history_adtrans'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_history_adtrans_emp] 
        ON [dbo].[history_adtrans] ([emp_code], [period_year], [period_month]);
    PRINT 'Index IX_history_adtrans_emp created.';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_history_adtrans_category' AND object_id = OBJECT_ID('dbo.history_adtrans'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_history_adtrans_category] 
        ON [dbo].[history_adtrans] ([category], [sub_category]);
    PRINT 'Index IX_history_adtrans_category created.';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_history_adtrans_period' AND object_id = OBJECT_ID('dbo.history_adtrans'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_history_adtrans_period] 
        ON [dbo].[history_adtrans] ([period_year], [period_month]);
    PRINT 'Index IX_history_adtrans_period created.';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_history_adtrans_doc_date' AND object_id = OBJECT_ID('dbo.history_adtrans'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_history_adtrans_doc_date] 
        ON [dbo].[history_adtrans] ([doc_date]);
    PRINT 'Index IX_history_adtrans_doc_date created.';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_history_adtrans_gang' AND object_id = OBJECT_ID('dbo.history_adtrans'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_history_adtrans_gang] 
        ON [dbo].[history_adtrans] ([gang_code]);
    PRINT 'Index IX_history_adtrans_gang created.';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_history_adtrans_doc_desc' AND object_id = OBJECT_ID('dbo.history_adtrans'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_history_adtrans_doc_desc] 
        ON [dbo].[history_adtrans] ([doc_desc]);
    PRINT 'Index IX_history_adtrans_doc_desc created.';
END
GO

-- =============================================================================
-- TABEL 3: history_gang_member
-- Menyimpan data keanggotaan gang per periode
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[history_gang_member]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[history_gang_member] (
        [id] [bigint] IDENTITY(1,1) NOT NULL,
        [history_id] [varchar](50) NOT NULL,
        
        -- Data Gang
        [gang_code] [varchar](50) NOT NULL,
        [gang_description] [nvarchar](255) NULL,
        [division_code] [varchar](50) NOT NULL,
        [loc_code] [varchar](50) NULL,
        
        -- Data Karyawan
        [emp_code] [varchar](50) NOT NULL,
        [emp_name] [nvarchar](255) NULL,
        [join_date] [date] NULL,
        [is_active] [bit] NOT NULL DEFAULT 1,
        
        -- Metadata
        [period_month] [int] NOT NULL,
        [period_year] [int] NOT NULL,
        [created_at] [datetime] NOT NULL DEFAULT GETDATE(),
        [source_table] [varchar](50) NOT NULL,            -- 'HR_GANGLN' atau 'PR_GANGLN_ARC'
        
        CONSTRAINT [PK_history_gang_member] PRIMARY KEY CLUSTERED ([id] ASC)
    );
    
    -- Unique constraint untuk mencegah duplikasi
    ALTER TABLE [dbo].[history_gang_member] 
    ADD CONSTRAINT [UQ_history_gang_member] UNIQUE NONCLUSTERED ([history_id], [gang_code], [emp_code]);
    
    PRINT 'Table history_gang_member created successfully.';
END
ELSE
BEGIN
    PRINT 'Table history_gang_member already exists.';
END
GO

-- Indexes untuk history_gang_member
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_history_gang_member_history_id' AND object_id = OBJECT_ID('dbo.history_gang_member'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_history_gang_member_history_id] 
        ON [dbo].[history_gang_member] ([history_id]);
    PRINT 'Index IX_history_gang_member_history_id created.';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_history_gang_member_emp' AND object_id = OBJECT_ID('dbo.history_gang_member'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_history_gang_member_emp] 
        ON [dbo].[history_gang_member] ([emp_code], [period_year], [period_month]);
    PRINT 'Index IX_history_gang_member_emp created.';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_history_gang_member_gang' AND object_id = OBJECT_ID('dbo.history_gang_member'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_history_gang_member_gang] 
        ON [dbo].[history_gang_member] ([gang_code]);
    PRINT 'Index IX_history_gang_member_gang created.';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_history_gang_member_period' AND object_id = OBJECT_ID('dbo.history_gang_member'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_history_gang_member_period] 
        ON [dbo].[history_gang_member] ([period_year], [period_month]);
    PRINT 'Index IX_history_gang_member_period created.';
END
GO

PRINT 'Migration 002 completed successfully.';
GO
