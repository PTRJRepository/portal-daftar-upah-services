# Perubahan Terakhir - Payroll Daftar Upah

## Overview

Dokumen ini mencatat perubahan penting yang dilakukan pada kode. Berguna untuk tracking perubahan dan memahami evolusi kode.

---

## Perubahan Terbaru (Februari 2026)

### 1. Perbaikan Kalkulasi Lembur

**Tanggal:** Februari 2025
**Commit Reference:** f620897

**Masalah:**
- Kalkulasi lembur tidak konsisten antara Detail Page dan Daftar Upah
- UPJ (Upah Per Jam) diinisialisasi dengan nilai 0
- Batch methods menggunakan `payRate || 0` menyebabkan UPJ = 0

**Solusi:**
```typescript
// Backend (lemburCalculator.ts)
private upjValue: number;

private constructor() {
    // Fixed: Initialize UPJ from environment variable
    this.upjValue = parseFloat(process.env.LEMBUR_UPJ || "17257");
}

// Fixed: Use fallback UPJ when payRate not found
const upj = payRate > 0 ? (payRate * 30) / 173 : this.upjValue;
```

**Hasil:**
- Kalkulasi lembur konsisten di semua halaman
- Total lembur = Sum of detail records

---

### 2. Perbaikan Gang Filter

**Tanggal:** Februari 2026

**Masalah:**
- Gang filter tidak berfungsi - perubahan gang tidak memfilter data
- Semua karyawan dari semua gang ditampilkan

**Root Cause:**
```typescript
// BEFORE (Wrong)
result.gangs.forEach(gangData => {
    allEmployees = allEmployees.concat(gangData.employees); // All employees!
});
```

**Solusi:**
```typescript
// AFTER (Correct)
result.gangs.forEach(gangData => {
    const shouldInclude = !gang || gang === 'ALL' || gangData.gang_code === gang;
    if (shouldInclude && gangData.employees) {
        allEmployees = allEmployees.concat(gangData.employees);
    }
});
```

**Hasil:**
- Gang filter berfungsi dengan benar
- Division filter mem-refresh gang list

---

### 3. Page Rename

**Tanggal:** Februari 2026

**Perubahan:**
- `ComprehensivePerformancePage` -> `PayrollAnalysisPage`
- Display name: "Laporan Analisis Payroll"
- Route tetap `/comprehensive` untuk backward compatibility

**File yang Diubah:**
- `frontend/src/pages/PayrollAnalysisPage.jsx` (renamed)

---

### 4. Employee Filtering Fix

**Tanggal:** Februari 2025
**Commit Reference:** f620897

**Masalah:**
- 1 karyawan hilang (~3.8M difference)
- Filter `hari_kerja <= 0` terlalu agresif

**Solusi:**
```typescript
// CORRECT filter logic
const effective_work_hk = hk - (empCuti.cuti_minggu + empCuti.cuti_nasional);
const other_cuti = empCuti.cuti_tahunan + empCuti.cuti_sakit_haid;

// Only filter if effective_work_hk <= 0 AND other_cuti == 0
if (effective_work_hk <= 0 && other_cuti == 0) continue;
```

**Hasil:**
- Karyawan dengan cuti tahunan/sakit tetap ditampilkan
- Total upah sesuai dengan ekspektasi (693 juta)

---

## Riwayat Perubahan

### 2025

| Bulan | Perubahan | Impact |
|-------|-----------|--------|
| Des | Initial refactor production | Project setup |
| Des | SQL Gateway pattern | Database access |
| Des | Lembur calculation fix | Accuracy |
| Des | Employee filtering fix | Data completeness |

### 2026

| Bulan | Perubahan | Impact |
|-------|-----------|--------|
| Jan | PPH21 TER implementation | Tax calculation |
| Jan | Google Spreadsheet sync | Export feature |
| Feb | Gang filter fix | Filtering accuracy |
| Feb | Page rename | UI clarity |

---

## Breaking Changes

### 1. Database Profile Change

**Perubahan:** `RUN_MODE=prod` sekarang menggunakan `SERVER_PROFILE_2`

**Impact:**
- Pastikan environment variable benar
- Data production vs development berbeda

### 2. API Response Structure

**Perubahan:** Response `/payroll/report/division-raw-tree` sekarang include `gang_totals`

**Impact:**
- Frontend perlu update untuk handle structure baru
- Backward compatible dengan old structure

### 3. Lembur Records Format

**Perubahan:** `lembur_records` sekarang menggunakan `trx_date` bukan `date`

**Impact:**
- Frontend perlu update key access
- Old code mungkin break

---

## Deprecation Notices

### 1. LegacyPayrollGrid.jsx

**Status:** Deprecated
**Replacement:** `CustomPayrollTable.jsx`
**Timeline:** Will be removed in next major version

### 2. Direct Database Connection

**Status:** Deprecated
**Replacement:** SQL Gateway Pattern
**Timeline:** Already removed

---

## Migration Guide

### Dari Versi Lama ke Versi Baru

#### 1. Update Environment Variables

```bash
# Add new variables
LEMBUR_UPJ=17257
DB_EXTEND_PROFILE=SERVER_PROFILE_1
DB_EXTEND_DATABASE=extend_db_ptrj
```

#### 2. Update Frontend Service Calls

```javascript
// Old
const response = await fetch('/api/payroll/report');

// New
const response = await fetch('/payroll/report/division-raw-tree');
```

#### 3. Update Lembur Display

```javascript
// Old - grouped by task
records.map(r => r.task_desc)

// New - individual transactions
records.map(r => r.trx_date + ' - ' + r.task_desc)
```

---

## Pending Changes

### Akan Datang

1. **Mobile Responsive Design** - Q2 2026
2. **Real-time Notifications** - Q2 2026
3. **Offline Mode** - Q3 2026

---

## Cara Update Dokumentasi Ini

Setiap kali melakukan perubahan signifikan:

1. Tambahkan entry di bagian "Perubahan Terbaru"
2. Update "Riwayat Perubahan" jika perlu
3. Catat "Breaking Changes" jika ada
4. Update "Migration Guide" jika diperlukan

### Format Entry

```markdown
### N. Judul Perubahan

**Tanggal:** Bulan Tahun
**Commit Reference:** xxxxxx (jika ada)

**Masalah:**
- Deskripsi masalah

**Solusi:**
```typescript
// Code snippet
```

**Hasil:**
- Dampak perubahan
```

---

**Selanjutnya:** Baca [12_TODO_PENDING.md](./12_TODO_PENDING.md) untuk mengetahui fitur yang belum diimplementasi.