# PPh21 Database Value Fix

## Masalah
PPh21 tidak tampil di Summary Report karena menggunakan `pph21_ter` (kalkulasi) sebagai sumber utama, bukan `pot_pph21` (potongan aktual dari database).

## Perubahan

### 1. `backend/src/services/payrollDataService.ts` (Line 316)
**Sebelum:**
```typescript
total_pph21: totals.pph21_ter || totals.pot_pph21 || 0,
```

**Sesudah:**
```typescript
total_pph21: totals.pot_pph21 || 0,
```

### 2. `backend/src/services/historySeederService.ts` (Line 532-534)
**Sebelum:**
```typescript
// [FIX] Use pph21_ter (calculated TER) instead of pot_pph21 (manual input)
// if available, to ensure tax data is always visible in history header.
totals.total_pph21 += emp.pph21_ter || emp.pot_pph21 || 0;
```

**Sesudah:**
```typescript
// Use pot_pph21 from database (actual deduction from PR_ADTRANS)
totals.total_pph21 += emp.pot_pph21 || 0;
```

### 3. `backend/src/api/aggregationSeederRoutes.ts` (Line 914-918)
**Fixed INSERT statement column/value mismatch:**
- 40 columns, originally 37 placeholders + 2 GETDATE() = 39 values
- Now 38 placeholders + 2 GETDATE() = 40 values ✅

## Data Flow PPh21

```
PR_ADTRANS (potongan PPh21) 
  → pot_pph21 (dataExtractorService)
    → pph21 (alias for aggregation)
      → total_pph21 (aggregation)
        → daftar_upah_aggregation_history.total_pph21
          → Summary Report
```

## Catatan Penting
- `pot_pph21`: Nilai aktual yang dipotong dari karyawan (dari PR_ADTRANS.DocDesc LIKE '%PPH21%')
- `pph21_ter`: Kalkulasi TER (hanya untuk perhitungan pajak, bukan potongan aktual)
- Summary Report sekarang menggunakan **pot_pph21** sebagai sumber tunggal
