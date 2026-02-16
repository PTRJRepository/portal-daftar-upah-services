# Product Requirements Document (PRD)
## Payroll Daftar Upah Reporting System - PT Rebinmas

---

## 1. Informasi Dokumen

| Item | Detail |
|------|--------|
| Nama Produk | Payroll Daftar Upah Reporting System |
| Versi Dokumen | 1.0.0 |
| Tanggal | Februari 2026 |
| Status | Production Ready |
| Author | PT Rebinmas IT Team |

---

## 2. Executive Summary

### 2.1 Latar Belakang

PT Rebinmas merupakan perusahaan perkebunan kelapa sawit yang mempekerjakan ratusan karyawan di berbagai divisi dan gang (kelompok kerja). Pengelolaan penggajian (payroll) memerlukan sistem yang dapat:

1. Menghitung gaji karyawan berdasarkan hari kerja (HK)
2. Menghitung lembur dengan berbagai tarif (tier-based rate)
3. Menghitung premi berdasarkan jenis pekerjaan
4. Menghitung potongan (BPJS, PPH21, SPSI, dll)
5. Menampilkan laporan yang dapat di-export dan dicetak

### 2.2 Tujuan Produk

Membangun sistem pelaporan payroll berbasis web yang:
- **Real-time**: Data diambil langsung dari database MSSQL
- **Akurat**: Kalkulasi mengikuti aturan perusahaan dan perpajakan Indonesia
- **User-friendly**: Interface dengan AG Grid untuk navigasi data yang mudah
- **Exportable**: Dapat di-export ke Excel, PDF, dan Google Spreadsheet

### 2.3 Target Pengguna

| Role | Deskripsi | Akses |
|------|-----------|-------|
| Admin | Tim HR/Finance | Semua divisi dan fitur |
| Supervisor | Kepala Divisi | Divisi tertentu saja |
| Viewer | Pihak manajemen | Read-only, semua divisi |

---

## 3. Fitur Utama

### 3.1 Laporan Daftar Upah (Payroll Report)

**Deskripsi:** Menampilkan data payroll lengkap per karyawan dalam format tabel AG Grid.

**Kolom Data:**

#### Informasi Karyawan
| Kolom | Deskripsi | Source |
|-------|-----------|--------|
| NIK | Nomor Induk Karyawan | HR_EMPLOYEE |
| Nama | Nama lengkap karyawan | HR_EMPLOYEE |
| Jabatan/Estate | Posisi kerja | HR_PAYROLL |
| Jenis Kelamin | L/P | HR_EMPLOYEE |
| Status PTKP | Status pajak (TK/0, K/1, dll) | Derived from beras_rate |
| Kategori TER | Kategori tarif efektif rata-rata | Derived from PTKP |
| Gang Code | Kode kelompok kerja | HR_GANGLN |
| Task Code | Kode tugas pekerjaan | PR_TASKREGLN |

#### Absensi
| Kolom | Deskripsi | Source |
|-------|-----------|--------|
| Jumlah HK | Total hari kerja | PR_TASKREGLN |
| Hari Kerja | Hari kerja efektif | Calculated |
| Kehadiran | Persentase kehadiran | Calculated |
| Cuti Tahunan | Hari cuti tahunan | PR_ADTRANS |
| Cuti Sakit/Haid | Hari sakit/haid | PR_ADTRANS |
| Cuti Minggu | Hari Minggu | Calculated |
| Cuti Nasional | Hari libur nasional | PR_ADTRANS |

#### Gaji Pokok
| Kolom | Deskripsi | Formula |
|-------|-----------|---------|
| Gaji Pokok | Gaji dasar | pay_rate × jumlah_hk |
| Gaji Pokok Ideal | Gaji jika HK penuh | pay_rate × 30 |
| Gaji Pokok Aktual | Gaji yang dibayarkan | Calculated |

#### Tunjangan
| Kolom | Deskripsi | Source |
|-------|-----------|--------|
| Tunjangan Beras | Tunjangan beras | PR_ADTRANS |
| Tunjangan Jabatan | Tunjangan posisi | PR_ADTRANS |
| Tunjangan Masa Kerja | Tunjangan senioritas | PR_ADTRANS |
| Total Tunjangan | Total semua tunjangan | Sum |

#### Lembur
| Kolom | Deskripsi | Formula |
|-------|-----------|---------|
| Lembur Jam | Total jam lembur | PR_TASKREGLN (OT=1) |
| Lembur Rate | Tarif rata-rata | Calculated |
| Lembur Jumlah | Total upah lembur | jam × UPJ × rate |
| Lembur Records | Detail transaksi lembur | Array of records |

#### Premi
| Kolom | Deskripsi | Source |
|-------|-----------|--------|
| Premi Brondol | Premi brondolan sawit | PR_ADTRANS |
| Premi Pruning | Premi pemangkasan | PR_ADTRANS |
| Premi [Dynamic] | Premi dinamis per jenis | PR_ADTRANS |
| Total Premi | Total semua premi | Sum |

#### Potongan Upah Kotor
| Kolom | Deskripsi | Source |
|-------|-----------|--------|
| Koreksi | Potongan koreksi | PR_ADTRANS |
| Total Potongan Kotor | Total potongan kotor | Sum |

#### Potongan Upah Bersih
| Kolom | Deskripsi | Source |
|-------|-----------|--------|
| BPJS Kesehatan | Potongan BPJS | Calculated |
| BPJS TK | Potongan BPJS Tenaga Kerja | Calculated |
| SPSI | Simpanan Pinjaman | PR_ADTRANS |
| PPH21 | Pajak penghasilan | TER Calculation |
| Potongan [Dynamic] | Potongan dinamis | PR_ADTRANS |
| Total Potongan Bersih | Total potongan bersih | Sum |

#### Total
| Kolom | Deskripsi | Formula |
|-------|-----------|---------|
| Upah Kotor | Gaji + Tunjangan + Premi + Lembur | Sum |
| Upah Bersih | Upah Kotor - Potongan | Sum |

---

### 3.2 Kalkulasi Lembur (Overtime)

**Sistem Tier-Based Rate:**

| Tipe Hari | Tier 1 | Tier 2 | Tier 3 | Boundary |
|-----------|--------|--------|--------|----------|
| Hari Kerja Biasa (Senin-Kamis, Sabtu) | 1.5x | 2x | - | 1 jam |
| Hari Jumat | 1.5x | 2x | - | 1 jam |
| Hari Minggu | 2x | 3x | 4x | 5/7 jam |
| Libur Umum | 2x | 3x | 4x | 5/7 jam |
| Libur Keagamaan | 3x | 4x | 4x | 5/7 jam |

**Formula UPJ (Upah Per Jam):**
```
UPJ = (pay_rate × 30) / 173
```
atau menggunakan nilai default dari environment variable `LEMBUR_UPJ` (default: 17257)

**Contoh Kalkulasi:**
- Karyawan dengan pay_rate 1.500.000
- Lembur hari kerja biasa selama 3 jam
- UPJ = (1.500.000 × 30) / 173 = 260.116
- Jam 1: 260.116 × 1.5 = 390.174
- Jam 2-3: 260.116 × 2 × 2 = 1.040.464
- Total: 1.430.638

---

### 3.3 Kalkulasi PPH21 dengan Metode TER

**PTKP Status Mapping:**

| beras_rate | PTKP Status | TER Category | Rate |
|------------|-------------|--------------|------|
| 2250 | TK/0 | TER A | 5% |
| 3250 | TK/1 | TER A | 5% |
| 4200 | TK/2 | TER B | 15% |
| 3750 | K/0 | TER A | 5% |
| 4650 | K/1 | TER B | 15% |
| 5550 | K/2 | TER B | 15% |
| 6450 | K/3 | TER C | 25% |

**Formula:**
```
PPh21 = Penghasilan Bruto × TER Rate
```

---

### 3.4 Summary Report

**Fitur:**
- Agregasi data per divisi
- Perbandingan antar periode
- KPI Cards (Total Karyawan, Total HK, Total Upah)
- Grafik perbandingan

---

### 3.5 Laporan Analisis Payroll

**Fitur:**
- Filter berdasarkan divisi, gang, bulan, tahun
- Tab filter: SEMUA, LEMBUR, PREMI, TUNJANGAN, POTONGAN
- Range filter untuk setiap tab
- Export ke Excel dan PDF
- Sinkronisasi ke Google Spreadsheet

---

### 3.6 Employee Detail Page

**Fitur:**
- Detail lengkap per karyawan
- Matriks lembur harian (calendar view)
- Riwayat transaksi per tanggal
- Slip gaji individual

---

### 3.7 Export dan Print

**Format Export:**
1. **Excel (.xlsx)** - Menggunakan ExcelJS
2. **PDF** - Menggunakan html2pdf.js
3. **CSV** - Built-in AG Grid
4. **Google Spreadsheet** - Via Apps Script API

**Print Features:**
- Print-optimized CSS
- Custom font size control
- Page break management
- Header/footer customization

---

### 3.8 Dashboard Home

**Fitur:**
- KPI Cards overview
- Quick access ke semua laporan
- Period selector
- Division filter

---

## 4. Aturan Bisnis (Business Rules)

### 4.1 Employee Filtering Rules

**KRITIS:** Filter karyawan berdasarkan aturan berikut:

```typescript
// Effective Work HK = HK - (Minggu + Libur Nasional)
const effective_work_hk = hk - (empCuti.cuti_minggu + empCuti.cuti_nasional);

// Cuti lain (tahunan, sakit/haid)
const other_cuti = empCuti.cuti_tahunan + empCuti.cuti_sakit_haid;

// FILTER LOGIC:
// - effective_work_hk <= 0 AND other_cuti == 0 -> FILTERED OUT
// - effective_work_hk <= 0 BUT other_cuti > 0 -> KEPT
// - effective_work_hk > 0 -> Always KEPT
if (effective_work_hk <= 0 && other_cuti == 0) continue;
```

**Aturan:**
1. Hanya HK Minggu/Libur Nasional (0 work days) -> **Tidak ditampilkan**
2. 0 HK tapi ADA cuti lain (tahunan, sakit/haid) -> **Harus ditampilkan**
3. HK kerja > 0 -> **Selalu ditampilkan**

### 4.2 Premi Filtering Rules

Item di-exclude dari dynamic premi jika DocDesc mengandung:
- `PPH`, `PPH21`, `PPH 21`
- `LEMBUR`
- `PRUN`, `PRUNING` (diaggregasi ke `premi_pruning`)
- `KOREKSI`, `KOREKSI PANEN`, `POTONGAN KOREKSI`
- `SPSI`
- `TUNJANGAN JABATAN`, `TUNJANGAN MASA KERJA`
- `TUNJANGAN BERAS`
- `BRONDOL` (diaggregasi ke `premi_brondol`)

### 4.3 Potongan Filtering Rules

Item di-exclude dari dynamic potongan jika DocDesc mengandung:
- Pattern yang dimulai dengan `POT%`
- `SPSI`
- `BERAS`
- `JABATAN`
- `MASA`
- `LEMBUR`
- `PPH%`

---

## 5. Non-Functional Requirements

### 5.1 Performance

| Metrik | Target |
|--------|--------|
| Page Load Time | < 3 detik |
| API Response Time | < 500ms |
| Grid Rendering | < 1 detik untuk 1000 rows |
| Export Excel | < 10 detik untuk 500 rows |

### 5.2 Security

| Item | Implementasi |
|------|--------------|
| Authentication | JWT Token dengan Bearer header |
| Authorization | Role-based (Admin, User) |
| Division Access | User hanya bisa akses divisi tertentu |
| Password Hashing | bcryptjs |
| Token Expiry | 60 menit (configurable) |

### 5.3 Reliability

| Item | Implementasi |
|------|--------------|
| Database Retry | 3x retry dengan exponential backoff |
| Error Handling | Try-catch dengan logging |
| Graceful Degradation | Loading states dan error messages |

### 5.4 Scalability

| Item | Implementasi |
|------|--------------|
| Frontend | Lazy loading pages |
| Backend | Singleton services |
| Database | Connection pooling via SQL Gateway |

---

## 6. Technical Constraints

### 6.1 Database Access Pattern

**SQL Gateway Pattern:**
```
Backend (Bun) -> SQL Gateway API (Python) -> MSSQL
```

Backend TIDAK terhubung langsung ke MSSQL. Semua query melalui SQL Gateway API.

**Gateway Endpoint:**
```
POST {DB_API_URL}/v1/query
Body: { sql, params, server, database }
```

### 6.2 Query Parameter Format

**WAJIB menggunakan `?` placeholder dengan array params:**

```typescript
// CORRECT - Auto-converts to @p0, @p1
const result = await db.query(`
    SELECT * FROM table WHERE col1 = ? AND col2 = ?
`, [value1, value2]);

// WRONG - Don't use named params directly
const result = await db.query(`
    SELECT * FROM table WHERE col1 = @p0 AND col2 = @p1
`, [value1, value2]);
```

### 6.3 Database Profiles

| Profile | Database | Usage |
|---------|----------|-------|
| `SERVER_PROFILE_1` | `extend_db_ptrj` | Aggregation history, analysis reports |
| `SERVER_PROFILE_2` | `db_ptrj` | Main payroll data (production) |
| `SERVER_PROFILE_3` | `VenusHR14` | Employee master, FFB weight |

---

## 7. Integration Points

### 7.1 Google Spreadsheet Sync

**Setup:**
1. Google Spreadsheet > Extensions > Apps Script
2. Copy code dari `integrasi/spreadsheet/Code.js`
3. Project Settings > Script Properties: `API_SECRET`
4. Deploy > Web app > Anyone
5. Copy URL ke backend `.env` as `GOOGLE_SCRIPT_URL`

**Sync Types:**
| Type | Sheets Created |
|------|----------------|
| `DAFTAR_UPAH` | AB1 (main), AB1 - ANALISIS |
| `ANALISIS_PAYROLL` | Same as above |
| `SUMMARY_WAGES` | DASHBOARD (summary) |

### 7.2 Python SQL Gateway

**Environment Variables:**
```bash
DB_API_URL=http://localhost:8001
DB_API_KEY=your-api-key
```

---

## 8. Future Roadmap

### Phase 2 (Planned)
- [ ] Mobile responsive design
- [ ] Offline mode dengan service worker
- [ ] Real-time notifications
- [ ] Bulk data import

### Phase 3 (Planned)
- [ ] Machine learning untuk prediksi payroll
- [ ] Integration dengan sistem HRIS lain
- [ ] Multi-company support

---

## 9. Glossary

| Term | Definition |
|------|------------|
| HK | Hari Kerja (Work Days) |
| UPJ | Upah Per Jam (Hourly Wage) |
| PTKP | Penghasilan Tidak Kena Pajak |
| TER | Tarif Efektif Rata-rata |
| PPH21 | Pajak Penghasilan Pasal 21 |
| BPJS | Badan Penyelenggara Jaminan Sosial |
| SPSI | Simpanan Pinjaman Karyawan |
| Gang | Kelompok kerja di perkebunan |
| FFB | Fresh Fruit Bunches (TBS) |
| Brondol | Brondolan sawit |
| Pruning | Pemangkasan tanaman |

---

## 10. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | Feb 2026 | AI Assistant | Initial documentation |

---

*Dokumen ini dibuat secara otomatis berdasarkan analisis kode sumber*