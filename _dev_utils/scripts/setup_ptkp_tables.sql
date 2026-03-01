-- ============================================
-- PTKP CHANGELOG TABLE SETUP SCRIPT
-- Database: extend_db_ptrj
-- Tujuan: Menyimpan riwayat setiap perubahan PTKP
-- ============================================

USE extend_db_ptrj;
GO

-- =============================================
-- TABLE 1: history_ptkp_pajak (Master Data PTKP per Tahun)
-- Status PTKP aktif saat ini per karyawan per tahun
-- Sudah ada, script ini hanya memastikan
-- =============================================
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'history_ptkp_pajak' AND TABLE_SCHEMA = 'dbo')
CREATE TABLE dbo.history_ptkp_pajak (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    period_year     INT NOT NULL,                    -- Tahun pajak (2025, 2026, ...)
    emp_code        VARCHAR(50) NOT NULL,            -- Kode karyawan (B0075, B0123, ...)
    emp_name        NVARCHAR(200) NULL,              -- Nama karyawan
    nik             VARCHAR(50) NULL,                -- NIK/KTP
    division_code   VARCHAR(20) NULL,                -- Divisi (PG1A, ARA, ...)
    gang_code       VARCHAR(20) NULL,                -- Gang (F1A, F1B, ...)
    loc_code        VARCHAR(20) NULL,                -- Lokasi
    beras_rate      DECIMAL(10,2) NULL DEFAULT 0,    -- Tarif beras (RiceRation) dari Plantware
    ptkp_status     VARCHAR(10) NOT NULL,            -- Status PTKP: TK/0, TK/1, K/0, K/1, K/2, K/3
    kategori_ter    VARCHAR(10) NULL,                -- Kategori TER: TER A, TER B, TER C
    source          VARCHAR(50) NULL DEFAULT 'HR_PAYROLL.RiceRation', -- Sumber data
    created_by      VARCHAR(100) NULL DEFAULT 'system',
    created_at      DATETIME NULL DEFAULT GETDATE(),
    updated_at      DATETIME NULL DEFAULT GETDATE()
);
GO

-- Index untuk query cepat
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ptkp_year_emp')
    CREATE UNIQUE INDEX IX_ptkp_year_emp ON dbo.history_ptkp_pajak (period_year, emp_code);
GO

-- =============================================
-- TABLE 2: history_ptkp_pajak_changelog (Audit Trail / Riwayat Perubahan)
-- Setiap kali PTKP berubah, satu baris ditambahkan di sini
-- TIDAK pernah di-update atau dihapus — append-only
-- =============================================
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'history_ptkp_pajak_changelog' AND TABLE_SCHEMA = 'dbo')
CREATE TABLE dbo.history_ptkp_pajak_changelog (
    id                  INT IDENTITY(1,1) PRIMARY KEY,
    period_year         INT NOT NULL,                -- Tahun pajak
    emp_code            VARCHAR(50) NOT NULL,         -- Kode karyawan
    old_ptkp_status     VARCHAR(10) NULL,             -- Status LAMA (NULL jika insert pertama kali)
    new_ptkp_status     VARCHAR(10) NOT NULL,         -- Status BARU
    old_kategori_ter    VARCHAR(10) NULL,             -- TER LAMA
    new_kategori_ter    VARCHAR(10) NOT NULL,         -- TER BARU
    source              VARCHAR(50) NOT NULL,         -- Sumber perubahan:
                                                      --   'SEEDER' = dari seed/aggregasi otomatis
                                                      --   'MANUAL_PORTAL' = dari edit portal Daftar Upah
    changed_by          VARCHAR(100) NOT NULL          -- Username yang melakukan perubahan
                            DEFAULT 'system',          -- (dari login session)
    changed_at          DATETIME NOT NULL              -- Waktu perubahan
                            DEFAULT GETDATE(),
    remarks             NVARCHAR(255) NULL             -- Catatan opsional
);
GO

-- Index: Query berdasarkan tahun
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ptkp_changelog_year')
    CREATE INDEX IX_ptkp_changelog_year ON dbo.history_ptkp_pajak_changelog (period_year);
GO

-- Index: Query berdasarkan karyawan
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ptkp_changelog_emp')
    CREATE INDEX IX_ptkp_changelog_emp ON dbo.history_ptkp_pajak_changelog (emp_code);
GO

-- Index: Query berdasarkan waktu (untuk audit terbaru)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ptkp_changelog_time')
    CREATE INDEX IX_ptkp_changelog_time ON dbo.history_ptkp_pajak_changelog (changed_at DESC);
GO

-- =============================================
-- CONTOH QUERY UNTUK MENGAKSES DATA
-- =============================================

-- 1. Lihat semua riwayat perubahan PTKP tahun 2026
-- SELECT * FROM dbo.history_ptkp_pajak_changelog WHERE period_year = 2026 ORDER BY changed_at DESC;

-- 2. Lihat riwayat perubahan PTKP karyawan tertentu
-- SELECT * FROM dbo.history_ptkp_pajak_changelog WHERE emp_code = 'B0075' ORDER BY changed_at DESC;

-- 3. Lihat siapa saja yang mengedit PTKP hari ini
-- SELECT * FROM dbo.history_ptkp_pajak_changelog WHERE CAST(changed_at AS DATE) = CAST(GETDATE() AS DATE);

-- 4. Lihat semua perubahan yang dilakukan dari portal (bukan seeder)
-- SELECT * FROM dbo.history_ptkp_pajak_changelog WHERE source = 'MANUAL_PORTAL' ORDER BY changed_at DESC;

-- 5. Lihat status PTKP aktif saat ini per karyawan
-- SELECT emp_code, emp_name, ptkp_status, kategori_ter, source, updated_at
-- FROM dbo.history_ptkp_pajak WHERE period_year = 2026;

PRINT '✅ Setup PTKP tables complete!';
GO
