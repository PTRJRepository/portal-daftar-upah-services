-- Migration: Add missing columns to payroll_history_detail
-- These columns are referenced in historyDatabaseService.ts savePayrollHistoryDetail()
-- but were absent from the original add_history_tables.sql schema.
-- Run this against extend_db_ptrj.

-- ============================================================================
-- payroll_history_detail: missing rate/detail columns
-- ============================================================================

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='payroll_history_detail' AND COLUMN_NAME='beras_rate')
    ALTER TABLE dbo.payroll_history_detail ADD beras_rate DECIMAL(18,4) NULL DEFAULT 0;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='payroll_history_detail' AND COLUMN_NAME='jabatan_rate')
    ALTER TABLE dbo.payroll_history_detail ADD jabatan_rate DECIMAL(18,4) NULL DEFAULT 0;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='payroll_history_detail' AND COLUMN_NAME='masa_kerja_rate')
    ALTER TABLE dbo.payroll_history_detail ADD masa_kerja_rate DECIMAL(18,4) NULL DEFAULT 0;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='payroll_history_detail' AND COLUMN_NAME='lembur_jam')
    ALTER TABLE dbo.payroll_history_detail ADD lembur_jam DECIMAL(18,2) NULL DEFAULT 0;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='payroll_history_detail' AND COLUMN_NAME='lembur_rate')
    ALTER TABLE dbo.payroll_history_detail ADD lembur_rate DECIMAL(18,4) NULL DEFAULT 0;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='payroll_history_detail' AND COLUMN_NAME='lembur_records')
    ALTER TABLE dbo.payroll_history_detail ADD lembur_records NVARCHAR(MAX) NULL;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='payroll_history_detail' AND COLUMN_NAME='total_tunjangan')
    ALTER TABLE dbo.payroll_history_detail ADD total_tunjangan DECIMAL(18,2) NULL DEFAULT 0;
GO

-- Brondol dual-source breakdown
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='payroll_history_detail' AND COLUMN_NAME='premi_brondol_loosefruit')
    ALTER TABLE dbo.payroll_history_detail ADD premi_brondol_loosefruit DECIMAL(18,2) NULL DEFAULT 0;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='payroll_history_detail' AND COLUMN_NAME='premi_brondol_adtrans')
    ALTER TABLE dbo.payroll_history_detail ADD premi_brondol_adtrans DECIMAL(18,2) NULL DEFAULT 0;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='payroll_history_detail' AND COLUMN_NAME='premi_brondol_total')
    ALTER TABLE dbo.payroll_history_detail ADD premi_brondol_total DECIMAL(18,2) NULL DEFAULT 0;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='payroll_history_detail' AND COLUMN_NAME='premi_pph')
    ALTER TABLE dbo.payroll_history_detail ADD premi_pph DECIMAL(18,2) NULL DEFAULT 0;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='payroll_history_detail' AND COLUMN_NAME='premi_detail')
    ALTER TABLE dbo.payroll_history_detail ADD premi_detail NVARCHAR(MAX) NULL;
GO

-- Potongan detail columns
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='payroll_history_detail' AND COLUMN_NAME='pot_astek_pekerja')
    ALTER TABLE dbo.payroll_history_detail ADD pot_astek_pekerja DECIMAL(18,2) NULL DEFAULT 0;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='payroll_history_detail' AND COLUMN_NAME='pot_astek_majikan')
    ALTER TABLE dbo.payroll_history_detail ADD pot_astek_majikan DECIMAL(18,2) NULL DEFAULT 0;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='payroll_history_detail' AND COLUMN_NAME='pot_astek_jumlah')
    ALTER TABLE dbo.payroll_history_detail ADD pot_astek_jumlah DECIMAL(18,2) NULL DEFAULT 0;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='payroll_history_detail' AND COLUMN_NAME='potongan_detail')
    ALTER TABLE dbo.payroll_history_detail ADD potongan_detail NVARCHAR(MAX) NULL;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='payroll_history_detail' AND COLUMN_NAME='total_potongan_bersih')
    ALTER TABLE dbo.payroll_history_detail ADD total_potongan_bersih DECIMAL(18,2) NULL DEFAULT 0;
GO

-- Gross & tax breakdown
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='payroll_history_detail' AND COLUMN_NAME='upah_kotor_pajak')
    ALTER TABLE dbo.payroll_history_detail ADD upah_kotor_pajak DECIMAL(18,2) NULL DEFAULT 0;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='payroll_history_detail' AND COLUMN_NAME='penghasilan_bruto')
    ALTER TABLE dbo.payroll_history_detail ADD penghasilan_bruto DECIMAL(18,2) NULL DEFAULT 0;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='payroll_history_detail' AND COLUMN_NAME='upah_pokok')
    ALTER TABLE dbo.payroll_history_detail ADD upah_pokok DECIMAL(18,2) NULL DEFAULT 0;
GO

-- Task & shortage tracking
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='payroll_history_detail' AND COLUMN_NAME='task_code')
    ALTER TABLE dbo.payroll_history_detail ADD task_code VARCHAR(20) NULL;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='payroll_history_detail' AND COLUMN_NAME='task_desc')
    ALTER TABLE dbo.payroll_history_detail ADD task_desc NVARCHAR(100) NULL;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='payroll_history_detail' AND COLUMN_NAME='shortage_details')
    ALTER TABLE dbo.payroll_history_detail ADD shortage_details NVARCHAR(MAX) NULL;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='payroll_history_detail' AND COLUMN_NAME='shortage_total_hours')
    ALTER TABLE dbo.payroll_history_detail ADD shortage_total_hours DECIMAL(18,2) NULL;
GO

-- Profile enrichment (already added by migrateNewNikColumn but re-guard here)
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='payroll_history_detail' AND COLUMN_NAME='jabatan')
    ALTER TABLE dbo.payroll_history_detail ADD jabatan NVARCHAR(100) NULL;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='payroll_history_detail' AND COLUMN_NAME='is_spsi_member')
    ALTER TABLE dbo.payroll_history_detail ADD is_spsi_member BIT NULL;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='payroll_history_detail' AND COLUMN_NAME='new_nik')
    ALTER TABLE dbo.payroll_history_detail ADD new_nik VARCHAR(50) NULL;
GO

-- snapshot linkage (already in add_payroll_snapshot_version_columns.sql but re-guard)
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='payroll_history_detail' AND COLUMN_NAME='snapshot_batch_id')
    ALTER TABLE dbo.payroll_history_detail ADD snapshot_batch_id BIGINT NULL;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='payroll_history_detail' AND COLUMN_NAME='snapshot_version')
    ALTER TABLE dbo.payroll_history_detail ADD snapshot_version INT NULL;
GO

-- ============================================================================
-- payroll_history_header: snapshot linkage (re-guard)
-- ============================================================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='payroll_history_header' AND COLUMN_NAME='snapshot_batch_id')
    ALTER TABLE dbo.payroll_history_header ADD snapshot_batch_id BIGINT NULL;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='payroll_history_header' AND COLUMN_NAME='snapshot_version')
    ALTER TABLE dbo.payroll_history_header ADD snapshot_version INT NULL;
GO

-- ============================================================================
-- history_metadata: missing columns used by saveHistoryMetadata()
-- ============================================================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='history_metadata' AND COLUMN_NAME='operation')
    ALTER TABLE dbo.history_metadata ADD operation VARCHAR(20) NULL;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='history_metadata' AND COLUMN_NAME='entity_type')
    ALTER TABLE dbo.history_metadata ADD entity_type VARCHAR(30) NULL;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='history_metadata' AND COLUMN_NAME='entity_id')
    ALTER TABLE dbo.history_metadata ADD entity_id INT NULL;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='history_metadata' AND COLUMN_NAME='gang_code')
    ALTER TABLE dbo.history_metadata ADD gang_code VARCHAR(20) NULL;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='history_metadata' AND COLUMN_NAME='description')
    ALTER TABLE dbo.history_metadata ADD description NVARCHAR(255) NULL;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='history_metadata' AND COLUMN_NAME='old_values')
    ALTER TABLE dbo.history_metadata ADD old_values NVARCHAR(MAX) NULL;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='history_metadata' AND COLUMN_NAME='new_values')
    ALTER TABLE dbo.history_metadata ADD new_values NVARCHAR(MAX) NULL;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='history_metadata' AND COLUMN_NAME='record_count')
    ALTER TABLE dbo.history_metadata ADD record_count INT NULL;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='history_metadata' AND COLUMN_NAME='status')
    ALTER TABLE dbo.history_metadata ADD status VARCHAR(20) NULL;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='history_metadata' AND COLUMN_NAME='error_message')
    ALTER TABLE dbo.history_metadata ADD error_message NVARCHAR(MAX) NULL;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='history_metadata' AND COLUMN_NAME='performed_by')
    ALTER TABLE dbo.history_metadata ADD performed_by VARCHAR(100) NULL;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='history_metadata' AND COLUMN_NAME='performed_at')
    ALTER TABLE dbo.history_metadata ADD performed_at DATETIME NULL DEFAULT GETDATE();
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='history_metadata' AND COLUMN_NAME='ip_address')
    ALTER TABLE dbo.history_metadata ADD ip_address VARCHAR(50) NULL;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='history_metadata' AND COLUMN_NAME='user_agent')
    ALTER TABLE dbo.history_metadata ADD user_agent NVARCHAR(255) NULL;
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='history_metadata' AND COLUMN_NAME='session_id')
    ALTER TABLE dbo.history_metadata ADD session_id VARCHAR(100) NULL;
GO

PRINT 'MISSING_DETAIL_COLUMNS_ADDED';
