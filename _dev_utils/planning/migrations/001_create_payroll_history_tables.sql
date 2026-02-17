-- =============================================================================
-- MIGRATION: Create Payroll History Tables
-- Database: extend_db_ptrj
-- Description: Tabel untuk menyimpan summary dan detail payroll per gang/divisi
-- =============================================================================

USE extend_db_ptrj;
GO

-- =============================================================================
-- TABEL 1: payroll_history_master
-- Menyimpan header/summary dari setiap periode payroll yang di-archive per gang
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[payroll_history_master]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[payroll_history_master] (
        [id] [bigint] IDENTITY(1,1) NOT NULL,
        [history_id] [varchar](50) NOT NULL,              -- UUID untuk grouping
        [period_month] [int] NOT NULL,
        [period_year] [int] NOT NULL,
        [division_code] [varchar](50) NOT NULL,
        [gang_code] [varchar](50) NOT NULL,
        [gang_description] [nvarchar](255) NULL,
        
        -- Summary Data
        [total_employees] [int] NOT NULL DEFAULT 0,
        [total_hk] [decimal](18, 2) NOT NULL DEFAULT 0,
        [total_hari_kerja] [decimal](18, 2) NOT NULL DEFAULT 0,
        [total_cuti_tahunan] [decimal](18, 2) NOT NULL DEFAULT 0,
        [total_cuti_sakit] [decimal](18, 2) NOT NULL DEFAULT 0,
        [total_cuti_minggu] [decimal](18, 2) NOT NULL DEFAULT 0,
        [total_cuti_nasional] [decimal](18, 2) NOT NULL DEFAULT 0,
        
        -- Upah
        [total_upah_dasar] [decimal](18, 2) NOT NULL DEFAULT 0,
        [total_upah_pokok] [decimal](18, 2) NOT NULL DEFAULT 0,
        [total_gaji_pokok] [decimal](18, 2) NOT NULL DEFAULT 0,
        
        -- Tunjangan
        [total_beras] [decimal](18, 2) NOT NULL DEFAULT 0,
        [total_jabatan] [decimal](18, 2) NOT NULL DEFAULT 0,
        [total_masa_kerja] [decimal](18, 2) NOT NULL DEFAULT 0,
        [total_lembur] [decimal](18, 2) NOT NULL DEFAULT 0,
        [total_tunjangan] [decimal](18, 2) NOT NULL DEFAULT 0,
        
        -- Premi
        [total_premi_brondol] [decimal](18, 2) NOT NULL DEFAULT 0,
        [total_premi_prunning] [decimal](18, 2) NOT NULL DEFAULT 0,
        [total_premi_insentif] [decimal](18, 2) NOT NULL DEFAULT 0,
        [total_premi_kinerja] [decimal](18, 2) NOT NULL DEFAULT 0,
        [total_premi] [decimal](18, 2) NOT NULL DEFAULT 0,
        [dynamic_premi_data] [nvarchar](max) NULL,        -- JSON array
        
        -- Potongan
        [total_koreksi] [decimal](18, 2) NOT NULL DEFAULT 0,
        [total_potongan] [decimal](18, 2) NOT NULL DEFAULT 0,
        [total_pph21] [decimal](18, 2) NOT NULL DEFAULT 0,
        [total_bpjs_pekerja] [decimal](18, 2) NOT NULL DEFAULT 0,
        [total_bpjs_majikan] [decimal](18, 2) NOT NULL DEFAULT 0,
        [total_spsi] [decimal](18, 2) NOT NULL DEFAULT 0,
        [dynamic_potongan_data] [nvarchar](max) NULL,     -- JSON array
        
        -- Total Akhir
        [total_upah_kotor] [decimal](18, 2) NOT NULL DEFAULT 0,
        [total_upah_bersih] [decimal](18, 2) NOT NULL DEFAULT 0,
        
        -- Metadata
        [total_ffb_weight] [decimal](18, 2) NULL,
        [total_weight_tbs] [decimal](18, 2) NULL,
        [informasi_tambahan] [nvarchar](max) NULL,
        
        -- Audit
        [created_at] [datetime] NOT NULL DEFAULT GETDATE(),
        [created_by] [varchar](100) NULL,
        [source_endpoint] [varchar](255) NULL,
        [is_locked] [bit] NOT NULL DEFAULT 0,             -- Prevent modification
        [lock_reason] [nvarchar](500) NULL,
        
        CONSTRAINT [PK_payroll_history_master] PRIMARY KEY CLUSTERED ([id] ASC)
    );
    
    -- Unique constraint untuk mencegah duplikasi data per gang per periode
    ALTER TABLE [dbo].[payroll_history_master] 
    ADD CONSTRAINT [UQ_payroll_history_master] UNIQUE NONCLUSTERED ([period_year], [period_month], [division_code], [gang_code]);
    
    PRINT 'Table payroll_history_master created successfully.';
END
ELSE
BEGIN
    PRINT 'Table payroll_history_master already exists.';
END
GO

-- Indexes untuk payroll_history_master
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_payroll_history_master_period' AND object_id = OBJECT_ID('dbo.payroll_history_master'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_payroll_history_master_period] 
        ON [dbo].[payroll_history_master] ([period_year], [period_month]);
    PRINT 'Index IX_payroll_history_master_period created.';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_payroll_history_master_division' AND object_id = OBJECT_ID('dbo.payroll_history_master'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_payroll_history_master_division] 
        ON [dbo].[payroll_history_master] ([division_code]);
    PRINT 'Index IX_payroll_history_master_division created.';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_payroll_history_master_gang' AND object_id = OBJECT_ID('dbo.payroll_history_master'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_payroll_history_master_gang] 
        ON [dbo].[payroll_history_master] ([gang_code]);
    PRINT 'Index IX_payroll_history_master_gang created.';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_payroll_history_master_history_id' AND object_id = OBJECT_ID('dbo.payroll_history_master'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_payroll_history_master_history_id] 
        ON [dbo].[payroll_history_master] ([history_id]);
    PRINT 'Index IX_payroll_history_master_history_id created.';
END
GO

-- =============================================================================
-- TABEL 2: payroll_history_detail
-- Menyimpan detail per karyawan untuk setiap history
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[payroll_history_detail]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[payroll_history_detail] (
        [id] [bigint] IDENTITY(1,1) NOT NULL,
        [history_id] [varchar](50) NOT NULL,              -- FK ke payroll_history_master
        [master_id] [bigint] NOT NULL,                    -- FK ke payroll_history_master.id
        
        -- Identitas Karyawan
        [emp_code] [varchar](50) NOT NULL,
        [emp_name] [nvarchar](255) NULL,
        [nik] [varchar](50) NULL,
        [gender] [varchar](10) NULL,
        [gang_code] [varchar](50) NOT NULL,
        [division_code] [varchar](50) NOT NULL,
        [loc_code] [varchar](50) NULL,
        [status_ptkp] [varchar](20) NULL,
        [kategori_ter] [varchar](20) NULL,
        
        -- Absensi
        [hari_kerja] [decimal](18, 2) NOT NULL DEFAULT 0,
        [cuti_tahunan_hari] [decimal](18, 2) NOT NULL DEFAULT 0,
        [cuti_sakit_haid_hari] [decimal](18, 2) NOT NULL DEFAULT 0,
        [cuti_minggu_hari] [decimal](18, 2) NOT NULL DEFAULT 0,
        [cuti_nasional_hari] [decimal](18, 2) NOT NULL DEFAULT 0,
        [jumlah_hk] [decimal](18, 2) NOT NULL DEFAULT 0,
        [total_jam_kerja] [decimal](18, 2) NOT NULL DEFAULT 0,
        
        -- Upah
        [upah_dasar] [decimal](18, 2) NOT NULL DEFAULT 0,
        [upah_pokok] [decimal](18, 2) NOT NULL DEFAULT 0,
        [gaji_pokok] [decimal](18, 2) NOT NULL DEFAULT 0,
        [gaji_pokok_ideal] [decimal](18, 2) NOT NULL DEFAULT 0,
        [gaji_pokok_aktual] [decimal](18, 2) NOT NULL DEFAULT 0,
        [koreksi_hk] [decimal](18, 2) NOT NULL DEFAULT 0,
        
        -- Tunjangan
        [beras_rate] [decimal](18, 2) NOT NULL DEFAULT 0,
        [beras_jumlah] [decimal](18, 2) NOT NULL DEFAULT 0,
        [jabatan_rate] [decimal](18, 2) NOT NULL DEFAULT 0,
        [jabatan_jumlah] [decimal](18, 2) NOT NULL DEFAULT 0,
        [masa_kerja_tahun] [int] NOT NULL DEFAULT 0,
        [masa_kerja_rate] [decimal](18, 2) NOT NULL DEFAULT 0,
        [masa_kerja_jumlah] [decimal](18, 2) NOT NULL DEFAULT 0,
        [lembur_jam] [decimal](18, 2) NOT NULL DEFAULT 0,
        [lembur_rate] [decimal](18, 2) NOT NULL DEFAULT 0,
        [lembur_jumlah] [decimal](18, 2) NOT NULL DEFAULT 0,
        [lembur_records] [nvarchar](max) NULL,            -- JSON detail lembur
        [total_tunjangan] [decimal](18, 2) NOT NULL DEFAULT 0,
        
        -- Premi
        [premi_brondol] [decimal](18, 2) NOT NULL DEFAULT 0,
        [premi_pph] [decimal](18, 2) NOT NULL DEFAULT 0,
        [total_premi] [decimal](18, 2) NOT NULL DEFAULT 0,
        [premi_detail] [nvarchar](max) NULL,              -- JSON array detail premi
        
        -- Potongan
        [pot_spsi] [decimal](18, 2) NOT NULL DEFAULT 0,
        [pot_pph21] [decimal](18, 2) NOT NULL DEFAULT 0,
        [pot_koreksi] [decimal](18, 2) NOT NULL DEFAULT 0,
        [pot_bpjs_kesehatan_pekerja] [decimal](18, 2) NOT NULL DEFAULT 0,
        [pot_bpjs_kesehatan_majikan] [decimal](18, 2) NOT NULL DEFAULT 0,
        [pot_bpjs_pensiun_pekerja] [decimal](18, 2) NOT NULL DEFAULT 0,
        [pot_bpjs_pensiun_majikan] [decimal](18, 2) NOT NULL DEFAULT 0,
        [pot_bpjs_pekerja_total] [decimal](18, 2) NOT NULL DEFAULT 0,
        [pot_astek_pekerja] [decimal](18, 2) NOT NULL DEFAULT 0,
        [pot_astek_majikan] [decimal](18, 2) NOT NULL DEFAULT 0,
        [pot_astek_jumlah] [decimal](18, 2) NOT NULL DEFAULT 0,
        [potongan_detail] [nvarchar](max) NULL,           -- JSON array detail potongan
        [total_potongan] [decimal](18, 2) NOT NULL DEFAULT 0,
        [total_potongan_bersih] [decimal](18, 2) NOT NULL DEFAULT 0,
        
        -- Total Akhir
        [jumlah_upah_kotor] [decimal](18, 2) NOT NULL DEFAULT 0,
        [upah_kotor_pajak] [decimal](18, 2) NOT NULL DEFAULT 0,
        [penghasilan_bruto] [decimal](18, 2) NOT NULL DEFAULT 0,
        [tarif_pajak_ter] [decimal](5, 2) NULL,
        [pph21_ter] [decimal](18, 2) NOT NULL DEFAULT 0,
        [upah_bersih] [decimal](18, 2) NOT NULL DEFAULT 0,
        
        -- Metadata
        [task_code] [varchar](50) NULL,
        [task_desc] [nvarchar](255) NULL,
        [shortage_details] [nvarchar](max) NULL,          -- JSON array
        [shortage_total_hours] [decimal](18, 2) NULL,
        
        -- Audit
        [created_at] [datetime] NOT NULL DEFAULT GETDATE(),
        
        CONSTRAINT [PK_payroll_history_detail] PRIMARY KEY CLUSTERED ([id] ASC)
    );
    
    -- Foreign Key ke master
    ALTER TABLE [dbo].[payroll_history_detail] 
    ADD CONSTRAINT [FK_payroll_history_detail_master] FOREIGN KEY ([master_id]) 
        REFERENCES [dbo].[payroll_history_master] ([id]) ON DELETE CASCADE;
    
    PRINT 'Table payroll_history_detail created successfully.';
END
ELSE
BEGIN
    PRINT 'Table payroll_history_detail already exists.';
END
GO

-- Indexes untuk payroll_history_detail
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_payroll_history_detail_history_id' AND object_id = OBJECT_ID('dbo.payroll_history_detail'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_payroll_history_detail_history_id] 
        ON [dbo].[payroll_history_detail] ([history_id]);
    PRINT 'Index IX_payroll_history_detail_history_id created.';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_payroll_history_detail_emp' AND object_id = OBJECT_ID('dbo.payroll_history_detail'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_payroll_history_detail_emp] 
        ON [dbo].[payroll_history_detail] ([emp_code]);
    PRINT 'Index IX_payroll_history_detail_emp created.';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_payroll_history_detail_gang' AND object_id = OBJECT_ID('dbo.payroll_history_detail'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_payroll_history_detail_gang] 
        ON [dbo].[payroll_history_detail] ([gang_code]);
    PRINT 'Index IX_payroll_history_detail_gang created.';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_payroll_history_detail_period' AND object_id = OBJECT_ID('dbo.payroll_history_detail'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_payroll_history_detail_period] 
        ON [dbo].[payroll_history_detail] ([master_id], [emp_code]);
    PRINT 'Index IX_payroll_history_detail_period created.';
END
GO

PRINT 'Migration 001 completed successfully.';
GO
