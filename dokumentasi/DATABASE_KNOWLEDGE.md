# 📦 DATABASE KNOWLEDGE — Payroll Daftar Upah Portal

> **Versi Dokumen:** 1.0  
> **Tanggal:** 2026-03-24  
> **Scope:** Semua database yang digunakan dalam project `refactor_production`  
> **Engine:** Microsoft SQL Server (MSSQL) — ODBC Driver 17  

---

## 🗂️ Daftar Isi

1. [Arsitektur Koneksi Database](#-arsitektur-koneksi-database)
2. [Server 1 — 10.0.0.110 (Primary)](#-server-1--100110-primary)
   - [db_ptrj — Database Utama ERP](#1-db_ptrj--database-utama-erp-plantware)
   - [extend_db_ptrj — Database Riwayat Payroll](#2-extend_db_ptrj--database-riwayat-payroll-history)
   - [extend_db_ptrj_transaksi — Database Arsip Transaksi](#3-extend_db_ptrj_transaksi--database-arsip-transaksi)
   - [db_ptrj_mill — Database Pabrik PKS](#4-db_ptrj_mill--database-pabrik-pks)
3. [Server 2 — Staging (SERVER_PROFILE_2)](#-server-2--staging)
   - [staging_PTRJ_iFES_Plantware](#5-staging_ptrj_ifes_plantware--staging-fes-scanner)
4. [Server 3 — VenusHR (SERVER_PROFILE_3)](#-server-3--enushr-server_profile_3)
   - [VenusHR14](#6-venushr14--hr-mill-pks)
5. [Detail Modul Tabel db_ptrj](#-detail-modul-tabel-db_ptrj)
6. [Relasi Antar Tabel Kunci](#-relasi-antar-tabel-kunci)
7. [Interpretasi Penggunaan per Service](#-interpretasi-penggunaan-per-service)
8. [Data Flow Lintas Database](#-data-flow-lintas-database)

---

## 🔌 Arsitektur Koneksi Database

Project ini **TIDAK terhubung langsung** ke SQL Server. Semua query melewati lapisan **SQL Gateway API** (Python service, default port 8001). Backend Node.js/Bun mengirim query via HTTP POST ke gateway, yang kemudian mengeksekusi ke SQL Server.

```
Frontend (React) 
    ↓ HTTP
Backend TypeScript/Bun (:8002)
    ↓ HTTP POST /v1/query  (JSON: {sql, params, server, database})
SQL Gateway API (:8001)
    ↓ pyodbc / ODBC Driver 17
Microsoft SQL Server
    ├── Server 1: 10.0.0.110:1433  (SERVER_PROFILE_1)
    ├── Server 2: 10.0.0.2:1888    (SERVER_PROFILE_2)  — Staging iFES
    └── Server 3: (VenusHR host)   (SERVER_PROFILE_3)  — VenusHR / Mill
```

**Konfigurasi Instance Database (`src/db/client.ts`):**

| Method | Database | Profile | Kegunaan |
|---|---|---|---|
| `Database.getInstance()` | `db_ptrj` | `SERVER_PROFILE_1` | Default — queries ERP utama |
| `Database.getExtendedInstance()` | `extend_db_ptrj` | `SERVER_PROFILE_1` | Snapshot riwayat payroll |
| `Database.getMillInstance()` | `db_ptrj_mill` | `SERVER_PROFILE_3` | Data berat TBS/FFB mill |
| `Database.getVenusInstance()` | `VenusHR14` | `SERVER_PROFILE_3` | HR data PKS (Mill) |
| `historyDatabaseService.getTransactionDatabase()` | `extend_db_ptrj_transaksi` | `SERVER_PROFILE_1` | Arsip transaksi taskreg/adtrans |

---

## 🖥️ Server 1 — 10.0.0.110 (Primary)

**Host:** `10.0.0.110`  **Port:** `1433`  **Auth:** `sa / ptrj@123`

Server utama tempat semua database inti berada.

---

### 1. `db_ptrj` — Database Utama ERP Plantware

**Deskripsi:** Database utama sistem ERP Plantware milik PT Rebinmas Jaya. Berisi **1.038 tabel** yang mencakup seluruh operasional perkebunan kelapa sawit, dari HR hingga keuangan, produksi, inventori, pembelian, dan sebagainya.

**Jumlah Tabel:** 1.038 tabel  
**Modul Prefix:** Dikelompokkan berdasarkan prefix nama tabel

#### Pembagian Modul berdasarkan Prefix Tabel

| Prefix | Nama Modul | Deskripsi Singkat | Contoh Tabel |
|--------|-----------|-------------------|--------------|
| `HR_` | **Human Resources** | Masterdata karyawan, gaji, gang, absensi, pajak | `HR_EMPLOYEE`, `HR_PAYROLL`, `HR_GANG`, `HR_GANGLN` |
| `PR_` | **Payroll / Task Register** | Transaksi upah, kehadiran, allowance, harvest | `PR_TASKREGLN`, `PR_ADTRANSLN`, `PR_EMPWAGES`, `PR_GANG` |
| `GL_` | **General Ledger** | Jurnal akuntansi, chart of accounts, dimensi | `GL_JOURNAL`, `GL_ACCOUNT`, `GL_JRNLN` |
| `AP_` | **Accounts Payable** | Hutang, pembayaran, invoice masuk | `AP_PAYMENT`, `AP_INVOICERCV`, `AP_CASHBOOK` |
| `BI_` | **Billing / AR** | Piutang, invoice keluar, penerimaan | `BI_INVOICE`, `BI_RECEIPT` |
| `PU_` | **Purchasing** | Purchase order, GRN, quotation | `PU_PO`, `PU_GOODSRCV`, `PU_SUPPLIER` |
| `IN_` | **Inventory** | Stok barang, penerimaan, pengeluaran | `IN_STOCKRECEIVE`, `IN_STOCKISSUE`, `IN_ITEM` |
| `FA_` | **Fixed Assets** | Aset tetap, depresiasi, disposal | `FA_ASSETREG`, `FA_ASSETDEPR` |
| `BD_` | **Budget** | Anggaran tahunan, forecast, distribusi biaya | `BD_PARAMETER`, `BD_PERIODS`, `BD_BLOCK` |
| `PM_` | **Palm Mill** | Produksi pabrik CPO, kualitas minyak, kernel | `PM_CPO`, `PM_DAILYPROD`, `PM_OILQUALITY` |
| `WM_` | **Weighbridge / Mill** | Timbangan TBS, tiket timbang | `WM_TICKET`, `WM_FFBASSESS`, `WM_TRANSPORTER` |
| `WS_` | **Workshop** | Pekerjaan bengkel, jam mesin, servis | `WS_JOB`, `WS_MECHHOUR`, `WS_SERVTYPE` |
| `CT_` | **Canteen** | Kantin, penerimaan stok kantin | `CT_CANTEENRCV`, `CT_STOCKISSUE` |
| `NU_` | **Nursery** | Pembibitan, batch bibit, transplanting | `NU_NURSERYBATCH`, `NU_SEEDPLANT` |
| `AG_` | **Agriculture/Rainfall** | Curah hujan, stasiun pengukur | `AG_RAINFALLREADING`, `AG_RAINFALLSTATION` |
| `SH_` | **Shared / System** | Pengaturan, user, departemen, role | `SH_USER`, `SH_ROLE`, `SH_DEPT`, `SH_SETTING` |
| `AD_` | **Admin/Config** | UI config, bahasa, shortcut, modul | `AD_SYSCFG`, `AD_DTCFG`, `AD_MODULE` |
| `ST_` | **Settler (Plasma)** | Piutang/hutang plasma settler | `ST_SETTLER`, `ST_INVOICE`, `ST_PAYMENT` |
| `CM_` | **Contract Management** | Kontrak jual beli CPO/PK | `CM_CONTRACT`, `CM_CURRENCY`, `CM_MPOB` |
| `PD_` | **Production Detail** | Estimasi produksi, POM, statistik | `PD_POMPROD`, `PD_ESTYIELD` |
| `BR_` | **Bank Reconciliation** | Rekonsiliasi bank, statement | `BR_BANKSTMT`, `BR_MATCH` |
| `EI_` | **E-Invoice** | E-Faktur Malaysia, voucher | `EI_INVOICE`, `EI_COM_MSIC` |
| `GST_` | **GST/Tax** | Pajak GST Malaysia | `GST_TAXCODE`, `GST_TAXGRP` |
| `ID_` | **Incident / Monitoring** | Insiden lapangan, jadwal kerja, nursery | `ID_INCIDENT_MANAGEMENT`, `ID_WORK_SCHEDULING` |
| `IF_` | **Interface / Mobile** | Barcode, attachment file, perangkat mobile | `IF_MOBILE_DEVICE`, `IF_Tran_File_Attach` |
| `RC_` | **Remittance/Recurrent** | Jurnal berkala, tagihan berulang | `RC_JOURNAL`, `RC_DISPADV` |
| `RPT_` | **Report** | Konfigurasi laporan, drilldown | `RPT_DrillDown`, `RPT_Fields` |
| `TB_` | **Transaction Base/Audit** | Audit trail, pesan sistem, ID transaksi | `TB_Audit`, `TB_Id`, `TB_Msg` |
| `Console_` | **Console/Summary** | Ringkasan kinerja konsolidasi | `Console_CostHA`, `Console_Production` |
| `temp_` | **Temporary Tables** | Tabel sementara kalkulasi sistem | `temp_employee`, `temp_payroll_bankno` |

---

### 2. `extend_db_ptrj` — Database Riwayat Payroll (History)

**Deskripsi:** Database khusus untuk menyimpan **snapshot/arsip periode payroll** yang sudah diproses. Berisi tabel-tabel custom (bukan dari Plantware) yang dibuat khusus untuk proyek ini guna mendokumentasikan payroll historis per periode per gang.

**Server:** Sama dengan db_ptrj (10.0.0.110:1433)  
**Profile:** `SERVER_PROFILE_1`

#### Tabel Custom di `extend_db_ptrj`

| Nama Tabel | Kunci Utama | Deskripsi |
|-----------|------------|-----------|
| `dbo.payroll_history_header` | `id` (auto), `period_month + period_year + division_code + gang_code` | Header/ringkasan payroll per gang per periode. Menyimpan total HK, upah kotor, upah bersih, premi, potongan, FFB weight, dll. |
| `dbo.payroll_history_detail` | `id` (auto), `master_id + emp_code` | Detail per karyawan dari satu record header. Berisi semua komponen upah individu. |
| `dbo.history_taskreg` | `id` | Arsip baris `PR_TASKREGLN` per karyawan per periode (kehadiran, lembur). |
| `dbo.history_adtrans` | `id` | Arsip baris `PR_ADTRANSLN` per karyawan per periode (premi, potongan, tunjangan). |
| `dbo.history_gang_member` | `id` | Arsip keanggotaan gang karyawan pada satu periode. |
| `dbo.history_hr_employee` | `id` | Arsip masterdata `HR_EMPLOYEE` per periode (data statis karyawan saat itu). |
| `dbo.history_hr_gang` | `id` | Arsip masterdata `HR_GANG` per periode (info gang, mandor, asisten). |
| `dbo.history_metadata` | `id` | Log audit operasi (CREATE/UPDATE/LOCK/ARCHIVE) terhadap snapshots. |

**Kondisi Aktif:** Digunakan ketika `RUN_MODE=prod` di backend (mode produksi). Dalam mode dev, sistem membaca langsung dari `db_ptrj`.

**Cara Routing:**
```typescript
// Di historyDatabaseService.ts
getPayrollDatabase():
  RUN_MODE=prod → extend_db_ptrj
  RUN_MODE=dev  → db_ptrj (default)
```

---

### 3. `extend_db_ptrj_transaksi` — Database Arsip Transaksi

**Deskripsi:** Database terpisah untuk menyimpan detail transaksi historis bertipe Taskreg dan ADTrans. Memungkinkan drilldown ke transaksi individual dari periode lampau tanpa membebani `extend_db_ptrj`.

**Server:** 10.0.0.110:1433  **Profile:** `SERVER_PROFILE_1`

**Tabel yang dipahami ada di sini:**
- Salinan detail `PR_TASKREGLN` (history)
- Salinan detail `PR_ADTRANSLN` (history)

**Cara Routing:**
```typescript
getTransactionDatabase():
  RUN_MODE=prod → extend_db_ptrj_transaksi
  RUN_MODE=dev  → db_ptrj (default)
```

---

### 4. `db_ptrj_mill` — Database Pabrik PKS

**Deskripsi:** Database yang berisi data dari sistem pabrik (Pabrik Kelapa Sawit / PKS). Digunakan oleh proyek ini khusus untuk membaca data **berat TBS (tandan buah segar / FFB)** per divisi per bulan, yang dibutuhkan untuk laporan produktivitas.

**Server:** 10.0.0.110:1433 (atau SERVER_PROFILE_3)  
**Profile:** `SERVER_PROFILE_3`

**Tabel yang diquery oleh project ini:**

| Tabel | Kegunaan dalam Project |
|--------|----------------------|
| `WM_TICKET` | Tiket timbang — data berat TBS per truk/pengiriman ke pabrik. Digunakan untuk menghitung `total_ffb_weight` per divisi per bulan. |

**Contoh penggunaan (summaryService.ts):**

```sql
-- Aggregate FFB weight dari db_ptrj_mill per periode & divisi
SELECT SUM(WeightKg) / 1000 AS ffb_ton_total
FROM WM_TICKET
WHERE TrxDate BETWEEN @startDate AND @endDate
  AND LocCode = @locCode
```

**Relasi ke db_ptrj:**  
Join melalui `LocCode` / `DivisionCode` — merujuk ke kode divisi yang sama dengan `HR_GANG.LocCode` di `db_ptrj`.

---

## 🖥️ Server 2 — Staging

**Profile:** `SERVER_PROFILE_2`  **Host:** `10.0.0.2:1888`

---

### 5. `staging_PTRJ_iFES_Plantware` — Staging iFES Scanner

**Deskripsi:** Database staging dari sistem **iFES (integrated Field Entry System)** — sistem pemindai lapangan berbasis mobile. Berisi data absensi dan kehadiran yang dikirim dari perangkat mobile lapangan.

**Profile:** `SERVER_PROFILE_2`

**Kegunaan dalam Project:**  
Dijadikan source data untuk **thumbprint/fingerprint attendance** (`thumbprintService.ts`). Data kehadiran dari scanner lapangan ini dapat disinkronisasi ke `db_ptrj`.

**Nota:** Database ini bersifat transit/staging — data dipindahkan ke `db_ptrj` (ke `PR_TASKREGLN`, `PR_EMP_ATTN`, dll.) setelah divalidasi.

---

## 🖥️ Server 3 — VenusHR (SERVER_PROFILE_3)

---

### 6. `VenusHR14` — HR Mill PKS

**Deskripsi:** Database Venus HR khusus untuk karyawan pabrik (PKS / Pabrik Kelapa Sawit). Sistem HR terpisah dari Plantware (db_ptrj), digunakan oleh pabrik.

**Profile:** `SERVER_PROFILE_3`

**Kegunaan dalam Project:**  
Membaca data karyawan pabrik (operator PKS) untuk keperluan pelengkap laporan produksi mill. Diakses via `Database.getVenusInstance()`.

---

## 🔍 Detail Modul Tabel db_ptrj

### Modul HR (Human Resources) — Paling Sering Diakses

```
HR_EMPLOYEE       — Master karyawan (EmpCode, Name, IC_No/NIK, Gender, JoinDate, Status, LocCode, Religion, Race)
HR_EMPTYPE        — Jenis karyawan (tetap, kontrak, dll.)
HR_PAYROLL        — Informasi gaji karyawan (EmpCode, PayRate/upah_dasar, beras_rate, BankNo, BankCode)
HR_GANG           — Master gang/regu (GangCode, Description, LocCode/divisi, MandorCode)
HR_GANGLN         — Anggota gang (GangCode, GangMember/EmpCode — relasi many-to-many)
HR_DEPT           — Departemen
HR_DEPTCODE       — Kode departemen
HR_LEVEL          — Level/grade jabatan
HR_POSITION       — Jabatan/posisi
HR_LOCATION       — Master lokasi lahan
HR_FUNCTION       — Fungsi/jabatan fungsional
HR_HISTORY        — Riwayat perubahan data karyawan
HR_LEAVE          — Master jenis cuti
HR_LEAVESCHEME    — Skema cuti per jenis karyawan
HR_LEAVETRX       — Transaksi cuti (aktif)
HR_LEAVETRX_ARC   — Arsip transaksi cuti
HR_EMPLOYMENT     — Detail kontrak kerja
HR_EMPFAM         — Data keluarga karyawan
HR_EMPCODE        — Kode alternatif karyawan
HR_SALGRADE       — Grade gaji
HR_SALSCHEME      — Skema gaji
HR_BENEFIT_IN_KIND — Tunjangan natura
HR_BPJS           — Data BPJS karyawan
HR_JHT, HR_JKK, HR_JK, HR_JP — Komponen BPJS Ketenagakerjaan
HR_EIS, HR_EISLN  — Employee Insurance/Iuran
HR_SOCSO, HR_SOCSOLN — SOCSO (Malaysia)
HR_EPF            — EPF (Malaysia)
HR_HRDF           — HRDF (Malaysia)
HR_TAX            — Data pajak karyawan
HR_TAXBRANCH      — Kantor pajak
HR_EATAX          — Pajak penghasilan tambahan
HR_MTD, HR_MTDT   — Monthly Tax Deduction
HR_STATUTORY      — Data statutory karyawan
```

### Modul PR (Payroll & Task Register) — Inti Kalkulasi Daftar Upah

```
PR_TASKREGLN      — TABEL PALING PENTING: Baris transaksi kehadiran/kerja harian
                    (EmpCode, TrxDate, TaskCode, Hours, OT/lembur flag, Amount, GangCode)
PR_TASKREGLN_ARC  — Arsip PR_TASKREGLN (periode lama, sudah closed)
PR_TASKREG        — Header task register
PR_TASKREG_ARC    — Arsip header
PR_TASKCODE       — Master kode tugas/pekerjaan (TaskCode, Description, UOM)
PR_TASKGRP        — Grup task code
PR_ADTRANSLN      — Baris allowance/deduction (premi, potongan per DocDesc)
PR_ADTRANSLN_ARC  — Arsip allowance/deduction
PR_ADTRANS        — Header dokumen allowance
PR_ADTRANS_ARC    — Arsip header
PR_EMPWAGES       — Upah per karyawan per bulan (summary wages)
PR_EMPWAGES_ARC   — Arsip upah
PR_GANG           — Gang payroll (sinkron dengan HR_GANG)
PR_GANGLN         — Anggota gang payroll
PR_GANGLN_ARC     — Arsip anggota gang
PR_ATTDTRX        — Transaksi absensi
PR_ATTDTRXLN      — Baris absensi
PR_ATTDMONTH      — Ringkasan absensi bulanan
PR_EMP_ATTN       — Data kehadiran fingerprint/scanner
PR_EMP_ATTN_ARC   — Arsip kehadiran
PR_EMP_ATTN_DEVICE — Perangkat fingerprint
PR_LOOSEFRUIT     — Data brondol sawit per karyawan
PR_LOOSEFRUIT_ARC — Arsip brondol
PR_HARVESTER      — Data panen per karyawan (Harvesting)
PR_HARVESTERLN    — Baris detail panen
PR_HARVESTERLN_ARC — Arsip panen
PR_DRIVER         — Data pengemudi/transport TBS
PR_DRIVERLN       — Baris driver
PR_LOADER         — Data pemuat TBS (loading)
PR_LOADERLN       — Baris loader
PR_MTHENDPAYMENTLN — Baris pembayaran bulanan
PR_MTHENDPAYMENTLN_ARC — Arsip pembayaran
PR_PAYSLIP        — Slip gaji
PR_CHECKROLLMASTER — Master checkroll/rekap upah
PR_WAGES          — Komponen upah
PR_PIECERATE      — Upah borong/piece rate
PR_PIECERATELN    — Baris upah borong
PR_MTHENDTRX      — Transaksi month-end payroll
PR_PAYDIVISION    — Divisi pembayaran
PR_PAYSETUP       — Konfigurasi pembayaran
PR_CONTRACTOR     — Kontraktor
PR_CONTRACTORGANG — Gang kontraktor
PR_DIFFERENTIAL   — Differential/incentive
PR_RICE           — Tunjangan beras
PR_RAMPBIN        — Ramp/pengumpulan TBS
PR_RAMPTRX        — Transaksi ramp
PR_FFBDRIVER      — Driver FFB pabrik
PR_ADGROUP        — Group allowance/deduction
PR_AD             — Master allowance/deduction
```

### Modul GL (General Ledger) — Akuntansi

```
GL_JOURNAL        — Header jurnal akuntansi
GL_JRNLN          — Baris jurnal akuntansi  
GL_ACCOUNT        — Chart of accounts
GL_ACCDIM         — Dimensi akun
GL_ACCGRP         — Grup akun
GL_DIMENSION      — Master dimensi analis
GL_EXPENSE        — Data pengeluaran
GL_VEHFUELUSAGE   — Penggunaan solar kendaraan
GL_VEHICLE        — Master kendaraan
GL_BLOCK          — Master blok perkebunan
GL_SUBBLK         — Sub-blok
GL_CURRENCY       — Mata uang
GL_FISCAL_YEAR    — Tahun fiskal
```

### Modul SH (Shared/System) — Konfigurasi & User

```
SH_USER           — Master user aplikasi (login, role, password)
SH_ROLE           — Master role/hak akses
SH_ROLEACCESS     — Hak akses per role per modul
SH_USERACCESS     — Hak akses per user
SH_USERLOC        — Akses lokasi per user
SH_USERDEPT       — Akses departemen per user
SH_USERLOG        — Log aktivitas user
SH_DEPT / SH_DEPTCODE — Departemen
SH_LOCATION       — Lokasi
SH_COMP           — Perusahaan
SH_SETTING        — Pengaturan sistem
SH_PERIOD         — Periode akuntansi aktif
SH_MTHEND         — Status month-end
SH_DB_LIST        — Daftar database yang terdaftar di ERP
SH_MODULE         — Modul-modul ERP
SH_VERSION        — Versi sistem
SH_SYSTEM_LOG     — Log sistem
```

---

## 🔗 Relasi Antar Tabel Kunci

### 1. Relasi Karyawan ↔ Gang ↔ Divisi

```
HR_EMPLOYEE.EmpCode  ──── HR_GANGLN.GangMember  (many-to-one: 1 karyawan bisa 1 gang)
                                │
HR_GANGLN.GangCode   ──── HR_GANG.GangCode      (FK: setiap anggota gang→gang)
                                │
HR_GANG.LocCode      ──── SH_LOCATION.LocCode   (FK: gang → lokasi/divisi)
                         (LocCode = kode divisi, e.g., "P1A" = PG1A, "AB1" = ARB1)
```

**Mapping LocCode ↔ DivisionCode (dari gangService.ts):**

| LocCode (di DB) | DivisionCode (di sistem) |
|-----------------|--------------------------|
| P1A | PG1A |
| P1B | PG1B |
| P2A | PG2A |
| P2B | PG2B |
| AB1 | ARB1 |
| AB2 | ARB2 |
| DME | DME |
| ARA | ARA |
| ARC | ARC |
| IJL | IJL |
| INF | INFRA |
| NRS | NURSERY |
| WKS_PG | WORKSHOP_PG |
| WKS_AR | WORKSHOP_AR |

---

### 2. Relasi Transaksi Kehadiran (PR_TASKREGLN)

```
PR_TASKREGLN
├── EmpCode       → HR_EMPLOYEE.EmpCode
├── GangCode      → HR_GANG.GangCode (gang on payroll)
├── TaskCode      → PR_TASKCODE.TaskCode  (jenis pekerjaan)
├── TrxDate       → tanggal kerja (difilter per bulan)
├── Hours         → jam kerja (digunakan hitung HK)
├── OT            → flag lembur (0=normal, 1=overtime)
└── Amount        → nilai upah baris tsb
```

**Tabel arsip:** `PR_TASKREGLN_ARC` — struktur sama, digunakan untuk periode yang sudah ditutup (month-end closed).

---

### 3. Relasi Allowance/Deduction (PR_ADTRANSLN)

```
PR_ADTRANSLN
├── EmpCode       → HR_EMPLOYEE.EmpCode
├── GangCode      → HR_GANG.GangCode
├── DocDesc       → deskripsi dokumen (field utama untuk kategorisasi)
                   (contoh: "PREMI PANEN", "PREMI BRONDOL", "KOREKSI", "PPH21", "SPSI", "BERAS")
├── TaskCode      → PR_TASKCODE.TaskCode (opsional)
├── TaskDesc      → deskripsi tugas di baris
├── Amount        → nilai premi/potongan
└── DocDate       → tanggal dokumen
```

**Cara kategorisasi DocDesc** (dari `DOCDESC_MAPPING_GUIDE.md`):
- `DocDesc LIKE '%PREMI%'` → Premi (tambahan upah)  
- `DocDesc LIKE '%KOREKSI%'` → Koreksi (pengurang upah kotor)  
- `DocDesc LIKE '%PPH21%'` → Potongan PPh21  
- `DocDesc LIKE '%SPSI%'` → Potongan iuran SPSI  
- `DocDesc LIKE '%BERAS%'` → Tunjangan beras extra  
- `DocDesc LIKE '%BRONDOL%'` → Premi brondol (dari ADTrans)  
- `TaskDesc = 'ACCRUALS-CHECKROLL'` → Premi PPH (penambah upah bersih)

---

### 4. Relasi HR_PAYROLL (Gaji Pokok)

```
HR_PAYROLL
├── EmpCode       → HR_EMPLOYEE.EmpCode
├── PayRate       → Upah Dasar/Harian (tarif per HK)
├── beras_rate    → Tunjangan beras per hari (juga dipakai mapping PTKP)
├── BankNo        → Nomor rekening bank gaji
└── BankCode      → Kode bank
```

**Catatan:** `beras_rate` berfungsi ganda — sebagai nilai tunjangan beras AND sebagai proxy status PTKP (Penghasilan Tidak Kena Pajak):

| beras_rate / hari | Status PTKP |
|---|---|
| 2250 | TK/0 |
| 3250 / 3150 | TK/1 |
| 4200 / 4050 | TK/2 |
| 3700 / 3600 / 3750 | K/0 |
| 4650 / 4500 | K/1 |
| 5500 / 5400 / 5550 | K/2 |
| 6450 / 6300 | K/3 |

---

### 5. Relasi Data Mill (db_ptrj_mill ↔ db_ptrj)

```
db_ptrj_mill.WM_TICKET
├── LocCode / DivisionCode   ←→ db_ptrj.HR_GANG.LocCode
├── TrxDate                  → filter per periode
└── WeightKg                 → dikonversi ke ton untuk laporan FFB

db_ptrj.PR_HARVESTERLN       ← data panen per karyawan (dari scanner lapangan)
db_ptrj.PR_FFBDRIVERLN       ← data driver FFB ke pabrik
```

---

### 6. Relasi History DB (extend_db_ptrj ↔ db_ptrj)

```
extend_db_ptrj.payroll_history_header
├── period_month + period_year + division_code + gang_code  (unique key)
└── total_ffb_weight    ← dari db_ptrj_mill.WM_TICKET pada saat snapshot

extend_db_ptrj.payroll_history_detail
├── master_id           → payroll_history_header.id
├── emp_code            → (referensi HR_EMPLOYEE.EmpCode saat itu)
└── [semua kolom payroll per karyawan — self-contained/frozen snapshot]
```

---

## 📋 Interpretasi Penggunaan per Service

### `dataExtractorService.ts — INTI KALKULASI`
Menggunakan `db_ptrj` (default).  
Query utama:
- `HR_EMPLOYEE` + `HR_GANGLN` + `HR_GANG` → daftar karyawan per gang
- `PR_TASKREGLN` (atau ARC) → data kehadiran & HK per karyawan
- `PR_ADTRANSLN` (atau ARC) → premi & potongan
- `PR_LOOSEFRUIT` → brondol sawit
- `HR_PAYROLL` → PayRate (upah dasar) & beras_rate
- `PR_EMPWAGES` / `PR_EMPWAGES_ARC` → upah aktual bulanan
- `PR_HARVESTERLN` → data panen (bunches)

### `gangService.ts — MASTER GANG`
Menggunakan `db_ptrj`.  
Query: `HR_GANG`, `HR_GANGLN`  
Fungsi: mapping kode divisi ↔ LocCode, resolving gang per divisi, dll.

### `payrollService.ts & komponen Payroll`
Menggunakan `db_ptrj`.  
Query: `HR_PAYROLL` (PayRate, beras_rate)  
Fungsi: kalkulasi gaji pokok, tunjangan, lembur, BPJS, PPh21.

### `historyDatabaseService.ts — HISTORY SNAPSHOT`
- **DEV mode:** membaca `db_ptrj`
- **PROD mode:** membaca `extend_db_ptrj` (payroll) dan `extend_db_ptrj_transaksi` (detail transaksi)  
Tabel: `payroll_history_header`, `payroll_history_detail`, dll.

### `summaryService.ts — RINGKASAN DIVISI`
Menggunakan `extend_db_ptrj` (PROD) atau `db_ptrj` (DEV) + `db_ptrj_mill`.  
Membaca FFB weight dari mill untuk laporan produktivitas.

### `millProductionService.ts — PRODUKTIVITAS MILL`
Menggunakan data dari `summaryService.ts` yang sudah meng-gabungkan:  
- Payroll (HK, upah, premi, lembur) dari `extend_db_ptrj`  
- FFB tonase dari `db_ptrj_mill.WM_TICKET`

### `thumbprintService.ts — ABSENSI FINGERPRINT`
Membaca dari `staging_PTRJ_iFES_Plantware` (SERVER_PROFILE_2).

### `authService.ts — AUTENTIKASI USER`
Membaca dari `db_ptrj` → tabel `SH_USER`, `SH_ROLE`, `SH_ROLEACCESS`.

### `employeeHrDataService.ts / employeeDetailService.ts`
Membaca dari `db_ptrj`:  
`HR_EMPLOYEE`, `HR_PAYROLL`, `HR_EMPFAM`, `HR_EMPLOYMENT`, `HR_HISTORY`.

---

## 🔄 Data Flow Lintas Database

```
┌─────────────────────────────────────────────────────────┐
│                   db_ptrj (SERVER 1)                    │
│                                                          │
│  HR_EMPLOYEE ──→ HR_GANGLN ──→ HR_GANG                  │
│       │                          │                       │
│       ↓                          ↓                       │
│  HR_PAYROLL              PR_TASKREGLN (kehadiran)        │
│  (PayRate,beras)         PR_ADTRANSLN (premi/potongan)   │
│                          PR_LOOSEFRUIT (brondol)          │
│                          PR_EMPWAGES (wages summary)      │
└──────────────────────────────────────────────────────────┘
              ↓ (snapshot saat month-end)
┌─────────────────────────────────────────────────────────┐
│             extend_db_ptrj (SERVER 1)                    │
│  payroll_history_header  ←── summary per gang/periode    │
│  payroll_history_detail  ←── detail per karyawan         │
│  history_taskreg         ←── arsip PR_TASKREGLN          │
│  history_adtrans         ←── arsip PR_ADTRANSLN          │
└──────────────────────────────────────────────────────────┘
              ↑ (join via LocCode)
┌─────────────────────────────────────────────────────────┐
│           db_ptrj_mill (SERVER 3)                        │
│  WM_TICKET               ← berat TBS per truk           │
│  → total_ffb_weight      ← agregat per bulan/divisi     │
└──────────────────────────────────────────────────────────┘
              ↑ (data kehadiran dari lapangan)
┌─────────────────────────────────────────────────────────┐
│     staging_PTRJ_iFES_Plantware (SERVER 2)               │
│  [Fingerprint/Scanner attendance]                         │
│  → disinkronisasi ke PR_EMP_ATTN / PR_TASKREGLN          │
└──────────────────────────────────────────────────────────┘
              ↑ (HR data Mill)
┌─────────────────────────────────────────────────────────┐
│           VenusHR14 (SERVER 3)                           │
│  [Data karyawan Mill/PKS]                                 │
└──────────────────────────────────────────────────────────┘
```

---

## ⚙️ Konfigurasi Koneksi (.env)

```env
# Server 1 — Primary (db_ptrj, extend_db_ptrj)
DATABASE_SERVER="10.0.0.110"
DATABASE_PORT=1433
DATABASE_USERNAME="sa"
DATABASE_PASSWORD="ptrj@123"
DATABASE_NAME="db_ptrj"

# Database Extended (history payroll)
DATABASE_PROFILES_EXTEND_DB_PTRJ_SERVER="10.0.0.110"
DATABASE_PROFILES_EXTEND_DB_PTRJ_DATABASE_NAME="extend_db_ptrj"

# Database Mill
DATABASE_PROFILES_DB_PTRJ_MILL_SERVER="10.0.0.110"
DATABASE_PROFILES_DB_PTRJ_MILL_DATABASE_NAME="db_ptrj_mill"

# Server 2 — Staging iFES
DATABASE_PROFILES_REMOTE_2_SERVER="10.0.0.2"
DATABASE_PROFILES_REMOTE_2_PORT=1888

# Server 3 — Venus/Mill (dari config.ts)
# DB_VENUS_DATABASE=VenusHR14
# DB_MILL_DATABASE=db_ptrj_mill
```

---

## 📌 Catatan Penting

> [!IMPORTANT]
> **Tabel `PR_TASKREGLN` vs `PR_TASKREGLN_ARC`:**  
> Saat bulan sedang berjalan (open), data ada di `PR_TASKREGLN`.  
> Setelah month-end close, data dipindahkan ke `PR_TASKREGLN_ARC`.  
> Semua service harus query kedua tabel secara UNION untuk data lengkap.

> [!NOTE]
> **`PR_ADTRANSLN.DocDesc`** adalah field kunci untuk kategorisasi jenis premi/potongan. Tidak ada foreign key hard — kategorisasi dilakukan via LIKE pattern matching. Lihat `dokumentasi/DOCDESC_MAPPING_GUIDE.md` untuk detail lengkap.

> [!TIP]
> **Gang Code vs LocCode vs DivisionCode:**  
> Tiga istilah berbeda namun saling terhubung. `GangCode` = regu kerja (e.g. "A1H").  
> `LocCode` = kode divisi di database (e.g. "P1A").  
> `DivisionCode` = kode divisi di sistem portal (e.g. "PG1A").  
> Lihat mapping di `gangService.ts` untuk resolusi lengkap.

> [!WARNING]
> **Tahun Berjalan (Current Year) dari DB:**  
> Tidak menggunakan clock server. Sistem menggunakan `MAX(TRX_DATE) FROM PR_TASKREGLN` untuk menentukan tahun berjalan. Ini penting untuk memilih `UPAH_DASAR` yang tepat.
