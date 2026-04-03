# Product Requirements Document (PRD)
## Payroll Daftar Upah Reporting System - PT Rebinmas

> **Status:** Production Ready | **Updated:** April 2026

---

## 1. Overview

Sistem pelaporan payroll berbasis web untuk PT Rebinmas (perkebunan kelapa sawit):

- Gaji pokok berdasarkan hari kerja (HK)
- Lembur dengan tier-based rates
- Premi berdasarkan jenis pekerjaan
- Potongan (BPJS, PPH21, SPSI, dll)
- Pendapatan lainnya (THR, Bonus, Custom)

### Stack
- **Backend:** Bun + Elysia + TypeScript
- **Frontend:** React 18 + Vite + AG Grid Enterprise
- **Database:** MSSQL via Python SQL Gateway API

---

## 2. Fitur Utama

### Laporan Daftar Upah
Format AG Grid dengan kolom:
- Informasi Karyawan (NIK, Nama, Jabatan, Gang)
- Absensi (HK, Hari Kerja, Cuti)
- Gaji Pokok (Ideal, Aktual)
- Tunjangan (Beras, Jabatan, Masa Kerja, Lembur)
- Premi (Brondol, Pruning, Dynamic)
- Potongan (BPJS, SPSI, PPH21, Dynamic)
- **Upah Kotor** dan **Upah Bersih**

### Overtime (Lembur)
| Tipe | Tier 1 | Tier 2 | Tier 3 |
|------|--------|--------|--------|
| Hari Kerja | 1.5x | 2x | - |
| Jumat | 1.5x | 2x | - |
| Minggu | 2x | 3x | 4x |
| Libur Umum | 2x | 3x | 4x |
| Libur Keagamaan | 3x | 4x | 4x |

Formula: `UPJ = (pay_rate × 30) / 173`

### PPh21 TER
```
PPh21 = Penghasilan Bruto × TER Rate
```
PTKP mapping: `backend/src/services/payroll/formulas/PTKPMapper.ts`

---

## 3. User Roles

| Role | Access |
|------|--------|
| Admin | Semua divisi dan fitur |
| Supervisor | Divisi tertentu |
| Viewer | Read-only |

---

## 4. Non-Functional Requirements

| Metrik | Target |
|--------|--------|
| Page Load | < 3 detik |
| API Response | < 500ms |
| Grid 1000 rows | < 1 detik |

### Security
- JWT Authentication
- Role-based Authorization
- Division-based access

---

## 5. Database Access

**Pattern:** `Backend → Python SQL Gateway → MSSQL`

| Profile | Database | Usage |
|---------|---------|-------|
| `SERVER_PROFILE_1` | `extend_db_ptrj` | Aggregation |
| `SERVER_PROFILE_2` | `db_ptrj` | Main payroll |
| `SERVER_PROFILE_3` | `VenusHR14` | Employee master |

**Query:** Selalu gunakan `?` placeholder

---

## 6. Key Business Rules

### Employee Filtering
```typescript
// EXCLUDE if hari_kerja <= 0 AND no cuti
if (hari_kerja <= 0 && other_cuti == 0) continue;
```

### Payroll Formulas
Canonical: `dokumentasi/business-rules/FORMULAS.md`

```
upah_kotor       = gaji + tunjangan + premi
jumlah_upah_kotor = upah_kotor + koreksi + lainnya
total_potongan   = bpjs + astek + spsi + pph21 + lainnya
upah_bersih     = jumlah_upah_kotor - total_potongan + premi_pph
```

---

## 7. Export
- Excel (.xlsx) - ExcelJS
- PDF - html2pdf.js
- CSV - AG Grid
- Google Spreadsheet - Apps Script API
