# Parallel Seeder Optimization

## Problem

Seeding aggregation untuk semua divisi (13 divisi) memakan waktu **sangat lama** (30-60 menit):
- ARC: 467s (8 menit)
- DME: 310s (5 menit)  
- IJL: 70s
- P1A: ~275s
- Dan 9 divisi lainnya...

**Root cause**: Semua divisi diproses **sequentially** (satu per satu)

## Solution: Parallel Processing

### Optimasi 1: Parallel Division Processing
**File**: `backend/src/api/parallelAggregationSeeder.ts`

**Cara kerja**:
- Proses **4 divisi sekaligus** dalam batch
- Gunakan `Promise.allSettled()` untuk parallel execution
- Jika satu divisi gagal, yang lain tetap lanjut

**Keuntungan**:
- Waktu ~75% lebih cepat (13 divisi / 4 parallel = ~4 batch)
- Estimasi: dari 30-60 menit → **5-10 menit**

### Optimasi 2: Fire-and-Forget History Seeder
**Sebelum**: Aggregation menunggu history seeding selesai (blocking)
**Sesudah**: History seeding jalan di background (non-blocking)

**Keuntungan**:
- Aggregation selesai cepat
- History tetap ter-seed di background
- User bisa langsung lihat hasil di Summary Report

### Optimasi 3: Parallel Record Insert
**Sebelum**: INSERT aggregation records satu per satu
**Sesudah**: INSERT semua records sekaligus dengan `Promise.all()`

**Keuntungan**:
- Untuk divisi dengan 10-15 gang: 10-15x lebih cepat

## Usage

### Default: Parallel Mode
```javascript
POST /payroll/aggregation/seed
{
  "month": 3,
  "year": 2026,
  "force": true
  // useParallel defaults to true
}
```

### Sequential Mode (backward compatible)
```javascript
POST /payroll/aggregation/seed
{
  "month": 3,
  "year": 2026,
  "force": true,
  "useParallel": false  // Explicitly disable parallel
}
```

## Expected Performance

| Scenario | Sequential | Parallel | Improvement |
|----------|-----------|----------|-------------|
| All divisions (13) | ~45 min | ~8 min | **82% faster** |
| Single division | ~5 min | ~5 min | Same |
| 4 divisions | ~20 min | ~5 min | **75% faster** |

## Monitoring Progress

Log output akan seperti:
```
🚀 Starting PARALLEL aggregation seeder...
📅 Period: Maret 2026
📊 Divisions: 13
⚡ Processing mode: PARALLEL (batch size 4)

📦 Batch 1/4: [P1A, P1B, P2A, P2B]
[P1A] Starting...
[P1B] Starting...
[P2A] Starting...
[P2B] Starting...
[P1A] ✅ Done in 120s (11 gangs, 230 emp)
[P1B] ✅ Done in 95s (8 gangs, 180 emp)
...
⏱️  Batch 1 completed in 120s

✅ Parallel seeding completed in 480s
📊 Success: 13/13 divisions
```

## Files Changed

1. **NEW**: `backend/src/api/parallelAggregationSeeder.ts` - Parallel seeder implementation
2. **MODIFIED**: `backend/src/api/aggregationSeederRoutes.ts` - Added parallel mode switch
3. **MODIFIED**: `backend/src/api/aggregationSeederRoutes.ts` - Added DELETE before INSERT
4. **MODIFIED**: `backend/src/services/historySeederService.ts` - Added force delete option

## Backward Compatibility

- Sequential mode masih tersedia dengan `useParallel: false`
- API contract tidak berubah (optional parameter)
- Old seeding scripts tetap bisa digunakan
