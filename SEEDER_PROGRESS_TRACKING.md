# Seeder Progress Tracking

## Cara Monitor Progress Seeder

### Option 1: Via Command Line

Jalankan script check progress:

```bash
cd backend
bun run _dev_utils/scripts/debugging/check_seeder_status.ts
```

**Output contoh saat seeding berjalan:**
```
============================================================
📊 SEEDER PROGRESS
============================================================
🔄 Seeder is RUNNING
📦 Batch: 2/4
🏢 Current Division: P1B
✅ Divisions done: 4/13
💬 Message: Processing batch 2/4: P1B, P2A, P2B, DME
⏱️  Elapsed: 180s (3.0 min)
============================================================
🕐 Last update: 15:30:45
============================================================
```

### Option 2: Via API (untuk UI integration)

```bash
curl http://localhost:8002/payroll/aggregation/progress \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response JSON:**
```json
{
  "success": true,
  "progress": {
    "is_running": true,
    "current_division": "P1B",
    "current_gang": "",
    "divisions_total": 13,
    "divisions_done": 4,
    "current_batch": 2,
    "total_batches": 4,
    "started_at": "2026-04-05T15:27:00.000Z",
    "last_update": "2026-04-05T15:30:45.000Z",
    "message": "Processing batch 2/4: P1B, P2A, P2B, DME"
  },
  "elapsed_seconds": 180
}
```

### Option 3: Via Browser Console

Buka browser console di halaman aplikasi dan jalankan:

```javascript
fetch('http://localhost:8002/payroll/aggregation/progress', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
})
.then(r => r.json())
.then(console.log);
```

## Log Backend

Saat seeding berjalan, backend akan menampilkan log seperti:

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
⏱️  Batch 1 completed in 120s

📦 Batch 2/4: [DME, ARA, ARB1, ARB2]
[DME] Starting...
...
```

## Arti Status

| Status | Arti |
|--------|------|
| `is_running: true` | Seeder sedang berjalan |
| `is_running: false` | Seeder selesai/belum mulai |
| `current_batch` | Batch yang sedang diproses (dari total) |
| `divisions_done` | Jumlah divisi yang sudah selesai |
| `message` | Deskripsi aktivitas saat ini |

## Estimasi Waktu

- **Sequential (old)**: ~30-45 menit untuk 13 divisi
- **Parallel (new)**: ~5-10 menit untuk 13 divisi
- **Per batch**: ~2-3 menit (4 divisi diproses bersamaan)
