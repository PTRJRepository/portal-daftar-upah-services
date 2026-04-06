-- Migration: Add History Tables for Payroll and Tax Reporting
-- This script creates all history tables needed for Payroll History Seeder
-- Run this against extend_db_ptrj

-- =====================================================
-- 1. payroll_history_header (Main master record)
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[payroll_history_header]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[payroll_history_header] (
        [id] [int] IDENTITY(1,1) NOT NULL,
        [history_id] [varchar](50) NOT NULL,
        [period_month] [int] NOT NULL,
        [period_year] [int] NOT NULL,
        [division_code] [varchar](20) NOT NULL,
        [gang_code] [varchar](20) NOT NULL,
        [gang_description] [varchar](100) NULL,
        [total_employees] [int] NULL DEFAULT 0,
        [total_hk] [decimal](18,2) NULL DEFAULT 0,
        [total_hari_kerja] [decimal](18,2) NULL DEFAULT 0,
        [total_cuti_tahunan] [decimal](18,2) NULL DEFAULT 0,
        [total_cuti_sakit] [decimal](18,2) NULL DEFAULT 0,
        [total_cuti_minggu] [decimal](18,2) NULL DEFAULT 0,
        [total_cuti_nasional] [decimal](18,2) NULL DEFAULT 0,
        [total_upah_dasar] [decimal](18,2) NULL DEFAULT 0,
        [total_upah_pokok] [decimal](18,2) NULL DEFAULT 0,
        [total_gaji_pokok] [decimal](18,2) NULL DEFAULT 0,
        [total_beras] [decimal](18,2) NULL DEFAULT 0,
        [total_jabatan] [decimal](18,2) NULL DEFAULT 0,
        [total_masa_kerja] [decimal](18,2) NULL DEFAULT 0,
        [total_lembur] [decimal](18,2) NULL DEFAULT 0,
        [total_tunjangan] [decimal](18,2) NULL DEFAULT 0,
        [total_premi_brondol] [decimal](18,2) NULL DEFAULT 0,
        [total_premi_prunning] [decimal](18,2) NULL DEFAULT 0,
        [total_premi_insentif] [decimal](18,2) NULL DEFAULT 0,
        [total_premi_kinerja] [decimal](18,2) NULL DEFAULT 0,
        [total_premi] [decimal](18,2) NULL DEFAULT 0,
        [dynamic_premi_data] [nvarchar](max) NULL,
        [total_koreksi] [decimal](18,2) NULL DEFAULT 0,
        [total_potongan] [decimal](18,2) NULL DEFAULT 0,
        [total_pph21] [decimal](18,2) NULL DEFAULT 0,
        [total_bpjs_pekerja] [decimal](18,2) NULL DEFAULT 0,
        [total_bpjs_majikan] [decimal](18,2) NULL DEFAULT 0,
        [total_spsi] [decimal](18,2) NULL DEFAULT 0,
        [dynamic_potongan_data] [nvarchar](max) NULL,
        [total_upah_kotor] [decimal](18,2) NULL DEFAULT 0,
        [total_upah_bersih] [decimal](18,2) NULL DEFAULT 0,
        [total_ffb_weight] [decimal](18,2) NULL DEFAULT 0,
        [total_weight_tbs] [decimal](18,2) NULL DEFAULT 0,
        [informasi_tambahan] [nvarchar](max) NULL,
        [created_at] [datetime] DEFAULT GETDATE(),
        [created_by] [varchar](100) NULL,
        [source_endpoint] [varchar](255) NULL,
        [is_locked] [bit] NULL DEFAULT 0,
        [lock_reason] [varchar](255) NULL,
        CONSTRAINT [PK_payroll_history_header] PRIMARY KEY CLUSTERED ([id] ASC)
    );

    CREATE NONCLUSTERED INDEX [IX_header_period] ON [dbo].[payroll_history_header]
    ([period_year] ASC, [period_month] ASC, [division_code] ASC);

    CREATE NONCLUSTERED INDEX [IX_header_history_id] ON [dbo].[payroll_history_header]
    ([history_id] ASC);

    CREATE NONCLUSTERED INDEX [IX_header_division_gang] ON [dbo].[payroll_history_header]
    ([division_code] ASC, [gang_code] ASC);
END
GO

-- =====================================================
-- 2. payroll_history_detail (Employee-level payroll data)
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[payroll_history_detail]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[payroll_history_detail] (
        [id] [int] IDENTITY(1,1) NOT NULL,
        [history_id] [varchar](50) NOT NULL,
        [master_id] [int] NOT NULL,
        [emp_code] [varchar](20) NOT NULL,
        [emp_name] [nvarchar](100) NULL,
        [nik] [varchar](50) NULL,
        [new_nik] [varchar](50) NULL,
        [gender] [varchar](10) NULL,
        [gang_code] [varchar](20) NULL,
        [division_code] [varchar](20) NULL,
        [loc_code] [varchar](20) NULL,
        [status_ptkp] [varchar](20) NULL,
        [kategori_ter] [varchar](10) NULL,
        [hari_kerja] [decimal](18,2) NULL DEFAULT 0,
        [cuti_tahunan_hari] [decimal](18,2) NULL DEFAULT 0,
        [cuti_sakit_haid_hari] [decimal](18,2) NULL DEFAULT 0,
        [cuti_minggu_hari] [decimal](18,2) NULL DEFAULT 0,
        [cuti_nasional_hari] [decimal](18,2) NULL DEFAULT 0,
        [jumlah_hk] [decimal](18,2) NULL DEFAULT 0,
        [total_jam_kerja] [decimal](18,2) NULL DEFAULT 0,
        [upah_dasar] [decimal](18,2) NULL DEFAULT 0,
        [upah_pokok] [decimal](18,2) NULL DEFAULT 0,
        [gaji_pokok] [decimal](18,2) NULL DEFAULT 0,
        [gaji_pokok_ideal] [decimal](18,2) NULL DEFAULT 0,
        [gaji_pokok_aktual] [decimal](18,2) NULL DEFAULT 0,
        [koreksi_hk] [decimal](18,2) NULL DEFAULT 0,
        [beras_jumlah] [decimal](18,2) NULL DEFAULT 0,
        [jabatan_jumlah] [decimal](18,2) NULL DEFAULT 0,
        [masa_kerja_tahun] [int] NULL DEFAULT 0,
        [masa_kerja_jumlah] [decimal](18,2) NULL DEFAULT 0,
        [lembur_jumlah] [decimal](18,2) NULL DEFAULT 0,
        [tunjangan_jumlah] [decimal](18,2) NULL DEFAULT 0,
        [premi_brondol] [decimal](18,2) NULL DEFAULT 0,
        [premi_prunning] [decimal](18,2) NULL DEFAULT 0,
        [premi_insentif] [decimal](18,2) NULL DEFAULT 0,
        [premi_kinerja] [decimal](18,2) NULL DEFAULT 0,
        [total_premi] [decimal](18,2) NULL DEFAULT 0,
        [pot_koreksi] [decimal](18,2) NULL DEFAULT 0,
        [potongan_upah_kotor_total] [decimal](18,2) NULL DEFAULT 0,
        [jumlah_upah_kotor] [decimal](18,2) NULL DEFAULT 0,
        [pot_astek] [decimal](18,2) NULL DEFAULT 0,
        [pot_astek_maj] [decimal](18,2) NULL DEFAULT 0,
        [pot_bpjs_kesehatan_pekerja] [decimal](18,2) NULL DEFAULT 0,
        [pot_bpjs_kesehatan_majikan] [decimal](18,2) NULL DEFAULT 0,
        [pot_bpjs_pensiun_pekerja] [decimal](18,2) NULL DEFAULT 0,
        [pot_bpjs_pensiun_majikan] [decimal](18,2) NULL DEFAULT 0,
        [pot_bpjs_pekerja_total] [decimal](18,2) NULL DEFAULT 0,
        [pot_spsi] [decimal](18,2) NULL DEFAULT 0,
        [pot_pph21] [decimal](18,2) NULL DEFAULT 0,
        [total_potongan] [decimal](18,2) NULL DEFAULT 0,
        [total_potongan_bersih] [decimal](18,2) NULL DEFAULT 0,
        [upah_bersih] [decimal](18,2) NULL DEFAULT 0,
        [pph21_ter] [decimal](18,2) NULL DEFAULT 0,
        [tarif_pajak_ter] [decimal](18,2) NULL DEFAULT 0,
        [dynamic_premi_data] [nvarchar](max) NULL,
        [dynamic_potongan_data] [nvarchar](max) NULL,
        [created_at] [datetime] DEFAULT GETDATE(),
        CONSTRAINT [PK_payroll_history_detail] PRIMARY KEY CLUSTERED ([id] ASC)
    );

    CREATE NONCLUSTERED INDEX [IX_detail_master] ON [dbo].[payroll_history_detail]
    ([master_id] ASC);

    CREATE NONCLUSTERED INDEX [IX_detail_emp] ON [dbo].[payroll_history_detail]
    ([emp_code] ASC);

    CREATE NONCLUSTERED INDEX [IX_detail_period] ON [dbo].[payroll_history_detail]
    ([period_year] ASC, [period_month] ASC) INCLUDES ([emp_code], [upah_bersih], [pot_pph21]);
END
GO

-- =====================================================
-- 3. history_taskreg (Daily task/attendance records)
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[history_taskreg]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[history_taskreg] (
        [id] [int] IDENTITY(1,1) NOT NULL,
        [history_id] [varchar](50) NOT NULL,
        [original_master_id] [bigint] NULL,
        [reg_no] [varchar](50) NULL,
        [reg_date] [datetime] NULL,
        [emp_code] [varchar](20) NOT NULL,
        [original_line_id] [bigint] NULL,
        [line_no] [int] NULL,
        [trx_date] [datetime] NOT NULL,
        [task_code] [varchar](20) NULL,
        [hours] [decimal](18,2) NULL DEFAULT 0,
        [ot] [bit] NULL DEFAULT 0,
        [rate] [decimal](18,4) NULL DEFAULT 0,
        [amount] [decimal](18,2) NULL DEFAULT 0,
        [tapping_type] [varchar](20) NULL,
        [is_cuti_tahunan] [bit] NULL DEFAULT 0,
        [is_cuti_sakit] [bit] NULL DEFAULT 0,
        [is_cuti_minggu] [bit] NULL DEFAULT 0,
        [is_cuti_nasional] [bit] NULL DEFAULT 0,
        [is_hari_kerja] [bit] NULL DEFAULT 0,
        [is_lembur] [bit] NULL DEFAULT 0,
        [period_month] [int] NOT NULL,
        [period_year] [int] NOT NULL,
        [source_table] [varchar](50) NOT NULL,
        [created_at] [datetime] DEFAULT GETDATE(),
        CONSTRAINT [PK_history_taskreg] PRIMARY KEY CLUSTERED ([id] ASC)
    );

    CREATE NONCLUSTERED INDEX [IX_taskreg_history] ON [dbo].[history_taskreg]
    ([history_id] ASC);

    CREATE NONCLUSTERED INDEX [IX_taskreg_emp_date] ON [dbo].[history_taskreg]
    ([emp_code] ASC, [trx_date] ASC);

    CREATE NONCLUSTERED INDEX [IX_taskreg_period] ON [dbo].[history_taskreg]
    ([period_year] ASC, [period_month] ASC, [emp_code] ASC);
END
GO

-- =====================================================
-- 4. history_adtrans (Transaction/adjustment records)
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[history_adtrans]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[history_adtrans] (
        [id] [int] IDENTITY(1,1) NOT NULL,
        [history_id] [varchar](50) NOT NULL,
        [original_master_id] [bigint] NULL,
        [doc_no] [varchar](50) NULL,
        [doc_date] [datetime] NULL,
        [doc_desc] [varchar](255) NULL,
        [emp_code] [varchar](20) NOT NULL,
        [original_line_id] [bigint] NULL,
        [task_code] [varchar](20) NULL,
        [task_desc] [varchar](100) NULL,
        [amount] [decimal](18,2) NULL DEFAULT 0,
        [category] [varchar](20) NULL,
        [sub_category] [varchar](50) NULL,
        [period_month] [int] NOT NULL,
        [period_year] [int] NOT NULL,
        [source_table] [varchar](50) NOT NULL,
        [created_at] [datetime] DEFAULT GETDATE(),
        CONSTRAINT [PK_history_adtrans] PRIMARY KEY CLUSTERED ([id] ASC)
    );

    CREATE NONCLUSTERED INDEX [IX_adtrans_history] ON [dbo].[history_adtrans]
    ([history_id] ASC);

    CREATE NONCLUSTERED INDEX [IX_adtrans_emp] ON [dbo].[history_adtrans]
    ([emp_code] ASC, [doc_date] ASC);

    CREATE NONCLUSTERED INDEX [IX_adtrans_period] ON [dbo].[history_adtrans]
    ([period_year] ASC, [period_month] ASC, [emp_code] ASC);
END
GO

-- =====================================================
-- 5. history_gang_member (Gang membership records)
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[history_gang_member]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[history_gang_member] (
        [id] [int] IDENTITY(1,1) NOT NULL,
        [history_id] [varchar](50) NOT NULL,
        [gang_code] [varchar](20) NOT NULL,
        [gang_description] [varchar](100) NULL,
        [division_code] [varchar](20) NULL,
        [loc_code] [varchar](20) NULL,
        [emp_code] [varchar](20) NOT NULL,
        [emp_name] [nvarchar](100) NULL,
        [nik] [varchar](50) NULL,
        [jabatan] [varchar](50) NULL,
        [period_month] [int] NOT NULL,
        [period_year] [int] NOT NULL,
        [join_date] [datetime] NULL,
        [is_active] [bit] NULL DEFAULT 1,
        [source_table] [varchar](50) NOT NULL,
        [created_at] [datetime] DEFAULT GETDATE(),
        CONSTRAINT [PK_history_gang_member] PRIMARY KEY CLUSTERED ([id] ASC)
    );

    CREATE NONCLUSTERED INDEX [IX_gang_member_history] ON [dbo].[history_gang_member]
    ([history_id] ASC);

    CREATE NONCLUSTERED INDEX [IX_gang_member_emp] ON [dbo].[history_gang_member]
    ([emp_code] ASC);

    CREATE NONCLUSTERED INDEX [IX_gang_member_period] ON [dbo].[history_gang_member]
    ([period_year] ASC, [period_month] ASC, [division_code] ASC);
END
GO

-- =====================================================
-- 6. history_metadata (Seeder metadata)
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[history_metadata]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[history_metadata] (
        [id] [int] IDENTITY(1,1) NOT NULL,
        [history_id] [varchar](50) NOT NULL,
        [period_month] [int] NOT NULL,
        [period_year] [int] NOT NULL,
        [division_code] [varchar](20) NULL,
        [seeder_mode] [varchar](50) NULL,
        [total_employees] [int] NULL DEFAULT 0,
        [total_gangs] [int] NULL DEFAULT 0,
        [records_inserted] [int] NULL DEFAULT 0,
        [errors] [nvarchar](max) NULL,
        [started_at] [datetime] NULL,
        [completed_at] [datetime] NULL,
        [execution_time_ms] [bigint] NULL,
        [created_at] [datetime] DEFAULT GETDATE(),
        CONSTRAINT [PK_history_metadata] PRIMARY KEY CLUSTERED ([id] ASC)
    );

    CREATE NONCLUSTERED INDEX [IX_metadata_period] ON [dbo].[history_metadata]
    ([period_year] ASC, [period_month] ASC);
END
GO

PRINT '✅ All history tables created successfully!'