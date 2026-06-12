# DOKUMENTASI ARSITEKTUR COMPLETE
# SISTEM PAYROLL DAFTAR UPAH - PT REBINMAS JAYA
# Generated: 2026-06-09 | Hermes AI Agent

---

# BAGIAN 1: GAMBARAN KESELURUHAN (OVERVIEW)

##1.1 Apa Itu Sistem Ini?

Sistem Daftar Upah adalah aplikasi web enterprise untuk mengelola penggajian karyawan kelapa sawit PT Rebinmas Jaya. Sistem ini mengintegrasikan data attendance dari Plantware dengan kalkulasi payroll otomatis, menghasilkan laporan daftar upah per gang/divisi setiap bulan.

**Konteks Bisnis:**
- Sektor: Perkebunan Kelapa Sawit (Palm Oil Plantation)
- Lokasi: PT Rebinmas Jaya - beberapa estate (PG1A, PG1B, PG2A, PG2B, AB1, AB2, ARA, ARC, DME, IJL)
- Karyawan: Ratusan tenaga kerja dengan sistem gang
- Periode: Bulanan (periode payroll)

##1.2 Arsitektur Sistem Global

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React + Vite)                             │
│  Port 5175 (dev) │ /upah/ (prod) │ AG Grid Enterprise │ React Router v7      │
└────────────────────────────┬────────────────────────────────────────────────┘
                             │ HTTP REST API
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     BACKEND (Bun + Elysia.js) Port 8002                     │
│  TypeScript │80+ API endpoints │ Multi-DB via Python SQL Gateway            │
│  PayrollCalculator │ dataExtractorService │ manualAdjustmentService         │
└──────┬────────────────────────────┬────────────────────────────┬────────────┘
 │                            │                            │
       ▼                            ▼                            ▼
┌──────────────┐  ┌──────────────────────────────┐  ┌──────────────────────┐
│  db_ptrj     │  │  extend_db_ptrj               │  │  staging_PTRJ_iFES   │
│  (Plantware) │  │  (history/aggregation)       │  │  (FFB scanner data)   │
│ SQL Server  │  │  SQL Server                   │  │  SQL Server           │
└──────────────┘  └──────────────────────────────┘  └──────────────────────┘
 │
                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     PYTHON SQL GATEWAY (FastAPI)                            │
│  Port 20125 │ MS SQL Server driver │ Multi-profile DB routing              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 1.3 Tech Stack Ringkasan

| Layer | Teknologi | Detail |
|-------|-----------|--------|
| Frontend Runtime | React 18.2.0 | Vite 5.0.0 build |
| Frontend Routing | React Router DOM 7.13.0 | 30+ pages/routes |
| Data Grid | AG Grid Enterprise 31.3.2 | Virtual scrolling, edit inline |
| HTTP Client | Axios 1.7.2 | Interceptors, retry logic |
| Backend Runtime | Bun | TypeScript, native TypeScript support |
| Backend Framework | Elysia.js | Lightweight, fast |
| Database | Microsoft SQL Server | Via Python Gateway |
| Local DB | SQLite | Chroma vector DB |
| Export | ExcelJS4.4.0, html2pdf.js | Payroll reports |

## 1.4 Database Profiles

| Profile | Database | Fungsi |
|---------|----------|--------|
| SERVER_PROFILE_2 | db_ptrj | Data payroll real-time (PR_ADTRANS, HR_EMPLOYEE, dll) |
| SERVER_PROFILE_1 | extend_db_ptrj | History aggregation, manual adjustments |
| SERVER_PROFILE_1 | extend_db_ptrj_transaksi | Detail transaksi taskreg/adtrans |
| SERVER_PROFILE_3 | db_ptrj_mill | Data produksi PKS (WM_TICKET/FFB weight) |
| SERVER_PROFILE_3 | VenusHR14 | Data karyawan PKS |
| SERVER_PROFILE_2 | staging_PTRJ_iFES_Plantware | Data staging FFB scanner |

## 1.5 User Roles& Access

| Role | Akses |
|------|-------|
| Admin | Semua divisi, semua fitur |
| Kerani | Divisi sendiri, input data attendance |
| Finance | Laporan payroll, pajak |
| Executive | Dashboard, ringkasan |
| Visitor | View only, data historis |

---

# BAGIAN 2: BACKEND ARCHITECTURE

# DOKUMENTASI ARSITEKTUR BACKEND - PAYROLL DAFTAR UPAH

## 1. OVERVIEW (Ringkasan)

### Stack Teknologi
- **Runtime**: Bun (JavaScript/TypeScript runtime)
- **Framework**: Elysia.js (lightweight web framework untuk Bun)
- **Bahasa**: TypeScript
- **Database**: Microsoft SQL Server via Python SQL Gateway API
- **Port**: 8002 (konfigurasi via `.env`)
- **Entry Point**: `src/index.ts`

### Konfigurasi Database
Sistem menggunakan multi-database connection:
- `db_ptrj` (default) → SERVER_PROFILE_1 → Data payroll real-time
- `extend_db_ptrj` → SERVER_PROFILE_1 → History aggregation data
- `extend_db_ptrj_transaksi` → SERVER_PROFILE_1 → Detail transaksi (taskreg, adtrans)
- `db_ptrj_mill` → SERVER_PROFILE_3 → Data produksi PKS (WM_TICKET/FFB weight)
- `VenusHR14` → SERVER_PROFILE_3 → Data karyawan PKS
- `staging_PTRJ_iFES_Plantware` → SERVER_PROFILE_2 → Data staging FFB scanner

### Mode Operasional
- **dev**: Menggunakan data real-time dari db_ptrj
- **prod**: Menggunakan history database (extend_db_ptrj) untuk payroll yang sudah final

---

## 2. API ROUTES (Endpoint)

### 2.1 Auth Routes (`/auth`)
| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/auth/login` | Login user |
| GET | `/auth/me` | Get current user info |
| POST | `/auth/refresh` | Refresh JWT token |

### 2.2 Users Routes (`/users`)
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/users` | List all users |
| GET | `/users/:id` | Get user by ID |
| POST | `/users` | Create new user |
| PUT | `/users/:id` | Update user |
| DELETE | `/users/:id` | Delete user |

### 2.3 Payroll Routes (`/payroll`)
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/payroll/divisions` | List all divisions |
| GET | `/payroll/gangs` | List gangs by division |
| GET | `/payroll/report` | Get payroll report (Daftar Upah) |
| GET | `/payroll/employee/:empCode` | Get employee payroll details |
| POST | `/payroll/employee/:empCode/update` | Update employee data |
| GET | `/payroll/premi-definitions` | Get premium definitions |
| POST | `/payroll/premi-definitions` | Save premium definitions |
| POST | `/payroll/manual-adjustment` | Create manual adjustment |
| GET | `/payroll/manual-adjustment` | List manual adjustments |
| PUT | `/payroll/manual-adjustment/:id` | Update manual adjustment |
| DELETE | `/payroll/manual-adjustment/:id` | Delete manual adjustment |
| GET | `/payroll/manual-adjustment/export` | Export manual adjustments |

### 2.4 Employee Routes (`/payroll/employee`)
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/payroll/employee/list` | List employees with filters |
| GET | `/payroll/employee/:empCode` | Get employee details |
| GET | `/payroll/employee/:empCode/attendance` | Get attendance data |
| GET | `/payroll/employee/:empCode/thumbprint` | Get thumbprint data |
| PUT | `/payroll/employee/:empCode` | Update employee |
| GET | `/payroll/employee/:empCode/payroll-history` | Get payroll history |
| GET | `/payroll/employee/:empCode/gang-history` | Get gang assignment history |
| GET | `/payroll/employee/:empCode/comparison` | Compare employee data |

### 2.5 Summary Routes (`/payroll/summary`)
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/payroll/summary/divisions` | Get all division summaries |
| GET | `/payroll/summary/division/:code` | Get specific division summary |
| GET | `/payroll/summary/division/:code/gangs` | Get gang summaries for division |
| POST | `/payroll/summary/refresh-cache` | Refresh summary cache |

### 2.6 Dashboard Routes (`/payroll/dashboard`)
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/payroll/dashboard/executive-summary` | Executive payroll summary |
| GET | `/payroll/dashboard/trend` | Payroll trend over time |
| GET | `/payroll/dashboard/division-breakdown` | Division breakdown |
| GET | `/payroll/dashboard/gang-breakdown` | Gang breakdown |
| GET | `/payroll/dashboard/premi-breakdown` | Premium breakdown |
| GET | `/payroll/dashboard/tonase` | Tonase (FFB) report |

### 2.7 Aggregation Seeder Routes (`/payroll/aggregation`)
| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/payroll/aggregation/seed` | Seed aggregation data |
| POST | `/payroll/aggregation/seed-ui` | Seed based on UI filters |
| POST | `/payroll/aggregation/seed-tonase` | Seed tonase only |
| GET | `/payroll/aggregation/progress` | Get seeding progress |
| GET | `/payroll/aggregation/history` | Get aggregation history |
| GET | `/payroll/aggregation/summary` | Get aggregation summary |
| GET | `/payroll/aggregation/divisions` | List divisions in aggregation |
| GET | `/payroll/aggregation/periods` | List available periods |
| GET | `/payroll/aggregation/health` | Health check extend_db_ptrj |

### 2.8 History Routes (`/payroll/history`)
| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/payroll/history/seed` | Seed history data |
| GET | `/payroll/history` | Get history data |
| GET | `/payroll/history/:id` | Get history detail |
| DELETE | `/payroll/history/:id` | Delete history |
| POST | `/payroll/history/:id/lock` | Lock history |
| POST | `/payroll/history/:id/unlock` | Unlock history |
| GET | `/payroll/history/audit` | Audit trail |

### 2.9 Wages Routes (`/payroll/wages`)
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/payroll/wages/periods/available` | List available periods |
| GET | `/payroll/wages/period/:month/:year` | Get wages by period |
| GET | `/payroll/wages/recap-all/:month/:year` | Get all divisions recap |
| GET | `/payroll/wages/employee/:empCode/history` | Get employee wages history |
| GET | `/payroll/wages/comparison/:month/:year` | Compare wages data |
| GET | `/payroll/wages/comparison/employee/:empCode` | Compare single employee |

### 2.10 Tax Report Routes (`/tax-report`)
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/tax-report/monthly` | Monthly PPH21 tax report |
| GET | `/tax-report/monthly/excel` | Download monthly tax Excel |
| GET | `/tax-report/monthly/excel/progressive` | Progressive Excel export |
| GET | `/tax-report/annual` | Annual tax report |
| GET | `/tax-report/astek-bpjs` | ASTEK & BPJS report |

### 2.11 Other Incomes Routes (`/other-incomes`)
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/other-incomes/` | List other incomes |
| POST | `/other-incomes/` | Create other income |
| PUT | `/other-incomes/:id` | Update other income |
| DELETE | `/other-incomes/:id` | Delete other income |
| GET | `/other-incomes/summary` | THR summary |
| GET | `/other-incomes/recap-all` | Recap all incomes |
| POST | `/other-incomes/calculate-thr` | Calculate THR |
| POST | `/other-incomes/preview-thr` | Preview THR |
| POST | `/other-incomes/bulk-save` | Bulk save incomes |
| GET | `/other-incomes/export` | Export to Excel |
| GET | `/other-incomes/export-bank-list` | Export bank list |
| GET | `/other-incomes/export-thr` | Export THR |
| GET | `/other-incomes/gang-members` | Get gang members |
| GET | `/other-incomes/blacklist` | THR blacklist |
| POST | `/other-incomes/blacklist` | Add to blacklist |
| DELETE | `/other-incomes/blacklist/:id` | Remove from blacklist |

### 2.12 Employee HR Data Routes (`/payroll/employee-hr-data`)
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/payroll/employee-hr-data/list` | List HR data overrides |
| POST | `/payroll/employee-hr-data/override` | Create NIK override |
| GET | `/payroll/employee-hr-data/lookup` | Lookup NIK mapping |
| DELETE | `/payroll/employee-hr-data/:id` | Delete override |
| GET | `/payroll/employee-hr-data/profile-override` | Get profile overrides |
| POST | `/payroll/employee-hr-data/profile-override` | Create profile override |
| PUT | `/payroll/employee-hr-data/profile-override/:id` | Update profile override |
| DELETE | `/payroll/employee-hr-data/profile-override/:id` | Delete profile override |
| GET | `/payroll/employee-hr-data/value-override` | Get value overrides |
| POST | `/payroll/employee-hr-data/value-override` | Create value override |

### 2.13 Employee Gang History Routes (`/payroll/employee-gang-history`)
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/payroll/employee-gang-history/list` | List gang history |
| GET | `/payroll/employee-gang-history/:empCode` | Get employee gang history |
| GET | `/payroll/employee-gang-history/gang/:gangCode` | Get gang members |
| POST | `/payroll/employee-gang-history/seed` | Seed gang history |

### 2.14 Employee Comparison Routes (`/payroll/employee-compare`)
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/payroll/employee-compare/by-division` | Compare by division |
| GET | `/payroll/employee-compare/by-gang` | Compare by gang |
| GET | `/payroll/employee-compare/single/:empCode` | Compare single employee |
| GET | `/payroll/employee-compare/differences` | Get all differences |

### 2.15 Reports Routes (`/reports`)
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/reports/payroll` | Generate payroll report |
| GET | `/reports/premi` | Generate premium report |
| GET | `/reports/potongan` | Generate deduction report |
| GET | `/reports/summary` | Generate summary report |

### 2.16 Employee Estate Routes (`/payroll/employee-estate`)
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/payroll/employee-estate/jobs` | List job titles |
| GET | `/payroll/employee-estate/employees` | List estate employees |
| GET | `/payroll/employee-estate/jabatan` | Get jabatan by gang |

### 2.17 Tunjangan Routes (`/payroll/tunjangan`)
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/payroll/tunjangan/list` | List tunjangan data |
| GET | `/payroll/tunjangan/:empCode` | Get employee tunjangan |
| POST | `/payroll/tunjangan/calculate` | Calculate tunjangan |

### 2.18 Spreadsheet Routes (`/spreadsheet`)
| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/spreadsheet/sync` | Sync to Google Sheets |
| GET | `/spreadsheet/status` | Get sync status |
| POST | `/spreadsheet/refresh` | Refresh spreadsheet data |

### 2.19 Mill Production Routes (`/api/mill-production`)
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/mill-production/summary` | Mill production summary |

### 2.20 Staging Routes (`/staging`)
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/staging/ffb` | Get staging FFB data |
| GET | `/staging/employees` | Get staging employees |
| POST | `/staging/compare` | Compare staging data |
| GET | `/staging/explore` | Explore staging database |

### 2.21 Health & Utility Routes
| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/health` | Health check |
| GET | `/api-info` | API information |
| GET | `/api/cache/stats` | Cache statistics |
| POST | `/api/cache/clear` | Clear cache |

---

## 3. SERVICES (Layanan)

### 3.1 Core Services

#### `dataExtractorService.ts` (Paling Penting)
**Tanggung Jawab**: Ekstraksi dan transformasi data payroll dari database Plantware
**Metode Utama**:
- `extractPayrollData()` - Ekstrak data payroll untuk periode tertentu
- `extractPayrollDataProgressive()` - Ekstrak dengan streaming untuk dataset besar
- `extractWages()` - Ekstrak data wages (gaji) untuk laporan
- `buildEmployeePayrollRow()` - Build baris payroll per karyawan
- `calculatePremi()` - Hitung premi (brondol, prunning, insentif, kinerja)
- `calculatePotongan()` - Hitung potongan (SPSI, PPH21, BPJS, Koreksi)
- `calculateLembur()` - Hitung lembur
- `applyManualAdjustments()` - Apply penyesuaian manual

#### `payrollService.ts`
**Tanggung Jawab**: Operasi bisnis payroll tingkat tinggi
**Metode Utama**:
- `getGangPayrollReport()` - Laporan payroll per gang
- `isPayrollFinalized()` - Cek apakah payroll sudah final
- `getPayratesMap()` - Get map upah dasar karyawan

#### `summaryService.ts`
**Tanggung Jawab**: Aggregasi dan ringkasan data payroll per divisi
**Metode Utama**:
- `getAllDivisionsPremiTotals()` - Total premi semua divisi
- `getDivisionSummary()` - Ringkasan per divisi
- `computeSummary()` - Hitung ringkasan dari data mentah

#### `historyDatabaseService.ts`
**Tanggung Jawab**: Routing database berdasarkan RUN_MODE dan operasi CRUD tabel history
**Metode Utama**:
- `getPayrollDatabase()` - Get instance database payroll
- `getTransactionDatabase()` - Get instance database transaksi
- `savePayrollHistoryMaster()` - Simpan header history
- `savePayrollHistoryDetail()` - Simpan detail history
- `saveHistoryTaskreg()` - Simpan taskreg history
- `saveHistoryAdtrans()` - Simpan adtrans history
- `listEmployeesFromHistory()` - List karyawan dari history
- `generateHistoryId()` - Generate ID unik history

#### `historySeederService.ts`
**Tanggung Jawab**: Proses seeding data payroll real-time ke database history
**Metode Utama**:
- `seedPayrollHistory()` - Entry point utama seeding
- `fetchPayrollData()` - Ambil data payroll
- `seedGangHistory()` - Seed per gang
- `seedTransactions()` - Seed data transaksi

#### `gangService.ts`
**Tanggung Jawab**: Manajemen data gang
**Metode Utama**:
- `getGangsForDivision()` - Get gangs untuk divisi
- `getGangInfo()` - Info gang
- `getGangEmployees()` - Karyawan di gang

#### `employeeEstateService.ts`
**Tanggung Jawab**: Data karyawan dari estate
**Metode Utama**:
- `getEmployeeJobsWithNik()` - Get job title dengan NIK
- `getEmployeeByNik()` - Get karyawan by NIK
- `getJabatanByGang()` - Get jabatan per gang

### 3.2 Calculation Services

#### `lemburCalculator.ts`
**Tanggung Jawab**: Kalkulasi lembur
**Metode Utama**:
- `calculateOvertime()` - Hitung lembur
- `getHolidayRate()` - Rate hari libur
- `getWeekdayRate()` - Rate hari kerja

#### `carumanDefinitions.ts`
**Tanggung Jawab**: Definisi dan kalkulasi caruman (BPJS, ASTEK)
**Metode Utama**:
- `calculateAllCaruman()` - Hitung semua caruman
- `getCarumanForPph21()` - Get caruman untuk PPH21
- `getBpjsRates()` - Get rate BPJS

#### `ptkpTaxService.ts`
**Tanggung Jawab**: PTKP (Penghasilan Tidak Kena Pajak) dan kalkulasi pajak
**Metode Utama**:
- `getPtkpByYear()` - Get data PTKP per tahun
- `mapPTKPToTER()` - Map PTKP ke Tarif TER
- `calculateAnnualTax()` - Hitung pajak tahunan

#### `taxReportService.ts`
**Tanggung Jawab**: Laporan pajak bulanan dan tahunan
**Metode Utama**:
- `getMonthlyTaxReport()` - Laporan pajak bulanan
- `getAnnualTaxReport()` - Laporan pajak tahunan
- `getAstekBpjsReport()` - Laporan ASTEK & BPJS

### 3.3 Supporting Services

#### `payrollDataService.ts`
**Tanggung Jawab**: Service untuk payroll aggregation
**Metode Utama**:
- `saveAggregation()` - Simpan data agregasi
- `getAggregation()` - Get data agregasi

#### `manualAdjustmentService.ts`
**Tanggung Jawab**: Pengelolaan penyesuaian manual payroll
**Metode Utama**:
- `listAdjustments()` - List semua adjustment
- `createAdjustment()` - Buat adjustment baru
- `updateAdjustment()` - Update adjustment
- `deleteAdjustment()` - Hapus adjustment

#### `cacheService.ts`
**Tanggung Jawab**: Caching data payroll untuk periode historis
**Metode Utama**:
- `get()` - Get cached data
- `set()` - Set cache
- `clear()` - Clear cache
- `getStats()` - Statistics cache

#### `dashboardService.ts`
**Tanggung Jawab**: Data dashboard executive
**Metode Utama**:
- `getPayrollTrend()` - Trend payroll
- `getDivisionBreakdown()` - Breakdown per divisi
- `getGangBreakdown()` - Breakdown per gang
- `getTonaseReport()` - Laporan tonase FFB

#### `wagesService.ts`
**Tanggung Jawab**: Perbandingan data wages
**Metode Utama**:
- `getWagesByPeriod()` - Get wages per periode
- `comparePayrollWithWages()` - Bandingkan payroll dengan wages
- `getEmployeeWagesHistory()` - History wages karyawan

#### `otherIncomesService.ts`
**Tanggung Jawab**: Pengelolaan income lain (THR, Bonus, Kontan)
**Metode Utama**:
- `getIncomesWithDetails()` - Get incomes dengan detail
- `addIncome()` - Tambah income
- `calculateTHRData()` - Hitung data THR
- `bulkSaveIncomes()` - Bulk save incomes

#### `millProductionService.ts`
**Tanggung Jawab**: Data produksi PKS
**Metode Utama**:
- `getProductionSummary()` - Ringkasan produksi

#### `employeeGangHistoryService.ts`
**Tanggung Jawab**: Riwayat perpindahan gang karyawan
**Metode Utama**:
- `getGangHistory()` - Get history gang
- `seedGangHistory()` - Seed history gang

#### `employeeHrDataService.ts`
**Tanggung Jawab**: Data HR karyawan (NIK override, profile override)
**Metode Utama**:
- `listOverrides()` - List NIK overrides
- `createOverride()` - Create NIK override
- `listProfileOverrides()` - List profile overrides

#### `duplicateNikMitigationService.ts`
**Tanggung Jawab**: Mitigasi NIK duplikat
**Metode Utama**:
- `hasDuplicate()` - Cek duplikat NIK
- `getAllEmpCodesForNik()` - Get semua emp_code untuk NIK

#### `divisionDefinition.ts`
**Tanggung Jawab**: Definisi dan konfigurasi divisi virtual
**Metode Utama**:
- `isVirtualDivision()` - Cek divisi virtual
- `getVirtualDivisionForGang()` - Get divisi virtual untuk gang
- `getSourceDivisionsForAggregation()` - Get divisi sumber

---

## 4. REPOSITORIES (Repositori Data)

### 4.1 Database Client (`db/client.ts`)
**Fungsi**: Singleton pattern untuk koneksi database
**Metode Utama**:
- `getInstance()` - Get instance database
- `getExtendedInstance()` - Get instance extended DB
- `getMillInstance()` - Get instance mill DB
- `getVenusInstance()` - Get instance Venus DB
- `getStagingInstance()` - Get instance staging DB
- `query()` - Execute query
- `queryOne()` - Execute query, return first row
- `count()` - Execute count query
- `transaction()` - Execute transaction

### 4.2 Division Config Service (`config/DivisionConfigService.ts`)
**Fungsi**: Konfigurasi dan mapping kode divisi
**Data yang Dikelola**:
- Mapping kode divisi (P1A, PG1A, dll)
- Alias divisi
- Konfigurasi divisi virtual
- Pattern gang per divisi

### 4.3 No Separate Repository Files
Sistem menggunakan pattern "service-centric" di mana setiap service langsung mengakses database melalui `Database` class. Tidak ada file repository terpisah.

---

## 5. DATA MODELS / TYPES (Model Data)

### 5.1 User Types (`types/user.ts`)
```typescript
interface User {
    id: number;
    username: string;
    password: string;
    full_name: string;
    email: string;
    role: string;
    division_codes: string[];
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}
```

### 5.2 Employee Types (`types/employee/Employee.ts`)
```typescript
interface Employee {
    emp_code: string;
    nik: string;
    new_nik?: string;
    emp_name: string;
    gender: string;
    religion?: string;
    status?: string;
    join_date?: string;
    terminate_date?: string;
    gang_code?: string;
    division_code?: string;
    loc_code?: string;
    job_code?: string;
    position?: string;
    jabatan?: string;
    is_spsi_member?: boolean;
    phone?: string;
}
```

### 5.3 Payroll History Types (`types/history/HistoryTypes.ts`)
```typescript
interface PayrollHistoryMaster {
    id?: number;
    history_id: string;
    snapshot_batch_id?: number;
    snapshot_version?: number;
    period_month: number;
    period_year: number;
    division_code: string;
    gang_code: string;
    gang_description?: string;
    total_employees: number;
    total_hk: number;
    total_hari_kerja: number;
    total_upah_dasar: number;
    total_upah_pokok: number;
    total_gaji_pokok: number;
    total_beras: number;
    total_jabatan: number;
    total_masa_kerja: number;
    total_lembur: number;
    total_tunjangan: number;
    total_premi: number;
    total_premi_brondol: number;
    total_premi_prunning: number;
    total_premi_insentif: number;
    total_premi_kinerja: number;
    total_koreksi: number;
    total_potongan: number;
    total_pph21: number;
    total_bpjs_pekerja: number;
    total_bpjs_majikan: number;
    total_spsi: number;
    total_upah_kotor: number;
    total_upah_bersih: number;
    is_locked?: boolean;
}

interface PayrollHistoryDetail {
    id?: number;
    history_id: string;
    master_id: number;
    emp_code: string;
    emp_name?: string;
    nik?: string;
    gang_code: string;
    division_code: string;
    status_ptkp?: string;
    kategori_ter?: string;
    jumlah_hk: number;
    upah_dasar: number;
    upah_pokok: number;
    gaji_pokok: number;
    beras_jumlah: number;
    jabatan_jumlah: number;
    masa_kerja_tahun: number;
    masa_kerja_jumlah: number;
    lembur_jam: number;
    lembur_jumlah: number;
    total_tunjangan: number;
    premi_brondol: number;
    premi_brondol_loosefruit?: number;
    premi_brondol_adtrans?: number;
    premi_pph: number;
    total_premi: number;
    pot_spsi: number;
    pot_pph21: number;
    pot_koreksi: number;
    pot_bpjs_pekerja_total: number;
    total_potongan: number;
    jumlah_upah_kotor: number;
    upah_bersih: number;
    pph21_ter: number;
}

interface HistoryTaskreg {
    id?: number;
    history_id: string;
    reg_no?: string;
    reg_date?: Date;
    emp_code: string;
    gang_code?: string;
    division_code?: string;
    trx_date: Date;
    task_code?: string;
    task_desc?: string;
    hours: number;
    rate?: number;
    amount: number;
    is_cuti_tahunan: boolean;
    is_cuti_sakit: boolean;
    is_cuti_minggu: boolean;
    is_cuti_nasional: boolean;
    is_hari_kerja: boolean;
    is_lembur: boolean;
    period_month: number;
    period_year: number;
}

interface HistoryAdtrans {
    id?: number;
    history_id: string;
    doc_no?: string;
    doc_date: Date;
    doc_desc?: string;
    emp_code: string;
    gang_code?: string;
    division_code?: string;
    task_code?: string;
    task_desc?: string;
    amount: number;
    quantity?: number;
    category: string;
    is_dynamic: boolean;
    dynamic_header_name?: string;
    is_premi_pph: boolean;
    is_koreksi: boolean;
    is_potongan: boolean;
    is_premi: boolean;
    period_month: number;
    period_year: number;
}

interface HistoryGangMember {
    id?: number;
    history_id: string;
    gang_code: string;
    gang_description?: string;
    division_code: string;
    loc_code?: string;
    emp_code: string;
    emp_name?: string;
    nik?: string;
    jabatan?: string;
    join_date?: Date;
    is_active: boolean;
    period_month: number;
    period_year: number;
}

interface HistoryMetadata {
    id?: number;
    history_id: string;
    operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOCK' | 'UNLOCK';
    entity_type: 'PAYROLL_MASTER' | 'PAYROLL_DETAIL' | 'TASKREG' | 'ADTRANS' | 'GANG_MEMBER';
    entity_id?: number;
    period_month: number;
    period_year: number;
    performed_by: string;
    performed_at?: Date;
}
```

### 5.4 Payroll Component Types (`types/payroll/PayrollComponent.ts`)
```typescript
interface PayrollComponentMetadata {
    source: 'DATABASE_PLANTWARE' | 'DATABASE_VENUS' | 'CALCULATION' | 'MANUAL' | 'DEFAULT' | 'CACHE';
    taxable?: boolean;
    description?: string;
    calculation_basis?: string;
    last_updated?: Date;
    calculated_at?: Date;
    confidence_level?: 'high' | 'medium' | 'low';
    is_estimated?: boolean;
    dependencies?: string[];
    version?: number;
}

interface PayrollComponent<T = number> {
    value: T;
    meta: PayrollComponentMetadata;
}
```

### 5.5 Aggregation Types (`types/payroll/aggregation.ts`)
```typescript
interface AggregationRecord {
    id?: number;
    period_month: number;
    period_year: number;
    division_code: string;
    gang_code: string;
    gang_description?: string;
    total_employees: number;
    total_hk: number;
    total_upah_dasar: number;
    total_upah_pokok: number;
    total_gaji_pokok: number;
    total_beras: number;
    total_jabatan: number;
    total_masa_kerja: number;
    total_lembur: number;
    total_tunjangan: number;
    total_premi: number;
    total_premi_brondol: number;
    total_premi_prunning: number;
    total_premi_insentif: number;
    total_premi_kinerja: number;
    total_koreksi: number;
    total_potongan: number;
    total_pph21: number;
    total_bpjs_pekerja: number;
    total_bpjs_majikan: number;
    total_spsi: number;
    total_upah_kotor: number;
    total_upah_bersih: number;
    total_ffb_weight?: number;
    total_weight_tbs?: number;
    created_at?: Date;
    updated_at?: Date;
}
```

### 5.6 Data Extractor Types (`types/payroll/dataExtractor.ts`)
```typescript
interface PayrollRow {
    emp_code: string;
    emp_name: string;
    nik: string;
    new_nik?: string;
    gender: string;
    gang_code: string;
    division_code: string;
    loc_code: string;
    status_ptkp: string;
    kategori_ter: string;
    hari_kerja: number;
    jumlah_hk: number;
    upah_dasar: number;
    upah_pokok: number;
    gaji_pokok: number;
    gaji_pokok_aktual: number;
    beras_jumlah: number;
    jabatan_jumlah: number;
    masa_kerja_tahun: number;
    masa_kerja_jumlah: number;
    lembur_jam: number;
    lembur_jumlah: number;
    total_tunjangan: number;
    premi_brondol: number;
    premi_brondol_loosefruit: number;
    premi_brondol_adtrans: number;
    total_premi: number;
    pot_spsi: number;
    pot_pph21: number;
    pot_koreksi: number;
    pot_bpjs_pekerja_total: number;
    total_potongan: number;
    jumlah_upah_kotor: number;
    upah_bersih: number;
    premi: Record<string, number>;
    potongan: Record<string, number>;
}
```

---

## 6. DATABASE CONNECTION (Koneksi Database)

### 6.1 Architecture
Backend menggunakan Python SQL Gateway API sebagai intermediary untuk koneksi ke Microsoft SQL Server. Tidak ada koneksi langsung dari Bun ke SQL Server.

```
Bun Backend (Elysia)
    ↓ HTTP POST (JSON)
Python SQL Gateway (localhost:8001)
    ↓ ODBC / TDS
Microsoft SQL Server
    ├── db_ptrj (SERVER_PROFILE_1)
    ├── extend_db_ptrj (SERVER_PROFILE_1)
    ├── extend_db_ptrj_transaksi (SERVER_PROFILE_1)
    ├── db_ptrj_mill (SERVER_PROFILE_3)
    ├── VenusHR14 (SERVER_PROFILE_3)
    └── staging_PTRJ_iFES_Plantware (SERVER_PROFILE_2)
```

### 6.2 Database Client Pattern
```typescript
// Singleton pattern untuk koneksi database
Database.getInstance()           // db_ptrj default
Database.getExtendedInstance()  // extend_db_ptrj
Database.getMillInstance()       // db_ptrj_mill
Database.getVenusInstance()     // VenusHR14
Database.getStagingInstance()   // staging database
```

### 6.3 Query Execution
```typescript
// Single query
const results = await db.query<RowType>(sql, params);

// Query single row
const row = await db.queryOne<RowType>(sql, params);

// Count query
const count = await db.count(sql, params);

// Transaction
await db.transaction([
    { sql: "INSERT ...", params: [...] },
    { sql: "UPDATE ...", params: [...] }
]);
```

### 6.4 Multi-Database Routing
Berdasarkan `RUN_MODE`:
- **dev**: Payroll data dari `db_ptrj` (real-time)
- **prod**: Payroll data dari `extend_db_ptrj` (history)

---

## 7. KEY BUSINESS LOGIC (Logika Bisnis Utama)

### 7.1 Payroll Calculation Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    PAYROLL CALCULATION                      │
└─────────────────────────────────────────────────────────────┘

1. Data Extraction
   ├─ Fetch employees from HR_GANG, HR_EMPLOYEE
   ├─ Fetch attendance (taskreg) from PR_TASKREGLN
   ├─ Fetch adtrans from PR_ADTRANS
   └─ Apply join_date overrides

2. Working Days Calculation
   ├─ Calculate jumlah_hk (hari kerja efektif)
   ├─ Handle cuti: tahunan, sakit, haid
   ├─ Handle cuti minggu & nasional
   └─ Apply koreksi_hk if any

3. Base Salary Calculation (GajiPokokService)
   ├─ Calculate upah_pokok = upah_dasar × jumlah_hk
   ├─ Calculate gaji_pokok = max(upah_pokok, minimum)
   ├─ Handle prorate for new employees
   └─ Apply koreksi_hk adjustments

4. Tunjangan Calculation
   ├─ Beras: beras_rate × hari kerja
   ├─ Jabatan: jabatan_rate (fixed)
   ├─ Masa Kerja: masa_kerja_rate × masa_kerja_tahun
   └─ Total tunjangan = beras + jabatan + masa_kerja

5. Lembur Calculation (lemburCalculator)
   ├─ Weekday OT: (upah_dasar / 7.5) × 1.5 × jam lembur
   ├─ Weekend OT: (upah_dasar / 7.5) × 2 × jam lembur
   ├─ Holiday OT: (upah_dasar / 7.5) × 3 × jam lembur
   └─ Apply holiday rate from calendar

6. Premi Calculation
   ├─ Brondol Loosefruit: from ADTRANS doc_desc mapping
   ├─ Brondol Adtrans: from ADTRANS doc_desc mapping
   ├─ Brondol Total: sum of brondol components
   ├─ Prunning: from ADTRANS
   ├─ Insentif: from ADTRANS (dynamic)
   ├─ Kinerja: from ADTRANS (dynamic)
   └─ Total premi = brondol + prunning + insentif + kinerja

7. Potongan Calculation
   ├─ SPSI: fixed amount (Rp 4,000)
   ├─ PPH21: from PTKP/TER calculation
   ├─ BPJS Kesehatan (pekerja): based on salary
   ├─ BPJS Kesehatan (majikan): 4% of salary
   ├─ BPJS Pensiun (pekerja): 1% of salary
   ├─ BPJS Pensiun (majikan): 2% of salary
   ├─ ASTEK/JHT: based on salary
   ├─ Koreksi: manual adjustments
   └─ Total potongan = sum of all deductions

8. Final Calculation
   ├─ Upah Kotor = gaji_pokok + tunjangan + lembur + premi
   ├─ Penghasilan Bruto = upah_kotor + bpjs_majikan
   ├─ PPH21 TER = calculated tax
   ├─ Total Potongan = spsi + pph21 + bpjs + koreksi
   └─ Upah Bersih = upah_kotor - total_potongan

9. History Seeding (Optional)
   └─ Save to extend_db_ptrj for historical records
```

### 7.2 Tax Calculation (PPH21 TER)

```
┌─────────────────────────────────────────────────────────────┐
│                    TAX CALCULATION                          │
└─────────────────────────────────────────────────────────────┘

1. PTKP Determination (by employee status)
   ├─ TK/0: Rp 54,000,000
   ├─ TK/1: Rp 58,500,000
   ├─ K/0:   Rp 58,500,000
   ├─ K/1:   Rp 63,000,000
   ├─ K/2:   Rp 67,500,000
   └─ K/3:   Rp 72,000,000

2. MAP PTKP to TER Category
   ├─ ≤ PTKP TK/0 → 5%
   ├─ ≤ PTKP K/0 → 5%
   ├─ ≤ PTKP K/1 → 10%
   ├─ ≤ PTKP K/2 → 15%
   └─ > PTKP K/2 → 25%

3. TER Calculation (Monthly)
   ├─ Biaya Jabatan: 5% of gross, max Rp 500,000/month
   ├─ Iuran Pensiun: 1% of gross
   ├─ Iuran_THT: based on salary
   └─ Net Income = Gross - Biaya Jabatan - Iuran

4. Annual Tax (for December)
   ├─ PKP = Annual Net - Annual PTKP
   ├─ Apply progressive rates:
   │   ├─ ≤ 60M → 5%
   │   ├─ ≤ 250M → 15%
   │   ├─ ≤ 500M → 25%
   │   ├─ ≤ 1B → 30%
   │   └─ > 1B → 35%
   └─ Monthly PPH = Annual Tax / 12
```

### 7.3 Premium Types

| Type | Source | Calculation |
|------|--------|-------------|
| Brondol Loosefruit | ADTRANS (LOOSEFRUIT) | Quantity × rate |
| Brondol Adtrans | ADTRANS (BRONDOL) | Sum of all brondol items |
| Brondol Total | Combined | Loosefruit + Adtrans |
| Prunning | ADTRANS (PRUNING/PRUNING) | From adtrans amount |
| Insentif | ADTRANS (INSENTIF/INCENTIVE) | From adtrans amount |
| Kinerja | ADTRANS (KINERJA/PERFORMANCE) | From adtrans amount |
| Premi PPH | ADTRANS (PPH/TAX) | Tax-related premium |

### 7.4 Virtual Division Handling

```
┌─────────────────────────────────────────────────────────────┐
│               VIRTUAL DIVISION EXTRACTION                   │
└─────────────────────────────────────────────────────────────┘

Real Divisions:
├─ P1A (PG1A) - Plantation 1A
├─ P1B (PG1B) - Plantation 1B
├─ P2A (PG2A) - Plantation 2A
├─ P2B (PG2B) - Plantation 2B
├─ AB1 (ARB1) - Area 1
├─ AB2 (ARB2) - Area 2
├─ ARC (AREC) - Area Estate
├─ ARA - Area Regional
├─ DME - Demo
├─ IJL - Injection Line
└─ MILL - Mill

Virtual Divisions (Extracted from Real):
├─ INF (Infrastructure) - Extracted from P1A (pattern: I%)
├─ NRS (Nursery) - Extracted from P1B (pattern: N%)
├─ WKS_PG (Workshop PG) - Extracted from P1A (pattern: WKS)
├─ WKS_AR (Workshop AR) - Extracted from AB2 (pattern: WKS)
└─ WORKSHOP - Computed as WKS_PG + WKS_AR

Special Gangs (Excluded from parent):
├─ AMC - Harvesting Machinery (excluded from P1A)
├─ HMC - Harvesting Machinery (excluded from P1B)
├─ B2N - Bin 2 North (excluded from P2B)
└─ INT - Internal (excluded from P2A)
```

### 7.5 Overtime Calculation Rules

```
┌─────────────────────────────────────────────────────────────┐
│                   OVERTIME CALCULATION                     │
└─────────────────────────────────────────────────────────────┘

Formula:
OT Rate = (Upah Dasar / 173) × Multiplier

Rates:
├─ Weekday OT: 1.5 × base rate
├─ Weekend OT: 2.0 × base rate
├─ Holiday OT: 3.0 × base rate
└─ Special Holiday: 4.0 × base rate

Input Sources:
├─ Lembur jam from PR_TASKREGLN
├─ Holiday calendar from kalender_libur
└─ OT rates from overtime_config
```

### 7.6 Manual Adjustment System

```
┌─────────────────────────────────────────────────────────────┐
│                  MANUAL ADJUSTMENT FLOW                     │
└─────────────────────────────────────────────────────────────┘

Types:
├─ PREMI: Additional premium (pruning, raking, etc.)
├─ POTONGAN_KOTOR: Gross deduction (koreksi)
└─ POTONGAN_BERSIH: Net deduction adjustment

Sources:
├─ payroll_manual_adjustment_history (main)
├─ payroll_auto_buffer_history (automatic buffer)
└─ payroll_value_override_history (value override)

Application Order:
1. Fetch db_ptrj base values
2. Apply auto buffer adjustments (if not db_ptrj_only)
3. Apply manual adjustments (if not manualBufferOnly)
4. Compare source (db_ptrj vs active)
5. Return final values with metadata
```

---

## 8. FILE DEPENDENCY TREE

```
backend/
├── package.json
├── tsconfig.json
├── .env (configuration)
├── src/
│   ├── index.ts                          # Entry point - Elysia app setup
│   ├── config.ts                         # Configuration class
│   │
│   ├── api/                              # Route handlers
│   │   ├── auth.ts                       # Auth routes
│   │   ├── users.ts                      # User management routes
│   │   ├── payroll.ts                    # Main payroll routes
│   │   ├── employee.ts                   # Employee routes
│   │   ├── summary.ts                    # Summary routes
│   │   ├── dashboardRoutes.ts            # Dashboard routes
│   │   ├── aggregationSeederRoutes.ts    # Aggregation seeding routes
│   │   ├── historyRoutes.ts              # History routes
│   │   ├── wagesRoutes.ts                # Wages comparison routes
│   │   ├── taxReportRoutes.ts            # Tax report routes
│   │   ├── otherIncomesRoutes.ts        # THR/Bonus routes
│   │   ├── employeeHrDataRoutes.ts      # HR data routes
│   │   ├── employeeGangHistoryRoutes.ts # Gang history routes
│   │   ├── employeeComparisonRoutes.ts  # Comparison routes
│   │   ├── reports.ts                    # Report routes
│   │   ├── employeeEstate.ts            # Estate routes
│   │   ├── tunjangan.ts                 # Tunjangan routes
│   │   ├── spreadsheetRoutes.ts         # Google Sheets sync
│   │   ├── millProductionRoutes.ts      # Mill production routes
│   │   ├── stagingRoutes.ts             # Staging data routes
│   │   ├── logsRoutes.ts                # Dev logging routes
│   │   ├── devConfig.ts                 # Dev config routes
│   │   ├── parallelAggregationSeeder.ts # Parallel seeding
│   │   └── uiBasedSeeder.ts             # UI-based seeding
│   │
│   ├── services/                         # Business logic
│   │   ├── dataExtractorService.ts       # Core payroll extraction (MOST IMPORTANT)
│   │   ├── payrollService.ts             # High-level payroll operations
│   │   ├── summaryService.ts             # Summary aggregation
│   │   ├── historyDatabaseService.ts     # History DB operations
│   │   ├── historySeederService.ts        # History seeding
│   │   ├── gangService.ts               # Gang management
│   │   ├── employeeEstateService.ts      # Employee estate data
│   │   ├── employeeGangHistoryService.ts # Gang history
│   │   ├── employeeHrDataService.ts      # HR data overrides
│   │   ├── duplicateNikMitigationService.ts # NIK duplicate handling
│   │   ├── manualAdjustmentService.ts   # Manual adjustments
│   │   ├── cacheService.ts              # Caching layer
│   │   ├── dashboardService.ts          # Dashboard data
│   │   ├── wagesService.ts             # Wages comparison
│   │   ├── otherIncomesService.ts      # THR/Bonus service
│   │   ├── millProductionService.ts    # Mill production
│   │   ├── taxReportService.ts         # Tax reporting
│   │   ├── ptkpTaxService.ts           # PTKP tax calculation
│   │   ├── payrollDataService.ts        # Payroll aggregation service
│   │   ├── payrollOverlayService.ts    # Payroll overlay
│   │   ├── payrollTotalsCalculator.ts  # Calculate totals
│   │   ├── payrollVerificationService.ts # Verification
│   │   ├── manualAdjustmentVerificationService.ts
│   │   ├── manualAdjustmentSyncStatusSeederService.ts
│   │   ├── autoBufferManualAdjustmentSeederService.ts
│   │   ├── premiumImportService.ts
│   │   ├── deductionAdjustmentService.ts
│   │   ├── lemburCalculator.ts         # Overtime calculation
│   │   ├── divisionDefinition.ts        # Division definitions
│   │   ├── harvesterService.ts         # Harvester data
│   │   ├── currentPeriodService.ts     # Current period
│   │   │
│   │   ├── config/
│   │   │   └── DivisionConfigService.ts # Division configuration
│   │   │
│   │   ├── payroll/
│   │   │   ├── adtransDocDescMapping.ts # ADTRANS mapping
│   │   │   ├── payrollAutoBufferService.ts # Auto buffer
│   │   │   ├── formulas/
│   │   │   │   └── PTKPMapper.ts       # PTKP mapping
│   │   │   ├── extractors/
│   │   │   │   └── leaveRules.ts       # Leave calculation
│   │   │   └── manualAdjustments/
│   │   │       ├── manualAdjustmentNaming.ts
│   │   │       ├── manualAdjustmentApplier.ts
│   │   │       └── autoBufferAdcodeMap.ts
│   │   │
│   │   └── additional_service/
│   │       └── explore_staging/
│   │           ├── stagingExplorerService.ts
│   │           └── stagingComparisonService.ts
│   │
│   ├── repositories/                     # (No separate repo files - service-centric)
│   │
│   ├── db/
│   │   └── client.ts                    # Database connection singleton
│   │
│   ├── types/
│   │   ├── user.ts                     # User types
│   │   ├── harvest.ts                   # Harvester types
│   │   ├── history/
│   │   │   └── HistoryTypes.ts          # History model types
│   │   ├── employee/
│   │   │   └── Employee.ts             # Employee types
│   │   └── payroll/
│   │       ├── PayrollComponent.ts      # Component metadata
│   │       ├── BasePayrollTypes.ts      # Base payroll types
│   │       ├── dataExtractor.ts         # Data extractor types
│   │       ├── aggregation.ts           # Aggregation types
│   │       └── payrollOverlay.ts        # Overlay types
│   │
│   └── utils/
│       ├── logger.ts                   # Logging utility
│       ├── authBypass.ts               # Auth bypass utils
│       ├── taxReportQuery.ts            # Tax query resolution
│       ├── taxReportIdentity.ts         # Tax identity resolution
│       ├── taxDomExportRows.ts          # Tax DOM export
│       ├── employeeSort.ts              # Employee sorting
│       ├── batchProcessor.ts            # Batch processing
│       ├── payrollProfileRules.ts       # Profile rules
│       ├── payrollGangScope.ts          # Gang scope resolution
│       └── historySeederCleanup.ts      # Cleanup policy
│
└── tests/                               # (Test files alongside services)
    ├── services/*.test.ts
    ├── api/*.test.ts
    └── ...
```

### Dependency Flow

```
index.ts
  ├─ config.ts (configuration)
  ├─ db/client.ts (database)
  │
  ├─ api/routes (request handlers)
  │   └─ services/ (business logic)
  │       ├─ dataExtractorService.ts
  │       │   ├─ db/client.ts
  │       │   ├─ gangService.ts
  │       │   ├─ lemburCalculator.ts
  │       │   ├─ employeeEstateService.ts
  │       │   ├─ carumanDefinitions.ts
  │       │   ├─ ptkpTaxService.ts
  │       │   ├─ manualAdjustmentService.ts
  │       │   └─ payroll/ (submodules)
  │       │
  │       ├─ historyDatabaseService.ts
  │       │   └─ db/client.ts
  │       │
  │       ├─ summaryService.ts
  │       │   ├─ db/client.ts
  │       │   ├─ thumbprintService.ts
  │       │   ├─ divisionDefinition.ts
  │       │   └─ config/DivisionConfigService.ts
  │       │
  │       └─ [other services]...
  │
  └─ types/ (TypeScript definitions)
      └─ payroll/ (data models)
```

---

## 9. KEY CONFIGURATIONS

### 9.1 Upah Dasar by Year
| Tahun | Upah Dasar |
|-------|-----------|
| 2024 | Rp 125,000 |
| 2025 | Rp 129,220 |
| 2026 | Rp 129,220 |

### 9.2 Tunjangan Rates by Year
| Komponen | 2025 | 2026 |
|----------|------|------|
| Beras Rate | Rp 35,000 | Rp 35,000 |
| Jabatan Rate | Rp 150,000 | Rp 150,000 |
| Masa Kerja Rate | Rp 25,000 | Rp 25,000 |

### 9.3 BPJS Rates
| Jenis | Pekerja | Majikan |
|-------|---------|---------|
| Kesehatan | 1% | 4% |
| Pensiun | 1% | 2% |
| JHT/ASTEK | 0.3% | 0.3% |

### 9.4 SPSI Iuran
- Fixed: Rp 4,000 per bulan

---

## 10. ERROR HANDLING & LOGGING

### 10.1 Logging Levels
- `DEBUG`: Query details, cache operations
- `INFO`: HTTP requests (non-GET), important operations
- `WARN`: Slow queries (>1s), configuration warnings
- `ERROR`: Failed operations, database errors

### 10.2 Database Error Handling
- Automatic retry with exponential backoff
- Max 3 retries per query
- Timeout detection and skip retry on timeout errors

### 10.3 Seeder Error Handling
- 30-minute timeout for long-running seeders
- Progress tracking with last_update timestamp
- Force reset capability for stuck processes

---

## 11. SECURITY

### 11.1 Authentication
- JWT-based authentication
- External auth mode for proxy deployments
- Internal auth mode for direct deployments
- API key bypass for service-to-service calls

### 11.2 Authorization
- Role-based access control (ADMIN, USER, VIEWER)
- Division-based filtering
- Endpoint-level authentication checks

### 11.3 Data Protection
- NIK duplicate mitigation (append-only for new_nik)
- History audit trail
- Lock/unlock mechanism for finalized payroll

---

## 12. PERFORMANCE OPTIMIZATIONS

### 12.1 Caching Strategy
- Historical payroll data: cached
- Current period data: always fresh
- Gang/division metadata: cached
- Holiday calendar: cached per year

### 12.2 Progressive Extraction
- Streaming data extraction for large datasets
- Batch processing for seeding operations
- Parallel seeding for multiple divisions

### 12.3 Database Optimizations
- Connection pooling via singleton
- Parameterized queries to prevent SQL injection
- Indexed columns for frequently queried fields

---

Dokumentasi ini disusun berdasarkan analisis kode sumber lengkap. Untuk detail lebih lanjut tentang implementasi spesifik, silakan merujuk ke file-file sumber yang relevan.

---

# BAGIAN 3: DATABASE & QUERIES ARCHITECTURE

# DATABASE & QUERIES ARCHITECTURE

## 1. Database Overview

### 1.1 Sistem Database yang Digunakan

Sistem Daftar Upah menggunakan arsitektur database terdistribusi dengan beberapa sumber data:

- **Primary Database (Plantware DB)**: Microsoft SQL Server
  - Database utama: `db_ptrj` (Payroll Transaction Jakarta)
  - Server: staging_PTRJ_iFES_Plantware ( untuk data berat/wight)
  - Jenis query: T-SQL dengan sintaks `TOP`, `GETDATE()`, dll.

- **Secondary Database (Arc)**: Archive databases untuk data historis
  - Menggunakan suffix `_ARC` pada nama tabel
  - Menyimpan data historical payroll dan attendance

- **Local/Staging Database**:
  - SQLite untuk data konfigurasi lokal (users.db, Chroma vector db)
  - JSON configuration files untuk data definisi premium dan adjustment

### 1.2 Karakteristik Koneksi Database

| Aspek | Detail |
|-------|--------|
| **DBMS** | Microsoft SQL Server (SQL Server 2016+) |
| **Primary DB** | db_ptrj.dbo |
| **Archive DB** | PR_*_ARC tables |
| **Staging DB** | staging_PTRJ_iFES_Plantware |
| **Local Config** | SQLite + JSON files |

---

## 2. Table Categories

### 2.1 Kategori Tabel berdasarkan Fungsi

#### A. Attendance & Presensi
- `PR_EMP_ATTN` / `PR_EMP_ATTN_ARC` - Data kehadiran karyawan
- `PR_TASKREG_ARC` / `PR_TASKREGLN_ARC` - Registrasi tugas harian (jam kerja)
- `HR_HOLIDAY_ARC` - Kalender hari libur nasional

#### B. Employee & HR
- `HR_EMPLOYEE` - Data master karyawan
- `HR_EMPLOYMENT` - Data employment dan masa kerja
- `HR_GANG` / `HR_GANGLN` - Master gang dan anggota gang
- `HR_GPH` - General Public Holiday

#### C. Payroll & Transactions
- `PR_ADTRANS_ARC` / `PR_ADTRANSLN_ARC` - Transaksi tambahan (tunjangan/potongan)
- `PR_LOOSEFRUIT_ARC` / `PR_LOOSEFRUITLN_ARC` - Data brondolan

#### D. Reference/Master Data
- `PR_TASKCODE` - Kode tugas dan deskripsi pekerjaan

#### E. Field/Production Data
- `iFES_MillWeight` - Data berat TBM (Tandan Buah Mentah)
- `Field_Profile` - Profil blok tanaman

---

## 3. Key Tables

### 3.1 Tabel Utama Payroll

| Tabel | Fungsi | Key Columns |
|-------|--------|-------------|
| `HR_EMPLOYEE` | Master data karyawan | EmpCode, EmpName, LocCode, Gender, IsActive |
| `HR_GANGLN` | Mapping karyawan ke gang | GangMember, GangCode, Status |
| `PR_EMP_ATTN_ARC` | Absensi harian | EmpCode, AttnDate, IsPresent, IsRestDay, IsHoliday |
| `PR_TASKREGLN_ARC` | Detail tugas/jam kerja | EmpCode, TrxDate, TaskCode, Hours, Amount, OT |
| `PR_ADTRANS_ARC` | Header transaksi tunjangan | ID, EmpCode, DocDate, DocDesc, AccMonth, AccYear |
| `PR_ADTRANSLN_ARC` | Detail baris transaksi | MasterID, TaskCode, Amount |
| `HR_EMPLOYMENT` | Data employment | EmpCode, AppJoinGrpDate, Years of Service |

### 3.2 Tabel Pendukung

| Tabel | Fungsi | Key Columns |
|-------|--------|-------------|
| `HR_GANG` | Master gang | GangCode, GangLeader, LocCode, ADCode |
| `PR_TASKCODE` | Kode pekerjaan | TaskCode, TaskDesc, TaskType, UOM |
| `HR_HOLIDAY_ARC` | Kalender hari libur | HolidayDate, Status |
| `HR_GPH` | Hari libur umum | GPHCode, Description, HolidayDate, Status |
| `PR_LOOSEFRUIT_ARC` | Data brondolan | ID, DocDate, EmpCode |
| `PR_LOOSEFRUITLN_ARC` | Detail brondolan | MasterID, EmpCode, Amount |
| `PR_GANG` | Gang payroll | ID, Description (GangCode), AccMonth, AccYear |
| `PR_GANGLN_ARC` | Anggota gang archive | MasterID, EmpCode, AccMonth, AccYear |

---

## 4. SQL Query Inventory

### 4.1 Kategori: Absensi & Kehadiran

#### 4.1.1 Query Absensi Karyawan
**File**: `absen/getAttandances.sql`
- **Tabel**: `PR_EMP_ATTN`
- **Data**: ID, AttnDate, WorkHours, OTHours, IsOnLeave, LeaveLength, TodayIsRestDay, TodayIsHoliday, LocCode, PhysMonth, PhysYear
- **Purpose**: Mengambil data kehadiran lengkap karyawan per periode
- **Filter**: EmpCode spesifik, range tanggal

**File**: `absen/getEmployeeHK.sql`
- **Tabel**: `PR_EMP_ATTN`, `PR_GANG_MEMBER`
- **Data**: Employee attendance dengan GangCode
- **Purpose**: Mengambil HK (Hari Kerja) per karyawan dengan informasi gang
- **Filter**: EmpCode, AttnDate range, IsPresent='true'

**File**: `absen/getListEmpCodeByLocCode.sql`
- **Tabel**: `HR_EMPLOYEE`, `HR_GANGLN`
- **Data**: EmployeeCode, EmployeeName, LocationCode, GangCode, GangName, IsActive
- **Purpose**: Mendapatkan daftar karyawan berdasarkan lokasi kerja
- **Filter**: LocCode parameter, IsActive=1

#### 4.1.2 Query Detail HK (Hari Kerja)
**File**: `absensi/get_detail_HK.sql`
- **Tabel**: `PR_TASKREGLN_ARC`
- **Data**: TrxDate, TaskCode
- **Purpose**: Mengambil detail tanggal kerja tanpa lembur
- **Filter**: EmpCode, bulan, tahun, OT=0

**File**: `absensi/get_total_HK_each_Emp.sql`
- **Tabel**: `PR_TASKREGLN_ARC`
- **Data**: COUNT tanggal kerja
- **Purpose**: Menghitung total HK per karyawan
- **Filter**: EmpCode, bulan, tahun, OT=0

**File**: `get_total_HK.sql`
- **Tabel**: `PR_EMP_ATTN_ARC`
- **Data**: total_hk (count semua record)
- **Purpose**: Query parameterized untuk menghitung HK dengan placeholder
- **Filter**: EmpCode, start_date, end_date (using :emp_code, :start_date, :end_date)

#### 4.1.3 Query Ketidakhadiran
**File**: `absensi/ketidakhadiran/get_detail_cuti_absensi .sql`
- **Tabel**: `PR_TASKREGLN_ARC`
- **Data**: TrxDate, TaskCode
- **Purpose**: Detail cuti karyawan (taskcode LIKE 'GA9129%')
- **Filter**: EmpCode, bulan, tahun, OT=0

**File**: `absensi/ketidakhadiran/get_total_cuti_absensi.sql`
- **Tabel**: `PR_TASKREGLN_ARC`
- **Data**: COUNT record cuti
- **Purpose**: Total hari cuti karyawan
- **Filter**: EmpCode, bulan, tahun, OT=0, TaskCode LIKE 'GA9129%'

**File**: `absensi/ketidakhadiran/get_detail_sakit_absensi.sql`
- **Tabel**: `PR_TASKREGLN_ARC`
- **Data**: TrxDate, TaskCode
- **Purpose**: Detail sakit karyawan (taskcode LIKE 'GA9126%')

**File**: `absensi/ketidakhadiran/get_total_sakit_absensi.sql`
- **Tabel**: `PR_TASKREGLN_ARC`
- **Data**: COUNT record sakit
- **Purpose**: Total hari sakit karyawan
- **Filter**: EmpCode, bulan, tahun, OT=0, TaskCode LIKE 'GA9126%'

**File**: `absensi/ketidakhadiran/get_minggu_detail.sql`
- **Tabel**: `PR_TASKREGLN_ARC`
- **Data**: TrxDate (tanggal Minggu)
- **Purpose**: Detail kehadiran hari Minggu
- **Filter**: EmpCode, bulan, tahun, OT=0, DATEPART(weekday)=1

**File**: `absensi/ketidakhadiran/get_total_HK_minggu.sql`
- **Tabel**: `PR_TASKREGLN_ARC`
- **Data**: COUNT record hari Minggu
- **Purpose**: Total kehadiran hari Minggu

**File**: `absensi/ketidakhadiran/get_detail_absen_libur_nasional.sql`
- **Tabel**: `PR_TASKREGLN_ARC`, `HR_GPH`
- **Data**: TrxDate, HolidayGPHCode, HolidayDescription, IsHolidayDate
- **Purpose**: Detail kehadiran saat hari libur nasional
- **Join**: Dengan HR_GPH untuk informasi holiday

**File**: `absensi/ketidakhadiran/get_total_absen_libur_nasional.sql`
- **Tabel**: `PR_TASKREGLN_ARC`
- **Data**: COUNT tanggal weekend (weekday=1)
- **Purpose**: Total kehadiran saat weekend/libur

### 4.2 Kategori: Karyawan & Gang

#### 4.2.1 Query Gang
**File**: `Gang/getGangListFromLocCode.sql`
- **Tabel**: `HR_GANG`
- **Data**: GangCode, GangLeader, ADCode, Status, CreateDate, UpdateDate, Description, LocCode
- **Purpose**: Mengambil daftar gang berdasarkan lokasi
- **Filter**: LocCode='P2B' (contoh)

**File**: `Gang/getListGangEachLocCode.sql`
- **Tabel**: `HR_GANG`
- **Data**: Semua kolom gang
- **Purpose**: Mengambil semua gang per lokasi
- **Filter**: locCode='AB2'

**File**: `Gang/getListDivisiUsingLocCode.sql`
- **Tabel**: `HR_GANG`
- **Data**: LocCode (distinct)
- **Purpose**: Mengambil daftar LocCode unik

**File**: `Gang/getHistoryGang.sql`
- **Tabel**: `PR_GANG`, `PR_GANGLN_ARC`
- **Data**: GangID, GangCode (Description), EmpCode, PajakMonth, PajakYear, ActualMonth, ActualYear
- **Purpose**: Riwayat gang karyawan dengan konversi bulan pajak ke bulan kalender
- **Logic**: AccMonth <= 9 → ActualMonth = AccMonth + 3, ActualYear = AccYear - 1

**File**: `Gang/getLIsttGang.sql`
- **Tabel**: `HR_GANG`
- **Data**: Semua data gang
- **Purpose**: Query sederhana untuk list semua gang

#### 4.2.2 Query Karyawan per Gang
**File**: `get_empcode_gangcode_by_divisi.sql`
- **Tabel**: `HR_EMPLOYEE`, `HR_GANGLN`
- **Data**: EmpCode, GangCode
- **Purpose**: Mapping karyawan ke gang berdasarkan prefix divisi
- **Filter**: UPPER(GangCode) LIKE UPPER(? || '%')

**File**: `get_emp_gang_by_divisi_detailed.sql`
- **Tabel**: `HR_EMPLOYEE`, `HR_GANGLN`
- **Data**: EmpCode, EmpName, LocCode, GangCode
- **Purpose**: Data lengkap karyawan per divisi
- **Filter**: LIKE pattern untuk prefix divisi

**File**: `get_detail_emp_each_gang.sql`
- **Tabel**: `HR_EMPLOYEE`, `HR_GANGLN`
- **Data**: EmpCode, EmpName, Gender, LocCode
- **Purpose**: Detail karyawan per gang
- **Filter**: GangCode parameter

**File**: `get_emp_gang_by_divisi_detailed_inner.sql`
- **Tabel**: `HR_EMPLOYEE`, `HR_GANGLN`
- **Data**: EmpCode, EmpName, LocCode, GangCode
- **Purpose**: Query serupa dengan INNER JOIN untuk data lebih akurat

### 4.3 Kategori: Tunjangan (Allowances)

#### 4.3.1 Query Tunjangan Masa Kerja
**File**: `Tunjangan/get_amount_masa_kerja.sql`
- **Tabel**: `PR_ADTRANS_ARC`, `PR_ADTRANSLN_ARC`
- **Data**: SUM(ln.Amount) - total tunjangan masa kerja
- **Purpose**: Menghitung tunjangan masa kerja per karyawan
- **Filter**: EmpCode, date range, DocDesc='TUNJANGAN MASA KERJA'

**File**: `Tunjangan/count_masa_kerja.sql`
- **Tabel**: `HR_EMPLOYMENT`
- **Data**: Semua kolom + YearsSinceAppJoinGrpDate (calculated)
- **Purpose**: Menghitung masa kerja dalam tahun
- **Logic**: DATEDIFF dengan koreksi bulan dan hari

#### 4.3.2 Query Tunjangan Jabatan
**File**: `Tunjangan/Gett_Amount_Tunjangan_Jabatan.sql`
- **Tabel**: `PR_ADTRANS_ARC`, `PR_ADTRANSLN_ARC`
- **Data**: SUM(ln.Amount) - total tunjangan jabatan
- **Purpose**: Menghitung tunjangan jabatan per karyawan
- **Filter**: EmpCode, date range, DocDesc='TUNJANGAN JABATAN'

#### 4.3.3 Query Tunjangan Lembur
**File**: `Tunjangan/get_amount_lembur.sql`
- **Tabel**: `PR_TASKREG_ARC`, `PR_TASKREGLN_ARC`
- **Data**: SUM(trl.Amount), SUM(trl.Hours)
- **Purpose**: Menghitung total dan jam lembur
- **Filter**: EmpCode, date range, OT=1

#### 4.3.4 Query Brondolan
**File**: `Tunjangan/get_brondol_amount.sql`
- **Tabel**: `PR_LOOSEFRUIT_ARC`, `PR_LOOSEFRUITLN_ARC`
- **Data**: SUM(LFLN.Amount) - total brondolan
- **Purpose**: Menghitung bonus brondolan per karyawan
- **Filter**: EmpCode, date range, filter ID codes (CHARINDEX)

#### 4.3.5 Query HK dan Holiday
**File**: `Tunjangan/get_total_HK.sql`
- **Tabel**: `HR_EMPLOYEE`, `HR_GANGLN`, `PR_EMP_ATTN_ARC`
- **Data**: nik, nama, gang_code, hari_kerja (HK count)
- **Purpose**: Menghitung HK per karyawan dalam gang
- **Logic**: COUNT dengan kondisi IsPresent='true' AND IsRestDay='false' AND IsHoliday='false'

**File**: `Tunjangan/get_HK_nasional_holiday.sql`
- **Tabel**: `HR_HOLIDAY_ARC`
- **Data**: EmpCode, cuti_nasional_hari (COUNT where Status='N')
- **Purpose**: Menghitung hari libur nasional dalam periode

**File**: `get_HK_nasional_holiday.sql`
- **Tabel**: `HR_HOLIDAY_ARC`
- **Data**: EmpCode, cuti_nasional_hari
- **Purpose**: Query serupa untuk holiday calculation

#### 4.3.6 Query Detail Karyawan per Gang (Comprehensive)
**File**: `Tunjangan/get_detail_emp_each_gang.sql`
- **Tabel**: `HR_EMPLOYEE`, `HR_GANGLN`, `PR_EMP_ATTN_ARC`, `PR_ADTRANS_ARC`
- **Data**: Comprehensive employee data dengan:
  - Identitas: nik, nama, jenis_kelamin, loc_code, gang_code, gang_status
  - HK: hari_kerja
  - Gaji: gaji_pokok (PayRate)
  - Tunjangan: jabatan_jumlah, masa_kerja_jumlah, lembur_jumlah, total_tunjangan
  - Potongan: total_potongan_bpjs (BPJS pekerja + BPJS majikan + SPSI)
- **Purpose**: Query lengkap untuk laporan daftar upah per gang
- **Subqueries**: Multiple LEFT JOINs untuk menghitung tunjangan dan potongan

#### 4.3.7 Query Dynamic Headers
**File**: `Tunjangan/get_dynamic_header.sql`
- **Tabel**: `PR_ADTRANS_ARC`, `PR_ADTRANSLN_ARC`
- **Data**: DISTINCT DocDesc (jenis tunjangan)
- **Purpose**: Mengambil daftar jenis tunjangan dinamis untuk periode
- **Filter**: EmpCode LIKE 'H%', date range

### 4.4 Kategori: Potongan (Deductions)

#### 4.4.1 Query PPH21
**File**: `potongan/potong_pph21.sql`
- **Tabel**: `PR_ADTRANS_ARC`, `PR_ADTRANSLN_ARC`, `PR_TASKCODE`
- **Data**: DocDesc, TaskCode, TaskDesc
- **Purpose**: Mencari record PPH21 dalam transaksi
- **Filter**: TaskDesc LIKE '%pph%'

#### 4.4.2 Query SPSI
**File**: `potongan/potongan_spsi.sql`
- **Tabel**: `PR_ADTRANS_ARC`, `PR_ADTRANSLN_ARC`, `PR_TASKCODE`
- **Data**: DocDesc, TaskCode, TaskDesc
- **Purpose**: Mencari record SPSI dalam transaksi
- **Filter**: TaskDesc LIKE '%spsi%', EmpCode, date range

#### 4.4.3 Query Premi PPH
**File**: `potongan/Premi_PPH.sql`
- **Tabel**: `PR_ADTRANS`, `PR_ADTRANSLN`, `PR_TASKCODE`
- **Data**: DocDesc, TaskCode, TaskDesc
- **Purpose**: Mencari premi accruals-checkroll untuk PPH
- **Filter**: TaskDesc='ACCRUALS-CHECKROLL', EmpCode, date range

#### 4.4.4 Query Koreksi
**File**: `potongan/potong_koreksi.sql`
- **Tabel**: `PR_ADTRANS_ARC`, `PR_ADTRANSLN_ARC`
- **Data**: Semua kolom header + Amount
- **Purpose**: Mengambil transaksi koreksi payroll
- **Filter**: UPPER(DocDesc) LIKE '%KORE%'

### 4.5 Kategori: Headers Dinamis

#### 4.5.1 Query Dynamic Headers Tunjangan
**File**: `headers/getPremiDynamicHeaders.sql`
- **Tabel**: `PR_ADTRANS_ARC`, `PR_ADTRANSLN_ARC`, `HR_EMPLOYEE`, `HR_GANGLN`
- **Data**: DISTINCT DocDesc (semua jenis premi/tunjangan)
- **Purpose**: Generate dynamic columns untuk laporan
- **Filter**: GangCode parameter, date range, DocDesc IS NOT NULL

#### 4.5.2 Query Dynamic Headers Potongan
**File**: `headers/getPotonganDynamicHeaders.sql`
- **Tabel**: `PR_ADTRANS_ARC`, `PR_ADTRANSLN_ARC`, `HR_EMPLOYEE`, `HR_GANGLN`
- **Data**: DISTINCT DocDesc yang LIKE 'POT%'
- **Purpose**: Generate dynamic columns untuk potongan
- **Filter**: Exclude PPH21, koreksi, spsi, hanya yang LIKE 'POT%'

### 4.6 Kategori: HR History

#### 4.6.1 Query Career Progress
**File**: `HR_History/getHistoryCarrerProgress.sql`
- **Tabel**: `HR_EMPLOYEE`
- **Data**: 53 kolom lengkap employee data
- **Purpose**: Mengambil history karir karyawan lengkap
- **Filter**: NewICNo (NIK) spesifik

### 4.7 Kategori: Adtrans & Task Mapping

#### 4.7.1 Query AL/DE TaskDesc
**File**: `Adtrans/get_only_al_de_taskdesk.sql`
- **Tabel**: `PR_TASKCODE`
- **Data**: TaskDesc
- **Purpose**: Mengambil task description untuk AL (Alat) dan DE (Detail)
- **Filter**: TaskDesc LIKE '(AL)%' OR '(DE)%'

#### 4.7.2 Query Unique TaskCode-DocDesc Pair
**File**: `Adtrans/get_unik_pair_taskcode_docDesc.sql`
- **Tabel**: `PR_ADTRANS_ARC`, `PR_ADTRANSLN_ARC`, `PR_TASKCODE`
- **Data**: DocDesc, BaseTaskCode (LEFT function), TaskDesc
- **Purpose**: Mapping unik antara DocDesc dan TaskCode
- **Filter**: AccYear, AccMonth range

### 4.8 Kategori: JobCode & Task Categories

#### 4.8.1 Query Kategori Pekerjaan
**File**: `JobCode/kategori_pekerjaan_taskcode.sql`
- **Tabel**: `PR_TASKREGLN_ARC`, `PR_TASKCODE`
- **Data**: TrxDate, EmpCode, EmpName, TaskCode, TaskDesc, TaskType, UOM, Hours, Amount, Status
- **Purpose**: Kategorisasi pekerjaan berdasarkan task code
- **Filter**: Date range

### 4.9 Kategori: Weight & Field Data

#### 4.9.1 Query Weight dari Field
**File**: `weight/getWeightFromField.sql`
- **Tabel**: `iFES_MillWeight`, `Field_Profile`
- **Data**: No_Tiket, No_DO, Tgl_Panen, No_Kendaraan, Berat_KG, Janjang, Brondolan, Kode_Blok, Divisi, Tipe_Tanaman, Luas_Hektar, Populasi_Pohon, Kelas_Yield
- **Purpose**: Mengambil data berat TBM dari field dengan mapping blok
- **Join**: Dengan Field_Profile berdasarkan FieldNo dan OC_Code

### 4.10 Kategori: Analisis Payroll

#### 4.10.1 Query Total Gaji Pokok Plantware
**File**: `analisis/total_gaji_pokok_amount_plantwre..sql`
- **Tabel**: `PR_TASKREGLN`
- **Data**: EmpCode, EmpName, TotalAmountReguler, HariKerjaReguler
- **Purpose**: Analisis total gaji pokok reguler per karyawan
- **Filter**: Date range, OT=0, GROUP BY employee

#### 4.10.2 Query Kurang Jam HK
**File**: `analisis/kurangJamHK.sql`
- **Tabel**: `PR_TASKREGLN`
- **Data**: EmpCode, EmpName, TrxDate, NamaHari, TotalHoursActual, TargetHours, SelisihJam, Keterangan
- **Purpose**: Deteksi karyawan dengan jam kerja di bawah target
- **Logic**: CTE dengan Window Function, target 7 jam reguler, 5 jam hari Jumat
- **Filter**: WHERE TotalHoursActual < TargetHours

### 4.11 Kategori: Cuti

#### 4.11.1 Query Cuti Sakit
**File**: `get_cuti_sakit.sql`
- **Tabel**: `PR_TASKREG_ARC`, `PR_TASKREGLN_ARC`
- **Data**: COUNT(*) as total_cuti
- **Purpose**: Menghitung total cuti sakit
- **Filter**: TaskCode LIKE 'GA9126%'

#### 4.11.2 Query Cuti Tahunan
**File**: `get_cuti_tahunan.sql`
- **Tabel**: `PR_TASKREG_ARC`, `PR_TASKREGLN_ARC`
- **Data**: COUNT(*) as total_hari_cuti
- **Purpose**: Menghitung total cuti tahunan
- **Filter**: TaskCode LIKE 'GA9129%'

### 4.12 Kategori: Test Queries

#### 4.12.1 Test Files
**File**: `test.sql` - Query test general
**File**: `absen/test.sql` - Query test untuk absensi

---

## 5. Data Flow Architecture

### 5.1 Alur Data dari Plantware DB ke Frontend

```
┌─────────────────────────────────────────────────────────────────┐
│                    PLANTWARE SOURCE DATABASES                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐    ┌────────────────────────────────┐│
│  │   db_ptrj (SQL Server) │    │ staging_PTRJ_iFES_Plantware    ││
│  │  - HR_EMPLOYEE        │    │  - iFES_MillWeight             ││
│  │  - HR_GANG            │    │  - Field_Profile                ││
│  │  - PR_EMP_ATTN        │    └────────────────────────────────┘│
│  │  - PR_TASKREG         │                                      │
│  │  - PR_ADTRANS         │                                      │
│  │  - PR_TASKCODE        │                                      │
│  └──────────────────────┘                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND LAYER                            │
│                    (Python/Flask Application)                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Query Layer │  │ Data Config │  │ Local Database (SQLite) │  │
│  │  - /query/  │  │  - /data/   │  │  - users.db             │  │
│  │  - /sql/    │  │  - JSON     │  │  - chroma.sqlite3       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  MIGRATION LAYER                           │ │
│  │  Alembic (context_portal/alembic/)                          │ │
│  │  - Schema versioning                                        │ │
│  │  - Database evolution                                       │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          FRONTEND LAYER                          │
│                    (React/Web Application)                      │
├─────────────────────────────────────────────────────────────────┤
│  - Dashboard Daftar Upah                                         │
│  - Laporan Gaji per Gang                                        │
│  - Analisis HK dan Premi                                        │
│  - Export PDF/Excel                                             │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Data Transformation Pipeline

| Stage | Source | Transform | Output |
|-------|--------|-----------|--------|
| **1. Raw Data** | Plantware DB | - | SQL Query Results |
| **2. Validation** | Backend | Check required fields | Validated Data |
| **3. Calculation** | Python | HK, Tunjangan, Potongan | Computed Values |
| **4. Aggregation** | Python | GROUP BY Gang, Employee | Summary Reports |
| **5. Formatting** | Backend | JSON/HTML Output | API Response |
| **6. Presentation** | Frontend | Render Tables/Charts | User Interface |

### 5.3 Key Data Dependencies

```
HR_EMPLOYEE (EmpCode)
    │
    ├── HR_GANGLN (GangMember → GangCode)
    │       │
    │       └── HR_GANG (GangCode → LocCode)
    │
    ├── PR_EMP_ATTN_ARC (Attendance by EmpCode)
    │       │
    │       └── PR_TASKREGLN_ARC (Work hours by EmpCode)
    │
    └── PR_ADTRANS_ARC (Allowances/Deductions by EmpCode)
            │
            └── PR_ADTRANSLN_ARC (Line items by MasterID)
```

---

## 6. Local Database & Staging Configuration

### 6.1 Local SQLite Databases

| Database | Location | Purpose |
|----------|----------|---------|
| `users.db` | `/backend/data/` | User authentication dan session |
| `chroma.sqlite3` | `/context_portal/conport_vector_data/` | Vector embeddings untuk AI context |

### 6.2 JSON Configuration Files

| File | Purpose |
|------|---------|
| `premium_definitions.json` | Definisi jenis premi dan rate |
| `rate_tunjagan_jabatan.json` | Rate tunjangan jabatan |
| `amount_masa_kerja.json` | Lookup table tunjangan masa kerja |
| `thumbprint_data.json` | Data fingerprint untuk validasi |
| `taskcode_mapping_db_ptrj.json` | Mapping taskcode ke database |
| `adtrans_mapping_2026_db_ptrj.json` | Mapping adtrans 2026 |
| `adtrans_docdesc_distinct_2026_db_ptrj.json` | Distinct DocDesc adtrans 2026 |
| `taskdesc_distinct_2026_db_ptrj.json` | Distinct TaskDesc 2026 |
| `ad_task_mapping_db_ptrj.json` | AD task mapping |
| `raking_sub_block_detail.json` | Detail sub-block untuk raking |
| `pruning_sub_block_detail.json` | Detail sub-block untuk pruning |
| `area_produktif.json` | Data area produktif |
| `upah_kotor_bulanan_infra.json` | Upah kotor bulanan infrastruktur |
| `upah_bersih_adjustments.json` | Adjustment upah bersih |
| `deduction_adjustments.json` | Adjustment potongan |
| `payrate.json` | Data payrate karyawan |
| `summary_group_descriptions.json` | Deskripsi grup summary |
| `thr_periode.json` | Periode THR (Tunjangan Hari Raya) |

### 6.3 Security Configuration

| File | Purpose |
|------|---------|
| `private.pem` | Private key untuk JWT signing |
| `public.pem` | Public key untuk JWT verification |
| `ssl.key` | SSL certificate key |

### 6.4 Migration Files

| File | Purpose |
|------|---------|
| `add_manual_adjustment_dedup_index.sql` | Index untuk deduplication adjustment |
| `add_missing_detail_columns.sql` | Menambahkan kolom detail yang hilang |
| `add_history_hr_tables.sql` | Tabel history HR |
| `add_payroll_snapshot_version_columns.sql` | Kolom versi snapshot payroll |
| `add_payroll_overlay_history_tables.sql` | Tabel history overlay payroll |
| `add_history_tables.sql` | Tabel history umum |

---

## 7. Summary & Recommendations

### 7.1 Strengths
- **Structured categorization**: SQL queries organized by functional domain (attendance, allowances, deductions)
- **Archive pattern**: Using `_ARC` tables for historical data separation
- **Dynamic headers**: Query-based column generation for flexible reporting
- **Comprehensive coverage**: All major payroll components covered

### 7.2 Areas for Improvement
- **Query parameterization**: Some queries use hardcoded values (e.g., `WHERE EmpCode = 'A0749'`)
- **Documentation**: Missing inline comments for complex business logic
- **Consistency**: Mixed naming conventions (camelCase vs underscore)
- **Error handling**: No explicit error handling in SQL files

### 7.3 Performance Considerations
- **Indexing**: Ensure indexes on EmpCode, TrxDate, AttnDate for frequent queries
- **Archive pruning**: Regular archival of old `_ARC` data
- **Connection pooling**: Implement for Plantware DB connections

### 7.4 Data Governance
- **Audit trail**: Consider adding CreatedDate/UpdatedDate to all tables
- **Data validation**: Add CHECK constraints for date ranges and amounts
- **Backup strategy**: Regular backups of db_ptrj and staging databases

---


---

# BAGIAN 4: FRONTEND ARCHITECTURE

## 4.1 Overview

**Stack:** React 18 + Vite 5 + AG Grid Enterprise + React Router 7

**Dev Server:** Port 5175
**Production Base Path:** `/upah/` (behind proxy gateway)
**Build Output:** `frontend/dist/` (minified + gzip + brotli compression)

## 4.2 Pages / Routes (30+ Halaman)

| Halaman | File | Fungsi |
|---------|------|--------|
| **MainPage** | `MainPage.jsx` | Halaman utama daftar upah dengan filter divisi, gang, bulan/tahun |
| **SummaryReportPage** | `SummaryReportPage.jsx` | Laporan ringkasan agregasi professional dengan edit inline |
| **WagesSummaryRebinmasPage** | `WagesSummaryRebinmasPage.jsx` | Ringkasan upah PT Rebinmas Jaya |
| **WagesSummaryIJLPage** | `WagesSummaryIJLPage.jsx` | Ringkasan upah PT Impian Jaya Lestari |
| **DashboardHome** | `DashboardHome.jsx` | Dashboard utama dengan KPI cards |
| **ProfessionalDashboard** | `ProfessionalDashboard.jsx` | Dashboard professional dengan charts |
| **EmployeeDirectoryAnalytics** | `EmployeeDirectoryAnalytics.jsx` | Direktori karyawan dengan analytics |
| **TaxReportPage** | `TaxReportPage.jsx` | Laporan pajak PPh21 |
| **PayslipPrintPage** | `PayslipPrintPage.jsx` | Cetak slip gaji multi-employee |
| **AnalysisReportPage** | `AnalysisReportPage.jsx` | Laporan analisis premi & lembur |
| **PayrollAnalysisPage** | `PayrollAnalysisPage.jsx` | Analisis payroll detail |
| **ProductivityReportPage** | `ProductivityReportPage.jsx` | Laporan produktivitas |
| **ExecutivePayrollPage** | `ExecutivePayrollPage.jsx` | Payroll eksekutif |
| **ImpactReportPage** | `ImpactReportPage.jsx` | Laporan dampak perubahan |
| **MillProductionReport** | `MillProductionReport.jsx` | Laporan produksi pabrik |
| **OtherIncomesPage** | `OtherIncomesPage.jsx` | Pendapatan lain (THR, bonus) |
| **PremiumSeederPage** | `PremiumSeederPage.tsx` | Seeding data premi |
| **AggregationSeederPage** | `AggregationSeederPage.jsx` | Seeding agregasi |
| **SpreadsheetSyncPage** | `SpreadsheetSyncPage.jsx` | Sinkronisasi spreadsheet |
| **StagingDaftarUpahPage** | `StagingDaftarUpahPage.jsx` | Staging daftar upah |
| **StagingComparisonPage** | `StagingComparisonPage.jsx` | Perbandingan staging |
| **DataVerificationPage** | `DataVerificationPage.jsx` | Verifikasi data |
| **UpahBersihDetailPage** | `UpahBersihDetailPage.jsx` | Detail upah bersih |
| **DetailedSalaryAnalysisPage** | `DetailedSalaryAnalysisPage.jsx` | Analisis gaji detail |
| **HighEarnerReportPage** | `HighEarnerReportPage.jsx` | Laporan berpenghasilan tinggi |
| **SalaryRangeDetailPage** | `SalaryRangeDetailPage.jsx` | Detail range gaji |
| **GangComparisonReportPage** | `GangComparisonReportPage.jsx` | Perbandingan antar gang |
| **TonaseAnalysisReportPage** | `TonaseAnalysisReportPage.jsx` | Analisis tonase |
| **LoginPage** | `LoginPage.jsx` | Halaman login |
| **LockedMainPage** | `LockedMainPage.jsx` | Main page dengan divisi terkunci |

## 4.3 Key Components

**AG Grid Wrapper:** `AgGridWrapper` - Wrapper AG Grid dengan konfigurasi standard untuk payroll table
**CustomPayrollTable:** `CustomPayrollTable.jsx` (254 KB) - Tabel utama dengan virtual scrolling, edit inline, cell renderer
**ReportToolbar:** Toolbar laporan dengan aksi export, print, filter
**GangFilter:** Filter berdasarkan gang dengan GangFilterContext
**Modal, MonthSelector, PeriodSlider, DivisionTabs, dll

## 4.4 State Management (React Context)

| Context | Fungsi |
|---------|--------|
| **AuthContext** | Token, user, role, login/logout |
| **ReportContext** | month, year, division, gang state |
| **GangFilterContext** | Filter gang dengan useReducer |
| **HeaderContext** | Preload header payroll untuk performa |

## 4.5 API Services

| Service | Fungsi Utama |
|---------|-------------|
| `payrollService.js` | fetchReportRows, fetchReportRowsBatched, fetchPayrollWithComponents |
| `summaryReportService.js` | fetchDivisionSummary, fetchComparisonSummary, updateThumbprint |
| `taxReportService.js` | downloadTaxReportExcel |
| `employeeService.js` | fetchEmployees |
| `dashboardService.js` | fetchDashboardData |
| `aggregationSeederService.js` | seedAggregation |
| `manualAdjustmentService.js` | saveManualAdjustment, deleteManualAdjustmentColumn |
| `lockedDivisionService.js` | getLockedGangs, saveLockedManualEdit |
| `stagingComparisonService.js` | fetchStagingComparison |

## 4.6 Routing Structure

```
App.jsx
├── BrowserRouter
│   ├── AuthProvider
│   │   └── ReportProvider
│   │       └── ErrorBoundary
│   │           └── Routes
│   │               ├── /login → LoginPage
│   │               ├── / → DashboardLayout
│   │               │   ├── /main → MainPage
│   │               │   ├── /summary → SummaryReportPage
│   │               │   ├── /wages-rebinmas → WagesSummaryRebinmasPage
│   │               │   ├── /wages-ijl → WagesSummaryIJLPage
│   │               │   ├── /dashboard → DashboardHome
│   │               │   ├── /analysis → AnalysisReportPage
│   │               │   ├── /payroll-analysis → PayrollAnalysisPage
│   │               │   ├── /report-pajak → TaxReportPage
│   │               │   └── ... (20+ more routes)
│   │               ├── /payslip-print → PayslipPrintPage (new tab)
│   │               ├── /employee-detail → EmployeeDetailRoute (new tab)
│   │               └── /locked → LockedMainPage
```

**Note:** Semua halaman 30+ menggunakan lazy loading untuk optimize initial bundle.

## 4.7 Styling & Theming

- **Theme:** CSS custom properties, dark palm corporate theme
- **Print Styles:** Report-specific print CSS dengan optimasi A4/Letter
- **Export:** ExcelJS untuk Excel, html2pdf.js untuk PDF

---

# BAGIAN 5: BUSINESS LOGIC - PAYROLL CALCULATION

# Portal Daftar Upah - Complete Business Logic Map

**Document Version:** 1.0.0  
**Last Updated:** 2026-04-21  
**Project:** Portal Daftar Upah PT Rebinmas

---

## Table of Contents

1. [Employee Data Flow](#1-employee-data-flow)
2. [Attendance & Leave Logic](#2-attendance--leave-logic)
3. [Overtime (Lembur) Calculation](#3-overtime-lembur-calculation)
4. [Gaji Pokok Calculation](#4-gaji-pokok-calculation)
5. [Tunjangan (Allowances) Calculation](#5-tunjangan-allowances-calculation)
6. [Premi (Premium) Calculation](#6-premi-premium-calculation)
7. [Caruman (BPJS) Calculation](#7-caruman-bpjs-calculation)
8. [Tax (PPh21 TER) Calculation](#8-tax-pph21-ter-calculation)
9. [Take-Home Pay (Upah Bersih) Calculation](#9-take-home-pay-upah-bersih-calculation)
10. [Employee Filtering Logic](#10-employee-filtering-logic)
11. [Pendapatan Lainnya (THR, Bonus, etc)](#11-pendapatan-lainnya-thr-bonus-etc)
12. [Data Extraction Flow](#12-data-extraction-flow)

---

## 1. Employee Data Flow

### Source Tables
- `HR_EMPLOYEE` - Master employee data
- `HR_GANGLN` - Gang membership
- `HR_GANG` - Gang definitions
- `HR_PAYROLL` - Payroll rates (PayRate, BerasRate)

### Key Fields
```typescript
interface Employee {
    emp_code: string;        // Plantware internal ID
    nik: string;             // KTP NIK (from NewICNo)
    nama: string;            // Employee name
    jenis_kelamin: string;   // 'L' or 'P'
    gang_code: string;        // Gang assignment
    pay_rate: number;         // Daily wage rate (from HR_PAYROLL)
    beras_rate: number;      // Rice ration rate (maps to PTKP)
    join_date: string;       // Employment start date
    loc_code: string;        // Location code
}
```

### Employee Resolution Flow
```
NIK Lookup
    │
    ├── NIK found in HR_EMPLOYEE → Use existing emp_code
    └── NIK not found → Check DuplicateNikMitigationService
                            │
                            ├── Duplicate NIK exists → Use Mitigated emp_code
                            └── No duplicate → Insert new employee
```

### Jabatan (Job Title) Source
**CRITICAL:** Jabatan comes from:
- `extend_db_ptrj.dbo.employee_estate` (PRIMARY)
- `extend_db_ptrj.dbo.history_gang_member` (FALLBACK)

**NOT** from `HR_GANGLN` - that table only has gang membership.

---

## 2. Attendance & Leave Logic

### Source Tables
- `PR_TASKREGLN` - Active attendance records
- `PR_TASKREGLN_ARC` - Archived attendance records

### Leave Types (Cuti)
| Type | Field | Description |
|------|-------|-------------|
| Cuti Tahunan | `cuti_tahunan` | Annual leave |
| Cuti Sakit/Haid | `cuti_sakit_haid` | Sick leave + menstrual leave |
| Cuti Minggu | `cuti_minggu` | Sunday (not working) |
| Cuti Nasional | `cuti_nasional` | National holidays |
| Total HK | `jumlah_hk` | Total working days in period |

### Leave Calculation (CutiService)
```typescript
calculateWorkingDays(input: CutiCalculationInput): CutiCalculationResult {
    // Effective working days = HK - (Minggu + Nasional)
    // This is what determines if employee appears in payroll
    const effectiveWorkingDays = Math.max(0, totalHk - cutiMinggu - cutiNasional);

    // Other leave (tahunan, sakit/haid) - doesn't affect HK calculation
    const otherLeave = cutiTahunan + cutiSakit;

    // Exclusion check
    const isExcludedFromPayroll = effectiveWorkingDays <= 0 && otherLeave === 0;
}
```

### Hari Kerja Calculation
```typescript
// Hari Kerja = HK - (Cuti Tahunan + Cuti Sakit + Minggu + Nasional)
hari_kerja = jumlah_hk - (cuti_tahunan + cuti_sakit_haid + cuti_minggu + cuti_nasional)
hari_kerja = Math.max(0, hari_kerja)
```

---

## 3. Overtime (Lembur) Calculation

### Source
- `PR_TASKREGLN` with `OT = 1` (active)
- `PR_TASKREGLN_ARC` with `OT = 1` (archived)

### Day Type Classification (LemburCalculator)
```typescript
enum DayType {
    WORKDAY_LONG = "WORKDAY_LONG",     // Mon, Tue, Wed, Thu, Sat (7+ hours)
    WORKDAY_SHORT = "WORKDAY_SHORT",   // Friday (5+ hours)
    SUNDAY = "SUNDAY",                 // Sunday
    HOLIDAY_REGULAR = "HOLIDAY_REGULAR", // Non-religious holiday
    HOLIDAY_RELIGIOUS = "HOLIDAY_RELIGIOUS" // Religious holiday
}
```

### Overtime Rate Tiers
| Day Type | Tier 1 | Tier 2 | Tier 3 | Tier 1 Boundary |
|----------|--------|--------|--------|------------------|
| WORKDAY_LONG | 1.5x | 2x | 2x | 1 hour |
| WORKDAY_SHORT | 1.5x | 2x | 2x | 1 hour |
| SUNDAY | 2x | 3x | 4x | 5/7 hours |
| HOLIDAY_REGULAR | 2x | 3x | 4x | 5/7 hours |
| HOLIDAY_RELIGIOUS | 3x | 4x | 4x | 5/7 hours |

### UPJ Calculation
```typescript
// UPJ = (PayRate × 30) / 173
const upj = payRate > 0 ? (payRate * 30) / 173 : env.LEMBUR_UPJ || 17257;
```

### Overtime Payment Formula
```typescript
calculateOvertimePayment(hours: number, dayType: DayType, upj: number, isFriday: boolean) {
    const config = OVERTIME_RATES[dayType];
    const boundary = isFriday ? config.tier_1_boundary_short : config.tier_1_boundary_long;

    // Tier 1: First N hours
    const tier_1_hours = Math.min(hours, boundary);
    const tier_1_amount = tier_1_hours * upj * config.tier_1_rate;

    // Tier 2 & 3: Remaining hours
    const remaining_hours = Math.max(0, hours - boundary);
    const tier_2_hours = Math.min(remaining_hours, boundary);
    const tier_2_amount = tier_2_hours * upj * config.tier_2_rate;

    const tier_3_hours = Math.max(0, remaining_hours - boundary);
    const tier_3_amount = tier_3_hours * upj * config.tier_3_rate;

    return {
        total_amount: tier_1_amount + tier_2_amount + tier_3_amount,
        tier_1_hours, tier_1_amount,
        tier_2_hours, tier_2_amount,
        tier_3_hours, tier_3_amount
    };
}
```

---

## 4. Gaji Pokok Calculation

### Formula
```typescript
// Gaji Pokok Aktual = Hari Kerja × PayRate
// Hari Kerja = HK - (Cuti Tahunan + Cuti Sakit + Minggu + Nasional)
gaji_pokok_aktual = hari_kerja * pay_rate

// Gaji Pokok Ideal = HK × PayRate (full month)
gaji_pokok_ideal = jumlah_hk * pay_rate
```

### GajiPokokService Method
```typescript
calculateGajiPokok(
    hkCount: number,
    payrate: number,
    cutiTahunan: number = 0,
    cutiSakit: number = 0,
    hkMinggu: number = 0,
    hkNasional: number = 0
): number {
    const totalCuti = cutiTahunan + cutiSakit + hkMinggu + hkNasional;
    const hariKerja = Math.max(0, hkCount - totalCuti);
    return payrate ? hariKerja * payrate : 0;
}
```

---

## 5. Tunjangan (Allowances) Calculation

### Components
| Component | Source | Formula |
|-----------|--------|---------|
| Beras | `PR_ADTRANSLN` DocDesc like '%BERAS%' | `beras_rate × HK` |
| Jabatan | `PR_ADTRANSLN` DocDesc like '%JABATAN%' | Direct from DB |
| Masa Kerja | `PR_ADTRANSLN` DocDesc like '%MASA KERJA%' | Direct from DB |
| Lembur | `PR_TASKREGLN` (OT=1) | From LemburCalculator |

### Total Tunjangan Formula
```typescript
total_tunjangan = beras_jumlah + jabatan_jumlah + masa_kerja_jumlah + lembur_jumlah
```

---

## 6. Premi (Premium) Calculation

### Source
- `PR_ADTRANS` and `PR_ADTRANSLN` where `DocDesc LIKE '%PREMI%'`

### Excluded Patterns (PremiumExtractor)
```typescript
const DEFAULT_EXCLUDE_PATTERNS = [
    'PPH', 'PPH21', 'PPH 21',  // Tax
    'LEMBUR',                    // Overtime
    'BRONDOL',                   // → Static premi_brondol
    'PRUN', 'PRUNING',           // → Static premi_pruning
    'KOREKSI', 'KOREKSI PANEN',  // Correction
    'POTONGAN KOREKSI',
    'SPSI',
    'TUNJANGAN JABATAN',
    'TUNJANGAN MASA KERJA',
    'TUNJANGAN BERAS',
    'JABATAN', 'BERAS', 'MASA', 'POTONGAN'
];
```

### Premi Categories
```typescript
interface PremiOutput {
    total_premi: number;      // brondol + dynamic_premi
    brondol: number;          // From PR_LOOSEFRUIT + PR_ADTRANS (BRONDOL)
    pruning: number;          // Static column
    dynamic_premi: Record<string, number>;  // Other premiums by DocDesc
}
```

### Total Premi Formula
```typescript
// NOTE: Koreksi is NOT included in total_premi
total_premi = premi_brondol + premi_pruning + SUM(dynamic_premi)
```

---

## 7. Caruman (BPJS) Calculation

### Source
- `carumanDefinitions.ts` (Single Source of Truth)

### Base Calculation
```typescript
// BASE = (Upah Dasar × 30) + Tunjangan Masa Kerja
const base = (upah_dasar * 30) + masa_kerja_jumlah;
const gaji_standar = upah_dasar * 30;
```

### Rate Definitions (carumanDefinitions.ts)
```typescript
const CARUMAN_RATES = {
    // ASTEK / Jamsostek
    ASTEK_PEKERJA_JHT: 0.02,        // 2%
    ASTEK_MAJIKAN_JKK_JKM: 0.0084,  // 0.84%
    ASTEK_MAJIKAN_JHT: 0.037,       // 3.7%

    // BPJS Kesehatan
    BPJS_KES_PEKERJA: 0.01,         // 1%
    BPJS_KES_MAJIKAN: 0.04,         // 4%

    // BPJS Pensiun
    BPJS_PENSIUN_PEKERJA: 0.01,     // 1%
    BPJS_PENSIUN_MAJIKAN: 0.02,     // 2%
};
```

### Caruman Components
```typescript
interface CarumanResult {
    // ASTEK
    astek_pekerja: base * 0.02;
    astek_majikan_jkk_jkm: base * 0.0084;
    astek_majikan_jht: base * 0.037;

    // BPJS Kesehatan
    bpjs_kes_pekerja: base * 0.01;
    bpjs_kes_majikan: base * 0.04;

    // BPJS Pensiun
    bpjs_pensiun_pekerja: base * 0.01;
    bpjs_pensiun_majikan: base * 0.02;
}
```

---

## 8. Tax (PPh21 TER) Calculation

### PTKP Mapping (PTKPMapper.ts - Single Source of Truth)
```typescript
const BERAS_RATE_TO_PTKP = {
    // Standard rates
    2250: 'TK/0', 3250: 'TK/1', 4200: 'TK/2',
    3700: 'K/0', 4650: 'K/1', 5500: 'K/2', 6450: 'K/3',
    // Legacy DB mappings (150/kg formulas)
    3150: 'TK/1', 4050: 'TK/2', 4950: 'TK/3',
    3600: 'K/0', 4500: 'K/1', 5400: 'K/2', 6300: 'K/3',
};

const PTKP_TO_TER = {
    'TK/0': 'TER A', 'TK/1': 'TER A', 'K/0': 'TER A',
    'TK/2': 'TER B', 'TK/3': 'TER B', 'K/1': 'TER B', 'K/2': 'TER B',
    'K/3': 'TER C',
};
```

### PTKP Amounts by Year
```typescript
const PTKP_AMOUNTS = {
    2025: {
        'TK/0': 54000000, 'TK/1': 58500000, 'TK/2': 63000000, 'TK/3': 67500000,
        'K/0': 58500000, 'K/1': 63000000, 'K/2': 67500000, 'K/3': 72000000,
    },
    2026: {
        'TK/0': 54000000, 'TK/1': 58500000, 'TK/2': 63000000, 'TK/3': 67500000,
        'K/0': 58500000, 'K/1': 63000000, 'K/2': 67500000, 'K/3': 72000000,
    }
};
```

### TER Rate Layers (PP 58/2023 / PER-16/PJ/2022)
```
Gross Monthly Income (Upah Kotor)
    ├── 0 - 5,400,000        → 0.00%
    ├── 5,400,001 - 5,650,000 → 0.25%
    ├── 5,650,001 - 5,950,000 → 0.50%
    ├── ... (40-44 layers per category)
    └── Highest income       → 34%
```

### Taxable Income Formula
```typescript
// For PPh21 TER calculation:
// Bruto = Gaji + Tunjangan + Lembur + Premi + astek_m + bpjs_m
// Penghasilan Bruto = jumlah_upah_kotor + astek_majikan + bpjs_majikan

// Then apply TER rate based on monthly gross income
```

---

## 9. Take-Home Pay (Upah Bersih) Calculation

### PayrollCalculator (Single Source of Truth)

#### 3-Level Upah Architecture
```typescript
// Level 1: UPAH KOTOR (Gross without koreksi/pendapatan_lainnya)
upah_kotor = gaji_pokok_aktual + total_tunjangan + total_premi

// Level 2: JUMLAH UPAH KOTOR (Daftar Upah display)
jumlah_upah_kotor = upah_kotor - pot_koreksi + pendapatan_lainnya
// NOTE: koreksi SUBTRACTED from display, lainnya ADDED

// Level 3: PENGHASILAN BRUTO (For PPh21 TER)
penghasilan_bruto = jumlah_upah_kotor + astek_majikan + bpjs_majikan
// NOTE: koreksi & lainnya ARE part of taxable income
```

#### Total Potongan Formula
```typescript
// IMPORTANT: koreksi NOT included (already in jumlah_upah_kotor)
// IMPORTANT: pendapatan_lainnya MUST be included (to offset the + in gross)
total_potongan =
    astek_pekerja +
    bpjs_kes_pekerja +
    bpjs_pensiun_pekerja +
    spsi +
    pph21 +
    other_potongan +
    pendapatan_lainnya  // WAJIB - offsets the + in gross
```

#### Upah Bersih Formula
```typescript
// NOTE: premi_pph = ADDITION (+), not deduction (-)
upah_bersih = jumlah_upah_kotor - total_potongan + premi_pph
```

---

## 10. Employee Filtering Logic

### Critical Filter Rules (dataExtractorService.ts)

```typescript
// Effective Work HK = HK - (Minggu + Libur Nasional)
const effective_work_hk = hk - (empCuti.cuti_minggu + empCuti.cuti_nasional);

// Cuti lain (tahunan, sakit/haid)
const other_cuti = empCuti.cuti_tahunan + empCuti.cuti_sakit_haid;

// FILTER LOGIC:
// - effective_work_hk <= 0 AND other_cuti == 0 → FILTERED OUT
// - effective_work_hk <= 0 BUT other_cuti > 0 → KEPT
// - effective_work_hk > 0 → Always KEPT
if (effective_work_hk <= 0 && other_cuti == 0) {
    continue; // Skip this employee
}
```

### Filter Decision Table
| HK | Minggu | Nasional | Tahunan | Sakit/Haid | Result |
|----|--------|----------|---------|------------|--------|
| >0 | any | any | any | any | **KEPT** |
| 0 | 0 | 0 | 0 | 0 | **FILTERED OUT** |
| 0 | 0 | 0 | >0 | 0 | **KEPT** |
| 0 | 0 | 0 | 0 | >0 | **KEPT** |
| 0 | >0 | >0 | 0 | 0 | **FILTERED OUT** |
| 0 | >0 | >0 | >0 | 0 | **KEPT** |

---

## 11. Pendapatan Lainnya (THR, Bonus, etc)

### Source
- `PR_ADTRANS` and `PR_ADTRANSLN` with specific DocDesc patterns
- `OtherIncomesService` processes these

### Categories
```typescript
interface PendapatanLainnya {
    thr?: number;              // Tunjangan Hari Raya
    bonus?: number;            // Bonus
    custom?: number;           // Custom income types
    kontan?: number;           // Cash allowance
}
```

### Flow in PayrollCalculator
```typescript
// Pendapatan Lainnya Flow:
// 1. jumlah_upah_kotor: ADDED (+)
// 2. total_potongan: SUBTRACTED (-) to offset
// 3. Net effect on upah_bersih = 0 (but required for slip display)
```

---

## 12. Data Extraction Flow

### Main Flow (dataExtractorService.extractPayrollData)

```
Request (month, year, gangCode)
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 1. INTERCEPTOR CHECK                                          │
│    Check cacheService for historical period data              │
│    If cached → return cached data                              │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 2. PARALLEL DATA FETCHING (Promise.all)                       │
├───────────────────────────────────────────────────────────────┤
│ • getEmployees()          → HR_EMPLOYEE, HR_GANGLN           │
│ • getAttendance()        → PR_TASKREGLN (+ ARC fallback)    │
│ • getCuti()              → PR_TASKREGLN (leave types)        │
│ • getPremi()             → PR_ADTRANS (DocDesc like PREMI%)  │
│ • getPotongan()          → PR_ADTRANS (DocDesc like POT%)    │
│ • getLemburDetails()     → lemburCalculator.calculate()      │
│ • getOtherIncomes()      → OtherIncomesService               │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 3. EMPLOYEE FILTERING                                          │
│    Apply HK > 0 filter rules (see Section 10)                 │
│    Skip excluded employees                                     │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 4. PAYROLL CALCULATION (PayrollCalculator)                    │
│    For each employee:                                          │
│    • Calculate gaji_pokok_aktual/ideal                        │
│    • Calculate total_tunjangan                                 │
│    • Calculate total_premi (excluding koreksi)                │
│    • Calculate caruman (BPJS) components                       │
│    • Calculate pph21_ter                                      │
│    • Calculate upah_bersih                                     │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 5. RESPONSE FORMATION                                          │
│    Build PayrollRow[] with all computed fields                │
│    Return JSON tree structure                                  │
└───────────────────────────────────────────────────────────────┘
```

### Progressive Streaming Flow (extractPayrollDataProgressive)

```
Request (month, year, division, SSE)
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 1. PARALLEL GANG QUERIES                                      │
│    For each gang in division:                                 │
│    • Query employees                                          │
│    • Query attendance                                        │
│    • Query premiums, deductions, overtime                    │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 2. SSE META EVENT                                             │
│    Send: { headers, total_gangs, total_employees }            │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 3. STREAM GANG DATA (batched by 5)                             │
│    For each batch:                                            │
│    • Send 'gang' event with employees + totals               │
│    • Send 'progress' event                                    │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 4. SSE COMPLETE EVENT                                         │
│    Send: { grand_total, execution_time }                     │
└───────────────────────────────────────────────────────────────┘
```

---

## Appendix: Service to File Mapping

| Service | File Location |
|---------|---------------|
| DataExtractorService | `backend/src/services/dataExtractorService.ts` |
| PayrollService | `backend/src/services/payrollService.ts` |
| LemburCalculator | `backend/src/services/lemburCalculator.ts` |
| CutiService | `backend/src/services/employee/CutiService.ts` |
| CarumanDefinitions | `backend/src/services/carumanDefinitions.ts` |
| PTKPMapper | `backend/src/services/payroll/formulas/PTKPMapper.ts` |
| PayrollCalculator | `backend/src/services/payroll/components/PayrollCalculator.ts` |
| PremiService | `backend/src/services/payroll/components/PremiService.ts` |
| TaxCalculationService | `backend/src/services/tax/TaxCalculationService.ts` |
| DivisionConfigService | `backend/src/services/config/DivisionConfigService.ts` |

---

## Appendix: Key Business Rules Summary

1. **NIK Immutable**: Once stored, NIK cannot be updated
2. **Append-Only History**: Use INSERT with version_index, not UPDATE
3. **Caruman Base = Gaji Standar + Masa Kerja**: `base = (payrate × 30) + masa_kerja_jumlah`
4. **Koreksi NOT in Potongan**: Already in jumlah_upah_kotor display
5. **Pendapatan Lainnya MUST in Potongan**: To offset the + in gross
6. **premi_pph is ADDITION**: Not subtraction in upah_bersih calculation


---

# BAGIAN 6: FIELD TO TABLE MAPPING

# Daftar Upah - Complete Field-to-Table Mapping

**Updated:** 2026-04-22  
**Source:** `dataExtractorService.ts`, `PayrollCalculator.ts`, `carumanDefinitions.ts`

Canonical source precedence and derived-field flow:
- See `docs/PAYROLL_SOURCE_FLOW.md`

---

## DAFTAR UPAH - TABLE-TO-FIELD MAPPING

### EMPLOYEE IDENTITY

| Field | Source Table | Source Column | Calculation |
|-------|-------------|---------------|------------|
| `nik` | HR_EMPLOYEE | NewICNo | Direct from DB |
| `emp_code` | HR_EMPLOYEE | EmpCode | Plantware internal ID |
| `nama` | HR_EMPLOYEE | EmpName | Direct from DB |
| `jenis_kelamin` | HR_EMPLOYEE | Gender | 'L' or 'P' |
| `alamat` | HR_EMPLOYEE | Address | Direct from DB |
| `gang_code` | HR_GANGLN | GangCode | Join HR_GANGLN → HR_GANG |
| `loc_code` | HR_GANG | LocCode | Division location code |
| `jabatan` | employee_estate / history_gang_member | job_title | Fallback: HR_GANGLN.Jabatan |

---

### ATTENDANCE (HK)

| Field | Source Table | Source Column | Calculation |
|-------|-------------|---------------|------------|
| `jumlah_hk` | PR_TASKREGLN | SUM(HK) | Total HK per employee per period |
| `hari_kerja` | Calculated | - | `jumlah_hk - cuti_tahunan - cuti_sakit_haid - cuti_minggu - cuti_nasional` |
| `total_jam_kerja` | PR_TASKREGLN | SUM(Hours) | Total work hours |

**Leave Breakdown:**
| Field | Source Table | Condition |
|-------|-------------|-----------|
| `cuti_tahunan` | PR_TASKREGLN | TaskCode = 'TAHUNAN' |
| `cuti_sakit_haid` | PR_TASKREGLN | TaskCode IN ('SAKIT', 'HAID') |
| `cuti_minggu` | PR_TASKREGLN | TaskCode = 'MINGGU' |
| `cuti_nasional` | PR_TASKREGLN | TaskCode = 'NASIONAL' |

---

### GAJI POKOK

| Field | Source Table | Source Column | Calculation |
|-------|-------------|---------------|------------|
| `upah_dasar` | HR_PAYROLL | PayRate | Daily wage rate |
| `gaji_pokok_aktual` | Calculated | - | `hari_kerja × pay_rate` |
| `gaji_pokok_ideal` | Calculated | - | `jumlah_hk × pay_rate` |
| `gaji_pokok` | Calculated | - | Same as gaji_pokok_aktual |
| `gaji_pokok_bulanan` | Calculated | - | `pay_rate × 30` (for ASTEK/BPJS) |

---

### TUNJANGAN

| Field | Source Table | Source Column | Calculation |
|-------|-------------|---------------|------------|
| `beras_rate` | HR_PAYROLL | BerasRate | Rice ration rate |
| `beras_jumlah` | Calculated | - | `beras_rate × jumlah_hk` |
| `jabatan_rate` | PR_ADTRANSLN | Amount | From DocDesc LIKE '%JABATAN%' |
| `jabatan_jumlah` | PR_ADTRANSLN | Amount | Total from DB |
| `masa_kerja_tahun` | Calculated | - | From join_date: `(now - join_date) / 365 days` |
| `masa_kerja_rate` | PR_ADTRANSLN | Amount | From DocDesc LIKE '%MASA KERJA%' |
| `masa_kerja_jumlah` | PR_ADTRANSLN | Amount | Total from DB |
| `total_tunjangan` | Calculated | - | `beras_jumlah + jabatan_jumlah + masa_kerja_jumlah + lembur_jumlah` |

---

### LEMBUR (OVERTIME)

| Field | Source Table | Source Column | Calculation |
|-------|-------------|---------------|------------|
| `lembur_jam` | PR_TASKREGLN | SUM(Hours) | WHERE OT = 1 |
| `lembur_jumlah` | Calculated | - | Tier-based calculation (see below) |
| `lembur_rate` | Calculated | - | Weighted average of tier rates |
| `lembur_records` | PR_TASKREGLN | - | Array of individual OT transactions |

**Lembur Calculation:**
```typescript
UPJ = payRate > 0 ? (payRate × 30) / 173 : env.LEMBUR_UPJ (default: 17257)

For each OT record:
  1. Classify day type (WORKDAY/SUNDAY/HOLIDAY)
  2. Apply tier rates:
     - WORKDAY: 1.5x (1hr), 2x (rest)
     - SUNDAY: 2x (7hrs), 3x (next), 4x (rest)
     - HOLIDAY: 2x (7hrs), 3x (next), 4x (rest)
     - HOLIDAY_RELIGIOUS: 3x (7hrs), 4x (rest)
  3. Sum: total = tier1 + tier2 + tier3
```

---

### PREMI

| Field | Source Table | Source Column | Calculation |
|-------|-------------|---------------|------------|
| `premi_brondol` | PR_LOOSEFRUIT + PR_ADTRANS | SUM(Amount) | BRONDOL from both sources |
| `premi` | PR_ADTRANS | DocDesc, Amount | Dynamic: DocDesc LIKE '%PREMI%' (excludes PPH, LEMBUR, BRONDOL, PRUN, KOREKSI) |
| `total_premi` | Calculated | - | `premi_brondol + SUM(other dynamic premi)` |

**Premi Excluded Patterns:**
- PPH, PPH21, LEMBUR
- BRONDOL (separate column)
- PRUN, PRUNING
- KOREKSI, KOREKSI PANEN
- SPSI, TUNJANGAN JABATAN, TUNJANGAN MASA KERJA

---

### CARUMAN (BPJS/ASTEK)

| Field | Source | Calculation |
|-------|--------|-------------|
| `pot_astek_pekerja` | Calculated | `round(base × 0.02)` |
| `pot_astek_majikan` | Calculated | `round(base × 0.0454)` |
| `pot_astek_jumlah` | Calculated | `astek_pekerja + astek_majikan` |
| `pot_bpjs_kesehatan_pekerja` | Calculated | `round(base × 0.01)` |
| `pot_bpjs_kesehatan_majikan` | Calculated | `round(base × 0.04)` |
| `pot_bpjs_kesehatan_jumlah` | Calculated | `pekerja + majikan` |
| `pot_bpjs_pensiun_pekerja` | Calculated | `round(base × 0.01)` |
| `pot_bpjs_pensiun_majikan` | Calculated | `round(base × 0.02)` |
| `pot_bpjs_pensiun_jumlah` | Calculated | `pekerja + majikan` |
| `pot_bpjs_pekerja_total` | Calculated | `astek + bpjs_kes + bpjs_pensiun` |

**Caruman Base:**
```typescript
BASE = (upah_dasar × 30) + masa_kerja_jumlah
```

---

### TAX (PPH21 TER)

| Field | Source | Calculation |
|-------|--------|-------------|
| `status_ptkp` | Calculated | Map from beras_rate → PTKP status |
| `kategori_ter` | Calculated | Map from PTKP → TER category (A/B/C) |
| `pot_pph21` | PR_ADTRANS | TaskDesc = 'PPH21' (deducted in payroll) |
| `pph21_ter` | Calculated | `penghasilan_bruto × TER_rate` |
| `tarif_pajak_ter` | rule_TER_pajak.json | Layered rate based on gross + PTKP |
| `penghasilan_bruto` | Calculated | `jumlah_upah_kotor + astek_majikan + bpjs_majikan` |

**PTKP Mapping:**
| beras_rate | PTKP | TER |
|-----------|------|-----|
| 2250 | TK/0 | A |
| 3250 | TK/1 | A |
| 3700 | K/0 | A |
| 4200 | TK/2 | B |
| 4650 | K/1 | B |
| 5500 | K/2 | B |
| 6450 | K/3 | C |

---

### 3-LEVEL UPAH

| Level | Field | Formula |
|-------|-------|---------|
| 1 | `upah_kotor` | `gaji_pokok_aktual + total_tunjangan + total_premi` |
| 2 | `jumlah_upah_kotor` | `upah_kotor - pot_koreksi + pendapatan_lainnya` |
| 3 | `penghasilan_bruto` | `jumlah_upah_kotor + astek_majikan + bpjs_majikan` |

---

### POTONGAN

| Field | Source | Formula |
|-------|--------|---------|
| `pot_koreksi` | PR_ADTRANS | TaskDesc LIKE 'KOREKSI%' |
| `pot_spsi` | PR_ADTRANS | TaskDesc = 'SPSI' |
| `pot_pph21` | PR_ADTRANS | TaskDesc = 'PPH21' |
| `other_potongan` | PR_ADTRANS | Dynamic: exclude KOREKSI, SPSI, PPH21 |
| `pot_premi_pph` | PR_ADTRANS | TaskDesc = 'PREMI_PPH' (ADDITION to upah_bersih) |

**Total Potongan Formula:**
```typescript
total_potongan =
    astek_pekerja +
    bpjs_kes_pekerja +
    bpjs_pensiun_pekerja +
    spsi +
    pph21 +
    other_potongan +
    pendapatan_lainnya
// NOTE: pot_koreksi NOT included (already in jumlah_upah_kotor)
```

---

### UPAH BERSIH

| Field | Formula |
|-------|---------|
| `upah_bersih` | `jumlah_upah_kotor - total_potongan + premi_pph` |

---

### PENDAPATAN LAINNYA

| Field | Source | Note |
|-------|--------|------|
| `pendapatan_lainnya` | employee_other_incomes | THR, Bonus, Custom, KONTAN |
| `taxable_pendapatan_thr` | employee_other_incomes | is_taxable = true |
| `taxable_pendapatan_bonus` | employee_other_incomes | is_taxable = true |
| `taxable_pendapatan_custom` | employee_other_incomes | is_taxable = true |

**Pendapatan Lainnya Flow:**
```typescript
// 1. Add to jumlah_upah_kotor (+)
jumlah_upah_kotor += pendapatan_lainnya

// 2. Subtract from total_potongan (-)
total_potongan += pendapatan_lainnya  // to offset

// Net effect on upah_bersih = 0 (but required for slip display)
```

---

### BUNCHES (HARVEST GANGS)

| Field | Source Table | Calculation |
|-------|-------------|-------------|
| `bunches_total` | PR_LOOSEFRUIT | SUM(Bunches) |
| `bunches_ripe` | PR_LOOSEFRUIT | Ripeness = 'RIPE' |
| `bunches_unripe` | PR_LOOSEFRUIT | Ripeness = 'UNRIPE' |
| `bunches_overripe` | PR_LOOSEFRUIT | Ripeness = 'OVERRIPE' |
| `bunches_rotten` | PR_LOOSEFRUIT | Ripeness = 'ROTTEN' |
| `bunches_abnormal` | PR_LOOSEFRUIT | Ripeness = 'ABNORMAL' |
| `loose_fruit` | PR_LOOSEFRUIT | Loose fruit weight |

---

### KEY FILTER RULES

**Employee Filtering (dataExtractorService.ts ~line 898):**
```typescript
// effective_hk = HK - Minggu - Nasional
const effective_hk = hk - (empCuti.cuti_minggu + empCuti.cuti_nasional);

// IF effective_hk <= 0 → EXCLUDE
if (effective_hk <= 0) continue;
```

**Premi Exclusion (dataExtractorService.ts ~line 951):**
```typescript
if (key !== "koreksi") {
    total_premi += amount;
}
// koreksi is NOT included in total_premi
```

---

### DATABASE PROFILES

| Profile | Database | Tables Used |
|---------|----------|------------|
| SERVER_PROFILE_2 (prod) | db_ptrj | PR_TASKREGLN, PR_ADTRANS, HR_EMPLOYEE |
| SERVER_PROFILE_1 (dev) | extend_db_ptrj | Aggregation tables |
| SERVER_PROFILE_3 | VenusHR14 | HR_EMPLOYEE, HR_GANG |
| SERVER_PROFILE_3 | db_ptrj_mill | WM_TICKET (FFB weight) |

---

### SERVICE LOCATION

| Service | File |
|---------|------|
| DataExtractor | `services/dataExtractorService.ts` |
| GajiPokokService | `services/payroll/components/GajiPokokService.ts` |
| LemburCalculator | `services/lemburCalculator.ts` |
| CarumanDefinitions | `services/carumanDefinitions.ts` |
| PTKPMapper | `services/payroll/formulas/PTKPMapper.ts` |
| Pph21TerService | `services/pph21TerService.ts` |
| PayrollCalculator | `services/payroll/components/PayrollCalculator.ts` |


---


---

# BAGIAN 7: PAYROLL SOURCE FLOW

# Payroll Source Flow (Canonical)

Last updated: 2026-04-24

Tujuan dokumen ini: memastikan semua engineer/agent memakai sumber nilai yang sama, dalam urutan yang sama, dan tidak mengulang perhitungan dari sumber alternatif.

## 1. Source Mode Contract

- `origin`:
  - baca data operasional (`db_ptrj` + tabel HR terkait).
- `history`:
  - baca snapshot/history (`extend_db_ptrj`) sesuai `snapshot_version` bila diminta.
- `overlay/manual adjustment`:
  - diterapkan di atas data base sesuai mode, lalu seluruh nilai turunan dihitung ulang oleh kalkulator kanonik.

Rule:
- jangan campur mode dalam satu response payload.
- jangan fallback antar mode tanpa kontrak eksplisit.

## 2. Raw/Resolved Field Sources

### Employee identity/profile
- `emp_code`, `nama`, `gender`, `gang_code`, `loc_code`:
  - base dari extractor query employee.
- `nik`:
  - prioritas: history/override mapping (`history_hr_employee`/profile source) lalu fallback ke employee source.
- `jabatan` (role text):
  - prioritas: `history_gang_member.jabatan` -> `employee_estate.jabatan` -> fallback terbatas dari source employee bila kosong.

### Attendance and work
- `jumlah_hk`, `total_jam_kerja`, `gaji_pokok_aktual`:
  - dari agregasi attendance extractor.
- `cuti_*`:
  - dari leave extractor.
- `hari_kerja`:
  - turunan dari `jumlah_hk - total_cuti`.

### Allowance/premium/deduction raw components
- `lembur_jam`, `lembur_jumlah`:
  - dari overtime extractor.
- `beras_jumlah`, `jabatan_jumlah`, `masa_kerja_jumlah`:
  - dari upah/tunjangan resolver.
- `premi_*`, `potongan_*`:
  - dari premi/potongan extractor + manual adjustment overlay.
- `pendapatan_lainnya`:
  - dari `employee_other_incomes` (THR/Bonus/Custom/dll).

## 3. Derived Field Contract (Single Path)

Semua field turunan payroll wajib dihitung oleh:
- `backend/src/services/payroll/components/PayrollCalculator.ts`

Jangan hitung ulang manual di service lain untuk field ini:
- `upah_kotor`
- `jumlah_upah_kotor`
- `upah_kotor_pajak`
- `penghasilan_bruto`
- `total_potongan`
- `total_potongan_bersih`
- `upah_bersih`
- `pph21_ter`, `tarif_pajak_ter`

Formula kanonik:
- `total_tunjangan = beras_jumlah + jabatan_jumlah + masa_kerja_jumlah + lembur_jumlah`
- `upah_kotor = gaji_pokok_aktual + total_tunjangan + total_premi`
- `jumlah_upah_kotor = upah_kotor - pot_koreksi + pendapatan_lainnya`

Critical rule:
- karena `total_tunjangan` sudah mencakup `lembur_jumlah`, jangan pernah menambahkan `lembur_jumlah` lagi di rumus gross.

## 4. Aggregation Contract

- Gang/division/grand totals harus menjumlah field row yang sudah kanonik.
- Jangan tambahkan kompensasi/hack khusus field (`jumlah_upah_kotor`, dll) di layer total.

## 5. Implementation Anchors

- Row extraction + enrichment:
  - `backend/src/services/dataExtractorService.ts`
- Canonical formulas:
  - `backend/src/services/payroll/components/PayrollCalculator.ts`
- Totals:
  - `backend/src/services/payrollTotalsCalculator.ts`
- Aggregation adapter:
  - `backend/src/services/payroll/formulas/adapters/aggregationAdapter.ts`

## 6. Guardrails for Future Changes

- Jika menambah field baru:
  - tentukan `raw source` + `source precedence` + `derived rule` di dokumen ini.
- Jika field memengaruhi net/gross/tax:
  - integrasikan ke `PayrollCalculator`, bukan ke patch manual di extractor.
- Jika butuh fallback:
  - tulis fallback di komentar kode tepat di titik resolver, dengan alasan bisnisnya.


---

# BAGIAN 8: STAGING VS DBPTRJ MAPPING

# Staging vs db_ptrj — Mapping & Comparison

> Database staging (`staging_PTRJ_iFES_Plantware`) adalah data mentah sebelum ditransfer ke `db_ptrj`. Dokumen ini mendokumentasikan mapping setiap tabel staging ke tabel di db_ptrj, key join, dan hasil verifikasi.

## Konfigurasi

| Detail | Value |
|---|---|
| Staging DB | `staging_PTRJ_iFES_Plantware` |
| Staging Profile | `SERVER_PROFILE_2` |
| Target DB | `db_ptrj` |
| Target Profile | `SERVER_PROFILE_2` |
| Accessor | `Database.getStagingInstance()` |

## Ringkasan Tabel

| # | Staging | Baris | db_ptrj | Confidence |
|---|---|---|---|---|
| 1 | Ffbscannerdata | 4,782,758 | PR_HARVESTERLN_ARC | **VERIFIED** |
| 2 | Ffbscannerdata.LOOSEFRUIT | 3,839,125 | PR_LOOSEFRUITLN | **VERIFIED** |
| 3 | Gwscannerdata | 4,200,737 | PR_TASKREGLN | **VERIFIED** |
| 4 | Overtime | 402,806 | PR_TASKREGLN (OT=true) | **VERIFIED** |
| 5 | Employee_Info | 5,904 | HR_EMPLOYEE | **VERIFIED** |
| 6 | iFES_MillWeight | 730,101 | PR_FFBDRIVERLN | **LIKELY** |
| 7 | P3_MillWeight | 248,028 | PR_FFBDRIVER | **LIKELY** |
| 8 | Workerleave | 20,040 | HR_LEAVETRX | **LIKELY** |
| 9 | Workerholidays | 2,143 | HR_CPTRX_LEAVE | **LIKELY** |
| 10 | Gang_Number | 112 | PR_GANGLN | **LIKELY** |
| 11 | OC | 11 | PR_PAYDIVISION | **LIKELY** |
| 12 | Job_Code | 221 | WS_JOBWORKCODE | **LIKELY** |
| 13 | Field_Profile | 322 | RPT_Fields | **LIKELY** |
| 14 | Piecemeal | 11 | PR_PIECERATEALLOCLN | **POSSIBLE** |
| 15 | Halfdaywork | 0 | PR_ATTENDANCE | **POSSIBLE** |
| 16 | Vehicle_Code | 137 | GL_VEHICLE | **LIKELY** |
| 17 | Route_Path | 11 | PR_ROUTEPATH | **LIKELY** |
| 18 | Allowable_Holidays | 21 | HR_LEAVE | **POSSIBLE** |
| 19 | Checkroll_Division | 63 | PR_CHECKROLLMASTER | **POSSIBLE** |
| 20 | Company | 1 | — | Reference |
| 21 | IntegrationDateTime | 100 | — | Metadata |
| 22 | Validation | 9 | — | Metadata |
| 23 | Ffbanalysisdata | 0 | — | Empty |
| 24 | FfbLoadingCrop | 0 | — | Empty |
| 25 | LeaveType | 0 | — | Empty |
| 26 | Scanner_User | 0 | — | Empty |
| 27 | sysdiagrams | 0 | — | System |
| 28 | temp_M3DoNo | 439 | — | Temp |
| 29 | WMSExportData | 457 | — | Temp |
| 30 | GangNumberVW | 97 | — | View |

---
## Detail Mapping Terverifikasi

### 1. Ffbscannerdata → PR_HARVESTERLN_ARC / PR_LOOSEFRUITLN

**Deskripsi**: Scan FFB (Fresh Fruit Bunch) panen — data bunches per transaksi.

**Key Join**:

| Join Key | Staging | db_ptrj |
|---|---|---|
| Emp Code | `WORKERCODE` | `EmpCode` |
| Date | `TRANSDATE` | `TrxDate` |
| Tanggal | `MONTH(TRANSDATE), YEAR(TRANSDATE)` | `MONTH(TrxDate), YEAR(TrxDate)` |

**Hasil Verifikasi**:
- **100% emp match** untuk sample 50 worker pada May 2026
- **96% row count match** (staging: 4,782,758 vs ARC: 4,568,001)
- Staging mencakup data hingga **30 Mei 2026**, prod ARC hanya hingga **30 April 2026** — data Mei 2026 belum terintegrasi penuh

**Kolom Mapping**:

| Staging | db_ptrj (ARC) | Catatan |
|---|---|---|
| WORKERCODE | EmpCode | Key join |
| TRANSDATE | TrxDate | Tanggal transaksi |
| RIPE | Ripe | Tandan matang |
| UNRIPE | Unripe | Tandan mentah |
| LOOSEFRUIT | — (Tidak ada di ARC) | Masuk ke PR_LOOSEFRUITLN |
| ROTTEN | — | Tidak tersimpan |
| ABNORMAL | — | Tidak tersimpan |
| FIELDNO | — | Tidak tersimpan langsung |
| TASKNO | TaskCode | Kode tugas |
| TRANSNO | — | Nomor transaksi unik |
| FROMOCCODE | ChargeTo | OC asal |

**Catatan**: Staging menyimpan lebih detail (FIELDNO, LOOSEFRUIT, ROTTEN, ABNORMAL, TRANSNO) sementara PR_HARVESTERLN_ARC hanya menyimpan subset (Ripe, Unripe, TotalBunches, TotalRound, ABW).

---

### 2. Ffbscannerdata (LOOSEFRUIT) → PR_LOOSEFRUITLN

**Deskripsi**: Loosefruit (tandan lepas) dari Ffbscannerdata masuk ke tabel terpisah.

**Key Join**: `WORKERCODE` + `CAST(TRANSDATE AS DATE)` → `EmpCode` + `CAST(TrxDate AS DATE)`

**Hasil Verifikasi** (`2026-05-28`):
- **518/518 workers MATCH** — 100%
- **0 worker staging-only**, **0 worker prod-only**
- Nilai staging `LOOSEFRUIT` (bunches) = persis nilai prod `MT` (metric tons)

**Flow Data**:
```
Ffbscannerdata.LOOSEFRUIT (per transaksi, bunches)
  ↓
PR_LOOSEFRUITLN.MT (per employee per day, aggregated)
  ↓
PR_LOOSEFRUIT (header — DocDesc = "Import from IFES")
```

**Monthly Summary (May 2026)**:
| Source | Total | Workers |
|---|---|---|
| Staging (bunches) | 145,573 | 596 |
| PR_LOOSEFRUITLN (MT) | 156,554 | 596 |
| iFES_MillWeight (LF) | 141,760 | 111 drivers |

Selisih staging vs prod: staging hanya sampai 30 Mei, prod sudah full month penutupan.

---

### 3. Gwscannerdata → PR_TASKREGLN

**Deskripsi**: Scan general work — tugas non-panen (maintenance, pruning, raking, transport, dll).

**Key Join**:
| Join Key | Staging | db_ptrj |
|---|---|---|
| Emp Code | `WORKERCODE` | `EmpCode` |
| Tanggal | `CAST(TRANSDATE AS DATE)` | `CAST(TrxDate AS DATE)` |
| Job Code | `JOBCODE` | `TaskCode LIKE '%JOBCODE%'` |

**Hasil Verifikasi** (`2026-05-28`):
- **10/10 rows MATCH** — 100%
- Staging JOBCODE cocok ke PR_TASKCODE (misal `PM0110` → `PM0110P1A` — ada suffix division)
- **Daily count** staging 1,550-1,578 vs prod 1,625-1,754 (prod sedikit lebih besar karena bisa include entri dari sumber lain)

**Kolom Mapping**:

| Staging | db_ptrj (TASKREGLN) | Catatan |
|---|---|---|
| WORKERCODE | EmpCode | Key join |
| TRANSDATE | TrxDate | Tanggal |
| JOBCODE | TaskCode | Cari LIKE '%JOBCODE%' karena ada suffix division |
| TRANSNO | — | Nomor unik transaksi |
| FIELDNO | — | Lokasi lapangan |
| VEHICLENO | — | Kendaraan (jika ada) |
| FROMOCCODE | ChargeTo | OC / division |
| JOBCODE → JOBCODE+FROMOCCODE | TaskCode | Contoh: PM0110 + P1A = PM0110P1A |

**Catatan**: TaskCode di PR_TASKREGLN pakai format `{JOBCODE}{LOCCODE}` (contoh: PM0110P1A). Di staging disimpan terpisah (`JOBCODE` + `FROMOCCODE`).

---

### 4. Overtime → PR_TASKREGLN (dengan OT flag)

**Deskripsi**: Data lembur per transaksi. Bedanya dengan GWS: TASKREGLN punya flag `OT` (boolean).

**Key Join**: `WORKERCODE` + `CAST(TRANSDATE AS DATE)` → `EmpCode` + `CAST(TrxDate AS DATE)` + `OT=1`

**Hasil Verifikasi** (`2026-05-28`):
- **9/10 rows MATCH** di TASKREGLN dengan OT=true (90%)
- **1 miss**: A0001 (2 jam OT staging) — TASKREGLN hanya punya non-OT 7 jam. Mungkin OT belum diproses atau masuk di tanggal lain.
- **PR_MTHRATEDOTLN**: 0 baris — tabel ini tidak dipakai untuk OT harian
- **Daily OT**: staging 149-161 rows vs TASKREGLN(OT=1) 169-187 rows

**Kolom Mapping**:

| Staging | db_ptrj (TASKREGLN) | Catatan |
|---|---|---|
| WORKERCODE | EmpCode | Key join |
| TRANSDATE | TrxDate | Tanggal lembur |
| JOBCODE | TaskCode | Kode tugas |
| HOURS | Hours | Jam lembur |
| BASICRATE | Rate | Rate dasar |
| ADDRATE | — | Rate tambahan (tidak tersimpan langsung) |

---

### 5. Employee_Info → HR_EMPLOYEE

**Deskripsi**: Master data karyawan.

**Key Join**: `Employee_Code` (trim) → `EmpCode`

**Hasil Verifikasi**: **10/10 nama cocok persis** (SALASATUN, MARTONO, SUHARTINI, dll).

---

## Flow Integration

```
PLANTWARE (Scanner Device)
  │
  ├── FFB Scan    →  staging_PTRJ_iFES_Plantware.Ffbscannerdata
  ├── GWS Scan    →  staging_PTRJ_iFES_Plantware.Gwscannerdata
  ├── OT Scan     →  staging_PTRJ_iFES_Plantware.Overtime
  └── Mill Weight →  staging_PTRJ_iFES_Plantware.iFES_MillWeight
                        │
                        │ (Integrasi — proses batch)
                        ▼
                    db_ptrj
  │
  ├── PR_HARVESTERLN_ARC      (FFB panen, bunches)
  ├── PR_LOOSEFRUITLN          (Loosefruit, metric tons)
  ├── PR_TASKREGLN             (General work + Overtime)
  └── PR_FFBDRIVERLN           (Mill weight)
```

### Integrasi Timeline
Data staging diintegrasikan ke db_ptrj secara batch. Berdasarkan `IntegrationDateTime` dan `INTEGRATETIME`:
- Staging bisa berisi data real-time (scan terbaru)
- db_ptrj diperbarui secara periodik (interval jam/hari)
- **Konsekuensi**: staging = superset data terbaru, prod = data yang sudah melewati proses verifikasi

---

## Invariant Check

```
Staging ⊆ db_ptrj
```

Setiap record di staging harus ditemukan di db_ptrj — baik sebagai record langsung maupun hasil agregasi. Verifikasi membuktikan invariant ini berlaku untuk:

- ✅ Ffbscannerdata → PR_HARVESTERLN_ARC
- ✅ Ffbscannerdata.LOOSEFRUIT → PR_LOOSEFRUITLN
- ✅ Gwscannerdata → PR_TASKREGLN
- ✅ Overtime → PR_TASKREGLN (OT=true) — 90%, 1 anomaly
- ✅ Employee_Info → HR_EMPLOYEE

---

---
## API Endpoints — Staging Comparison Service

Base path: `/api/staging`

Semua endpoint return `{ success: true/false, data: ... }` atau `{ success: false, error: string }`.

### Explore

| Method | Path | Query | Description |
|--------|------|-------|-------------|
| GET | `/api/staging/explore/tables` | — | Full discovery: 30 tables with row counts + column schemas |
| GET | `/api/staging/explore/table/:name` | `?sample=10` | Single table: columns + sample rows |

### Compare — Row-Level

| Method | Path | Query | Default | Description |
|--------|------|-------|---------|-------------|
| GET | `/api/staging/compare/attendance` | `?date=&limit=` | 2026-05-28, 50 | Match GWS rows → PR_TASKREGLN by EmpCode+Date+JobCode |
| GET | `/api/staging/compare/overtime` | `?date=&limit=` | 2026-05-28, 50 | Match OT rows → PR_TASKREGLN(OT=1) or PR_MTHRATEDOTLN |
| GET | `/api/staging/compare/loosefruit` | `?date=&limit=&missing_only=` | 2026-05-28, 50, false | Match FFB LOOSEFRUIT → PR_LOOSEFRUITLN (set missing_only=true for only missing) |
| GET | `/api/staging/compare/brondol-missing` | `?date=&limit=` | 2026-05-28, 50 | Returns brondol items in staging but NOT in plantware (staging > prod) |

Masing-masing return `{ rows: [...], summary: { match_count, staging_only, staging_total, prod_total, pct_match } }`. Endpoint `brondol-missing` returns simplified format:

```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "nama": "WORKER NAME",
      "divisi": "A1",      // Gang code (first 2 chars)
      "blok": "OC001",     // FromOcCode (fieldno)
      "estate": "Estate1", // Division/location
      "jumlah_selisih": 25, // Number of missing brondol
      "emp_code": "P001",
      "trans_date": "2026-05-28"
    }
  ]
}
```

### Compare — Daily Summary (aggregate per day)

| Method | Path | Query | Default | Description |
|--------|------|-------|---------|-------------|
| GET | `/api/staging/compare/daily-attendance` | `?month=&year=&top=` | 5, 2026, 15 | Per-day GWS count vs TASKREGLN vs ARC |
| GET | `/api/staging/compare/daily-overtime` | `?month=&year=&top=` | 5, 2026, 15 | Per-day OT rows+hours vs TASKREGLN(OT=1) vs MTHRATEDOTLN |
| GET | `/api/staging/compare/daily-loosefruit` | `?month=&year=&top=` | 5, 2026, 15 | Per-day LF workers+quantity vs PR_LOOSEFRUITLN |

---

## Catatan untuk Implementasi

1. **PR_HARVESTERLN_ACC** (79K rows) hanya menyimpan subset data — schema berbeda (akuntansi), gunakan ARC untuk full data
2. **TaskCode join** perlu string concatenation: `JOBCODE + LOCCODE` (tanpa spasi, uppercase)
3. **Loosefruit** beda satuan — staging dalam bunches, prod dalam MT (1:1 secara kebetulan)
4. **Data Mei 2026** di staging belum semua masuk ke ARC (prod hanya sampai April 2026)
5. **DATECREATED dan CREATEDBY** di staging terkadang berbeda dengan CreatedDate di prod — karena bisa di-reprocess oleh user berbeda


---

# BAGIAN 9: MANUAL ADJUSTMENT API

# Manual Adjustment API

Dokumentasi API untuk mengelola manual adjustment (koreksi) daftar upah melalui API key bypass.

---

## Update Penting Untuk Browser Automation

Perubahan terbaru menambahkan endpoint khusus untuk agent/browser automation yang sudah menginput premi, koreksi, atau potongan ke Plantware lalu ingin menandai data manual adjustment sebagai sudah sync.

Endpoint yang dipakai:

```text
POST /payroll/manual-adjustment/sync-status/by-api-key
```

Untuk menjalankan update sync-status massal seperti seeder auto-buffer, pakai:

```text
POST /payroll/manual-adjustment/seed-sync-status/by-api-key
```

Gunakan endpoint ini setelah input Plantware selesai. Endpoint akan:

- membaca row manual adjustment dari `extend_db_ptrj.dbo.payroll_manual_adjustments`;
- mengecek transaksi yang sudah masuk di `db_ptrj` (`PR_ADTRANS` dan `PR_ADTRANS_ARC`);
- mengubah segmen status `sync:` dan `match:` di `remarks` berdasarkan total ADTRANS terkini;
- tidak mengubah `amount`, `metadata_json`, `adjustment_name`, atau TaskDesc/ADCode;
- selalu mengembalikan field display ADCode: `ad_code`, `ad_code_desc`, `ad_desc`, dan `task_desc`;
- memberi status `sync:SYNC | match:MATCH` jika total ADTRANS sama, `sync:DIFF | match:MISMATCH` jika ada transaksi tapi total beda, dan `sync:MISS | match:MISMATCH` jika target non-zero tidak punya transaksi pembanding. Target `0` tanpa transaksi pembanding dihitung sama dengan total `0`, jadi tetap `SYNC`.

Gunakan `dry_run=true` dulu untuk verifikasi. Jika hasilnya sesuai, panggil ulang dengan `dry_run=false`.

Seeder sync-status memproses default:

```text
PREMI, POTONGAN_KOTOR, POTONGAN_BERSIH, AUTO_BUFFER
```

Seeder memproses ulang row yang sudah `sync:SYNC`, termasuk `AUTO_BUFFER`, karena nilai Plantware bisa berubah setelah status lama ditulis. Default `only_if_adtrans_exists=true`, jadi hasilnya adalah audit ulang terhadap total `db_ptrj.PR_ADTRANS` / archive untuk employee dan adjustment tersebut.

Catatan: endpoint versi lama pernah tidak memberi status audit eksplisit untuk row missing/partial. Versi sekarang menulis status audit eksplisit: `SYNC`, `DIFF`, atau `MISS`.

---

## Update Untuk Reset/Cleanup DocID ADTRANS

Jika automation perlu menghapus record salah input di Plantware, gunakan endpoint read-only ini untuk mengambil **list `DocID`** yang match dengan periode, divisi, dan config kategori yang dipilih:

```text
POST /payroll/manual-adjustment/adtrans-doc-ids/by-api-key
```

Alias kompatibel jika automation sudah memakai nama `adtrans-by-docid`:

```text
POST /payroll/manual-adjustment/adtrans-by-docid/by-api-key
POST /payroll/manual-adjustment/adtrans-by-doid/by-api-key
```

Endpoint ini hanya membaca `db_ptrj` dari `PR_ADTRANS` dan `PR_ADTRANS_ARC`. Endpoint ini tidak menjalankan delete, tidak update `extend_db_ptrj`, dan response-nya sengaja dibuat sederhana:

```json
{
  "success": true,
  "count": 2,
  "doc_ids": ["ADIJL26041001", "ADIJL26041002"]
}
```

Gunakan config yang sama dengan endpoint duplicate/check:

- `filters: ["jabatan"]` untuk tunjangan jabatan.
- `filters: ["masa kerja"]` untuk tunjangan masa kerja.
- `filters: ["spsi"]` untuk potongan SPSI.
- `filters: ["pph"]` untuk potongan PPh21 employee (`(DE) POTONGAN PPH21`).
- `adjustment_type: "PREMI"` dan `adjustment_name: "PREMI TBS"` untuk premi tertentu.
- `adjustment_type: "POTONGAN_KOTOR"` dan `adjustment_name: "KOREKSI PANEN"` untuk koreksi tertentu.
- `doc_desc` jika ingin match teks `PR_ADTRANS.DocDesc` langsung.

Detail request, response, dan contoh cURL ada di section **4b. Ambil List `DocID` ADTRANS untuk Config Terpilih**.

Untuk kasus **mismatch**: data sudah ada di `db_ptrj`, manual adjustment juga ada, tetapi nominal/detailnya tidak sama dengan yang tersimpan di `payroll_manual_adjustments`, gunakan endpoint komparasi:

```text
POST /payroll/manual-adjustment/compare-adtrans/by-api-key
```

Definisi `MISMATCH` pada endpoint ini adalah total nilai `db_ptrj.PR_ADTRANS` + `PR_ADTRANS_ARC` untuk employee+kategori tidak sama dengan nilai di `extend_db_ptrj.dbo.payroll_manual_adjustments`. Response item `MISMATCH` membawa `db_ptrj_doc_desc_details[]` yang berisi `doc_id`, `doc_desc`, dan `amount`. Untuk kebutuhan hapus/reset input Plantware yang salah, ambil `doc_id` dari field itu:

```bash
curl -s -X POST "http://localhost:8002/payroll/manual-adjustment/compare-adtrans/by-api-key" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "period_month": 4,
    "period_year": 2026,
    "division_code": "AB1",
    "filters": ["premi", "koreksi", "potongan"]
  }' | jq -r '.data.comparisons[]
    | select(.status == "MISMATCH")
    | .db_ptrj_doc_desc_details[]
    | select(.doc_id != null)
    | .doc_id' | sort -u
```

Jangan memakai `adtrans-doc-ids` untuk mencari mismatch karena endpoint itu hanya mencari `DocID` berdasarkan periode/scope/config, tanpa membandingkan nominal terhadap manual adjustment. Gunakan `adtrans-doc-ids` setelah scope/config sudah pasti, atau untuk cleanup berdasarkan kategori yang memang ingin dihapus seluruhnya.

---

## Daftar Division (Divisi)

Division dikelompokkan menjadi **Real Divisions** dan **Virtual Divisions**.

### Real Divisions

| Code | Nama | Aliases | Gang Prefix | Lokasi |
|------|------|---------|-------------|--------|
| `PG1A` | Plasma 1 Afdeling | P1A, PLASMA1A, Plasma 1A | A | Afdeling Plasma 1 |
| `PG1B` | Plasma 1 Blok | P1B, PLASMA1B, Plasma 1B | B | Blok Plasma 1 |
| `PG2A` | Plasma 2 Afdeling | P2A, PLASMA2A, Plasma 2A | C | Afdeling Plasma 2 |
| `PG2B` | Plasma 2 Blok | P2B, PLASMA2B, Plasma 2B | D | Blok Plasma 2 |
| `PGE` | Plasma Energi | PGE | PGE | Energi |
| `AB1` | Afdeling 1 | ARB1, AFDELING1, Air Ruak 1 | G | Air Ruak 1 |
| `AB2` | Afdeling 2 | ARB2, AFDELING2, Air Ruak 2 | H | Air Ruak 2 |
| `ARA` | Area | Area | F | Area |
| `ARC` | Air Ruak Central | AREC, Air Ruak Central | J | Air Ruak Central |
| `DME` | Dempo | Dempo | E | Dempo |
| `IJL` | Ijuk | L | L | Ijuk |

### Virtual Divisions

| Code | Nama | Source | Gang Pattern | Description |
|------|------|--------|--------------|-------------|
| `INF` | Infrastruktur | PG1A | `/^IN.*/i` | Gang mulai dengan IN |
| `NRS` | Nursery | PG1B | `/^B2N$/i` | Gang B2N |
| `WKS_AR` | Workshop Air Ruak | AB2 | `/^HMC$/i` | Gang HMC |
| `WKS_PG` | Workshop Parit Gunung | PG1A | `/^AMC$/i` | Gang AMC |
| `WORKSHOP` | Workshop All | - | `/^(HMC\|AMC)$/i` | AMC dan HMC |
| `MILL` | Palm Oil Mill | - | `/^M\d*$/i` | Gang mulai dengan M |

### Cara Mengakses Virtual Division

Untuk endpoint manual adjustment, virtual division diakses lewat parameter `division_code` seperti divisi biasa, tetapi gunakan **kode canonical virtual** di bawah ini. Jangan memakai nama display panjang jika automation belum menormalisasi alias.

| Kebutuhan | `division_code` yang dipakai | Alias/nama yang sering disebut | Source real division | Gang yang masuk |
|-----------|------------------------------|--------------------------------|----------------------|-----------------|
| Infrastruktur / INFRA | `INF` | `INFRA`, `INFRASTRUKTUR` | `PG1A` | Gang berawalan `IN`, termasuk `INF`/`INT` |
| Nursery | `NRS` | `NURSERY`, `B2N` | `PG1B` | `B2N` |
| Workshop P.G / Parit Gunung | `WKS_PG` | `WORKSHOP PG`, `WORKSHOP PGE`, `WORKSHOP P.G`, `AMC` | `PG1A` | `AMC` |
| Workshop A.R / Air Ruak / ARE | `WKS_AR` | `WORKSHOP AR`, `WORKSHOP ARE`, `HMC` | `AB2` | `HMC` |
| Workshop gabungan | `WORKSHOP` | `WORKSHOP_ALL` | `PG1A` + `AB2` | `AMC` dan `HMC` |

Catatan penting:

- Untuk INFRA, parameter yang paling aman adalah `division_code=INF`, bukan `INFRA`.
- Untuk Nursery, parameter yang paling aman adalah `division_code=NRS`, bukan `NURSERY`.
- Untuk Workshop PG/P.G/PGE, gunakan `division_code=WKS_PG`. Jangan gunakan `division_code=PGE` karena `PGE` adalah real division **Plasma Energi**, bukan virtual Workshop Parit Gunung.
- Untuk Workshop ARE/Air Ruak, gunakan `division_code=WKS_AR`.
- Jika response `view=grouped`, field `estate`/`estate_code` berisi kode virtual/source yang tersimpan, sedangkan field `division_code` pada employee adalah turunan dari `gang_code`.

## Get adjustment untuk Employee yang MISSING

Ketika employee missing adjustment (tidak ada di daftar upah), gunakan endpoint ini untuk mendapatkan/callback adjustment yang sudah ada:

```bash
# Get adjustment via API (jika auth mode internal)
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&emp_code=B0745" \
  -H "X-API-Key: ${API_KEY}"

# Get adjustment via API (jika auth mode external/proxy)
curl -s "http://localhost:8002/backend/upah/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&emp_code=B0745" \
  -H "X-API-Key: ${API_KEY}"

# Get adjustment via SQL Gateway (direct database query - WORKAROUND)
curl -X POST "http://10.0.0.110:8001/v1/query" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${DB_API_KEY}" \
  -d '{
    "sql": "SELECT emp_code, gang_code, division_code, adjustment_name, adjustment_type, amount FROM payroll_manual_adjustments WHERE period_month = 4 AND period_year = 2026 AND emp_code = '\''B0745'\''",
    "server": "SERVER_PROFILE_1",
    "database": "extend_db_ptrj"
  }'
```

**Hasil Query SQL (emp_code=B0745):**

```json
{
  "success": true,
  "db": "extend_db_ptrj",
  "server": "SERVER_PROFILE_1",
  "execution_ms": 7.24,
  "data": {
    "recordset": [
      {"emp_code": "B0745", "gang_code": "B2N", "division_code": "NRS", "adjustment_name": "PREMI COBA", "adjustment_type": "PREMI", "amount": 50},
      {"emp_code": "B0745", "gang_code": "B2N", "division_code": "NRS", "adjustment_name": "KOREKSI KOREKKSI PANEN", "adjustment_type": "POTONGAN_KOTOR", "amount": 0},
      {"emp_code": "B0745", "gang_code": "B2N", "division_code": "NRS", "adjustment_name": "TUNJANGAN JABATAN", "adjustment_type": "AUTO_BUFFER", "amount": 0},
      {"emp_code": "B0745", "gang_code": "B2N", "division_code": "NRS", "adjustment_name": "MASA KERJA", "adjustment_type": "AUTO_BUFFER", "amount": 2500},
      {"emp_code": "B0745", "gang_code": "B2N", "division_code": "NRS", "adjustment_name": "SPSI", "adjustment_type": "AUTO_BUFFER", "amount": 4000},
      {"emp_code": "B0745", "gang_code": "B2N", "division_code": "NRS", "adjustment_name": "POTONGAN PPH", "adjustment_type": "AUTO_BUFFER", "amount": 93435}
    ],
    "rowsAffected": 6
  }
}
```

**Query Parameters untuk Get Employee Adjustments (via API):**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `period_month` | string | ✅ | Bulan (1-12) |
| `period_year` | string | ✅ | Tahun (e.g. "2026") |
| `emp_code` | string | ❌ | Employee code spesifik |
| `gang_code` | string | ❌ | Filter per gang |
| `division_code` | string | ❌ | Filter per division |
| `adjustment_type` | string | ❌ | Filter per type: `PREMI`, `POTONGAN_KOTOR`, `POTONGAN_BERSIH`, `PENDAPATAN_LAINNYA`, `AUTO_BUFFER`, `MANUAL` (alias = semua kecuali AUTO_BUFFER). Mendukung comma-separated, e.g. `PREMI,POTONGAN_KOTOR` |
| `adjustment_name` | string | ❌ | Filter per nama (partial match) |
| `view` | string | ❌ | Format response. Default `flat`. Pakai `grouped` untuk response siap auto input: division -> gang -> employee -> premiums/adjustments. |
| `metadata_only` | string | ❌ | Jika `true`, hanya ambil row yang memiliki `metadata_json`. Ini disarankan untuk data premi detail terbaru; row tanpa metadata adalah format lama. |

**`adjustment_type` Values:**

| Value | Description |
|-------|-------------|
| `PREMI` | Tunjangan bonus/premi tambahan |
| `POTONGAN_KOTOR` | Potongan dari upah kotor (koreksi) |
| `POTONGAN_BERSIH` | Potongan dari upah bersih |
| `PENDAPATAN_LAINNYA` | Pendapatan lain (THR, bonus, dll) |
| `AUTO_BUFFER` | Auto-generated Jabatan/Masa Kerja/SPSI/POTONGAN PPH (dari seeder) |
| `MANUAL` | Alias untuk `PREMI,POTONGAN_KOTOR,POTONGAN_BERSIH,PENDAPATAN_LAINNYA` (semua kecuali AUTO_BUFFER) |

**Comma-separated example:** `adjustment_type=PREMI,POTONGAN_KOTOR` → filter PREMI dan POTONGAN_KOTOR sekaligus.

**SQL Query untuk Get Adjustments by Employee:**

```sql
-- Get semua adjustment untuk 1 employee
SELECT emp_code, gang_code, division_code, adjustment_name, adjustment_type, amount
FROM payroll_manual_adjustments
WHERE period_month = {month}
  AND period_year = {year}
  AND emp_code = '{emp_code}'

-- Get hanya AUTO_BUFFER adjustments
SELECT emp_code, gang_code, division_code, adjustment_name, adjustment_type, amount
FROM payroll_manual_adjustments
WHERE period_month = {month}
  AND period_year = {year}
  AND emp_code = '{emp_code}'
  AND adjustment_type = 'AUTO_BUFFER'

-- Get hanya MANUAL adjustments (semua kecuali AUTO_BUFFER)
SELECT emp_code, gang_code, division_code, adjustment_name, adjustment_type, amount
FROM payroll_manual_adjustments
WHERE period_month = {month}
  AND period_year = {year}
  AND emp_code = '{emp_code}'
  AND adjustment_type IN ('PREMI', 'POTONGAN_KOTOR', 'POTONGAN_BERSIH', 'PENDAPATAN_LAINNYA')

-- Get adjustment berdasarkan division
SELECT emp_code, gang_code, division_code, adjustment_name, adjustment_type, amount
FROM payroll_manual_adjustments
WHERE period_month = {month}
  AND period_year = {year}
  AND division_code = '{division_code}'
ORDER BY emp_code, adjustment_type
```

**Table:** `payroll_manual_adjustments` (database: `extend_db_ptrj`, profile: `SERVER_PROFILE_1`)

---

## Filter Per Division

```bash
# Filter by division_code (semua gang dalam divisi)
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=AB1" \
  -H "X-API-Key: ${API_KEY}"

# Filter by gang_code (gang spesifik)
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&gang_code=H1H" \
  -H "X-API-Key: ${API_KEY}"

# Filter by division + gang (spesifik)
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=AB1&gang_code=H1H" \
  -H "X-API-Key: ${API_KEY}"
```

### Contoh Filter Virtual Division

```bash
# INFRA / Infrastruktur
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=INF" \
  -H "X-API-Key: ${API_KEY}"

# Nursery
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=NRS" \
  -H "X-API-Key: ${API_KEY}"

# Workshop P.G / Parit Gunung / PGE wording (gang AMC)
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=WKS_PG" \
  -H "X-API-Key: ${API_KEY}"

# Workshop A.R / Air Ruak / ARE wording (gang HMC)
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=WKS_AR" \
  -H "X-API-Key: ${API_KEY}"

# Semua workshop: AMC + HMC
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=WORKSHOP" \
  -H "X-API-Key: ${API_KEY}"
```

Untuk response siap dipakai browser automation, tambahkan `view=grouped`. Untuk hanya mengambil premi/detail terbaru yang punya metadata, tambahkan `adjustment_type=PREMI&metadata_only=true`.

```bash
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=INF&adjustment_type=PREMI&metadata_only=true&view=grouped" \
  -H "X-API-Key: ${API_KEY}"
```

---

## Authentication

Semua endpoint manual adjustment memerlukan header `X-API-Key`.

```bash
# API Key yang dikonfigurasi di backend/.env
X-API-Key: 88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a
```

Jika API key valid, request akan mendapat akses **ADMIN** dengan semua divisions.

---

## ADCode untuk Manual Adjustment

Manual adjustment kategori `PREMI`, `POTONGAN_KOTOR`, `POTONGAN_BERSIH`, dan `PENDAPATAN_LAINNYA` wajib membawa `ad_code` saat membuat kolom/manual adjustment baru. Hanya `AUTO_BUFFER` yang boleh disimpan tanpa `ad_code`. Endpoint `adjustment-name-options/by-api-key` hanya mengembalikan variasi `adjustment_name`; jangan ambil ADCode dari endpoint itu.

Remarks disimpan dengan format:

```text
AD CODE: <adcode> - <taskdesc>
```

Parser response mendukung format remarks lama/automation berikut untuk mengisi `ad_code` dan `ad_code_desc` saat kolom structured (`ad_code`, `task_code`, `base_task_code`, `task_desc`) masih kosong:

```text
AD CODE: <adcode> - <taskdesc>
<adjustment_name> | <adcode> - <taskdesc> | <amount> | sync:<status> | match:<status>
<adjustment_name> | (<adcode>) <taskdesc> - <taskdesc> | <amount> | sync:<status> | match:<status>
<adjustment_name> | <taskdesc> - <taskdesc> | <amount> | sync:<status> | match:<status>
```

Untuk remarks pipe-delimited, parser hanya mengambil hasil `remarks.split("|")[1]` sebagai sumber ADCode/TaskDesc. Jika segmen itu diawali kode dalam kurung seperti `(AL0018P1A)`, response mengisi `ad_code` dari kode tersebut dan `ad_code_desc` dari TaskDesc setelahnya. Jika segmen ADCode/TaskDesc diawali `(AL)` atau `(DE)`, parser memperlakukannya sebagai **TaskDesc display**, bukan kode ADCode pendek.

Contoh:

```text
PREMI TBS | (AL) TUNJANGAN PREMI ((PM) HARVESTING LABOUR - HARVESTING) - (AL) TUNJANGAN PREMI ((PM) HARVESTING LABOUR - HARVESTING) | 423363 | sync:MANUAL | match:MANUAL
PREMI JAGA | (AL0018P1A) (AL) TUNJANGAN JAGA GENSET - (AL) TUNJANGAN JAGA GENSET | 350000 | sync:MANUAL | match:MANUAL
```

Parser contoh `PREMI JAGA` akan menghasilkan:

```json
{
  "ad_code": "AL0018P1A",
  "ad_code_desc": "(AL) TUNJANGAN JAGA GENSET",
  "task_desc": "(AL) TUNJANGAN JAGA GENSET"
}
```

**Catatan parsing remarks:**

- Tanda minus dalam TaskDesc seperti `HARVESTING LABOUR - HARVESTING` tidak dianggap sebagai pemisah ADCode.
- Pemisah TaskDesc display hanya valid jika setelah ` - ` ada awalan `(AL)` atau `(DE)`.
- Parser remarks bekerja secara berurutan: jika kolom structured (`ad_code`, `task_code`, `base_task_code`, `task_desc`) sudah terisi, nilainya digunakan langsung; baru kemudian fallback ke parse remarks.
- Format `AD CODE: <adcode> - <taskdesc>` di remarks juga tetap didukung untuk backward compatibility.
- Format `AD CODE: <taskdesc>` (tanpa kode pendek) juga didukung untuk remarks yang hanya menyimpan TaskDesc display saja.
- Jika structured field kosong dan remarks tidak bisa diparse, response fallback ke `backend/data/premium_definitions.json` berdasarkan `adjustment_name`. Ini memastikan premi/koreksi/potongan yang sudah punya definisi tetap memiliki `ad_code_desc`/`task_desc`.

Daftar ADCode diambil dari cache JSON `backend/data/taskcode_mapping_db_ptrj.json` yang bersumber dari `PR_TASKCODE` dengan filter:

```sql
SELECT DISTINCT [TaskDesc]
FROM [db_ptrj].[dbo].[PR_TASKCODE]
WHERE [TaskDesc] LIKE '(AL)%'
   OR [TaskDesc] LIKE '(DE)%'
ORDER BY [TaskDesc];
```

### GET `/payroll/manual-adjustment/taskcode-options`

Endpoint untuk search ADCode saat user mengetik di popup tambah kolom manual adjustment.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `search` | string | ❌ | Cari berdasarkan ADCode, TaskCode, atau TaskDesc |
| `division_code` | string | ❌ | Filter suffix lokasi/divisi jika tersedia |
| `limit` | string | ❌ | Maksimal data, default 50, maksimum 100 |

**Response:**

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "ad_code": "AL0001",
      "task_code": "AL0001",
      "base_task_code": "AL0001",
      "task_desc": "(AL) BENEFIT IN KIND - ACCOMMODATION",
      "doc_desc": "(AL) BENEFIT IN KIND - ACCOMMODATION",
      "loc_code": null
    }
  ]
}
```

### GET `/payroll/manual-adjustment/automation-options/by-api-key`

Endpoint automation agent untuk mengambil pilihan input siap pakai dari `PR_TASKCODE`/cache taskcode. Endpoint ini memakai header `X-API-Key` dan mengembalikan `ad_code`; `description` hasil bersih dari `TaskDesc`; serta `adjustment_name` yang sama dengan `description`.

Kategori yang dikembalikan:

| `category` | `adjustment_type` untuk save | Aturan dari deskripsi |
|------------|------------------------------|------------------------|
| `premi` | `PREMI` | `(AL)` selain potongan/koreksi, SPSI, dan PPH |
| `koreksi` | `POTONGAN_KOTOR` | Deskripsi mengandung `KOREKSI` |
| `potongan_upah_bersih` | `POTONGAN_BERSIH` | Deskripsi mengandung `POTONGAN`, `POT `, atau `POT_` selain SPSI/PPH |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `search` | string | ❌ | Cari berdasarkan ADCode, TaskCode, atau TaskDesc sumber |
| `division_code` | string | ❌ | Filter suffix lokasi/divisi jika tersedia |
| `categories` | string | ❌ | Comma separated: `premi,koreksi,potongan_upah_bersih` |
| `limit` | string | ❌ | Maksimal data, default 100, maksimum 200 |

**Example:**

```bash
curl -s "http://localhost:8002/payroll/manual-adjustment/automation-options/by-api-key?division_code=P1A&categories=premi,koreksi,potongan_upah_bersih" \
  -H "X-API-Key: $API_KEY"
```

**Response:**

```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "category": "premi",
      "adjustment_type": "PREMI",
      "adjustment_name": "INSENTIF PANEN",
      "ad_code": "A100",
      "description": "INSENTIF PANEN",
      "task_code": "A100P1A",
      "task_desc": "(AL) INSENTIF PANEN",
      "base_task_code": "A100",
      "loc_code": "P1A"
    },
    {
      "category": "koreksi",
      "adjustment_type": "POTONGAN_KOTOR",
      "adjustment_name": "KOREKSI PANEN",
      "ad_code": "D200",
      "description": "KOREKSI PANEN",
      "task_code": "D200P1A",
      "task_desc": "(DE) KOREKSI PANEN",
      "base_task_code": "D200",
      "loc_code": "P1A"
    },
    {
      "category": "potongan_upah_bersih",
      "adjustment_type": "POTONGAN_BERSIH",
      "adjustment_name": "POTONGAN PINJAMAN",
      "ad_code": "D300",
      "description": "POTONGAN PINJAMAN",
      "task_code": "D300P1A",
      "task_desc": "(DE) POTONGAN PINJAMAN",
      "base_task_code": "D300",
      "loc_code": "P1A"
    }
  ]
}
```

### GET `/payroll/manual-adjustment/adjustment-name-options/by-api-key`

Endpoint khusus untuk automation mengambil variasi `adjustment_name` yang benar-benar sudah ada di `payroll_manual_adjustments`. Endpoint ini **bukan** daftar dari `PR_TASKCODE`. Pakai endpoint ini jika perlu tahu premi/koreksi/potongan apa saja yang dimiliki suatu estate/divisi sumber atau suatu gang berdasarkan data manual adjustment yang tersimpan.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `adjustment_type` | string | ❌ | Comma separated. Default semua: `PREMI,POTONGAN_KOTOR,POTONGAN_BERSIH`. Alias: `KOREKSI` = `POTONGAN_KOTOR`, `POTONGAN_UPAH_BERSIH` = `POTONGAN_BERSIH`. |
| `period_month` | string | ❌ | Filter bulan payroll, misalnya `4`. Disarankan dikirim agar variasi sesuai periode input. |
| `period_year` | string | ❌ | Filter tahun payroll, misalnya `2026`. |
| `division_code` / `estate` | string | ❌ | Filter estate/lokasi sumber yang tersimpan di DB, misalnya `AB1`, `P1A`, `P2A`. Alias estate seperti `ARB1` ikut dinormalisasi ke `AB1`. |
| `gang_code` | string | ❌ | Filter gang tertentu, misalnya `G1H`. |
| `metadata_only` / `has_metadata` | string | ❌ | Jika `true`, hanya hitung variasi dari row yang punya `metadata_json`/detail transaksi baru. |
| `search` | string | ❌ | Cari berdasarkan `adjustment_name` yang tersimpan. |
| `limit` | string | ❌ | Maksimal variasi yang dikembalikan, default 200, maksimum 500. |

**Ambil semua variasi nama per tipe dalam satu estate:**

```bash
curl -s "http://localhost:8002/payroll/manual-adjustment/adjustment-name-options/by-api-key?period_month=4&period_year=2026&division_code=AB1&adjustment_type=PREMI,POTONGAN_KOTOR,POTONGAN_BERSIH&limit=200" \
  -H "X-API-Key: ${API_KEY}"
```

**Ambil variasi premi yang dimiliki satu gang:**

```bash
curl -s "http://localhost:8002/payroll/manual-adjustment/adjustment-name-options/by-api-key?period_month=4&period_year=2026&division_code=AB1&gang_code=G1H&adjustment_type=PREMI&metadata_only=true&limit=200" \
  -H "X-API-Key: ${API_KEY}"
```

**Ambil variasi koreksi dan potongan upah bersih yang tersimpan:**

```bash
curl -s "http://localhost:8002/payroll/manual-adjustment/adjustment-name-options/by-api-key?period_month=4&period_year=2026&division_code=AB1&adjustment_type=POTONGAN_KOTOR,POTONGAN_BERSIH&limit=200" \
  -H "X-API-Key: ${API_KEY}"
```

**Response:**

```json
{
  "success": true,
  "count": 4,
  "adjustment_types": ["PREMI", "POTONGAN_KOTOR", "POTONGAN_BERSIH"],
  "adjustment_names_by_type": {
    "PREMI": ["PREMI PRUNING", "PREMI TBS"],
    "POTONGAN_KOTOR": ["KOREKSI PANEN"],
    "POTONGAN_BERSIH": ["POTONGAN PINJAMAN"]
  },
  "by_type": {
    "PREMI": [
      { "adjustment_type": "PREMI", "adjustment_name": "PREMI PRUNING" },
      { "adjustment_type": "PREMI", "adjustment_name": "PREMI TBS" }
    ],
    "POTONGAN_KOTOR": [
      { "adjustment_type": "POTONGAN_KOTOR", "adjustment_name": "KOREKSI PANEN" }
    ],
    "POTONGAN_BERSIH": [
      { "adjustment_type": "POTONGAN_BERSIH", "adjustment_name": "POTONGAN PINJAMAN" }
    ]
  },
  "data": [
    { "adjustment_type": "PREMI", "adjustment_name": "PREMI PRUNING" },
    { "adjustment_type": "PREMI", "adjustment_name": "PREMI TBS" },
    { "adjustment_type": "POTONGAN_KOTOR", "adjustment_name": "KOREKSI PANEN" },
    { "adjustment_type": "POTONGAN_BERSIH", "adjustment_name": "POTONGAN PINJAMAN" }
  ]
}
```

Gunakan `adjustment_names_by_type` jika hanya butuh list nama. Query dasarnya sesederhana `SELECT DISTINCT adjustment_name FROM payroll_manual_adjustments WHERE adjustment_type = ... ORDER BY adjustment_name ASC`; endpoint hanya menambahkan filter periode, estate, gang, dan metadata jika dikirim.

Saat agent memakai response endpoint ini:

- `adjustment_type` dari response.
- `adjustment_name` dari response.
- Endpoint ini tidak mengirim `ad_code`, `task_code`, `task_desc`, atau `base_task_code` karena sumbernya hanya variasi nama yang sudah tersimpan di `payroll_manual_adjustments`. Jika proses save membutuhkan ADCode/TaskDesc, ambil dari detail transaksi/row manual adjustment terkait atau endpoint taskcode terpisah.
- Identitas karyawan wajib dipisahkan: `emp_code` berisi EmpCode PTRJ/Plantware, `nik` berisi NIK/KTP, dan `emp_name` hanya berisi nama karyawan. Jangan pernah mengirim NIK di `emp_name`.

**Payload Save Manual Adjustment:**

```json
{
  "period_month": 4,
  "period_year": 2026,
  "emp_code": "A0001",
  "nik": "1902050504860001",
  "emp_name": "BUDI TEST",
  "gang_code": "G1H",
  "division_code": "AB1",
  "adjustment_type": "PREMI",
  "adjustment_name": "PREMI MANUAL",
  "amount": 100000,
  "ad_code": "(AL) BENEFIT IN KIND - ACCOMMODATION",
  "task_code": "AL0001AB1",
  "base_task_code": "AL0001",
  "task_desc": "(AL) BENEFIT IN KIND - ACCOMMODATION",
  "remarks": "AD CODE: (AL) BENEFIT IN KIND - ACCOMMODATION"
}
```

Jika caller tidak yakin nama karyawan benar, jangan kirim `emp_name`; backend akan mencoba resolve nama dari `HR_EMPLOYEE.EmpName` berdasarkan `emp_code`/`nik`. Jangan mengisi `emp_name` dengan NIK numeric atau EmpCode.

Jika `ad_code` kosong untuk kategori selain `AUTO_BUFFER`, API akan menolak request dengan error `ADCode wajib diisi untuk manual adjustment selain auto buffer`.

---

## Endpoints

### 1. GET `/payroll/manual-adjustment/by-api-key`

Ambil data manual adjustment berdasarkan periode.

Endpoint ini adalah endpoint read-only utama untuk agent mengambil isi tabel
`extend_db_ptrj.dbo.payroll_manual_adjustments`. Jika `adjustment_type`
tidak dikirim, response berisi semua kategori yang tersimpan:

- `AUTO_BUFFER`
- `PREMI`
- `POTONGAN_KOTOR`
- `POTONGAN_BERSIH`
- `PENDAPATAN_LAINNYA`

Filter `division_code` menormalisasi format kode divisi 3-kode dan 4-kode
untuk data manual adjustment yang tersimpan dengan format berbeda. Contoh:
`P2A`, `PG2A`, dan `2A` akan mengambil gabungan row `P2A` + `PG2A`.
Alias yang didukung: `P1A/PG1A/1A`, `P1B/PG1B/1B`, `P2A/PG2A/2A`,
`P2B/PG2B/2B`, `AB1/ARB1`, `AB2/ARB2`, dan `ARC/AREC`.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `period_month` | string | ✅ | Bulan (1-12) |
| `period_year` | string | ✅ | Tahun (e.g. "2026") |
| `gang_code` | string | ❌ | Filter per gang |
| `emp_code` | string | ❌ | Filter per employee code |
| `division_code` | string | ❌ | Filter per division |
| `adjustment_type` | string | ❌ | Filter per type: `PREMI`, `POTONGAN_KOTOR`, `POTONGAN_BERSIH`, `PENDAPATAN_LAINNYA`, `AUTO_BUFFER`, `MANUAL` (alias = semua kecuali AUTO_BUFFER). Mendukung comma-separated, e.g. `PREMI,POTONGAN_KOTOR` |
| `adjustment_name` | string | ❌ | Filter per nama (partial match) |
| `view` | string | ❌ | Format response. Default `flat`. Pakai `grouped` untuk response siap auto input: division -> gang -> employee -> premiums/adjustments. |
| `metadata_only` | string | ❌ | Jika `true`, hanya ambil row yang memiliki `metadata_json`. Ini disarankan untuk data premi detail terbaru; row tanpa metadata adalah format lama. Alias: `has_metadata=true`. |

**Response Fields Penting untuk Agent:**

| Field | Makna |
|-------|-------|
| `emp_code` | Kode karyawan PTRJ/Plantware dari `HR_EMPLOYEE.EmpCode`, contoh `C0763`. Row lama bisa masih berisi NIK numeric, tetapi save baru harus memakai EmpCode PTRJ. |
| `emp_name` | Nama karyawan dari `HR_EMPLOYEE.EmpName` jika tersedia. Field ini bukan NIK. |
| `nik` | NIK/KTP karyawan dari `HR_EMPLOYEE.NewICNo` jika tersedia. |
| `gang_code` | Gang/asistensi asal row manual adjustment. Field ini wajib dipakai agent saat menampilkan atau mengelompokkan detail karyawan. |
| `estate` / `estate_code` | Kode estate/lokasi yang sebelumnya tersimpan sebagai `division_code` di DB, misalnya `AB1`, `P2A`, atau `PG2A`. |
| `division_code` | Kode divisi turunan dari `gang_code`: ambil 2 karakter awal gang lalu pisahkan spasi. Contoh `C2H` menjadi `C 2`, `G1H` menjadi `G 1`. |
| `adjustment_type` | Kategori row: `AUTO_BUFFER`, `PREMI`, `POTONGAN_KOTOR`, `POTONGAN_BERSIH`, atau `PENDAPATAN_LAINNYA`. |
| `adjustment_name` | Nama adjustment/kolom. |
| `ad_code` | ADCode terpisah. Diambil dari kolom `ad_code`/`base_task_code`/`task_code`; jika kosong akan diparse dari `remarks`, misalnya `AD CODE: AL0001 - ...` atau `PREMI | AL3PM0601P1A - ...`. |
| `ad_code_desc` | Deskripsi ADCode terpisah dari `task_desc` atau hasil parse `remarks`. |
| `amount` | Total nominal row adjustment di `payroll_manual_adjustments`. Untuk row yang punya `metadata_json`, field ini adalah agregat/total row, bukan detail transaksi tunggal. Jangan pakai field ini sebagai sumber auto input per subblok. |
| `remarks` | Catatan sinkronisasi/manual edit, termasuk ADCode jika ada. |
| `metadata_json` | JSON string detail input yang sudah dinormalisasi untuk response automation, misalnya detail `blok`, `exp`, `kendaraan`, atau `blok,exp`. Jangan anggap ini selalu sama persis dengan raw DB. |
| `metadata_json_raw` | Raw JSON string dari DB jika berbeda dari `metadata_json` response. Dipakai untuk audit/debug saja, bukan untuk auto input. |

**Terminologi identitas karyawan di codebase ini:**

| Istilah | Sumber | Makna |
|---------|--------|-------|
| `emp_code` | `HR_EMPLOYEE.EmpCode` | Kode karyawan internal PTRJ/Plantware, biasanya huruf + angka seperti `A0001`, `B0745`, `C0763`. Field ini yang dipakai untuk query payroll PTRJ seperti `PR_ADTRANS.EmpCode`. |
| `nik` | `HR_EMPLOYEE.NewICNo` | NIK/KTP numeric karyawan. Di beberapa flow lama nama field `nik` pernah dipakai untuk EmpCode internal, tetapi pada manual adjustment yang baru `nik` berarti NIK/KTP. |
| `emp_name` | `HR_EMPLOYEE.EmpName` | Nama karyawan, misalnya `BUDI TEST`. Ini bukan identifier dan bukan NIK. |

Catatan penting: saat menyimpan manual adjustment, backend me-resolve input `emp_code`/`nik` ke identitas HR lalu menyimpan `emp_code`, `nik`, dan `emp_name`. Namun kode `saveAdjustment()` masih memprioritaskan `emp_name` dari request sebelum nama hasil resolve HR. Jadi jika caller/agent mengirim NIK numeric di field `emp_name`, nilai itu bisa ikut tersimpan sebagai `emp_name`. Secara konsep data, itu salah isi payload; `emp_name` seharusnya nama dari `HR_EMPLOYEE.EmpName`, sementara NIK harus dikirim di field `nik`.

Catatan: endpoint data manual adjustment (`/manual-adjustment/by-api-key` dan `/manual-adjustment`) selalu mengembalikan `gang_code` pada setiap row data karyawan. Endpoint master opsi seperti `taskcode-options`, `automation-options`, dan `manual-adjustment-presets` bukan data karyawan, sehingga tidak memiliki `gang_code`.

#### `view=grouped` untuk Auto Input per Employee

Pakai `view=grouped` jika agent perlu menginput ulang/otomasi per nama orang. Response akan mengelompokkan data dari atas ke bawah:

```text
estate -> gang -> employee -> premiums/adjustments -> detail transaksi
```

Filter tetap sama seperti response flat. Query parameter `division_code` tetap berarti estate/lokasi sumber seperti `AB1`; pada response, `estate` menyimpan `AB1`, sedangkan `division_code` adalah hasil turunan dari `gang_code`.

Untuk auto input premi detail terbaru, gunakan:

```text
view=grouped&adjustment_type=PREMI&metadata_only=true
```

`metadata_only=true` membuang row lama yang tidak punya `metadata_json`. Alias yang sama: `has_metadata=true`.

**Kontrak penting untuk auto input detail transaksi:**

- Gunakan `employee.premium_transactions[]` sebagai sumber utama auto input. Satu item di array ini = satu detail transaksi dari `metadata_json`, misalnya satu subblok, satu kendaraan, atau satu expense.
- Jangan memakai `premiums[].amount`, `adjustments[].amount`, atau row flat `amount` sebagai detail transaksi. Field itu adalah total row di DB. Contoh `PREMI PRUNING` amount `504900` bisa berasal dari beberapa subblok di metadata.
- Untuk metadata `input_type = "blok"`, nilai per detail diambil dari `metadata_json.items[].jumlah`, lalu endpoint menampilkannya sebagai `premium_transactions[].jumlah` dan `premium_transactions[].amount`.
- Untuk field subblok, endpoint menormalisasi simbol: `subblok` hanya berisi huruf dan angka. Contoh `P09/01-A` menjadi `P0901A`. Jika nilai asli mengandung simbol, nilai aslinya tetap tersedia di `subblok_raw`.
- Untuk metadata `input_type = "kendaraan"`, `expense_code` di response dinormalisasi untuk kebutuhan input Plantware: nilainya menjadi `DRIVER` atau `HELPER`, bukan raw metadata seperti `TRANSPORT`. Ini berlaku di `metadata_json`, `metadata`, `detail_items`, dan `premium_transactions`. Nilai lama disimpan di `expense_code_raw`; sumber keputusan ada di `expense_code_source`.
- Untuk data lama tanpa `metadata_json`, endpoint tidak punya subblok/detail transaksi. Pakai `metadata_only=true` supaya automation hanya memproses data detail terbaru.
- Tree preview yang benar tidak berhenti di baris `Division | Gang | Employee | Type | Name | Amount`. Row seperti `AB1 | G1H | AHMAD DARYONO | PREMI | PREMI PRUNING | 504900` adalah total row; detail subbloknya harus dibaca dari `premium_transactions[]` atau `premiums[].detail_items[]`.

**Urutan auto input yang disarankan:**

```text
for each estate in data:
  for each gang in estate.gangs:
    for each employee in gang.employees:
      for each tx in employee.premium_transactions:
        input employee tx.adjustment_name tx.subblok/tx.expense_code/tx.kendaraan tx.amount
```

**Filter umum:**

```text
# Satu divisi, semua gang
period_month=4&period_year=2026&division_code=AB1&adjustment_type=PREMI&metadata_only=true&view=grouped

# Satu gang
period_month=4&period_year=2026&division_code=AB1&gang_code=G1H&adjustment_type=PREMI&metadata_only=true&view=grouped

# Satu employee
period_month=4&period_year=2026&emp_code=A0001&adjustment_type=PREMI&metadata_only=true&view=grouped
```

**Example Request:**

```bash
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=AB1&adjustment_type=PREMI&metadata_only=true&view=grouped" \
  -H "X-API-Key: ${API_KEY}"
```

**Response Shape:**

```json
{
  "success": true,
  "view": "grouped",
  "metadata_only": true,
  "count": 1,
  "summary": {
    "division_count": 1,
    "gang_count": 1,
    "employee_count": 1,
    "adjustment_count": 1
  },
  "data": [
    {
      "estate": "AB1",
      "estate_code": "AB1",
      "employee_count": 1,
      "gang_count": 1,
      "adjustment_count": 1,
      "premium_count": 1,
      "total_amount": 504900,
      "premium_total": 504900,
      "gangs": [
        {
          "gang_code": "G1H",
          "estate": "AB1",
          "estate_code": "AB1",
          "division_code": "G 1",
          "employee_count": 1,
          "adjustment_count": 1,
          "premium_count": 1,
          "employees": [
            {
              "emp_code": "A0001",
              "nik": "1902050504860001",
              "emp_name": "AHMAD DARYONO",
              "gang_code": "G1H",
              "estate": "AB1",
              "estate_code": "AB1",
              "division_code": "G 1",
              "adjustment_count": 1,
              "premium_count": 1,
              "total_amount": 504900,
              "premium_total": 504900,
              "premium_transactions": [
                {
                  "transaction_index": 1,
                  "adjustment_id": 1,
                  "adjustment_type": "PREMI",
                  "adjustment_name": "PREMI PRUNING",
                  "emp_code": "A0001",
                  "nik": "1902050504860001",
                  "emp_name": "AHMAD DARYONO",
                  "gang_code": "G1H",
                  "estate": "AB1",
                  "estate_code": "AB1",
                  "division_code": "G 1",
                  "ad_code": "AL3PM0601P1A",
                  "ad_code_desc": "PREMI PRUNING",
                  "detail_type": "blok",
                  "subblok": "P0901",
                  "subblok_raw": "P09/01",
                  "jumlah": 304000,
                  "amount": 304000
                },
                {
                  "transaction_index": 2,
                  "adjustment_id": 1,
                  "adjustment_type": "PREMI",
                  "adjustment_name": "PREMI PRUNING",
                  "emp_code": "A0001",
                  "nik": "1902050504860001",
                  "emp_name": "AHMAD DARYONO",
                  "gang_code": "G1H",
                  "estate": "AB1",
                  "estate_code": "AB1",
                  "division_code": "G 1",
                  "ad_code": "AL3PM0601P1A",
                  "ad_code_desc": "PREMI PRUNING",
                  "detail_type": "blok",
                  "subblok": "P0902",
                  "subblok_raw": "P09/02",
                  "jumlah": 200900,
                  "amount": 200900
                }
              ],
              "premiums": [
                {
                  "id": 1,
                  "adjustment_type": "PREMI",
                  "adjustment_name": "PREMI PRUNING",
                  "ad_code": "AL3PM0601P1A",
                  "ad_code_desc": "PREMI PRUNING",
                  "amount": 504900,
                  "metadata_json": "{\"input_type\":\"blok\",\"items\":[{\"subblok\":\"P09/01\",\"gang_code\":\"G1H\",\"jumlah\":304000},{\"subblok\":\"P09/02\",\"gang_code\":\"G1H\",\"jumlah\":200900}],\"total_amount\":504900}",
                  "metadata": {
                    "input_type": "blok",
                    "items": [
                      { "subblok": "P09/01", "gang_code": "G1H", "jumlah": 304000 },
                      { "subblok": "P09/02", "gang_code": "G1H", "jumlah": 200900 }
                    ],
                    "total_amount": 504900
                  },
                  "metadata_parse_error": null,
                  "detail_items": [
                    {
                      "detail_type": "blok",
                      "subblok": "P0901",
                      "subblok_raw": "P09/01",
                      "gang_code": "G1H",
                      "jumlah": 304000,
                      "amount": 304000
                    },
                    {
                      "detail_type": "blok",
                      "subblok": "P0902",
                      "subblok_raw": "P09/02",
                      "gang_code": "G1H",
                      "jumlah": 200900,
                      "amount": 200900
                    }
                  ]
                }
              ],
              "adjustments": [
                {
                  "id": 1,
                  "adjustment_type": "PREMI",
                  "adjustment_name": "PREMI PRUNING",
                  "ad_code": "AL3PM0601P1A",
                  "ad_code_desc": "PREMI PRUNING",
                  "amount": 504900,
                  "metadata_parse_error": null,
                  "detail_items": [
                    { "detail_type": "blok", "subblok": "P0901", "subblok_raw": "P09/01", "gang_code": "G1H", "jumlah": 304000, "amount": 304000 },
                    { "detail_type": "blok", "subblok": "P0902", "subblok_raw": "P09/02", "gang_code": "G1H", "jumlah": 200900, "amount": 200900 }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

Catatan response grouped:

- `premium_transactions` adalah daftar datar per detail transaksi dari seluruh premi employee tersebut. Ini field utama untuk auto input per subblok/kendaraan/expense.
- `premium_transactions[].amount` adalah nominal detail transaksi, sama dengan `jumlah` pada metadata jika metadata memakai field `jumlah`.
- `estate` / `estate_code` adalah estate/lokasi seperti `AB1`; jangan dibaca sebagai division Plantware.
- `division_code` di response adalah turunan dari `gang_code`, misalnya `C2H -> C 2` dan `G1H -> G 1`.
- `ad_code` dan `ad_code_desc` sudah dipisahkan dari `remarks`; automation tidak perlu parse string remarks lagi.
- `premiums` hanya berisi row `adjustment_type = "PREMI"` milik employee tersebut. `premiums[].amount` tetap total row.
- `adjustments` berisi semua row adjustment employee tersebut sesuai filter request. Jika request `adjustment_type=PREMI`, isinya sama dengan row premi.
- `metadata_json` adalah JSON string response yang sudah dinormalisasi. Untuk kendaraan, jangan sampai masih memakai raw `TRANSPORT`; nilai final harus `DRIVER` atau `HELPER`.
- `metadata_json_raw` berisi raw JSON string dari DB jika berbeda dari `metadata_json`; gunakan hanya untuk audit/debug.
- `metadata` adalah hasil parse dari metadata yang sudah dinormalisasi agar agent tidak perlu parse manual.
- `detail_items` adalah bentuk datar dari detail transaksi di `metadata`, tersedia di setiap row premium/adjustment.
- Row tanpa `metadata_json` dianggap data lama. Pakai `metadata_only=true` untuk fokus ke data detail terbaru saja.

**Bentuk metadata yang dipecah menjadi detail transaksi:**

| `metadata.input_type` | Sumber detail | Field nominal detail | Output di grouped response |
|-----------------------|---------------|----------------------|----------------------------|
| `blok` | `metadata.items[]` | `jumlah` atau `amount` | `premium_transactions[]` dengan `detail_type: "blok"`, `subblok` alphanumeric, `subblok_raw` jika asalnya mengandung simbol, `gang_code`, `jumlah`, `amount` |
| `kendaraan` | `metadata.items[]` | `jumlah` atau `amount` | `premium_transactions[]` dengan `detail_type: "kendaraan"`, `nomor_kendaraan`, `expense_code` final `DRIVER`/`HELPER`, `expense_code_raw` jika metadata lama berisi nilai seperti `TRANSPORT`, `expense_code_source`, `jumlah`, `amount` |
| `exp` | object metadata langsung atau `expense` | `amount`, `jumlah`, atau `total_amount` | `premium_transactions[]` dengan `detail_type: "exp"` plus field expense dari metadata |
| `blok,exp` | `metadata.blok_items[]` + `metadata.expense` | `jumlah` atau `amount` | Gabungan detail `blok` dan `exp` dalam satu `premium_transactions[]` employee |

Aturan normalisasi `expense_code` kendaraan:

1. Endpoint membaca role dari metadata item jika ada (`jabatan`, `role`, `position`, `job_title`).
2. Jika metadata tidak punya role, endpoint memakai `jabatan` employee dari lookup `employee_estate`/NIK.
3. Jika masih kosong, endpoint memakai `task_desc`/`ad_code_desc`/`remarks` sebagai fallback.
4. Teks `HELPER` menjadi `expense_code: "HELPER"`. Teks `DRIVER`, `OPERATOR`, `SOPIR`, atau `SUPIR` menjadi `expense_code: "DRIVER"`.

Halaman testing lokal untuk endpoint ini tersedia di:

```text
Browser Automation/manual-adjustment-grouped-tester.html
```

Halaman tersebut menyediakan dropdown sederhana untuk `view`, `division_code`, `gang_code`, `adjustment_type`, periode, dan field optional lain. Tree preview harus menampilkan employee lalu dropdown/detail subblok dari `metadata_json` (`premium_transactions[]`/`detail_items[]`), bukan hanya total row `amount`.

**Example:**

```bash
curl -X GET "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&gang_code=H1H" \
  -H "X-API-Key: 88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"
```

**Filter Examples:**

```bash
# Ambil semua kategori manual adjustment dalam satu division
# Termasuk AUTO_BUFFER, PREMI, POTONGAN_KOTOR, POTONGAN_BERSIH, PENDAPATAN_LAINNYA
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=AB1" \
  -H "X-API-Key: 88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"

# Ambil semua kategori untuk satu employee
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&emp_code=B0745" \
  -H "X-API-Key: 88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"

# Ambil detail satu employee dalam divisi 2A, tetap membawa gang_code
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=P2A&emp_code=C0763" \
  -H "X-API-Key: 88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"

# Filter by adjustment_type = AUTO_BUFFER only
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=AB1&adjustment_type=AUTO_BUFFER" \
  -H "X-API-Key: 88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"

# Filter by adjustment_type = PREMI only
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=AB1&adjustment_type=PREMI" \
  -H "X-API-Key: 88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"

# Filter koreksi/potongan kotor only
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=AB1&adjustment_type=POTONGAN_KOTOR" \
  -H "X-API-Key: 88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"

# Filter potongan upah bersih only
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=AB1&adjustment_type=POTONGAN_BERSIH" \
  -H "X-API-Key: 88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"

# Filter by adjustment_name (partial match - contains "SPSI")
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=AB1&adjustment_name=SPSI" \
  -H "X-API-Key: 88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"

# Filter by adjustment_name (contains "MASA")
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=AB1&adjustment_name=MASA" \
  -H "X-API-Key: 88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"

# Combined filters: division + type
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=AB1&adjustment_type=PREMI" \
  -H "X-API-Key: 88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"

# Filter MANUAL alias (semua kecuali AUTO_BUFFER: PREMI, POTONGAN_KOTOR, POTONGAN_BERSIH, PENDAPATAN_LAINNYA)
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=AB1&adjustment_type=MANUAL" \
  -H "X-API-Key: 88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"

# Filter comma-separated types (PREMI + POTONGAN_KOTOR)
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=AB1&adjustment_type=PREMI,POTONGAN_KOTOR" \
  -H "X-API-Key: 88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"

# Filter comma-separated (PREMI + POTONGAN_BERSIH)
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=AB1&adjustment_type=PREMI,POTONGAN_BERSIH" \
  -H "X-API-Key: 88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"

# Via proxy
curl -s "http://localhost/backend/upah/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=AB1&adjustment_name=SPSI" \
  -H "X-API-Key: 88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"

# Filter by specific AUTO_BUFFER names
# SPSI only
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=AB1&adjustment_name=SPSI" \
  -H "X-API-Key: 88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"

# MASA KERJA only
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=AB1&adjustment_name=MASA%20KERJA" \
  -H "X-API-Key: 88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"

# TUNJANGAN JABATAN only
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=AB1&adjustment_name=TUNJANGAN%20JABATAN" \
  -H "X-API-Key: 88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"

# POTONGAN PPH only
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=AB1&adjustment_name=POTONGAN%20PPH" \
  -H "X-API-Key: 88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"
```

**Response:**

```json
{
  "success": true,
  "count": 548,
  "data": [
    {
      "id": 10730,
      "period_month": 4,
      "period_year": 2026,
      "emp_code": "G0007",
      "gang_code": "G1H",
      "division_code": "AB1",
      "adjustment_type": "AUTO_BUFFER",
      "adjustment_name": "TUNJANGAN JABATAN",
      "amount": 0,
      "remarks": "TUNJANGAN JABATAN | tunjangan jabatan | 0",
      "created_by": "api_key_admin",
      "created_at": "2026-04-25T13:41:38.107Z"
    },
    {
      "id": 10731,
      "period_month": 4,
      "period_year": 2026,
      "emp_code": "G0007",
      "gang_code": "G1H",
      "division_code": "AB1",
      "adjustment_type": "AUTO_BUFFER",
      "adjustment_name": "MASA KERJA",
      "amount": 27000,
      "remarks": "MASA KERJA | masa kerja | 27000",
      "created_by": "api_key_admin",
      "created_at": "2026-04-25T13:41:38.160Z"
    },
    {
      "id": 10732,
      "period_month": 4,
      "period_year": 2026,
      "emp_code": "G0007",
      "gang_code": "G1H",
      "division_code": "AB1",
      "adjustment_type": "AUTO_BUFFER",
      "adjustment_name": "SPSI",
      "amount": 4000,
      "remarks": "SPSI | potongan spsi | 4000",
      "created_by": "api_key_admin",
      "created_at": "2026-04-25T13:41:38.187Z"
    },
    {
      "id": 10733,
      "period_month": 4,
      "period_year": 2026,
      "emp_code": "G0007",
      "gang_code": "G1H",
      "division_code": "AB1",
      "adjustment_type": "AUTO_BUFFER",
      "adjustment_name": "POTONGAN PPH",
      "amount": 93435,
      "remarks": "POTONGAN PPH | (DE) POTONGAN PPH21 | 93435",
      "created_by": "api_key_admin",
      "created_at": "2026-04-25T13:41:38.187Z"
    }
  ]
}
```

**Contoh Response Detail Employee dengan `gang_code`:**

```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "emp_code": "C0763",
      "emp_name": "INDAR JAYA ( SAHUTI )",
      "gang_code": "C1B",
      "division_code": "PG2A",
      "adjustment_type": "POTONGAN_KOTOR",
      "adjustment_name": "Koreksi Brondol",
      "amount": 3500,
      "remarks": "KOREKSI BRONDOL | DE0004 - (DE) POTONGAN PREMI | 3500 | sync:MANUAL | match:MANUAL"
    },
    {
      "emp_code": "C0763",
      "emp_name": "INDAR JAYA ( SAHUTI )",
      "gang_code": "C1B",
      "division_code": "PG2A",
      "adjustment_type": "POTONGAN_BERSIH",
      "adjustment_name": "POTONGAN LAINNYA POTONGAN TIKET",
      "amount": 749053,
      "remarks": "POTONGAN TIKET | DE0002 - (DE) POTONGAN HUTANG | 0 | sync:MISS | match:MISMATCH"
    },
    {
      "emp_code": "C0763",
      "emp_name": "INDAR JAYA ( SAHUTI )",
      "gang_code": "C1B",
      "division_code": "PG2A",
      "adjustment_type": "PREMI",
      "adjustment_name": "PREMI PRUNING",
      "amount": 266900,
      "remarks": "PREMI PRUNING | MANUAL EDIT | 266900 | sync:MANUAL | match:MANUAL"
    }
  ]
}
```

**Note:** GET endpoint mengembalikan semua adjustment_type termasuk `AUTO_BUFFER` dari seeder.

---

### 2. POST `/payroll/manual-adjustment/by-api-key`

Simpan manual adjustment baru atau update yang sudah ada (upsert berdasarkan unique key).

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `period_month` | number | ✅ | Bulan (1-12) |
| `period_year` | number | ✅ | Tahun |
| `nik` | string | ❌ | NIK/KTP numeric dari `HR_EMPLOYEE.NewICNo`; kirim jika tersedia |
| `emp_code` | string | ✅ | EmpCode PTRJ/Plantware dari `HR_EMPLOYEE.EmpCode`, contoh `C0001`; jangan isi dengan NIK |
| `emp_name` | string | ❌ | Nama karyawan dari `HR_EMPLOYEE.EmpName`; jangan isi dengan NIK/EmpCode |
| `gang_code` | string | ✅ | Gang code |
| `division_code` | string | ❌ | Division code |
| `adjustment_type` | string | ✅ | `PREMI`, `POTONGAN_KOTOR`, `POTONGAN_BERSIH`, `PENDAPATAN_LAINNYA`, `AUTO_BUFFER` |
| `adjustment_name` | string | ✅ | Nama adjustment |
| `amount` | number | ✅ | Jumlah nominal |
| `remarks` | string | ❌ | Catatan |

Rule identitas untuk save:

- Benar: `emp_code = "C0001"`, `nik = "1902050504860001"`, `emp_name = "BUDI TEST"`.
- Salah: `emp_name = "1902050504860001"` atau `emp_name = "C0001"`.
- Jika caller tidak yakin nama benar, jangan kirim `emp_name`; backend akan mencoba resolve dari `HR_EMPLOYEE`.

**Adjustment Types:**

| Type | Description |
|------|-------------|
| `PREMI` | Tunjangan bonus/premi tambahan |
| `POTONGAN_KOTOR` | Potongan dari upah kotor (koreksi) |
| `POTONGAN_BERSIH` | Potongan dari upah bersih |
| `PENDAPATAN_LAINNYA` | Pendapatan lain (THR, bonus, dll) |
| `AUTO_BUFFER` | Auto-generated Jabatan/Masa Kerja/SPSI/POTONGAN PPH (dari seeder) |

**Example:**

```bash
curl -X POST "http://localhost:8002/payroll/manual-adjustment/by-api-key" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: 88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a" \
  -d '{
    "period_month": 4,
    "period_year": 2026,
    "emp_code": "C0001",
    "nik": "1902050504860001",
    "emp_name": "BUDI TEST",
    "gang_code": "H1H",
    "division_code": "AB1",
    "adjustment_type": "PREMI",
    "adjustment_name": "BONUS LEBARAN",
    "amount": 500000,
    "remarks": "Bonus hari raya 2026"
  }'
```

**Response:**

```json
{
  "success": true,
  "id": 42,
  "message": "Manual adjustment saved successfully."
}
```

---

## Upsert Behavior

Manual adjustment menggunakan **upsert** — jika kombinasi berikut sudah ada, nilainya di-update:

- `period_month` + `period_year`
- employee identity match: resolved `emp_code`, resolved `nik`, atau original identifier legacy
- `adjustment_type`
- normalized `adjustment_name`

Jika belum ada, akan dibuat record baru.

---

## Cache

Setiap save/delete operation secara otomatis membersihkan cache payroll:

```
Pattern: :{period_month}:{period_year}
```

Ini memastikan data terbaru langsung dipakai pada request berikutnya.

---

## Error Responses

| Status | Message | Description |
|--------|---------|-------------|
| 400 | `period_month harus 1-12` | Bulan tidak valid |
| 400 | `period_year tidak valid` | Tahun tidak valid |
| 401 | `Unauthorized: invalid x-api-key` | API key tidak valid |
| 500 | `{error message}` | Error server |

---

## System Token Alternative

Jika `SYSTEM_TOKEN` dikonfigurasi di `.env`, bisa juga dipakai sebagai Bearer fallback:

```bash
# Menggunakan system token
curl -H "Authorization: Bearer system-internal-secret-token" \
     http://localhost:8002/payroll/divisions
```

---

## Auto Buffer Seeder

Seeder untuk generate otomatis adjustment tipe `AUTO_BUFFER`. Digunakan untuk mengisi `TUNJANGAN JABATAN`, `MASA KERJA`, `SPSI`, dan `POTONGAN PPH` secara otomatis dari data payroll.

Nilai `POTONGAN PPH` diambil dari field kalkulasi Daftar Upah `pph21_ter` (kolom UI `PPH21 TER`). Field `pot_pph21` hanya dipakai sebagai sumber pembanding/audit terhadap ADTRANS. Untuk row ini `ad_code`, `ad_desc`, dan `task_desc` harus sama: `(DE) POTONGAN PPH21`.

### Endpoint

```
POST /payroll/manual-adjustment/seed-auto-buffer
```

atau via proxy:

```
POST /backend/upah/payroll/manual-adjustment/seed-auto-buffer
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `period_month` | number | ✅ | Bulan (1-12) |
| `period_year` | number | ✅ | Tahun |
| `division_code` | string | ✅ | Kode divisi (e.g. `AB1`, `PG1A`) |
| `gang_code` | string | ❌ | Kode gang (default: `ALL`) |
| `replace_existing` | boolean | ❌ | Hapus existing auto buffer sebelum seed (default: `true`) |
| `use_history_db` | boolean | ❌ | Pakai history DB (default: `false`) |
| `snapshot_version` | number | ❌ | Snapshot version |
| `created_by` | string | ❌ | User creator (default: `system`) |

### Response

```json
{
  "success": true,
  "message": "Auto buffer berhasil disimpan ke payroll_manual_adjustments (AUTO_BUFFER): TUNJANGAN JABATAN, MASA KERJA, SPSI, POTONGAN PPH",
  "auto_buffer_items_per_employee": 4,
  "auto_buffer_adjustments": [
    {
      "adjustment_name": "TUNJANGAN JABATAN",
      "ad_code": "tunjangan jabatan",
      "ad_desc": "tunjangan jabatan",
      "task_desc": "tunjangan jabatan"
    },
    {
      "adjustment_name": "MASA KERJA",
      "ad_code": "masa kerja",
      "ad_desc": "masa kerja",
      "task_desc": "masa kerja"
    },
    {
      "adjustment_name": "SPSI",
      "ad_code": "potongan spsi",
      "ad_desc": "potongan spsi",
      "task_desc": "potongan spsi"
    },
    {
      "adjustment_name": "POTONGAN PPH",
      "ad_code": "(DE) POTONGAN PPH21",
      "ad_desc": "(DE) POTONGAN PPH21",
      "task_desc": "(DE) POTONGAN PPH21",
      "amount_source": "pph21_ter",
      "comparison_source": "pot_pph21"
    }
  ],
  "data": {
    "period_month": 4,
    "period_year": 2026,
    "division_code": "AB1",
    "gang_code": "ALL",
    "source_rows": 25,
    "seeded_entries": 100,
    "inserted": 100,
    "updated": 0,
    "deleted_existing": 0,
    "replace_existing": true,
    "value_priority_mode_source": "db_ptrj_only"
  }
}
```

---

## Manual Adjustment Sync Status Seeder

Seeder ini untuk update status `sync:` pada remarks manual adjustment secara massal setelah browser automation/input Plantware selesai. Ini mirip auto-buffer seeder dari sisi cara jalan, tetapi tidak membuat row baru; hanya mengubah segmen `sync:` pada `remarks`.

### Endpoint

```text
POST /payroll/manual-adjustment/seed-sync-status/by-api-key
```

atau route authenticated:

```text
POST /payroll/manual-adjustment/seed-sync-status
```

via proxy:

```text
POST /backend/upah/payroll/manual-adjustment/seed-sync-status/by-api-key
POST /backend/upah/payroll/manual-adjustment/seed-sync-status
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `period_month` | number | Yes | Bulan kalender/`PhyMonth`. |
| `period_year` | number | Yes | Tahun kalender/`PhyYear`. |
| `division_code` / `estate` | string | No | Batasi estate/divisi seperti `AB1`, `IJL`, `P1A`. Jika kosong, proses semua row yang masuk limit. |
| `gang_code` | string | No | Batasi gang tertentu. |
| `emp_code` | string | No | Batasi satu employee. |
| `adjustment_type` | string | No | Comma-separated type. Default: `PREMI,POTONGAN_KOTOR,POTONGAN_BERSIH,AUTO_BUFFER`. |
| `adjustment_types` | string[] | No | Alternatif array untuk `adjustment_type`. |
| `adjustment_name` | string | No | Batasi nama adjustment spesifik, misalnya `PREMI TBS` atau `KOREKSI PANEN`. |
| `sync_status` | string | No | Status target, default `SYNC`. |
| `only_if_adtrans_exists` | boolean | No | Default `true`. Jangan ubah menjadi `false` kecuali memang ingin force update tanpa verifikasi `PR_ADTRANS`. |
| `dry_run` | boolean | No | Default `false`. Pakai `true` untuk preview tanpa update DB. |
| `limit` | number | No | Batas row yang diproses, default dari service 1000, maksimum 5000. |
| `created_by` / `updated_by` | string | No | User pencatat update. |

### Cara Pakai Aman

Endpoint ini bisa dipakai untuk scope sempit atau luas:

- **Per divisi/estate**: isi `division_code`, misalnya `AB1`.
- **Per gang**: isi `division_code` + `gang_code`.
- **Per employee**: isi `division_code` + `emp_code`, atau pakai `ids` untuk row tertentu.
- **Seluruh divisi**: kosongkan `division_code`. Backend akan memproses semua row dalam periode yang masuk `limit`.
- **Disarankan untuk seluruh estate**: jalankan per divisi dalam loop/list. Ini lebih mudah diaudit karena setiap request punya `limit` maksimal 5000 dan response per divisi lebih kecil.

Seeder ini **selalu audit ulang row yang sudah `sync:SYNC`** selama row masuk filter. Jadi jika status lama `SYNC` tetapi target non-zero tidak punya transaksi pembanding di `db_ptrj.PR_ADTRANS` / `PR_ADTRANS_ARC`, row akan menjadi `sync:MISS | match:MISMATCH`. Jika transaksi ada tetapi total nominal berbeda, row akan menjadi `sync:DIFF | match:MISMATCH`. Jika target `0` dan tidak ada transaksi pembanding, total dianggap sama-sama `0`, jadi row tetap `sync:SYNC | match:MATCH`.

1. Jalankan dry-run per divisi dulu:

```bash
curl -s -X POST "http://localhost:8002/payroll/manual-adjustment/seed-sync-status/by-api-key" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "period_month": 4,
    "period_year": 2026,
    "division_code": "AB1",
    "adjustment_type": "PREMI,POTONGAN_KOTOR,POTONGAN_BERSIH,AUTO_BUFFER",
    "only_if_adtrans_exists": true,
    "dry_run": true
  }' | jq '.data | {matched_count, eligible_count, adtrans_matched_count, updated_count, unchanged_count, skipped_count}'
```

2. Review row bermasalah dari dry-run:

```bash
curl -s -X POST "http://localhost:8002/payroll/manual-adjustment/seed-sync-status/by-api-key" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "period_month": 4,
    "period_year": 2026,
    "division_code": "AB1",
    "dry_run": true
  }' | jq '.data.rows[]
    | select(.new_sync_status == "DIFF" or .new_sync_status == "MISS" or .skip_reason != null)
    | {id, emp_code, gang_code, adjustment_type, adjustment_name, old_sync_status, new_sync_status, match_status, target_amount, adtrans_amount, diff, adtrans_details, skip_reason}'
```

3. Jika hasil dry-run benar, apply per divisi:

```bash
curl -s -X POST "http://localhost:8002/payroll/manual-adjustment/seed-sync-status/by-api-key" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "period_month": 4,
    "period_year": 2026,
    "division_code": "AB1",
    "dry_run": false,
    "created_by": "agent_sync"
  }' | jq '.data | {matched_count, updated_count, unchanged_count, skipped_count}'
```

4. Untuk gang tertentu:

```bash
curl -s -X POST "http://localhost:8002/payroll/manual-adjustment/seed-sync-status/by-api-key" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "period_month": 4,
    "period_year": 2026,
    "division_code": "AB1",
    "gang_code": "G1H",
    "dry_run": true
  }' | jq '.data.rows[] | {id, emp_code, adjustment_name, new_sync_status, diff}'
```

5. Untuk satu employee:

```bash
curl -s -X POST "http://localhost:8002/payroll/manual-adjustment/seed-sync-status/by-api-key" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "period_month": 4,
    "period_year": 2026,
    "division_code": "AB1",
    "emp_code": "G0597",
    "dry_run": true
  }' | jq '.data.rows[] | {id, emp_code, adjustment_name, old_sync_status, new_sync_status, target_amount, adtrans_amount, diff}'
```

6. Untuk seluruh divisi dari API, kosongkan `division_code` dan set `limit`:

```bash
curl -s -X POST "http://localhost:8002/payroll/manual-adjustment/seed-sync-status/by-api-key" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "period_month": 4,
    "period_year": 2026,
    "adjustment_type": "PREMI,POTONGAN_KOTOR,POTONGAN_BERSIH,AUTO_BUFFER",
    "limit": 5000,
    "dry_run": true
  }' | jq '.data | {matched_count, eligible_count, adtrans_matched_count, updated_count, unchanged_count, skipped_count}'
```

7. Cara lebih aman untuk semua divisi: panggil per divisi dalam loop:

```powershell
$headers = @{
  "Content-Type" = "application/json"
  "X-API-Key" = $env:API_KEY
}

@("AB1","AB2","P1A","P1B","P2A","P2B","IJL","DME","ARA","ARC") | ForEach-Object {
  $body = @{
    period_month = 4
    period_year = 2026
    division_code = $_
    adjustment_type = "PREMI,POTONGAN_KOTOR,POTONGAN_BERSIH,AUTO_BUFFER"
    only_if_adtrans_exists = $true
    dry_run = $true
    limit = 5000
  } | ConvertTo-Json

  Invoke-RestMethod -Method Post `
    -Uri "http://localhost:8002/payroll/manual-adjustment/seed-sync-status/by-api-key" `
    -Headers $headers `
    -Body $body
}
```

8. Untuk type tertentu:

```bash
curl -s -X POST "http://localhost:8002/payroll/manual-adjustment/seed-sync-status/by-api-key" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "period_month": 4,
    "period_year": 2026,
    "division_code": "IJL",
    "adjustment_type": "PREMI",
    "adjustment_name": "PREMI TBS",
    "dry_run": true
  }' | jq '.data.rows[] | {id, emp_code, adjustment_name, status, old_sync_status, new_sync_status, match_status, diff}'
```

Untuk testing manual via browser, buka:

```text
Browser Automation/manual-adjustment-grouped-tester.html
```

Pilih `Audit sync vs db_ptrj`, jalankan `Dry Run Audit`, lalu filter `DIFF + MISS + skipped`. Tombol `Fill Risk EmpCodes` mengisi batch EmpCode yang pernah ditemukan bermasalah (`G0597`, `J0618`, `J0130`, `L0055`, `L0069`, `L0021`, `L0057`, `A0947`, `A0115`, `B0127`, `B0069`) agar bisa dicek ulang satu per satu terhadap `db_ptrj`.

### Response Ringkas

```json
{
  "success": true,
  "message": "Manual adjustment sync-status seeder checked 10 rows and updated 6",
  "data": {
    "seeder": "manual_adjustment_sync_status",
    "adjustment_types": ["PREMI", "POTONGAN_KOTOR", "POTONGAN_BERSIH", "AUTO_BUFFER"],
    "period_month": 4,
    "period_year": 2026,
    "target_sync_status": "SYNC",
    "only_if_adtrans_exists": true,
    "dry_run": false,
    "matched_count": 10,
    "eligible_count": 8,
    "adtrans_matched_count": 7,
    "updated_count": 6,
    "unchanged_count": 1,
    "skipped_count": 0,
    "partial_count": 0,
    "rows": []
  }
}
```

`rows[].new_sync_status`, `rows[].match_status`, dan `rows[].diff` penting untuk debugging hasil audit. `skip_reason` hanya muncul jika format remarks tidak bisa diubah.

Interpretasi status:

| `new_sync_status` | Arti |
|-------------------|------|
| `SYNC` | Transaksi pembanding ditemukan di `db_ptrj` dan total nominal sama dengan target amount. |
| `DIFF` | Transaksi pembanding ditemukan, tetapi total nominal berbeda. Cek `diff` dan `adtrans_details`. |
| `MISS` | Target non-zero tidak punya transaksi pembanding yang cocok di `db_ptrj`. Ini harus dianggap masalah walaupun `old_sync_status` sebelumnya `SYNC`. Target `0` tanpa transaksi pembanding tetap `SYNC`. |

| `skip_reason` | Arti |
|----------------|------|
| `SYNC_SEGMENT_NOT_FOUND` | Remarks tidak punya segmen `sync:` atau `match:` sehingga tidak diubah. |

---

## Remarks Format for Auto Buffer

Setiap auto buffer entry memiliki remarks dengan format konsisten:

```
TUNJANGAN JABATAN | tunjangan jabatan | {amount}
MASA KERJA | masa kerja | {amount}
SPSI | potongan spsi | {amount}
POTONGAN PPH | (DE) POTONGAN PPH21 | {amount}
```

Format: `{adjustment_name} | {adcode} | {amount}`

### Adcode Mapping

| Adjustment Name | Adcode | Description |
|-----------------|--------|-------------|
| `TUNJANGAN JABATAN` | `tunjangan jabatan` | Jabatan allowance |
| `MASA KERJA` | `masa kerja` | Masa kerja allowance |
| `SPSI` | `potongan spsi` | SPSI deduction |
| `POTONGAN PPH` | `(DE) POTONGAN PPH21` | PPh21 deduction; amount source `pph21_ter` / UI `PPH21 TER` |

### Example

```
TUNJANGAN JABATAN | tunjangan jabatan | 200000
MASA KERJA | masa kerja | 150000
SPSI | potongan spsi | 4000
POTONGAN PPH | (DE) POTONGAN PPH21 | 93435
```

---

## Proxy / Base URL Configuration

Backend bisa diakses via direct atau proxy path tergantung deployment:

### Direct Access (localhost / LAN IP)

```
http://localhost:8002
http://10.0.0.128:8002
```

### Via Reverse Proxy

```
http://{proxy_host}/backend/upah
```

Proxy prefix `/backend/upah` akan di-strip oleh middleware (aktifkan `USE_PROXY=true` di `.env`).

### Contoh Complete dengan Semua Base URL

```bash
API_KEY="88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"

# ===== DIRECT ACCESS =====
# Localhost
curl -X POST "http://localhost:8002/payroll/manual-adjustment/seed-auto-buffer" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"period_month":4,"period_year":2026,"division_code":"AB1"}'

# LAN IP
curl -X POST "http://10.0.0.128:8002/payroll/manual-adjustment/seed-auto-buffer" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"period_month":4,"period_year":2026,"division_code":"AB1"}'

# ===== VIA PROXY =====
# Local proxy
curl -X POST "http://localhost/backend/upah/payroll/manual-adjustment/seed-auto-buffer" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"period_month":4,"period_year":2026,"division_code":"AB1"}'

# Remote proxy
curl -X POST "http://10.0.0.128/backend/upah/payroll/manual-adjustment/seed-auto-buffer" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"period_month":4,"period_year":2026,"division_code":"AB1"}'

# Sync-status seeder via API key
curl -X POST "http://localhost:8002/payroll/manual-adjustment/seed-sync-status/by-api-key" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"period_month":4,"period_year":2026,"division_code":"AB1","dry_run":true}'

# ===== GET DATA =====
# Ambil data adjustment via proxy
curl -s "http://localhost/backend/upah/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=AB1" \
  -H "X-API-Key: ${API_KEY}"
```

### Endpoint dengan Proxy Path

| Direct Path | Proxy Path |
|-------------|------------|
| `/payroll/manual-adjustment/by-api-key` | `/backend/upah/payroll/manual-adjustment/by-api-key` |
| `/payroll/manual-adjustment/seed-auto-buffer` | `/backend/upah/payroll/manual-adjustment/seed-auto-buffer` |
| `/payroll/manual-adjustment/seed-sync-status` | `/backend/upah/payroll/manual-adjustment/seed-sync-status` |
| `/payroll/manual-adjustment/seed-sync-status/by-api-key` | `/backend/upah/payroll/manual-adjustment/seed-sync-status/by-api-key` |

---

## Reference: DocDesc, TaskCode, TaskDesc Patterns

### Sumber Data

Data premi dan potongan berasal dari tabel **PR_ADTRANS** dan **PR_ADTRANSLN**:
- **Header**: PR_ADTRANS (mengandung DocDesc)
- **Detail**: PR_ADTRANSLN (mengandung Amount)

Data lembur berasal dari **PR_TASKREGLN** (OT=1) dan **PR_TASKCODE**.

---

### DocDesc untuk PREMI

**Query Pattern:**
```sql
WHERE UPPER(t.DocDesc) LIKE '%PREMI%'
  AND UPPER(t.DocDesc) NOT LIKE '%PPH%'  -- exclude PPH
  AND UPPER(t.DocDesc) NOT LIKE '%ADJ%'  -- exclude adjustment
```

| DocDesc Pattern | Normalized Key | Category | Notes |
|-----------------|----------------|----------|-------|
| `PREMI PANEN AL` | `premi_panen_al` | PREMI_PANEN | Air Larangan harvest |
| `PREMI PANEN BRONDOL` | `premi_brondol` | PREMI_BRONDOL | Brondol loose fruit |
| `PREMI PRUNING` | `premi_pruning` | PREMI_PRUNING | Pruning作业 |
| `PREMI INSENTIF` | `premi_insentif` | PREMI_INSENTIF | Insentif Panen |
| `PREMI KINERJA` | `premi_kinerja` | PREMI_KINERJA | Kinerja bonus |
| `PREMI PPH` | `premi_pph` | SPECIAL | Ditambahkan ke upah_bersih (bukan potongan) |
| `TUNJANGAN PREMI ...` | dynamic | PREMI | Dynamic premi dengan prefix |

**Excluded dari PREMI (tidak masuk calculation):**
- `PPH`, `PPH21`, `PPh21` → PPh21 tax (calculated terpisah)
- `LEMBUR` → Overtime (dari PR_TASKREGLN)
- `BRONDOL` → Sudah masuk `premi_brondol`
- `PRUN`, `PRUNING` → Sudah masuk `premi_pruning`
- `KOREKSI`, `KOREKSI PANEN`, `POTONGAN KOREKSI` → Koreksi (handled terpisah)
- `SPSI`, `IURAN SPSI` → Union dues (potongan)
- `TUNJANGAN JABATAN`, `TUNJANGAN MASA KERJA`, `TUNJANGAN BERAS` → Tunjangan (bukan premi)

---

### DocDesc untuk POTONGAN (Deductions)

**Query Pattern:**
```sql
WHERE ln.Amount < 0  -- negative = deduction
  AND UPPER(t.DocDesc) NOT LIKE 'POT%'     -- exclude koreksi
  AND UPPER(t.DocDesc) NOT LIKE '%PPH%'    -- exclude PPH
  AND UPPER(t.DocDesc) NOT LIKE 'SPSI'      -- exclude SPSI
  AND UPPER(t.DocDesc) NOT LIKE 'BERAS'     -- exclude beras
  AND UPPER(t.DocDesc) NOT LIKE 'JABATAN'   -- exclude jabatan
  AND UPPER(t.DocDesc) NOT LIKE 'MASA%'     -- exclude masa kerja
  AND UPPER(t.DocDesc) NOT LIKE 'LEMBUR%'  -- exclude lembur
```

| DocDesc Pattern | Normalized Key | Description |
|-----------------|----------------|-------------|
| `PPH21`, `POTONGAN PPH21`, `PPh21` | `pot_pph21` | PPh21 tax (via TER calculation) |
| `BPJS KESEHATAN` | `pot_bpjs_kesehatan` | Health insurance |
| `BPJS PENSIUN` | `pot_bpjs_pensiun` | Pension insurance |
| `SPSI`, `IURAN SPSI` | `pot_spsi` | Union dues (fixed Rp 4,000/bulan) |
| `KOREKSI*`, `POT KOREKSI*` | `pot_koreksi` | Correction deductions |
| `POTONGAN LAIN-LAIN` | `pot_lain` | Other deductions |
| `PINJAMAN KOPERASI` | `pot_pinjaman` | Loan deductions |

**Koreksi Special Handling:**
- DocDesc LIKE `POT%` → `pot_koreksi`
- DITAMBAHKAN ke `jumlah_upah_kotor` (untuk tampilan)
- TIDAK masuk `total_potongan` (untuk avoid double deduction)

---

### TaskCode dan TaskDesc untuk LEMBUR (Overtime)

**Sumber:** PR_TASKREGLN (OT=1) + PR_TASKCODE

**Query Pattern:**
```sql
-- Active Table
SELECT l.EmpCode, l.TrxDate, l.Hours, l.TaskCode, l.Amount, l.Rate
FROM PR_TASKREGLN l
JOIN PR_TASKREG m ON l.MasterID = m.ID
JOIN PR_TASKCODE tc ON l.TaskCode = tc.TaskCode
WHERE l.EmpCode = ? AND l.TrxDate >= ? AND l.TrxDate <= ? AND l.OT = 1

UNION ALL

-- Archive Table
SELECT l.EmpCode, l.TrxDate, l.Hours, l.TaskCode, l.Amount, l.Rate
FROM PR_TASKREGLN_ARC l
JOIN PR_TASKREG_ARC m ON l.MasterID = m.ID
JOIN PR_TASKCODE tc ON l.TaskCode = tc.TaskCode
WHERE l.EmpCode = ? AND l.TrxDate >= ? AND l.TrxDate <= ? AND l.OT = 1
```

**Struktur Record Lembur:**

```typescript
interface LemburRecord {
    trx_date: string;      // Tanggal transaksi (YYYY-MM-DD)
    task_code: string;     // Kode task dari PR_TASKCODE
    task_desc: string;     // Deskripsi task dari PR_TASKCODE
    day_type: string;      // "Hari Kerja", "Jumat", "Minggu", "Libur Umum", "Libur Keagamaan"
    hours: number;         // Jumlah jam lembur
    rate: number;          // Rate total (weighted average dari tier)
    amount: number;        // Jumlah (hours × UPJ × tier rates)
}
```

**Day Type Classification:**

| Day Type | Description | Tier 1 Rate | Tier 2 Rate | Tier 3 Rate | Tier 1 Boundary |
|----------|-------------|-------------|-------------|-------------|-----------------|
| `WORKDAY_LONG` | Mon-Thu, Sat | 1.5x | 2x | - | 1 hour |
| `WORKDAY_SHORT` | Friday | 1.5x | 2x | - | 1 hour |
| `SUNDAY` | Sunday | 2x | 3x | 4x | 5/7 hours |
| `HOLIDAY_REGULAR` | Non-religious holiday | 2x | 3x | 4x | 5/7 hours |
| `HOLIDAY_RELIGIOUS` | Religious holiday | 3x | 4x | 4x | 5/7 hours |

**Common TaskCode Patterns:**

| TaskCode | TaskDesc | Category |
|----------|----------|----------|
| `GA9115` | (Associated with PPH) | Tax |
| `GA9112` | (Associated with SPSI) | Union |
| `PANEN` | Panen Manual | Harvest |
| `PUPUK` | Aplikasi Pupuk | Fertilizer |
| `SEMprot` | Penyemprotan | Spraying |
| `ROGNU` | Rogaming | Weeding |

**Note:** TaskCode bervariasi tergantung pekerjaan overtime yang dilakukan. Gunakan endpoint `/payroll/report/division-raw-tree` untuk mendapatkan data aktual.

---

### Tunjangan (Allowances) - Bukan Premi

Tunjangan adalah komponen Gaji Pokok, bukan premi:

| DocDesc Pattern | Normalized Key | Description |
|-----------------|----------------|-------------|
| `TUNJANGAN JABATAN` | `tunjangan_jabatan` | Jabatan allowance |
| `TUNJANGAN MASA KERJA` | `tunjangan_masa_kerja` | Masa kerja allowance |
| `TUNJANGAN BERAS` | `tunjangan_beras` | Rice allowance |
| `LEMBUR` | `lembur_jumlah` | Overtime (from PR_ADTRANS) |

**AUTO_BUFFER Seeder Menggenerate:**
- `TUNJANGAN JABATAN` → dari `tunjangan jabatan`
- `MASA KERJA` → dari `masa kerja`
- `SPSI` → dari `potongan spsi` (Rp 4,000)
- `POTONGAN PPH` → dari kalkulasi Daftar Upah `pph21_ter` / kolom UI `PPH21 TER`

---

### TaskCode Reference (Payroll Components) - ACTUAL DATA

Data actual dari database `PR_TASKCODE` dan `PR_ADTRANS`:

#### TaskCode untuk Cuti (Leave) - GA912x Series

| TaskCode Prefix | Leave Type | TaskDesc |
|----------------|------------|----------|
| `GA9129%` | Cuti Tahunan | `(AL) PERSONNEL ANNUAL LEAVE` |
| `GA9126%` | Cuti Sakit/Haid | `(AL) PERSONNEL SICK LEAVE` |
| `GA9127%` | Cuti Minggu | - |
| `GA9128%` | Cuti Nasional | `(AL) PERSONNEL TUNJANGAN JABATAN` |

#### TaskCode untuk Accounting/Tunjangan (Dari PR_TASKCODE)

| TaskCode | TaskDesc | Usage |
|----------|----------|-------|
| `GA9110` | `PERSONNEL - SALARIES & WAGES - LOCAL` | Gaji Pokok |
| `GA9111` | `BIAYA RAPEL` | Rapel |
| `GA9116` | `(AL)Tunjangan Hari Raya` | THR |
| `GA9118` | `RAWAT GUEST HOUSE` | Guest house |
| `GA9126` | `(AL) PERSONNEL SICK LEAVE` | Cuti Sakit |
| `GA9128` | `(AL) PERSONNEL TUNJANGAN JABATAN` | Tunjangan Jabatan |
| `GA9129` | `(AL) PERSONNEL ANNUAL LEAVE` | Cuti Tahunan |
| `GA9228` | `SUNDRY EXPENSES` | Expenses |
| `GA9234` | `UPKEEP OF BUILDINGS` | Building maintenance |
| `GA9237` | `UPKEEP OF MOTOR VEHICLE` | Vehicle maintenance |
| `AL0013` | `MONTHLY WAGES` | Gaji Bulanan |
| `AL0014` | `(AL) TUNJANGAN BERAS` | Tunjangan Beras |
| `AL0019` | `(AL) TUNJANGAN LEMBUR` | Tunjangan Lembur |
| `ALBPJS` | `(ME) BPJS - WORKERS (EMPLOYER)` | BPJS |
| `ALJHT` | `(ME) JHT - WORKERS (EMPLOYER)` | JHT |
| `ALJK` | `(ME) JK - WORKERS (EMPLOYER)` | JK |
| `ALJKK` | `(ME) JKK - WORKERS (EMPLOYER)` | JKK |
| `ALJP` | `(ME) JP - WORKERS (EMPLOYER)` | JP |

---

### DocDesc ACTUAL dari Database (PR_ADTRANS + PR_ADTRANS_ARC)

**Query untuk melihat semua DocDesc:**
```bash
# Menggunakan SQL Gateway API via proxy
curl -X POST "http://10.0.0.110:3001/query" \
  -H "Content-Type: application/json" \
  -H "x-api-key: 2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6" \
  -d '{"sql": "SELECT DISTINCT DocDesc FROM PR_ADTRANS_ARC ORDER BY DocDesc", "server": "SERVER_PROFILE_2", "database": "db_ptrj"}'
```

#### DocDesc untuk PREMI (Actual Variations)

| DocDesc Pattern | Normalized Key | Notes |
|----------------|----------------|-------|
| `PREMI HARVESTING` | dynamic | Harvesting premium |
| `PREMI TUNJANGAN HARVESTING` | dynamic | Tunjangan harvesting premium |
| `TUNJANGAN PREMI HARVESTING` | dynamic | Tunjangan harvesting |
| `PREMI PANEN` | dynamic | Panen premium |
| `Premi Harvesting` | dynamic | (various spellings) |
| `PREMI BRONDOL` | `premi_brondol` | Brondol premium |
| `Premi Brondolan` | `premi_brondol` | (various spellings) |
| `PREMI PRUNING` | `premi_pruning` | Pruning premium |
| `Premi Prunning` | `premi_pruning` | (various spellings) |
| `PREMI INSENTIF` | `premi_insentif` | Insentif premium |
| `Premi Insentif Panen` | `premi_insentif` | (various spellings) |
| `PREMI KINERJA` | `premi_kinerja` | Kinerja premium |
| `PREMI ANGKUT TBS` | dynamic | Angkut TBS premium |
| `PREMI ANGKUT PUPUK` | dynamic | Angkut pupuk premium |
| `PREMI TRANSPORT` | dynamic | Transport premium |
| `PREMI TBS` | dynamic | TBS premium |
| `PREMI CUCI UNIT` | dynamic | Cuci unit premium |
| `PREMI GENSET` | dynamic | Genset premium |
| `PREMI JAGA GENSET` | dynamic | Jaga genset premium |
| `PREMI OPERATOR` | dynamic | Operator premium |
| `PREMI LOADING` | dynamic | Loading premium |
| `PREMI RITASE` | dynamic | Ritase premium |
| `PREMI RETASE` | dynamic | Retase premium |
| `PREMI SIRTU` | dynamic | Sirtu premium |
| `PREMI BENGKEL` | dynamic | Bengkel premium |
| `PREMI POKOK TINGGI` | dynamic | Pokok tinggi premium |
| `PREMI MANDOR PANEN` | dynamic | Mandor panen premium |
| `PREMI KRANI PANEN` | dynamic | Krani panen premium |
| `PREMI TANGGUNG JAWAB` | dynamic | Tanggung jawab premium |
| `TUNJANGAN PREMI` | dynamic | Tunjangan premium |
| `TUNJANGAN PREMI PRUNING` | dynamic | Tunjangan pruning |
| `TUNJANGAN PREMI PUPUK` | dynamic | Tunjangan pupuk |
| `TUNJANGAN PREMI TRANSPORT` | dynamic | Tunjangan transport |
| `TUNJANGAN PREMI BRONDOL` | dynamic | Tunjangan brondol |
| `TUNJANGAN PREMI KINERJA` | dynamic | Tunjangan kinerja |
| `TUNJANGAN PREMI BIBIT` | dynamic | Bibit premium |
| `TUNJANGAN PREMI BLOWER` | dynamic | Blower premium |
| `TUNJANGAN PREMI ANGKUT TBS` | dynamic | Angkut TBS |
| `TUNJANGAN PREMI ANGKUT PUPUK` | dynamic | Angkut pupuk |
| `TUNJANGAN PREMI BIG BUCKET` | dynamic | Big bucket |
| `(AL) TUNJANGAN PREMI ((PM) HARVESTING LABOUR - HARVESTING)` | dynamic | Harvesting labour |

#### DocDesc untuk POTONGAN (Actual Variations)

| DocDesc Pattern | Normalized Key | Notes |
|----------------|----------------|-------|
| `PPH21` | `pot_pph21` | PPh21 |
| `PPH 21` | `pot_pph21` | PPh21 (with space) |
| `POTONGAN PPH21` | `pot_pph21` | Potongan PPh21 |
| `POTONGAN PPH 21` | `pot_pph21` | Potongan PPh21 (with space) |
| `POTONGAN SPSI` | `pot_spsi` | Potongan SPSI |
| `SPSI` | `pot_spsi` | SPSI |
| `POTONGAN PREMI` | `pot_premi` | Potongan premi |
| `POTONGAN HARVESTING` | `pot_premi` | Potongan harvesting |
| `POTONGAN BRONDOL` | `pot_brondol` | Potongan brondol |
| `POTONGAN BERAS` | `pot_beras` | Potongan beras |
| `POTONGAN MASA KERJA` | `pot_masa_kerja` | Potongan masa kerja |
| `POTONGAN GAJI` | `pot_gaji` | Potongan gaji |
| `POTONGAN TIKET` | `pot_tiket` | Potongan tiket |
| `POTONGAN PINJAMAN` | `pot_pinjaman` | Potongan pinjaman |
| `POTONGAN HUTANG` | `pot_hutang` | Potongan hutang |
| `POTONGAN IURAN SPSI` | `pot_spsi` | Iuran SPSI |
| `POTONGAN  SPSI` | `pot_spsi` | (extra space) |
| `POTONGAN ALAT` | `pot_alat` | Potongan alat |
| `POTONGAN BIAYA TIKET` | `pot_tiket` | Biaya tiket |
| `POTONGAN BPJS` | `pot_bpjs` | Potongan BPJS |
| `POTONGAN PENSIUN` | `pot_pensiun` | Potongan pensiun |
| `POTONGAN LEBIH HK` | dynamic | Lebih HK |
| `POTONGAN KOREKSI` | `pot_koreksi` | Koreksi |
| `POTONGAN EXGRATIA PP21` | dynamic | Ex-gratia |
| `POTONGAN EXGRATIA PPH21` | dynamic | Ex-gratia PPh21 |

#### TaskCode untuk LEMBUR (Overtime) - OT=1 Transactions

Dari `PR_TASKREGLN WHERE OT = 1`, TaskCode yang paling sering digunakan:

| TaskCode | TaskDesc | Division | Usage Count |
|----------|----------|---------|-------------|
| `PT2340ARC` | `(PM) DRIVER` | ARC | 295 |
| `PT2341ARC` | `(PM) HELPER` | ARC | 243 |
| `PT2340P1A` | `(PM) DRIVER` | P1A | 156 |
| `PT2340P2A` | `(PM) DRIVER` | P2A | 132 |
| `PT2340AB1` | `(PM) DRIVER` | AB1 | 126 |
| `PT2341P2A` | `(PM) HELPER` | P2A | 120 |
| `PM2301ARC` | `(PM) LOADING` | ARC | 111 |
| `PT2341AB1` | `(PM) HELPER` | AB1 | 98 |
| `PT2340P2B` | `(PM) DRIVER` | P2B | 97 |
| `PT2340ARA` | `(PM) DRIVER` | ARA | 96 |
| `PT2341P2B` | `(PM) HELPER` | P2B | 90 |
| `GA9234P1A` | `UPKEEP OF BUILDINGS` | P1A | 88 |
| `PT2340AB2` | `(PM) DRIVER` | AB2 | 82 |
| `PT2340DME` | `(PM) DRIVER` | DME | 113 |
| `GA9110AB2` | `PERSONNEL - SALARIES & WAGES - LOCAL` | AB2 | 60 |

**Pattern TaskCode Lembur:**
- `PT2340` + Division = DRIVER (e.g., `PT2340ARC`, `PT2340P1A`)
- `PT2341` + Division = HELPER (e.g., `PT2341ARC`, `PT2341P1A`)
- `PM2301` + Division = LOADING (e.g., `PM2301ARC`, `PM2301ARA`)
- `GA9234` + Division = UPKEEP OF BUILDINGS

#### Special TaskCode Patterns

| TaskCode | TaskDesc | Notes |
|---------|---------|-------|
| `AL3CL3310` | `ACCRUALS-CHECKROLL` | Premi PPH (Tax) |
| `CL3310` | `ACCRUALS - CHECKROLL` | Accruals checkroll |
| `DE0004` | `(DE) POTONGAN PREMI` | Potongan premi |
| `DE0005` | `(DE) POTONGAN SPSI` | Potongan SPSI |
| `DEBPJS` | `(DE) BPJS - WORKERS (EMPLOYEE)` | BPJS employee |
| `DEJHT` | `(DE) JHT - WORKERS (EMPLOYEE)` | JHT employee |
| `DEJP` | `(DE) JP - WORKERS (EMPLOYEE)` | JP employee |
| `DEPH21` | `(DE) POTONGAN PPH21` | PPh21 employee |

Untuk auto buffer `POTONGAN PPH`, nilai display yang dikirim ke automation/Plantware harus konsisten:

```json
{
  "ad_code": "(DE) POTONGAN PPH21",
  "ad_desc": "(DE) POTONGAN PPH21",
  "task_desc": "(DE) POTONGAN PPH21",
  "task_descs": ["(DE) POTONGAN PPH21"]
}
```

---

### Kategori Premi dari Database (Summary)

**Dari `PR_ADTRANS_ARC` - Distinct DocDesc containing PREMI:**

| Category | Example DocDesc |
|----------|----------------|
| **HARVESTING** | `PREMI HARVESTING`, `PREMI TUNJANGAN HARVESTING`, `TUNJANGAN PREMI HARVESTING`, `Premi Harvesting`, `PREMI HARVESTING LABOUR`, `PREMI HERVESTING` |
| **BRONDOL** | `PREMI BRONDOL`, `Premi borondolan`, `PREMI BRONDOLAN`, `PREMI BRONDOL PLASMA...` |
| **PRUNING** | `PREMI PRUNING`, `Premi Prunning`, `PRUNING`, `PRUNIG`, `TUNJANGAN PREMI PRUNING` |
| **INSENTIF/PANEN** | `PREMI INSENTIF`, `Premi Insentif Panen`, `INSENTIF PREMI`, `PREMI ISENTIF`, `PREMI INCENTIVE PANEN`, `Premi Iisentif Panen` |
| **KINERJA** | `PREMI KINERJA`, `Premi kinerja`, `TUNJANGAN PREMI KINERJA` |
| **ANGKUT** | `PREMI ANGKUT TBS`, `PREMI ANGKUT PUPUK`, `TUNJANGAN PREMI ANGKUT TBS`, `TUNJANGAN PREMI ANGKUT PUPUK`, `PREMI ANGKUT PC` |
| **TBS** | `PREMI TBS`, `PREMI TBS ARE A`, `PREMI TBS PLASMA`, `PREMI TBS INTI` |
| **TRANSPORT** | `PREMI TRANSPORT`, `PREMI TRANSPORTASI`, `TUNJANGAN PREMI TRANSPORT` |
| **RITASE** | `PREMI RITASE`, `PREMI RETASE`, `TUNJANGAN PREMI RITASE` |
| **LOADING** | `PREMI LOADING`, `PREMI LOADING PUPUK` |
| **JABATAN** | `PREMI JABATAN`, `TUNJANGAN PREMI JABATAN` |
| **MANDOR/KERANI** | `PREMI MANDOR PANEN`, `PREMI KRANI PANEN`, `Premi Insentif Mandor` |
| **LAINNYA** | `PREMI GENSET`, `PREMI JAGA GENSET`, `PREMI OPERATOR`, `PREMI BENGKEL`, `PREMI BAG`, `PREMI CUCI UNIT` |

---

### Kategori Potongan dari Database (Summary)

| Category | Example DocDesc |
|----------|----------------|
| **PPH21** | `PPH21`, `PPH 21`, `PPH-21`, `PPH12`, `POTONGAN PPH21`, `POTONGAN PPH 21`, `POTONGAN PPH21 THR`, `POTONGAN PPH21 EXGRATIA` |
| **SPSI** | `SPSI`, `POTONGAN SPSI`, `POTONGAN IURAN SPSI`, `(DE) POTONGAN SPSI` |
| **PREMI** | `POTONGAN PREMI`, `POTONGAN PREMI HARVESTING`, `POTONGAN PREMI BRONDOL`, `POTONGAN PREMI TBS`, `POTONGAN PREMI ANGKUT` |
| **BRONDOL** | `POTONGAN BRONDOL`, `POTONGAN BRONDOL KONTANAN`, `POTONGAN BRONDOLAN KONTANAN` |
| **BERAS** | `POTONGAN BERAS`, `POTONGAN DUIT BERAS` |
| **GAJI** | `POTONGAN GAJI`, `POTONGAN GAJI 75%`, `POTONGAN 75% DARI GAJI` |
| **TIKET** | `POTONGAN TIKET`, `POTONGAN BIAYA TIKET`, `POTONGAN UANG TIKET` |
| **PINJAMAN** | `POTONGAN PINJAMAN`, `POTONGAN PINJAMAM`, `POTONGAN PINJAMAN UANG` |
| **KOREKSI** | `POTONGAN KOREKSI`, `KOREKSI`, `KOREKSI PANEN`, `KOREKSI BRONDOL`, `KOREKSI INTI` |
| **LEMBUR** | `POTONGAN LEMBUR`, `POTONGAN OT`, `KEKURANGAN LEMBUR`, `PENGEMBALIAN LEMBUR` |
| **LAINNYA** | `POTONGAN ALAT`, `POTONGAN ALAT KERJA`, `POTONGAN CUTI SAKIT`, `POTONGAN MASA KERJA`, `POTONGAN CS BERKEPANJANGAN` |

---

### Query Reference untuk Automation

**Get all unique DocDesc dari archive:**
```sql
SELECT DISTINCT DocDesc 
FROM PR_ADTRANS_ARC 
WHERE DocDesc IS NOT NULL 
  AND DocDesc != ''
ORDER BY DocDesc
```

**Get all TaskCode yang digunakan untuk Lembur (OT=1):**
```sql
SELECT DISTINCT tr.TaskCode, tc.TaskDesc, COUNT(*) as cnt 
FROM PR_TASKREGLN tr 
LEFT JOIN PR_TASKCODE tc ON tr.TaskCode = tc.TaskCode 
WHERE tr.OT = 1 
  AND tr.TaskCode IS NOT NULL 
GROUP BY tr.TaskCode, tc.TaskDesc 
ORDER BY cnt DESC
```

**Get all TaskCode (unique):**
```sql
SELECT TaskCode, TaskDesc 
FROM PR_TASKCODE 
WHERE TaskCode NOT LIKE '%AB1%' 
  AND TaskCode NOT LIKE '%AB2%' 
  AND TaskCode NOT LIKE '%P1A%' 
  AND TaskCode NOT LIKE '%P1B%' 
  AND TaskCode NOT LIKE '%P2A%' 
  AND TaskCode NOT LIKE '%P2B%' 
  AND TaskCode NOT LIKE '%ARC%' 
  AND TaskCode NOT LIKE '%ARA%' 
  AND TaskCode NOT LIKE '%DME%' 
  AND TaskCode NOT LIKE '%IJL%' 
ORDER BY TaskCode
```

---

## Query Reference untuk Automation

**Get all unique DocDesc dari archive:**
```sql
SELECT DISTINCT DocDesc 
FROM PR_ADTRANS_ARC 
WHERE DocDesc IS NOT NULL 
  AND DocDesc != ''
ORDER BY DocDesc
```

**Get all TaskCode yang digunakan untuk Lembur (OT=1):**
```sql
SELECT DISTINCT tr.TaskCode, tc.TaskDesc, COUNT(*) as cnt 
FROM PR_TASKREGLN tr 
LEFT JOIN PR_TASKCODE tc ON tr.TaskCode = tc.TaskCode 
WHERE tr.OT = 1 
  AND tr.TaskCode IS NOT NULL 
GROUP BY tr.TaskCode, tc.TaskDesc 
ORDER BY cnt DESC
```

**Get semua adjustment untuk employee tertentu:**
```sql
SELECT emp_code, gang_code, division_code, adjustment_name, adjustment_type, amount
FROM payroll_manual_adjustments
WHERE period_month = {month}
  AND period_year = {year}
  AND emp_code = '{emp_code}'
```

**Get adjustment via SQL Gateway (direct database - WORKAROUND jika API auth tidak bekerja):**
```bash
curl -X POST "http://10.0.0.110:8001/v1/query" \
  -H "Content-Type: application/json" \
  -H "x-api-key: 2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6" \
  -d '{
    "sql": "SELECT emp_code, gang_code, division_code, adjustment_name, adjustment_type, amount FROM payroll_manual_adjustments WHERE period_month = 4 AND period_year = 2026 AND emp_code = '\''B0745'\''",
    "server": "SERVER_PROFILE_1",
    "database": "extend_db_ptrj"
  }'
```

**Database Configuration untuk Manual Adjustments:**
- **Table:** `payroll_manual_adjustments`
- **Database:** `extend_db_ptrj`
- **Profile:** `SERVER_PROFILE_1`
- **API Endpoint:** SQL Gateway at `10.0.0.110:8001`

---

### Catatan Penting untuk Automation

1. **Spelling Variations**: DocDesc memiliki banyak variasi spelling (e.g., `PREMI HARVESTING` vs `Premi Harvesting` vs `PREMI HERVESTING`). Gunakan case-insensitive matching.

2. **Division Suffix**: Banyak TaskCode memiliki suffix divisi (e.g., `PT2340ARC`, `PT2340P1A`, `PT2340AB1`). Base code adalah `PT2340`.

3. **Prefixes**: Ada berbagai prefix seperti `(AL)`, `(PM)`, `(PI)`, `(PN)`, `(DE)`, `(ME)` yang menunjukkan jenis transaksi.

4. **ACCRUALS-CHECKROLL**: TaskCode `AL3CL3310` atau `CL3310` dengan TaskDesc `ACCRUALS-CHECKROLL` digunakan untuk Premi PPH (tax-related premium).

5. **Normalisasi**: Untuk automation, selalu normalisasi DocDesc ke lowercase dan hapus extra spaces sebelum matching.

Dari analisis code, berikut TaskCode yang digunakan dalam payroll system:

#### TaskCode untuk Cuti (Leave) - GA912x Series

| TaskCode Prefix | Leave Type | Description |
|----------------|------------|-------------|
| `GA9129%` | Cuti Tahunan | Annual leave |
| `GA9126%` | Cuti Sakit/Haid | Sick leave / menstrual leave |
| `GA9127%` | Cuti Minggu | Sunday leave |
| `GA9128%` | Cuti Nasional | National holiday leave |

#### TaskCode untuk Accounting/Tunjangan

| TaskCode | Description | Usage |
|----------|-------------|-------|
| `GA9110` | Gaji Pokok | Base salary account |
| `GA9112` | Tunjangan Lembur | Overtime allowance account |
| `GA9115` | Premi PPH | PPH Premium (ACCRUALS-CHECKROLL) |
| `GA9116` | THR | Thr年终奖 |
| `GA9117` | Bonus | Bonus account |
| `GA9120` | BPJS Kesehatan Majikan | Health insurance employer |
| `GA9121` | Astek JHT Majikan | JHT insurance employer |
| `GA9128` | Tunjangan Jabatan | Position allowance |
| `GA9131` | Tunjangan Beras | Rice allowance |
| `AL0013` | Gaji Pokok (Alt) | Alternative base salary code |
| `AL0014` | Tunjangan Beras (Alt) | Alternative rice allowance |
| `AL0019` | Tunjangan Lembur (Alt) | Alternative overtime |
| `ALBPJS` | BPJS (Alt) | Alternative BPJS code |
| `ALASTK` | Astek (Alt) | Alternative labor insurance |
| `PT9129` | Masa Kerja | Years of service |

#### TaskCode untuk PREMI (DocDesc Pattern)

**Dari PR_ADTRANS DocDesc:**

| DocDesc Pattern | TaskCode | Normalized Key | Notes |
|----------------|----------|----------------|-------|
| `PREMI PANEN AL` | - | `premi_panen_al` | Air Larangan harvest premium |
| `PREMI PANEN BRONDOL` | - | `premi_brondol` | Brondol loose fruit premium |
| `PREMI PRUNING` | - | `premi_pruning` | Pruning premium |
| `PREMI INSENTIF` | - | `premi_insentif` | Insentif Panen premium |
| `PREMI KINERJA` | - | `premi_kinerja` | Kinerja bonus premium |
| `PREMI PPH` | `GA9115` | `premi_pph` | Dihitung terpisah, ditambahkan ke upah_bersih |
| `ACCRUALS-CHECKROLL` | `GA9115` | - | TaskDesc untuk Premi PPH |

#### TaskCode untuk POTONGAN (Deductions)

| DocDesc Pattern | TaskCode | Normalized Key | Notes |
|----------------|----------|----------------|-------|
| `PPH21` / `DEPH21` | `(DE) POTONGAN PPH21` | `pot_pph21` | PPh21 tax (via TER calculation) |
| `BPJS KESEHATAN` | - | `pot_bpjs_kesehatan` | Health insurance |
| `BPJS PENSIUN` | - | `pot_bpjs_pensiun` | Pension insurance |
| `SPSI` | `GA9112` | `pot_spsi` | Union dues (Rp 4,000/bulan) |
| `KOREKSI` | - | `pot_koreksi` | Correction (DocDesc LIKE 'POT%') |
| `PINJAMAN KOPERASI` | - | `pot_pinjaman` | Loan deduction |

#### TaskCode untuk LEMBUR (Overtime)

**Sumber:** `PR_TASKREGLN` dengan `OT = 1` + `PR_TASKCODE`

Lembur TaskCode bervariasi tergantung pekerjaan overtime. Contoh:

| TaskCode | TaskDesc | Category |
|----------|----------|----------|
| - | PANEN MANUAL | Harvest overtime |
| - | PUPUK | Fertilizer application overtime |
| - | SEMprot | Spraying overtime |
| - | ROGNU | Rogaming/weeding overtime |

**Note:** TaskCode dan TaskDesc untuk lembur dynamically berasal dari data actual PR_TASKCODE per transaksi overtime. Untuk melihat task code/task desc yang actual, gunakan endpoint:

```bash
# Ambil data payroll dengan overtime breakdown
curl -s "http://localhost:8002/payroll/report/division-raw-tree?month=4&year=2026&division_code=AB1" \
  -H "Authorization: Bearer ${TOKEN}" | jq '.gangs[].employees[].lembur_records[] | {task_code, task_desc}'
```

---

### Flow Perhitungan Payroll

```
1. Gaji Pokok = hari_kerja × pay_rate

2. Total Tunjangan = beras_jumlah + jabatan_jumlah + masa_kerja_jumlah + lembur_jumlah

3. Total Premi = premi_brondol + SUM(dynamic_premi)

4. Upah Kotor = gaji_pokok_aktual + total_tunjangan + total_premi

5. Jumlah Upah Kotor = upah_kotor - pot_koreksi + pendapatan_lainnya
   (koreksi di-ADD untuk tampilan saja)

6. Penghasilan Bruto = jumlah_upah_kotor + astek_m + bpjs_m
   (koreksi & lainnya adalah bagian penghasilan kena pajak)

7. Total Potongan = astek + bpjs_kes + bpjs_pensiun + spsi + pph21 + other + pendapatan_lainnya
   (koreksi TIDAK masuk - sudah di jumlah_upah_kotor)
   (pendapatan_lainnya WAJIB masuk untuk offset)

8. Upah Bersih = jumlah_upah_kotor - total_potongan + premi_pph
   (premi_pph = ADDITION, bukan potongan)
```

---

### Kategori Premi dan Potongan Reference

#### Premi Categories

| Category | DocDesc Pattern | Target Column |
|----------|----------------|---------------|
| PREMI_PANEN_AL | `%PREMI%PANEN%AL%` atau `%PREMI%AL%` | `premi_panen_al` |
| PREMI_PANEN | `%PREMI%PANEN%` | dynamic |
| PREMI_KINERJA | `%PREMI%KINERJA%` | `premi_kinerja` |
| PREMI_BRONDOL | `%PREMI%BRONDOL%` | `premi_brondol` |
| PREMI_INSENTIF | `%PREMI%INSENTIF%` | `premi_insentif` |
| PREMI_LAIN | `%PREMI%` (catchall) | dynamic column |

#### Potongan Categories

| Category | DocDesc Pattern | Target Column |
|----------|----------------|---------------|
| POTONGAN_PPH21 | (`%PPH%` OR `%PAJAK%`) AND NOT `%PREMI%` | `pot_pph21` |
| POTONGAN_BPJS_KESEHATAN | `%BPJS%KESEHATAN%` | `pot_bpjs_kesehatan` |
| POTONGAN_BPJS_PENSIUN | `%BPJS%PENSIUN%` | `pot_bpjs_pensiun` |
| POTONGAN_SPSI | `%SPSI%` | `pot_spsi` |
| POTONGAN_KOREKSI | `%KOREKSI%` atau `POT%` | `pot_koreksi` |
| POTONGAN_PINJAMAN | `%PINJAM%` | `pot_pinjaman` |
| POTONGAN_LAIN | `POT%` (catchall) | dynamic column |

---

## CLI Helper Script

Untuk testing cepat dari command line, bisa pakai script `curl_test.ts` yang ada di `_dev_utils`:

```bash
cd backend
bun run src/scripts/curl_test.ts
```

Atau buat script bash sederhana:

```bash
#!/bin/bash
API_KEY="88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"
BASE_URL="http://localhost:8002"

# Get adjustments
curl -s -X GET "${BASE_URL}/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&gang_code=H1H" \
  -H "X-API-Key: ${API_KEY}" | jq .

# Save adjustment
curl -s -X POST "${BASE_URL}/payroll/manual-adjustment/by-api-key" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"period_month":4,"period_year":2026,"emp_code":"C0001","nik":"1902050504860001","emp_name":"BUDI TEST","gang_code":"H1H","adjustment_type":"PREMI","adjustment_name":"BONUS LEBARAN","amount":500000}' | jq .
```


### 4. Verifikasi Data Langsung ke `db_ptrj` (`PR_ADTRANS`)

**Endpoint:** `POST /payroll/manual-adjustment/check-adtrans/by-api-key`  
**Access:** Protected, wajib menggunakan header `X-API-Key`.

Endpoint ini digunakan untuk mengecek nilai allowance/deduction/premi yang sudah benar-benar tersimpan di Plantware `db_ptrj`, bukan dari tabel manual adjustment di `extend_db_ptrj`. Gunakan endpoint ini ketika ingin memverifikasi employee tertentu pada periode tertentu, misalnya setelah sync/update Plantware untuk SPSI, PPh21, tunjangan masa kerja, tunjangan jabatan, atau premi dynamic.

Endpoint membaca data melalui SQL Gateway/API query dengan koneksi database yang dipilih dari konfigurasi `.env`, lalu mengambil sumber berikut:

- `db_ptrj.dbo.PR_ADTRANS`
- `db_ptrj.dbo.PR_ADTRANS_ARC`
- `db_ptrj.dbo.PR_ADTRANSLN`
- `db_ptrj.dbo.PR_ADTRANSLN_ARC`

> **Penting — aturan periode:** query ini menggunakan `PhyMonth` dan `PhyYear`, bukan `AccMonth`/`AccYear`. `period_month` dikirim sebagai filter `PhyMonth`, dan `period_year` dikirim sebagai filter `PhyYear`. Field `PhyMonth` dan `PhyYear` adalah real month/year sesuai kalender.

#### Cara Mengecek Duplikat Menggunakan Endpoint

Gunakan endpoint ini, bukan query SQL manual:

```text
POST /payroll/manual-adjustment/check-adtrans/by-api-key
```

Header wajib:

```http
Content-Type: application/json
X-API-Key: <API_KEY>
```

Hasil duplikat ada di:

```text
data.duplicate_report
```

Field penting untuk cleanup:

| Field | Arti |
|-------|------|
| `duplicate_count` | Jumlah grup duplikat yang ditemukan. |
| `duplicates[].emp_code` | Employee PTRJ/Plantware yang memiliki transaksi duplikat. |
| `duplicates[].doc_desc` | Nama transaksi di `PR_ADTRANS.DocDesc`, misalnya `PREMI TBS`. |
| `duplicates[].amount` | Total amount dari `PR_ADTRANSLN` untuk transaksi itu. |
| `duplicates[].keep_doc_id` | `DocID` terbaru yang direkomendasikan tetap disimpan. |
| `duplicates[].delete_doc_ids` | `DocID` lama yang direkomendasikan untuk dicek/dihapus. |
| `duplicates[].records` | Detail semua record pembentuk grup, lengkap dengan action `KEEP_NEWEST` atau `DELETE_OLD`. |

Aturan duplicate endpoint:

```text
EmpCode + category + DocDesc + Amount
```

`DocID` **bukan** kunci duplicate. `DocID` hanya identitas record untuk menentukan mana yang disimpan dan mana yang lama.

#### Request Body

Cek berdasarkan list employee tertentu:

```json
{
  "period_month": 4,
  "period_year": 2026,
  "emp_codes": ["B0065", "B0070"],
  "filters": ["spsi", "masa kerja", "jabatan", "premi", "potongan"]
}
```

Cek langsung semua employee dalam satu divisi:

```json
{
  "period_month": 4,
  "period_year": 2026,
  "division_code": "P2A",
  "filters": ["spsi", "masa kerja", "jabatan"]
}
```

Cek duplicate berdasarkan `adjustment_type` tanpa menulis `filters`:

```json
{
  "period_month": 4,
  "period_year": 2026,
  "division_code": "IJL",
  "adjustment_type": "PREMI"
}
```

Cek duplicate untuk premi/koreksi spesifik:

```json
{
  "period_month": 4,
  "period_year": 2026,
  "division_code": "IJL",
  "adjustment_type": "PREMI",
  "adjustment_name": "PREMI TBS"
}
```

| Field | Type | Required | Keterangan |
|-------|------|----------|------------|
| `period_month` | number | Yes | Bulan kalender yang akan dicek. Dipakai sebagai `PhyMonth`. |
| `period_year` | number | Yes | Tahun kalender yang akan dicek. Dipakai sebagai `PhyYear`. |
| `emp_codes` | string[] | Conditional | List `EmpCode` yang akan dicek langsung ke `PR_ADTRANS` dan archive. Wajib jika `division_code` tidak dikirim. |
| `division_code` | string | Conditional | Filter semua employee dalam satu divisi berdasarkan `PR_ADTRANS.LocCode`. Bisa kirim kode Plantware 3 karakter seperti `P2A`, `AB1`, `ARA`, `ARC`, `DME`, `IJL`, atau alias seperti `PG2A`/`2A` yang akan dinormalisasi ke `P2A`. Wajib jika `emp_codes` kosong/tidak dikirim. |
| `filters` | string[] | Conditional | List keyword komponen yang akan dicocokkan ke pola `DocDesc`. Wajib jika `adjustment_type`, `adjustment_name`, dan `doc_desc` tidak dikirim. |
| `adjustment_type` / `adjustment_types` | string/string[] | Conditional | Alternatif dari `filters`. Mapping: `PREMI` -> `premi`, `POTONGAN_KOTOR`/`KOREKSI` -> `koreksi`, `POTONGAN_BERSIH` -> `potongan`, `SPSI` -> `spsi`, `JABATAN` -> `jabatan`, `MASA_KERJA` -> `masa kerja`. |
| `adjustment_name` / `adjustment_names` | string/string[] | Optional | Filter nama spesifik yang dicocokkan ke `DocDesc`, misalnya `PREMI TBS`, `PREMI INSENTIF PANEN`, atau `KOREKSI PANEN`. Bisa comma-separated. |
| `doc_desc` / `doc_descs` | string/string[] | Optional | Alias teknis untuk filter spesifik `DocDesc`. Gunakan jika ingin mencari teks `DocDesc` langsung, bukan nama adjustment. |

Kirim salah satu atau keduanya: `emp_codes` dan/atau `division_code`. Jika keduanya dikirim, scope query mencakup employee dalam `emp_codes` **atau** record dengan `LocCode = normalized division_code`.

Kirim minimal salah satu filter transaksi: `filters`, `adjustment_type`, `adjustment_name`, atau `doc_desc`. Jika hanya `adjustment_name`/`doc_desc` dikirim, endpoint akan mencoba infer kategori dari awalan/isi nama: `PREMI...`, `KOREKSI...`, `POT...`, `SPSI`, `JABATAN`, atau `MASA KERJA`.

Normalisasi `division_code` untuk `LocCode`:

| Input | Dipakai ke `PR_ADTRANS.LocCode` |
|-------|---------------------------------|
| `PG1A`, `1A`, `P1A` | `P1A` |
| `PG1B`, `1B`, `P1B` | `P1B` |
| `PG2A`, `2A`, `P2A` | `P2A` |
| `PG2B`, `2B`, `P2B` | `P2B` |
| `ARB1`, `AB1` | `AB1` |
| `ARB2`, `AB2` | `AB2` |
| `AREC`, `ARC` | `ARC` |
| `ARA`, `DME`, `IJL` | tetap sesuai input |

#### Mapping Filter ke `DocDesc`

| Input Filter | SQL Pattern ke `DocDesc` | Contoh Penggunaan |
|--------------|---------------------------|-------------------|
| `spsi` / `potongan spsi` | `%SPSI%` | Cek potongan SPSI. |
| `masa kerja` / `tunjangan masa kerja` | `%MASA%KERJA%` | Cek tunjangan masa kerja, termasuk `TUNJANGAN MASA KERJA`. |
| `jabatan` / `tunjangan jabatan` | `%JABATAN%` | Cek tunjangan jabatan. |
| `pph` / `potongan pph21` | `%PPH%` atau `%PAJAK%`, exclude `%PREMI%` | Cek potongan PPh21 employee. |
| `premi` | `%PREMI%`, `%INSENTIF%`, `%PANEN%`, `%KINERJA%`, `%RAWAT%`, `%PRUN%` | Cek premi dynamic. Keyword ini tidak menjadi kolom static. |
| `brondol` | `%BRONDOL%` | Brondol special/static: jumlahkan ke kolom `brondol` yang sudah ada. |
| `koreksi` | `%KOREKSI%` | Koreksi selalu masuk `potongan upah kotor` sebagai kolom dynamic. |
| `potongan` | `POT%`, `POTONGAN%` | Cek potongan umum dynamic; tidak mencakup static SPSI/PPH dan tidak double-count `koreksi` jika filter `koreksi` juga dikirim. |
| filter lain | `%FILTER%` | Cek premi/komponen dynamic berdasarkan keyword yang dikirim. |

#### Contoh cURL

```bash
API_KEY="your-api-key"
BASE_URL="http://localhost:8002"

# Cek employee tertentu
curl -s -X POST "${BASE_URL}/payroll/manual-adjustment/check-adtrans/by-api-key" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "period_month": 4,
    "period_year": 2026,
    "emp_codes": ["B0065", "B0070"],
    "filters": ["spsi", "masa kerja", "jabatan", "premi"]
  }' | jq .

# Cek semua employee dalam divisi dan tampilkan ringkasan duplicate
curl -s -X POST "${BASE_URL}/payroll/manual-adjustment/check-adtrans/by-api-key" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "period_month": 4,
    "period_year": 2026,
    "division_code": "P2A",
    "filters": ["spsi", "masa kerja", "jabatan", "premi", "koreksi", "potongan"]
  }' | jq '.data.duplicate_report'

# Cek duplicate hanya untuk PREMI TBS di IJL
curl -s -X POST "${BASE_URL}/payroll/manual-adjustment/check-adtrans/by-api-key" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "period_month": 4,
    "period_year": 2026,
    "division_code": "IJL",
    "adjustment_type": "PREMI",
    "adjustment_name": "PREMI TBS"
  }' | jq '.data.duplicate_report'

# Cek duplicate hanya untuk koreksi tertentu
curl -s -X POST "${BASE_URL}/payroll/manual-adjustment/check-adtrans/by-api-key" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "period_month": 4,
    "period_year": 2026,
    "division_code": "IJL",
    "adjustment_type": "POTONGAN_KOTOR",
    "adjustment_name": "KOREKSI PANEN"
  }' | jq '.data.duplicate_report'
```

#### Success Response

Response berisi tiga bagian utama:

- `data.totals`: hasil agregasi `SUM(Amount)` per `emp_code` untuk setiap filter yang diminta.
- `data.doc_desc_details`: detail baris pembentuk nilai source dari `PR_ADTRANS`/archive. Ini berisi semua baris yang match filter, termasuk yang tidak duplikat.
- `data.duplicate_report`: daftar employee + kategori + `DocDesc` + `Amount` yang memiliki lebih dari satu record isi transaksi yang sama pada periode/scope yang sama.

```json
{
  "success": true,
  "message": "Adtrans check completed successfully",
  "data": {
    "totals": [
      {
        "emp_code": "B0065",
        "spsi": 4000,
        "masa kerja": 125000,
        "jabatan": 250000,
        "premi": 150000
      },
      {
        "emp_code": "B0070",
        "spsi": 0,
        "masa kerja": 0,
        "jabatan": 250000,
        "premi": 87500
      }
    ],
    "doc_desc_details": [
      {
        "emp_code": "C0028",
        "category": "spsi",
        "doc_desc": "POTONGAN SPSI",
        "doc_id": "ADP2A26041177",
        "amount": 4000
      },
      {
        "emp_code": "C0028",
        "category": "spsi",
        "doc_desc": "POTONGAN SPSI",
        "doc_id": "ADP2A26041438",
        "amount": 4000
      }
    ],
    "duplicate_report": {
      "duplicate_count": 1,
      "duplicates": [
        {
          "emp_code": "C0028",
          "emp_name": "ASBI AL GHIFARI ( YUNENGSIH",
          "category": "spsi",
          "doc_desc": "POTONGAN SPSI",
          "amount": 4000,
          "record_count": 2,
          "keep_id": "674653",
          "keep_doc_id": "ADP2A26041438",
          "delete_ids": ["674398"],
          "delete_doc_ids": ["ADP2A26041177"],
          "records": [
            {
              "id": "674398",
              "doc_id": "ADP2A26041177",
              "doc_date": "2026-04-27",
              "doc_desc": "POTONGAN SPSI",
              "amount": 4000,
              "action": "DELETE_OLD"
            },
            {
              "id": "674653",
              "doc_id": "ADP2A26041438",
              "doc_date": "2026-04-27",
              "doc_desc": "POTONGAN SPSI",
              "amount": 4000,
              "action": "KEEP_NEWEST"
            }
          ]
        }
      ]
    }
  }
}
```

#### Duplicate Detection Rules

Duplicate dihitung per kombinasi:

```text
emp_code + normalized filter/category + normalized DocDesc + normalized Amount
```

`DocID` bukan kunci duplikat. `DocID` hanya identitas record untuk menentukan `keep_doc_id` dan `delete_doc_ids`.

Sebelum masuk `duplicate_report`, setiap kandidat `DocID` juga harus punya nilai amount detail yang bermakna di `PR_ADTRANSLN` / `PR_ADTRANSLN_ARC`. Endpoint mengabaikan record yang hanya punya header `PR_ADTRANS.DocDesc` tetapi total detail line amount kosong, `NULL`, atau `0`. Jadi dua `DocID` dengan `DocDesc` sama tidak otomatis duplicate; record lama baru masuk `delete_doc_ids` jika record lama itu juga memiliki amount detail di `PR_ADTRANSLN`.

Contoh: employee `L0073` memiliki dua record `DocDesc = PREMI TBS` dengan `Amount = 1046398`, maka masuk duplicate kategori `premi`. Jika employee yang sama memiliki `PREMI TBS` amount berbeda, itu tidak digabung sebagai duplicate yang sama.

Contoh bukan duplicate: employee punya dua header `DocDesc = PREMI TBS`, tetapi `DocID` lama tidak punya amount detail di `PR_ADTRANSLN` atau amount detailnya `0`. Walaupun `DocDesc` sama, endpoint tidak akan merekomendasikan `DocID` lama itu untuk dihapus sebagai duplicate.

Khusus `filter = premi`, `duplicate_report` hanya menganggap duplicate cleanup untuk `DocDesc` yang diawali `PREMI`, misalnya `PREMI TBS` atau `PREMI INSENTIF PANEN`. `DocDesc` seperti `INSENTIF PANEN` tetap bisa muncul di agregasi/check detail jika match pattern premi, tetapi tidak masuk rekomendasi duplicate cleanup premi karena tidak diawali `PREMI`.

Jika `adjustment_name` atau `doc_desc` dikirim, `doc_desc_details` dan `duplicate_report` hanya berisi `DocDesc` yang mengandung teks spesifik tersebut. Contoh `adjustment_name = "PREMI TBS"` tidak akan mengembalikan duplicate `PREMI INSENTIF PANEN`, walaupun sama-sama kategori `premi`.

Aturan rekomendasi hapus:

- `keep_id` / `keep_doc_id`: record dengan `ID` paling besar, dianggap record terbaru yang dipertahankan.
- `delete_ids` / `delete_doc_ids`: record dengan `ID` lebih kecil, dianggap record lama yang disarankan dihapus.
- Endpoint ini hanya memberi rekomendasi; tidak menjalankan delete.

#### Catatan Penggunaan

- Endpoint ini hanya untuk **membaca dan memverifikasi** data real di `db_ptrj`.
- Endpoint ini **tidak mengupdate** manual adjustment, remarks, atau data di `extend_db_ptrj`.
- Jika hasil filter bernilai `0`, artinya tidak ada `DocDesc` yang match untuk employee/filter tersebut pada `PhyMonth` dan `PhyYear` yang dikirim.
- Untuk cek satu divisi penuh, cukup kirim `division_code` tanpa `emp_codes`; endpoint akan memakai `PR_ADTRANS.LocCode` sebagai scope.
- `duplicate_report` cocok untuk kasus auto buffer/Plantware input yang seharusnya satu record per employee per kategori, misalnya potongan SPSI double di Divisi P2A.
- Untuk mengecek data yang baru di-update oleh user tertentu seperti `UpdatedBy = 'adm075'`, gunakan query investigasi terpisah; endpoint ini saat ini fokus ke pengecekan berdasarkan `EmpCode`/`division_code`, periode, dan filter `DocDesc`.

---

### 4b. Ambil List `DocID` ADTRANS untuk Config Terpilih

**Endpoint utama:** `POST /payroll/manual-adjustment/adtrans-doc-ids/by-api-key`  
**Alias kompatibel:** `POST /payroll/manual-adjustment/adtrans-by-docid/by-api-key` dan `POST /payroll/manual-adjustment/adtrans-by-doid/by-api-key`  
**Access:** Protected, wajib menggunakan header `X-API-Key`.

Endpoint ini hanya membaca `db_ptrj` (`PR_ADTRANS` dan `PR_ADTRANS_ARC`) dan mengembalikan list `DocID` yang match dengan scope/config yang dipilih. Endpoint ini **tidak menghapus data**, tidak menulis ke `extend_db_ptrj`, dan tidak mengubah `PR_ADTRANS`.

#### Tujuan

Tujuan endpoint ini adalah memberi daftar `DocID` transaksi Plantware yang perlu ditargetkan saat reset/cleanup dilakukan oleh automation lain. Kasus umum: user salah input nilai di Plantware untuk satu divisi/periode, misalnya tunjangan jabatan, tunjangan masa kerja, potongan SPSI, potongan PPh21, atau premi tertentu. Endpoint ini membantu menemukan `DocID` yang sesuai config tanpa perlu membaca payload duplicate/detail yang panjang.

Endpoint ini berbeda dari `check-adtrans/by-api-key`:

| Endpoint | Output | Cocok untuk |
|----------|--------|-------------|
| `check-adtrans/by-api-key` | total, detail `DocDesc`, dan duplicate report | Investigasi nominal, duplicate, dan detail transaksi. |
| `adtrans-doc-ids/by-api-key` | hanya `doc_ids` | Automation yang hanya butuh list `DocID` untuk reset/cleanup. |

#### Cara Pakai

Kirim periode dan scope data:

- `period_month` dan `period_year` selalu wajib.
- Kirim `division_code` untuk ambil semua record dalam satu divisi/LocCode.
- Atau kirim `emp_codes` jika hanya ingin target employee tertentu.

Lalu kirim config transaksi yang ingin dicari. Minimal salah satu dari `filters`, `adjustment_type`, `adjustment_name`, atau `doc_desc` wajib dikirim.

Config yang umum:

- tunjangan jabatan: `filters: ["jabatan"]`
- tunjangan masa kerja: `filters: ["masa kerja"]`
- potongan SPSI: `filters: ["spsi"]`
- potongan PPh21: `filters: ["pph"]`
- premi tertentu: `adjustment_type: "PREMI"` + `adjustment_name: "PREMI TBS"`
- koreksi/potongan tertentu: `adjustment_type` + `adjustment_name` atau `doc_desc`

Flow usage yang disarankan:

1. Panggil endpoint dengan scope paling sempit yang aman, misalnya `division_code` + kategori spesifik.
2. Cek `count` dan isi `doc_ids`.
3. Jika list sudah sesuai, teruskan `doc_ids` itu ke proses reset/delete Plantware yang terpisah.
4. Setelah cleanup Plantware selesai, verifikasi ulang dengan `check-adtrans/by-api-key` atau endpoint compare yang relevan.

Catatan penting:

- Response tidak menyertakan nominal, employee, atau `DocDesc`; gunakan `check-adtrans/by-api-key` jika butuh audit detail.
- Endpoint ini tidak membandingkan nilai dengan `payroll_manual_adjustments`. Untuk mencari `DocID` yang statusnya `MISMATCH` terhadap manual adjustment, gunakan `compare-adtrans/by-api-key` lalu ambil `doc_id` dari `db_ptrj_doc_desc_details[]`.
- `DocID` yang hanya punya header `PR_ADTRANS` tetapi tidak punya amount detail bermakna di `PR_ADTRANSLN` / `PR_ADTRANSLN_ARC` tidak dikembalikan untuk cleanup.
- `doc_ids` sudah dibuat unik, jadi `DocID` yang muncul lebih dari satu kali di hasil query hanya dikirim sekali.
- `division_code` mengikuti normalisasi yang sama dengan `check-adtrans`, misalnya `PG2A`/`2A` dipakai sebagai `P2A` di `PR_ADTRANS.LocCode`.
- Endpoint memakai `PhyMonth` dan `PhyYear`, bukan `AccMonth`/`AccYear`.

Request body memakai field yang sama dengan `check-adtrans/by-api-key`:

| Field | Type | Required | Keterangan |
|-------|------|----------|------------|
| `period_month` | number | Yes | Bulan kalender, dipakai sebagai `PhyMonth`. |
| `period_year` | number | Yes | Tahun kalender, dipakai sebagai `PhyYear`. |
| `emp_codes` | string[] | Conditional | List `EmpCode`; wajib jika `division_code` tidak dikirim. |
| `division_code` | string | Conditional | Scope divisi/LocCode; wajib jika `emp_codes` kosong. |
| `filters` | string[] | Conditional | Kategori seperti `spsi`, `masa kerja`, `jabatan`, `pph`, `premi`, `koreksi`, `potongan`. |
| `adjustment_type` / `adjustment_types` | string/string[] | Conditional | Alternatif kategori, misalnya `PREMI`, `POTONGAN_KOTOR`, `POTONGAN_BERSIH`. |
| `adjustment_name` / `adjustment_names` | string/string[] | Optional | Filter nama spesifik yang dicocokkan ke `DocDesc`. |
| `doc_desc` / `doc_descs` | string/string[] | Optional | Filter teks `DocDesc` langsung. |

Minimal kirim salah satu filter transaksi: `filters`, `adjustment_type`, `adjustment_name`, atau `doc_desc`.

**Contoh potongan SPSI satu divisi:**

```bash
curl -s -X POST "${BASE_URL}/payroll/manual-adjustment/adtrans-doc-ids/by-api-key" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "period_month": 4,
    "period_year": 2026,
    "division_code": "P2A",
    "filters": ["spsi"]
  }'
```

**Contoh premi spesifik:**

```bash
curl -s -X POST "${BASE_URL}/payroll/manual-adjustment/adtrans-doc-ids/by-api-key" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "period_month": 4,
    "period_year": 2026,
    "division_code": "IJL",
    "adjustment_type": "PREMI",
    "adjustment_name": "PREMI TBS"
  }'
```

**Response:**

```json
{
  "success": true,
  "count": 2,
  "doc_ids": ["ADIJL26041001", "ADIJL26041002"]
}
```

`doc_ids` berisi `DocID` unik yang match. Jika tidak ada transaksi yang match, `count` bernilai `0` dan `doc_ids` berupa array kosong.

---

### 4. POST `/payroll/manual-adjustment/compare-adtrans/by-api-key`

**Komparasi langsung** antara nilai PR_ADTRANS di `db_ptrj` (source of truth) dan nilai `payroll_manual_adjustments` di `extend_db_ptrj`. Menampilkan per-employee per-category apakah nilai sudah **MATCH**, **MISMATCH**, atau **MISSING** (tidak ada di extend_db).

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `period_month` | number | ✅ | Bulan (1-12) |
| `period_year` | number | ✅ | Tahun |
| `division_code` | string | ✅ | Kode divisi (e.g. `AB1`, `PG2A`) |
| `filters` | string[] | ❌ | Kategori filter (default: `['spsi', 'masa kerja', 'jabatan', 'pph', 'premi', 'koreksi', 'potongan']`) |

**Example:**

```bash
curl -X POST "http://localhost:8002/payroll/manual-adjustment/compare-adtrans/by-api-key" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "period_month": 4,
    "period_year": 2026,
    "division_code": "AB1",
    "filters": ["spsi", "masa kerja", "jabatan", "pph", "premi", "koreksi", "potongan"]
  }'
```

**Response:**

```json
{
  "success": true,
  "message": "Comparison completed successfully",
  "data": {
    "division": "AB1",
    "period_month": 4,
    "period_year": 2026,
    "compared_categories": ["spsi", "masa kerja", "jabatan", "pph", "premi", "koreksi", "potongan"],
    "total_employees": 25,
    "match_count": 60,
    "mismatch_count": 5,
    "missing_in_adjustments": 10,
    "comparisons": [
      {
        "emp_code": "G0007",
        "category": "spsi",
        "adjustment_name": "SPSI",
        "source_amount": 4000,
        "stored_amount": 4000,
        "diff": 0,
        "status": "MATCH",
        "gang_code": "G1H",
        "remarks": "SPSI | potongan spsi | 4000 | sync:SYNC | match:MATCH"
      },
      {
        "emp_code": "G0010",
        "category": "jabatan",
        "adjustment_name": "TUNJANGAN JABATAN",
        "source_amount": 150000,
        "stored_amount": 0,
        "diff": 150000,
        "status": "MISMATCH",
        "gang_code": "G1H",
        "remarks": "TUNJANGAN JABATAN | tunjangan jabatan | 0 | sync:MISS | match:MISMATCH"
      },
      {
        "emp_code": "G0015",
        "category": "masa kerja",
        "adjustment_name": "MASA KERJA",
        "source_amount": 25000,
        "stored_amount": null,
        "diff": null,
        "status": "MISSING",
        "gang_code": null,
        "remarks": null
      }
    ]
  }
}
```

**Comparison Status:**

| Status | Description | Insight yang diberikan |
|--------|-------------|------------------------|
| `MATCH` | Nilai di `db_ptrj` sama dengan `extend_db_ptrj` (toleransi ≤ 0.01) | Data manual adjustment sudah sinkron dengan Plantware. |
| `MISMATCH` | Nilai berbeda antara `db_ptrj` dan `extend_db_ptrj` | Ada record di kedua sisi, tetapi nominal tidak sama. Lihat `source_amount`, `stored_amount`, dan `diff`. |
| `MISSING` | Tidak ada record di `extend_db_ptrj` untuk employee+category ini | Plantware punya nilai, tetapi manual adjustment belum punya record. Ini kandidat untuk dibuat/sync dari `db_ptrj`. |

**Cara membaca detail comparison:**

| Field | Makna |
|-------|-------|
| `emp_code` | Selalu EmpCode PTRJ letter dari `db_ptrj`, misalnya `A0001`, `B0745`. |
| `category` | Kategori hasil mapping `DocDesc`: `spsi`, `masa kerja`, `jabatan`, `pph`, `premi`, `koreksi`, atau `potongan`. |
| `adjustment_name` | Nama record yang dicari/dibandingkan di `payroll_manual_adjustments`. Untuk premi/potongan manual, mengikuti `adjustment_name` dari extend DB jika ada. |
| `source_amount` / `db_ptrj_amount` | Total nominal dari `db_ptrj.PR_ADTRANS` + `PR_ADTRANS_ARC`. |
| `stored_amount` / `extend_db_ptrj_amount` | Nominal di `extend_db_ptrj.payroll_manual_adjustments`; `null` berarti missing. |
| `diff` | `source_amount - stored_amount`; `null` untuk status `MISSING`. |
| `status` | `MATCH`, `MISMATCH`, atau `MISSING`. |
| `db_ptrj_doc_desc_details` | Detail baris pembentuk nilai source dari Plantware: `doc_desc`, `doc_id`, dan `amount`. Dipakai untuk tahu nilai `db_ptrj` berasal dari DocDesc apa saja. |
| `extend_db_ptrj_remarks` | Remarks/catatan dari record manual adjustment di `extend_db_ptrj`. |
| `gang_code` | Gang dari record manual adjustment jika tersedia. |
| `remarks` | Alias lama dari `extend_db_ptrj_remarks` untuk kompatibilitas response. |

**Contoh insight dari response compare:**

```bash
# Semua data Plantware yang belum ada di manual adjustment
jq '.data.comparisons[] | select(.status == "MISSING")'

# Ringkasan jumlah masalah per kategori
jq '.data.comparisons
  | map(select(.status != "MATCH"))
  | group_by(.category)
  | map({category: .[0].category, count: length, statuses: (group_by(.status) | map({status: .[0].status, count: length}))})'

# Selisih nominal terbesar antara db_ptrj dan extend_db_ptrj
jq '.data.comparisons
  | map(select(.status == "MISMATCH"))
  | sort_by((.diff | if . < 0 then -. else . end))
  | reverse
  | .[0:20]'

# Lihat detail DocDesc db_ptrj dan remarks extend_db_ptrj untuk data yang beda
jq '.data.comparisons[]
  | select(.status != "MATCH")
  | {emp_code, category, db_ptrj_amount, extend_db_ptrj_amount, diff, db_ptrj_doc_desc_details, extend_db_ptrj_remarks}'

# Ambil DocID unik untuk cleanup Plantware khusus yang MISMATCH
jq -r '.data.comparisons[]
  | select(.status == "MISMATCH")
  | .db_ptrj_doc_desc_details[]
  | select(.doc_id != null)
  | .doc_id' | sort -u
```

**DocID mismatch untuk cleanup Plantware:**

Gunakan status `MISMATCH` jika transaksi sudah ada di `db_ptrj` dan record manual adjustment juga ada, tetapi nominalnya berbeda. Dalam kondisi ini, `db_ptrj_doc_desc_details[]` menunjukkan baris Plantware pembentuk total `db_ptrj_amount`; field `doc_id` di detail itulah yang bisa diteruskan ke automation reset/delete Plantware.

Contoh item mismatch:

```json
{
  "emp_code": "G0010",
  "category": "jabatan",
  "adjustment_name": "TUNJANGAN JABATAN",
  "source_amount": 150000,
  "stored_amount": 100000,
  "db_ptrj_amount": 150000,
  "extend_db_ptrj_amount": 100000,
  "diff": 50000,
  "status": "MISMATCH",
  "db_ptrj_doc_desc_details": [
    {
      "doc_desc": "(AL) TUNJANGAN JABATAN",
      "doc_id": "ADAB126040123",
      "amount": 150000
    }
  ],
  "extend_db_ptrj_remarks": "TUNJANGAN JABATAN | tunjangan jabatan | 100000 | sync:MISS | match:MISMATCH"
}
```

Untuk menghapus input Plantware yang salah, ambil `doc_id` dari `db_ptrj_doc_desc_details[]`, bukan dari manual adjustment. Endpoint ini hanya membaca dan membandingkan; proses delete/reset tetap dilakukan oleh automation terpisah.

**Category → Adjustment Name Mapping:**

| ADTRANS Category | Adjustment Name |
|-----------------|-----------------|
| `spsi` | `SPSI` |
| `masa kerja` | `MASA KERJA` |
| `jabatan` | `TUNJANGAN JABATAN` |
| `pph` | `POTONGAN PPH` |
| `premi` | `adjustment_type = 'PREMI'`, nama sesuai `adjustment_name` |
| `koreksi` | `adjustment_type = 'POTONGAN_KOTOR'` dan `adjustment_name` mengandung `KOREKSI` |
| `potongan` | `adjustment_type = 'POTONGAN_KOTOR'` selain `KOREKSI` |

---

### 5. POST `/payroll/manual-adjustment/reverse-compare-adtrans/by-api-key`

**Reverse komparasi** dari `payroll_manual_adjustments` di `extend_db_ptrj` ke nilai real `PR_ADTRANS` di `db_ptrj`. Endpoint ini dipakai untuk menemukan data yang **ada di extend_db_ptrj tetapi tidak ada / bernilai 0 di db_ptrj**, misalnya `SPSI` masih tersimpan 4000 di manual adjustment padahal Plantware sudah tidak punya record SPSI untuk employee tersebut.

Endpoint ini memakai bypass API key yang sama: header `X-API-Key` wajib diisi.

**Aturan EmpCode PTRJ:** saat endpoint mengecek `PR_ADTRANS` / `PR_ADTRANS_ARC`, identifier employee selalu di-resolve dulu ke format `EmpCode` PTRJ yang diawali huruf, misalnya `A0001` atau `B0745`. Jika `payroll_manual_adjustments.emp_code` berisi NIK/KTP numeric, endpoint akan mencari pasangan di `HR_EMPLOYEE.NewICNo` lalu memakai `HR_EMPLOYEE.EmpCode` untuk query `PR_ADTRANS.EmpCode`. Field response `emp_code` juga memakai EmpCode PTRJ letter; nilai numeric asal hanya muncul sebagai `stored_emp_identifier` jika berbeda. Jangan memakai NIK numeric langsung untuk query `PR_ADTRANS.EmpCode` karena akan menghasilkan false `EXTRA_IN_ADJUSTMENTS`.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `period_month` | number | ✅ | Bulan (1-12), dipakai sebagai `PhyMonth` saat cek `db_ptrj` |
| `period_year` | number | ✅ | Tahun, dipakai sebagai `PhyYear` saat cek `db_ptrj` |
| `division_code` | string | ✅ | Kode divisi, termasuk virtual division seperti `NRS` |
| `filters` | string[] | ❌ | Kategori filter (default: `['spsi', 'masa kerja', 'jabatan', 'pph', 'premi', 'koreksi', 'potongan']`) |

**Example:**

```bash
curl -X POST "http://localhost:8002/payroll/manual-adjustment/reverse-compare-adtrans/by-api-key" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "period_month": 4,
    "period_year": 2026,
    "division_code": "NRS",
    "filters": ["spsi", "masa kerja", "jabatan", "pph", "premi", "koreksi", "potongan"]
  }'
```

**Ambil hanya yang extra di extend:**

```bash
curl -s -X POST "http://localhost:8002/payroll/manual-adjustment/reverse-compare-adtrans/by-api-key" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "period_month": 4,
    "period_year": 2026,
    "division_code": "NRS",
    "filters": ["spsi", "masa kerja", "jabatan", "pph", "premi", "koreksi", "potongan"]
  }' | jq '.data.comparisons[] | select(.status == "EXTRA_IN_ADJUSTMENTS")'
```

**Response:**

```json
{
  "success": true,
  "message": "Reverse comparison completed successfully",
  "data": {
    "division": "NRS",
    "period_month": 4,
    "period_year": 2026,
    "compared_categories": ["spsi", "masa kerja", "jabatan", "pph", "premi", "koreksi", "potongan"],
    "total_adjustments": 3,
    "match_count": 1,
    "mismatch_count": 1,
    "extra_in_adjustments": 1,
    "comparisons": [
      {
        "emp_code": "B0745",
        "category": "spsi",
        "adjustment_name": "SPSI",
        "stored_amount": 4000,
        "source_amount": 4000,
        "diff": 0,
        "status": "MATCH",
        "gang_code": "B2N",
        "division_code": "NRS",
        "remarks": "SPSI | potongan spsi | 4000"
      },
      {
        "emp_code": "B0746",
        "category": "spsi",
        "adjustment_name": "SPSI",
        "stored_amount": 4000,
        "source_amount": 0,
        "diff": -4000,
        "status": "EXTRA_IN_ADJUSTMENTS",
        "gang_code": "B2N",
        "division_code": "NRS",
        "remarks": "SPSI | potongan spsi | 4000"
      },
      {
        "emp_code": "B0747",
        "category": "masa kerja",
        "adjustment_name": "MASA KERJA",
        "stored_amount": 2500,
        "source_amount": 5000,
        "diff": 2500,
        "status": "MISMATCH",
        "gang_code": "B2N",
        "division_code": "NRS",
        "remarks": "MASA KERJA | masa kerja | 2500"
      }
    ]
  }
}
```

**Reverse Comparison Status:**

| Status | Description | Insight yang diberikan |
|--------|-------------|------------------------|
| `MATCH` | Nilai di `extend_db_ptrj` sama dengan `db_ptrj` (toleransi ≤ 0.01) | Record manual adjustment masih sesuai dengan Plantware. |
| `MISMATCH` | Nilai ada di kedua sisi tetapi nominal berbeda | Manual adjustment masih ada dan Plantware juga ada, tetapi nominal perlu ditinjau. |
| `EXTRA_IN_ADJUSTMENTS` | Record ada di `extend_db_ptrj`, tetapi nilai source `db_ptrj` = 0 / tidak ada untuk employee+category tersebut | Manual adjustment kemungkinan sudah tidak punya pasangan di Plantware dan perlu dibersihkan/diupdate. |

**Cara membaca detail reverse comparison:**

| Field | Makna |
|-------|-------|
| `emp_code` | EmpCode PTRJ letter yang dipakai untuk query `PR_ADTRANS.EmpCode`. |
| `stored_emp_identifier` | Identifier asal dari `payroll_manual_adjustments.emp_code` jika berbeda dari EmpCode PTRJ; biasanya NIK/KTP numeric. |
| `category` | Kategori hasil mapping: `spsi`, `masa kerja`, `jabatan`, `pph`, `premi`, `koreksi`, atau `potongan`. |
| `adjustment_name` | Nama record di `payroll_manual_adjustments`. |
| `stored_amount` / `extend_db_ptrj_amount` | Nominal yang tersimpan di `extend_db_ptrj.payroll_manual_adjustments`. |
| `source_amount` / `db_ptrj_amount` | Total nominal pembanding dari `db_ptrj.PR_ADTRANS` + `PR_ADTRANS_ARC`. |
| `diff` | `source_amount - stored_amount`; negatif berarti nilai manual adjustment lebih besar dari source Plantware. |
| `status` | `MATCH`, `MISMATCH`, atau `EXTRA_IN_ADJUSTMENTS`. |
| `db_ptrj_doc_desc_details` | Detail baris pembentuk nilai source dari Plantware: `doc_desc`, `doc_id`, dan `amount`. Jika source kosong, array ini kosong. |
| `extend_db_ptrj_remarks` | Remarks/catatan dari record manual adjustment di `extend_db_ptrj`. |
| `gang_code` / `division_code` | Scope asal record manual adjustment. |
| `remarks` | Alias lama dari `extend_db_ptrj_remarks` untuk kompatibilitas response. |

**Contoh insight dari response reverse compare:**

```bash
# Semua manual adjustment yang tidak punya pasangan/nilai di db_ptrj
jq '.data.comparisons[] | select(.status == "EXTRA_IN_ADJUSTMENTS")'

# Ringkasan extra/mismatch per kategori
jq '.data.comparisons
  | map(select(.status != "MATCH"))
  | group_by(.category)
  | map({category: .[0].category, count: length, statuses: (group_by(.status) | map({status: .[0].status, count: length}))})'

# Cek kasus identifier numeric yang sudah dikonversi ke EmpCode PTRJ letter
jq '.data.comparisons[] | select(.stored_emp_identifier != null) | {emp_code, stored_emp_identifier, category, status, stored_amount, source_amount}'

# Top 20 selisih nominal terbesar dari manual adjustment ke db_ptrj
jq '.data.comparisons
  | map(select(.status != "MATCH"))
  | sort_by((.diff | if . < 0 then -. else . end))
  | reverse
  | .[0:20]'

# Lihat detail DocDesc db_ptrj dan remarks extend_db_ptrj untuk data yang beda/extra
jq '.data.comparisons[]
  | select(.status != "MATCH")
  | {emp_code, stored_emp_identifier, category, db_ptrj_amount, extend_db_ptrj_amount, diff, db_ptrj_doc_desc_details, extend_db_ptrj_remarks}'
```

**Perbedaan dengan compare biasa:**

| Endpoint | Arah cek | Cocok untuk |
|----------|----------|-------------|
| `sync-status/by-api-key` | browser automation -> db_ptrj -> remarks | Setelah browser automation input ke Plantware, verifikasi row sudah muncul di PR_ADTRANS lalu ubah hanya segmen `sync:` pada remarks manual adjustment. |
| `compare-adtrans/by-api-key` | `db_ptrj` → `extend_db_ptrj` | Mencari data real Plantware yang belum ada (`MISSING`) atau nominalnya beda (`MISMATCH`) di manual adjustment. |
| `reverse-compare-adtrans/by-api-key` | `extend_db_ptrj` → `db_ptrj` | Mencari manual adjustment yang masih ada padahal tidak ada/nol di Plantware (`EXTRA_IN_ADJUSTMENTS`) atau nominalnya beda (`MISMATCH`). |

---

### 6. POST `/payroll/manual-adjustment/sync-status/by-api-key`

Endpoint ini dipakai oleh browser automation atau agent lain setelah selesai input manual adjustment ke Plantware. Tujuannya bukan membuat nominal baru, tetapi memverifikasi data sudah masuk ke `db_ptrj` (`PR_ADTRANS`/`PR_ADTRANS_ARC`) lalu mengubah status `sync:` dan `match:` pada `remarks`.

Aturan penting:

- Memproses `PREMI`, `POTONGAN_KOTOR`, `POTONGAN_BERSIH`, dan `AUTO_BUFFER`.
- Mengubah segmen pipe `sync:<status>` dan `match:<status>` dari `remarks.split("|")`; segmen lain seperti adjustment name, task desc/ADCode, dan amount tidak diubah.
- Response setiap row harus punya `ad_code`, `ad_code_desc`, `ad_desc`, dan `task_desc` yang tidak null. Nilai diambil dari kolom structured jika ada, lalu parse remarks, lalu fallback `backend/data/premium_definitions.json`, lalu fallback terakhir `adjustment_name`.
- Jika `only_if_adtrans_exists=true`, total transaksi terkait dijumlahkan dulu. Row menjadi `sync:SYNC | match:MATCH` jika total sama, `sync:DIFF | match:MISMATCH` jika ada transaksi tapi total beda, dan `sync:MISS | match:MISMATCH` jika target non-zero tidak ada transaksi pembanding. Target `0` tanpa transaksi pembanding dihitung sebagai total `0`, jadi tetap `SYNC`.
- Untuk premi yang punya `metadata_json` detail, pembanding nominal memakai total detail metadata. Jika baru sebagian detail/subblok yang terinput di Plantware, row ditandai `sync:DIFF`, bukan dilewati.

Jangan tertukar dengan `sync-adtrans/by-api-key`. Endpoint `sync-adtrans` membuat atau mengubah data manual adjustment dari ADTRANS. Endpoint `sync-status` hanya menandai row manual adjustment yang sudah berhasil diinput ke Plantware.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `period_month` | number | yes | Bulan payroll/PhyMonth |
| `period_year` | number | yes | Tahun payroll/PhyYear |
| `division_code` / `estate` | string | no | Estate/LocCode seperti `AB1`; disarankan selalu isi |
| `gang_code` | string | no | Filter gang tertentu |
| `emp_code` | string | no | Filter employee tertentu |
| `adjustment_type` | string | no | `PREMI`, `POTONGAN_KOTOR`, `POTONGAN_BERSIH`, `AUTO_BUFFER`, atau comma-separated |
| `adjustment_types` | string[] | no | Alternatif array untuk type |
| `adjustment_name` | string | no | Filter nama adjustment |
| `ids` | number[] | no | Target row spesifik `payroll_manual_adjustments.id` |
| `sync_status` | string | no | Status tujuan, default `SYNC` |
| `only_if_adtrans_exists` | boolean | no | Jika `true`, verifikasi ke `db_ptrj` dulu sebelum update |
| `dry_run` | boolean | no | Jika `true`, hanya verifikasi dan preview, tidak update DB |
| `updated_by` | string | no | User/agent pencatat |
| `limit` | number | no | Batas row, default 1000, max 5000 |

**Cara endpoint memverifikasi ADTRANS:**

- Scope utama adalah `period_month`, `period_year`, `division_code`/`estate`, `gang_code`, `emp_code`, `adjustment_type`, `adjustment_name`, atau `ids`.
- Untuk `PREMI`, kategori ADTRANS adalah dokumen premi dinamis.
- Untuk `POTONGAN_KOTOR`, kategori ADTRANS adalah `koreksi` jika nama adjustment mengandung `KOREKSI`; selain itu dianggap `potongan`.
- Untuk `POTONGAN_BERSIH`, kategori ADTRANS dianggap `potongan`.
- Untuk `AUTO_BUFFER`, kategori ADTRANS adalah `jabatan`, `masa kerja`, `spsi`, atau `pph` berdasarkan `adjustment_name`.
- Matching memakai employee (`emp_code`), LocCode/estate, kategori DocDesc, dan teks TaskDesc/ADCode dari remarks/definition jika tersedia.
- Jika `metadata_json` punya detail, `target_amount` memakai total detail metadata. Ini penting untuk premi per subblok: row baru menjadi `SYNC` hanya kalau total ADTRANS sama dengan total detail yang seharusnya diinput.

**Flow browser automation yang disarankan:**

1. Ambil data input dari `GET /payroll/manual-adjustment/by-api-key?view=grouped&metadata_only=true`.
2. Browser automation input satu atau beberapa employee/detail ke Plantware.
3. Panggil endpoint ini dengan `only_if_adtrans_exists=true` dan `dry_run=true` untuk preview.
4. Review row yang akan menjadi `SYNC`, `DIFF`, atau `MISS`.
5. Jika hasil audit sesuai, panggil lagi dengan `dry_run=false`.

**Contoh dry run untuk AB1 premi:**

```bash
curl -X POST "http://localhost:8002/payroll/manual-adjustment/sync-status/by-api-key" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "period_month": 4,
    "period_year": 2026,
    "division_code": "AB1",
    "adjustment_type": "PREMI",
    "sync_status": "SYNC",
    "only_if_adtrans_exists": true,
    "dry_run": true,
    "updated_by": "browser_automation"
  }'
```

**Contoh update setelah dry run aman:**

```bash
curl -X POST "http://localhost:8002/payroll/manual-adjustment/sync-status/by-api-key" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "period_month": 4,
    "period_year": 2026,
    "division_code": "AB1",
    "adjustment_type": "PREMI",
    "sync_status": "SYNC",
    "only_if_adtrans_exists": true,
    "dry_run": false,
    "updated_by": "browser_automation"
  }'
```

**Contoh update satu row spesifik setelah input satu employee selesai:**

```bash
curl -X POST "http://localhost:8002/payroll/manual-adjustment/sync-status/by-api-key" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "period_month": 4,
    "period_year": 2026,
    "division_code": "AB1",
    "ids": [12345],
    "sync_status": "SYNC",
    "only_if_adtrans_exists": true,
    "dry_run": false,
    "updated_by": "browser_automation"
  }'
```

**Contoh update per gang setelah batch browser automation selesai:**

```bash
curl -X POST "http://localhost:8002/payroll/manual-adjustment/sync-status/by-api-key" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "period_month": 4,
    "period_year": 2026,
    "division_code": "AB1",
    "gang_code": "G1H",
    "adjustment_type": "PREMI",
    "sync_status": "SYNC",
    "only_if_adtrans_exists": true,
    "dry_run": false,
    "updated_by": "browser_automation"
  }'
```

**Contoh response nominal detail berbeda:**

```json
{
  "success": true,
  "data": {
    "matched_count": 1,
    "eligible_count": 1,
    "adtrans_matched_count": 1,
    "updated_count": 1,
    "partial_count": 0,
    "rows": [
      {
        "id": 14,
        "emp_code": "A0001",
        "adjustment_type": "PREMI",
        "adjustment_name": "PREMI PRUNING",
        "target_amount": 500000,
        "metadata_detail_total": 500000,
        "adtrans_amount": 350000,
        "ad_code": "AL3PM0601P1A",
        "ad_code_desc": "(AL) TUNJANGAN PREMI ((PM) PRUNING)",
        "ad_desc": "(AL) TUNJANGAN PREMI ((PM) PRUNING)",
        "task_desc": "(AL) TUNJANGAN PREMI ((PM) PRUNING)",
        "old_sync_status": "MANUAL",
        "new_sync_status": "DIFF",
        "match_status": "MISMATCH",
        "diff": -150000,
        "status": "UPDATED",
        "skip_reason": null,
        "remarks_before": "PREMI PRUNING | AL3PM0601P1A - PRUNING MANUAL | 500000 | sync:MANUAL | match:MANUAL",
        "remarks_after": "PREMI PRUNING | AL3PM0601P1A - PRUNING MANUAL | 500000 | sync:DIFF | match:MISMATCH"
      }
    ]
  }
}
```

**Field response utama:**

| Field | Arti |
|-------|------|
| `matched_count` | Jumlah row manual adjustment yang masuk filter awal |
| `eligible_count` | Row yang punya format remarks pipe dengan segmen `sync:` |
| `adtrans_matched_count` | Row yang menemukan transaksi cocok di ADTRANS |
| `updated_count` | Row yang remarks-nya benar-benar diubah |
| `unchanged_count` | Row yang sudah berada di target `sync_status` |
| `skipped_count` | Row yang dilewati karena tidak memenuhi syarat |
| `partial_count` | Field kompatibilitas lama; audit nominal berbeda sekarang ditulis sebagai `sync:DIFF` |
| `rows[]` | Detail keputusan per row, termasuk `remarks_before`, `remarks_after`, dan `skip_reason` |

Field ADCode per `rows[]`:

| Field | Arti |
|-------|------|
| `ad_code` | Kode AD/task code untuk input Plantware. Contoh `AL0018P1A`. Jika tidak ada kode pendek, fallback berisi TaskDesc/display text agar tidak null. |
| `ad_code_desc` | Deskripsi ADCode/TaskDesc. Ini field utama untuk AD_DESC. |
| `ad_desc` | Alias dari `ad_code_desc` untuk agent/browser automation yang memakai nama AD_DESC. |
| `task_desc` | TaskDesc final untuk matching dan tampilan. |

**Skip reason utama:**

| skip_reason | Arti |
|-------------|------|
| `SYNC_SEGMENT_NOT_FOUND` | Remarks tidak punya format pipe `sync:<status>` atau `match:<status>` |

---

### 7. POST `/payroll/manual-adjustment/sync-adtrans/by-api-key`

**Sync real-time** dari PR_ADTRANS (`db_ptrj`) ke `payroll_manual_adjustments` (`extend_db_ptrj`). Hanya mensync item yang **MISMATCH** atau **MISSING** berdasarkan hasil komparasi.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `period_month` | number | ✅ | Bulan (1-12) |
| `period_year` | number | ✅ | Tahun |
| `division_code` | string | ✅ | Kode divisi (e.g. `AB1`, `PG2A`) |
| `filters` | string[] | ❌ | Kategori filter (default: `['spsi', 'masa kerja', 'jabatan', 'pph', 'premi', 'koreksi', 'potongan']`) |
| `sync_mode` | string | ❌ | Mode sync: `MISSING_ONLY`, `MISMATCH_AND_MISSING`, `ALL` (default: `MISMATCH_AND_MISSING`) |
| `created_by` | string | ❌ | User pencatat (default: `sync_adtrans_api`) |

**Sync Modes:**

| Mode | Description |
|------|-------------|
| `MISSING_ONLY` | Hanya insert record yang belum ada di extend_db |
| `MISMATCH_AND_MISSING` | Insert yang belum ada + update yang nilainya beda (default) |
| `ALL` | Sync semua termasuk yang sudah MATCH (overwrite) |

**Example:**

```bash
# Sync default (MISMATCH + MISSING only)
curl -X POST "http://localhost:8002/payroll/manual-adjustment/sync-adtrans/by-api-key" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "period_month": 4,
    "period_year": 2026,
    "division_code": "AB1"
  }'

# Sync hanya yang missing (tidak overwrite yang sudah ada)
curl -X POST "http://localhost:8002/payroll/manual-adjustment/sync-adtrans/by-api-key" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "period_month": 4,
    "period_year": 2026,
    "division_code": "AB1",
    "sync_mode": "MISSING_ONLY"
  }'

# Force sync semua (overwrite match juga)
curl -X POST "http://localhost:8002/payroll/manual-adjustment/sync-adtrans/by-api-key" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "period_month": 4,
    "period_year": 2026,
    "division_code": "AB1",
    "sync_mode": "ALL"
  }'
```

**Response:**

```json
{
  "success": true,
  "message": "Sync completed: 15 records synced, 60 matches skipped",
  "data": {
    "division": "AB1",
    "period_month": 4,
    "period_year": 2026,
    "sync_mode": "MISMATCH_AND_MISSING",
    "total_compared": 75,
    "synced_count": 15,
    "skipped_match": 60,
    "synced_details": [
      {
        "emp_code": "G0010",
        "category": "jabatan",
        "adjustment_name": "TUNJANGAN JABATAN",
        "old_amount": 0,
        "new_amount": 150000,
        "action": "UPDATE"
      },
      {
        "emp_code": "G0015",
        "category": "masa kerja",
        "adjustment_name": "MASA KERJA",
        "old_amount": null,
        "new_amount": 25000,
        "action": "INSERT"
      }
    ]
  }
}
```

**Sync Behavior:**

- **INSERT**: Jika record tidak ada di `extend_db_ptrj` (status `MISSING`), buat record baru dengan `adjustment_type = 'AUTO_BUFFER'`.
- **UPDATE**: Jika record ada tapi nilainya beda (status `MISMATCH`), update amount dan remarks.
- **Remarks**: Setelah sync, remarks berformat `{adjustment_name} | {adcode} | {amount} | sync:SYNC | match:MATCH`.
- **Cache**: Cache payroll otomatis di-clear setelah sync agar data terbaru langsung terpakai.

**Data Flow:**

```text
PR_ADTRANS + PR_ADTRANS_ARC (db_ptrj)
  ↓ query by PhyMonth/PhyYear + LocCode
  ↓ group by EmpCode + DocDesc category
  ↓
compareAdtransWithAdjustments()
  ↓ compare with payroll_manual_adjustments (extend_db_ptrj)
  ↓ identify MATCH / MISMATCH / MISSING
  ↓
syncAdtransToAdjustments()
  ↓ INSERT missing records
  ↓ UPDATE mismatched records
  ↓ clear cache
  ↓
payroll_manual_adjustments (extend_db_ptrj) updated
```


---

# BAGIAN 10: DEPLOYMENT & PROXY RUNBOOK

# Proxy Payroll Runbook

## URL Contract

- Frontend proxy entry: `/upah`
- Frontend assets: `/upah/assets/*` and `/upah/images/*`
- Backend API through gateway: `/backend/upah/*`
- Payroll API through gateway: `/backend/upah/payroll/*`
- Local development API remains relative: `/payroll/*`

`frontend/src/utils/apiBase.js` is the canonical URL resolver. Explicit backend env values win. Proxy mode is selected when `VITE_PROXY_MODE=true`, browser path starts with `/upah`, or gateway port is `3001`.

## Env Rules

- For gateway/proxy deployment, do not set `VITE_BACKEND_URL` unless the frontend must bypass the proxy intentionally.
- Use `VITE_PROXY_MODE=true` for local proxy-mode smoke tests.
- Existing production build base remains `/upah/`.
- `VITE_BACKEND_URL`, `VITE_API_URL`, `VITE_API_BASE_URL`, and `VITE_BACKEND_BASE` are treated as explicit overrides and have trailing slashes trimmed.

## Smoke Checklist

1. Open `GET /upah` and confirm HTML loads.
2. Open one generated JS/CSS asset under `/upah/assets/*`; expect `200` and JS/CSS content type.
3. Open `GET /backend/upah/health`; expect `200` and `{ "status": "ok" }`.
4. Open `GET /backend/upah/payroll/locked/verify` without auth; expect `401`.
5. Open `GET /backend/upah/payroll/locked/verify` with gateway bearer token; expect `200` and `valid: true`.
6. Open `GET /backend/upah/payroll/premium-definitions` with auth; expect `200` and `success: true`.
7. Open `GET /backend/upah/payroll/report/division-raw-tree/stream?division_code=<DIV>&month=<M>&year=<Y>` with auth; expect SSE events, not HTML.

## Failure Signs

- API call returns `index.html`: frontend is using wrong base URL or proxy did not route `/backend/upah`.
- `/backend/upah/payroll/locked/verify` returns `404`: backend is stale or route group not mounted.
- Payroll screen loads forever for more than 45 seconds: stream idle watchdog should show retry/fallback; check browser Network for stalled SSE.
- Repeated redirect to login: gateway token is expired or not shared to frontend localStorage/cookie as expected.
- Server logs `Slow stream` or `Timeout boundary reached`: query/extractor path exceeded expected latency; inspect DB gateway and selected division/month.

## Rollback Notes

- Revert `apiBase` usage first if proxy URL resolution causes unexpected local behavior.
- Remove `/backend/upah` group only after proxy gateway no longer depends on that prefix.
- Keep `/payroll/locked/verify`; AuthContext uses it to avoid zombie sessions and endless loading.

---


---

# BAGIAN 11: PRD - OPTIMASI PERFORMA

# PRD — Optimasi Sistem Daftar Upah

**Status:** v1.1 — Eksekusi Phase 1-3 + Phase 4.4 selesai (2026-06-01)
**Tanggal:** 2026-06-01
**Author audit:** Kiro CLI (Opus 4.7) — handoff ke Sonnet
**Audience:** Engineer / agent yang akan mengerjakan implementasi
**Repo:** `D:\Gawean Rebinmas\PORTAL_ESTATE\Plantware_Auto_Report\Daftar_Upah_baru\payroll_daftar_upah\refactor_production`

## Status Eksekusi (2026-06-01)

### ✅ Selesai (branch: server-fix-1)

| Task | Commit | Keterangan |
|---|---|---|
| 1.4 Cleanup file root liar | de5fd21c | patch_frontend.cjs, .pytest_cache, dev scripts dihapus |
| 1.5 Dev scripts ke legacy_backend | de5fd21c | 25 file dipindah ke _dev_utils/scripts/legacy_backend/ |
| 1.6 Arsip CLAUDE.md + QWEN.md | de5fd21c | Dipindah ke docs/archive/ |
| 1.3 Cache invalidation spesifik | e90247c9 | invalidatePayroll() helper, drop clear() global |
| 1.2 Lazy load pages | fb216212 | 21 page report dikonversi ke lazy() |
| 1.7 Proxy route always mounted | 6085064e | /backend/upah unconditional |
| 1.1 Minify + compression | 6e37b9a9 | esbuild minify + gzip/brotli, bundle -50% |
| 2.1 Unique index migration | ebda5cbc | SQL di backend/sql/migrations/ (run manual) |
| 2.3 Batch endpoint | cb5d6c1b | POST /payroll/manual-edit/batch |
| 2.4 Frontend batch save | cb5d6c1b | 50 cell: ~10s → ~0.5s |
| 2.5 Optimistic UI | 6abb6a84 | cell-saving (biru) + cell-saved (hijau fade) |
| 2.6 Debounce resize | 6abb6a84 | 100ms debounce + RAF throttle drag-select |
| 3.2 Virtual row windowing | ff18c412 | ~12k <td> → ~600 <td> di DOM |
| 3.4 Compact mode toggle | 96a436fc | Font 10px, padding 1-3px, localStorage |
| 4.4 Rate limiter | 4fed5f6c | 60 req/10s per user di write endpoints |
| 3.3 Partial split | b7fdac21 | payrollTableFormatters.js extracted |

### ⏳ Belum dikerjakan

- **2.2** MERGE atomic upsert (test suite 130KB perlu refactor besar; unique index dari 2.1 sudah memberikan DB-level protection)
- **3.3** Split CustomPayrollTable.jsx lebih lanjut (partial done: formatters extracted)
- **4.1** Modularisasi dataExtractorService.ts (sudah ada extractors/ folder, tinggal facade)
- **4.2** Modularisasi manualAdjustmentService.ts
- **4.3** Pecah payroll.ts API (164KB, 68 endpoint)
- **4.5** Redis cache (optional)
- **4.6** mssql native pool (optional)

### Cara lanjutkan

```bash
git checkout server-fix-1
# Lanjut dari task yang belum selesai
```

Untuk deploy ke production:
1. Jalankan `cd frontend && npm run build`
2. Jalankan migration DB: `backend/sql/migrations/add_manual_adjustment_dedup_index.sql`
3. Restart backend: `cd backend && bun run start`

> **Cara pakai dokumen ini:** dokumen ini dirancang **self-contained**. Agent yang baru masuk tidak perlu membaca chat history sebelumnya. Cukup baca dokumen ini + file source code yang dirujuk per task. Setiap task punya file path + acceptance criteria + cara test + rollback.

---

## Daftar Isi

1. [Executive Summary](#1-executive-summary)
2. [Context & Tech Stack](#2-context--tech-stack)
3. [Problem Statement](#3-problem-statement)
4. [Goals & Non-Goals](#4-goals--non-goals)
5. [Success Metrics](#5-success-metrics)
6. [Audit Findings (Full Reference)](#6-audit-findings-full-reference)
7. [Solution Architecture](#7-solution-architecture)
8. [Phased Roadmap (4 minggu)](#8-phased-roadmap-4-minggu)
9. [Detailed Task Specs](#9-detailed-task-specs)
10. [Testing Strategy](#10-testing-strategy)
11. [Risks & Rollback](#11-risks--rollback)
12. [Handoff Notes](#12-handoff-notes-untuk-agent-berikutnya)
13. [Index Dokumen Pendukung](#13-index-dokumen-pendukung)

---

## 1. Executive Summary

Sistem **Daftar Upah** (payroll register) mengalami masalah performa serius pada skenario nyata user di estate:

- Monitor lama (1366×768 atau 1280×1024) dengan zoom Windows 125–150%
- PC lambat (HDD, RAM 4 GB)
- Banyak user concurrent (5–20 user) yang melakukan banyak request edit (premi, manual adjustment)

Audit menemukan **3 akar masalah utama** + codebase yang sangat berantakan:

1. **Bundle production tidak diminify + semua page diimport statis** — initial JS load berukuran puluhan MB
2. **`CustomPayrollTable.jsx` (254 KB) merender ±12.000 `<td>` tanpa virtualisasi** — layout/paint sangat berat
3. **Cache backend di-`clear()` global tiap save + save serial dengan race condition** — concurrent user saling memperlambat dan ada risiko data ganda/hilang

Plus: 29+ worktree dormant, 247+ dev script, 4 panduan agent paralel, file root liar.

**Outcome target setelah 4 minggu eksekusi:**
- Initial bundle turun ≥60%
- Render & scroll Daftar Upah smooth di PC lambat dengan 200+ employee × 60+ kolom
- Save 50 cell edit selesai <1 detik (sebelumnya 5–15 detik)
- Zero race condition pada manual adjustment (atomic upsert)
- Concurrent throughput naik 3–5× via cache invalidation spesifik
- Repo bersih: tidak ada file root liar, dev script terpisah jelas

---

## 2. Context & Tech Stack

### 2.1 Modul Daftar Upah

**Frontend** (`frontend/`):
- React 18 + Vite 5 + React Router 7
- Entry: `frontend/src/main.jsx` → `frontend/src/App.jsx` (55 KB)
- Page utama: `frontend/src/pages/MainPage.jsx` (88 KB) — wrapper Daftar Upah
- Komponen tabel: `frontend/src/components/CustomPayrollTable.jsx` (**254 KB**, monolith)
- Stream data: `frontend/src/hooks/usePayrollStream.js` (SSE consumer)
- Service layer: `frontend/src/services/manualAdjustmentService.js`, `payrollService.js`, dst.
- Bundle dependencies berat: `ag-grid-enterprise`, `recharts`, `exceljs`, `html2pdf.js`

**Backend** (`backend/`):
- Bun runtime + Elysia framework
- Entry: `backend/src/index.ts` (14 KB)
- Konfigurasi: `backend/src/config.ts`
- Route: `backend/src/api/payroll.ts` (**158 KB**, 67 endpoint)
- Service utama:
  - `backend/src/services/dataExtractorService.ts` (**271 KB**) — ekstraksi payroll dari DB
  - `backend/src/services/manualAdjustmentService.ts` (**130 KB**) — CRUD manual adjustment
  - `backend/src/services/summaryService.ts` (103 KB)
  - `backend/src/services/taxReportService.ts` (99 KB)
  - `backend/src/services/historyDatabaseService.ts` (98 KB)
  - `backend/src/services/cacheService.ts` (in-memory Map cache)
- DB access: `backend/src/db/client.ts` — **tidak pakai mssql native**, kirim query via HTTP ke Python SQL Gateway (`Additional_services/query_gateway/`)

### 2.2 Build & Run

| Command | Tujuan |
|---|---|
| `cd frontend && npm run dev:test` | Vite dev server di port 5175 |
| `cd frontend && npm run build` | Build production ke `frontend/dist/` |
| `cd backend && bun run dev` | Backend watch mode |
| `cd backend && bun run start` | Backend produksi |
| `cd backend && bun test` | Run all backend tests |
| `cd frontend && npx vitest run <file>` | Run frontend test focused |

### 2.3 Konvensi Repo (dari `AGENTS.md`)

- Backend: TypeScript, indentasi 4 spasi, semicolon, camelCase
- Frontend: React/JS, indentasi 2 spasi
- Service logic di `backend/src/services/`, route validation di `backend/src/api/`
- Test file: `<unit>.test.ts` / `<unit>.test.js`
- Conventional commits (`fix:`, `feat:`, `docs:`, `chore:`)
- Wajib jalankan `bun test src/services/manualAdjustmentService.test.ts` sebelum selesai pekerjaan manual-adjustment

---

## 3. Problem Statement

### 3.1 Pain Point User (verbatim dari laporan)

> "Daftar upah... peforma UI yang akan dibuka di monitor jadul yang memiliki zoom tinggi, terus komputer yang lambat... pengisian premi, edit mode dan lain-lain... lebih ringan, teroptimasi untuk jalan di banyak user, banyak request user melakukan request banyak."

### 3.2 Skenario kerja nyata di estate

1. **Krani gang** (1 user per gang) buka Daftar Upah di akhir bulan untuk verifikasi premi 200+ karyawan × 60+ kolom (HK, lembur, premi brondol/pruning/raking, potongan, THR, PPh21).
2. **Saat tombol "Edit Mode" diaktifkan**, krani isi puluhan cell premi/potongan secara cepat (cell-to-cell tab/enter).
3. **Tombol Save** → user expect feedback cepat. Realitanya 5–15 detik freeze karena save serial.
4. **5–10 krani sekaligus** save di gang berbeda → semua jadi lambat karena cache di-clear global.
5. **Monitor 1366×768 dengan Windows zoom 150%** → viewport efektif sempit + browser harus paint ribuan cell → scroll tersendat.

### 3.3 Symptom yang dilaporkan

- "Lemot saat scroll tabel"
- "Freeze saat klik Save"
- "Kadang data yang sudah disimpan hilang lagi" (indikasi race condition)
- "Buka pertama kali lama banget" (initial bundle besar)
- "Pas zoom in tabel jadi makin patah-patah" (paint pressure)

### 3.4 Codebase complexity yang menghambat fix

- 29+ worktree (`.worktrees/*`, `.claude/worktrees/agent-*`) — dev mudah salah edit
- 247+ script di `_dev_utils/scripts/` tanpa README — sulit tahu mana yang masih relevan
- 4 panduan agent paralel di root (`CLAUDE.md`, `AGENTS.md`, `QWEN.md`, `.qwen/`, `.claude/`, `.agent/`, `.superpowers/`) — onboarding bingung
- Dev script bersanding dengan service production di `backend/src/services/` (`verify_final.ts`, `debug_query.ts`, `reseed_wks.ts`, `check_history_*.ts`)
- File root liar: `test_check_adtrans.ts`, `test_seed.ts`, `temp_employee_detail_rewrite.ps1`, `frontend/patch_frontend.cjs`, `frontend/patch_frontend_dec_tax.js`, `CUsersnbgmf.claudeplans...md`




---

## 4. Goals & Non-Goals

### 4.1 Goals (in scope)

**G1. Performa rendering UI**
- Daftar Upah harus dapat di-scroll smooth (≥30 fps) di PC: Intel Core i3 gen 4, RAM 4 GB, HDD, monitor 1366×768, zoom Windows 150%.
- Buka pertama kali (cold load) <8 detik di koneksi LAN estate (10–20 Mbps).
- Edit mode: tab antar cell tanpa lag persepsi (<100 ms).

**G2. Performa save edit (premi, manual adjustment, override)**
- Save 50 cell edit selesai <1 detik (P95).
- Save 10 cell edit selesai <300 ms (P50).
- Optimistic UI: cell tampak "saved" segera, rollback bila gagal.

**G3. Concurrency**
- 20 user concurrent edit di gang berbeda — tidak saling memperlambat (cache invalidation spesifik per gang/division).
- Save manual adjustment harus atomic (zero duplikat, zero data hilang) walaupun 2 user save cell yang sama bersamaan.

**G4. Kebersihan codebase**
- Tidak ada file root liar (`test_*.ts`, `temp_*.ps1`, `patch_frontend*.js`, dst) di luar `_dev_utils/`.
- Tidak ada dev script di `backend/src/services/` (`verify_*`, `debug_*`, `reseed_*`, `check_*` di luar struktur service real).
- Worktree dormant (`.worktrees/*`, `.claude/worktrees/*`) di-prune.
- Satu sumber dokumentasi agent (`AGENTS.md`); panduan lain diarsipkan.
- File komponen `CustomPayrollTable.jsx` ≤ 50 KB per modul setelah split.

### 4.2 Non-Goals (out of scope)

- **Tidak** mengubah business logic perhitungan payroll (THR, PPh21, BPJS, dst). Hanya optimasi performa, struktur, dan concurrency.
- **Tidak** mengganti Bun/Elysia ke framework lain.
- **Tidak** mengganti Vite ke bundler lain.
- **Tidak** mengubah skema database existing (kecuali menambah index yang aman dan unique constraint untuk dedup manual adjustment).
- **Tidak** redesign UI/UX visual (warna, layout, alur tombol). Cuma jika perlu untuk perbaikan rendering (mis. compact mode toggle).
- **Tidak** mengganti cara akses DB dari Python SQL Gateway ke driver native — itu di Phase 4 (strategic), bisa ditunda.

---

## 5. Success Metrics

### 5.1 Quantitative KPI

| KPI | Baseline (estimasi) | Target | Cara ukur |
|---|---|---|---|
| Initial JS bundle (gzipped) | ~8–12 MB | ≤ 3 MB | `ls -lh frontend/dist/assets/*.js` + browser DevTools Network |
| First contentful paint Daftar Upah | ~10 detik | ≤ 4 detik | Chrome Lighthouse mobile preset di PC simulasi lambat |
| DOM nodes saat tabel ditampilkan | ~12.000 | ≤ 1.500 | DevTools Performance → DOM count |
| Save 50 cell edit (P95) | ~10 detik | ≤ 1 detik | Manual stopwatch + log timing di service |
| Cache hit rate (5 user concurrent edit) | ~10% | ≥ 70% | `cacheService.getStats()` endpoint baru |
| Race condition pada manual adjustment | Possible | 0 | Stress test 50 concurrent save sama emp+name |

### 5.2 Qualitative

- Krani gang melaporkan "tabel terasa lebih ringan" di monitor lama.
- Tim dev tidak lagi confused mana script aktif vs usang.
- PR baru pada modul Daftar Upah tidak harus baca file 254 KB dalam 1 file.

### 5.3 Way to verify

Setiap selesai phase, jalankan:

1. **Frontend test:** `cd frontend && npx vitest run`
2. **Backend test:** `cd backend && bun test`
3. **Build test:** `cd frontend && npm run build` (cek size output)
4. **Smoke test manual:** buka Daftar Upah, edit 5 cell, save, pastikan data persist setelah refresh.
5. **Stress test concurrency** (Phase 3): script bun yang spawn 20 concurrent POST `/payroll/manual-edit` dengan gang berbeda; ukur waktu total + cek tidak ada duplikat row.

---

## 6. Audit Findings (Full Reference)

> Setiap finding di bawah ada bukti file path + nomor baris. Agent yang implement bisa langsung buka file untuk konfirmasi sebelum mengubah.

### Finding A — Vite production tidak diminify

**File:** `frontend/vite.config.js` (line ±163)

```js
build: {
  chunkSizeWarningLimit: 1600,
  minify: false, // TEMPORARY: Disable minification to debug TDZ error
  rollupOptions: { output: { manualChunks: { ... } } }
}
```

**Bukti dampak:**
- Bundle production tidak diminify → 5–10× lebih besar dari yang seharusnya.
- Comment "TEMPORARY" sudah lama (workaround TDZ error yang tidak pernah di-fix).
- Tidak ada `vite-plugin-compression` untuk gzip/brotli.

**Akar masalah TDZ error:** kemungkinan circular import atau `lazy()` yang dipakai di file dengan order import yang salah. Harus didebug, bukan diworkaround.

---

### Finding B — App.jsx static import semua page besar

**File:** `frontend/src/App.jsx` (line ±37–80)

```jsx
// Lazy load pages - TEMPORARILY STATIC
import DashboardHome from './pages/DashboardHome'
import ProfessionalDashboard from './pages/ProfessionalDashboard'
import EmployeeDetailRoute from './pages/EmployeeDetailRoute'
...
import CustomPayrollTable from './components/CustomPayrollTable'   // 254 KB
import TaxReportPage from './pages/TaxReportPage'                  // 117 KB
import ExecutivePayrollPage from './pages/ExecutivePayrollPage'    // 92 KB
import SummaryReportPage from './pages/SummaryReportPage'          // 93 KB
import WagesSummaryRebinmasPage from './pages/WagesSummaryRebinmasPage' // 92 KB
import EmployeeDirectoryAnalytics from './pages/EmployeeDirectoryAnalytics' // 77 KB
import OtherIncomesPage from './pages/OtherIncomesPage'            // 60 KB
import AggregationSeederPage from './pages/AggregationSeederPage'  // 63 KB
import TonaseAnalysisReportPage from './pages/TonaseAnalysisReportPage' // 59 KB
... (30+ pages total)
```

**Hanya 1 page yang lazy:**

```jsx
const ComponentMetadataTestPage = lazy(() => import('./pages/ComponentMetadataTestPage'))
```

**Dampak:** Saat user buka login, browser load semua page raksasa + ag-grid-enterprise + recharts + exceljs + html2pdf di initial bundle.

---

### Finding C — CustomPayrollTable.jsx tabel native tanpa virtualisasi

**File:** `frontend/src/components/CustomPayrollTable.jsx` (254 KB, single file)

**Render structure** (line ±4789, 4944, 4982):

```jsx
<table className="payroll-table" ref={tableRef}>
  <thead>
    {headerRows.map((hRow, rIdx) => (
      <tr key={`hr-${rIdx}`}>...</tr>
    ))}
  </thead>
  <tbody>
    {displayRows.map((row, rIdx) => {           // 200+ employee rows
      ...
      return (
        <tr ...>
          {renderColumnDefs.map((col, cIdx) => { // 60+ kolom dinamis
            return <td ...>...</td>
          })}
        </tr>
      );
    })}
  </tbody>
</table>
```

**Drag-select handler** (line ±2800–2830):

```jsx
const handleMouseOver = (rowIndex, colIndex) => {
  if (isSelecting && selection.length > 0) {
    const start = selection[0];
    const newSelection = [];
    const minR = Math.min(start.r, rowIndex), maxR = Math.max(start.r, rowIndex);
    const minC = Math.min(start.c, colIndex), maxC = Math.max(start.c, colIndex);
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        newSelection.push({ r, c });   // O(n*m) per mouseover, tidak throttle
      }
    }
    setSelection(newSelection);
  }
};
```

**Resize listener tanpa debounce** (line ±4244, 4255):

```jsx
useEffect(() => {
  const onResize = () => {
    syncTableContainerWidth();
    syncHorizontalScrollState();
  };
  window.addEventListener('resize', onResize);
  return () => window.removeEventListener('resize', onResize);
}, [...]);

useEffect(() => {
  const observer = new ResizeObserver(() => {
    syncTableContainerWidth(container);
    syncHorizontalScrollState(container);
  });
  observer.observe(container);
  if (table) observer.observe(table);
  return () => observer.disconnect();
}, [...]);
```

**Counts:**
- 139 hooks (useMemo/useCallback/memo/useState/useEffect/useRef)
- 82 `.map/.filter/.reduce/.sort` calls
- 0 virtualisasi (no react-window, no AG Grid `rowVirtualization`)
- 11 `axios`/`fetch` direct calls dari component (line 1206, 1726, 1740, 1764, 1793, 1846, 1932, 1946, 2139, 2422)

**Dampak:** Untuk 200 employee × 60 col = ~12.000 `<td>` di DOM. Setiap zoom/scroll/resize browser harus relayout semua. Di PC lambat + monitor jadul = scroll patah-patah.

---

### Finding D — Save edit serial (for...of await)

**File:** `frontend/src/components/CustomPayrollTable.jsx` (line ±1700–1900, fungsi `saveEditedManualCells`)

```jsx
// Phase 1: master tax (PTKP)
for (const edit of masterTaxEdits) {
  const res = await axios.put(`tax-report/ptkp/${encodeURIComponent(edit.nik)}`, ...);
  if (res.data?.success) successCount++;
}

// Phase 2: jabatan estate
for (const edit of jobTitleEdits) {
  const { data } = await axios.post('employee-estate/update', ...);
  if (data?.success) successCount++;
}

// Phase 3: profile overrides
for (const profile of profileItems) {
  const res = await fetch(buildBackendUrl('/payroll/overrides/profile'), ...);
  if (res.ok) successCount++;
}

// Phase 4: value overrides
for (const value of valueItems) {
  const res = await fetch(buildBackendUrl('/payroll/overrides/values'), ...);
  ...
}

// Phase 5: legacy manual edits
for (const edit of legacyEdits) {
  const res = await fetch(buildBackendUrl('/payroll/manual-edit'), ...);
  ...
}

// Phase 6: other income edits
for (const k of otherIncomeEdits) {
  const res = await fetch(buildBackendUrl('/payroll/locked/pendapatan-lainnya-edit'), ...);
  ...
}

// Phase 7: deleted columns
for (const deletion of pendingDeletedColumns) {
  await deleteManualAdjustmentColumn(token, deletion.params);
}
```

**Dampak:** 50 cell × ~150 ms latency = 7.5 detik blocking UI. Tidak ada batch, tidak ada Promise.all, tidak ada optimistic UI.



---

### Finding E — Cache invalidation terlalu agresif

**File:** `backend/src/api/payroll.ts`

**Pattern bahaya 1 — clear by month/year (line 587, 682, 733, 869, 928, 1450, 1676, 1729, 2058, 2097, 2161, 3010):**

```ts
// Setelah setiap save manual-edit / manual-adjustment / seed-auto-buffer:
const pattern = `:${data.period_month}:${data.period_year}`;
cacheService.clearByPattern(pattern);
console.log(`[PayrollRoutes] Cleared cache for pattern: ${pattern} after manual edit`);
```

Cache key format (`backend/src/services/cacheService.ts` `buildPayrollKey`):
```
payroll:{gangCode}:{month}:{year}:{divisionCode}:{H|L}{:Vn?}
```

`clearByPattern(":${month}:${year}")` cocok dengan SEMUA gang × SEMUA division. Berarti save di 1 gang invalidate cache user lain di gang/division berbeda.

**Pattern bahaya 2 — clear total (line 977, 1005, 1053):**

```ts
// /payroll/overrides/profile
.post("/overrides/profile", async ({ body, currentUser, set }) => {
  ...
  cacheService.clear();  // ⚠️ Wipe SELURUH cache server!
})

// /payroll/overrides/values, /payroll/overrides/join-date — sama
```

**Dampak nyata:**
- 1 admin update jabatan 1 employee → 50 user lain kehilangan semua cache → semua reload dari DB → DB spike + UI lambat semua user.
- 5 user concurrent edit gang berbeda → cache thrashing terus-menerus, hit rate <10%.

**Solusi target:** invalidate spesifik per `(gang, division, month, year)` saja.

---

### Finding F — saveAdjustment race condition (no atomic upsert)

**File:** `backend/src/services/manualAdjustmentService.ts` (line 2161 — `public async saveAdjustment`)

```ts
// 1. SELECT TOP 1 cocok (period, emp_code, type, name) dari table
const existing = await db.queryOne<{ id: number }>(`
    SELECT TOP 1 id FROM dbo.payroll_manual_adjustments
    WHERE period_month = ? AND period_year = ?
    AND (emp_code = ? OR nik = ? OR emp_code = ?)
    AND adjustment_type = ?
    AND ${normalizedAdjustmentNameSql} = ?
    ORDER BY ...
`, [...]);

// 2. Conditional INSERT atau UPDATE
if (existing) {
  if (shouldDeleteStoredAdjustment(...)) {
    await db.query(`DELETE FROM dbo.payroll_manual_adjustments WHERE id = ?`, [existing.id]);
  } else {
    await db.query(`UPDATE dbo.payroll_manual_adjustments SET amount = ?, ... WHERE id = ?`, [...]);
  }
} else {
  if (shouldDeleteStoredAdjustment(...)) return 0;
  const result = await db.query(`INSERT INTO dbo.payroll_manual_adjustments (...) OUTPUT INSERTED.id VALUES (...)`, [...]);
  return result[0]?.id;
}
```

**Issue:**
- TIDAK pakai `WITH (UPDLOCK, HOLDLOCK)` di SELECT.
- TIDAK pakai transaksi eksplisit (`BEGIN TRAN ... COMMIT`).
- TIDAK pakai `MERGE` statement atomic.
- TIDAK ada unique index pada `(period_month, period_year, emp_code, adjustment_type, adjustment_name)`.

**Skenario race:**
- T0: User A SELECT → return NULL.
- T0+5ms: User B SELECT → return NULL (A belum INSERT).
- T0+10ms: User A INSERT row id=100.
- T0+15ms: User B INSERT row id=101 (duplikat).
- Hasil: 2 row untuk kombinasi yang sama. Saat dibaca dengan `SELECT TOP 1` di-`ORDER BY id DESC` → user A "data hilang", padahal sebenarnya tetap ada di id=100 tapi tidak ditampilkan karena id=101 menang.

---

### Finding G — DB akses lewat HTTP gateway (latency tambahan)

**File:** `backend/src/db/client.ts` (line ±120–180)

```ts
public async query<T = any>(sql: string, params?: ..., timeout?: number): Promise<T[]> {
    const { sql: preparedSql, params: preparedParams } = this.prepareParams(sql, params);
    let attempt = 0;
    let delay = 500;
    const maxRetries = Config.DB_QUERY_RETRIES;

    while (attempt <= maxRetries) {
        try {
            const body = { sql: preparedSql, params: preparedParams, server: this.serverProfile, database: this.databaseName, timeout: queryTimeout };
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), queryTimeout * 1000);
            const response = await fetch(`${this.baseUrl}/v1/query`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-api-key": this.apiKey },
                body: JSON.stringify(body),
                signal: controller.signal
            });
            ...
        } catch (error) {
            // exponential backoff retry
            await new Promise(r => setTimeout(r, delay));
            delay = Math.min(delay * 2, 2000);
            attempt++;
        }
    }
}
```

**Dampak:**
- Setiap query payroll = 1 HTTP roundtrip Bun → Python Gateway → SQL Server.
- Bun tidak punya connection pool langsung; pool ada di Python gateway (single instance).
- Latency floor +30–80 ms per query dibanding `mssql` driver native.
- Untuk endpoint berat (5–10 query) tambahan total 150–800 ms.

**Catatan:** ini di Phase 4 (strategic). Bisa ditunda bila Phase 1-3 sudah cukup.

---

### Finding H — N+1 di seed/import manual adjustment

**File:** `backend/src/services/manualAdjustmentService.ts`

Pola `for (...of...) { await db.query(...) }` muncul di line 273, 324, 325, 551, 554, 1111, 1419, 1485, 1512, 1515, 1586, 1913, 1927, 2036, 2108.

Beberapa wajar (loop kecil), tapi:
- `seedAutoBufferToManualAdjustments` (line ±2030–2050): loop semua employee dalam gang × semua adjustment type, INSERT serial.
- `importPremiumExcel`: loop tiap row excel, INSERT serial.
- `deleteAdjustmentColumn` (line ±2300+): SELECT semua id matching, lalu DELETE single statement (ok), tapi SELECT-nya bisa besar.

**Dampak:** Seed buffer auto 1 gang besar (50 employee × 5 adjustment) = 250 INSERT serial × 50 ms = 12 detik blocking endpoint.

---

### Finding I — payrollRoutes mounted dua kali

**File:** `backend/src/index.ts` (line ±260–285)

```ts
.use(payrollRoutes)                                      // Mount #1 di root
.group("/backend/upah", app => app
    .use(authRoutes)
    .use(usersRoutes)
    .use(reportsRoutes)
    .use(payrollRoutes)                                  // Mount #2 di /backend/upah
    .use(employeeRoutes)
    ...
)
```

**Dampak:**
- Memori router 2× untuk 67 endpoint payroll.
- Risiko inkonsistensi bila satu mount di-update tapi yang lain tidak.
- SPA fallback `*` di akhir bisa menelan path API jika urutan plugin terbalik.

**Solusi target:** factory function `apiPlugin(app)` dipakai sekali untuk root + (kondisional) `/backend/upah` via env flag, dengan helper bersama supaya satu source of truth.

---

### Finding J — Backend service raksasa (sulit dimaintain)

| File | Size | Catatan |
|---|---|---|
| `backend/src/services/dataExtractorService.ts` | **271 KB** | Ekstraksi semua komponen payroll dari DB; harus dipecah per komponen |
| `backend/src/services/manualAdjustmentService.ts` | **130 KB** | CRUD + import excel + sync adtrans + validation |
| `backend/src/services/manualAdjustmentService.test.ts` | **130 KB** | Test file ikut raksasa |
| `backend/src/services/summaryService.ts` | **103 KB** | |
| `backend/src/services/taxReportService.ts` | **99 KB** | |
| `backend/src/services/historyDatabaseService.ts` | **98 KB** | |
| `backend/src/services/dashboardService.ts` | **74 KB** | |
| `backend/src/services/taxReportExcelService.ts` | **66 KB** | |
| `backend/src/api/payroll.ts` | **158 KB** | 67 endpoint dalam 1 file |
| `backend/src/api/taxReportRoutes.ts` | **73 KB** | |
| `backend/src/api/aggregationSeederRoutes.ts` | **57 KB** | |
| `backend/src/api/historyRoutes.ts` | **42 KB** | |
| `backend/src/api/employee.ts` | **51 KB** | |

**Folder yang sudah ada untuk modularisasi (tinggal dipakai):**
- `backend/src/services/payroll/` — sudah ada `BasePayrollComponentService.ts`, `PayrollNormalizationService.ts`, `PayrollComponentRegistry.ts`, folder `extractors/`, `formulas/`, `manualAdjustments/`, `otherIncomes/`, `components/`. Belum dipakai konsisten.

---

### Finding K — Codebase mess

**Worktree dormant:**
- `.worktrees/auto-buffer-potongan-pph`, `.worktrees/history-new-nik-daftar-upah`, `.worktrees/premi-angkut-subblok-override`, `.worktrees/nik-ptrj-empcode-resolution`, `.worktrees/payroll-overlay-history` (5)
- `.claude/worktrees/agent-*` (24+)

**File root liar:**
- `test_check_adtrans.ts` (562 B)
- `test_seed.ts` (968 B)
- `temp_employee_detail_rewrite.ps1` (18 KB)
- `CUsersnbgmf.claudeplans-saya-berencana-...md` (67 B — file path jadi nama karena typo)
- `frontend/patch_frontend.cjs` (18 KB)
- `frontend/patch_frontend_dec_tax.js` (18 KB)
- `backend/update_docs.ts` (1.8 KB) — tidak jelas dipakai untuk apa

**Dev script di lokasi production:**

`backend/src/services/`:
- `verify_final.ts`, `debug_query.ts`, `reseed_wks.ts`, `check_history_divisions.ts`, `check_history_gangs.ts`, `verify_l1h.ts`

`backend/src/tests/`:
- `check_db.ts`, `check_db2.ts`, ..., `check_db16.ts`, `check_extend_db_schema.ts`, `check_extend_db_schema2.ts`, `check_history_data.ts`

`_dev_utils/scripts/`:
- 247+ file (.ts dan .py), banyak yang `_once.ts` (one-off migration) yang seharusnya sudah selesai dieksekusi

**Multi-agent docs di root:**
- `CLAUDE.md` (19 KB), `AGENTS.md` (3 KB), `QWEN.md` (15 KB)
- Folder: `.qwen/`, `.claude/`, `.agent/`, `.superpowers/`, `context_portal/`, `.agentMemory/`

**Cache directory tidak relevan:**
- `.pytest_cache/` di root padahal proyek utama bukan Python (kecuali sebagian script di `_dev_utils/`)




---

## 7. Solution Architecture

### 7.1 High-level approach

Pendekatan **bertahap** (4 phase) supaya setiap phase aman untuk di-deploy dan reversible:

```
Phase 1 (Quick Wins, 1 minggu)
   ├─ Build & bundle (minify, lazy, compression)
   ├─ Cache invalidation spesifik (drop *.clear() global)
   └─ Cleanup repo (worktree, file root liar, dev script)
        │
        ▼
Phase 2 (Edit UX & Concurrency Correctness, 1 minggu)
   ├─ Atomic upsert manual adjustment (MERGE + unique index)
   ├─ Batch endpoint POST /payroll/manual-edit/batch
   ├─ Frontend save flow pakai batch + Promise.all + optimistic UI
   └─ Debounce resize/observer
        │
        ▼
Phase 3 (Rendering Performance, 1 minggu)
   ├─ Virtualisasi body tabel (react-window atau AG Grid)
   ├─ Split CustomPayrollTable.jsx ke 5-6 modul
   └─ Compact mode toggle untuk monitor sempit
        │
        ▼
Phase 4 (Scaling & Modularization, 1 minggu)
   ├─ Modularisasi dataExtractorService & manualAdjustmentService
   ├─ (Optional) Redis cache untuk multi-instance
   ├─ (Optional) mssql native pool jika gateway latency masih jadi bottleneck
   └─ Rate-limit endpoint write
```

### 7.2 Prinsip desain

1. **Setiap PR ≤ 500 baris diff** kalau bisa. Phase besar dipecah menjadi PR kecil per task.
2. **Setiap task punya feature flag / env toggle** kalau perubahan beresiko (mis. `USE_BATCH_MANUAL_EDIT`, `USE_VIRTUALIZED_TABLE`).
3. **Jangan mengubah business logic** payroll. Hanya cara render, cara save, cara cache.
4. **Test wajib** sebelum merge: minimal `bun test src/services/manualAdjustmentService.test.ts` untuk perubahan manual-adjustment, plus smoke test manual buka Daftar Upah.
5. **Konsisten dengan AGENTS.md** (4-space backend, 2-space frontend, conventional commits).
6. **Tiap perubahan cache → log invalidation pattern** supaya bisa diaudit.

### 7.3 Dependency graph antar phase

- Phase 1 → independen, bisa dimulai langsung.
- Phase 2 (atomic upsert) **tidak boleh** dilakukan sebelum Phase 1.3 (cache invalidation diperbaiki) — karena MERGE atomic + cache nuke = race condition baru di cache layer.
- Phase 3 (virtualisasi) **boleh paralel** dengan Phase 2 (beda file utama: render vs save flow), tapi kalau sumber daya terbatas, kerjakan Phase 2 dulu (correctness > performance).
- Phase 4 strategis, opsional jika Phase 1-3 sudah memenuhi target metrics.

---

## 8. Phased Roadmap (4 minggu)

### Phase 1 — Quick Wins (Minggu 1)

| Task ID | Judul | Effort | Risk |
|---|---|---|---|
| 1.1 | Aktifkan minify production + brotli/gzip | 0.5 hari | Medium (TDZ error harus di-fix dulu) |
| 1.2 | Lazy load semua page besar di App.jsx | 1 hari | Low |
| 1.3 | Cache invalidation spesifik (drop `clear()` global) | 0.5 hari | Low-Medium |
| 1.4 | Cleanup worktree + file root liar | 0.5 hari | Low |
| 1.5 | Cleanup dev script di backend/src/services/ + backend/src/tests/ | 0.5 hari | Low |
| 1.6 | Konsolidasi dokumentasi agent (single AGENTS.md) | 0.5 hari | Low |
| 1.7 | Hapus duplicate route mount /backend/upah | 0.5 hari | Medium (proxy mode harus tetap jalan) |

**Phase 1 deliverable:** initial bundle <3 MB gzipped, cache hit rate >50% saat 5 user concurrent, repo bersih.

### Phase 2 — Edit UX & Concurrency Correctness (Minggu 2)

| Task ID | Judul | Effort | Risk |
|---|---|---|---|
| 2.1 | Tambah unique index `payroll_manual_adjustments` | 0.5 hari | Medium (perlu migrasi DB hati-hati, mungkin ada duplikat existing) |
| 2.2 | Refactor `saveAdjustment` ke MERGE atomic | 1 hari | Medium |
| 2.3 | Tambah endpoint `POST /payroll/manual-edit/batch` | 1 hari | Low |
| 2.4 | Frontend save flow pakai batch + Promise.all | 1 hari | Medium |
| 2.5 | Optimistic UI untuk cell yang sedang disimpan | 1 hari | Medium |
| 2.6 | Debounce resize observer di CustomPayrollTable | 0.5 hari | Low |

**Phase 2 deliverable:** save 50 cell <1 detik P95, zero race condition, optimistic UI feedback.

### Phase 3 — Rendering Performance (Minggu 3)

| Task ID | Judul | Effort | Risk |
|---|---|---|---|
| 3.1 | Spike: pilih virtualisasi (react-window vs AG Grid) | 0.5 hari | Low |
| 3.2 | Implementasi virtualisasi body tabel | 2 hari | High (semua interaksi harus tetap jalan) |
| 3.3 | Split CustomPayrollTable.jsx ke 5-6 modul | 2 hari | Medium |
| 3.4 | Compact mode toggle (font/padding lebih kecil untuk monitor sempit) | 0.5 hari | Low |

**Phase 3 deliverable:** DOM nodes <1.500, scroll smooth di PC simulasi lambat, file komponen <50 KB per modul.

### Phase 4 — Scaling & Modularization (Minggu 4)

| Task ID | Judul | Effort | Risk |
|---|---|---|---|
| 4.1 | Modularisasi `dataExtractorService.ts` ke `services/payroll/extractors/` | 2 hari | Medium |
| 4.2 | Modularisasi `manualAdjustmentService.ts` | 1 hari | Medium |
| 4.3 | Pecah `payroll.ts` API ke beberapa file resource | 1 hari | Medium |
| 4.4 | Rate-limit `/manual-edit` per user (token bucket) | 0.5 hari | Low |
| 4.5 | (Optional) Redis cache pengganti Map | 1 hari | Medium |
| 4.6 | (Optional) Spike `mssql` native pool vs gateway | 1 hari | Medium |

**Phase 4 deliverable:** file service ≤ 80 KB, rate-limit aktif, opsional scale-out ready.




---

## 9. Detailed Task Specs

> Setiap task: **What** (deliverable konkret), **Why** (referensi finding), **Files to touch**, **Step-by-step**, **Acceptance criteria**, **Test commands**, **Rollback**.

### Phase 1: Quick Wins

#### Task 1.1 — Aktifkan minify production + compression

**What:** Production build Vite menghasilkan file JS yang diminify dan dikompres (brotli/gzip).

**Why:** Finding A. `minify: false` membuat bundle 5–10× lebih besar dari seharusnya, parser browser sangat sibuk di PC lambat.

**Files to touch:**
- `frontend/vite.config.js`
- `frontend/package.json` (tambah devDependency `vite-plugin-compression`)

**Step-by-step:**

1. **Debug TDZ error dulu.** Jangan langsung enable minify. Jalankan:
   ```bash
   cd frontend && npm run build
   ```
   Catat error message dan stack trace.
2. Cari root cause TDZ: kemungkinan circular import. Pakai `madge`:
   ```bash
   npx madge --circular frontend/src
   ```
3. Bila ditemukan circular import, refactor (pindahkan shared logic ke util terpisah).
4. Bila TDZ karena lazy + variabel di outer scope, fix dengan `useMemo` atau move declaration ke dalam component.
5. Setelah build sukses, install plugin compression:
   ```bash
   cd frontend && npm install --save-dev vite-plugin-compression@^0.5.1
   ```
6. Update `vite.config.js`:
   ```js
   import compression from 'vite-plugin-compression'
   ...
   plugins: [
     react(),
     compression({ algorithm: 'gzip', ext: '.gz' }),
     compression({ algorithm: 'brotliCompress', ext: '.br' })
   ],
   ...
   build: {
     chunkSizeWarningLimit: 1600,
     minify: 'esbuild', // GANTI dari false
     rollupOptions: { output: { manualChunks: {
       'vendor-react': ['react', 'react-dom'],
       'vendor-ag-grid': ['ag-grid-community', 'ag-grid-react', 'ag-grid-enterprise'],
       'vendor-excel': ['exceljs', 'file-saver'],
       'vendor-pdf': ['html2pdf.js'],
       'vendor-utils': ['axios', 'js-cookie'],
       'vendor-recharts': ['recharts']  // tambahan: pisah recharts
     } } }
   }
   ```

**Acceptance criteria:**
- `npm run build` sukses tanpa error.
- Output di `frontend/dist/assets/`: ada file `.js.gz` dan `.js.br` per chunk.
- Total ukuran `*.js` (uncompressed) turun ≥40%.
- `*.js.br` total ≤ 3 MB.
- Smoke test: jalankan `npm run preview`, buka browser, login, buka MainPage. Tidak ada console error.

**Test commands:**
```bash
cd frontend
npm run build
ls -lh dist/assets/*.js dist/assets/*.js.br
npm run preview
# Browser: buka http://localhost:5175, login, buka Daftar Upah
```

**Rollback:**
- Revert `vite.config.js` ke `minify: false`.
- `npm uninstall vite-plugin-compression`.
- Hapus import compression dari config.

---

#### Task 1.2 — Lazy load page besar

**What:** Semua page report besar diimport via `lazy()` + `<Suspense>` supaya hanya di-load saat user navigasi ke route tersebut.

**Why:** Finding B. Saat ini semua 30+ page diimport statis di App.jsx. Bundle awal mengandung ag-grid-enterprise + recharts + exceljs + html2pdf bahkan untuk halaman login.

**Files to touch:**
- `frontend/src/App.jsx`

**Step-by-step:**

1. Identifikasi page yang paling besar (≥50 KB):
   - `TaxReportPage` (117 KB)
   - `SummaryReportPage` (93 KB)
   - `WagesSummaryRebinmasPage` (92 KB)
   - `ExecutivePayrollPage` (92 KB)
   - `EmployeeDirectoryAnalytics` (77 KB)
   - `AggregationSeederPage` (63 KB)
   - `OtherIncomesPage` (60 KB)
   - `TonaseAnalysisReportPage` (59 KB)
   - `MillProductionReport` (37 KB)
   - `PayrollAnalysisPage` (32 KB)
   - `ImpactReportPage` (42 KB)
   - `AnalysisReportPage` (36 KB)
   - `WagesSummaryIJLPage` (38 KB)
   - `onlyIJLReportPages` (43 KB)
   - `ProductivityReportPage` (28 KB)
   - `GangComparisonReportPage` (27 KB)
   - `UpahBersihDetailPage` (27 KB)
   - `DataVerificationPage` (22 KB)

2. **Jangan lazy:**
   - `LoginPage` (selalu butuh untuk login)
   - `DashboardHome` (entry setelah login)
   - `MainPage` (halaman utama Daftar Upah)
   - `CustomPayrollTable` (komponen child MainPage; nanti di Phase 3 displit beda)

3. Update `frontend/src/App.jsx`:
   ```jsx
   import { lazy, Suspense } from 'react'
   import LoadingScreen from './components/common/LoadingScreen'

   // Tetap statis (entry critical):
   import LoginPage from './pages/LoginPage'
   import DashboardHome from './pages/DashboardHome'
   import ProfessionalDashboard from './pages/ProfessionalDashboard'
   import MainPage from './pages/MainPage'  // bila ada import langsung
   import CustomPayrollTable from './components/CustomPayrollTable'

   // Lazy:
   const TaxReportPage = lazy(() => import('./pages/TaxReportPage'))
   const SummaryReportPage = lazy(() => import('./pages/SummaryReportPage'))
   const WagesSummaryRebinmasPage = lazy(() => import('./pages/WagesSummaryRebinmasPage'))
   const ExecutivePayrollPage = lazy(() => import('./pages/ExecutivePayrollPage'))
   const EmployeeDirectoryAnalytics = lazy(() => import('./pages/EmployeeDirectoryAnalytics'))
   const AggregationSeederPage = lazy(() => import('./pages/AggregationSeederPage'))
   const OtherIncomesPage = lazy(() => import('./pages/OtherIncomesPage'))
   const TonaseAnalysisReportPage = lazy(() => import('./pages/TonaseAnalysisReportPage'))
   const MillProductionReport = lazy(() => import('./pages/MillProductionReport'))
   const PayrollAnalysisPage = lazy(() => import('./pages/PayrollAnalysisPage'))
   const ImpactReportPage = lazy(() => import('./pages/ImpactReportPage'))
   const AnalysisReportPage = lazy(() => import('./pages/AnalysisReportPage'))
   const WagesSummaryIJLPage = lazy(() => import('./pages/WagesSummaryIJLPage'))
   const onlyIJLReportPages = lazy(() => import('./pages/onlyIJLReportPages'))
   const ProductivityReportPage = lazy(() => import('./pages/ProductivityReportPage'))
   const GangComparisonReportPage = lazy(() => import('./pages/GangComparisonReportPage'))
   const UpahBersihDetailPage = lazy(() => import('./pages/UpahBersihDetailPage'))
   const DataVerificationPage = lazy(() => import('./pages/DataVerificationPage'))
   const HighEarnerReportPage = lazy(() => import('./pages/HighEarnerReportPage'))
   const SalaryRangeDetailPage = lazy(() => import('./pages/SalaryRangeDetailPage'))
   const SpreadsheetSyncPage = lazy(() => import('./pages/SpreadsheetSyncPage'))
   const DetailedSalaryAnalysisPage = lazy(() => import('./pages/DetailedSalaryAnalysisPage'))
   ```

4. Bungkus `<Routes>` dengan `<Suspense>`:
   ```jsx
   <Suspense fallback={<LoadingScreen />}>
     <Routes>
       <Route path="/login" element={<LoginPage />} />
       <Route path="/dashboard" element={<DashboardHome />} />
       <Route path="/main" element={<MainPage />} />
       <Route path="/tax-report" element={<TaxReportPage />} />
       ... dst
     </Routes>
   </Suspense>
   ```

5. Test setiap route navigation. Pastikan loading screen muncul sebentar lalu halaman ter-render.

**Acceptance criteria:**
- Initial bundle main entry chunk turun ≥40% (ukur via `npm run build` size output).
- Setiap navigasi ke page lazy tampil loading screen sebentar lalu halaman normal.
- Tidak ada `Error: Failed to fetch dynamically imported module` di console.
- Smoke test: login → dashboard → MainPage → TaxReport → SummaryReport → WagesSummary. Semua harus loadable.

**Test commands:**
```bash
cd frontend
npm run build
# Cek ukuran file index*.js di dist/assets/
npx vitest run
```

**Rollback:**
- Revert `App.jsx` ke versi statis import.
- Tidak ada migrasi DB / data, hanya code.

---

#### Task 1.3 — Cache invalidation spesifik (drop global clear)

**What:** Backend hanya invalidate cache untuk `(gang, division, month, year)` yang spesifik affected, tidak `clear()` global atau pattern bulan utuh.

**Why:** Finding E. Saat ini setiap save manual edit / override menghapus cache untuk semua gang/division di bulan tersebut, bahkan untuk override `cacheService.clear()` total. Saat banyak user concurrent edit, cache hit rate <10%.

**Files to touch:**
- `backend/src/api/payroll.ts` (line 587, 682, 733, 764, 869, 928, 977, 1005, 1053, 1450, 1676, 1729, 1777, 2001, 2058, 2097, 2161, 3010)
- `backend/src/services/cacheService.ts` (mungkin tambah helper `invalidatePayroll()`)

**Step-by-step:**

1. Tambah helper di `cacheService.ts`:
   ```ts
   /**
    * Invalidate cache untuk satu set (gang, division, month, year).
    * Lebih spesifik dari clearByPattern.
    */
   public invalidatePayroll(opts: {
       month: number;
       year: number;
       divisionCode?: string | null;
       gangCode?: string | null;
   }): number {
       const monthYearSuffix = `:${opts.month}:${opts.year}:`;
       let count = 0;
       for (const key of this.cache.keys()) {
           if (!key.startsWith('payroll:')) continue;
           if (!key.includes(monthYearSuffix)) continue;
           // Format: payroll:{gang}:{month}:{year}:{division}:{H|L}{:Vn}
           if (opts.gangCode) {
               const expectedGang = `payroll:${opts.gangCode}:`;
               if (!key.startsWith(expectedGang) && !key.startsWith('payroll:ALL:')) continue;
           }
           if (opts.divisionCode) {
               // division ada di posisi setelah year
               const after = key.substring(key.indexOf(monthYearSuffix) + monthYearSuffix.length);
               const divFromKey = after.split(':')[0];
               if (divFromKey !== opts.divisionCode && divFromKey !== 'ALL') continue;
           }
           this.cache.delete(key);
           count++;
       }
       return count;
   }
   ```

2. Di `backend/src/api/payroll.ts`, ganti SEMUA `cacheService.clearByPattern(`:${month}:${year}`)` dan `cacheService.clear()` dengan:
   ```ts
   cacheService.invalidatePayroll({
       month: data.period_month,
       year: data.period_year,
       divisionCode: data.division_code,
       gangCode: data.gang_code,
   });
   ```

3. Untuk endpoint `/overrides/profile`, `/overrides/values`, `/overrides/join-date` (line 977, 1005, 1053):
   - Profile/values/join-date affect satu employee di gang+division tertentu
   - Invalidate spesifik: `{ month, year, divisionCode: payload.division_code, gangCode: payload.gang_code }`
   - Bila payload tidak punya gang_code, lookup dulu dari emp_code → gang.

4. Tambah unit test di `backend/src/services/cacheService.test.ts`:
   ```ts
   it('invalidates only specific gang/division', () => {
       cacheService.set('payroll:G1:5:2026:DIV1:L', { x: 1 });
       cacheService.set('payroll:G2:5:2026:DIV1:L', { x: 2 });
       cacheService.set('payroll:G1:5:2026:DIV2:L', { x: 3 });
       cacheService.invalidatePayroll({ month: 5, year: 2026, divisionCode: 'DIV1', gangCode: 'G1' });
       expect(cacheService.get('payroll:G1:5:2026:DIV1:L')).toBeNull();
       expect(cacheService.get('payroll:G2:5:2026:DIV1:L')).not.toBeNull();
       expect(cacheService.get('payroll:G1:5:2026:DIV2:L')).not.toBeNull();
   });
   ```

**Acceptance criteria:**
- Test `cacheService.test.ts` pass.
- Saat 5 concurrent edit di gang berbeda (gunakan stress script di section 10), cache hit rate ≥70%.
- Save endpoint masih bekerja normal (data persist setelah refresh).

**Test commands:**
```bash
cd backend
bun test src/services/cacheService.test.ts
bun test src/services/manualAdjustmentService.test.ts
```

**Rollback:**
- Revert API file changes (git revert per file).
- Helper `invalidatePayroll` tidak perlu dihapus (idle, tidak harm).

---

#### Task 1.4 — Cleanup worktree + file root liar

**What:** Hapus worktree dormant, file root liar, dan dev script yang tidak ada di tempat yang benar.

**Why:** Finding K. Worktree dan file liar mengganggu dev experience dan memori disk.

**Files to delete (KONFIRMASI USER DULU sebelum delete):**

**Worktree:**
- `.worktrees/auto-buffer-potongan-pph/`
- `.worktrees/history-new-nik-daftar-upah/`
- `.worktrees/premi-angkut-subblok-override/`
- `.worktrees/nik-ptrj-empcode-resolution/`
- `.worktrees/payroll-overlay-history/`
- `.claude/worktrees/agent-*/` (24+ folder)

**File root liar:**
- `test_check_adtrans.ts`
- `test_seed.ts`
- `temp_employee_detail_rewrite.ps1`
- `CUsersnbgmf.claudeplans-saya-berencana-...md`
- `frontend/patch_frontend.cjs`
- `frontend/patch_frontend_dec_tax.js`

**Cache directory:**
- `.pytest_cache/`

**Step-by-step:**

1. **Cek dulu dengan user:** apakah worktree masih ada branch aktif?
   ```bash
   git worktree list
   git branch --list
   ```
2. Untuk worktree yang aman dihapus:
   ```bash
   git worktree remove .worktrees/auto-buffer-potongan-pph --force
   git worktree remove .worktrees/history-new-nik-daftar-upah --force
   ...
   ```
   Untuk `.claude/worktrees/agent-*`:
   ```bash
   # Cek dulu mana yang punya commit unik (tidak ada di branch lain)
   for dir in .claude/worktrees/agent-*; do
     git -C "$dir" log -1 --format="%H %s" 2>/dev/null
   done
   # Bila aman, prune
   git worktree prune
   rm -rf .claude/worktrees/agent-*
   ```
3. File root liar:
   ```bash
   git rm test_check_adtrans.ts test_seed.ts temp_employee_detail_rewrite.ps1 \
          'CUsersnbgmf.claudeplans-saya-berencana-unutk-mebangun-elegant-falcon-agent-a9ea0e92f56d533d5.md'
   git rm frontend/patch_frontend.cjs frontend/patch_frontend_dec_tax.js
   rm -rf .pytest_cache
   ```
4. Tambah `.pytest_cache/` ke `.gitignore` kalau belum ada.
5. Commit:
   ```
   chore: cleanup dormant worktrees and stray root files
   ```

**Acceptance criteria:**
- `git worktree list` hanya menampilkan main worktree (atau yang sengaja masih dipakai).
- `ls D:/.../refactor_production/` tidak menampilkan file `test_*.ts`, `temp_*.ps1`, `CUsersnbgmf*.md`.
- `git status` clean setelah commit.
- Smoke test: backend & frontend masih bisa dijalankan normal.

**Test commands:**
```bash
git worktree list
ls -la
cd backend && bun run dev   # Ctrl+C setelah start
cd ../frontend && npm run dev:test   # Ctrl+C setelah start
```

**Rollback:**
- File yang dihapus via `git rm` bisa di-restore: `git checkout HEAD~1 -- <file>`.
- Worktree yang sudah di-`remove --force` perlu di-add ulang: `git worktree add <path> <branch>`.
- **Saran:** sebelum cleanup, push semua branch ke remote dulu supaya recovery aman.




---

#### Task 1.5 — Cleanup dev script di backend/src/

**What:** Pindahkan dev/debug script dari `backend/src/services/` dan `backend/src/tests/` ke `_dev_utils/` atau hapus.

**Why:** Finding K. Dev script bersanding dengan service production menyebabkan confusion (mana yang aktif vs usang) dan ikut ter-bundle di import resolution.

**Files to move/delete:**

**`backend/src/services/` (pindah ke `_dev_utils/scripts/legacy_backend/` atau hapus):**
- `verify_final.ts` (1.1 KB)
- `debug_query.ts` (1.9 KB)
- `reseed_wks.ts` (957 B)
- `check_history_divisions.ts` (974 B)
- `check_history_gangs.ts` (1.2 KB)
- `verify_l1h.ts` (1 KB)

**`backend/src/tests/` (hapus, ini bukan unit test, ini ad-hoc db check):**
- `check_db.ts`, `check_db2.ts` ... `check_db16.ts` (16 file)
- `check_extend_db_schema.ts`, `check_extend_db_schema2.ts`
- `check_history_data.ts`
- `create_manual_adjustments_table.ts` (3.4 KB) — ini schema DDL, kalau masih relevan pindah ke `backend/sql/migrations/`

**Step-by-step:**

1. Buat folder arsip:
   ```bash
   mkdir -p _dev_utils/scripts/legacy_backend
   ```
2. Cek apakah file dev di-`import` oleh kode production:
   ```bash
   cd backend
   grep -rn "from.*services/verify_final" src/
   grep -rn "from.*services/debug_query" src/
   grep -rn "from.*services/reseed_wks" src/
   grep -rn "from.*services/check_history" src/
   grep -rn "from.*services/verify_l1h" src/
   ```
3. Bila tidak ada import dari production code → safe to move:
   ```bash
   git mv backend/src/services/verify_final.ts _dev_utils/scripts/legacy_backend/
   git mv backend/src/services/debug_query.ts _dev_utils/scripts/legacy_backend/
   git mv backend/src/services/reseed_wks.ts _dev_utils/scripts/legacy_backend/
   git mv backend/src/services/check_history_divisions.ts _dev_utils/scripts/legacy_backend/
   git mv backend/src/services/check_history_gangs.ts _dev_utils/scripts/legacy_backend/
   git mv backend/src/services/verify_l1h.ts _dev_utils/scripts/legacy_backend/
   ```
4. Cek `backend/src/tests/check_db*.ts`:
   ```bash
   grep -rn "from.*tests/check_db" backend/src/
   ```
5. Bila tidak ada import → hapus:
   ```bash
   cd backend/src/tests
   git rm check_db.ts check_db2.ts check_db3.ts check_db4.ts check_db5.ts check_db6.ts \
          check_db7.ts check_db8.ts check_db9.ts check_db10.ts check_db11.ts check_db12.ts \
          check_db13.ts check_db14.ts check_db15.ts check_db16.ts \
          check_extend_db_schema.ts check_extend_db_schema2.ts check_history_data.ts
   ```
6. `create_manual_adjustments_table.ts` — bila isi-nya `CREATE TABLE`, pindah ke `backend/sql/migrations/` dengan rename:
   ```bash
   git mv backend/src/tests/create_manual_adjustments_table.ts backend/sql/migrations/00X_create_manual_adjustments_table.sql.ts
   ```
7. Tulis README di `_dev_utils/scripts/legacy_backend/README.md`:
   ```md
   # Legacy backend dev scripts
   File ini di-archive dari `backend/src/services/` dan `backend/src/tests/`.
   Dipindahkan agar tidak tercampur dengan service production.
   Bila masih dibutuhkan, jalankan dengan: `bun run _dev_utils/scripts/legacy_backend/<file>`
   ```
8. Commit:
   ```
   chore(backend): archive dev scripts out of src/services and src/tests
   ```

**Acceptance criteria:**
- `backend/src/services/` hanya berisi service real (tidak ada `verify_*`, `debug_*`, `reseed_*`, `check_*`).
- `backend/src/tests/` hanya berisi `*.test.ts` (atau folder kosong jika tidak ada test).
- Backend masih jalan: `cd backend && bun run start` sukses, endpoint `/payroll/divisions` masih response.
- `bun test` lulus.

**Test commands:**
```bash
cd backend
bun run start &
sleep 3
curl http://localhost:8002/payroll/current-period
kill %1
bun test
```

**Rollback:**
- File hanya dipindah, bisa dikembalikan dengan `git mv` reverse.
- File yang dihapus via `git rm` recoverable lewat `git checkout HEAD~1 -- <path>`.

---

#### Task 1.6 — Konsolidasi dokumentasi agent

**What:** Satu sumber utama dokumentasi agent (`AGENTS.md`); panduan agent lain (`CLAUDE.md`, `QWEN.md`, `.qwen/`, `.claude/`, `.agent/`, `.superpowers/`, `context_portal/`, `.agentMemory/`) diarsipkan.

**Why:** Finding K. 4 panduan agent paralel di root + 6 folder konfigurasi agent membuat onboarding bingung.

**Step-by-step:**

1. Pastikan `AGENTS.md` sudah lengkap (ringkasan struktur repo, build command, coding style, testing, commit). Saat ini sudah lengkap; jangan ubah kecuali ada update.
2. Buat folder arsip:
   ```bash
   mkdir -p docs/archive/agent-history
   ```
3. Pindahkan dokumentasi agent lama:
   ```bash
   git mv CLAUDE.md docs/archive/agent-history/CLAUDE.md
   git mv QWEN.md docs/archive/agent-history/QWEN.md
   ```
4. Folder konfigurasi agent — **konfirmasi user dulu** apakah masih dipakai:
   - `.qwen/`, `.claude/` (worktree sudah dihapus di task 1.4), `.agent/`, `.superpowers/`, `context_portal/`, `.agentMemory/`
   - Bila tidak dipakai: pindahkan ke `docs/archive/agent-history/` atau hapus.
   - Bila masih dipakai (mis. `.claude/settings.local.json`): biarkan tapi tambahkan ke `.gitignore` supaya per-developer.
5. Update `AGENTS.md` tambah catatan:
   ```md
   ## Dokumentasi historis
   Panduan agent versi sebelumnya diarsipkan di `docs/archive/agent-history/`.
   ```
6. Commit:
   ```
   docs: consolidate agent guides into AGENTS.md
   ```

**Acceptance criteria:**
- Root repo hanya punya 1 file `AGENTS.md` (tidak ada `CLAUDE.md`, `QWEN.md`).
- `docs/archive/agent-history/` berisi panduan lama untuk referensi.
- `.gitignore` sudah meng-cover folder konfigurasi per-developer.

**Rollback:**
- `git mv` reverse, kembalikan file ke root.

---

#### Task 1.7 — Hapus duplicate route mount

**What:** `payrollRoutes` (dan plugin lainnya) hanya di-mount sekali, dengan dukungan optional `/backend/upah` prefix via env flag.

**Why:** Finding I. Saat ini route dimount 2× (root + `/backend/upah`), DRY violation, risiko inkonsistensi.

**Files to touch:**
- `backend/src/index.ts`
- `backend/src/config.ts` (tambah `PROXY_MOUNT` flag)

**Step-by-step:**

1. Tambah flag di `config.ts`:
   ```ts
   export const Config = {
     ...
     PROXY_MOUNT: process.env.PROXY_MOUNT === 'true',  // default false
   };
   ```
2. Refactor `backend/src/index.ts`:
   ```ts
   const apiPlugin = (app: Elysia) => app
     .use(authRoutes)
     .use(usersRoutes)
     .use(reportsRoutes)
     .use(payrollRoutes)
     .use(employeeRoutes)
     .use(employeeEstateRoutes)
     .use(tunjanganRoutes)
     .use(aggregationSeederRoutes)
     .use(spreadsheetRoutes)
     .use(summaryRoutes)
     .use(dashboardRoutes)
     .use(historyRoutes)
     .use(wagesRoutes)
     .use(logsRoutes)
     .use(devConfigRoutes)
     .use(taxReportRoutes)
     .use(employeeHrDataRoutes)
     .use(employeeGangHistoryRoutes)
     .use(employeeComparisonRoutes)
     .use(otherIncomesRoutes)
     .group("/api/mill-production", n => n.use(millProductionRoutes));

   let app = new Elysia()
     .use(cors())
     .use(...) // static plugin
     .use(apiPlugin);

   if (Config.PROXY_MOUNT) {
     app = app.group("/backend/upah", g => g.use(apiPlugin));
   }

   app
     .get("*", async ({ request, set }) => { ... }) // SPA fallback
     .listen({ port: Config.PORT, hostname: Config.HOST });
   ```
3. **PENTING:** test deployment di proxy mode (kalau di production proxy yang prefix `/upah/`):
   - Set `PROXY_MOUNT=true` di env.
   - `curl http://server/backend/upah/payroll/current-period` harus response.
   - `curl http://server/payroll/current-period` juga harus response (legacy).

**Acceptance criteria:**
- Tanpa env flag (`PROXY_MOUNT=false` default), endpoint hanya di root, lebih ringan.
- Dengan `PROXY_MOUNT=true`, endpoint di root DAN di `/backend/upah/`.
- Test backend `bun test` lulus.

**Test commands:**
```bash
cd backend
bun run start &
sleep 3
curl http://localhost:8002/payroll/current-period
PROXY_MOUNT=true bun run start &
sleep 3
curl http://localhost:8002/backend/upah/payroll/current-period
```

**Rollback:** revert `backend/src/index.ts`.

---

### Phase 2: Edit UX & Concurrency Correctness

#### Task 2.1 — Tambah unique index `payroll_manual_adjustments`

**What:** Database constraint untuk mencegah duplikat kombinasi `(period_month, period_year, emp_code, adjustment_type, adjustment_name)` setelah dinormalisasi.

**Why:** Finding F. Race condition pada `saveAdjustment`. Tanpa unique index, MERGE atomic tetap bisa gagal jika ada duplikat existing.

**Files to touch:**
- `backend/sql/migrations/` — tambah file migration baru

**Step-by-step:**

1. **Audit duplikat existing dulu** (ada kemungkinan duplikat dari race condition lama):
   ```sql
   -- Run di SSMS atau via gateway:
   SELECT period_month, period_year, emp_code, adjustment_type,
          UPPER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(adjustment_name, CHAR(9), ' '), CHAR(10), ' '), CHAR(13), ' ')))) AS norm_name,
          COUNT(*) AS cnt
   FROM dbo.payroll_manual_adjustments
   GROUP BY period_month, period_year, emp_code, adjustment_type,
            UPPER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(adjustment_name, CHAR(9), ' '), CHAR(10), ' '), CHAR(13), ' '))))
   HAVING COUNT(*) > 1;
   ```
2. Bila ada duplikat: tulis script remediasi `_dev_utils/scripts/dedupe_manual_adjustments_once.ts` yang:
   - Untuk setiap grup duplikat, simpan row dengan `id` paling baru, hapus yang lama.
   - Atau merge: jumlahkan amount (kalau itu yang benar secara bisnis — KONFIRMASI USER).
3. Buat migration `backend/sql/migrations/YYYY_MM_DD_unique_manual_adjustment_dedup.sql`:
   ```sql
   -- Ensure normalized name column exists (computed)
   IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name='adjustment_name_norm' AND object_id=OBJECT_ID('dbo.payroll_manual_adjustments'))
   BEGIN
       ALTER TABLE dbo.payroll_manual_adjustments
       ADD adjustment_name_norm AS (UPPER(LTRIM(RTRIM(
           REPLACE(REPLACE(REPLACE(REPLACE(adjustment_name, CHAR(9), ' '), CHAR(10), ' '), CHAR(13), ' '), CHAR(160), ' ')
       )))) PERSISTED;
   END

   IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_pma_dedup' AND object_id=OBJECT_ID('dbo.payroll_manual_adjustments'))
   BEGIN
       CREATE UNIQUE INDEX UX_pma_dedup
       ON dbo.payroll_manual_adjustments(period_month, period_year, emp_code, adjustment_type, adjustment_name_norm)
       WHERE emp_code IS NOT NULL;
   END

   -- Tambah index pendukung query GET (Finding J helper)
   IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_pma_period_div_emp' AND object_id=OBJECT_ID('dbo.payroll_manual_adjustments'))
   BEGIN
       CREATE INDEX IX_pma_period_div_emp
       ON dbo.payroll_manual_adjustments(period_month, period_year, division_code, emp_code)
       INCLUDE (adjustment_type, adjustment_name, amount);
   END
   ```
4. Run migration via Python gateway atau SSMS. Wajib backup DB dulu.
5. Update `manualAdjustmentService.ts` `buildNormalizedSqlNameExpression()` agar konsisten dengan computed column.

**Acceptance criteria:**
- Query `SELECT name FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.payroll_manual_adjustments')` menampilkan `UX_pma_dedup` dan `IX_pma_period_div_emp`.
- Insert duplikat (period+emp+type+name yang sama) gagal dengan error 2627 (unique constraint violation).
- Tidak ada duplikat existing (audit query return 0 row).

**Test commands:**
```bash
cd backend
bun test src/services/manualAdjustmentService.test.ts
# Manual: SSMS → run audit query
```

**Rollback:**
```sql
DROP INDEX IF EXISTS UX_pma_dedup ON dbo.payroll_manual_adjustments;
DROP INDEX IF EXISTS IX_pma_period_div_emp ON dbo.payroll_manual_adjustments;
ALTER TABLE dbo.payroll_manual_adjustments DROP COLUMN IF EXISTS adjustment_name_norm;
```

---

#### Task 2.2 — Refactor saveAdjustment ke MERGE atomic

**What:** Ganti pattern SELECT-then-INSERT/UPDATE dengan satu MERGE statement atomic, atau gunakan `INSERT ... ON DUPLICATE KEY UPDATE` style yang menangani conflict via unique index.

**Why:** Finding F. Race condition tanpa transaksi → duplikat / data hilang.

**Files to touch:**
- `backend/src/services/manualAdjustmentService.ts` (line 2161, fungsi `saveAdjustment`)

**Step-by-step:**

1. Pastikan Task 2.1 (unique index) sudah live di DB.
2. Refactor `saveAdjustment`:
   ```ts
   public async saveAdjustment(data: ManualAdjustment, user?: string): Promise<number> {
       data = normalizeManualAdjustmentForSave(data);
       const parsedAmount = parseFloat(data.amount.toString()) || 0;
       const normalizedAdjustmentName = normalizeStoredAdjustmentName(data.adjustment_name);
       const normalizedDivisionCode = normalizeManualAdjustmentDivisionCode(data.division_code);
       const hasMetadataJsonInput = Object.prototype.hasOwnProperty.call(data, 'metadata_json');
       let metadataJsonStr = serializeManualAdjustmentMetadata(data.metadata_json);
       const detailTotalSync = resolveDetailTotalSync(data, normalizedAdjustmentName, metadataJsonStr, parsedAmount);
       metadataJsonStr = detailTotalSync.metadataJsonStr;
       const effectiveAmount = detailTotalSync.amount;
       validatePremiumAdjustmentDefinition(data, normalizedAdjustmentName);
       validateManualAdjustmentAdCode(data);
       const remarks = buildManualAdjustmentRemarks(data);
       const db = this.getDatabase();
       await this.ensureManualAdjustmentIdentitySchema(db);
       const identity = await resolveManualAdjustmentIdentity(data);
       const empName = identity.empName;

       if (data.adjustment_type === 'PENDAPATAN_LAINNYA') {
           return await this.saveOtherIncome(db, { ...data, adjustment_name: normalizedAdjustmentName, remarks: remarks || undefined }, effectiveAmount, user);
       }

       // Atomic upsert via MERGE
       if (shouldDeleteStoredAdjustment(effectiveAmount, data.remarks, !!metadataJsonStr)) {
           // Delete branch - bisa langsung DELETE WHERE
           await db.query(`
               DELETE FROM dbo.payroll_manual_adjustments
               WHERE period_month = ? AND period_year = ?
                 AND emp_code = ? AND adjustment_type = ?
                 AND adjustment_name_norm = UPPER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(REPLACE(?, CHAR(9), ' '), CHAR(10), ' '), CHAR(13), ' '), CHAR(160), ' '))))
           `, [data.period_month, data.period_year, identity.empCode, data.adjustment_type, normalizedAdjustmentName]);
           return 0;
       }

       // MERGE upsert
       const result = await db.query<{ id: number }>(`
           MERGE dbo.payroll_manual_adjustments WITH (HOLDLOCK) AS tgt
           USING (
               SELECT
                   ? AS period_month, ? AS period_year, ? AS emp_code, ? AS nik, ? AS emp_name,
                   ? AS gang_code, ? AS division_code, ? AS adjustment_type, ? AS adjustment_name,
                   ? AS amount, ? AS remarks, ? AS metadata_json, ? AS user_name
           ) AS src
           ON tgt.period_month = src.period_month
              AND tgt.period_year = src.period_year
              AND tgt.emp_code = src.emp_code
              AND tgt.adjustment_type = src.adjustment_type
              AND tgt.adjustment_name_norm = UPPER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(REPLACE(src.adjustment_name, CHAR(9), ' '), CHAR(10), ' '), CHAR(13), ' '), CHAR(160), ' '))))
           WHEN MATCHED THEN UPDATE SET
               nik = src.nik,
               gang_code = COALESCE(NULLIF(LTRIM(RTRIM(src.gang_code)), ''), tgt.gang_code),
               division_code = COALESCE(src.division_code, tgt.division_code),
               amount = src.amount,
               remarks = src.remarks,
               ${hasMetadataJsonInput ? 'metadata_json = src.metadata_json,' : ''}
               emp_name = src.emp_name,
               updated_at = GETDATE(),
               updated_by = src.user_name
           WHEN NOT MATCHED THEN INSERT (
               period_month, period_year, emp_code, nik, emp_name, gang_code, division_code,
               adjustment_type, adjustment_name, amount, remarks, metadata_json, created_by
           ) VALUES (
               src.period_month, src.period_year, src.emp_code, src.nik, src.emp_name,
               src.gang_code, src.division_code, src.adjustment_type, src.adjustment_name,
               src.amount, src.remarks, src.metadata_json, src.user_name
           )
           OUTPUT INSERTED.id;
       `, [
           data.period_month, data.period_year, identity.empCode, identity.nik, empName,
           data.gang_code, normalizedDivisionCode, data.adjustment_type, normalizedAdjustmentName,
           effectiveAmount, remarks, metadataJsonStr, user || 'system'
       ]);

       const id = result[0]?.id || 0;

       // Auto-save preset (best-effort, di luar transaksi)
       try { /* preset upsert seperti existing */ } catch (e) { /* silent */ }

       return id;
   }
   ```
3. Update test `manualAdjustmentService.test.ts`:
   - Tambah test "concurrent save same key" (jalankan 5 Promise.all saveAdjustment dengan key yang sama, expect hanya 1 row di DB di akhir).
   - Pastikan test existing masih lulus.

**Acceptance criteria:**
- `bun test src/services/manualAdjustmentService.test.ts` lulus.
- Concurrent test (5 Promise.all save same key) menghasilkan tepat 1 row di DB (tidak ada duplikat).
- Smoke test: edit cell di UI → save → refresh → data persist.

**Test commands:**
```bash
cd backend
bun test src/services/manualAdjustmentService.test.ts
```

**Rollback:**
- Revert `saveAdjustment` ke versi SELECT-then-INSERT/UPDATE.
- Unique index dari Task 2.1 boleh tetap ada (defense in depth).

---

#### Task 2.3 — Endpoint POST /payroll/manual-edit/batch

**What:** Endpoint baru yang menerima array of manual edits dan memprosesnya dalam 1 request, dengan invalidasi cache spesifik per gang+division.

**Why:** Finding D. Save 50 cell sekarang serial 50× HTTP roundtrip.

**Files to touch:**
- `backend/src/api/payroll.ts` (tambah endpoint setelah `/manual-edit`)
- `backend/src/services/manualAdjustmentService.ts` (tambah method `saveAdjustmentsBatch`)

**Step-by-step:**

1. Tambah method di service:
   ```ts
   public async saveAdjustmentsBatch(items: ManualAdjustment[], user?: string): Promise<{
       results: Array<{ index: number; success: boolean; id?: number; error?: string }>;
       affectedKeys: Array<{ month: number; year: number; divisionCode?: string; gangCode?: string }>;
   }> {
       const results: Array<any> = [];
       const affectedKeys = new Map<string, any>();

       // Process in parallel with concurrency limit (mis. 10 sekaligus)
       const CONCURRENCY = 10;
       for (let i = 0; i < items.length; i += CONCURRENCY) {
           const chunk = items.slice(i, i + CONCURRENCY);
           const settled = await Promise.allSettled(
               chunk.map(item => this.saveAdjustment(item, user))
           );
           settled.forEach((res, idx) => {
               const globalIdx = i + idx;
               if (res.status === 'fulfilled') {
                   results.push({ index: globalIdx, success: true, id: res.value });
                   const item = chunk[idx];
                   const key = `${item.period_month}:${item.period_year}:${item.division_code || ''}:${item.gang_code || ''}`;
                   affectedKeys.set(key, {
                       month: item.period_month,
                       year: item.period_year,
                       divisionCode: item.division_code,
                       gangCode: item.gang_code
                   });
               } else {
                   results.push({ index: globalIdx, success: false, error: res.reason?.message || String(res.reason) });
               }
           });
       }

       return { results, affectedKeys: Array.from(affectedKeys.values()) };
   }
   ```
2. Tambah endpoint di `backend/src/api/payroll.ts`:
   ```ts
   .post("/manual-edit/batch", async ({ body, currentUser, set }) => {
       try {
           const { manualAdjustmentService } = await import("../services/manualAdjustmentService");
           const { cacheService } = await import("../services/cacheService");
           const items = (body as any).items as any[];
           if (!Array.isArray(items) || items.length === 0) {
               set.status = 400;
               return { success: false, error: "items array required" };
           }
           if (items.length > 200) {
               set.status = 400;
               return { success: false, error: "Maximum 200 items per batch" };
           }

           const username = currentUser?.username || 'system';
           const { results, affectedKeys } = await manualAdjustmentService.saveAdjustmentsBatch(items, username);

           // Invalidate cache spesifik per affected gang+division
           let totalInvalidated = 0;
           for (const k of affectedKeys) {
               totalInvalidated += cacheService.invalidatePayroll(k);
           }

           const successCount = results.filter(r => r.success).length;
           return {
               success: true,
               total: items.length,
               successCount,
               failedCount: items.length - successCount,
               results,
               cache_invalidated: totalInvalidated
           };
       } catch (e: any) {
           console.error("[PayrollRoutes] manual-edit/batch error:", e);
           set.status = 500;
           return { success: false, error: e.message };
       }
   }, {
       body: t.Object({
           items: t.Array(t.Object({
               period_month: t.Number(),
               period_year: t.Number(),
               emp_code: t.String(),
               nik: t.Optional(t.String()),
               emp_name: t.Optional(t.String()),
               gang_code: t.String(),
               division_code: t.Optional(t.String()),
               adjustment_type: t.String(),
               adjustment_name: t.String(),
               amount: t.Number(),
               remarks: t.Optional(t.String()),
               metadata_json: t.Optional(t.String()),
               ad_code: t.Optional(t.String()),
               task_code: t.Optional(t.String()),
               base_task_code: t.Optional(t.String()),
               task_desc: t.Optional(t.String())
           }))
       })
   })
   ```
3. Tulis test di `backend/src/api/payroll.batch.test.ts`:
   - Batch 5 items: semua sukses → return 5 results, success=true.
   - Batch dengan 1 item invalid: 4 sukses + 1 error.
   - Batch >200 items: return 400.

**Acceptance criteria:**
- Endpoint `POST /payroll/manual-edit/batch` available.
- Test API lulus.
- 50 batch items selesai <1 detik P95 (test manual via curl/postman).
- Cache invalidation hanya untuk affected gang+division.

**Test commands:**
```bash
cd backend
bun test src/api/payroll.batch.test.ts
```

**Rollback:** hapus endpoint dari `payroll.ts` dan method dari service.

---

#### Task 2.4 — Frontend save flow pakai batch

**What:** `saveEditedManualCells` di `CustomPayrollTable.jsx` dirombak: kumpulkan semua manual-edit (legacyEdits + valueItems) dan kirim 1 batch, paralel dengan masterTax / jobTitle / profile (yang masing-masing tetap ada batch tersendiri di endpoint mereka atau loop terbatas).

**Why:** Finding D. Saat ini 6-7 fase serial.

**Files to touch:**
- `frontend/src/components/CustomPayrollTable.jsx` (fungsi `saveEditedManualCells`, line ±1700–1900)
- `frontend/src/services/manualAdjustmentService.js` (tambah `saveManualAdjustmentBatch`)

**Step-by-step:**

1. Tambah service helper:
   ```js
   // frontend/src/services/manualAdjustmentService.js
   export async function saveManualAdjustmentBatch(token, items) {
       const response = await axios.post('payroll/manual-edit/batch', { items }, {
           headers: { Authorization: `Bearer ${token}` }
       });
       return response.data;
   }
   ```
2. Refactor `saveEditedManualCells`:
   ```js
   const saveEditedManualCells = async () => {
       // Kumpulkan semua edit
       const editsArray = Object.values(editedCells);
       // ... build pendingDeletedManualCells (sama seperti existing)
       // ... build manualBatchItems (gabungan legacyEdits + valueItems edits)

       // Phase paralel:
       const phasePromises = [];

       // Phase A: master tax (dari endpoint tax-report/ptkp)
       if (masterTaxEdits.length > 0) {
           phasePromises.push(
               Promise.allSettled(
                   masterTaxEdits.map(edit =>
                       axios.put(`tax-report/ptkp/${encodeURIComponent(edit.nik)}`,
                           { year, ptkp_status: edit.value },
                           { headers: { Authorization: `Bearer ${token}` } })
                   )
               )
           );
       }

       // Phase B: jabatan (employee-estate/update) - bisa diparalel
       if (jobTitleEdits.length > 0) {
           phasePromises.push(
               Promise.allSettled(
                   jobTitleEdits.map(edit =>
                       axios.post('employee-estate/update',
                           { empCode: edit.emp_code || edit.nik, jobTitle: edit.value },
                           { headers: { Authorization: `Bearer ${token}` } })
                   )
               )
           );
       }

       // Phase C: profile overrides - paralel
       if (profileItems.length > 0) {
           phasePromises.push(
               Promise.allSettled(
                   profileItems.map(profile => isProdMode()
                       ? saveLockedProfileOverride(token, profile)
                       : fetch(buildBackendUrl('/payroll/overrides/profile'), { ... })
                   )
               )
           );
       }

       // Phase D: BATCH manual-edit (legacy + value items)
       if (manualBatchItems.length > 0) {
           if (isProdMode()) {
               // Locked mode: fallback ke loop saveLockedManualEdit (sementara, kecuali ada batch endpoint)
               phasePromises.push(
                   Promise.allSettled(
                       manualBatchItems.map(item => saveLockedManualEdit(token, item))
                   )
               );
           } else {
               phasePromises.push(saveManualAdjustmentBatch(token, manualBatchItems));
           }
       }

       // Phase E: other income edits → batch (gunakan endpoint manual-edit/batch dengan adjustment_type=PENDAPATAN_LAINNYA)
       if (otherIncomeBatchItems.length > 0) {
           if (!isProdMode()) {
               phasePromises.push(saveManualAdjustmentBatch(token, otherIncomeBatchItems));
           } else {
               phasePromises.push(
                   Promise.allSettled(otherIncomeBatchItems.map(item =>
                       fetch(buildBackendUrl('/payroll/locked/pendapatan-lainnya-edit'), { ... })
                   ))
               );
           }
       }

       // Phase F: deleted columns (paralel)
       if (pendingDeletedColumns.length > 0) {
           phasePromises.push(
               Promise.allSettled(
                   pendingDeletedColumns.map(deletion => isProdMode()
                       ? deleteLockedManualAdjustmentColumn(token, deletion.params)
                       : deleteManualAdjustmentColumn(token, deletion.params)
                   )
               )
           );
       }

       // Tunggu semua phase paralel
       const phaseResults = await Promise.all(phasePromises);

       // Hitung total success
       let successCount = 0;
       let failCount = 0;
       for (const phase of phaseResults) {
           if (Array.isArray(phase)) {
               // Phase A/B/C/E (Promise.allSettled result)
               successCount += phase.filter(r => r.status === 'fulfilled').length;
               failCount += phase.filter(r => r.status === 'rejected').length;
           } else if (phase?.successCount != null) {
               // Phase D batch result
               successCount += phase.successCount;
               failCount += phase.failedCount;
           }
       }

       if (failCount > 0) {
           throw new Error(`${successCount}/${successCount + failCount} perubahan tersimpan. ${failCount} gagal.`);
       }

       setEditedCells({});
       setEditedOtherIncomeCells({});
       setAddedColumns([]);
       setPendingDeletedColumns([]);
       return { changedCount: successCount };
   };
   ```
3. Test manual: edit 50 cell, klik Save, ukur waktu.

**Acceptance criteria:**
- 50 cell edit selesai <1 detik di environment LAN.
- Test frontend `vitest run` lulus untuk fungsi yang ada test-nya (`payrollEditPayloads.test.js`, `payrollPremiumDetailEdits.test.js`).
- UI tetap responsif (tidak freeze) selama save.

**Rollback:** revert `saveEditedManualCells` ke versi loop serial.

---

#### Task 2.5 — Optimistic UI

**What:** Saat user klik Save, cell langsung tampak "saved" (animasi check ✓ atau warna hijau lalu fade), rollback bila response gagal.

**Why:** UX. Save 1 detik tetap terasa lama bila tidak ada feedback langsung.

**Files to touch:**
- `frontend/src/components/CustomPayrollTable.jsx`

**Step-by-step:**

1. Tambah state `savingCells` dan `recentlySavedCells`:
   ```js
   const [savingCells, setSavingCells] = useState({});       // { cellKey: true }
   const [recentlySavedCells, setRecentlySavedCells] = useState({});  // { cellKey: timestamp }
   ```
2. Wrap `saveEditedManualCells`:
   ```js
   const handleSaveClick = async () => {
       const allEditKeys = Object.keys(editedCells);
       const initSaving = Object.fromEntries(allEditKeys.map(k => [k, true]));
       setSavingCells(initSaving);

       try {
           const result = await saveEditedManualCells();
           const now = Date.now();
           const justSaved = Object.fromEntries(allEditKeys.map(k => [k, now]));
           setRecentlySavedCells(prev => ({ ...prev, ...justSaved }));
           setSavingCells({});
           // Auto-clear "saved" indicator after 2 detik
           setTimeout(() => {
               setRecentlySavedCells(prev => {
                   const next = { ...prev };
                   for (const k of allEditKeys) {
                       if (next[k] === now) delete next[k];
                   }
                   return next;
               });
           }, 2000);
       } catch (err) {
           setSavingCells({});
           alert(err.message || 'Gagal menyimpan');
           // editedCells tetap, user bisa retry
       }
   };
   ```
3. Di renderer cell, tambah class:
   ```jsx
   <td className={`
     ${isCellSelected(rIdx, cIdx) ? 'selected' : ''}
     ${savingCells[`${rIdx}-${cIdx}`] ? 'cell-saving' : ''}
     ${recentlySavedCells[`${rIdx}-${cIdx}`] ? 'cell-saved' : ''}
   `}>
   ```
4. CSS di `CustomPayrollTable.css`:
   ```css
   .cell-saving { background: #fef3c7; opacity: 0.7; }
   .cell-saved { background: #dcfce7; transition: background 1s ease-out; }
   ```

**Acceptance criteria:**
- Saat klik Save, cell yang sedang disimpan tampak warna kuning dan opacity rendah.
- Setelah save sukses, cell berubah hijau lalu fade ke normal dalam 2 detik.
- Bila save gagal, alert muncul dan cell kembali ke state edit (warna highlight edit).

**Rollback:** hapus state baru dan class CSS.

---

#### Task 2.6 — Debounce resize observer

**What:** ResizeObserver dan window resize listener di-debounce 100 ms supaya tidak fire 60×/detik saat user resize window.

**Why:** Finding C. Resize tanpa debounce memicu re-layout berkali-kali.

**Files to touch:**
- `frontend/src/components/CustomPayrollTable.jsx` (line ±4244, 4255)

**Step-by-step:**

1. Buat util kecil di `frontend/src/utils/debounce.js`:
   ```js
   export function debounce(fn, ms = 100) {
       let timer;
       const debounced = (...args) => {
           clearTimeout(timer);
           timer = setTimeout(() => fn(...args), ms);
       };
       debounced.cancel = () => clearTimeout(timer);
       return debounced;
   }
   ```
2. Update useEffect resize:
   ```js
   useEffect(() => {
       const onResize = debounce(() => {
           syncTableContainerWidth();
           syncHorizontalScrollState();
       }, 100);
       window.addEventListener('resize', onResize);
       return () => {
           onResize.cancel();
           window.removeEventListener('resize', onResize);
       };
   }, [syncHorizontalScrollState, syncTableContainerWidth]);

   useEffect(() => {
       const container = tableContainerRef.current;
       const table = tableRef.current;
       if (!container || typeof ResizeObserver === 'undefined') return undefined;
       const debouncedSync = debounce(() => {
           syncTableContainerWidth(container);
           syncHorizontalScrollState(container);
       }, 100);
       const observer = new ResizeObserver(debouncedSync);
       observer.observe(container);
       if (table) observer.observe(table);
       return () => {
           debouncedSync.cancel();
           observer.disconnect();
       };
   }, [syncHorizontalScrollState, syncTableContainerWidth, displayMode, renderColumnDefs.length, displayRows.length]);
   ```
3. Throttle `handleMouseOver` saat drag-select (alternatif: pakai requestAnimationFrame):
   ```js
   const handleMouseOverRaf = useRef(0);
   const handleMouseOver = (rowIndex, colIndex) => {
       if (!isSelecting || selection.length === 0) return;
       if (handleMouseOverRaf.current) return;
       handleMouseOverRaf.current = requestAnimationFrame(() => {
           handleMouseOverRaf.current = 0;
           // ... existing logic
       });
   };
   ```

**Acceptance criteria:**
- Resize window cepat tidak menyebabkan UI freeze.
- Drag-select 100 cell smooth.
- Test existing yang related masih lulus.

**Rollback:** revert kedua useEffect ke versi tanpa debounce.




---

### Phase 3: Rendering Performance

#### Task 3.1 — Spike: pilih virtualisasi

**What:** Decision dokumen: `react-window` (lightweight, tambah library) vs `ag-grid-react` (sudah ada di dependency, lebih powerful tapi migrasi besar).

**Why:** Finding C. Tanpa virtualisasi, ~12.000 `<td>` di DOM. Pilihan teknologi mempengaruhi effort Phase 3.

**Output:**
- File: `docs/decisions/ADR-virtualization.md`
- Format: ADR (Architecture Decision Record) singkat

**Step-by-step:**

1. Spike `react-window`:
   - Install: `npm install react-window`
   - Replace `<tbody>{displayRows.map(...)}` dengan `<FixedSizeList>` di branch eksperimen
   - Cek apakah feature existing tetap jalan: cell selection, edit mode, sticky header, gang divider rows, grand total row
   - Catat: kerumitan handle multi-baris untuk gang header (row dengan colspan beda dari row data)
2. Spike `ag-grid-react`:
   - Sudah ada di dependency `ag-grid-community`, `ag-grid-react`, `ag-grid-enterprise`
   - Buat prototipe `<AgGridReact rowData={...} columnDefs={...}>` di komponen kecil terpisah
   - Test fitur: range selection, copy/paste, group header, sort, filter, edit mode
   - Catat: berapa banyak custom logic di `CustomPayrollTable.jsx` yang bisa di-replace dengan AG Grid built-in
3. Tulis ADR:
   ```md
   # ADR: Virtualization for Daftar Upah table

   ## Context
   CustomPayrollTable.jsx renders 12k+ <td>. Slow on weak PCs.

   ## Options
   ### Option A: react-window
   - Pro: lightweight (5KB gzipped), API sederhana
   - Pro: migrasi inkremental (replace tbody saja)
   - Con: handle group header, sticky column, multi-level header manual
   - Con: range selection multi-cell harus tetap custom

   ### Option B: ag-grid-react
   - Pro: virtualization built-in (row + column)
   - Pro: range selection, copy/paste, sort, filter, group built-in
   - Pro: bisa hilangkan ~30% kode custom di CustomPayrollTable
   - Con: migrasi besar (rewrite render path)
   - Con: bundle size +200KB walaupun community-only

   ## Decision
   [Pilih A atau B berdasarkan hasil spike]

   ## Consequences
   ...
   ```
4. **Rekomendasi default:** mulai dengan `react-window` (Option A) karena migrasi inkremental, lalu pertimbangkan AG Grid untuk Phase 4+ atau v2 redesign.

**Acceptance criteria:**
- ADR document tersimpan di `docs/decisions/ADR-virtualization.md`.
- Decision jelas + rationale.

**Test commands:** N/A (riset).

**Rollback:** N/A.

---

#### Task 3.2 — Implementasi virtualisasi body tabel

**What:** Body `<tbody>` di-replace dengan virtualisasi (default react-window FixedSizeList atau VariableSizeList tergantung apakah baris gang_header beda tinggi).

**Why:** Finding C. Goal: DOM nodes ≤1.500 (hanya viewport + buffer).

**Files to touch:**
- `frontend/src/components/CustomPayrollTable.jsx`
- `frontend/src/styles/CustomPayrollTable.css` (penyesuaian z-index, position untuk virtualized rows)

**Step-by-step (asumsi pilih react-window):**

1. Install:
   ```bash
   cd frontend
   npm install react-window @types/react-window
   ```
2. Identifikasi varian row di displayRows:
   - `type === 'gang_header'` (height ±28 px)
   - `type === 'employee'` (height ±24 px)
   - Grand total row di luar tbody (boleh tetap statis)
3. Karena ada 2 tipe height berbeda, pakai `VariableSizeList`:
   ```jsx
   import { VariableSizeList } from 'react-window';

   const ROW_HEIGHTS = { gang_header: 28, employee: 24 };
   const getRowHeight = useCallback(
     (index) => {
       const row = displayRows[index];
       return ROW_HEIGHTS[row?.type] ?? 24;
     },
     [displayRows]
   );

   const Row = useCallback(({ index, style }) => {
     const row = displayRows[index];
     if (row.type === 'gang_header') {
       return (
         <div style={style} className="gang-header-row" data-gang-code={row.gang_code}>
           {/* gang header cell content */}
         </div>
       );
     }
     return (
       <div style={style} className={`employee-row ...`}>
         {renderColumnDefs.map((col, cIdx) => (
           <div className="cell" style={{ width: col.width }}>...</div>
         ))}
       </div>
     );
   }, [displayRows, renderColumnDefs, ...]);

   <VariableSizeList
     height={containerHeight}
     itemCount={displayRows.length}
     itemSize={getRowHeight}
     width="100%"
   >
     {Row}
   </VariableSizeList>
   ```
4. **Catatan:** karena pindah dari `<tr>/<td>` ke `<div>`, semua CSS yang assume tabel selektor harus dipenyesuaian. Alternatif: render `<tr>` di dalam `style={{ display: 'block', position: 'absolute', top: style.top }}`. Atau pakai library `react-window-infinite-loader` + custom item renderer yang tetap output `<tr>`.
5. **Sticky header:** pertahankan `<thead>` di luar VirtualList. Sync horizontal scroll antara header & body.
6. **Selection:** `handleMouseDown` / `handleMouseOver` tetap jalan, hanya akses ke row via `displayRows[index]`.
7. **Edit mode:** `DeferredPayrollNumberInput` tetap di dalam Row renderer.

**Risk:** Virtualisasi tabel rumit kalau ada colspan / multi-level row. Plan B kalau react-window terlalu rumit: pakai `react-virtuoso` (lebih flexible untuk variable height + sticky).

**Acceptance criteria:**
- DOM `<td>` (atau `<div>` cell setara) ≤ 1.500 saat ada 200 employee.
- Semua interaksi existing tetap jalan: selection, edit mode, ctrl+click, drag-select, gang header sticky, grand total fixed.
- Smoke test edit 5 cell, save, refresh — data persist.
- Tidak regresi visual besar (gunakan screenshot before/after).

**Test commands:**
```bash
cd frontend
npm run dev:test
# Browser: buka MainPage, scroll panjang, edit, save
npx vitest run src/components/CustomPayrollTable.render.test.jsx
```

**Rollback:** revert komponen ke versi non-virtualized.

---

#### Task 3.3 — Split CustomPayrollTable.jsx ke 5-6 modul

**What:** Memecah `CustomPayrollTable.jsx` 254 KB menjadi modul-modul fokus ≤ 50 KB.

**Why:** Finding J. File 254 KB sulit dibaca, code review berat, HMR lambat.

**Target struktur:**

```
frontend/src/components/payroll-table/
├─ index.jsx                    # Public component, re-export
├─ PayrollTable.jsx              # Top-level orchestrator (≤30KB)
├─ PayrollTableHeader.jsx        # Multi-level header (≤30KB)
├─ PayrollTableBody.jsx          # Body + virtualization (≤40KB)
├─ PayrollTableRow.jsx           # Row renderer (≤30KB)
├─ PayrollTableCell.jsx          # Cell renderer + edit mode (≤30KB)
├─ PayrollTableFooter.jsx        # Grand total row (≤10KB)
├─ hooks/
│  ├─ usePayrollEditState.js     # editedCells state + commit/discard
│  ├─ usePayrollSelection.js     # cell selection (single, range, drag)
│  ├─ usePayrollSave.js          # saveEditedManualCells dengan batch
│  ├─ usePayrollNetwork.js       # axios/fetch wrapping
│  └─ usePayrollScroll.js        # sync horizontal/vertical scroll
└─ utils/
   ├─ rowBuilders.js             # build displayRows dari gangs data
   ├─ cellFormatters.js          # formatNumber, formatDecimal, etc
   └─ premiumDetailHelpers.js    # buildPremiumDetailEdit, validation
```

**Step-by-step:**

1. **Spike refactor di branch terpisah** (`refactor/payroll-table-split`).
2. Mulai dari ekstraksi terkecil:
   - Move semua const helper (formatNumber, formatDecimal, formatNegativeTotalNumber, formatBytes, clampNumber, isBrondolFieldKey, isSpsiFieldKey, dst — line 102–250) ke `utils/cellFormatters.js`.
   - Test build: `npm run build` masih sukses.
3. Ekstrak hook:
   - `usePayrollEditState`: pindahkan state `editedCells`, `addedColumns`, `pendingDeletedColumns`, `editedOtherIncomeCells` + setter.
   - `usePayrollSelection`: pindahkan state `selection`, `isSelecting`, `selectionStats`, `highlightedRowId` + handlers.
   - `usePayrollSave`: fungsi `saveEditedManualCells`, `saveDeletedManualColumns`, `saveEditedOtherIncomeCells`.
4. Ekstrak `PayrollTableHeader.jsx` (renderHeader function, headerRows logic, formatHeaderLabel).
5. Ekstrak `PayrollTableRow.jsx` (renderRow function untuk employee dan gang_header).
6. Ekstrak `PayrollTableCell.jsx` (renderCell function: editable input, premi popup trigger, manual adjustment indicator).
7. Top-level `PayrollTable.jsx` jadi orchestrator: useMemo build displayRows, kompilasi columnDefs, panggil hook + sub-component.
8. **Hindari prop drilling 10+ prop:** kalau perlu, buat `PayrollTableContext` lokal.
9. Public API tetap kompatibel dengan import existing:
   ```jsx
   // frontend/src/components/CustomPayrollTable.jsx (file lama tetap ada sebagai re-export)
   export { default } from './payroll-table';
   ```
10. Update imports di `App.jsx`, `MainPage.jsx` jika perlu (sebenarnya tidak perlu kalau re-export di atas dibuat).

**Acceptance criteria:**
- Setiap file di `frontend/src/components/payroll-table/` ≤ 50 KB.
- Test existing `CustomPayrollTable.render.test.jsx`, `CustomPayrollTable.manual-columns.test.jsx`, `CustomPayrollTable.focus-navigation.test.jsx`, `CustomPayrollTable.scope-change.test.jsx` lulus.
- `npm run build` sukses.
- Tidak ada perubahan visual atau fungsional di UI.

**Test commands:**
```bash
cd frontend
npx vitest run src/components/CustomPayrollTable.render.test.jsx
npx vitest run src/components/CustomPayrollTable.manual-columns.test.jsx
npx vitest run src/components/CustomPayrollTable.focus-navigation.test.jsx
npx vitest run src/components/CustomPayrollTable.scope-change.test.jsx
npm run build
```

**Rollback:**
- Jaga commit per ekstraksi modul. Bila bug, revert satu commit at a time.
- Branch `refactor/payroll-table-split` hanya merge setelah semua test + smoke test lulus.

---

#### Task 3.4 — Compact mode toggle

**What:** Toolbar punya tombol "Compact mode" yang turunkan padding cell, font size, dan jarak antar elemen supaya muat di monitor sempit (1280×1024 dengan zoom 150%).

**Why:** Finding D2 (responsiveScale tidak deteksi zoom). Beberapa user perlu tampilan lebih padat.

**Files to touch:**
- `frontend/src/components/payroll-table/PayrollTable.jsx` (atau wrapper)
- `frontend/src/styles/CustomPayrollTable.css` (atau split ke `payroll-table-compact.css`)

**Step-by-step:**

1. Tambah state:
   ```js
   const [compactMode, setCompactMode] = useState(() =>
       localStorage.getItem('payroll.compactMode') === 'true'
   );
   useEffect(() => {
       localStorage.setItem('payroll.compactMode', String(compactMode));
   }, [compactMode]);
   ```
2. Toggle button di toolbar:
   ```jsx
   <button
       className={`btn-compact ${compactMode ? 'active' : ''}`}
       onClick={() => setCompactMode(c => !c)}
       title="Compact mode: tampilkan tabel lebih padat untuk monitor sempit"
   >
       {compactMode ? '⊟' : '⊞'} Compact
   </button>
   ```
3. CSS:
   ```css
   .payroll-table-shell.compact {
       --payroll-font-size-base: 10px;
       --payroll-header-font-size: 0.75rem;
       --payroll-header-pad-y: 2px;
       --payroll-header-pad-x: 3px;
       --payroll-body-pad-y: 1px;
       --payroll-body-pad-x: 3px;
   }
   ```
4. Apply class:
   ```jsx
   <div className={`payroll-table-shell ${compactMode ? 'compact' : ''}`}>
   ```

**Acceptance criteria:**
- Toggle on/off berfungsi, state tersimpan di localStorage.
- Compact mode: row height turun ≥30%, font lebih kecil tapi masih terbaca.
- Tidak ada overflow hidden text yang penting.

**Rollback:** hapus state + CSS class.




---

### Phase 4: Scaling & Modularization

#### Task 4.1 — Modularisasi dataExtractorService.ts

**What:** Pecah file 271 KB menjadi modul fokus per komponen payroll.

**Why:** Finding J. Sulit dimaintain, sulit di-review.

**Target struktur (folder `backend/src/services/payroll/extractors/` sudah ada):**

```
backend/src/services/payroll/extractors/
├─ index.ts                          # Re-export + facade
├─ identityExtractor.ts              # NIK, nama, jabatan, gang, division
├─ attendanceExtractor.ts            # HK, cuti tahunan/sakit/minggu/nasional
├─ wageBaseExtractor.ts              # Upah dasar, gaji pokok
├─ allowanceExtractor.ts             # Tunjangan beras, jabatan, masa kerja, lembur
├─ premiExtractor.ts                 # Premi brondol, pruning, raking, dll
├─ deductionExtractor.ts             # ASTEK, BPJS, SPSI, koreksi, lainnya
├─ otherIncomeExtractor.ts           # THR, Bonus, Custom income
├─ taxExtractor.ts                   # PPh21, TER, PTKP
└─ shared/
   ├─ adtransLookup.ts               # Helper PR_ADTRANS query
   ├─ taskCodeMapping.ts             # AD_CODE / task_code resolver
   └─ identityResolver.ts            # NIK/empCode resolution helper
```

**Step-by-step:**

1. Baca `dataExtractorService.ts` ke pemahaman tinggi: cari method publik (`extractPayrollData`, `extractEmployeeData`, dst).
2. Identifikasi blok kode yang berhubungan per komponen (pakai `grep -n "premi"`, `grep -n "tunjangan"`, `grep -n "lembur"`, dst).
3. Mulai dengan ekstraksi paling independen: `identityExtractor.ts` (yang dipanggil paling awal di pipeline).
4. Setiap pindah blok kode, jalankan `bun test` sebelum commit.
5. Pertahankan public API: `dataExtractorService.extractPayrollData(...)` tetap bekerja sebagai facade yang panggil sub-extractor.
6. Jangan refactor algoritma — cuma move kode ke file lain.

**Acceptance criteria:**
- `dataExtractorService.ts` ≤ 80 KB (turun dari 271 KB).
- Setiap extractor file ≤ 60 KB.
- Backend `bun test` lulus semua.
- Smoke test: buka Daftar Upah, semua kolom (premi, potongan, tax) tetap menampilkan data benar.

**Test commands:**
```bash
cd backend
bun test
```

**Rollback:** branch terpisah, tidak merge sampai semua test + smoke test lulus.

---

#### Task 4.2 — Modularisasi manualAdjustmentService.ts

**What:** Pecah 130 KB ke beberapa modul.

**Files struktur target:**

```
backend/src/services/payroll/manualAdjustments/
├─ index.ts                              # Facade
├─ ManualAdjustmentRepository.ts         # CRUD: get, save (MERGE), delete
├─ ManualAdjustmentImporter.ts           # Import excel
├─ ManualAdjustmentSyncService.ts        # Sync dengan PR_ADTRANS / ARC
├─ ManualAdjustmentValidator.ts          # validateManualAdjustmentAdCode, validatePremiumDefinition
├─ ManualAdjustmentBatchProcessor.ts     # saveAdjustmentsBatch (Phase 2.3)
├─ manualAdjustmentNaming.ts             # (sudah ada) normalizeStoredAdjustmentName, dll
└─ autoBufferAdcodeMap.ts                # (sudah ada)
```

**Step-by-step:**
- Sama seperti 4.1: ekstrak per concern, jaga API publik.
- Test wajib: `bun test src/services/manualAdjustmentService.test.ts`.

**Acceptance criteria:**
- `manualAdjustmentService.ts` jadi facade ≤ 30 KB.
- Sub-modul ≤ 60 KB masing-masing.
- All tests pass.

---

#### Task 4.3 — Pecah payroll.ts API

**Target struktur:**

```
backend/src/api/payroll/
├─ index.ts                          # Combine semua route ke payrollRoutes
├─ payrollReportRoutes.ts            # /report/division-raw-tree, /headers, /columns
├─ payrollManualAdjustmentRoutes.ts  # /manual-adjustment, /manual-edit, /manual-edit/batch
├─ payrollManualAdjustmentByApiKey.ts # /manual-adjustment/by-api-key (third-party)
├─ payrollOverrideRoutes.ts          # /overrides/profile, /overrides/values, /overrides/join-date
├─ payrollPresetRoutes.ts            # /manual-adjustment-presets
├─ payrollGangDivisionRoutes.ts      # /divisions, /gangs, /subdivisions
├─ payrollLockedRoutes.ts            # /locked/*
└─ payrollMiscRoutes.ts              # /current-period, /bpjs-calculate, /calculate
```

**Step-by-step:** standar refactoring move.

**Acceptance criteria:**
- File `backend/src/api/payroll.ts` jadi re-export ≤ 5 KB.
- Setiap sub-route file ≤ 40 KB.

---

#### Task 4.4 — Rate-limit endpoint write

**What:** Token bucket per username untuk endpoint `/payroll/manual-edit`, `/payroll/manual-edit/batch`, `/payroll/manual-adjustment`, `/payroll/overrides/*`. Limit: 30 request / 10 detik per user.

**Why:** Mencegah satu client (mis. script tidak terkontrol) overwhelm backend.

**Files to touch:**
- `backend/src/utils/rateLimiter.ts` (baru)
- `backend/src/api/payroll.ts` (atau setelah refactor 4.3, di file route relevan)

**Step-by-step:**

1. Implement simple in-memory token bucket:
   ```ts
   // backend/src/utils/rateLimiter.ts
   type Bucket = { tokens: number; lastRefill: number };
   const buckets = new Map<string, Bucket>();

   export function takeToken(key: string, opts: { capacity: number; refillPerSec: number }): boolean {
       const now = Date.now();
       const b = buckets.get(key) || { tokens: opts.capacity, lastRefill: now };
       const elapsed = (now - b.lastRefill) / 1000;
       b.tokens = Math.min(opts.capacity, b.tokens + elapsed * opts.refillPerSec);
       b.lastRefill = now;
       if (b.tokens < 1) {
           buckets.set(key, b);
           return false;
       }
       b.tokens -= 1;
       buckets.set(key, b);
       return true;
   }

   // Cleanup tiap 5 menit
   setInterval(() => {
       const cutoff = Date.now() - 10 * 60 * 1000;
       for (const [k, b] of buckets.entries()) {
           if (b.lastRefill < cutoff) buckets.delete(k);
       }
   }, 5 * 60 * 1000);
   ```
2. Apply di endpoint:
   ```ts
   .post("/manual-edit/batch", async ({ body, currentUser, set }) => {
       const username = currentUser?.username || 'anon';
       if (!takeToken(`write:${username}`, { capacity: 30, refillPerSec: 3 })) {
           set.status = 429;
           return { success: false, error: "Rate limit exceeded. Coba lagi sebentar." };
       }
       // ... existing logic
   })
   ```
3. Untuk endpoint single `/manual-edit`, batas lebih tinggi (mis. 60 req/10s) supaya batch yang gagal bisa fallback ke single.

**Acceptance criteria:**
- Stress test 100 request berurutan dari 1 user → 30 sukses, sisanya 429.
- Test 30 user × 30 request paralel → semua sukses (per-user bucket, bukan global).

**Test commands:**
```bash
# Manual stress test
for i in {1..100}; do
   curl -s -o /dev/null -w "%{http_code}\n" \
        -H "Authorization: Bearer $TOKEN" \
        -X POST http://localhost:8002/payroll/manual-edit/batch \
        -H 'Content-Type: application/json' \
        -d '{"items":[]}' &
done
wait
```

**Rollback:** hapus call `takeToken()` dari endpoint.

---

#### Task 4.5 — (Optional) Redis cache

**What:** Migrasi `cacheService` dari in-memory `Map` ke Redis untuk dukungan multi-instance.

**Why:** Saat horizontal scaling, in-memory cache tidak konsisten antar instance.

**Decision criteria:**
- Wajib bila deploy 2+ Bun instance di belakang load balancer.
- Skip bila single instance cukup.

**Files to touch:**
- `backend/src/services/cacheService.ts`
- `backend/package.json` (`ioredis`)
- `backend/.env` (REDIS_URL)

**Step-by-step:**

1. Install: `bun add ioredis`
2. Ganti `Map` dengan Redis client:
   ```ts
   import Redis from 'ioredis';
   const redis = new Redis(Config.REDIS_URL || 'redis://localhost:6379');

   public async get<T>(key: string): Promise<T | null> {
       const raw = await redis.get(key);
       if (!raw) { this.misses++; return null; }
       this.hits++;
       return JSON.parse(raw) as T;
   }

   public async set<T>(key: string, value: T, ttlSeconds: number = 3600): Promise<void> {
       const actualTtl = Math.min(ttlSeconds, 7200);
       await redis.set(key, JSON.stringify(value), 'EX', actualTtl);
   }

   public async invalidatePayroll(opts): Promise<number> {
       // Use SCAN + DEL
       const pattern = `payroll:${opts.gangCode || '*'}:${opts.month}:${opts.year}:${opts.divisionCode || '*'}*`;
       const stream = redis.scanStream({ match: pattern });
       let count = 0;
       for await (const keys of stream) {
           if (keys.length) {
               await redis.del(...keys);
               count += keys.length;
           }
       }
       return count;
   }
   ```
3. Update semua call site `cacheService.*` jadi `await cacheService.*` (hampir semua sudah async-friendly).

**Acceptance criteria:**
- Backend bisa run dengan atau tanpa Redis (fallback to Map kalau REDIS_URL tidak set).
- 2 instance Bun share cache via Redis.
- All tests pass (mungkin perlu mock Redis atau Redis test container).

**Rollback:** revert ke Map.

---

#### Task 4.6 — (Optional) Spike mssql native pool

**What:** Eksperimen ganti HTTP gateway dengan `mssql` native driver + connection pool.

**Why:** Finding G. HTTP gateway tambah latency 30–80 ms per query.

**Step-by-step:**

1. Spike di branch terpisah:
   ```bash
   cd backend && bun add mssql @types/mssql
   ```
2. Buat `db/clientNative.ts`:
   ```ts
   import sql from 'mssql';
   const pool = new sql.ConnectionPool({
       server: Config.DB_HOST,
       user: Config.DB_USER,
       password: Config.DB_PASSWORD,
       database: Config.DEFAULT_DATABASE,
       options: { trustServerCertificate: true },
       pool: { min: 5, max: 30, idleTimeoutMillis: 30000 }
   });
   const poolPromise = pool.connect();

   export async function query<T>(sql: string, params: Record<string, any> = {}): Promise<T[]> {
       const cn = await poolPromise;
       const req = cn.request();
       for (const [k, v] of Object.entries(params)) req.input(k.replace('@', ''), v);
       const r = await req.query<T>(sql);
       return r.recordset;
   }
   ```
3. Benchmark: 100× query simple `SELECT TOP 10 * FROM HR_EMPLOYEE`.
4. Bandingkan latency: gateway HTTP vs native pool.
5. Bila native pool lebih cepat dan cred bisa diakses dari Bun:
   - Migrasi bertahap: tambah env flag `USE_NATIVE_DB=true`.
   - Update `db/client.ts` untuk delegasi ke native bila flag set.

**Decision criteria:**
- Bila latency turun ≥30 ms per query → migrate.
- Bila gateway tetap diperlukan (firewall, audit), keep gateway tapi tambah HTTP keep-alive.

**Acceptance criteria:**
- Benchmark report di `docs/decisions/ADR-db-driver.md`.
- Decision dokumented.

**Rollback:** branch terpisah, tidak merge sampai disetujui.

---

## 10. Testing Strategy

### 10.1 Unit & integration tests

**Backend (Bun):**
```bash
cd backend
bun test                                # Semua test
bun test src/services/manualAdjustmentService.test.ts   # Wajib untuk perubahan manual-adjustment
bun test src/services/cacheService.test.ts
bun test src/services/dataExtractorService.*.test.ts
bun test src/api/payroll.*.test.ts
```

**Frontend (Vitest):**
```bash
cd frontend
npx vitest run                          # Semua
npx vitest run src/components/CustomPayrollTable.render.test.jsx
npx vitest run src/utils/payrollEditPayloads.test.js
npx vitest run src/utils/payrollPremiumDetailEdits.test.js
```

### 10.2 Manual smoke test (wajib setelah tiap phase)

**Skenario A — Buka Daftar Upah:**
1. Login user normal (non-admin).
2. Buka MainPage → Daftar Upah.
3. Pilih bulan & gang.
4. Tunggu data load (SSE stream).
5. Verifikasi: jumlah employee benar, semua kolom ter-render, grand total muncul.

**Skenario B — Edit & Save:**
1. Klik "Edit Mode".
2. Edit 5 cell premi.
3. Edit 1 PTKP status.
4. Edit 1 jabatan.
5. Klik Save.
6. Tunggu sukses notification.
7. Refresh page.
8. Verifikasi: semua perubahan persist.

**Skenario C — Concurrency:**
1. Buka 3 browser tab (3 user berbeda kalau memungkinkan).
2. Masing-masing edit gang berbeda, save bersamaan.
3. Verifikasi: tidak ada error, data semua persist, tidak ada duplikat.

**Skenario D — Print payslip:**
1. Pilih beberapa employee.
2. Klik "Print Payslip".
3. Verifikasi: PDF/halaman print muncul dengan data benar.

### 10.3 Stress test (Phase 2 & 3)

**Backend stress (concurrency cache):**
```ts
// backend/_dev_utils/scripts/stress_concurrent_save.ts
const NUM_USERS = 20;
const SAVES_PER_USER = 10;

const users = Array.from({ length: NUM_USERS }, (_, i) => i);
const start = Date.now();

await Promise.all(users.map(async (uid) => {
    for (let j = 0; j < SAVES_PER_USER; j++) {
        await fetch('http://localhost:8002/payroll/manual-edit/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
            body: JSON.stringify({
                items: [{
                    period_month: 6, period_year: 2026,
                    emp_code: `TEST_${uid}_${j}`,
                    gang_code: `G${uid % 5}`,
                    division_code: 'TEST',
                    adjustment_type: 'PREMI',
                    adjustment_name: 'PREMI TEST',
                    amount: Math.random() * 1000
                }]
            })
        });
    }
}));

const elapsed = (Date.now() - start) / 1000;
console.log(`${NUM_USERS} users × ${SAVES_PER_USER} saves = ${NUM_USERS * SAVES_PER_USER} requests in ${elapsed}s`);

// Cek cache stats
const stats = await fetch('http://localhost:8002/payroll/cache-stats').then(r => r.json());
console.log('Cache stats:', stats);
```

**Frontend stress (rendering):**
- Buka DevTools Performance.
- Record while scrolling 30 detik di Daftar Upah dengan 200 employee.
- Lihat FPS rata-rata, total scripting time.

### 10.4 Acceptance test per phase

| Phase | Acceptance test |
|---|---|
| 1 | Bundle size cek `ls -lh dist/assets/*.js.br`, smoke A+B, cache stats >50% hit pada stress test |
| 2 | Stress concurrent (Skenario C), zero duplikat di DB, save 50 cell <1s |
| 3 | DOM nodes <1.500 (DevTools), scroll FPS ≥30 di simulasi slow PC |
| 4 | All tests pass, file size ≤target, rate-limit responds 429 di stress |




---

## 11. Risks & Rollback

### 11.1 Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| TDZ error muncul kembali setelah enable minify (Task 1.1) | Medium | High | Debug root cause via `madge --circular` dulu, jangan langsung enable |
| Lazy loading menyebabkan loading spinner berkedip ganggu UX | Medium | Low | Gunakan `<Suspense>` dengan delay min, prefetch on hover route link |
| Cache invalidation spesifik miss case → data stale di UI | Medium | Medium | Tetap kirim cache-control no-store dari backend untuk endpoint baca, plus tombol "Refresh Data" manual di UI |
| Cleanup file root menyebabkan script production yang tidak terdeteksi gagal | Low | High | Cek `grep -rn` reference dulu sebelum hapus; commit per file, push sebelum lanjut |
| Worktree prune menghapus branch yang belum di-push | Low | High | Wajib `git push --all` ke remote sebelum prune |
| MERGE atomic gagal karena duplikat existing | Medium | High | Audit duplikat dulu (Task 2.1 step 1), remediasi sebelum apply unique index |
| Batch endpoint timeout untuk 200 items | Low | Medium | Limit max items per batch ke 200, timeout backend 30s, frontend chunk besar |
| Virtualisasi (Phase 3.2) merusak fitur range selection / sticky | High | High | Spike dulu (Task 3.1), kerjakan di branch terpisah, test e2e sebelum merge |
| Split CustomPayrollTable bug subtle | High | Medium | Test existing harus lulus di setiap commit, smoke test wajib |
| Modularisasi backend service merusak test suite | Medium | Medium | Move kode tanpa edit logic; jalankan `bun test` setelah tiap pemindahan |
| Redis tidak tersedia di environment estate (offline) | Medium | High | Buat Redis optional dengan fallback ke Map (Task 4.5 step 3) |

### 11.2 Rollback strategy keseluruhan

**Per-task:** setiap task punya rollback steps di dokumen task spec.

**Per-phase:**
- Setiap phase di branch terpisah: `phase-1-quick-wins`, `phase-2-edit-correctness`, `phase-3-rendering`, `phase-4-modularization`.
- Tidak merge ke main sebelum: (1) all tests pass, (2) smoke test manual lulus, (3) reviewer approve.
- Bila ada bug post-merge: revert merge commit, deploy versi sebelumnya.

**Database rollback:**
- Backup DB sebelum apply migration (Task 2.1 unique index).
- Migration `IF NOT EXISTS` guard sehingga idempotent.
- Rollback script tersedia di komentar migration.

**Feature flag:**
- Task yang berisiko (1.1 minify, 2.4 batch save, 3.2 virtualization) di-guard dengan env flag atau localStorage flag, supaya bisa dimatikan tanpa redeploy.

### 11.3 Pre-flight checklist sebelum mulai

- [ ] Backup database produksi (full backup).
- [ ] Push semua branch lokal ke remote: `git push --all`.
- [ ] Cek `git status` clean di main.
- [ ] Konfirmasi user list worktree yang aman dihapus.
- [ ] Konfirmasi user audit duplikat manual_adjustments (untuk Task 2.1).
- [ ] Setup environment staging/dev untuk test masing-masing phase.

---

## 12. Handoff Notes untuk Agent Berikutnya

### 12.1 Cara mulai

1. **Baca dokumen ini dari atas sampai section 9** (sekitar 30–45 menit). Skip section 6 (audit findings) bila ingin langsung mulai—rujuk hanya saat butuh konteks.
2. **Pilih phase** sesuai prioritas user. Default: mulai dari **Phase 1 (Quick Wins)** karena risk paling rendah dan dampak paling cepat terasa.
3. **Pilih satu task** dari daftar Phase 1 (Task 1.1–1.7). Mulai dari yang paling tidak ada dependency:
   - Task 1.4 (Cleanup file) — paling aman, no code change ke logic.
   - Task 1.6 (Konsolidasi docs) — no code change.
   - Task 1.3 (Cache invalidation) — perubahan backend kecil, low risk.
   - Task 1.2 (Lazy load) — perubahan App.jsx, mudah test.
   - Task 1.1 (Minify) — perlu debug TDZ error dulu.
   - Task 1.5 (Cleanup dev script) — file move + grep dependency check.
   - Task 1.7 (Duplicate route) — perubahan backend startup, perlu test PROXY_MOUNT.

### 12.2 Konvensi yang harus diikuti

Dari `AGENTS.md`:
- Backend TypeScript: 4-space indent, semicolons, camelCase.
- Frontend JS/JSX: 2-space indent.
- Conventional commits: `fix:`, `feat:`, `docs:`, `chore:`, `refactor:`.
- Wajib jalankan `bun test src/services/manualAdjustmentService.test.ts` sebelum selesai pekerjaan manual-adjustment.
- Pull request: subject ≤ 70 char, deskripsi berisi ringkasan + area yang terpengaruh + test commands + screenshot UI.

### 12.3 Workflow per task

```
1. Buat branch: git checkout -b phase-1/task-1-3-cache-invalidate
2. Baca task spec di section 9
3. Baca file source yang akan diedit (gunakan path di "Files to touch")
4. Implementasi sesuai step-by-step
5. Run test commands di task spec
6. Smoke test manual sesuai section 10.2
7. Commit dengan conventional commit message
8. Push & buka PR; lampirkan acceptance criteria yang sudah lulus
9. Setelah merge, lanjut task berikutnya
```

### 12.4 Hal yang TIDAK boleh dilakukan

1. **Jangan ubah business logic perhitungan payroll.** Goals 4.1 spesifik: hanya optimasi performa, struktur, concurrency. Jangan ubah formula PPh21, BPJS, lembur, premi.
2. **Jangan delete file tanpa konfirmasi user** untuk Task 1.4 (worktree, file root). Walau dokumen ini list file, tetap minta user "ok untuk delete?"
3. **Jangan apply DB migration langsung di production.** Test di dev/staging dulu, backup DB.
4. **Jangan skip test.** Phase 2 wajib `bun test src/services/manualAdjustmentService.test.ts`.
5. **Jangan force push** ke main/master. Rebase di branch sendiri OK.
6. **Jangan commit `.env`** atau credential file.

### 12.5 Cara minta bantuan user

- **Konfirmasi destructive action:** sebelum `git rm`, `rm -rf`, `git worktree remove --force`, drop index — selalu tanya user.
- **Buntu di TDZ debug (Task 1.1):** kirim error stack trace + hasil `madge --circular`, minta user pilih opsi: (a) refactor circular import, (b) keep minify=false sementara, (c) ganti minifier ke terser.
- **Audit duplikat manual_adjustments (Task 2.1):** sebelum apply unique index, kirim user hasil query duplikat dan tanya: keep latest, sum amount, atau review manual?
- **Pilihan virtualisasi (Task 3.1):** kirim user output spike (size impact, fitur yang masih perlu custom), minta keputusan A vs B.

### 12.6 Tools yang akan dipakai

Tools yang sudah disetup di Kiro CLI:
- `read` — baca file & directory
- `write` — buat/edit file
- `code` — search symbol, AST, codebase overview
- `grep` — search regex di file
- `glob` — find file by pattern
- `shell` — jalankan command (build, test, git)

**Untuk task yang merubah banyak file (mis. Task 3.3 split komponen):** pakai `code pattern_search` + `code pattern_rewrite` untuk refactor terprogram.

**Untuk debug TDZ:** pakai `shell` untuk run `madge`, baca output, lanjut analisis.

### 12.7 Catatan model switching

User akan menggunakan model **Sonnet** untuk eksekusi. Beberapa hal yang perlu diingat:
- Sonnet biasanya lebih ringkas, cepat, cocok untuk task implementasi yang sudah jelas.
- Setiap task spec di section 9 sudah self-contained, tidak perlu konteks chat sebelumnya.
- Bila Sonnet butuh klarifikasi tentang business logic atau prioritas, minta langsung ke user; jangan coba interpret dari section 6.
- Bila Sonnet bingung antara task A dan B, default selalu pilih yang risk lebih rendah (lihat tabel Risk di section 11.1).

### 12.8 Quick reference — bila buntu

| Pertanyaan | Lihat section |
|---|---|
| Apa pain point user? | Section 3.2, 3.3 |
| Apa target metrics? | Section 5.1 |
| File apa yang besar? | Section 6, Finding C, J |
| Bagaimana cara save edit sekarang? | Section 6, Finding D |
| Bagaimana cache di-invalidate? | Section 6, Finding E |
| Race condition di mana? | Section 6, Finding F |
| Mulai task mana? | Section 12.1 |
| Convention coding? | Section 12.2 (atau `AGENTS.md`) |
| Cara test? | Section 10 |

---

## 13. Index Dokumen Pendukung

### 13.1 Dokumen yang sudah ada di repo

| File | Isi | Relevansi |
|---|---|---|
| `AGENTS.md` | Repository guidelines (struktur, build, test, commit) | **Wajib baca** sebelum mulai |
| `docs/DAFTAR_UPAH_LOGIC.md` | Logic Daftar Upah (perhitungan kolom) | Referensi business logic, **JANGAN diubah** |
| `docs/MANUAL_ADJUSTMENT_API.md` | Spec API manual adjustment | Penting untuk Task 2.3 |
| `docs/FRONTEND_BACKEND_CONSISTENCY_AUDIT.md` | Audit konsistensi field FE/BE | Konteks Phase 2 |
| `docs/PAYROLL_LOGIC_MAP.md` | Map perhitungan payroll | Referensi |
| `docs/PAYROLL_SOURCE_FLOW.md` | Flow data source | Referensi |
| `docs/FIELD_TO_TABLE_MAPPING.md` | Mapping field UI ke kolom DB | Penting untuk Phase 4 |
| `docs/TAX_HISTORY_SOURCE_SYNC.md` | Sync tax history | Referensi |
| `docs/proxy-payroll-runbook.md` | Runbook proxy mode | Penting untuk Task 1.7 |
| `docs/_CLEANUP_TASK.md` | Cleanup task lama | Referensi historis |
| `backend/CAREER_HISTORY_API.md` | Spec career history | Referensi |
| `backend/LOGGING_CONFIG.md` | Logging config | Referensi |

### 13.2 File source utama yang akan disentuh

| File | Size | Phase | Task |
|---|---|---|---|
| `frontend/vite.config.js` | 6 KB | 1 | 1.1 |
| `frontend/src/App.jsx` | 56 KB | 1 | 1.2 |
| `frontend/src/components/CustomPayrollTable.jsx` | 254 KB | 2, 3 | 2.4, 2.5, 2.6, 3.2, 3.3 |
| `frontend/src/services/manualAdjustmentService.js` | 2 KB | 2 | 2.4 |
| `frontend/src/styles/CustomPayrollTable.css` | 68 KB | 3 | 3.2, 3.4 |
| `backend/src/index.ts` | 14 KB | 1 | 1.7 |
| `backend/src/api/payroll.ts` | 158 KB | 1, 2, 4 | 1.3, 2.3, 4.3 |
| `backend/src/services/cacheService.ts` | 4 KB | 1, 4 | 1.3, 4.5 |
| `backend/src/services/manualAdjustmentService.ts` | 130 KB | 2, 4 | 2.2, 2.3, 4.2 |
| `backend/src/services/dataExtractorService.ts` | 271 KB | 4 | 4.1 |
| `backend/sql/migrations/` | folder | 2 | 2.1 |

### 13.3 Dokumen yang AKAN dibuat selama eksekusi

| File | Phase | Task |
|---|---|---|
| `docs/decisions/ADR-virtualization.md` | 3 | 3.1 |
| `docs/decisions/ADR-db-driver.md` | 4 | 4.6 |
| `docs/archive/agent-history/CLAUDE.md` (move) | 1 | 1.6 |
| `docs/archive/agent-history/QWEN.md` (move) | 1 | 1.6 |
| `_dev_utils/scripts/legacy_backend/README.md` | 1 | 1.5 |
| `_dev_utils/scripts/dedupe_manual_adjustments_once.ts` | 2 | 2.1 |
| `_dev_utils/scripts/stress_concurrent_save.ts` | 2 | 10.3 |
| `backend/src/utils/rateLimiter.ts` | 4 | 4.4 |
| `backend/src/utils/debounce.ts` (frontend versi) | 2 | 2.6 |

### 13.4 Lampiran — Peta route Daftar Upah

**Frontend route relevan:**
- `/main` → `MainPage.jsx` → `CustomPayrollTable.jsx` (UI utama Daftar Upah)
- `/payslip-print` → `PayslipPrintPage.jsx`
- `/employee-detail/:nik` → `EmployeeDetailRoute.jsx`

**Backend endpoint relevan (saat ini di `backend/src/api/payroll.ts`):**

| Method | Path | Fungsi | Phase impact |
|---|---|---|---|
| GET | `/payroll/divisions` | List division | - |
| GET | `/payroll/gangs` | List gang per division | - |
| GET | `/payroll/current-period` | Periode payroll aktif | - |
| GET | `/payroll/headers` | Definisi header tabel | - |
| GET | `/payroll/columns` | Definisi kolom dinamis | - |
| GET | `/payroll/report/division-raw-tree` | Data tabel (non-stream) | 1 (cache) |
| GET | `/payroll/report/division-raw-tree/stream` | Data tabel (SSE) | 1 (cache) |
| POST | `/payroll/manual-edit` | Save 1 manual edit | 1 (cache), 2 (atomic) |
| POST | `/payroll/manual-edit/batch` | **BARU** Batch save | 2.3 |
| POST | `/payroll/manual-adjustment` | Save manual adjustment | 1, 2 |
| GET | `/payroll/manual-adjustment` | Get manual adjustments | - |
| DELETE | `/payroll/manual-adjustment/:id` | Delete by id | 1 (cache) |
| DELETE | `/payroll/manual-adjustment/column` | Delete column | 1 (cache) |
| POST | `/payroll/overrides/profile` | Override profile | 1 (cache spesifik) |
| POST | `/payroll/overrides/values` | Override values | 1 (cache spesifik) |
| POST | `/payroll/overrides/join-date` | Override join date | 1 (cache spesifik) |
| GET | `/payroll/manual-adjustment-presets` | List preset | - |
| POST | `/payroll/manual-adjustment-presets` | Save preset | - |

---

## Akhir Dokumen

**Versi:** 1.0
**Tanggal:** 2026-06-01
**Last reviewed by:** Kiro CLI Opus 4.7

**Untuk pertanyaan/klarifikasi yang tidak terjawab di dokumen ini, escalate ke user proyek.**



---

# BAGIAN 12: PRD - DASHBOARD REDESIGN V3

# PRD: Dashboard Daftar Upah Redesign V3
## Implementation Plan untuk Agent Eksekusi

---

## 1. Ringkasan Masalah & Tujuan

### Masalah Saat Ini
1. **MonthSelector popup terlalu besar** — mode full calendar (quarter grid) menghalangi konten, merusak UX terutama untuk kerani yang hanya perlu cepat pilih bulan
2. **Desain terlalu "keanak-anakan"** — dashboard-modern.css menggunakan animated mesh gradient, glassmorphism, emerald/teal yang tidak cocok untuk aplikasi financial/payroll
3. **Kerani butuh akses cepat ke isi daftar upah** — flow saat ini terlalu banyak langkah: pilih periode → divisi locked → pilih gang → klik button → navigasi ke halaman baru
4. **Tidak ada tema profesional yang konsisten** — styling campur aduk antara playful dashboard dan professional report

### Tujuan Redesign
- Dashboard profesional seperti **financial report** (tema summary-report.css + CustomPayrollTable.css)
- **Windows tile/grid card** layout — bersih, structured, tanpa animasi berlebihan
- Kerani bisa langsung **melihat isi daftar upah** dari dashboard tanpa popup yang menghalangi
- MonthSelector menggunakan **compact mode only** (inline select + arrows) di filter bar
- Reduce clicks 30%, faster report access, less scrolling

---

## 2. Design Direction — Dark Palm Theme (Referensi: index_payroll_dashboard.html)

### Tema Utama
**Dark mode enterprise dashboard** dengan nuansa palm/estate. Referensi lengkap ada di `C:\Users\nbgmf\Downloads\index_payroll_dashboard.html`.

### Color Tokens
```css
:root {
  --bg: #08111f;
  --bg-soft: #0d1727;
  --panel: #101c2e;
  --card: #111d2e;
  --card-2: #15243a;
  --border: rgba(255,255,255,.08);
  --text: #f8fafc;
  --muted: #94a3b8;
  --blue: #3b82f6;
  --cyan: #22d3ee;
  --green: #22c55e;
  --orange: #f97316;
  --purple: #8b5cf6;
  --red: #ef4444;
  --shadow: 0 20px 60px rgba(0,0,0,.36);
  --radius-xl: 24px;
  --radius-lg: 20px;
  --radius-md: 14px;
}
```

### Visual Characteristics
| Aspek | Detail |
|-------|--------|
| Font | Plus Jakarta Sans (400-800) |
| Background | `#08111f` + radial gradient biru/hijau subtle |
| Cards | Semi-transparent `rgba(255,255,255,.045)` → `rgba(255,255,255,.018)` gradient, border `rgba(255,255,255,.08)` |
| Radius | 14-24px (rounded, modern) |
| Shadows | Deep `0 20px 60px rgba(0,0,0,.36)` |
| Sidebar | Fixed, 76px, icon-only, `#07101d` |
| Topbar | 64px, sticky, backdrop-filter blur(16px) |
| Hero | 250px, background image sawit + gradient overlay |
| Filter Card | Floating (margin-top negative, overlap hero), backdrop-filter blur(18px) |
| KPI Cards | Glow effect (pseudo-element circle), large values 31px |
| Module Cards | Hover: translateY(-4px) + blue border glow |
| Insight Cards | Grid with icon + text, subtle background |

### Layout Structure
```
┌──────────────────────────────────────────────────────────┐
│ SIDEBAR (76px fixed)  │  MAIN CONTENT                    │
│ [Logo]                │  ┌─ TOPBAR (64px sticky) ──────┐ │
│ [⌂] active           │  │ [☰] PT REBINMAS    [🔔][U]  │ │
│ [▤]                   │  └────────────────────────────────┘│
│ [▥]                   │                                    │
│ [$]                   │  ┌─ HERO (250px) ────────────────┐│
│ [◌]                   │  │ Dashboard Payroll              ││
│ [✓]                   │  │ [badges: role, estate, gang]   ││
│ [◎]                   │  │                  [Periode Box] ││
│ [⚙]                   │  └──────────────────────────────────┘│
│                       │                                    │
│ [↪] logout           │  ┌─ FILTER CARD (floating) ──────┐│
│                       │  │ [Periode] [Divisi] [Gang]     ││
│                       │  │ [Estate] [Tampilkan Daftar]   ││
│                       │  └──────────────────────────────────┘│
│                       │                                    │
│                       │  ┌─ KPI GRID (4 cols) ───────────┐│
│                       │  │ [Total Upah] [Total HK]       ││
│                       │  │ [Jml Karyawan] [Cost/HK]      ││
│                       │  └──────────────────────────────────┘│
│                       │                                    │
│                       │  ┌─ ANALYTICS (2 cols) ──────────┐│
│                       │  │ [Line Chart] [Donut Chart]    ││
│                       │  │ [Insight Cards x4]            ││
│                       │  └──────────────────────────────────┘│
│                       │                                    │
│                       │  ┌─ MODULE SECTIONS ─────────────┐│
│                       │  │ Operational (4 cols grid)      ││
│                       │  │ Payslip & Kehadiran (4 cols)   ││
│                       │  │ Analysis (4 cols)              ││
│                       │  │ Finance (4 cols)               ││
│                       │  │ Verification (3 cols)          ││
│                       │  └──────────────────────────────────┘│
│                       │                                    │
│                       │  ┌─ ACTIVITY GRID (2 cols) ──────┐│
│                       │  │ [Quick Access] [Status]        ││
│                       │  └──────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

### Key Styling Rules
1. **Body background**: `radial-gradient(circle at top left, rgba(59,130,246,.18), transparent 28%), radial-gradient(circle at top right, rgba(34,197,94,.11), transparent 25%), var(--bg)`
2. **Cards**: `background: linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.018))` + `border: 1px solid var(--border)` + `border-radius: var(--radius-lg)`
3. **Filter card**: `background: rgba(16,28,46,.92)` + `backdrop-filter: blur(18px)` + floating overlap hero
4. **KPI glow**: `::after` pseudo-element, 130px circle, `opacity: .17`, `filter: blur(2px)`, color per card
5. **Module hover**: `transform: translateY(-4px)` + `border-color: rgba(59,130,246,.35)` + gradient shift
6. **Topbar**: `background: rgba(13,23,39,.92)` + `backdrop-filter: blur(16px)` + sticky
7. **Section headers**: eyebrow (uppercase, colored, 13px, 800 weight) + title (28px, -0.7px tracking) + subtitle (muted)
8. **Buttons**: `background: linear-gradient(135deg, #2563eb, #3b82f6)` + `box-shadow: 0 12px 30px rgba(37,99,235,.3)`

### Tema yang TIDAK DIPAKAI Lagi
- ❌ Light mode / white background
- ❌ Financial monochrome (summary-report.css style)
- ❌ Sharp 4px corners (sekarang 14-24px)
- ❌ Thin font weights (sekarang 600-800 bold)
- ❌ Animated mesh gradient (dashboard-modern.css emerald/teal)

---

## 3. Arsitektur Komponen

### File yang Perlu Dimodifikasi

| File | Aksi | Prioritas |
|------|------|-----------|
| `frontend/src/pages/ProfessionalDashboard.jsx` | **REWRITE** — ganti tema ke professional financial | P0 |
| `frontend/src/styles/dashboard-modern.css` | **REPLACE** — buat `dashboard-professional.css` baru | P0 |
| `frontend/src/components/common/MonthSelector.jsx` | **MODIFY** — hapus full mode, hanya compact | P1 |
| `frontend/src/pages/DashboardHome.jsx` | **DEPRECATE** — redirect ke ProfessionalDashboard | P2 |
| `frontend/src/layouts/DashboardLayout.jsx` | **MINOR** — pastikan routing ke dashboard baru | P2 |

### File Baru yang Perlu Dibuat

| File | Deskripsi |
|------|-----------|
| `frontend/src/styles/dashboard-professional.css` | CSS baru dengan tema financial professional |
| `frontend/src/components/dashboard/KeraniDaftarUpahPreview.jsx` | Widget preview isi daftar upah inline di dashboard |
| `frontend/src/components/dashboard/FilterBarCompact.jsx` | Sticky filter bar (compact, horizontal) |
| `frontend/src/components/dashboard/ModuleRegistry.js` | Registry semua module + role mapping (single source of truth) |

---

## 4. Layout Structure

### Referensi Visual
File: `C:\Users\nbgmf\Downloads\index_payroll_dashboard.html` (Dark Palm Theme)
Simpan copy ke: `docs/reference/dashboard-dark-palm-theme.html`

### Layout Utama (Semua Role)
```
┌────┬──────────────────────────────────────────────────────┐
│SIDE│ TOPBAR (64px, sticky, blur)                          │
│BAR │ [☰] PT REBINMAS JAYA              [🔔] [ADMIN] [U]  │
│76px├──────────────────────────────────────────────────────┤
│    │                                                      │
│[RJ]│ ┌─ HERO BANNER (250px, palm bg) ──────────────────┐ │
│    │ │ Dashboard Payroll                                │ │
│[⌂] │ │ Sistem Manajemen Data Upah                      │ │
│[▤] │ │ [Role: Kerani] [Estate: PG1A] [Gang: A1T]      │ │
│[▥] │ │                              ┌──────────┐       │ │
│[$] │ │                              │ Mei 2026 │       │ │
│[◌] │ │                              └──────────┘       │ │
│[✓] │ └────────────────────────────────────────────────────┘│
│[◎] │                                                      │
│[⚙] │ ┌─ FILTER CARD (floating, overlap hero -48px) ────┐ │
│    │ │ FILTER BAR                                       │ │
│    │ │ Filter Payroll                                   │ │
│    │ │ [Periode▾] [Divisi▾] [Gang▾] [Estate]           │ │
│    │ │                        [Tampilkan Daftar Upah]   │ │
│[↪] │ └────────────────────────────────────────────────────┘│
│    │                                                      │
│    │ ┌─ KPI SECTION ─────────────────────────────────────┐│
│    │ │ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐     ││
│    │ │ │Tot Upah│ │Tot HK  │ │Jml Kary│ │Cost/HK │     ││
│    │ │ │Rp 9.2M │ │336     │ │1,823   │ │Rp27,403│     ││
│    │ │ │ +8% ▲  │ │ +3% ▲  │ │ ±0%    │ │ +2% ▲  │     ││
│    │ │ └────────┘ └────────┘ └────────┘ └────────┘     ││
│    │ └────────────────────────────────────────────────────┘│
│    │                                                      │
│    │ ┌─ DAFTAR UPAH PREVIEW (Kerani only) ───────────────┐│
│    │ │ CustomPayrollTable (read-only, compact, 400px max)││
│    │ │ [Buka Detail Lengkap →]                           ││
│    │ └────────────────────────────────────────────────────┘│
│    │                                                      │
│    │ ┌─ ANALYTICS (non-kerani) ──────────────────────────┐│
│    │ │ [Line Chart 1.4fr] [Donut Chart .9fr]             ││
│    │ │ [Insight] [Insight] [Insight] [Insight]           ││
│    │ └────────────────────────────────────────────────────┘│
│    │                                                      │
│    │ ┌─ MODULE SECTIONS (role-filtered) ─────────────────┐│
│    │ │ § Operational (4 cols)                            ││
│    │ │ § Payslip & Kehadiran (4 cols)                    ││
│    │ │ § Analysis & Comparison (4 cols)                  ││
│    │ │ § Finance (4 cols)                                ││
│    │ │ § Verification (3 cols)                           ││
│    │ └────────────────────────────────────────────────────┘│
│    │                                                      │
│    │ ┌─ ACTIVITY GRID (2 cols) ──────────────────────────┐│
│    │ │ [Quick Access]          [Activity & Status]       ││
│    │ └────────────────────────────────────────────────────┘│
└────┴──────────────────────────────────────────────────────┘
```

### Untuk Role Lain (Payroll Admin, Finance, Executive)
- KPI Cards tetap tampil
- Daftar Upah Preview diganti dengan Analytics Charts
- Module tiles sesuai role (lihat Section 7)

### Module Group Layout (Bento Grid)
```
┌─────────────────────────────────────────────────────────────┐
│ OPERATIONAL                                                  │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ │Daftar    │ │Summary   │ │Upah IJL  │ │Upah      │       │
│ │Upah      │ │Report    │ │          │ │Rebinmas  │       │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
├─────────────────────────────────────────────────────────────┤
│ PAYSLIP & KEHADIRAN                                         │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ │Slip Gaji │ │Absensi/  │ │Lembur    │ │Info      │       │
│ │(Payslip) │ │HK        │ │          │ │Karyawan  │       │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
├─────────────────────────────────────────────────────────────┤
│ ANALYSIS & COMPARISON                                       │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ │Produkti- │ │Comparison│ │Impact    │ │Staging   │       │
│ │vitas     │ │          │ │Report    │ │vs Plantw.│       │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
├─────────────────────────────────────────────────────────────┤
│ FINANCE                                                     │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ │Executive │ │Detail    │ │Upah      │ │Pendapatan│       │
│ │Payroll   │ │Gaji      │ │Bersih    │ │Tdk Tetap │       │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
├─────────────────────────────────────────────────────────────┤
│ VERIFICATION                                                │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ │Verifikasi│ │Seeder    │ │Staging   │ │Spreadshee│       │
│ │Data      │ │          │ │Compare   │ │t Sync    │       │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Implementasi Detail per Komponen

### 5.1 Sidebar (Fixed, Icon-Only)
```
Width: 76px
Position: fixed, inset: 0 auto 0 0
Background: #07101d
Border-right: 1px solid rgba(255,255,255,.08)
Content: Logo (42px, white bg, red text "RJ") + nav icons (46px, rounded 14px)
Active state: white text + rgba(59,130,246,.18) bg + inset box-shadow left 3px blue
Logout icon: margin-top auto (bottom)
Mobile: hidden (hamburger in topbar)
```

### 5.2 Topbar (Sticky)
```
Height: 64px
Position: sticky, top: 0, z-index: 40
Background: rgba(13,23,39,.92)
Backdrop-filter: blur(16px)
Border-bottom: 1px solid rgba(255,255,255,.08)
Left: hamburger (42px) + "PT REBINMAS JAYA" (bold white)
Right: notification bell + role label (muted 13px) + avatar (blue circle, initial)
```

### 5.3 Hero Banner
```
Height: 250px
Border-radius: 24px
Overflow: hidden
Background:
  - linear-gradient(90deg, rgba(8,17,31,.95) 0%, rgba(8,17,31,.68) 48%, rgba(8,17,31,.35) 100%)
  - url(palm plantation image), cover, center
Content left:
  - h1: "Dashboard Payroll", 44px, weight 800, letter-spacing -1.4px
  - p: subtitle, 16px, color #cbd5e1
  - Badge row: [Role: xxx] [Estate: xxx] [Gang: xxx] — pill 999px, dark bg, 13px 600
Content right:
  - Period box: rounded 18px, blurred bg, "Mei 2026" bold 22px
```

### 5.4 Filter Card (Floating, CRITICAL)
```
Position: relative, margin-top: -48px (overlap hero), margin-inline: 22px
Background: rgba(16,28,46,.92)
Backdrop-filter: blur(18px)
Border: 1px solid rgba(255,255,255,.08)
Border-radius: 22px
Box-shadow: 0 20px 60px rgba(0,0,0,.36)
Padding: 26px
Z-index: 5

Header:
  - Eyebrow: "Filter Bar", blue, 13px, 800, uppercase, letter-spacing .1em
  - Title: "Filter Payroll", 28px, -0.7px tracking
  - Subtitle: muted, line-height 1.6
  - Floating icon: 54px, rounded 18px, blue bg/icon

Grid: 5 columns [1.2fr 1fr 1.6fr 1.1fr auto], gap 14px, align-items end
Inputs:
  - Height: 52px
  - Border-radius: 14px
  - Border: 1px solid rgba(255,255,255,.08)
  - Background: rgba(255,255,255,.04)
  - Color: white, font-weight 600
  - Chevron indicator on right

Button: "Tampilkan Daftar Upah"
  - Height: 52px, padding 0 24px
  - Background: linear-gradient(135deg, #2563eb, #3b82f6)
  - Box-shadow: 0 12px 30px rgba(37,99,235,.3)
  - Font-weight: 800, white
```

**PENTING**: Periode selector = dropdown style (tampilkan "Mei 2026" + chevron), BUKAN calendar popup.

### 5.5 KPI Cards
```
Grid: 4 columns, gap 20px
Card:
  - min-height: 146px, padding: 23px
  - background: linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.018))
  - border: 1px solid rgba(255,255,255,.08)
  - border-radius: 20px
  - box-shadow: 0 12px 34px rgba(0,0,0,.16)
  - overflow: hidden, position: relative

Glow (::after):
  - position: absolute, bottom-right (-20px, -35px)
  - width/height: 130px, border-radius: 50%
  - background: var(--glow) per card (blue/green/purple/orange)
  - opacity: .17, filter: blur(2px)

Content:
  - Top row: label (13px, uppercase, #aab7cf, 800) + trend pill (999px, colored)
  - Value: 31px, weight 800, letter-spacing -0.9px, white
  - Note: 14px, var(--muted)
```

### 5.6 Analytics Section
```
Grid: 2 columns [1.4fr .9fr], gap 20px
Chart cards: same card style, padding 24px, min-height 390px
  - Header: card-title (18px) + select dropdown (blue bg, 13px)
  - Chart 1: Line chart (Chart.js/Recharts), 6 months, Total Upah (blue fill) + Cost/HK (orange fill)
  - Chart 2: Doughnut chart, top divisi, cutout 64%, legend right

Insight cards (below, 4 columns):
  - min-height: 87px, padding: 17px
  - grid: [46px icon | 1fr text]
  - Icon: 46px, rounded 15px, colored bg (purple default)
  - Text: strong (white) + span (muted 13px)
```

### 5.7 Module Sections
```
Container:
  - background: rgba(16,28,46,.55)
  - border: 1px solid rgba(255,255,255,.08)
  - border-radius: 24px
  - padding: 24px
  - margin-bottom: 22px

Header:
  - Eyebrow: colored per group (orange/red/blue/green), 13px, 800, uppercase
  - Title: 28px section-title
  - Subtitle: muted
  - Right: module count badge (colored, 13px, 800)

Module grid: 4 columns (3 for verification), gap 18px
Module card:
  - min-height: 168px, padding: 22px
  - Same gradient card bg + border + radius 20px
  - Icon: 46px, rounded 15px, colored bg per group
  - h3: 18px, margin-top 20px
  - p: 14px, muted, line-height 1.45
  - a: "Open module →", #60a5fa, 800, 14px, margin-top auto

Hover:
  - transform: translateY(-4px)
  - border-color: rgba(59,130,246,.35)
  - background: linear-gradient(180deg, rgba(59,130,246,.12), rgba(255,255,255,.02))
  - transition: .2s ease
```

### 5.8 Daftar Upah Preview (Kerani Only)
```
Kondisi: role === 'kerani' DAN filter lengkap (divisi + gang)
Posisi: SETELAH filter card, SEBELUM KPI section

Container: same module-section style (dark panel, rounded 24px)
Header: eyebrow "Daftar Upah" + title "Preview Data Upah"
Content:
  - CustomPayrollTable embedded, compact, read-only
  - Max height: 400px, overflow-y auto
  - Dark mode table override: dark header bg, light text, subtle row borders
  - Kolom: NIK, Nama, HK, Premi Total, Lembur, Potongan, Upah Bersih
  - Auto-load saat gang berubah (no extra button click needed)

Footer: "Buka Detail Lengkap →" link (blue, 800 weight)
Fallback: placeholder card jika filter belum lengkap
```

### 5.9 Activity Grid (Bottom)
```
Grid: 2 columns, gap 20px
Cards: same chart-card style

Left: "Quick Access"
  - Eyebrow + title + subtitle
  - Status boxes: dark bg, rounded 18px, label (12px uppercase) + value (18px bold)

Right: "Activity & Status"
  - Periode aktif, Role aktif, Filter status
  - Success state: green bg rgba(34,197,94,.12), green border, green text #86efac
```

---

## 6. MonthSelector Refactor

### Perubahan yang Diperlukan
File: `frontend/src/components/common/MonthSelector.jsx`

**Hapus**: Full calendar mode (quarter grid, year navigator, month grid buttons)
**Pertahankan**: Compact mode — tapi style-nya disesuaikan ke dark theme

Di dashboard, MonthSelector ditampilkan sebagai **dropdown input** (bukan calendar popup):
```
┌─────────────────────────┐
│ Mei 2026            ⌄   │  ← height 52px, dark bg, white text
└─────────────────────────┘
```

### Implementasi di Dashboard
```jsx
// Di filter card, MonthSelector render sebagai styled select
// BUKAN calendar grid, BUKAN popup modal
<div className="input" onClick={openMonthDropdown}>
  {monthLabel} {year} <ChevronDown />
</div>

// Dropdown: simple list of months (native select atau custom dropdown)
// Style: dark bg rgba(255,255,255,.04), border rgba(255,255,255,.08)
// Height: 52px, border-radius: 14px
```

### Alasan
- Full calendar mode menghalangi konten (user complaint utama)
- Dark theme reference menggunakan simple dropdown "Mei 2026 ⌄"
- Kerani hanya perlu ganti bulan 1-2 kali, tidak perlu visual calendar
- Compact dropdown sudah cukup fungsional

---

## 7. Role-Based Module Visibility

### Complete Module Registry (Semua Menu yang Bisa Diakses dari Dashboard)

Berikut SEMUA route yang tersedia di aplikasi dan harus bisa diakses dari dashboard sesuai role:

```javascript
const ALL_MODULES = {
  operational: [
    { path: '/operational', label: 'Daftar Upah', description: 'Tampilkan isi daftar upah karyawan' },
    { path: '/summary', label: 'Summary Report', description: 'Ringkasan upah dan rekap utama' },
    { path: '/wages-ijl', label: 'Upah IJL', description: 'Laporan upah tenaga IJL' },
    { path: '/wages-rebinmas', label: 'Daftar Upah Rebinmas', description: 'Laporan payroll Rebinmas' },
  ],
  payslip_attendance: [
    { path: '/payslip-print', label: 'Payslip / Slip Gaji', description: 'Cetak slip gaji karyawan', openNewTab: true },
    { path: '/operational?view=attendance', label: 'Absensi / HK', description: 'Matrix kehadiran per gang' },
    { path: '/operational?view=overtime', label: 'Lembur', description: 'Matrix lembur per gang' },
    { path: '/operational?view=employee-directory', label: 'Info Karyawan', description: 'Data karyawan per gang' },
  ],
  analysis: [
    { path: '/productivity', label: 'Produktivitas', description: 'Tonase, HK, dan biaya per performa' },
    { path: '/wages-comparison', label: 'Comparison', description: 'Perbandingan payroll antar periode' },
    { path: '/impact', label: 'Impact Report', description: 'Analisis dampak biaya dan perubahan' },
    { path: '/comprehensive', label: 'Comprehensive Analysis', description: 'Analisis payroll lintas komponen' },
    { path: '/mill-production', label: 'Produktivitas Kebun', description: 'Tonase FFB, HK, dan biaya kebun' },
    { path: '/tonase-analysis', label: 'Tonase Analysis', description: 'Analisis tonase detail per divisi' },
    { path: '/staging-comparison', label: 'Staging vs Plantware', description: 'Perbandingan data staging dan plantware' },
  ],
  finance: [
    { path: '/executive', label: 'Executive Payroll', description: 'Ringkasan high-level biaya payroll' },
    { path: '/detailed-salary', label: 'Detail Gaji', description: 'Rincian gaji, lembur, dan komponen' },
    { path: '/detail-upah-bersih', label: 'Upah Bersih', description: 'Detail payroll bersih per filter' },
    { path: '/pendapatan-tidak-tetap', label: 'Pendapatan Tidak Tetap', description: 'Komponen pendapatan non-rutin' },
    { path: '/report-pajak', label: 'Report Pajak', description: 'Unduh dan audit laporan pajak' },
    { path: '/report/high-earners', label: 'High Earner Report', description: 'Karyawan dengan gaji tertinggi' },
    { path: '/report/salary-range-detail', label: 'Salary Range', description: 'Distribusi range gaji' },
  ],
  verification: [
    { path: '/data-verification', label: 'Verifikasi Data', description: 'Verifikasi konsistensi data payroll' },
    { path: '/seed', label: 'Seeder', description: 'Re-aggregation data manual' },
    { path: '/staging-comparison', label: 'Staging Comparison', description: 'Bandingkan data staging vs plantware' },
    { path: '/spreadsheet-sync', label: 'Spreadsheet Sync', description: 'Sinkronisasi data spreadsheet' },
  ],
  directory: [
    { path: '/employee-directory', label: 'Employee Directory', description: 'Direktori dan analytics karyawan' },
    { path: '/employee/detail', label: 'Detail Karyawan', description: 'Profil lengkap karyawan', openNewTab: true },
    { path: '/hr-info', label: 'HR Info', description: 'Informasi HR dan karir', openNewTab: true },
  ]
}
```

### Kerani
```
Visible:
  ✓ KPI Cards (4 cards)
  ✓ Daftar Upah Preview (auto-load, inline table)
  ✓ Module: Daftar Upah (link ke /operational full view)
  ✓ Module: Payslip / Slip Gaji (cetak slip gaji)
  ✓ Module: Absensi / HK (matrix kehadiran)
  ✓ Module: Lembur (matrix lembur)
  ✓ Module: Info Karyawan (data per gang)
  ✓ Module: Staging vs Plantware (perbandingan data)
  
Hidden:
  × Analytics charts (productivity, impact)
  × Seeder, Verification, Correction
  × Executive Payroll, Finance modules
  × High Earner, Salary Range
  
Special:
  - Divisi LOCKED (amber indicator)
  - Button text: "Tampilkan Daftar Upah" (bukan "Generate")
  - Auto-load preview saat gang dipilih
  - Payslip bisa diakses langsung dari preview table (select employees → print)
```

### Payroll Admin
```
Visible:
  ✓ KPI Cards
  ✓ ALL Operational modules (Daftar Upah, Summary, IJL, Rebinmas)
  ✓ ALL Payslip/Attendance modules (Payslip, Absensi, Lembur, Info Karyawan)
  ✓ Verification modules (Verifikasi, Seeder, Koreksi, Staging Comparison, Spreadsheet Sync)
  ✓ Finance: Report Pajak
  ✓ Directory: Employee Directory
  ✓ Analysis: Staging vs Plantware
  
Hidden:
  × Productivity analytics (estate manager domain)
  × Executive-level insights
```

### Finance
```
Visible:
  ✓ KPI Cards
  ✓ ALL Finance modules (Executive Payroll, Detail Gaji, Upah Bersih, PTT, Pajak, High Earner, Salary Range)
  ✓ Analytics (Cost trends, payroll distribution)
  ✓ Comparison, Comprehensive Analysis
  ✓ Summary Report
  
Hidden:
  × Seeder, Verification, Spreadsheet Sync
  × Operational detail (daftar upah per gang)
```

### Estate Manager / Executive
```
Visible:
  ✓ KPI Cards (prominent)
  ✓ Analytics (Trends, Productivity vs Cost, Top Divisi)
  ✓ ALL Analysis modules (Productivity, Comparison, Impact, Comprehensive, Mill Production, Tonase)
  ✓ Summary Report
  ✓ Executive Payroll
  ✓ Staging vs Plantware
  
Hidden:
  × Operational detail per gang
  × Seeder, Correction, Spreadsheet Sync
```

---

## 8. CSS Architecture

### File: `frontend/src/styles/dashboard-professional.css`

```css
/* Dark Palm Theme - Payroll Dashboard
   Referensi: index_payroll_dashboard.html
   
   Design principles:
   - Dark mode (#08111f base)
   - Semi-transparent cards with subtle borders
   - Radial gradient background (blue/green subtle)
   - Large rounded corners (14-24px)
   - Bold typography (Plus Jakarta Sans, 600-800)
   - Glow effects on KPI cards
   - Hover lift on module cards
   - Backdrop-filter blur on floating elements
*/

:root {
  --bg: #08111f;
  --bg-soft: #0d1727;
  --panel: #101c2e;
  --card: #111d2e;
  --card-2: #15243a;
  --border: rgba(255,255,255,.08);
  --text: #f8fafc;
  --muted: #94a3b8;
  --blue: #3b82f6;
  --cyan: #22d3ee;
  --green: #22c55e;
  --orange: #f97316;
  --purple: #8b5cf6;
  --red: #ef4444;
  --shadow: 0 20px 60px rgba(0,0,0,.36);
  --radius-xl: 24px;
  --radius-lg: 20px;
  --radius-md: 14px;
}

.dashboard-dark {
  font-family: "Plus Jakarta Sans", sans-serif;
  background:
    radial-gradient(circle at top left, rgba(59,130,246,.18), transparent 28%),
    radial-gradient(circle at top right, rgba(34,197,94,.11), transparent 25%),
    var(--bg);
  color: var(--text);
  min-height: 100vh;
}

.dashboard-dark .card {
  background: linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.018));
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: 0 12px 34px rgba(0,0,0,.16);
}

.dashboard-dark .module-card:hover {
  transform: translateY(-4px);
  border-color: rgba(59,130,246,.35);
  background: linear-gradient(180deg, rgba(59,130,246,.12), rgba(255,255,255,.02));
}

.dashboard-dark .btn-primary {
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  box-shadow: 0 12px 30px rgba(37,99,235,.3);
  color: #fff;
  font-weight: 800;
  border: 0;
  border-radius: var(--radius-md);
}

.dashboard-dark .filter-card {
  background: rgba(16,28,46,.92);
  backdrop-filter: blur(18px);
  border: 1px solid var(--border);
  border-radius: 22px;
  box-shadow: var(--shadow);
}

.dashboard-dark .topbar {
  background: rgba(13,23,39,.92);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--border);
}
```

### Responsive Breakpoints
```css
@media (max-width: 1200px) {
  .filter-grid, .kpi-grid, .module-grid, .analytics-grid, .activity-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 760px) {
  .app { grid-template-columns: 1fr; }
  .sidebar { display: none; }
  .filter-grid, .kpi-grid, .module-grid, .analytics-grid, .activity-grid {
    grid-template-columns: 1fr;
  }
}
```

---

## 9. Execution Steps (Urutan Implementasi)

### Phase 1: Foundation (P0)
1. **Buat `dashboard-professional.css`** — CSS baru dengan tema financial
2. **Refactor `ProfessionalDashboard.jsx`** — ganti semua inline styles ke CSS classes, hapus animated/playful elements, terapkan tema professional
3. **MonthSelector compact-only** — hapus full calendar mode, pastikan hanya compact yang render

### Phase 2: Kerani Experience (P0)
4. **Buat `KeraniDaftarUpahPreview.jsx`** — widget yang auto-load dan tampilkan CustomPayrollTable inline (read-only, compact columns)
5. **Integrasi preview ke dashboard** — jika role kerani + filter lengkap, tampilkan preview table
6. **Filter bar behavior** — auto-trigger load saat gang berubah (untuk kerani)

### Phase 3: Polish (P1)
7. **Module tiles** — implementasi Windows tile grid dengan border-left accent
8. **KPI cards** — implementasi dengan monospace values, thin weight, sharp corners
9. **Role-based visibility** — pastikan module filtering benar per role
10. **Responsive** — 4-col → 2-col → 1-col grid breakpoints

### Phase 4: Cleanup (P2)
11. **Deprecate DashboardHome.jsx** — redirect ke ProfessionalDashboard
12. **Remove dashboard-modern.css references** — hapus import animated styles
13. **Testing** — pastikan semua role bisa akses dashboard dengan benar

---

## 10. Akses Menu Detail dari Dashboard

### Payslip / Slip Gaji
- Dari dashboard: klik tile "Slip Gaji" → buka `/payslip-print` di tab baru
- Dari Daftar Upah Preview (kerani): select karyawan → button "Cetak Slip Gaji" → buka payslip print page
- Perlu: division, gang, month, year, selected employee codes

### Absensi / HK (Attendance Matrix)
- Dari dashboard: klik tile "Absensi/HK" → navigasi ke `/operational?view=attendance`
- OperationalReportWrapper sudah support `viewMode` state
- Menampilkan GangAttendanceMatrix component

### Lembur (Overtime Matrix)
- Dari dashboard: klik tile "Lembur" → navigasi ke `/operational?view=overtime`
- Menampilkan GangOvertimeMatrix component

### Staging vs Plantware
- Dari dashboard: klik tile "Staging vs Plantware" → navigasi ke `/staging-comparison`
- StagingComparisonPage sudah ada sebagai route
- Membandingkan data dari staging database vs plantware

### Info Karyawan
- Dari dashboard: klik tile "Info Karyawan" → navigasi ke `/operational?view=employee-directory`
- Menampilkan GangEmployeeInfo component

### Implementasi Navigation Helper
```javascript
// Di ProfessionalDashboard, handle tile click dengan query params
const handleTileClick = (module) => {
  if (module.openNewTab) {
    // Payslip, Employee Detail, HR Info → buka di tab baru
    const params = new URLSearchParams({ month, year, division, gang });
    window.open(buildAppPath(`${module.path}?${params}`), '_blank');
  } else if (module.path.includes('?view=')) {
    // Attendance, Overtime, Employee → navigasi dengan view mode
    navigate(module.path);
  } else {
    navigate(module.path);
  }
};
```

---

## 11. Data Flow untuk Kerani Preview

```
Dashboard Load
  → guessRole(user) === 'kerani'
  → Filter bar: divisi LOCKED, gang dropdown loaded
  → User pilih gang
  → Auto-fetch: GET /payroll/data?month={m}&year={y}&division={locked}&gang={selected}
  → Render CustomPayrollTable (compact, read-only)
  → Kolom: NIK, Nama, HK, Premi, Lembur, Potongan, Upah Bersih
  → Footer: "Buka Detail Lengkap →" → navigate('/operational')
```

### API Endpoint yang Digunakan
- `GET /payroll/dashboard/executive-summary` — untuk KPI cards
- `GET /payroll/data` — untuk preview tabel (existing endpoint, same as MainPage)
- Gang list: sudah di-handle oleh `ReportContext` (gangs state)

---

## 12. Constraints & Notes

1. **CustomPayrollTable.jsx** (263KB) — JANGAN refactor. Gunakan as-is dalam mode read-only
2. **ReportContext** — sudah handle state month/year/division/gang/gangs. Gunakan context yang sama
3. **AuthContext** — sudah handle user role detection. Gunakan `user.role`
4. **lockedDivisionService** — sudah handle locked division logic untuk kerani
5. **Existing TOKENS object** di ProfessionalDashboard — GANTI dengan DESIGN_TOKENS baru yang lebih professional
6. **Jangan hapus** ProfessionalDashboard.jsx — refactor in-place
7. **MonthSelector compact prop** sudah ada — cukup pastikan full mode tidak dipanggil dari dashboard

---

## 13. Success Criteria

- [ ] Dashboard menggunakan tema professional (navy header, sharp cards, no animations)
- [ ] MonthSelector hanya compact mode di dashboard (no popup calendar)
- [ ] Kerani bisa lihat isi daftar upah langsung dari dashboard
- [ ] Filter bar sticky dan horizontal (periode + divisi + gang + button)
- [ ] Module tiles menggunakan Windows grid card style (border-left accent)
- [ ] KPI values menggunakan monospace font, thin weight
- [ ] Role-based module visibility bekerja dengan benar
- [ ] Tidak ada animated gradient atau glassmorphism
- [ ] Responsive: 4-col desktop → 2-col tablet → 1-col mobile
- [ ] Payslip/Slip Gaji bisa diakses dari dashboard tile (buka tab baru)
- [ ] Absensi/HK bisa diakses dari dashboard tile (navigasi ke operational?view=attendance)
- [ ] Lembur bisa diakses dari dashboard tile (navigasi ke operational?view=overtime)
- [ ] Staging vs Plantware bisa diakses dari dashboard tile (navigasi ke /staging-comparison)
- [ ] Info Karyawan bisa diakses dari dashboard tile
- [ ] Semua module yang ada di route App.jsx terdaftar di MODULE_GROUPS dashboard


---

# BAGIAN 13: PRD - STAGING COMPARISON UI

# PRD — UI Report Detail Matriks: Staging vs DB Plantware

> **Status**: Ready to implement
> **Author**: Plan dihasilkan dari eksplorasi + smoke test live (backend port 8002)
> **Owner**: Pengembang yang menjalankan rencana ini (target: Sonnet)
> **Pre-req doc**: `docs/STAGING_VS_DBPTRJ_MAPPING.md`
> **Versi**: 1.0 — 2026-06-01

---

## 1. Latar Belakang & Tujuan

### 1.1 Konteks
Aplikasi payroll PT Rebinmas Jaya menarik data dari `db_ptrj` (Plantware production DB) untuk menampilkan Daftar Upah. Sebelum masuk ke `db_ptrj`, data berasal dari `staging_PTRJ_iFES_Plantware` (raw scan device). Mapping & verifikasi sudah dibakukan di `docs/STAGING_VS_DBPTRJ_MAPPING.md`.

Backend Elysia `/api/staging/*` (8 endpoint) sudah hidup dan diuji (smoke test 2026-06-01) — sumber data UI siap pakai. Yang belum ada: **UI yang menampilkan komparasi tersebut secara matriks per modul (kehadiran, lembur, brondol)** termasuk meng-expose **anomali ID double** (contoh `LF90439471_01`) yang biasanya disembunyikan dari laporan upah.

### 1.2 Tujuan UI
Menyediakan halaman investigasi `/staging-comparison` di Dashboard yang:
1. Menampilkan **3 matriks komparasi**: Kehadiran, Lembur, Brondol (Loosefruit) — Staging vs DB Plantware.
2. Menampilkan **anomali ID double** (record `PR_LOOSEFRUIT_ARC` yang `DocDate`-nya berisi kode `LF########_##` alih-alih tanggal valid) sebagai kategori discrepancy yang berdiri sendiri — bukan dibuang seperti di laporan payroll.
3. Mendukung drill-down per-tanggal (daily summary) dan per-baris (row-level).
4. Mengikuti konvensi UI yang sudah ada (`DataVerificationPage`, `DbPtrjCompareReportModal`).

### 1.3 Non-Goals
- Tidak menulis ke DB. UI ini read-only investigasi.
- Tidak mereplikasi seluruh fungsi `Report Verifikasi Data` yang sudah ada — fokus hanya komparasi staging vs db_ptrj.
- Tidak mengubah logika perhitungan brondol payroll (filter `CHARINDEX('_', DocDate) = 0` tetap berlaku di laporan upah).

---

## 2. Hasil Eksplorasi & Validasi (sumber kebenaran)

### 2.1 Endpoint backend (sudah ada, sudah diuji)

Base path: `/api/staging` (dimount di `backend/src/index.ts:285,310`).

| # | Method | Path | Query (default) | Hasil smoke test 2026-06-01 |
|---|--------|------|-----------------|----------------------------|
| 1 | GET | `/explore/tables` | — | ✅ 30 tabel |
| 2 | GET | `/explore/table/:name` | `sample=10` | ✅ (tidak diuji ulang) |
| 3 | GET | `/compare/attendance` | `date=2026-05-28&limit=50` | ✅ 5/5=100%, staging=1534, prod=1731 |
| 4 | GET | `/compare/overtime` | `date=2026-05-28&limit=50` | ✅ 4/5=80%, A0001 staging_only |
| 5 | GET | `/compare/loosefruit` | `date=2026-05-28&limit=50` | ✅ 5/5=100%, staging=518, prod=518 |
| 6 | GET | `/compare/daily-attendance` | `month=5&year=2026&top=15` | ✅ |
| 7 | GET | `/compare/daily-overtime` | `month=5&year=2026&top=15` | ✅ |
| 8 | GET | `/compare/daily-loosefruit` | `month=5&year=2026&top=15` | ❌ **BUG**: `Invalid column name 'cnt'` |

Schema response (sudah dikonfirmasi via curl):
```jsonc
// /compare/{attendance|overtime|loosefruit}
{ "success": true, "data": { "rows": [...], "summary": { "match_count", "staging_only", "prod_only", "staging_total", "prod_total", "pct_match" } } }

// /compare/daily-{attendance|overtime|loosefruit}
{ "success": true, "data": [ { "date", "staging", "prod_taskreg", "prod_arc" }, ... ] }
```

Field tiap row (contoh attendance):
```jsonc
{ "emp_code": "A0001", "job_code": "PM0110", "trans_date": "2026-05-28",
  "staging_trx": 1, "prod_found": true, "prod_task_code": "PM0110P1A",
  "prod_hours": 7, "prod_ot": false }
```

### 2.2 Pola ID Double `LF########_##` — Penemuan Kritis

**Lokasi pola**: kolom `DocDate` (BUKAN `DocNo`/`DocID`) di tabel `PR_LOOSEFRUIT_ARC` di `db_ptrj`.

**Bukti di codebase**:
- `backend/src/services/reportService.ts:186` — comment: `Filter out ID codes like LF50317375_01, only use real dates`
- `backend/query/Tunjangan/get_brondol_amount.sql:8` — filter aktif: `AND CHARINDEX('_', LF.DocDate) = 0`

**Implikasi untuk laporan upah** (existing): record dengan pola `LF########_##` di-EXCLUDE supaya tidak ikut perhitungan brondol.

**Implikasi untuk UI komparasi** (PRD ini): record-record itu justru harus DI-INCLUDE dengan flag visual karena:
- Mereka adalah baris valid yang ada di staging tapi tampil "missing" di payroll.
- Mereka adalah sumber utama selisih `staging_total` vs `prod_total` di modul brondol.
- User butuh tahu eksistensinya untuk audit data integrity.

### 2.3 Bug yang harus diperbaiki sebelum UI dipakai

**File**: `backend/src/services/additional_service/explore_staging/stagingComparisonService.ts`
**Method**: `dailyLoosefruitSummary` (sekitar line 422-445)
**Bug**: `ORDER BY cnt DESC` — alias `cnt` tidak ada di SELECT, yang ada `trx_count`.
**Fix**: ganti `ORDER BY cnt DESC` → `ORDER BY trx_count DESC`.

### 2.4 Risiko keamanan endpoint staging

**File**: `backend/src/api/stagingRoutes.ts`
**Temuan**: BELUM ada middleware auth (tidak ada `Authorization` check / token verifikasi).
**Konsekuensi**: endpoint `/api/staging/*` saat ini publik via proxy.
**Rekomendasi**: tambah guard JWT/token sama seperti pola di `payrollRoutes` / `summaryRoutes`. Tetapi tahap pertama UI ini boleh tetap pakai endpoint publik untuk kecepatan delivery — **flag sebagai TODO P1** setelah UI rilis.

### 2.5 Risiko SQL injection ringan

Service melakukan string interpolation `'${date}'` untuk parameter `date` di staging query (`stagingComparisonService.ts` line ~92, ~152, ~233). `date` berasal dari query string. Saat ini fungsi service dipanggil dari route Elysia tanpa whitelist regex `^\d{4}-\d{2}-\d{2}$`.
**Mitigasi mudah**: tambah validasi regex di route handler sebelum panggil service. Masuk daftar TODO P2.

---

## 3. Skema Data (rangkuman dari DB schema)

### 3.1 Staging
| Tabel | Kolom Penting |
|---|---|
| `Gwscannerdata` | WORKERCODE, JOBCODE, TRANSDATE, TRANSNO, FIELDNO, FROMOCCODE |
| `Overtime` | WORKERCODE, JOBCODE, HOURS, BASICRATE, ADDRATE, TRANSDATE, TRANSNO |
| `Ffbscannerdata` | WORKERCODE, FROMOCCODE, TRANSDATE, LOOSEFRUIT, RIPE, UNRIPE, TASKNO, TRANSNO |

### 3.2 db_ptrj
| Tabel | Kolom Penting |
|---|---|
| `PR_TASKREGLN` | EmpCode, TaskCode, TrxDate, Hours, OT, Rate, ChargeTo, ID |
| `PR_LOOSEFRUITLN` | EmpCode, TrxDate, MT, ChargeTo, MasterID, ID |
| `PR_LOOSEFRUIT` (header) | ID, DocDate, DocDesc, DocID |
| `PR_LOOSEFRUIT_ARC` (archive) | sama, **DocDate sebagian berisi kode `LF########_##`** |

### 3.3 Mapping kunci

```
Kehadiran:    Gwscannerdata(WORKERCODE+JOBCODE+TRANSDATE) → PR_TASKREGLN(EmpCode+TaskCode LIKE %JOBCODE%+TrxDate)
Lembur:       Overtime(WORKERCODE+TRANSDATE)              → PR_TASKREGLN(EmpCode+TrxDate+OT=1) [fallback PR_MTHRATEDOTLN]
Brondol:      Ffbscannerdata.LOOSEFRUIT(WORKERCODE+TRANSDATE+FROMOCCODE) → PR_LOOSEFRUITLN(EmpCode+TrxDate)
```


---

## 4. Desain UI

### 4.1 Lokasi dalam aplikasi

| Aspek | Nilai |
|---|---|
| Route | `/staging-comparison` |
| Page file | `frontend/src/pages/StagingComparisonPage.jsx` |
| Service file | `frontend/src/services/stagingComparisonService.js` |
| Wrapper | `<SummaryReportWrapper component={StagingComparisonPage} />` di `App.jsx` |
| Sidebar section | `Verification` (di `DashboardLayout.jsx` `navItems`) |
| Sidebar item label | `Komparasi Staging vs DB` |
| Icon | `GitCompare` dari `lucide-react` (atau `Database` jika belum ada) |
| Roles yang melihat menu | `payroll_admin`, `finance` |

### 4.2 Layout halaman (top-down)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Header                                                             │
│  ─ Title: "Komparasi Staging vs DB Plantware"                       │
│  ─ Subtitle: ringkasan periode aktif + invariant info               │
├─────────────────────────────────────────────────────────────────────┤
│  Toolbar (sticky)                                                   │
│  ─ Tab: [Kehadiran] [Lembur] [Brondol]                              │
│  ─ Mode: [Daily Summary] [Row Detail]                               │
│  ─ Picker: Bulan/Tahun (untuk Daily) ATAU Tanggal (untuk Row)       │
│  ─ Limit row (untuk Row Detail): 50/100/250/500                     │
│  ─ Action: [Refresh] [Export CSV]                                   │
├─────────────────────────────────────────────────────────────────────┤
│  Summary KPI Cards (4-6 cards)                                      │
│  ─ Staging Total | Prod Total | Match | Staging-only | Prod-only    │
│    | Pct Match (gauge)                                              │
│  ─ Untuk tab Brondol tambahan: "ID Double Detected" card            │
├─────────────────────────────────────────────────────────────────────┤
│  Body (mode-dependent)                                              │
│  ─ DAILY MODE: tabel per-tanggal + bar chart staging vs prod        │
│  ─ ROW MODE: tabel detail dengan filter status & search             │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.3 Komponen yang harus dibuat

#### 4.3.1 `frontend/src/services/stagingComparisonService.js`
Wrapper axios untuk 6 endpoint compare (skip explore — bukan kebutuhan UI ini).

```js
import axios from 'axios';
import { buildBackendUrl } from '../utils/apiBase';

const get = async (path, params = {}, token) => {
  const url = buildBackendUrl(path);
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await axios.get(url, { params, headers });
  if (res.data?.success === false) throw new Error(res.data.error || 'Request failed');
  return res.data?.data;
};

export const fetchAttendanceCompare = (token, { date, limit = 50 }) =>
  get('/api/staging/compare/attendance', { date, limit }, token);
export const fetchOvertimeCompare = (token, { date, limit = 50 }) =>
  get('/api/staging/compare/overtime', { date, limit }, token);
export const fetchLoosefruitCompare = (token, { date, limit = 50 }) =>
  get('/api/staging/compare/loosefruit', { date, limit }, token);

export const fetchDailyAttendance = (token, { month, year, top = 31 }) =>
  get('/api/staging/compare/daily-attendance', { month, year, top }, token);
export const fetchDailyOvertime = (token, { month, year, top = 31 }) =>
  get('/api/staging/compare/daily-overtime', { month, year, top }, token);
export const fetchDailyLoosefruit = (token, { month, year, top = 31 }) =>
  get('/api/staging/compare/daily-loosefruit', { month, year, top }, token);
```

#### 4.3.2 `frontend/src/pages/StagingComparisonPage.jsx`
Page utama. State minimum:
- `module` ∈ `{'attendance','overtime','loosefruit'}` (tab utama)
- `mode` ∈ `{'daily','row'}`
- `month`, `year` (default dari `useReport()`), `date` (default `2026-05-28` atau hari ke-28 di bulan terpilih)
- `limit` (default 50)
- `loading`, `error`, `data`, `summary`
- `searchQuery`, `statusFilter`

Pola hampir identik dengan `DataVerificationPage.jsx` — gunakan sebagai template untuk:
- summary cards
- tab buttons
- filter row (search + status select)
- table dengan `idx % 2 === 0` zebra striping
- CSV export button

#### 4.3.3 Sub-komponen (boleh inline di page atau dipisah)
- `StagingComparisonSummaryCards` — 5-6 KPI cards.
- `DailySummaryTable` — kolom: Tanggal | Staging | Prod | Selisih | %match (mini bar).
- `AttendanceRowTable` — kolom: EmpCode | JobCode | Date | Staging Trx | Prod TaskCode | Prod Hours | Prod OT | Status badge.
- `OvertimeRowTable` — kolom: EmpCode | JobCode | Date | Staging Hours | Staging Rate | Prod Table | Prod TaskCode | Prod Hours | Status.
- `LoosefruitRowTable` — kolom: EmpCode | Date | OC | Staging Bunches | Prod MT | **DocID Flag** | Status.
- (Opsional v2) `DoubleIdInspectorPanel` — untuk modul Brondol, panel khusus yang memanggil endpoint baru `/compare/loosefruit-anomaly` (lihat §5).

### 4.4 Status row & color coding (konsisten dengan pola existing)

| Status | Trigger logic | Color |
|---|---|---|
| `MATCH` | `prod_found = true` & nilai numeric staging ≈ prod | `#047857` / `#ecfdf5` |
| `STAGING_ONLY` | `prod_found = false` | `#dc2626` / `#fef2f2` |
| `VALUE_DIFF` | `prod_found = true` tapi selisih > toleransi | `#b45309` / `#fffbeb` |
| `DOUBLE_ID` | (Loosefruit only) record `PR_LOOSEFRUIT_ARC` dengan `DocDate` mengandung `_` | `#7c3aed` / `#f5f3ff` |

Toleransi `VALUE_DIFF`:
- Hours: selisih > 0.01 jam.
- MT/Bunches: selisih bukan 0 (staging dalam bunches, prod dalam MT — sesuai doc 1:1, sehingga selisih ≠ 0 = anomaly nyata).

### 4.5 Interaksi

1. Default page load: `module=attendance`, `mode=daily`, `month/year` dari ReportContext, fetch `daily-attendance`.
2. Ganti tab → fetch endpoint sesuai modul.
3. Toggle mode → fetch endpoint daily/row.
4. Klik baris di Daily table → switch ke Row mode dengan `date` baris itu (deep-dive).
5. Search input → filter client-side (emp_code/job_code/oc).
6. Status filter dropdown → filter client-side berdasarkan kolom status.
7. Refresh button → re-fetch.
8. Export CSV → flatten rows + summary, sama dengan pola di `DataVerificationPage.exportCSV`.

### 4.6 Empty / Loading / Error states (wajib)
- Loading: `<LoadingScreen isLoading={loading} message="Memuat komparasi..." />`.
- Error: panel merah (mirror `DataVerificationPage`).
- Empty: panel abu dengan icon dan teks "Tidak ada data untuk periode ini".

### 4.7 Print/Print-friendly
Tidak diprioritaskan di v1. Namun struktur HTML dijaga supaya print default browser tetap readable.


---

## 5. Perubahan Backend yang Dibutuhkan

### 5.1 Fix bug `dailyLoosefruitSummary` (WAJIB sebelum UI dipakai)

**File**: `backend/src/services/additional_service/explore_staging/stagingComparisonService.ts`
**Lokasi**: method `dailyLoosefruitSummary`, query staging, line ~432.

```diff
  GROUP BY CAST(TRANSDATE AS DATE)
- ORDER BY cnt DESC
+ ORDER BY trx_count DESC
```

Lalu di mapping output, field `staging_workers` & `staging_lf_bunches` sudah benar (pakai `row.workers` & `row.total_lf`). Tidak perlu ubah field lain.

**Verifikasi**: `curl http://localhost:8002/api/staging/compare/daily-loosefruit?month=5&year=2026&top=5` harus return `success:true`.

### 5.2 Endpoint baru `/api/staging/compare/loosefruit-anomaly` (untuk fitur Double ID)

**Tujuan**: menyajikan baris-baris `PR_LOOSEFRUIT_ARC` yang `DocDate`-nya mengandung underscore (kode `LF########_##`) — yang biasa di-EXCLUDE dari laporan upah.

**Method baru di service**:

```ts
async loosefruitAnomalies(month: number, year: number, limit = 100): Promise<{
    rows: Array<{
        doc_id: string;
        doc_no: string;
        doc_date_raw: string;     // contoh: "LF90439471_01"
        emp_codes: string[];      // dari PR_LOOSEFRUITLN
        line_count: number;
        total_mt: number;
        total_amount: number;
    }>;
    summary: {
        total_anomaly_headers: number;
        total_anomaly_lines: number;
        total_amount_excluded: number;
    };
}> {
    // Query header anomaly
    const headers = await this.prodDb.query<any>(
        `SELECT TOP ${limit}
                LF.ID, LF.DocID, LF.DocNo, LF.DocDate as DocDateRaw,
                COUNT(LFLN.ID) as LineCount,
                SUM(LFLN.MT) as TotalMT,
                SUM(LFLN.Amount) as TotalAmount
         FROM PR_LOOSEFRUIT_ARC LF WITH (NOLOCK)
         LEFT JOIN PR_LOOSEFRUITLN_ARC LFLN WITH (NOLOCK) ON LF.ID = LFLN.MasterID
         WHERE CHARINDEX('_', LF.DocDate) > 0
           AND LF.DocDate LIKE 'LF%_%'
         GROUP BY LF.ID, LF.DocID, LF.DocNo, LF.DocDate
         ORDER BY LF.ID DESC`
    );

    // Query emp codes per header (top 5 emp per header to avoid bloat)
    const rows = [];
    for (const h of headers) {
        const emps = await this.prodDb.query<any>(
            `SELECT TOP 5 DISTINCT EmpCode FROM PR_LOOSEFRUITLN_ARC WITH (NOLOCK)
             WHERE MasterID = ?`,
            [h.ID],
        );
        rows.push({
            doc_id: h.DocID,
            doc_no: h.DocNo,
            doc_date_raw: h.DocDateRaw,
            emp_codes: emps.map(e => String(e.EmpCode).trim()),
            line_count: h.LineCount,
            total_mt: h.TotalMT,
            total_amount: h.TotalAmount,
        });
    }

    // Summary
    const sum = await this.prodDb.queryOne<any>(
        `SELECT COUNT(DISTINCT LF.ID) as headers,
                COUNT(LFLN.ID) as lines,
                SUM(LFLN.Amount) as total_amount
         FROM PR_LOOSEFRUIT_ARC LF WITH (NOLOCK)
         LEFT JOIN PR_LOOSEFRUITLN_ARC LFLN WITH (NOLOCK) ON LF.ID = LFLN.MasterID
         WHERE CHARINDEX('_', LF.DocDate) > 0
           AND LF.DocDate LIKE 'LF%_%'`,
    );

    return {
        rows,
        summary: {
            total_anomaly_headers: sum?.headers ?? 0,
            total_anomaly_lines: sum?.lines ?? 0,
            total_amount_excluded: sum?.total_amount ?? 0,
        },
    };
}
```

**Catatan**: filter `month`/`year` SENGAJA TIDAK dipakai untuk anomaly karena `DocDate` tidak berisi tanggal valid — filter waktu harus pakai field lain (mis. join ke `PR_LOOSEFRUITLN_ARC.TrxDate` jika ada). Untuk v1 cukup tampilkan ALL anomaly (jumlah biasanya kecil — puluhan record).

**Route baru** di `backend/src/api/stagingRoutes.ts`:

```ts
.get("/compare/loosefruit-anomaly", async ({ query, set }) => {
    try {
        const month = parseInt(query.month as string || "5");
        const year = parseInt(query.year as string || "2026");
        const limit = parseInt(query.limit as string || "100");
        const result = await comparator.loosefruitAnomalies(month, year, limit);
        return { success: true, data: result };
    } catch (e: any) {
        logError("StagingAPI", "Loosefruit anomaly fetch failed", e);
        set.status = 500;
        return { success: false, error: e.message };
    }
}, {
    query: t.Object({
        month: t.Optional(t.String()),
        year: t.Optional(t.String()),
        limit: t.Optional(t.String()),
    }),
})
```

**Frontend service**:
```js
export const fetchLoosefruitAnomalies = (token, { month, year, limit = 100 }) =>
  get('/api/staging/compare/loosefruit-anomaly', { month, year, limit }, token);
```

### 5.3 Hardening (TIDAK BLOKER UI v1, masuk follow-up)

| TODO | Severity | File |
|---|---|---|
| Tambah middleware auth (JWT verify) ke `stagingRoutes` | P1 | `backend/src/api/stagingRoutes.ts` |
| Validasi regex `^\d{4}-\d{2}-\d{2}$` untuk param `date` di route | P2 | sda |
| Ganti string interpolation `'${date}'` di service dengan param `?` | P2 | `stagingComparisonService.ts` |

---

## 6. Test Plan

### 6.1 Test backend (Bun)
File baru: `backend/src/services/additional_service/explore_staging/stagingComparisonService.test.ts`

Cases:
1. `dailyLoosefruitSummary(5, 2026)` tidak throw (regression test bug §5.1).
2. `loosefruitAnomalies()` mengembalikan `success:true` dan `summary.total_anomaly_headers >= 0`.
3. Smoke test integrasi: panggil 4 endpoint compare row-level (attendance, overtime, loosefruit, **loosefruit-anomaly**) dan assert response shape.

Run: `cd backend && bun test src/services/additional_service/explore_staging/stagingComparisonService.test.ts`

### 6.2 Test frontend (Vitest)
File baru: `frontend/src/pages/StagingComparisonPage.test.jsx`

Cases:
1. Render initial state — page tampilkan summary skeleton.
2. Mock fetchAttendanceCompare → render row table dengan 5 baris.
3. Tab switch ke "Brondol" → service `fetchLoosefruitCompare` dipanggil dengan param yg benar.
4. Status filter `STAGING_ONLY` → hanya baris dengan `prod_found:false` yang tampil.
5. Export CSV — verify CSV string mengandung header & rows.

Run: `cd frontend && npx vitest run src/pages/StagingComparisonPage.test.jsx`

### 6.3 Manual smoke test (sesudah implement)
```powershell
# 1. Start backend
cd backend ; bun run dev
# 2. Start frontend
cd frontend ; npm run dev:test
# 3. Navigate ke http://localhost:5175/staging-comparison
# 4. Coba 3 tab × 2 mode = 6 kombinasi
# 5. Pastikan tab Brondol Daily Mode sudah TIDAK error (bug §5.1 sudah di-fix)
# 6. Pastikan Anomaly panel di tab Brondol menampilkan record LF########_##
```


---

## 7. Execution Checklist (urutan kerja)

### Phase A — Backend fix & extension (~30 menit)

- [ ] **A1** Fix bug `dailyLoosefruitSummary` (§5.1).
- [ ] **A2** Tambah method `loosefruitAnomalies` di `stagingComparisonService.ts` (§5.2).
- [ ] **A3** Tambah route `/compare/loosefruit-anomaly` di `stagingRoutes.ts` (§5.2).
- [ ] **A4** Tambah test backend (§6.1). Run: `cd backend && bun test src/services/additional_service/explore_staging/stagingComparisonService.test.ts`.
- [ ] **A5** Smoke test 4 endpoint via curl pada port 8002 — semua harus return `success:true`. Khususnya `daily-loosefruit` & `loosefruit-anomaly`.

### Phase B — Frontend service & routing (~20 menit)

- [ ] **B1** Buat `frontend/src/services/stagingComparisonService.js` dengan 7 fetcher (§4.3.1 + §5.2).
- [ ] **B2** Tambah lazy import & `<Route path="staging-comparison" element={<SummaryReportWrapper component={StagingComparisonPage} />} />` di `App.jsx`.
- [ ] **B3** Tambah item nav di `DashboardLayout.jsx` `navItems` section `Verification` (§4.1).

### Phase C — Frontend page (~2-3 jam)

- [ ] **C1** Buat `StagingComparisonPage.jsx` skeleton dengan state, fetch logic, dan layout `header → toolbar → cards → body`.
- [ ] **C2** Implement tab switcher (Kehadiran/Lembur/Brondol) + mode switcher (Daily/Row).
- [ ] **C3** Implement summary cards (5-6 cards berbasis `summary` object).
- [ ] **C4** Implement Daily table dengan kolom `date|staging|prod|delta|pct`.
- [ ] **C5** Implement Row table per modul (`AttendanceRowTable`, `OvertimeRowTable`, `LoosefruitRowTable`).
- [ ] **C6** Implement client-side search + status filter.
- [ ] **C7** Implement Export CSV button (mirror `DataVerificationPage.exportCSV`).
- [ ] **C8** Tambah panel anomaly Brondol — render hanya saat `module === 'loosefruit'`, fetch `fetchLoosefruitAnomalies`, tampilkan tabel dengan `doc_date_raw` highlighted.
- [ ] **C9** Tambah loading & error states.

### Phase D — Test & polish (~1 jam)

- [ ] **D1** Tulis test frontend (§6.2). Run: `cd frontend && npx vitest run src/pages/StagingComparisonPage.test.jsx`.
- [ ] **D2** Manual smoke test (§6.3) — ceklis 6 kombinasi tab × mode + anomaly panel.
- [ ] **D3** Bandingkan summary numerik dengan response curl manual untuk satu tanggal — pastikan UI tidak menyembunyikan data.
- [ ] **D4** Visual sanity check — gunakan tone & spacing konsisten dengan `DataVerificationPage`.

### Phase E — Optional follow-up (di-PR terpisah)

- [ ] **E1** Tambah auth middleware ke `stagingRoutes` (§5.3 P1).
- [ ] **E2** Validasi & sanitasi parameter `date` (§5.3 P2).
- [ ] **E3** Update `docs/STAGING_VS_DBPTRJ_MAPPING.md` — tambah section "Anomaly: ID Double LF########_##".
- [ ] **E4** Print-friendly stylesheet untuk halaman ini.

---

## 8. Acceptance Criteria

UI dianggap selesai jika SEMUA criteria di bawah terpenuhi:

1. ✅ Menu `Komparasi Staging vs DB` muncul di sidebar untuk role `payroll_admin` & `finance`.
2. ✅ Halaman `/staging-comparison` me-render tanpa error pada periode default (Mei 2026).
3. ✅ Tiga tab modul (Kehadiran/Lembur/Brondol) bisa di-switch dan masing-masing fetch endpoint yang sesuai.
4. ✅ Mode Daily Summary menampilkan tabel per-tanggal dengan kolom Staging vs Prod vs Delta. **Tab Brondol Daily Mode harus berhasil load tanpa error 500** (bukti bug §5.1 sudah di-fix).
5. ✅ Mode Row Detail menampilkan tabel detail dengan kolom modul-spesifik dan badge status.
6. ✅ Tab Brondol menampilkan panel **Anomaly ID Double** dengan minimal 1 contoh record `LF########_##` jika ada di DB.
7. ✅ Search + status filter bekerja client-side.
8. ✅ Tombol Export CSV menghasilkan file yang valid (header + data rows).
9. ✅ Test backend & frontend lulus.
10. ✅ `bun test` & `npx vitest run` di project lulus tanpa regresi.

---

## 9. File yang Dibuat / Diubah

### Created
| File | Deskripsi |
|---|---|
| `frontend/src/services/stagingComparisonService.js` | Wrapper axios untuk 7 endpoint |
| `frontend/src/pages/StagingComparisonPage.jsx` | Page utama |
| `frontend/src/pages/StagingComparisonPage.test.jsx` | Test komponen |
| `backend/src/services/additional_service/explore_staging/stagingComparisonService.test.ts` | Test service |
| `docs/PRD-staging-comparison-ui.md` | Dokumen ini |

### Modified
| File | Deskripsi perubahan |
|---|---|
| `backend/src/services/additional_service/explore_staging/stagingComparisonService.ts` | Fix `dailyLoosefruitSummary` ORDER BY + tambah `loosefruitAnomalies` |
| `backend/src/api/stagingRoutes.ts` | Tambah route `/compare/loosefruit-anomaly` |
| `frontend/src/App.jsx` | Tambah lazy import & `<Route>` |
| `frontend/src/layouts/DashboardLayout.jsx` | Tambah item di section `Verification` |

---

## 10. Referensi Cepat (untuk implementer)

### 10.1 Lokasi penting
- `backend/src/index.ts:25,285,310` → mounting stagingRoutes
- `backend/src/services/reportService.ts:186` → bukti pola ID double
- `backend/query/Tunjangan/get_brondol_amount.sql:8` → bukti pola ID double
- `frontend/src/pages/DataVerificationPage.jsx` → template page (paling mirip)
- `frontend/src/components/DbPtrjCompareReportModal.jsx` → template modal compare
- `frontend/src/utils/apiBase.js` → `buildBackendUrl`
- `frontend/src/context/AuthContext.jsx` → `useAuth()`
- `frontend/src/context/ReportContext.jsx` → `useReport()` (month/year/division)

### 10.2 Endpoint cheatsheet
```
GET /api/staging/compare/attendance?date=YYYY-MM-DD&limit=N
GET /api/staging/compare/overtime?date=YYYY-MM-DD&limit=N
GET /api/staging/compare/loosefruit?date=YYYY-MM-DD&limit=N
GET /api/staging/compare/daily-attendance?month=M&year=Y&top=N
GET /api/staging/compare/daily-overtime?month=M&year=Y&top=N
GET /api/staging/compare/daily-loosefruit?month=M&year=Y&top=N      [BUG → fix dulu]
GET /api/staging/compare/loosefruit-anomaly?month=M&year=Y&limit=N  [BARU]
```

### 10.3 Kombinasi yang harus diuji manual
| Modul | Mode | Endpoint | Expected |
|---|---|---|---|
| Attendance | Daily | daily-attendance | Top-N tanggal, staging~1500-1600/hari |
| Attendance | Row | attendance | 5+ baris match 100% di 2026-05-28 |
| Overtime | Daily | daily-overtime | Top-N tanggal, prod_taskreg_ot_rows > 0 |
| Overtime | Row | overtime | 4/5 match, 1 staging-only di 2026-05-28 |
| Brondol | Daily | daily-loosefruit | Top-N tanggal, staging_workers ~500-600 |
| Brondol | Row | loosefruit | 5/5 match 100% di 2026-05-28 |
| Brondol | Anomaly | loosefruit-anomaly | Beberapa record dengan doc_date_raw='LF...' |

### 10.4 Konvensi gaya yang harus diikuti
- TypeScript backend: 4-space indent, semicolon.
- React frontend: 2-space indent, semicolon, JSX style: inline objects (lihat `DataVerificationPage`).
- Naming: camelCase untuk function/var, PascalCase untuk komponen.
- Color tokens: gunakan palette yang sama dengan `DataVerificationPage` (`#047857` match, `#dc2626` missing, dll).

---

## 11. Open Questions (boleh diabaikan, default sudah aman)

1. Apakah perlu filter divisi/gang di UI komparasi? **Default**: tidak — komparasi global per tanggal.
2. Apakah perlu preview multi-tanggal (range) di Row mode? **Default**: tidak — single date saja di v1.
3. Apakah perlu diff inline untuk hours numeric (mis. ±0.5)? **Default**: ya, kolom Delta dengan warna.
4. Apakah anomaly panel perlu link ke detail per-line LFLN? **Default**: tidak di v1, cukup tampilan ringkas.

---

**End of PRD.** Implementer (Sonnet) cukup eksekusi checklist §7 secara berurutan. Setiap fase punya kriteria selesai yang jelas. Semua keputusan desain sudah dibakukan; jangan deviasi tanpa menambah catatan ke §11 dulu.


---

# BAGIAN 14: RINGKASAN ARsitektur (CLOSING)

## 14.1 Aliran Data End-to-End

```
1. USER INPUT
   └── Frontend (React) → Pilih periode, divisi, gang
        ↓
2. API REQUEST  
   └── Frontend → GET /payroll/report?month=X&year=Y&division=PG1A
        ↓
3. BACKEND PROCESSING
   └── Bun/Elysia → dataExtractorService.extractPayrollRows()
        ↓
4. DATABASE QUERY
   └── Backend → Python SQL Gateway → db_ptrj.PR_TASKREGLN_ARC
                               → db_ptrj.PR_ADTRANSLN_ARC
                               → db_ptrj.HR_EMPLOYEE
        ↓
5. CALCULATION
   └── PayrollCalculator.calculate() → HK, Tunjangan, Premi, PPH21
        ↓
6. RESPONSE
   └── Backend → JSON rows → Frontend
        ↓
7. RENDERING
   └── AG Grid Virtual Scrolling → Tabel daftar upah
        ↓
8. EDIT (jika ada)
   └── User edit cell → POST /payroll/locked/manual-edit
        ↓
9. SYNC TO PLANTWARE
   └── Browser Automation → input ke Millware
        ↓
10. AGGREGATION
    └── aggregation_seeder.py → extend_db_ptrj.dbo.daftar_upah_aggregation_history
```

## 14.2 Key Files Reference

| File | Size | Fungsi |
|------|------|--------|
| `backend/src/services/dataExtractorService.ts` | ~271 KB | Ekstraksi data payroll dari DB |
| `backend/src/services/manualAdjustmentService.ts` | ~130 KB | Manajemen manual adjustment |
| `backend/src/services/PayrollCalculator.ts` | - | Kalkulasi payroll canonical |
| `backend/src/api/payroll.ts` | ~158 KB | API routes payroll |
| `frontend/src/components/CustomPayrollTable.jsx` | ~254 KB | Tabel utama AG Grid |
| `frontend/src/pages/MainPage.jsx` | ~88 KB | Halaman utama daftar upah |
| `backend/src/services/payroll/payrollAutoBufferService.ts` | - | Auto buffer (tunjangan, PPH, SPSI) |

## 14.3 API Endpoints Summary (80+ Endpoints)

| Category | Count | Examples |
|----------|-------|----------|
| Auth | 3 | /auth/login, /auth/me, /auth/refresh |
| Payroll Report | 15 | /payroll/report, /payroll/locked/report, /payroll/report/batch |
| Summary | 20 | /payroll/summary/division, /payroll/summary/gangs, /payroll/summary/impact |
| Manual Adjustment | 10 | /payroll/locked/manual-edit, /payroll/manual-adjustment/sync-status |
| Employee | 5 | /payroll/employee, /payroll/employee/components |
| Tax | 3 | /payroll/tax/monthly-report, /payroll/tax/download |
| Staging | 8 | /api/staging/compare/attendance, /api/staging/compare/loosefruit |
| Dashboard | 5 | /dashboard/kpi, /dashboard/tonase |
| Locked Division | 7 | /payroll/locked/verify, /payroll/locked/report/raw-tree |
| Aggregation | 4 | /payroll/aggregation/seeder, /payroll/aggregation/validate |

## 14.4 Database Tables (Key Tables)

| Table | DB | Fungsi |
|-------|-----|--------|
| PR_TASKREGLN_ARC | db_ptrj | Registrasi jam kerja & overtime |
| PR_ADTRANSLN_ARC | db_ptrj | Detail transaksi tunjangan/potongan |
| PR_ADTRANS_ARC | db_ptrj | Header transaksi payroll |
| HR_EMPLOYEE | db_ptrj | Master data karyawan |
| HR_GANGLN | db_ptrj | Anggota gang |
| HR_HOLIDAY_ARC | db_ptrj | Kalender hari libur |
| PR_EMP_ATTN_ARC | db_ptrj | Data kehadiran |
| daftar_upah_aggregation_history | extend_db_ptrj | History agregasi per gang |
| payroll_manual_adjustments | extend_db_ptrj | Manual adjustments |
| Ffbscannerdata | staging_PTRJ_iFES | Data FFB scanner |
| Gwscannerdata | staging_PTRJ_iFES | Data GWS (attendance) |

## 14.5 Performance Optimizations

| Optimasi | Impact |
|----------|--------|
| Minify + gzip + brotli compression | Bundle -50% |
| Lazy load 21 pages | Initial load faster |
| Virtual row windowing (AG Grid) | 12k → 600 DOM nodes |
| Compact mode toggle | Font 10px untuk mobile |
| Batch API endpoint | 50 cells: ~10s → ~0.5s |
| Optimistic UI | Cell save feedback instant |
| Rate limiter | 60 req/10s per user |
| Specific cache invalidation | Tidak invalidate semua |

## 14.6 Division Codes

| Code | Type | Description |
|------|------|-------------|
| PG1A, PG1B, PG2A, PG2B | Real | Plasma divisions |
| AB1, AB2, ARA, ARC | Real | Air Ruak divisions |
| DME, IJL | Real | Other estates |
| INF | Virtual | Gang IN* (Infrastructure) |
| NRS | Virtual | Gang B2N (Nursery) |
| WKS_AR | Virtual | Gang HMC (Workshop Air Ruak) |
| WKS_PG | Virtual | Gang AMC (Workshop Parit Gunung) |
| WORKSHOP | Virtual | AMC + HMC combined |

## 14.7 Premium Types (7 Tipe)

| Type | Input Method |
|------|-------------|
| PREMI PRUNING | Manual + Excel seeder |
| PREMI RAKING | Manual + Excel seeder |
| PREMI KINERJA | Manual + Excel seeder |
| PREMI INSENTIF PANEN | Manual + Excel seeder |
| PREMI TBS | Auto (from WM_TICKET) |
| PREMI JAGA | Auto (from attendance) |
| PREMI BANTU BRONDOL | Staging comparison |

## 14.8 Additional Services

| Service | Technology | Port |
|---------|------------|------|
| Python SQL Gateway | FastAPI | 20125 |
| Web Aggregation App | FastAPI | 8003 |
| Context Portal | Alembic + SQLite | - |
| Pajak Kalkulator (GUI) | Tkinter | - |
| Pajak Kalkulator (Web) | HTML/JS | 8080 |
| Browser Automation | Puppeteer | - |

## 14.9 Development Commands

```bash
# Install dependencies
npm run setup:backend   # Backend dependencies
npm run setup:frontend # Frontend dependencies

# Run development
npm run dev             # Both backend + frontend
npm run backend:dev     # Backend only (port 8002)
npm run frontend:lan    # Frontend LAN accessible (port 5175)

# Production build
cd frontend && npm run build   # Build to frontend/dist/
cd backend && bun run start    # Start production server

# Run tests
cd backend && bun test
cd frontend && npx vitest run
```

## 14.10 Dokumen Pendukung

| Dokumen | Lokasi |
|---------|--------|
| Complete Architecture Doc | `docs/ARSITEKTUR_DAFTAR_UPAH_COMPLETE.md` |
| Backend Architecture | `docs/BACKEND_ARCHITECTURE.md` |
| Database & Queries | `docs/DATABASE_QUERIES_ARCHITECTURE.md` |
| Payroll Logic Map | `docs/PAYROLL_LOGIC_MAP.md` |
| Field to Table Mapping | `docs/FIELD_TO_TABLE_MAPPING.md` |
| Payroll Source Flow | `docs/PAYROLL_SOURCE_FLOW.md` |
| Staging vs DB_PTRJ Mapping | `docs/STAGING_VS_DBPTRJ_MAPPING.md` |
| Manual Adjustment API | `docs/MANUAL_ADJUSTMENT_API.md` |
| Proxy Runbook | `docs/proxy-payroll-runbook.md` |
| PRD Optimization | `docs/PRD-daftar-upah-optimization.md` |
| PRD Dashboard V3 | `docs/PRD-dashboard-daftar-upah-redesign-v3.md` |
| PRD Staging Comparison | `docs/PRD-staging-comparison-ui.md` |

---

*Document generated by Hermes AI Agent on 2026-06-09*
*Source: D:\Gawean Rebinmas\PORTAL_ESTATE\Plantware_Auto_Report\Daftar_Upah_baru\payroll_daftar_upah\refactor_production*
*5 parallel agents + 1 consolidation pass*
