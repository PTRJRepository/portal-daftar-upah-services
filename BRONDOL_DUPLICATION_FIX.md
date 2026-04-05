# Brondol Duplication Fix - Summary Report

## Masalah
Di Summary Report, "Brondol" muncul 3 kali di kolom PREMI INCOME, menyebabkan total premi berbeda/keliru.

## Root Cause
Header "BRONDOL" ditambahkan berulang kali dari berbagai sumber:
1. Dari `total_premi_brondol` column di database
2. Dari `dynamic_premi` array yang mengandung "BRONDOL"
3. Backend menambahkan "PREMI BRONDOL" jika ada `total_premi_brondol > 0`

## Fix

### 1. Backend - summaryService.ts
**File**: `backend/src/services/summaryService.ts`

**Perubahan**:
- Tambah logic untuk menghapus duplikat "brondol" (case-insensitive) dari `filteredHeaderList`
- Hanya keep 1 "BRONDOL" header
- Update `dynamic_premi_totals` calculation untuk menggunakan unique headers
- Return `uniqueFilteredHeaders` ke frontend

```typescript
// Remove duplicate 'brondol' headers (case-insensitive)
const uniqueFilteredHeaders: string[] = [];
const seenBrondol = new Set<string>();
for (const header of filteredHeaderList) {
    const normalized = header.toLowerCase().trim();
    if (normalized.includes('brondol')) {
        if (!seenBrondol.has('brondol')) {
            seenBrondol.add('brondol');
            uniqueFilteredHeaders.push(header);
        }
    } else {
        uniqueFilteredHeaders.push(header);
    }
}
```

### 2. Frontend - SummaryReportPage.jsx
**File**: `frontend/src/pages/SummaryReportPage.jsx`

**Perubahan**:
- Deduplicate headers yang diterima dari backend
- Case-insensitive comparison untuk handle variasi "BRONDOL", "Brondol", "premi brondol"

```javascript
// Remove duplicate headers (especially 'brondol')
const rawHeaders = result.filtered_headers || [];
const uniqueHeaders = [];
const seen = new Set();
for (const header of rawHeaders) {
    const normalized = header.toLowerCase().trim();
    if (!seen.has(normalized)) {
        seen.add(normalized);
        uniqueHeaders.push(header);
    }
}
setFilteredHeaders(uniqueHeaders);
```

## Hasil
✅ **Hanya 1 kolom BRONDOL** yang muncul di Summary Report  
✅ **Total Premi benar** - tidak ada double counting  
✅ **Backend & Frontend** sama-sama deduplicate headers  
✅ **Case-insensitive** - handle "BRONDOL", "Brondol", "premi brondol"

## Testing
1. Buka Summary Report
2. Pilih period (Maret 2026)
3. Check kolom PREMI INCOME - BRONDOL harus cuma 1x
4. Total Premi harus sesuai dengan jumlah di Daftar Upah
5. Print preview - BRONDOL tetap 1x
