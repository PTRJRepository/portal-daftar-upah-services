# Summary Report Data Consistency Fix

## Masalah

### 1. Duplikasi Data di Aggregation History
Setiap kali seeder dijalankan, data baru di-INSERT tanpa menghapus data lama → menyebabkan duplikasi di `daftar_upah_aggregation_history`.

**Contoh**: Setelah 3x seeding untuk gang A1H Maret 2026 → ada 3 record dengan `total_pph21` berbeda.

### 2. PPh21 Tidak Muncul untuk Beberapa Divisi
Query `getPotongan` menggunakan `INNER JOIN HR_GANGLN` → exclude karyawan yang tidak ada di HR_GANGLN saat ini (pindah gang, resign, dll).

**Dampak**: PPh21 = 0 untuk divisi P1A, P1B, P2A, P2B, DME, IJL padahal ada transaksi di PR_ADTRANS.

### 3. Nilai Summary Berbeda dengan Daftar Upah
- **Koreksi**: Live = 557.428, History = 0 (tidak tersimpan saat seeding)
- **Premi**: Live = 74.9M, History = 82.4M (selisih 7.5M)
- **PPh21**: Live = 8.7M, History = 8.77M (selisih 58K)

## Fix yang Diterapkan

### Fix 1: DELETE BEFORE INSERT di Aggregation Seeder
**File**: `backend/src/api/aggregationSeederRoutes.ts`

**Sebelum**:
```typescript
// APPEND-ONLY: Always INSERT a new record (never UPDATE existing)
await db.query(`INSERT INTO dbo.daftar_upah_aggregation_history ...`, [...]);
```

**Sesudah**:
```typescript
// Delete existing records for this gang/period to prevent duplication
await db.query(`
    DELETE FROM dbo.daftar_upah_aggregation_history
    WHERE period_month = ? AND period_year = ? AND division_code = ? AND gang_code = ?
`, [month, year, dbDivisionCode, aggregation.gang_code]);

// INSERT new record with latest data
await db.query(`INSERT INTO dbo.daftar_upah_aggregation_history ...`, [...]);
```

### Fix 2: DELETE EXISTING HISTORY di History Seeder
**File**: `backend/src/services/historySeederService.ts`

**Sebelum**:
```typescript
// Removed deleteHistoryForPeriodAndLocation to prevent wiping out manual edits during reseeding.
// Using UPSERT logic in save methods instead.
```

**Sesudah**:
```typescript
// Delete existing history for this division/period/gang to prevent duplication
if (options.force) {
    console.log(`[HistorySeeder] Deleting existing history...`);
    await historyDatabaseService.deleteHistoryForPeriodAndLocation(
        options.periodMonth, 
        options.periodYear, 
        options.divisionCode, 
        options.gangCode
    );
}
```

### Fix 3: LEFT JOIN untuk Potongan (PPh21)
**File**: `backend/src/services/dataExtractorService.ts`

**Sebelum**:
```sql
FROM PR_ADTRANS t
INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(t.EmpCode)
```

**Sesudah**:
```sql
FROM PR_ADTRANS t
LEFT JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(t.EmpCode)
```

### Fix 4: PPh21 Menggunakan pot_pph21 dari Database
**Files**:
- `backend/src/services/payrollDataService.ts` line 316
- `backend/src/services/historySeederService.ts` line 532

**Perubahan**: Dari `pph21_ter || pot_pph21` menjadi `pot_pph21 || 0`

## Hasil yang Diharapkan

1. ✅ **Tidak ada duplikasi** - setiap gang/period punya 1 record di aggregation history
2. ✅ **PPh21 muncul untuk semua divisi** - semua transaksi PPh21 ter-extract
3. ✅ **Summary = Daftar Upah** - nilai konsisten antara live view dan summary report
4. ✅ **Idempotent seeding** - running seeder berkali-kali menghasilkan data yang sama

## Testing

Setelah fix, jalankan:
1. Restart backend
2. Trigger aggregation seeding untuk Maret 2026
3. Verify tidak ada duplikasi: `SELECT gang_code, COUNT(*) FROM daftar_upah_aggregation_history WHERE period_month=3 AND period_year=2026 GROUP BY gang_code HAVING COUNT(*) > 1` → harus 0 rows
4. Compare nilai Summary vs Daftar Upah untuk beberapa gang → harus sama

## Catatan Penting

- **force=true** diperlukan saat seeding agar delete existing data
- **Seeding harus selesai 100%** sebelum data bisa digunakan di Summary Report
- **Jangan interrupt seeding** di tengah proses agar data tidak corrupt
