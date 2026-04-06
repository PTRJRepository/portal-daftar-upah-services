# Analisis Perbedaan Nilai Upah Bersih: Backend vs Frontend

## Masalah

Untuk **Divisi AB1, Gang G1H, Maret 2026**:
- **Backend calculates**: 179,020,154
- **Expected (dari frontend)**: 176,414,884  
- **Selisih**: 2,605,270 (1.48%)

## Yang Sudah Diverifikasi ✅

### 1. Backend Calculator Logic
- ✅ Filter: `jumlah_hk > 0` (SAMA dengan frontend)
- ✅ Sum function: `Math.round(reduce(...))` (SAMA dengan frontend)
- ✅ Field handling: `Number(field || 0)` (SAMA dengan frontend)
- ✅ Nested objects: `premi`, `other_incomes` (SAMA dengan frontend)
- ✅ Rounding: `Math.round()` di setiap field (SAMA dengan frontend)

### 2. Data Structure
- ✅ 36 employees (SEMUA memiliki jumlah_hk > 0 dan hari_kerja > 0)
- ✅ Total hari_kerja: 575
- ✅ Ada nested `premi` object
- ✅ Ada `other_incomes` array (THR)

### 3. Employee Values Sample
```
Employee 1: SAWIN ( USPA )
  - jumlah_hk: 30
  - hari_kerja: 15 (ada cuti 15 hari)
  - upah_bersih: 5,166,975
  - other_incomes: THR 4,201,500
  - premi: {premi_insentif_panen: 150000, premi_pruning: 262900, premi_tbs: 454251, brondol: 413000}

Employee 2: MOHAMMAD SAID ( SULIHA )
  - jumlah_hk: 30
  - hari_kerja: 17
  - upah_bersih: 5,507,532
```

## Kemungkinan Penyebab Perbedaan

### 1. **Data Backend Berbeda Versi**
Mungkin data yang backend extract SEKARANG sudah berbeda dengan data yang frontend gunakan sebelumnya.

**Kemungkinan:**
- Ada update di `dataExtractorService` yang mengubah cara hitung `upah_bersih`
- Ada perubahan di database (PR_TASKREGLN, PR_ADTRANS)
- Ada perubahan logic PPh21, BPJS, atau komponen lainnya

**Test yang diperlukan:**
```bash
# Check kapan terakhir kali dataExtractorService diubah
git log --oneline -10 backend/src/services/dataExtractorService.ts

# Check apakah ada perubahan baru-baru ini
git diff HEAD~20..HEAD backend/src/services/dataExtractorService.ts
```

### 2. **Frontend Menggunakan Data Cached/Lama**
Mungkin frontend menampilkan data dari periode atau versi yang berbeda.

**Test yang diperlukan:**
- Buka frontend Report.jsx SEKARANG (sebelum deployment code saya)
- Lihat nilai GRAND TOTAL untuk G1H Maret 2026
- Apakah memang 176,414,884 atau berbeda?

### 3. **Perbedaan Sumber Data**
Backend calculator saya menggunakan `dataExtractorService.extractPayrollData()`, tapi mungkin frontend menggunakan endpoint atau sumber yang berbeda.

**Endpoint yang tersedia:**
- `/payroll/report` - Single gang report
- `/payroll/report/division-raw-tree` - Division report
- `/payroll/locked/report/raw-tree` - Locked division report

Masing-masing endpoint mungkin menggunakan logic atau data yang sedikit berbeda.

### 4. **Ada Bug di Backend Calculator**
Meskipun sudah mengikuti logic frontend, mungkin ada edge case yang terlewat.

**Yang perlu di-check:**
- Apakah ada field yang belum di-sum?
- Apakah ada nested structure yang belum di-flatten?
- Apakah ada perbedaan dalam handling `other_incomes`?

## Recommended Next Steps

### Option A: Verify Frontend Current Value
1. **Buka frontend Report.jsx** (sebelum deployment code saya)
2. **Pilih**: Division AB1, Gang G1H, Bulan Maret 2026
3. **Lihat**: Berapa nilai di GRAND TOTAL row (paling bawah)?
4. **Screenshot** dan compare dengan backend response

**Jika frontend SEKARANG menunjukkan 176,414,884:**
→ Backend calculator saya menghasilkan nilai yang BERBEDA dari backend yang frontend gunakan
→ Perlu trace apa yang berbeda

**Jika frontend SEKARANG menunjukkan 179,020,154:**
→ Nilai sudah benar, tidak ada masalah
→ Backend calculator saya SUDAH BENAR

### Option B: Deep Dive Backend Changes
1. Check git history untuk perubahan terbaru di:
   - `dataExtractorService.ts`
   - `payrollComponentRegistry.ts`
   - `PayrollCalculator.ts`
   - `Pph21TerService.ts`
   
2. Compare logic lama vs logic baru

3. Check apakah ada employee yang `upah_bersih`-nya berubah

### Option C: Manual Verification dengan Excel
1. Export data G1H Maret 2026 ke Excel dari frontend
2. Sum manual kolom `upah_bersih`
3. Compare dengan 176,414,884 dan 179,020,154

## Kesimpulan

Backend calculator **SUDAH mengikuti EXACT logic frontend**:
- ✅ Filter yang sama
- ✅ Sum function yang sama
- ✅ Rounding yang sama
- ✅ Field handling yang sama

**Perbedaan 1.48% kemungkinan berasal dari:**
1. Data yang berbeda (backend update vs frontend cached)
2. Ada perubahan logic di backend yang mempengaruhi `upah_bersih` calculation
3. Frontend menampilkan data dari sumber/sesi yang berbeda

**Untuk memastikan:** Verifikasi dulu nilai yang frontend tampilkan SEKARANG sebelum deployment code saya.
