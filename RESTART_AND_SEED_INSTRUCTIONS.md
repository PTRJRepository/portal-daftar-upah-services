# Restart & Seeding Instructions

## Step-by-Step Guide

### 1. Restart Backend

**Cara restart backend** (pilih salah satu):

#### Option A: Jika pakai PM2
```bash
pm2 restart backend
# atau
pm2 restart <backend-process-id>
```

#### Option B: Jika pakai terminal langsung
```bash
# Stop backend yang sedang running (Ctrl+C di terminal backend)
# Lalu start ulang:
cd backend
bun run dev
```

#### Option C: Jika pakai Docker
```bash
docker-compose restart backend
```

### 2. Wait for Backend Ready

Tunggu sampai backend fully started. Ciri-ciri:
- Log menunjukkan: `Server running on port 8002`
- Tidak ada error saat startup
- Semua service initialized

### 3. Trigger Parallel Seeding

Setelah backend ready, jalankan:

```bash
cd backend
bun run _dev_utils/scripts/debugging/trigger_parallel_seed.ts
```

**Atau** via frontend UI:
- Buka Summary Report page
- Pilih period: Maret 2026
- Klik "Seed Aggregation" atau tombol re-seed

### 4. Monitor Progress

Backend logs akan menunjukkan:
```
🚀 Starting PARALLEL aggregation seeder...
📅 Period: Maret 2026
📊 Divisions: 13
⚡ Processing mode: PARALLEL (batch size 4)

📦 Batch 1/4: [P1A, P1B, P2A, P2B]
[P1A] Starting...
[P1B] Starting...
...
```

**Estimated time**: 5-10 minutes (vs 30-45 min sequential)

### 5. Verify Results

After seeding completes, check:

#### A. No Duplication
```sql
SELECT gang_code, division_code, COUNT(*) as cnt
FROM daftar_upah_aggregation_history
WHERE period_month = 3 AND period_year = 2026
GROUP BY gang_code, division_code
HAVING COUNT(*) > 1
```
**Expected**: 0 rows (no duplicates)

#### B. PPh21 Present
```sql
SELECT division_code, SUM(total_pph21) as total_pph21
FROM daftar_upah_aggregation_history
WHERE period_month = 3 AND period_year = 2026
GROUP BY division_code
```
**Expected**: Non-zero values for all divisions

#### C. Summary = Daftar Upah
- Buka Summary Report untuk Maret 2026
- Compare values dengan Daftar Upah live view
- **Expected**: Values match (within 1 rupiah rounding)

### 6. Check History Seeder (Background)

History seeder runs in background after aggregation completes:
```
[DIV] ✅ History seeder complete (XXXs)
```

This may take additional 5-10 minutes after aggregation finishes.

---

## Troubleshooting

### If seeding fails:
1. Check backend logs for error messages
2. Verify database connection is stable
3. Ensure no other seeding is running (check for stuck processes)

### If PPh21 still 0:
1. Verify LEFT JOIN fix was applied (check `dataExtractorService.ts` line ~2192)
2. Check if PPh21 transactions exist in PR_ADTRANS
3. Re-run seeding with force=true

### If duplicate found:
1. Run cleanup: 
```sql
DELETE FROM daftar_upah_aggregation_history
WHERE period_month = 3 AND period_year = 2026
```
2. Re-run seeding with force=true

---

## Support

If issues persist:
1. Check all fix files are in place
2. Verify TypeScript compilation: `cd backend && bun run --bun tsc --noEmit`
3. Review documentation in `SUMMARY_REPORT_CONSISTENCY_FIX.md`
