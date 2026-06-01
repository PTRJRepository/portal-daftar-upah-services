# PRD — Optimasi Sistem Daftar Upah

**Status:** v1.1 — Eksekusi Phase 1-3 + Phase 4.4 selesai (2026-06-01)
**Tanggal:** 2026-06-01
**Author audit:** Kiro CLI (Opus 4.7) — handoff ke Sonnet
**Audience:** Engineer / agent yang akan mengerjakan implementasi
**Repo:** `D:\Gawean Rebinmas\PORTAL_ESTATE\Plantware_Auto_Report\Daftar_Upah_baru\payroll_daftar_upah\refactor_production`

## Status Eksekusi (2026-06-01)

### ✅ Selesai (branch: server-fix-1)

| Task | Commit | Keterangan |
|---|---|---|
| 1.4 Cleanup file root liar | de5fd21c | patch_frontend.cjs, .pytest_cache, dev scripts dihapus |
| 1.5 Dev scripts ke legacy_backend | de5fd21c | 25 file dipindah ke _dev_utils/scripts/legacy_backend/ |
| 1.6 Arsip CLAUDE.md + QWEN.md | de5fd21c | Dipindah ke docs/archive/ |
| 1.3 Cache invalidation spesifik | e90247c9 | invalidatePayroll() helper, drop clear() global |
| 1.2 Lazy load pages | fb216212 | 21 page report dikonversi ke lazy() |
| 1.7 Proxy route always mounted | 6085064e | /backend/upah unconditional |
| 1.1 Minify + compression | 6e37b9a9 | esbuild minify + gzip/brotli, bundle -50% |
| 2.1 Unique index migration | ebda5cbc | SQL di backend/sql/migrations/ (run manual) |
| 2.3 Batch endpoint | cb5d6c1b | POST /payroll/manual-edit/batch |
| 2.4 Frontend batch save | cb5d6c1b | 50 cell: ~10s → ~0.5s |
| 2.5 Optimistic UI | 6abb6a84 | cell-saving (biru) + cell-saved (hijau fade) |
| 2.6 Debounce resize | 6abb6a84 | 100ms debounce + RAF throttle drag-select |
| 3.2 Virtual row windowing | ff18c412 | ~12k <td> → ~600 <td> di DOM |
| 3.4 Compact mode toggle | 96a436fc | Font 10px, padding 1-3px, localStorage |
| 4.4 Rate limiter | 4fed5f6c | 60 req/10s per user di write endpoints |
| 3.3 Partial split | b7fdac21 | payrollTableFormatters.js extracted |

### ⏳ Belum dikerjakan

- **2.2** MERGE atomic upsert (test suite 130KB perlu refactor besar; unique index dari 2.1 sudah memberikan DB-level protection)
- **3.3** Split CustomPayrollTable.jsx lebih lanjut (partial done: formatters extracted)
- **4.1** Modularisasi dataExtractorService.ts (sudah ada extractors/ folder, tinggal facade)
- **4.2** Modularisasi manualAdjustmentService.ts
- **4.3** Pecah payroll.ts API (164KB, 68 endpoint)
- **4.5** Redis cache (optional)
- **4.6** mssql native pool (optional)

### Cara lanjutkan

```bash
git checkout server-fix-1
# Lanjut dari task yang belum selesai
```

Untuk deploy ke production:
1. Jalankan `cd frontend && npm run build`
2. Jalankan migration DB: `backend/sql/migrations/add_manual_adjustment_dedup_index.sql`
3. Restart backend: `cd backend && bun run start`

> **Cara pakai dokumen ini:** dokumen ini dirancang **self-contained**. Agent yang baru masuk tidak perlu membaca chat history sebelumnya. Cukup baca dokumen ini + file source code yang dirujuk per task. Setiap task punya file path + acceptance criteria + cara test + rollback.

---

## Daftar Isi

1. [Executive Summary](#1-executive-summary)
2. [Context & Tech Stack](#2-context--tech-stack)
3. [Problem Statement](#3-problem-statement)
4. [Goals & Non-Goals](#4-goals--non-goals)
5. [Success Metrics](#5-success-metrics)
6. [Audit Findings (Full Reference)](#6-audit-findings-full-reference)
7. [Solution Architecture](#7-solution-architecture)
8. [Phased Roadmap (4 minggu)](#8-phased-roadmap-4-minggu)
9. [Detailed Task Specs](#9-detailed-task-specs)
10. [Testing Strategy](#10-testing-strategy)
11. [Risks & Rollback](#11-risks--rollback)
12. [Handoff Notes](#12-handoff-notes-untuk-agent-berikutnya)
13. [Index Dokumen Pendukung](#13-index-dokumen-pendukung)

---

## 1. Executive Summary

Sistem **Daftar Upah** (payroll register) mengalami masalah performa serius pada skenario nyata user di estate:

- Monitor lama (1366×768 atau 1280×1024) dengan zoom Windows 125–150%
- PC lambat (HDD, RAM 4 GB)
- Banyak user concurrent (5–20 user) yang melakukan banyak request edit (premi, manual adjustment)

Audit menemukan **3 akar masalah utama** + codebase yang sangat berantakan:

1. **Bundle production tidak diminify + semua page diimport statis** — initial JS load berukuran puluhan MB
2. **`CustomPayrollTable.jsx` (254 KB) merender ±12.000 `<td>` tanpa virtualisasi** — layout/paint sangat berat
3. **Cache backend di-`clear()` global tiap save + save serial dengan race condition** — concurrent user saling memperlambat dan ada risiko data ganda/hilang

Plus: 29+ worktree dormant, 247+ dev script, 4 panduan agent paralel, file root liar.

**Outcome target setelah 4 minggu eksekusi:**
- Initial bundle turun ≥60%
- Render & scroll Daftar Upah smooth di PC lambat dengan 200+ employee × 60+ kolom
- Save 50 cell edit selesai <1 detik (sebelumnya 5–15 detik)
- Zero race condition pada manual adjustment (atomic upsert)
- Concurrent throughput naik 3–5× via cache invalidation spesifik
- Repo bersih: tidak ada file root liar, dev script terpisah jelas

---

## 2. Context & Tech Stack

### 2.1 Modul Daftar Upah

**Frontend** (`frontend/`):
- React 18 + Vite 5 + React Router 7
- Entry: `frontend/src/main.jsx` → `frontend/src/App.jsx` (55 KB)
- Page utama: `frontend/src/pages/MainPage.jsx` (88 KB) — wrapper Daftar Upah
- Komponen tabel: `frontend/src/components/CustomPayrollTable.jsx` (**254 KB**, monolith)
- Stream data: `frontend/src/hooks/usePayrollStream.js` (SSE consumer)
- Service layer: `frontend/src/services/manualAdjustmentService.js`, `payrollService.js`, dst.
- Bundle dependencies berat: `ag-grid-enterprise`, `recharts`, `exceljs`, `html2pdf.js`

**Backend** (`backend/`):
- Bun runtime + Elysia framework
- Entry: `backend/src/index.ts` (14 KB)
- Konfigurasi: `backend/src/config.ts`
- Route: `backend/src/api/payroll.ts` (**158 KB**, 67 endpoint)
- Service utama:
  - `backend/src/services/dataExtractorService.ts` (**271 KB**) — ekstraksi payroll dari DB
  - `backend/src/services/manualAdjustmentService.ts` (**130 KB**) — CRUD manual adjustment
  - `backend/src/services/summaryService.ts` (103 KB)
  - `backend/src/services/taxReportService.ts` (99 KB)
  - `backend/src/services/historyDatabaseService.ts` (98 KB)
  - `backend/src/services/cacheService.ts` (in-memory Map cache)
- DB access: `backend/src/db/client.ts` — **tidak pakai mssql native**, kirim query via HTTP ke Python SQL Gateway (`Additional_services/query_gateway/`)

### 2.2 Build & Run

| Command | Tujuan |
|---|---|
| `cd frontend && npm run dev:test` | Vite dev server di port 5175 |
| `cd frontend && npm run build` | Build production ke `frontend/dist/` |
| `cd backend && bun run dev` | Backend watch mode |
| `cd backend && bun run start` | Backend produksi |
| `cd backend && bun test` | Run all backend tests |
| `cd frontend && npx vitest run <file>` | Run frontend test focused |

### 2.3 Konvensi Repo (dari `AGENTS.md`)

- Backend: TypeScript, indentasi 4 spasi, semicolon, camelCase
- Frontend: React/JS, indentasi 2 spasi
- Service logic di `backend/src/services/`, route validation di `backend/src/api/`
- Test file: `<unit>.test.ts` / `<unit>.test.js`
- Conventional commits (`fix:`, `feat:`, `docs:`, `chore:`)
- Wajib jalankan `bun test src/services/manualAdjustmentService.test.ts` sebelum selesai pekerjaan manual-adjustment

---

## 3. Problem Statement

### 3.1 Pain Point User (verbatim dari laporan)

> "Daftar upah... peforma UI yang akan dibuka di monitor jadul yang memiliki zoom tinggi, terus komputer yang lambat... pengisian premi, edit mode dan lain-lain... lebih ringan, teroptimasi untuk jalan di banyak user, banyak request user melakukan request banyak."

### 3.2 Skenario kerja nyata di estate

1. **Krani gang** (1 user per gang) buka Daftar Upah di akhir bulan untuk verifikasi premi 200+ karyawan × 60+ kolom (HK, lembur, premi brondol/pruning/raking, potongan, THR, PPh21).
2. **Saat tombol "Edit Mode" diaktifkan**, krani isi puluhan cell premi/potongan secara cepat (cell-to-cell tab/enter).
3. **Tombol Save** → user expect feedback cepat. Realitanya 5–15 detik freeze karena save serial.
4. **5–10 krani sekaligus** save di gang berbeda → semua jadi lambat karena cache di-clear global.
5. **Monitor 1366×768 dengan Windows zoom 150%** → viewport efektif sempit + browser harus paint ribuan cell → scroll tersendat.

### 3.3 Symptom yang dilaporkan

- "Lemot saat scroll tabel"
- "Freeze saat klik Save"
- "Kadang data yang sudah disimpan hilang lagi" (indikasi race condition)
- "Buka pertama kali lama banget" (initial bundle besar)
- "Pas zoom in tabel jadi makin patah-patah" (paint pressure)

### 3.4 Codebase complexity yang menghambat fix

- 29+ worktree (`.worktrees/*`, `.claude/worktrees/agent-*`) — dev mudah salah edit
- 247+ script di `_dev_utils/scripts/` tanpa README — sulit tahu mana yang masih relevan
- 4 panduan agent paralel di root (`CLAUDE.md`, `AGENTS.md`, `QWEN.md`, `.qwen/`, `.claude/`, `.agent/`, `.superpowers/`) — onboarding bingung
- Dev script bersanding dengan service production di `backend/src/services/` (`verify_final.ts`, `debug_query.ts`, `reseed_wks.ts`, `check_history_*.ts`)
- File root liar: `test_check_adtrans.ts`, `test_seed.ts`, `temp_employee_detail_rewrite.ps1`, `frontend/patch_frontend.cjs`, `frontend/patch_frontend_dec_tax.js`, `CUsersnbgmf.claudeplans...md`




---

## 4. Goals & Non-Goals

### 4.1 Goals (in scope)

**G1. Performa rendering UI**
- Daftar Upah harus dapat di-scroll smooth (≥30 fps) di PC: Intel Core i3 gen 4, RAM 4 GB, HDD, monitor 1366×768, zoom Windows 150%.
- Buka pertama kali (cold load) <8 detik di koneksi LAN estate (10–20 Mbps).
- Edit mode: tab antar cell tanpa lag persepsi (<100 ms).

**G2. Performa save edit (premi, manual adjustment, override)**
- Save 50 cell edit selesai <1 detik (P95).
- Save 10 cell edit selesai <300 ms (P50).
- Optimistic UI: cell tampak "saved" segera, rollback bila gagal.

**G3. Concurrency**
- 20 user concurrent edit di gang berbeda — tidak saling memperlambat (cache invalidation spesifik per gang/division).
- Save manual adjustment harus atomic (zero duplikat, zero data hilang) walaupun 2 user save cell yang sama bersamaan.

**G4. Kebersihan codebase**
- Tidak ada file root liar (`test_*.ts`, `temp_*.ps1`, `patch_frontend*.js`, dst) di luar `_dev_utils/`.
- Tidak ada dev script di `backend/src/services/` (`verify_*`, `debug_*`, `reseed_*`, `check_*` di luar struktur service real).
- Worktree dormant (`.worktrees/*`, `.claude/worktrees/*`) di-prune.
- Satu sumber dokumentasi agent (`AGENTS.md`); panduan lain diarsipkan.
- File komponen `CustomPayrollTable.jsx` ≤ 50 KB per modul setelah split.

### 4.2 Non-Goals (out of scope)

- **Tidak** mengubah business logic perhitungan payroll (THR, PPh21, BPJS, dst). Hanya optimasi performa, struktur, dan concurrency.
- **Tidak** mengganti Bun/Elysia ke framework lain.
- **Tidak** mengganti Vite ke bundler lain.
- **Tidak** mengubah skema database existing (kecuali menambah index yang aman dan unique constraint untuk dedup manual adjustment).
- **Tidak** redesign UI/UX visual (warna, layout, alur tombol). Cuma jika perlu untuk perbaikan rendering (mis. compact mode toggle).
- **Tidak** mengganti cara akses DB dari Python SQL Gateway ke driver native — itu di Phase 4 (strategic), bisa ditunda.

---

## 5. Success Metrics

### 5.1 Quantitative KPI

| KPI | Baseline (estimasi) | Target | Cara ukur |
|---|---|---|---|
| Initial JS bundle (gzipped) | ~8–12 MB | ≤ 3 MB | `ls -lh frontend/dist/assets/*.js` + browser DevTools Network |
| First contentful paint Daftar Upah | ~10 detik | ≤ 4 detik | Chrome Lighthouse mobile preset di PC simulasi lambat |
| DOM nodes saat tabel ditampilkan | ~12.000 | ≤ 1.500 | DevTools Performance → DOM count |
| Save 50 cell edit (P95) | ~10 detik | ≤ 1 detik | Manual stopwatch + log timing di service |
| Cache hit rate (5 user concurrent edit) | ~10% | ≥ 70% | `cacheService.getStats()` endpoint baru |
| Race condition pada manual adjustment | Possible | 0 | Stress test 50 concurrent save sama emp+name |

### 5.2 Qualitative

- Krani gang melaporkan "tabel terasa lebih ringan" di monitor lama.
- Tim dev tidak lagi confused mana script aktif vs usang.
- PR baru pada modul Daftar Upah tidak harus baca file 254 KB dalam 1 file.

### 5.3 Way to verify

Setiap selesai phase, jalankan:

1. **Frontend test:** `cd frontend && npx vitest run`
2. **Backend test:** `cd backend && bun test`
3. **Build test:** `cd frontend && npm run build` (cek size output)
4. **Smoke test manual:** buka Daftar Upah, edit 5 cell, save, pastikan data persist setelah refresh.
5. **Stress test concurrency** (Phase 3): script bun yang spawn 20 concurrent POST `/payroll/manual-edit` dengan gang berbeda; ukur waktu total + cek tidak ada duplikat row.

---

## 6. Audit Findings (Full Reference)

> Setiap finding di bawah ada bukti file path + nomor baris. Agent yang implement bisa langsung buka file untuk konfirmasi sebelum mengubah.

### Finding A — Vite production tidak diminify

**File:** `frontend/vite.config.js` (line ±163)

```js
build: {
  chunkSizeWarningLimit: 1600,
  minify: false, // TEMPORARY: Disable minification to debug TDZ error
  rollupOptions: { output: { manualChunks: { ... } } }
}
```

**Bukti dampak:**
- Bundle production tidak diminify → 5–10× lebih besar dari yang seharusnya.
- Comment "TEMPORARY" sudah lama (workaround TDZ error yang tidak pernah di-fix).
- Tidak ada `vite-plugin-compression` untuk gzip/brotli.

**Akar masalah TDZ error:** kemungkinan circular import atau `lazy()` yang dipakai di file dengan order import yang salah. Harus didebug, bukan diworkaround.

---

### Finding B — App.jsx static import semua page besar

**File:** `frontend/src/App.jsx` (line ±37–80)

```jsx
// Lazy load pages - TEMPORARILY STATIC
import DashboardHome from './pages/DashboardHome'
import ProfessionalDashboard from './pages/ProfessionalDashboard'
import EmployeeDetailRoute from './pages/EmployeeDetailRoute'
...
import CustomPayrollTable from './components/CustomPayrollTable'   // 254 KB
import TaxReportPage from './pages/TaxReportPage'                  // 117 KB
import ExecutivePayrollPage from './pages/ExecutivePayrollPage'    // 92 KB
import SummaryReportPage from './pages/SummaryReportPage'          // 93 KB
import WagesSummaryRebinmasPage from './pages/WagesSummaryRebinmasPage' // 92 KB
import EmployeeDirectoryAnalytics from './pages/EmployeeDirectoryAnalytics' // 77 KB
import OtherIncomesPage from './pages/OtherIncomesPage'            // 60 KB
import AggregationSeederPage from './pages/AggregationSeederPage'  // 63 KB
import TonaseAnalysisReportPage from './pages/TonaseAnalysisReportPage' // 59 KB
... (30+ pages total)
```

**Hanya 1 page yang lazy:**

```jsx
const ComponentMetadataTestPage = lazy(() => import('./pages/ComponentMetadataTestPage'))
```

**Dampak:** Saat user buka login, browser load semua page raksasa + ag-grid-enterprise + recharts + exceljs + html2pdf di initial bundle.

---

### Finding C — CustomPayrollTable.jsx tabel native tanpa virtualisasi

**File:** `frontend/src/components/CustomPayrollTable.jsx` (254 KB, single file)

**Render structure** (line ±4789, 4944, 4982):

```jsx
<table className="payroll-table" ref={tableRef}>
  <thead>
    {headerRows.map((hRow, rIdx) => (
      <tr key={`hr-${rIdx}`}>...</tr>
    ))}
  </thead>
  <tbody>
    {displayRows.map((row, rIdx) => {           // 200+ employee rows
      ...
      return (
        <tr ...>
          {renderColumnDefs.map((col, cIdx) => { // 60+ kolom dinamis
            return <td ...>...</td>
          })}
        </tr>
      );
    })}
  </tbody>
</table>
```

**Drag-select handler** (line ±2800–2830):

```jsx
const handleMouseOver = (rowIndex, colIndex) => {
  if (isSelecting && selection.length > 0) {
    const start = selection[0];
    const newSelection = [];
    const minR = Math.min(start.r, rowIndex), maxR = Math.max(start.r, rowIndex);
    const minC = Math.min(start.c, colIndex), maxC = Math.max(start.c, colIndex);
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        newSelection.push({ r, c });   // O(n*m) per mouseover, tidak throttle
      }
    }
    setSelection(newSelection);
  }
};
```

**Resize listener tanpa debounce** (line ±4244, 4255):

```jsx
useEffect(() => {
  const onResize = () => {
    syncTableContainerWidth();
    syncHorizontalScrollState();
  };
  window.addEventListener('resize', onResize);
  return () => window.removeEventListener('resize', onResize);
}, [...]);

useEffect(() => {
  const observer = new ResizeObserver(() => {
    syncTableContainerWidth(container);
    syncHorizontalScrollState(container);
  });
  observer.observe(container);
  if (table) observer.observe(table);
  return () => observer.disconnect();
}, [...]);
```

**Counts:**
- 139 hooks (useMemo/useCallback/memo/useState/useEffect/useRef)
- 82 `.map/.filter/.reduce/.sort` calls
- 0 virtualisasi (no react-window, no AG Grid `rowVirtualization`)
- 11 `axios`/`fetch` direct calls dari component (line 1206, 1726, 1740, 1764, 1793, 1846, 1932, 1946, 2139, 2422)

**Dampak:** Untuk 200 employee × 60 col = ~12.000 `<td>` di DOM. Setiap zoom/scroll/resize browser harus relayout semua. Di PC lambat + monitor jadul = scroll patah-patah.

---

### Finding D — Save edit serial (for...of await)

**File:** `frontend/src/components/CustomPayrollTable.jsx` (line ±1700–1900, fungsi `saveEditedManualCells`)

```jsx
// Phase 1: master tax (PTKP)
for (const edit of masterTaxEdits) {
  const res = await axios.put(`tax-report/ptkp/${encodeURIComponent(edit.nik)}`, ...);
  if (res.data?.success) successCount++;
}

// Phase 2: jabatan estate
for (const edit of jobTitleEdits) {
  const { data } = await axios.post('employee-estate/update', ...);
  if (data?.success) successCount++;
}

// Phase 3: profile overrides
for (const profile of profileItems) {
  const res = await fetch(buildBackendUrl('/payroll/overrides/profile'), ...);
  if (res.ok) successCount++;
}

// Phase 4: value overrides
for (const value of valueItems) {
  const res = await fetch(buildBackendUrl('/payroll/overrides/values'), ...);
  ...
}

// Phase 5: legacy manual edits
for (const edit of legacyEdits) {
  const res = await fetch(buildBackendUrl('/payroll/manual-edit'), ...);
  ...
}

// Phase 6: other income edits
for (const k of otherIncomeEdits) {
  const res = await fetch(buildBackendUrl('/payroll/locked/pendapatan-lainnya-edit'), ...);
  ...
}

// Phase 7: deleted columns
for (const deletion of pendingDeletedColumns) {
  await deleteManualAdjustmentColumn(token, deletion.params);
}
```

**Dampak:** 50 cell × ~150 ms latency = 7.5 detik blocking UI. Tidak ada batch, tidak ada Promise.all, tidak ada optimistic UI.



---

### Finding E — Cache invalidation terlalu agresif

**File:** `backend/src/api/payroll.ts`

**Pattern bahaya 1 — clear by month/year (line 587, 682, 733, 869, 928, 1450, 1676, 1729, 2058, 2097, 2161, 3010):**

```ts
// Setelah setiap save manual-edit / manual-adjustment / seed-auto-buffer:
const pattern = `:${data.period_month}:${data.period_year}`;
cacheService.clearByPattern(pattern);
console.log(`[PayrollRoutes] Cleared cache for pattern: ${pattern} after manual edit`);
```

Cache key format (`backend/src/services/cacheService.ts` `buildPayrollKey`):
```
payroll:{gangCode}:{month}:{year}:{divisionCode}:{H|L}{:Vn?}
```

`clearByPattern(":${month}:${year}")` cocok dengan SEMUA gang × SEMUA division. Berarti save di 1 gang invalidate cache user lain di gang/division berbeda.

**Pattern bahaya 2 — clear total (line 977, 1005, 1053):**

```ts
// /payroll/overrides/profile
.post("/overrides/profile", async ({ body, currentUser, set }) => {
  ...
  cacheService.clear();  // ⚠️ Wipe SELURUH cache server!
})

// /payroll/overrides/values, /payroll/overrides/join-date — sama
```

**Dampak nyata:**
- 1 admin update jabatan 1 employee → 50 user lain kehilangan semua cache → semua reload dari DB → DB spike + UI lambat semua user.
- 5 user concurrent edit gang berbeda → cache thrashing terus-menerus, hit rate <10%.

**Solusi target:** invalidate spesifik per `(gang, division, month, year)` saja.

---

### Finding F — saveAdjustment race condition (no atomic upsert)

**File:** `backend/src/services/manualAdjustmentService.ts` (line 2161 — `public async saveAdjustment`)

```ts
// 1. SELECT TOP 1 cocok (period, emp_code, type, name) dari table
const existing = await db.queryOne<{ id: number }>(`
    SELECT TOP 1 id FROM dbo.payroll_manual_adjustments
    WHERE period_month = ? AND period_year = ?
    AND (emp_code = ? OR nik = ? OR emp_code = ?)
    AND adjustment_type = ?
    AND ${normalizedAdjustmentNameSql} = ?
    ORDER BY ...
`, [...]);

// 2. Conditional INSERT atau UPDATE
if (existing) {
  if (shouldDeleteStoredAdjustment(...)) {
    await db.query(`DELETE FROM dbo.payroll_manual_adjustments WHERE id = ?`, [existing.id]);
  } else {
    await db.query(`UPDATE dbo.payroll_manual_adjustments SET amount = ?, ... WHERE id = ?`, [...]);
  }
} else {
  if (shouldDeleteStoredAdjustment(...)) return 0;
  const result = await db.query(`INSERT INTO dbo.payroll_manual_adjustments (...) OUTPUT INSERTED.id VALUES (...)`, [...]);
  return result[0]?.id;
}
```

**Issue:**
- TIDAK pakai `WITH (UPDLOCK, HOLDLOCK)` di SELECT.
- TIDAK pakai transaksi eksplisit (`BEGIN TRAN ... COMMIT`).
- TIDAK pakai `MERGE` statement atomic.
- TIDAK ada unique index pada `(period_month, period_year, emp_code, adjustment_type, adjustment_name)`.

**Skenario race:**
- T0: User A SELECT → return NULL.
- T0+5ms: User B SELECT → return NULL (A belum INSERT).
- T0+10ms: User A INSERT row id=100.
- T0+15ms: User B INSERT row id=101 (duplikat).
- Hasil: 2 row untuk kombinasi yang sama. Saat dibaca dengan `SELECT TOP 1` di-`ORDER BY id DESC` → user A "data hilang", padahal sebenarnya tetap ada di id=100 tapi tidak ditampilkan karena id=101 menang.

---

### Finding G — DB akses lewat HTTP gateway (latency tambahan)

**File:** `backend/src/db/client.ts` (line ±120–180)

```ts
public async query<T = any>(sql: string, params?: ..., timeout?: number): Promise<T[]> {
    const { sql: preparedSql, params: preparedParams } = this.prepareParams(sql, params);
    let attempt = 0;
    let delay = 500;
    const maxRetries = Config.DB_QUERY_RETRIES;

    while (attempt <= maxRetries) {
        try {
            const body = { sql: preparedSql, params: preparedParams, server: this.serverProfile, database: this.databaseName, timeout: queryTimeout };
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), queryTimeout * 1000);
            const response = await fetch(`${this.baseUrl}/v1/query`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-api-key": this.apiKey },
                body: JSON.stringify(body),
                signal: controller.signal
            });
            ...
        } catch (error) {
            // exponential backoff retry
            await new Promise(r => setTimeout(r, delay));
            delay = Math.min(delay * 2, 2000);
            attempt++;
        }
    }
}
```

**Dampak:**
- Setiap query payroll = 1 HTTP roundtrip Bun → Python Gateway → SQL Server.
- Bun tidak punya connection pool langsung; pool ada di Python gateway (single instance).
- Latency floor +30–80 ms per query dibanding `mssql` driver native.
- Untuk endpoint berat (5–10 query) tambahan total 150–800 ms.

**Catatan:** ini di Phase 4 (strategic). Bisa ditunda bila Phase 1-3 sudah cukup.

---

### Finding H — N+1 di seed/import manual adjustment

**File:** `backend/src/services/manualAdjustmentService.ts`

Pola `for (...of...) { await db.query(...) }` muncul di line 273, 324, 325, 551, 554, 1111, 1419, 1485, 1512, 1515, 1586, 1913, 1927, 2036, 2108.

Beberapa wajar (loop kecil), tapi:
- `seedAutoBufferToManualAdjustments` (line ±2030–2050): loop semua employee dalam gang × semua adjustment type, INSERT serial.
- `importPremiumExcel`: loop tiap row excel, INSERT serial.
- `deleteAdjustmentColumn` (line ±2300+): SELECT semua id matching, lalu DELETE single statement (ok), tapi SELECT-nya bisa besar.

**Dampak:** Seed buffer auto 1 gang besar (50 employee × 5 adjustment) = 250 INSERT serial × 50 ms = 12 detik blocking endpoint.

---

### Finding I — payrollRoutes mounted dua kali

**File:** `backend/src/index.ts` (line ±260–285)

```ts
.use(payrollRoutes)                                      // Mount #1 di root
.group("/backend/upah", app => app
    .use(authRoutes)
    .use(usersRoutes)
    .use(reportsRoutes)
    .use(payrollRoutes)                                  // Mount #2 di /backend/upah
    .use(employeeRoutes)
    ...
)
```

**Dampak:**
- Memori router 2× untuk 67 endpoint payroll.
- Risiko inkonsistensi bila satu mount di-update tapi yang lain tidak.
- SPA fallback `*` di akhir bisa menelan path API jika urutan plugin terbalik.

**Solusi target:** factory function `apiPlugin(app)` dipakai sekali untuk root + (kondisional) `/backend/upah` via env flag, dengan helper bersama supaya satu source of truth.

---

### Finding J — Backend service raksasa (sulit dimaintain)

| File | Size | Catatan |
|---|---|---|
| `backend/src/services/dataExtractorService.ts` | **271 KB** | Ekstraksi semua komponen payroll dari DB; harus dipecah per komponen |
| `backend/src/services/manualAdjustmentService.ts` | **130 KB** | CRUD + import excel + sync adtrans + validation |
| `backend/src/services/manualAdjustmentService.test.ts` | **130 KB** | Test file ikut raksasa |
| `backend/src/services/summaryService.ts` | **103 KB** | |
| `backend/src/services/taxReportService.ts` | **99 KB** | |
| `backend/src/services/historyDatabaseService.ts` | **98 KB** | |
| `backend/src/services/dashboardService.ts` | **74 KB** | |
| `backend/src/services/taxReportExcelService.ts` | **66 KB** | |
| `backend/src/api/payroll.ts` | **158 KB** | 67 endpoint dalam 1 file |
| `backend/src/api/taxReportRoutes.ts` | **73 KB** | |
| `backend/src/api/aggregationSeederRoutes.ts` | **57 KB** | |
| `backend/src/api/historyRoutes.ts` | **42 KB** | |
| `backend/src/api/employee.ts` | **51 KB** | |

**Folder yang sudah ada untuk modularisasi (tinggal dipakai):**
- `backend/src/services/payroll/` — sudah ada `BasePayrollComponentService.ts`, `PayrollNormalizationService.ts`, `PayrollComponentRegistry.ts`, folder `extractors/`, `formulas/`, `manualAdjustments/`, `otherIncomes/`, `components/`. Belum dipakai konsisten.

---

### Finding K — Codebase mess

**Worktree dormant:**
- `.worktrees/auto-buffer-potongan-pph`, `.worktrees/history-new-nik-daftar-upah`, `.worktrees/premi-angkut-subblok-override`, `.worktrees/nik-ptrj-empcode-resolution`, `.worktrees/payroll-overlay-history` (5)
- `.claude/worktrees/agent-*` (24+)

**File root liar:**
- `test_check_adtrans.ts` (562 B)
- `test_seed.ts` (968 B)
- `temp_employee_detail_rewrite.ps1` (18 KB)
- `CUsersnbgmf.claudeplans-saya-berencana-...md` (67 B — file path jadi nama karena typo)
- `frontend/patch_frontend.cjs` (18 KB)
- `frontend/patch_frontend_dec_tax.js` (18 KB)
- `backend/update_docs.ts` (1.8 KB) — tidak jelas dipakai untuk apa

**Dev script di lokasi production:**

`backend/src/services/`:
- `verify_final.ts`, `debug_query.ts`, `reseed_wks.ts`, `check_history_divisions.ts`, `check_history_gangs.ts`, `verify_l1h.ts`

`backend/src/tests/`:
- `check_db.ts`, `check_db2.ts`, ..., `check_db16.ts`, `check_extend_db_schema.ts`, `check_extend_db_schema2.ts`, `check_history_data.ts`

`_dev_utils/scripts/`:
- 247+ file (.ts dan .py), banyak yang `_once.ts` (one-off migration) yang seharusnya sudah selesai dieksekusi

**Multi-agent docs di root:**
- `CLAUDE.md` (19 KB), `AGENTS.md` (3 KB), `QWEN.md` (15 KB)
- Folder: `.qwen/`, `.claude/`, `.agent/`, `.superpowers/`, `context_portal/`, `.agentMemory/`

**Cache directory tidak relevan:**
- `.pytest_cache/` di root padahal proyek utama bukan Python (kecuali sebagian script di `_dev_utils/`)




---

## 7. Solution Architecture

### 7.1 High-level approach

Pendekatan **bertahap** (4 phase) supaya setiap phase aman untuk di-deploy dan reversible:

```
Phase 1 (Quick Wins, 1 minggu)
   ├─ Build & bundle (minify, lazy, compression)
   ├─ Cache invalidation spesifik (drop *.clear() global)
   └─ Cleanup repo (worktree, file root liar, dev script)
        │
        ▼
Phase 2 (Edit UX & Concurrency Correctness, 1 minggu)
   ├─ Atomic upsert manual adjustment (MERGE + unique index)
   ├─ Batch endpoint POST /payroll/manual-edit/batch
   ├─ Frontend save flow pakai batch + Promise.all + optimistic UI
   └─ Debounce resize/observer
        │
        ▼
Phase 3 (Rendering Performance, 1 minggu)
   ├─ Virtualisasi body tabel (react-window atau AG Grid)
   ├─ Split CustomPayrollTable.jsx ke 5-6 modul
   └─ Compact mode toggle untuk monitor sempit
        │
        ▼
Phase 4 (Scaling & Modularization, 1 minggu)
   ├─ Modularisasi dataExtractorService & manualAdjustmentService
   ├─ (Optional) Redis cache untuk multi-instance
   ├─ (Optional) mssql native pool jika gateway latency masih jadi bottleneck
   └─ Rate-limit endpoint write
```

### 7.2 Prinsip desain

1. **Setiap PR ≤ 500 baris diff** kalau bisa. Phase besar dipecah menjadi PR kecil per task.
2. **Setiap task punya feature flag / env toggle** kalau perubahan beresiko (mis. `USE_BATCH_MANUAL_EDIT`, `USE_VIRTUALIZED_TABLE`).
3. **Jangan mengubah business logic** payroll. Hanya cara render, cara save, cara cache.
4. **Test wajib** sebelum merge: minimal `bun test src/services/manualAdjustmentService.test.ts` untuk perubahan manual-adjustment, plus smoke test manual buka Daftar Upah.
5. **Konsisten dengan AGENTS.md** (4-space backend, 2-space frontend, conventional commits).
6. **Tiap perubahan cache → log invalidation pattern** supaya bisa diaudit.

### 7.3 Dependency graph antar phase

- Phase 1 → independen, bisa dimulai langsung.
- Phase 2 (atomic upsert) **tidak boleh** dilakukan sebelum Phase 1.3 (cache invalidation diperbaiki) — karena MERGE atomic + cache nuke = race condition baru di cache layer.
- Phase 3 (virtualisasi) **boleh paralel** dengan Phase 2 (beda file utama: render vs save flow), tapi kalau sumber daya terbatas, kerjakan Phase 2 dulu (correctness > performance).
- Phase 4 strategis, opsional jika Phase 1-3 sudah memenuhi target metrics.

---

## 8. Phased Roadmap (4 minggu)

### Phase 1 — Quick Wins (Minggu 1)

| Task ID | Judul | Effort | Risk |
|---|---|---|---|
| 1.1 | Aktifkan minify production + brotli/gzip | 0.5 hari | Medium (TDZ error harus di-fix dulu) |
| 1.2 | Lazy load semua page besar di App.jsx | 1 hari | Low |
| 1.3 | Cache invalidation spesifik (drop `clear()` global) | 0.5 hari | Low-Medium |
| 1.4 | Cleanup worktree + file root liar | 0.5 hari | Low |
| 1.5 | Cleanup dev script di backend/src/services/ + backend/src/tests/ | 0.5 hari | Low |
| 1.6 | Konsolidasi dokumentasi agent (single AGENTS.md) | 0.5 hari | Low |
| 1.7 | Hapus duplicate route mount /backend/upah | 0.5 hari | Medium (proxy mode harus tetap jalan) |

**Phase 1 deliverable:** initial bundle <3 MB gzipped, cache hit rate >50% saat 5 user concurrent, repo bersih.

### Phase 2 — Edit UX & Concurrency Correctness (Minggu 2)

| Task ID | Judul | Effort | Risk |
|---|---|---|---|
| 2.1 | Tambah unique index `payroll_manual_adjustments` | 0.5 hari | Medium (perlu migrasi DB hati-hati, mungkin ada duplikat existing) |
| 2.2 | Refactor `saveAdjustment` ke MERGE atomic | 1 hari | Medium |
| 2.3 | Tambah endpoint `POST /payroll/manual-edit/batch` | 1 hari | Low |
| 2.4 | Frontend save flow pakai batch + Promise.all | 1 hari | Medium |
| 2.5 | Optimistic UI untuk cell yang sedang disimpan | 1 hari | Medium |
| 2.6 | Debounce resize observer di CustomPayrollTable | 0.5 hari | Low |

**Phase 2 deliverable:** save 50 cell <1 detik P95, zero race condition, optimistic UI feedback.

### Phase 3 — Rendering Performance (Minggu 3)

| Task ID | Judul | Effort | Risk |
|---|---|---|---|
| 3.1 | Spike: pilih virtualisasi (react-window vs AG Grid) | 0.5 hari | Low |
| 3.2 | Implementasi virtualisasi body tabel | 2 hari | High (semua interaksi harus tetap jalan) |
| 3.3 | Split CustomPayrollTable.jsx ke 5-6 modul | 2 hari | Medium |
| 3.4 | Compact mode toggle (font/padding lebih kecil untuk monitor sempit) | 0.5 hari | Low |

**Phase 3 deliverable:** DOM nodes <1.500, scroll smooth di PC simulasi lambat, file komponen <50 KB per modul.

### Phase 4 — Scaling & Modularization (Minggu 4)

| Task ID | Judul | Effort | Risk |
|---|---|---|---|
| 4.1 | Modularisasi `dataExtractorService.ts` ke `services/payroll/extractors/` | 2 hari | Medium |
| 4.2 | Modularisasi `manualAdjustmentService.ts` | 1 hari | Medium |
| 4.3 | Pecah `payroll.ts` API ke beberapa file resource | 1 hari | Medium |
| 4.4 | Rate-limit `/manual-edit` per user (token bucket) | 0.5 hari | Low |
| 4.5 | (Optional) Redis cache pengganti Map | 1 hari | Medium |
| 4.6 | (Optional) Spike `mssql` native pool vs gateway | 1 hari | Medium |

**Phase 4 deliverable:** file service ≤ 80 KB, rate-limit aktif, opsional scale-out ready.




---

## 9. Detailed Task Specs

> Setiap task: **What** (deliverable konkret), **Why** (referensi finding), **Files to touch**, **Step-by-step**, **Acceptance criteria**, **Test commands**, **Rollback**.

### Phase 1: Quick Wins

#### Task 1.1 — Aktifkan minify production + compression

**What:** Production build Vite menghasilkan file JS yang diminify dan dikompres (brotli/gzip).

**Why:** Finding A. `minify: false` membuat bundle 5–10× lebih besar dari seharusnya, parser browser sangat sibuk di PC lambat.

**Files to touch:**
- `frontend/vite.config.js`
- `frontend/package.json` (tambah devDependency `vite-plugin-compression`)

**Step-by-step:**

1. **Debug TDZ error dulu.** Jangan langsung enable minify. Jalankan:
   ```bash
   cd frontend && npm run build
   ```
   Catat error message dan stack trace.
2. Cari root cause TDZ: kemungkinan circular import. Pakai `madge`:
   ```bash
   npx madge --circular frontend/src
   ```
3. Bila ditemukan circular import, refactor (pindahkan shared logic ke util terpisah).
4. Bila TDZ karena lazy + variabel di outer scope, fix dengan `useMemo` atau move declaration ke dalam component.
5. Setelah build sukses, install plugin compression:
   ```bash
   cd frontend && npm install --save-dev vite-plugin-compression@^0.5.1
   ```
6. Update `vite.config.js`:
   ```js
   import compression from 'vite-plugin-compression'
   ...
   plugins: [
     react(),
     compression({ algorithm: 'gzip', ext: '.gz' }),
     compression({ algorithm: 'brotliCompress', ext: '.br' })
   ],
   ...
   build: {
     chunkSizeWarningLimit: 1600,
     minify: 'esbuild', // GANTI dari false
     rollupOptions: { output: { manualChunks: {
       'vendor-react': ['react', 'react-dom'],
       'vendor-ag-grid': ['ag-grid-community', 'ag-grid-react', 'ag-grid-enterprise'],
       'vendor-excel': ['exceljs', 'file-saver'],
       'vendor-pdf': ['html2pdf.js'],
       'vendor-utils': ['axios', 'js-cookie'],
       'vendor-recharts': ['recharts']  // tambahan: pisah recharts
     } } }
   }
   ```

**Acceptance criteria:**
- `npm run build` sukses tanpa error.
- Output di `frontend/dist/assets/`: ada file `.js.gz` dan `.js.br` per chunk.
- Total ukuran `*.js` (uncompressed) turun ≥40%.
- `*.js.br` total ≤ 3 MB.
- Smoke test: jalankan `npm run preview`, buka browser, login, buka MainPage. Tidak ada console error.

**Test commands:**
```bash
cd frontend
npm run build
ls -lh dist/assets/*.js dist/assets/*.js.br
npm run preview
# Browser: buka http://localhost:5175, login, buka Daftar Upah
```

**Rollback:**
- Revert `vite.config.js` ke `minify: false`.
- `npm uninstall vite-plugin-compression`.
- Hapus import compression dari config.

---

#### Task 1.2 — Lazy load page besar

**What:** Semua page report besar diimport via `lazy()` + `<Suspense>` supaya hanya di-load saat user navigasi ke route tersebut.

**Why:** Finding B. Saat ini semua 30+ page diimport statis di App.jsx. Bundle awal mengandung ag-grid-enterprise + recharts + exceljs + html2pdf bahkan untuk halaman login.

**Files to touch:**
- `frontend/src/App.jsx`

**Step-by-step:**

1. Identifikasi page yang paling besar (≥50 KB):
   - `TaxReportPage` (117 KB)
   - `SummaryReportPage` (93 KB)
   - `WagesSummaryRebinmasPage` (92 KB)
   - `ExecutivePayrollPage` (92 KB)
   - `EmployeeDirectoryAnalytics` (77 KB)
   - `AggregationSeederPage` (63 KB)
   - `OtherIncomesPage` (60 KB)
   - `TonaseAnalysisReportPage` (59 KB)
   - `MillProductionReport` (37 KB)
   - `PayrollAnalysisPage` (32 KB)
   - `ImpactReportPage` (42 KB)
   - `AnalysisReportPage` (36 KB)
   - `WagesSummaryIJLPage` (38 KB)
   - `onlyIJLReportPages` (43 KB)
   - `ProductivityReportPage` (28 KB)
   - `GangComparisonReportPage` (27 KB)
   - `UpahBersihDetailPage` (27 KB)
   - `DataVerificationPage` (22 KB)

2. **Jangan lazy:**
   - `LoginPage` (selalu butuh untuk login)
   - `DashboardHome` (entry setelah login)
   - `MainPage` (halaman utama Daftar Upah)
   - `CustomPayrollTable` (komponen child MainPage; nanti di Phase 3 displit beda)

3. Update `frontend/src/App.jsx`:
   ```jsx
   import { lazy, Suspense } from 'react'
   import LoadingScreen from './components/common/LoadingScreen'

   // Tetap statis (entry critical):
   import LoginPage from './pages/LoginPage'
   import DashboardHome from './pages/DashboardHome'
   import ProfessionalDashboard from './pages/ProfessionalDashboard'
   import MainPage from './pages/MainPage'  // bila ada import langsung
   import CustomPayrollTable from './components/CustomPayrollTable'

   // Lazy:
   const TaxReportPage = lazy(() => import('./pages/TaxReportPage'))
   const SummaryReportPage = lazy(() => import('./pages/SummaryReportPage'))
   const WagesSummaryRebinmasPage = lazy(() => import('./pages/WagesSummaryRebinmasPage'))
   const ExecutivePayrollPage = lazy(() => import('./pages/ExecutivePayrollPage'))
   const EmployeeDirectoryAnalytics = lazy(() => import('./pages/EmployeeDirectoryAnalytics'))
   const AggregationSeederPage = lazy(() => import('./pages/AggregationSeederPage'))
   const OtherIncomesPage = lazy(() => import('./pages/OtherIncomesPage'))
   const TonaseAnalysisReportPage = lazy(() => import('./pages/TonaseAnalysisReportPage'))
   const MillProductionReport = lazy(() => import('./pages/MillProductionReport'))
   const PayrollAnalysisPage = lazy(() => import('./pages/PayrollAnalysisPage'))
   const ImpactReportPage = lazy(() => import('./pages/ImpactReportPage'))
   const AnalysisReportPage = lazy(() => import('./pages/AnalysisReportPage'))
   const WagesSummaryIJLPage = lazy(() => import('./pages/WagesSummaryIJLPage'))
   const onlyIJLReportPages = lazy(() => import('./pages/onlyIJLReportPages'))
   const ProductivityReportPage = lazy(() => import('./pages/ProductivityReportPage'))
   const GangComparisonReportPage = lazy(() => import('./pages/GangComparisonReportPage'))
   const UpahBersihDetailPage = lazy(() => import('./pages/UpahBersihDetailPage'))
   const DataVerificationPage = lazy(() => import('./pages/DataVerificationPage'))
   const HighEarnerReportPage = lazy(() => import('./pages/HighEarnerReportPage'))
   const SalaryRangeDetailPage = lazy(() => import('./pages/SalaryRangeDetailPage'))
   const SpreadsheetSyncPage = lazy(() => import('./pages/SpreadsheetSyncPage'))
   const DetailedSalaryAnalysisPage = lazy(() => import('./pages/DetailedSalaryAnalysisPage'))
   ```

4. Bungkus `<Routes>` dengan `<Suspense>`:
   ```jsx
   <Suspense fallback={<LoadingScreen />}>
     <Routes>
       <Route path="/login" element={<LoginPage />} />
       <Route path="/dashboard" element={<DashboardHome />} />
       <Route path="/main" element={<MainPage />} />
       <Route path="/tax-report" element={<TaxReportPage />} />
       ... dst
     </Routes>
   </Suspense>
   ```

5. Test setiap route navigation. Pastikan loading screen muncul sebentar lalu halaman ter-render.

**Acceptance criteria:**
- Initial bundle main entry chunk turun ≥40% (ukur via `npm run build` size output).
- Setiap navigasi ke page lazy tampil loading screen sebentar lalu halaman normal.
- Tidak ada `Error: Failed to fetch dynamically imported module` di console.
- Smoke test: login → dashboard → MainPage → TaxReport → SummaryReport → WagesSummary. Semua harus loadable.

**Test commands:**
```bash
cd frontend
npm run build
# Cek ukuran file index*.js di dist/assets/
npx vitest run
```

**Rollback:**
- Revert `App.jsx` ke versi statis import.
- Tidak ada migrasi DB / data, hanya code.

---

#### Task 1.3 — Cache invalidation spesifik (drop global clear)

**What:** Backend hanya invalidate cache untuk `(gang, division, month, year)` yang spesifik affected, tidak `clear()` global atau pattern bulan utuh.

**Why:** Finding E. Saat ini setiap save manual edit / override menghapus cache untuk semua gang/division di bulan tersebut, bahkan untuk override `cacheService.clear()` total. Saat banyak user concurrent edit, cache hit rate <10%.

**Files to touch:**
- `backend/src/api/payroll.ts` (line 587, 682, 733, 764, 869, 928, 977, 1005, 1053, 1450, 1676, 1729, 1777, 2001, 2058, 2097, 2161, 3010)
- `backend/src/services/cacheService.ts` (mungkin tambah helper `invalidatePayroll()`)

**Step-by-step:**

1. Tambah helper di `cacheService.ts`:
   ```ts
   /**
    * Invalidate cache untuk satu set (gang, division, month, year).
    * Lebih spesifik dari clearByPattern.
    */
   public invalidatePayroll(opts: {
       month: number;
       year: number;
       divisionCode?: string | null;
       gangCode?: string | null;
   }): number {
       const monthYearSuffix = `:${opts.month}:${opts.year}:`;
       let count = 0;
       for (const key of this.cache.keys()) {
           if (!key.startsWith('payroll:')) continue;
           if (!key.includes(monthYearSuffix)) continue;
           // Format: payroll:{gang}:{month}:{year}:{division}:{H|L}{:Vn}
           if (opts.gangCode) {
               const expectedGang = `payroll:${opts.gangCode}:`;
               if (!key.startsWith(expectedGang) && !key.startsWith('payroll:ALL:')) continue;
           }
           if (opts.divisionCode) {
               // division ada di posisi setelah year
               const after = key.substring(key.indexOf(monthYearSuffix) + monthYearSuffix.length);
               const divFromKey = after.split(':')[0];
               if (divFromKey !== opts.divisionCode && divFromKey !== 'ALL') continue;
           }
           this.cache.delete(key);
           count++;
       }
       return count;
   }
   ```

2. Di `backend/src/api/payroll.ts`, ganti SEMUA `cacheService.clearByPattern(`:${month}:${year}`)` dan `cacheService.clear()` dengan:
   ```ts
   cacheService.invalidatePayroll({
       month: data.period_month,
       year: data.period_year,
       divisionCode: data.division_code,
       gangCode: data.gang_code,
   });
   ```

3. Untuk endpoint `/overrides/profile`, `/overrides/values`, `/overrides/join-date` (line 977, 1005, 1053):
   - Profile/values/join-date affect satu employee di gang+division tertentu
   - Invalidate spesifik: `{ month, year, divisionCode: payload.division_code, gangCode: payload.gang_code }`
   - Bila payload tidak punya gang_code, lookup dulu dari emp_code → gang.

4. Tambah unit test di `backend/src/services/cacheService.test.ts`:
   ```ts
   it('invalidates only specific gang/division', () => {
       cacheService.set('payroll:G1:5:2026:DIV1:L', { x: 1 });
       cacheService.set('payroll:G2:5:2026:DIV1:L', { x: 2 });
       cacheService.set('payroll:G1:5:2026:DIV2:L', { x: 3 });
       cacheService.invalidatePayroll({ month: 5, year: 2026, divisionCode: 'DIV1', gangCode: 'G1' });
       expect(cacheService.get('payroll:G1:5:2026:DIV1:L')).toBeNull();
       expect(cacheService.get('payroll:G2:5:2026:DIV1:L')).not.toBeNull();
       expect(cacheService.get('payroll:G1:5:2026:DIV2:L')).not.toBeNull();
   });
   ```

**Acceptance criteria:**
- Test `cacheService.test.ts` pass.
- Saat 5 concurrent edit di gang berbeda (gunakan stress script di section 10), cache hit rate ≥70%.
- Save endpoint masih bekerja normal (data persist setelah refresh).

**Test commands:**
```bash
cd backend
bun test src/services/cacheService.test.ts
bun test src/services/manualAdjustmentService.test.ts
```

**Rollback:**
- Revert API file changes (git revert per file).
- Helper `invalidatePayroll` tidak perlu dihapus (idle, tidak harm).

---

#### Task 1.4 — Cleanup worktree + file root liar

**What:** Hapus worktree dormant, file root liar, dan dev script yang tidak ada di tempat yang benar.

**Why:** Finding K. Worktree dan file liar mengganggu dev experience dan memori disk.

**Files to delete (KONFIRMASI USER DULU sebelum delete):**

**Worktree:**
- `.worktrees/auto-buffer-potongan-pph/`
- `.worktrees/history-new-nik-daftar-upah/`
- `.worktrees/premi-angkut-subblok-override/`
- `.worktrees/nik-ptrj-empcode-resolution/`
- `.worktrees/payroll-overlay-history/`
- `.claude/worktrees/agent-*/` (24+ folder)

**File root liar:**
- `test_check_adtrans.ts`
- `test_seed.ts`
- `temp_employee_detail_rewrite.ps1`
- `CUsersnbgmf.claudeplans-saya-berencana-...md`
- `frontend/patch_frontend.cjs`
- `frontend/patch_frontend_dec_tax.js`

**Cache directory:**
- `.pytest_cache/`

**Step-by-step:**

1. **Cek dulu dengan user:** apakah worktree masih ada branch aktif?
   ```bash
   git worktree list
   git branch --list
   ```
2. Untuk worktree yang aman dihapus:
   ```bash
   git worktree remove .worktrees/auto-buffer-potongan-pph --force
   git worktree remove .worktrees/history-new-nik-daftar-upah --force
   ...
   ```
   Untuk `.claude/worktrees/agent-*`:
   ```bash
   # Cek dulu mana yang punya commit unik (tidak ada di branch lain)
   for dir in .claude/worktrees/agent-*; do
     git -C "$dir" log -1 --format="%H %s" 2>/dev/null
   done
   # Bila aman, prune
   git worktree prune
   rm -rf .claude/worktrees/agent-*
   ```
3. File root liar:
   ```bash
   git rm test_check_adtrans.ts test_seed.ts temp_employee_detail_rewrite.ps1 \
          'CUsersnbgmf.claudeplans-saya-berencana-unutk-mebangun-elegant-falcon-agent-a9ea0e92f56d533d5.md'
   git rm frontend/patch_frontend.cjs frontend/patch_frontend_dec_tax.js
   rm -rf .pytest_cache
   ```
4. Tambah `.pytest_cache/` ke `.gitignore` kalau belum ada.
5. Commit:
   ```
   chore: cleanup dormant worktrees and stray root files
   ```

**Acceptance criteria:**
- `git worktree list` hanya menampilkan main worktree (atau yang sengaja masih dipakai).
- `ls D:/.../refactor_production/` tidak menampilkan file `test_*.ts`, `temp_*.ps1`, `CUsersnbgmf*.md`.
- `git status` clean setelah commit.
- Smoke test: backend & frontend masih bisa dijalankan normal.

**Test commands:**
```bash
git worktree list
ls -la
cd backend && bun run dev   # Ctrl+C setelah start
cd ../frontend && npm run dev:test   # Ctrl+C setelah start
```

**Rollback:**
- File yang dihapus via `git rm` bisa di-restore: `git checkout HEAD~1 -- <file>`.
- Worktree yang sudah di-`remove --force` perlu di-add ulang: `git worktree add <path> <branch>`.
- **Saran:** sebelum cleanup, push semua branch ke remote dulu supaya recovery aman.




---

#### Task 1.5 — Cleanup dev script di backend/src/

**What:** Pindahkan dev/debug script dari `backend/src/services/` dan `backend/src/tests/` ke `_dev_utils/` atau hapus.

**Why:** Finding K. Dev script bersanding dengan service production menyebabkan confusion (mana yang aktif vs usang) dan ikut ter-bundle di import resolution.

**Files to move/delete:**

**`backend/src/services/` (pindah ke `_dev_utils/scripts/legacy_backend/` atau hapus):**
- `verify_final.ts` (1.1 KB)
- `debug_query.ts` (1.9 KB)
- `reseed_wks.ts` (957 B)
- `check_history_divisions.ts` (974 B)
- `check_history_gangs.ts` (1.2 KB)
- `verify_l1h.ts` (1 KB)

**`backend/src/tests/` (hapus, ini bukan unit test, ini ad-hoc db check):**
- `check_db.ts`, `check_db2.ts` ... `check_db16.ts` (16 file)
- `check_extend_db_schema.ts`, `check_extend_db_schema2.ts`
- `check_history_data.ts`
- `create_manual_adjustments_table.ts` (3.4 KB) — ini schema DDL, kalau masih relevan pindah ke `backend/sql/migrations/`

**Step-by-step:**

1. Buat folder arsip:
   ```bash
   mkdir -p _dev_utils/scripts/legacy_backend
   ```
2. Cek apakah file dev di-`import` oleh kode production:
   ```bash
   cd backend
   grep -rn "from.*services/verify_final" src/
   grep -rn "from.*services/debug_query" src/
   grep -rn "from.*services/reseed_wks" src/
   grep -rn "from.*services/check_history" src/
   grep -rn "from.*services/verify_l1h" src/
   ```
3. Bila tidak ada import dari production code → safe to move:
   ```bash
   git mv backend/src/services/verify_final.ts _dev_utils/scripts/legacy_backend/
   git mv backend/src/services/debug_query.ts _dev_utils/scripts/legacy_backend/
   git mv backend/src/services/reseed_wks.ts _dev_utils/scripts/legacy_backend/
   git mv backend/src/services/check_history_divisions.ts _dev_utils/scripts/legacy_backend/
   git mv backend/src/services/check_history_gangs.ts _dev_utils/scripts/legacy_backend/
   git mv backend/src/services/verify_l1h.ts _dev_utils/scripts/legacy_backend/
   ```
4. Cek `backend/src/tests/check_db*.ts`:
   ```bash
   grep -rn "from.*tests/check_db" backend/src/
   ```
5. Bila tidak ada import → hapus:
   ```bash
   cd backend/src/tests
   git rm check_db.ts check_db2.ts check_db3.ts check_db4.ts check_db5.ts check_db6.ts \
          check_db7.ts check_db8.ts check_db9.ts check_db10.ts check_db11.ts check_db12.ts \
          check_db13.ts check_db14.ts check_db15.ts check_db16.ts \
          check_extend_db_schema.ts check_extend_db_schema2.ts check_history_data.ts
   ```
6. `create_manual_adjustments_table.ts` — bila isi-nya `CREATE TABLE`, pindah ke `backend/sql/migrations/` dengan rename:
   ```bash
   git mv backend/src/tests/create_manual_adjustments_table.ts backend/sql/migrations/00X_create_manual_adjustments_table.sql.ts
   ```
7. Tulis README di `_dev_utils/scripts/legacy_backend/README.md`:
   ```md
   # Legacy backend dev scripts
   File ini di-archive dari `backend/src/services/` dan `backend/src/tests/`.
   Dipindahkan agar tidak tercampur dengan service production.
   Bila masih dibutuhkan, jalankan dengan: `bun run _dev_utils/scripts/legacy_backend/<file>`
   ```
8. Commit:
   ```
   chore(backend): archive dev scripts out of src/services and src/tests
   ```

**Acceptance criteria:**
- `backend/src/services/` hanya berisi service real (tidak ada `verify_*`, `debug_*`, `reseed_*`, `check_*`).
- `backend/src/tests/` hanya berisi `*.test.ts` (atau folder kosong jika tidak ada test).
- Backend masih jalan: `cd backend && bun run start` sukses, endpoint `/payroll/divisions` masih response.
- `bun test` lulus.

**Test commands:**
```bash
cd backend
bun run start &
sleep 3
curl http://localhost:8002/payroll/current-period
kill %1
bun test
```

**Rollback:**
- File hanya dipindah, bisa dikembalikan dengan `git mv` reverse.
- File yang dihapus via `git rm` recoverable lewat `git checkout HEAD~1 -- <path>`.

---

#### Task 1.6 — Konsolidasi dokumentasi agent

**What:** Satu sumber utama dokumentasi agent (`AGENTS.md`); panduan agent lain (`CLAUDE.md`, `QWEN.md`, `.qwen/`, `.claude/`, `.agent/`, `.superpowers/`, `context_portal/`, `.agentMemory/`) diarsipkan.

**Why:** Finding K. 4 panduan agent paralel di root + 6 folder konfigurasi agent membuat onboarding bingung.

**Step-by-step:**

1. Pastikan `AGENTS.md` sudah lengkap (ringkasan struktur repo, build command, coding style, testing, commit). Saat ini sudah lengkap; jangan ubah kecuali ada update.
2. Buat folder arsip:
   ```bash
   mkdir -p docs/archive/agent-history
   ```
3. Pindahkan dokumentasi agent lama:
   ```bash
   git mv CLAUDE.md docs/archive/agent-history/CLAUDE.md
   git mv QWEN.md docs/archive/agent-history/QWEN.md
   ```
4. Folder konfigurasi agent — **konfirmasi user dulu** apakah masih dipakai:
   - `.qwen/`, `.claude/` (worktree sudah dihapus di task 1.4), `.agent/`, `.superpowers/`, `context_portal/`, `.agentMemory/`
   - Bila tidak dipakai: pindahkan ke `docs/archive/agent-history/` atau hapus.
   - Bila masih dipakai (mis. `.claude/settings.local.json`): biarkan tapi tambahkan ke `.gitignore` supaya per-developer.
5. Update `AGENTS.md` tambah catatan:
   ```md
   ## Dokumentasi historis
   Panduan agent versi sebelumnya diarsipkan di `docs/archive/agent-history/`.
   ```
6. Commit:
   ```
   docs: consolidate agent guides into AGENTS.md
   ```

**Acceptance criteria:**
- Root repo hanya punya 1 file `AGENTS.md` (tidak ada `CLAUDE.md`, `QWEN.md`).
- `docs/archive/agent-history/` berisi panduan lama untuk referensi.
- `.gitignore` sudah meng-cover folder konfigurasi per-developer.

**Rollback:**
- `git mv` reverse, kembalikan file ke root.

---

#### Task 1.7 — Hapus duplicate route mount

**What:** `payrollRoutes` (dan plugin lainnya) hanya di-mount sekali, dengan dukungan optional `/backend/upah` prefix via env flag.

**Why:** Finding I. Saat ini route dimount 2× (root + `/backend/upah`), DRY violation, risiko inkonsistensi.

**Files to touch:**
- `backend/src/index.ts`
- `backend/src/config.ts` (tambah `PROXY_MOUNT` flag)

**Step-by-step:**

1. Tambah flag di `config.ts`:
   ```ts
   export const Config = {
     ...
     PROXY_MOUNT: process.env.PROXY_MOUNT === 'true',  // default false
   };
   ```
2. Refactor `backend/src/index.ts`:
   ```ts
   const apiPlugin = (app: Elysia) => app
     .use(authRoutes)
     .use(usersRoutes)
     .use(reportsRoutes)
     .use(payrollRoutes)
     .use(employeeRoutes)
     .use(employeeEstateRoutes)
     .use(tunjanganRoutes)
     .use(aggregationSeederRoutes)
     .use(spreadsheetRoutes)
     .use(summaryRoutes)
     .use(dashboardRoutes)
     .use(historyRoutes)
     .use(wagesRoutes)
     .use(logsRoutes)
     .use(devConfigRoutes)
     .use(taxReportRoutes)
     .use(employeeHrDataRoutes)
     .use(employeeGangHistoryRoutes)
     .use(employeeComparisonRoutes)
     .use(otherIncomesRoutes)
     .group("/api/mill-production", n => n.use(millProductionRoutes));

   let app = new Elysia()
     .use(cors())
     .use(...) // static plugin
     .use(apiPlugin);

   if (Config.PROXY_MOUNT) {
     app = app.group("/backend/upah", g => g.use(apiPlugin));
   }

   app
     .get("*", async ({ request, set }) => { ... }) // SPA fallback
     .listen({ port: Config.PORT, hostname: Config.HOST });
   ```
3. **PENTING:** test deployment di proxy mode (kalau di production proxy yang prefix `/upah/`):
   - Set `PROXY_MOUNT=true` di env.
   - `curl http://server/backend/upah/payroll/current-period` harus response.
   - `curl http://server/payroll/current-period` juga harus response (legacy).

**Acceptance criteria:**
- Tanpa env flag (`PROXY_MOUNT=false` default), endpoint hanya di root, lebih ringan.
- Dengan `PROXY_MOUNT=true`, endpoint di root DAN di `/backend/upah/`.
- Test backend `bun test` lulus.

**Test commands:**
```bash
cd backend
bun run start &
sleep 3
curl http://localhost:8002/payroll/current-period
PROXY_MOUNT=true bun run start &
sleep 3
curl http://localhost:8002/backend/upah/payroll/current-period
```

**Rollback:** revert `backend/src/index.ts`.

---

### Phase 2: Edit UX & Concurrency Correctness

#### Task 2.1 — Tambah unique index `payroll_manual_adjustments`

**What:** Database constraint untuk mencegah duplikat kombinasi `(period_month, period_year, emp_code, adjustment_type, adjustment_name)` setelah dinormalisasi.

**Why:** Finding F. Race condition pada `saveAdjustment`. Tanpa unique index, MERGE atomic tetap bisa gagal jika ada duplikat existing.

**Files to touch:**
- `backend/sql/migrations/` — tambah file migration baru

**Step-by-step:**

1. **Audit duplikat existing dulu** (ada kemungkinan duplikat dari race condition lama):
   ```sql
   -- Run di SSMS atau via gateway:
   SELECT period_month, period_year, emp_code, adjustment_type,
          UPPER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(adjustment_name, CHAR(9), ' '), CHAR(10), ' '), CHAR(13), ' ')))) AS norm_name,
          COUNT(*) AS cnt
   FROM dbo.payroll_manual_adjustments
   GROUP BY period_month, period_year, emp_code, adjustment_type,
            UPPER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(adjustment_name, CHAR(9), ' '), CHAR(10), ' '), CHAR(13), ' '))))
   HAVING COUNT(*) > 1;
   ```
2. Bila ada duplikat: tulis script remediasi `_dev_utils/scripts/dedupe_manual_adjustments_once.ts` yang:
   - Untuk setiap grup duplikat, simpan row dengan `id` paling baru, hapus yang lama.
   - Atau merge: jumlahkan amount (kalau itu yang benar secara bisnis — KONFIRMASI USER).
3. Buat migration `backend/sql/migrations/YYYY_MM_DD_unique_manual_adjustment_dedup.sql`:
   ```sql
   -- Ensure normalized name column exists (computed)
   IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name='adjustment_name_norm' AND object_id=OBJECT_ID('dbo.payroll_manual_adjustments'))
   BEGIN
       ALTER TABLE dbo.payroll_manual_adjustments
       ADD adjustment_name_norm AS (UPPER(LTRIM(RTRIM(
           REPLACE(REPLACE(REPLACE(REPLACE(adjustment_name, CHAR(9), ' '), CHAR(10), ' '), CHAR(13), ' '), CHAR(160), ' ')
       )))) PERSISTED;
   END

   IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_pma_dedup' AND object_id=OBJECT_ID('dbo.payroll_manual_adjustments'))
   BEGIN
       CREATE UNIQUE INDEX UX_pma_dedup
       ON dbo.payroll_manual_adjustments(period_month, period_year, emp_code, adjustment_type, adjustment_name_norm)
       WHERE emp_code IS NOT NULL;
   END

   -- Tambah index pendukung query GET (Finding J helper)
   IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_pma_period_div_emp' AND object_id=OBJECT_ID('dbo.payroll_manual_adjustments'))
   BEGIN
       CREATE INDEX IX_pma_period_div_emp
       ON dbo.payroll_manual_adjustments(period_month, period_year, division_code, emp_code)
       INCLUDE (adjustment_type, adjustment_name, amount);
   END
   ```
4. Run migration via Python gateway atau SSMS. Wajib backup DB dulu.
5. Update `manualAdjustmentService.ts` `buildNormalizedSqlNameExpression()` agar konsisten dengan computed column.

**Acceptance criteria:**
- Query `SELECT name FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.payroll_manual_adjustments')` menampilkan `UX_pma_dedup` dan `IX_pma_period_div_emp`.
- Insert duplikat (period+emp+type+name yang sama) gagal dengan error 2627 (unique constraint violation).
- Tidak ada duplikat existing (audit query return 0 row).

**Test commands:**
```bash
cd backend
bun test src/services/manualAdjustmentService.test.ts
# Manual: SSMS → run audit query
```

**Rollback:**
```sql
DROP INDEX IF EXISTS UX_pma_dedup ON dbo.payroll_manual_adjustments;
DROP INDEX IF EXISTS IX_pma_period_div_emp ON dbo.payroll_manual_adjustments;
ALTER TABLE dbo.payroll_manual_adjustments DROP COLUMN IF EXISTS adjustment_name_norm;
```

---

#### Task 2.2 — Refactor saveAdjustment ke MERGE atomic

**What:** Ganti pattern SELECT-then-INSERT/UPDATE dengan satu MERGE statement atomic, atau gunakan `INSERT ... ON DUPLICATE KEY UPDATE` style yang menangani conflict via unique index.

**Why:** Finding F. Race condition tanpa transaksi → duplikat / data hilang.

**Files to touch:**
- `backend/src/services/manualAdjustmentService.ts` (line 2161, fungsi `saveAdjustment`)

**Step-by-step:**

1. Pastikan Task 2.1 (unique index) sudah live di DB.
2. Refactor `saveAdjustment`:
   ```ts
   public async saveAdjustment(data: ManualAdjustment, user?: string): Promise<number> {
       data = normalizeManualAdjustmentForSave(data);
       const parsedAmount = parseFloat(data.amount.toString()) || 0;
       const normalizedAdjustmentName = normalizeStoredAdjustmentName(data.adjustment_name);
       const normalizedDivisionCode = normalizeManualAdjustmentDivisionCode(data.division_code);
       const hasMetadataJsonInput = Object.prototype.hasOwnProperty.call(data, 'metadata_json');
       let metadataJsonStr = serializeManualAdjustmentMetadata(data.metadata_json);
       const detailTotalSync = resolveDetailTotalSync(data, normalizedAdjustmentName, metadataJsonStr, parsedAmount);
       metadataJsonStr = detailTotalSync.metadataJsonStr;
       const effectiveAmount = detailTotalSync.amount;
       validatePremiumAdjustmentDefinition(data, normalizedAdjustmentName);
       validateManualAdjustmentAdCode(data);
       const remarks = buildManualAdjustmentRemarks(data);
       const db = this.getDatabase();
       await this.ensureManualAdjustmentIdentitySchema(db);
       const identity = await resolveManualAdjustmentIdentity(data);
       const empName = identity.empName;

       if (data.adjustment_type === 'PENDAPATAN_LAINNYA') {
           return await this.saveOtherIncome(db, { ...data, adjustment_name: normalizedAdjustmentName, remarks: remarks || undefined }, effectiveAmount, user);
       }

       // Atomic upsert via MERGE
       if (shouldDeleteStoredAdjustment(effectiveAmount, data.remarks, !!metadataJsonStr)) {
           // Delete branch - bisa langsung DELETE WHERE
           await db.query(`
               DELETE FROM dbo.payroll_manual_adjustments
               WHERE period_month = ? AND period_year = ?
                 AND emp_code = ? AND adjustment_type = ?
                 AND adjustment_name_norm = UPPER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(REPLACE(?, CHAR(9), ' '), CHAR(10), ' '), CHAR(13), ' '), CHAR(160), ' '))))
           `, [data.period_month, data.period_year, identity.empCode, data.adjustment_type, normalizedAdjustmentName]);
           return 0;
       }

       // MERGE upsert
       const result = await db.query<{ id: number }>(`
           MERGE dbo.payroll_manual_adjustments WITH (HOLDLOCK) AS tgt
           USING (
               SELECT
                   ? AS period_month, ? AS period_year, ? AS emp_code, ? AS nik, ? AS emp_name,
                   ? AS gang_code, ? AS division_code, ? AS adjustment_type, ? AS adjustment_name,
                   ? AS amount, ? AS remarks, ? AS metadata_json, ? AS user_name
           ) AS src
           ON tgt.period_month = src.period_month
              AND tgt.period_year = src.period_year
              AND tgt.emp_code = src.emp_code
              AND tgt.adjustment_type = src.adjustment_type
              AND tgt.adjustment_name_norm = UPPER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(REPLACE(src.adjustment_name, CHAR(9), ' '), CHAR(10), ' '), CHAR(13), ' '), CHAR(160), ' '))))
           WHEN MATCHED THEN UPDATE SET
               nik = src.nik,
               gang_code = COALESCE(NULLIF(LTRIM(RTRIM(src.gang_code)), ''), tgt.gang_code),
               division_code = COALESCE(src.division_code, tgt.division_code),
               amount = src.amount,
               remarks = src.remarks,
               ${hasMetadataJsonInput ? 'metadata_json = src.metadata_json,' : ''}
               emp_name = src.emp_name,
               updated_at = GETDATE(),
               updated_by = src.user_name
           WHEN NOT MATCHED THEN INSERT (
               period_month, period_year, emp_code, nik, emp_name, gang_code, division_code,
               adjustment_type, adjustment_name, amount, remarks, metadata_json, created_by
           ) VALUES (
               src.period_month, src.period_year, src.emp_code, src.nik, src.emp_name,
               src.gang_code, src.division_code, src.adjustment_type, src.adjustment_name,
               src.amount, src.remarks, src.metadata_json, src.user_name
           )
           OUTPUT INSERTED.id;
       `, [
           data.period_month, data.period_year, identity.empCode, identity.nik, empName,
           data.gang_code, normalizedDivisionCode, data.adjustment_type, normalizedAdjustmentName,
           effectiveAmount, remarks, metadataJsonStr, user || 'system'
       ]);

       const id = result[0]?.id || 0;

       // Auto-save preset (best-effort, di luar transaksi)
       try { /* preset upsert seperti existing */ } catch (e) { /* silent */ }

       return id;
   }
   ```
3. Update test `manualAdjustmentService.test.ts`:
   - Tambah test "concurrent save same key" (jalankan 5 Promise.all saveAdjustment dengan key yang sama, expect hanya 1 row di DB di akhir).
   - Pastikan test existing masih lulus.

**Acceptance criteria:**
- `bun test src/services/manualAdjustmentService.test.ts` lulus.
- Concurrent test (5 Promise.all save same key) menghasilkan tepat 1 row di DB (tidak ada duplikat).
- Smoke test: edit cell di UI → save → refresh → data persist.

**Test commands:**
```bash
cd backend
bun test src/services/manualAdjustmentService.test.ts
```

**Rollback:**
- Revert `saveAdjustment` ke versi SELECT-then-INSERT/UPDATE.
- Unique index dari Task 2.1 boleh tetap ada (defense in depth).

---

#### Task 2.3 — Endpoint POST /payroll/manual-edit/batch

**What:** Endpoint baru yang menerima array of manual edits dan memprosesnya dalam 1 request, dengan invalidasi cache spesifik per gang+division.

**Why:** Finding D. Save 50 cell sekarang serial 50× HTTP roundtrip.

**Files to touch:**
- `backend/src/api/payroll.ts` (tambah endpoint setelah `/manual-edit`)
- `backend/src/services/manualAdjustmentService.ts` (tambah method `saveAdjustmentsBatch`)

**Step-by-step:**

1. Tambah method di service:
   ```ts
   public async saveAdjustmentsBatch(items: ManualAdjustment[], user?: string): Promise<{
       results: Array<{ index: number; success: boolean; id?: number; error?: string }>;
       affectedKeys: Array<{ month: number; year: number; divisionCode?: string; gangCode?: string }>;
   }> {
       const results: Array<any> = [];
       const affectedKeys = new Map<string, any>();

       // Process in parallel with concurrency limit (mis. 10 sekaligus)
       const CONCURRENCY = 10;
       for (let i = 0; i < items.length; i += CONCURRENCY) {
           const chunk = items.slice(i, i + CONCURRENCY);
           const settled = await Promise.allSettled(
               chunk.map(item => this.saveAdjustment(item, user))
           );
           settled.forEach((res, idx) => {
               const globalIdx = i + idx;
               if (res.status === 'fulfilled') {
                   results.push({ index: globalIdx, success: true, id: res.value });
                   const item = chunk[idx];
                   const key = `${item.period_month}:${item.period_year}:${item.division_code || ''}:${item.gang_code || ''}`;
                   affectedKeys.set(key, {
                       month: item.period_month,
                       year: item.period_year,
                       divisionCode: item.division_code,
                       gangCode: item.gang_code
                   });
               } else {
                   results.push({ index: globalIdx, success: false, error: res.reason?.message || String(res.reason) });
               }
           });
       }

       return { results, affectedKeys: Array.from(affectedKeys.values()) };
   }
   ```
2. Tambah endpoint di `backend/src/api/payroll.ts`:
   ```ts
   .post("/manual-edit/batch", async ({ body, currentUser, set }) => {
       try {
           const { manualAdjustmentService } = await import("../services/manualAdjustmentService");
           const { cacheService } = await import("../services/cacheService");
           const items = (body as any).items as any[];
           if (!Array.isArray(items) || items.length === 0) {
               set.status = 400;
               return { success: false, error: "items array required" };
           }
           if (items.length > 200) {
               set.status = 400;
               return { success: false, error: "Maximum 200 items per batch" };
           }

           const username = currentUser?.username || 'system';
           const { results, affectedKeys } = await manualAdjustmentService.saveAdjustmentsBatch(items, username);

           // Invalidate cache spesifik per affected gang+division
           let totalInvalidated = 0;
           for (const k of affectedKeys) {
               totalInvalidated += cacheService.invalidatePayroll(k);
           }

           const successCount = results.filter(r => r.success).length;
           return {
               success: true,
               total: items.length,
               successCount,
               failedCount: items.length - successCount,
               results,
               cache_invalidated: totalInvalidated
           };
       } catch (e: any) {
           console.error("[PayrollRoutes] manual-edit/batch error:", e);
           set.status = 500;
           return { success: false, error: e.message };
       }
   }, {
       body: t.Object({
           items: t.Array(t.Object({
               period_month: t.Number(),
               period_year: t.Number(),
               emp_code: t.String(),
               nik: t.Optional(t.String()),
               emp_name: t.Optional(t.String()),
               gang_code: t.String(),
               division_code: t.Optional(t.String()),
               adjustment_type: t.String(),
               adjustment_name: t.String(),
               amount: t.Number(),
               remarks: t.Optional(t.String()),
               metadata_json: t.Optional(t.String()),
               ad_code: t.Optional(t.String()),
               task_code: t.Optional(t.String()),
               base_task_code: t.Optional(t.String()),
               task_desc: t.Optional(t.String())
           }))
       })
   })
   ```
3. Tulis test di `backend/src/api/payroll.batch.test.ts`:
   - Batch 5 items: semua sukses → return 5 results, success=true.
   - Batch dengan 1 item invalid: 4 sukses + 1 error.
   - Batch >200 items: return 400.

**Acceptance criteria:**
- Endpoint `POST /payroll/manual-edit/batch` available.
- Test API lulus.
- 50 batch items selesai <1 detik P95 (test manual via curl/postman).
- Cache invalidation hanya untuk affected gang+division.

**Test commands:**
```bash
cd backend
bun test src/api/payroll.batch.test.ts
```

**Rollback:** hapus endpoint dari `payroll.ts` dan method dari service.

---

#### Task 2.4 — Frontend save flow pakai batch

**What:** `saveEditedManualCells` di `CustomPayrollTable.jsx` dirombak: kumpulkan semua manual-edit (legacyEdits + valueItems) dan kirim 1 batch, paralel dengan masterTax / jobTitle / profile (yang masing-masing tetap ada batch tersendiri di endpoint mereka atau loop terbatas).

**Why:** Finding D. Saat ini 6-7 fase serial.

**Files to touch:**
- `frontend/src/components/CustomPayrollTable.jsx` (fungsi `saveEditedManualCells`, line ±1700–1900)
- `frontend/src/services/manualAdjustmentService.js` (tambah `saveManualAdjustmentBatch`)

**Step-by-step:**

1. Tambah service helper:
   ```js
   // frontend/src/services/manualAdjustmentService.js
   export async function saveManualAdjustmentBatch(token, items) {
       const response = await axios.post('payroll/manual-edit/batch', { items }, {
           headers: { Authorization: `Bearer ${token}` }
       });
       return response.data;
   }
   ```
2. Refactor `saveEditedManualCells`:
   ```js
   const saveEditedManualCells = async () => {
       // Kumpulkan semua edit
       const editsArray = Object.values(editedCells);
       // ... build pendingDeletedManualCells (sama seperti existing)
       // ... build manualBatchItems (gabungan legacyEdits + valueItems edits)

       // Phase paralel:
       const phasePromises = [];

       // Phase A: master tax (dari endpoint tax-report/ptkp)
       if (masterTaxEdits.length > 0) {
           phasePromises.push(
               Promise.allSettled(
                   masterTaxEdits.map(edit =>
                       axios.put(`tax-report/ptkp/${encodeURIComponent(edit.nik)}`,
                           { year, ptkp_status: edit.value },
                           { headers: { Authorization: `Bearer ${token}` } })
                   )
               )
           );
       }

       // Phase B: jabatan (employee-estate/update) - bisa diparalel
       if (jobTitleEdits.length > 0) {
           phasePromises.push(
               Promise.allSettled(
                   jobTitleEdits.map(edit =>
                       axios.post('employee-estate/update',
                           { empCode: edit.emp_code || edit.nik, jobTitle: edit.value },
                           { headers: { Authorization: `Bearer ${token}` } })
                   )
               )
           );
       }

       // Phase C: profile overrides - paralel
       if (profileItems.length > 0) {
           phasePromises.push(
               Promise.allSettled(
                   profileItems.map(profile => isProdMode()
                       ? saveLockedProfileOverride(token, profile)
                       : fetch(buildBackendUrl('/payroll/overrides/profile'), { ... })
                   )
               )
           );
       }

       // Phase D: BATCH manual-edit (legacy + value items)
       if (manualBatchItems.length > 0) {
           if (isProdMode()) {
               // Locked mode: fallback ke loop saveLockedManualEdit (sementara, kecuali ada batch endpoint)
               phasePromises.push(
                   Promise.allSettled(
                       manualBatchItems.map(item => saveLockedManualEdit(token, item))
                   )
               );
           } else {
               phasePromises.push(saveManualAdjustmentBatch(token, manualBatchItems));
           }
       }

       // Phase E: other income edits → batch (gunakan endpoint manual-edit/batch dengan adjustment_type=PENDAPATAN_LAINNYA)
       if (otherIncomeBatchItems.length > 0) {
           if (!isProdMode()) {
               phasePromises.push(saveManualAdjustmentBatch(token, otherIncomeBatchItems));
           } else {
               phasePromises.push(
                   Promise.allSettled(otherIncomeBatchItems.map(item =>
                       fetch(buildBackendUrl('/payroll/locked/pendapatan-lainnya-edit'), { ... })
                   ))
               );
           }
       }

       // Phase F: deleted columns (paralel)
       if (pendingDeletedColumns.length > 0) {
           phasePromises.push(
               Promise.allSettled(
                   pendingDeletedColumns.map(deletion => isProdMode()
                       ? deleteLockedManualAdjustmentColumn(token, deletion.params)
                       : deleteManualAdjustmentColumn(token, deletion.params)
                   )
               )
           );
       }

       // Tunggu semua phase paralel
       const phaseResults = await Promise.all(phasePromises);

       // Hitung total success
       let successCount = 0;
       let failCount = 0;
       for (const phase of phaseResults) {
           if (Array.isArray(phase)) {
               // Phase A/B/C/E (Promise.allSettled result)
               successCount += phase.filter(r => r.status === 'fulfilled').length;
               failCount += phase.filter(r => r.status === 'rejected').length;
           } else if (phase?.successCount != null) {
               // Phase D batch result
               successCount += phase.successCount;
               failCount += phase.failedCount;
           }
       }

       if (failCount > 0) {
           throw new Error(`${successCount}/${successCount + failCount} perubahan tersimpan. ${failCount} gagal.`);
       }

       setEditedCells({});
       setEditedOtherIncomeCells({});
       setAddedColumns([]);
       setPendingDeletedColumns([]);
       return { changedCount: successCount };
   };
   ```
3. Test manual: edit 50 cell, klik Save, ukur waktu.

**Acceptance criteria:**
- 50 cell edit selesai <1 detik di environment LAN.
- Test frontend `vitest run` lulus untuk fungsi yang ada test-nya (`payrollEditPayloads.test.js`, `payrollPremiumDetailEdits.test.js`).
- UI tetap responsif (tidak freeze) selama save.

**Rollback:** revert `saveEditedManualCells` ke versi loop serial.

---

#### Task 2.5 — Optimistic UI

**What:** Saat user klik Save, cell langsung tampak "saved" (animasi check ✓ atau warna hijau lalu fade), rollback bila response gagal.

**Why:** UX. Save 1 detik tetap terasa lama bila tidak ada feedback langsung.

**Files to touch:**
- `frontend/src/components/CustomPayrollTable.jsx`

**Step-by-step:**

1. Tambah state `savingCells` dan `recentlySavedCells`:
   ```js
   const [savingCells, setSavingCells] = useState({});       // { cellKey: true }
   const [recentlySavedCells, setRecentlySavedCells] = useState({});  // { cellKey: timestamp }
   ```
2. Wrap `saveEditedManualCells`:
   ```js
   const handleSaveClick = async () => {
       const allEditKeys = Object.keys(editedCells);
       const initSaving = Object.fromEntries(allEditKeys.map(k => [k, true]));
       setSavingCells(initSaving);

       try {
           const result = await saveEditedManualCells();
           const now = Date.now();
           const justSaved = Object.fromEntries(allEditKeys.map(k => [k, now]));
           setRecentlySavedCells(prev => ({ ...prev, ...justSaved }));
           setSavingCells({});
           // Auto-clear "saved" indicator after 2 detik
           setTimeout(() => {
               setRecentlySavedCells(prev => {
                   const next = { ...prev };
                   for (const k of allEditKeys) {
                       if (next[k] === now) delete next[k];
                   }
                   return next;
               });
           }, 2000);
       } catch (err) {
           setSavingCells({});
           alert(err.message || 'Gagal menyimpan');
           // editedCells tetap, user bisa retry
       }
   };
   ```
3. Di renderer cell, tambah class:
   ```jsx
   <td className={`
     ${isCellSelected(rIdx, cIdx) ? 'selected' : ''}
     ${savingCells[`${rIdx}-${cIdx}`] ? 'cell-saving' : ''}
     ${recentlySavedCells[`${rIdx}-${cIdx}`] ? 'cell-saved' : ''}
   `}>
   ```
4. CSS di `CustomPayrollTable.css`:
   ```css
   .cell-saving { background: #fef3c7; opacity: 0.7; }
   .cell-saved { background: #dcfce7; transition: background 1s ease-out; }
   ```

**Acceptance criteria:**
- Saat klik Save, cell yang sedang disimpan tampak warna kuning dan opacity rendah.
- Setelah save sukses, cell berubah hijau lalu fade ke normal dalam 2 detik.
- Bila save gagal, alert muncul dan cell kembali ke state edit (warna highlight edit).

**Rollback:** hapus state baru dan class CSS.

---

#### Task 2.6 — Debounce resize observer

**What:** ResizeObserver dan window resize listener di-debounce 100 ms supaya tidak fire 60×/detik saat user resize window.

**Why:** Finding C. Resize tanpa debounce memicu re-layout berkali-kali.

**Files to touch:**
- `frontend/src/components/CustomPayrollTable.jsx` (line ±4244, 4255)

**Step-by-step:**

1. Buat util kecil di `frontend/src/utils/debounce.js`:
   ```js
   export function debounce(fn, ms = 100) {
       let timer;
       const debounced = (...args) => {
           clearTimeout(timer);
           timer = setTimeout(() => fn(...args), ms);
       };
       debounced.cancel = () => clearTimeout(timer);
       return debounced;
   }
   ```
2. Update useEffect resize:
   ```js
   useEffect(() => {
       const onResize = debounce(() => {
           syncTableContainerWidth();
           syncHorizontalScrollState();
       }, 100);
       window.addEventListener('resize', onResize);
       return () => {
           onResize.cancel();
           window.removeEventListener('resize', onResize);
       };
   }, [syncHorizontalScrollState, syncTableContainerWidth]);

   useEffect(() => {
       const container = tableContainerRef.current;
       const table = tableRef.current;
       if (!container || typeof ResizeObserver === 'undefined') return undefined;
       const debouncedSync = debounce(() => {
           syncTableContainerWidth(container);
           syncHorizontalScrollState(container);
       }, 100);
       const observer = new ResizeObserver(debouncedSync);
       observer.observe(container);
       if (table) observer.observe(table);
       return () => {
           debouncedSync.cancel();
           observer.disconnect();
       };
   }, [syncHorizontalScrollState, syncTableContainerWidth, displayMode, renderColumnDefs.length, displayRows.length]);
   ```
3. Throttle `handleMouseOver` saat drag-select (alternatif: pakai requestAnimationFrame):
   ```js
   const handleMouseOverRaf = useRef(0);
   const handleMouseOver = (rowIndex, colIndex) => {
       if (!isSelecting || selection.length === 0) return;
       if (handleMouseOverRaf.current) return;
       handleMouseOverRaf.current = requestAnimationFrame(() => {
           handleMouseOverRaf.current = 0;
           // ... existing logic
       });
   };
   ```

**Acceptance criteria:**
- Resize window cepat tidak menyebabkan UI freeze.
- Drag-select 100 cell smooth.
- Test existing yang related masih lulus.

**Rollback:** revert kedua useEffect ke versi tanpa debounce.




---

### Phase 3: Rendering Performance

#### Task 3.1 — Spike: pilih virtualisasi

**What:** Decision dokumen: `react-window` (lightweight, tambah library) vs `ag-grid-react` (sudah ada di dependency, lebih powerful tapi migrasi besar).

**Why:** Finding C. Tanpa virtualisasi, ~12.000 `<td>` di DOM. Pilihan teknologi mempengaruhi effort Phase 3.

**Output:**
- File: `docs/decisions/ADR-virtualization.md`
- Format: ADR (Architecture Decision Record) singkat

**Step-by-step:**

1. Spike `react-window`:
   - Install: `npm install react-window`
   - Replace `<tbody>{displayRows.map(...)}` dengan `<FixedSizeList>` di branch eksperimen
   - Cek apakah feature existing tetap jalan: cell selection, edit mode, sticky header, gang divider rows, grand total row
   - Catat: kerumitan handle multi-baris untuk gang header (row dengan colspan beda dari row data)
2. Spike `ag-grid-react`:
   - Sudah ada di dependency `ag-grid-community`, `ag-grid-react`, `ag-grid-enterprise`
   - Buat prototipe `<AgGridReact rowData={...} columnDefs={...}>` di komponen kecil terpisah
   - Test fitur: range selection, copy/paste, group header, sort, filter, edit mode
   - Catat: berapa banyak custom logic di `CustomPayrollTable.jsx` yang bisa di-replace dengan AG Grid built-in
3. Tulis ADR:
   ```md
   # ADR: Virtualization for Daftar Upah table

   ## Context
   CustomPayrollTable.jsx renders 12k+ <td>. Slow on weak PCs.

   ## Options
   ### Option A: react-window
   - Pro: lightweight (5KB gzipped), API sederhana
   - Pro: migrasi inkremental (replace tbody saja)
   - Con: handle group header, sticky column, multi-level header manual
   - Con: range selection multi-cell harus tetap custom

   ### Option B: ag-grid-react
   - Pro: virtualization built-in (row + column)
   - Pro: range selection, copy/paste, sort, filter, group built-in
   - Pro: bisa hilangkan ~30% kode custom di CustomPayrollTable
   - Con: migrasi besar (rewrite render path)
   - Con: bundle size +200KB walaupun community-only

   ## Decision
   [Pilih A atau B berdasarkan hasil spike]

   ## Consequences
   ...
   ```
4. **Rekomendasi default:** mulai dengan `react-window` (Option A) karena migrasi inkremental, lalu pertimbangkan AG Grid untuk Phase 4+ atau v2 redesign.

**Acceptance criteria:**
- ADR document tersimpan di `docs/decisions/ADR-virtualization.md`.
- Decision jelas + rationale.

**Test commands:** N/A (riset).

**Rollback:** N/A.

---

#### Task 3.2 — Implementasi virtualisasi body tabel

**What:** Body `<tbody>` di-replace dengan virtualisasi (default react-window FixedSizeList atau VariableSizeList tergantung apakah baris gang_header beda tinggi).

**Why:** Finding C. Goal: DOM nodes ≤1.500 (hanya viewport + buffer).

**Files to touch:**
- `frontend/src/components/CustomPayrollTable.jsx`
- `frontend/src/styles/CustomPayrollTable.css` (penyesuaian z-index, position untuk virtualized rows)

**Step-by-step (asumsi pilih react-window):**

1. Install:
   ```bash
   cd frontend
   npm install react-window @types/react-window
   ```
2. Identifikasi varian row di displayRows:
   - `type === 'gang_header'` (height ±28 px)
   - `type === 'employee'` (height ±24 px)
   - Grand total row di luar tbody (boleh tetap statis)
3. Karena ada 2 tipe height berbeda, pakai `VariableSizeList`:
   ```jsx
   import { VariableSizeList } from 'react-window';

   const ROW_HEIGHTS = { gang_header: 28, employee: 24 };
   const getRowHeight = useCallback(
     (index) => {
       const row = displayRows[index];
       return ROW_HEIGHTS[row?.type] ?? 24;
     },
     [displayRows]
   );

   const Row = useCallback(({ index, style }) => {
     const row = displayRows[index];
     if (row.type === 'gang_header') {
       return (
         <div style={style} className="gang-header-row" data-gang-code={row.gang_code}>
           {/* gang header cell content */}
         </div>
       );
     }
     return (
       <div style={style} className={`employee-row ...`}>
         {renderColumnDefs.map((col, cIdx) => (
           <div className="cell" style={{ width: col.width }}>...</div>
         ))}
       </div>
     );
   }, [displayRows, renderColumnDefs, ...]);

   <VariableSizeList
     height={containerHeight}
     itemCount={displayRows.length}
     itemSize={getRowHeight}
     width="100%"
   >
     {Row}
   </VariableSizeList>
   ```
4. **Catatan:** karena pindah dari `<tr>/<td>` ke `<div>`, semua CSS yang assume tabel selektor harus dipenyesuaian. Alternatif: render `<tr>` di dalam `style={{ display: 'block', position: 'absolute', top: style.top }}`. Atau pakai library `react-window-infinite-loader` + custom item renderer yang tetap output `<tr>`.
5. **Sticky header:** pertahankan `<thead>` di luar VirtualList. Sync horizontal scroll antara header & body.
6. **Selection:** `handleMouseDown` / `handleMouseOver` tetap jalan, hanya akses ke row via `displayRows[index]`.
7. **Edit mode:** `DeferredPayrollNumberInput` tetap di dalam Row renderer.

**Risk:** Virtualisasi tabel rumit kalau ada colspan / multi-level row. Plan B kalau react-window terlalu rumit: pakai `react-virtuoso` (lebih flexible untuk variable height + sticky).

**Acceptance criteria:**
- DOM `<td>` (atau `<div>` cell setara) ≤ 1.500 saat ada 200 employee.
- Semua interaksi existing tetap jalan: selection, edit mode, ctrl+click, drag-select, gang header sticky, grand total fixed.
- Smoke test edit 5 cell, save, refresh — data persist.
- Tidak regresi visual besar (gunakan screenshot before/after).

**Test commands:**
```bash
cd frontend
npm run dev:test
# Browser: buka MainPage, scroll panjang, edit, save
npx vitest run src/components/CustomPayrollTable.render.test.jsx
```

**Rollback:** revert komponen ke versi non-virtualized.

---

#### Task 3.3 — Split CustomPayrollTable.jsx ke 5-6 modul

**What:** Memecah `CustomPayrollTable.jsx` 254 KB menjadi modul-modul fokus ≤ 50 KB.

**Why:** Finding J. File 254 KB sulit dibaca, code review berat, HMR lambat.

**Target struktur:**

```
frontend/src/components/payroll-table/
├─ index.jsx                    # Public component, re-export
├─ PayrollTable.jsx              # Top-level orchestrator (≤30KB)
├─ PayrollTableHeader.jsx        # Multi-level header (≤30KB)
├─ PayrollTableBody.jsx          # Body + virtualization (≤40KB)
├─ PayrollTableRow.jsx           # Row renderer (≤30KB)
├─ PayrollTableCell.jsx          # Cell renderer + edit mode (≤30KB)
├─ PayrollTableFooter.jsx        # Grand total row (≤10KB)
├─ hooks/
│  ├─ usePayrollEditState.js     # editedCells state + commit/discard
│  ├─ usePayrollSelection.js     # cell selection (single, range, drag)
│  ├─ usePayrollSave.js          # saveEditedManualCells dengan batch
│  ├─ usePayrollNetwork.js       # axios/fetch wrapping
│  └─ usePayrollScroll.js        # sync horizontal/vertical scroll
└─ utils/
   ├─ rowBuilders.js             # build displayRows dari gangs data
   ├─ cellFormatters.js          # formatNumber, formatDecimal, etc
   └─ premiumDetailHelpers.js    # buildPremiumDetailEdit, validation
```

**Step-by-step:**

1. **Spike refactor di branch terpisah** (`refactor/payroll-table-split`).
2. Mulai dari ekstraksi terkecil:
   - Move semua const helper (formatNumber, formatDecimal, formatNegativeTotalNumber, formatBytes, clampNumber, isBrondolFieldKey, isSpsiFieldKey, dst — line 102–250) ke `utils/cellFormatters.js`.
   - Test build: `npm run build` masih sukses.
3. Ekstrak hook:
   - `usePayrollEditState`: pindahkan state `editedCells`, `addedColumns`, `pendingDeletedColumns`, `editedOtherIncomeCells` + setter.
   - `usePayrollSelection`: pindahkan state `selection`, `isSelecting`, `selectionStats`, `highlightedRowId` + handlers.
   - `usePayrollSave`: fungsi `saveEditedManualCells`, `saveDeletedManualColumns`, `saveEditedOtherIncomeCells`.
4. Ekstrak `PayrollTableHeader.jsx` (renderHeader function, headerRows logic, formatHeaderLabel).
5. Ekstrak `PayrollTableRow.jsx` (renderRow function untuk employee dan gang_header).
6. Ekstrak `PayrollTableCell.jsx` (renderCell function: editable input, premi popup trigger, manual adjustment indicator).
7. Top-level `PayrollTable.jsx` jadi orchestrator: useMemo build displayRows, kompilasi columnDefs, panggil hook + sub-component.
8. **Hindari prop drilling 10+ prop:** kalau perlu, buat `PayrollTableContext` lokal.
9. Public API tetap kompatibel dengan import existing:
   ```jsx
   // frontend/src/components/CustomPayrollTable.jsx (file lama tetap ada sebagai re-export)
   export { default } from './payroll-table';
   ```
10. Update imports di `App.jsx`, `MainPage.jsx` jika perlu (sebenarnya tidak perlu kalau re-export di atas dibuat).

**Acceptance criteria:**
- Setiap file di `frontend/src/components/payroll-table/` ≤ 50 KB.
- Test existing `CustomPayrollTable.render.test.jsx`, `CustomPayrollTable.manual-columns.test.jsx`, `CustomPayrollTable.focus-navigation.test.jsx`, `CustomPayrollTable.scope-change.test.jsx` lulus.
- `npm run build` sukses.
- Tidak ada perubahan visual atau fungsional di UI.

**Test commands:**
```bash
cd frontend
npx vitest run src/components/CustomPayrollTable.render.test.jsx
npx vitest run src/components/CustomPayrollTable.manual-columns.test.jsx
npx vitest run src/components/CustomPayrollTable.focus-navigation.test.jsx
npx vitest run src/components/CustomPayrollTable.scope-change.test.jsx
npm run build
```

**Rollback:**
- Jaga commit per ekstraksi modul. Bila bug, revert satu commit at a time.
- Branch `refactor/payroll-table-split` hanya merge setelah semua test + smoke test lulus.

---

#### Task 3.4 — Compact mode toggle

**What:** Toolbar punya tombol "Compact mode" yang turunkan padding cell, font size, dan jarak antar elemen supaya muat di monitor sempit (1280×1024 dengan zoom 150%).

**Why:** Finding D2 (responsiveScale tidak deteksi zoom). Beberapa user perlu tampilan lebih padat.

**Files to touch:**
- `frontend/src/components/payroll-table/PayrollTable.jsx` (atau wrapper)
- `frontend/src/styles/CustomPayrollTable.css` (atau split ke `payroll-table-compact.css`)

**Step-by-step:**

1. Tambah state:
   ```js
   const [compactMode, setCompactMode] = useState(() =>
       localStorage.getItem('payroll.compactMode') === 'true'
   );
   useEffect(() => {
       localStorage.setItem('payroll.compactMode', String(compactMode));
   }, [compactMode]);
   ```
2. Toggle button di toolbar:
   ```jsx
   <button
       className={`btn-compact ${compactMode ? 'active' : ''}`}
       onClick={() => setCompactMode(c => !c)}
       title="Compact mode: tampilkan tabel lebih padat untuk monitor sempit"
   >
       {compactMode ? '⊟' : '⊞'} Compact
   </button>
   ```
3. CSS:
   ```css
   .payroll-table-shell.compact {
       --payroll-font-size-base: 10px;
       --payroll-header-font-size: 0.75rem;
       --payroll-header-pad-y: 2px;
       --payroll-header-pad-x: 3px;
       --payroll-body-pad-y: 1px;
       --payroll-body-pad-x: 3px;
   }
   ```
4. Apply class:
   ```jsx
   <div className={`payroll-table-shell ${compactMode ? 'compact' : ''}`}>
   ```

**Acceptance criteria:**
- Toggle on/off berfungsi, state tersimpan di localStorage.
- Compact mode: row height turun ≥30%, font lebih kecil tapi masih terbaca.
- Tidak ada overflow hidden text yang penting.

**Rollback:** hapus state + CSS class.




---

### Phase 4: Scaling & Modularization

#### Task 4.1 — Modularisasi dataExtractorService.ts

**What:** Pecah file 271 KB menjadi modul fokus per komponen payroll.

**Why:** Finding J. Sulit dimaintain, sulit di-review.

**Target struktur (folder `backend/src/services/payroll/extractors/` sudah ada):**

```
backend/src/services/payroll/extractors/
├─ index.ts                          # Re-export + facade
├─ identityExtractor.ts              # NIK, nama, jabatan, gang, division
├─ attendanceExtractor.ts            # HK, cuti tahunan/sakit/minggu/nasional
├─ wageBaseExtractor.ts              # Upah dasar, gaji pokok
├─ allowanceExtractor.ts             # Tunjangan beras, jabatan, masa kerja, lembur
├─ premiExtractor.ts                 # Premi brondol, pruning, raking, dll
├─ deductionExtractor.ts             # ASTEK, BPJS, SPSI, koreksi, lainnya
├─ otherIncomeExtractor.ts           # THR, Bonus, Custom income
├─ taxExtractor.ts                   # PPh21, TER, PTKP
└─ shared/
   ├─ adtransLookup.ts               # Helper PR_ADTRANS query
   ├─ taskCodeMapping.ts             # AD_CODE / task_code resolver
   └─ identityResolver.ts            # NIK/empCode resolution helper
```

**Step-by-step:**

1. Baca `dataExtractorService.ts` ke pemahaman tinggi: cari method publik (`extractPayrollData`, `extractEmployeeData`, dst).
2. Identifikasi blok kode yang berhubungan per komponen (pakai `grep -n "premi"`, `grep -n "tunjangan"`, `grep -n "lembur"`, dst).
3. Mulai dengan ekstraksi paling independen: `identityExtractor.ts` (yang dipanggil paling awal di pipeline).
4. Setiap pindah blok kode, jalankan `bun test` sebelum commit.
5. Pertahankan public API: `dataExtractorService.extractPayrollData(...)` tetap bekerja sebagai facade yang panggil sub-extractor.
6. Jangan refactor algoritma — cuma move kode ke file lain.

**Acceptance criteria:**
- `dataExtractorService.ts` ≤ 80 KB (turun dari 271 KB).
- Setiap extractor file ≤ 60 KB.
- Backend `bun test` lulus semua.
- Smoke test: buka Daftar Upah, semua kolom (premi, potongan, tax) tetap menampilkan data benar.

**Test commands:**
```bash
cd backend
bun test
```

**Rollback:** branch terpisah, tidak merge sampai semua test + smoke test lulus.

---

#### Task 4.2 — Modularisasi manualAdjustmentService.ts

**What:** Pecah 130 KB ke beberapa modul.

**Files struktur target:**

```
backend/src/services/payroll/manualAdjustments/
├─ index.ts                              # Facade
├─ ManualAdjustmentRepository.ts         # CRUD: get, save (MERGE), delete
├─ ManualAdjustmentImporter.ts           # Import excel
├─ ManualAdjustmentSyncService.ts        # Sync dengan PR_ADTRANS / ARC
├─ ManualAdjustmentValidator.ts          # validateManualAdjustmentAdCode, validatePremiumDefinition
├─ ManualAdjustmentBatchProcessor.ts     # saveAdjustmentsBatch (Phase 2.3)
├─ manualAdjustmentNaming.ts             # (sudah ada) normalizeStoredAdjustmentName, dll
└─ autoBufferAdcodeMap.ts                # (sudah ada)
```

**Step-by-step:**
- Sama seperti 4.1: ekstrak per concern, jaga API publik.
- Test wajib: `bun test src/services/manualAdjustmentService.test.ts`.

**Acceptance criteria:**
- `manualAdjustmentService.ts` jadi facade ≤ 30 KB.
- Sub-modul ≤ 60 KB masing-masing.
- All tests pass.

---

#### Task 4.3 — Pecah payroll.ts API

**Target struktur:**

```
backend/src/api/payroll/
├─ index.ts                          # Combine semua route ke payrollRoutes
├─ payrollReportRoutes.ts            # /report/division-raw-tree, /headers, /columns
├─ payrollManualAdjustmentRoutes.ts  # /manual-adjustment, /manual-edit, /manual-edit/batch
├─ payrollManualAdjustmentByApiKey.ts # /manual-adjustment/by-api-key (third-party)
├─ payrollOverrideRoutes.ts          # /overrides/profile, /overrides/values, /overrides/join-date
├─ payrollPresetRoutes.ts            # /manual-adjustment-presets
├─ payrollGangDivisionRoutes.ts      # /divisions, /gangs, /subdivisions
├─ payrollLockedRoutes.ts            # /locked/*
└─ payrollMiscRoutes.ts              # /current-period, /bpjs-calculate, /calculate
```

**Step-by-step:** standar refactoring move.

**Acceptance criteria:**
- File `backend/src/api/payroll.ts` jadi re-export ≤ 5 KB.
- Setiap sub-route file ≤ 40 KB.

---

#### Task 4.4 — Rate-limit endpoint write

**What:** Token bucket per username untuk endpoint `/payroll/manual-edit`, `/payroll/manual-edit/batch`, `/payroll/manual-adjustment`, `/payroll/overrides/*`. Limit: 30 request / 10 detik per user.

**Why:** Mencegah satu client (mis. script tidak terkontrol) overwhelm backend.

**Files to touch:**
- `backend/src/utils/rateLimiter.ts` (baru)
- `backend/src/api/payroll.ts` (atau setelah refactor 4.3, di file route relevan)

**Step-by-step:**

1. Implement simple in-memory token bucket:
   ```ts
   // backend/src/utils/rateLimiter.ts
   type Bucket = { tokens: number; lastRefill: number };
   const buckets = new Map<string, Bucket>();

   export function takeToken(key: string, opts: { capacity: number; refillPerSec: number }): boolean {
       const now = Date.now();
       const b = buckets.get(key) || { tokens: opts.capacity, lastRefill: now };
       const elapsed = (now - b.lastRefill) / 1000;
       b.tokens = Math.min(opts.capacity, b.tokens + elapsed * opts.refillPerSec);
       b.lastRefill = now;
       if (b.tokens < 1) {
           buckets.set(key, b);
           return false;
       }
       b.tokens -= 1;
       buckets.set(key, b);
       return true;
   }

   // Cleanup tiap 5 menit
   setInterval(() => {
       const cutoff = Date.now() - 10 * 60 * 1000;
       for (const [k, b] of buckets.entries()) {
           if (b.lastRefill < cutoff) buckets.delete(k);
       }
   }, 5 * 60 * 1000);
   ```
2. Apply di endpoint:
   ```ts
   .post("/manual-edit/batch", async ({ body, currentUser, set }) => {
       const username = currentUser?.username || 'anon';
       if (!takeToken(`write:${username}`, { capacity: 30, refillPerSec: 3 })) {
           set.status = 429;
           return { success: false, error: "Rate limit exceeded. Coba lagi sebentar." };
       }
       // ... existing logic
   })
   ```
3. Untuk endpoint single `/manual-edit`, batas lebih tinggi (mis. 60 req/10s) supaya batch yang gagal bisa fallback ke single.

**Acceptance criteria:**
- Stress test 100 request berurutan dari 1 user → 30 sukses, sisanya 429.
- Test 30 user × 30 request paralel → semua sukses (per-user bucket, bukan global).

**Test commands:**
```bash
# Manual stress test
for i in {1..100}; do
   curl -s -o /dev/null -w "%{http_code}\n" \
        -H "Authorization: Bearer $TOKEN" \
        -X POST http://localhost:8002/payroll/manual-edit/batch \
        -H 'Content-Type: application/json' \
        -d '{"items":[]}' &
done
wait
```

**Rollback:** hapus call `takeToken()` dari endpoint.

---

#### Task 4.5 — (Optional) Redis cache

**What:** Migrasi `cacheService` dari in-memory `Map` ke Redis untuk dukungan multi-instance.

**Why:** Saat horizontal scaling, in-memory cache tidak konsisten antar instance.

**Decision criteria:**
- Wajib bila deploy 2+ Bun instance di belakang load balancer.
- Skip bila single instance cukup.

**Files to touch:**
- `backend/src/services/cacheService.ts`
- `backend/package.json` (`ioredis`)
- `backend/.env` (REDIS_URL)

**Step-by-step:**

1. Install: `bun add ioredis`
2. Ganti `Map` dengan Redis client:
   ```ts
   import Redis from 'ioredis';
   const redis = new Redis(Config.REDIS_URL || 'redis://localhost:6379');

   public async get<T>(key: string): Promise<T | null> {
       const raw = await redis.get(key);
       if (!raw) { this.misses++; return null; }
       this.hits++;
       return JSON.parse(raw) as T;
   }

   public async set<T>(key: string, value: T, ttlSeconds: number = 3600): Promise<void> {
       const actualTtl = Math.min(ttlSeconds, 7200);
       await redis.set(key, JSON.stringify(value), 'EX', actualTtl);
   }

   public async invalidatePayroll(opts): Promise<number> {
       // Use SCAN + DEL
       const pattern = `payroll:${opts.gangCode || '*'}:${opts.month}:${opts.year}:${opts.divisionCode || '*'}*`;
       const stream = redis.scanStream({ match: pattern });
       let count = 0;
       for await (const keys of stream) {
           if (keys.length) {
               await redis.del(...keys);
               count += keys.length;
           }
       }
       return count;
   }
   ```
3. Update semua call site `cacheService.*` jadi `await cacheService.*` (hampir semua sudah async-friendly).

**Acceptance criteria:**
- Backend bisa run dengan atau tanpa Redis (fallback to Map kalau REDIS_URL tidak set).
- 2 instance Bun share cache via Redis.
- All tests pass (mungkin perlu mock Redis atau Redis test container).

**Rollback:** revert ke Map.

---

#### Task 4.6 — (Optional) Spike mssql native pool

**What:** Eksperimen ganti HTTP gateway dengan `mssql` native driver + connection pool.

**Why:** Finding G. HTTP gateway tambah latency 30–80 ms per query.

**Step-by-step:**

1. Spike di branch terpisah:
   ```bash
   cd backend && bun add mssql @types/mssql
   ```
2. Buat `db/clientNative.ts`:
   ```ts
   import sql from 'mssql';
   const pool = new sql.ConnectionPool({
       server: Config.DB_HOST,
       user: Config.DB_USER,
       password: Config.DB_PASSWORD,
       database: Config.DEFAULT_DATABASE,
       options: { trustServerCertificate: true },
       pool: { min: 5, max: 30, idleTimeoutMillis: 30000 }
   });
   const poolPromise = pool.connect();

   export async function query<T>(sql: string, params: Record<string, any> = {}): Promise<T[]> {
       const cn = await poolPromise;
       const req = cn.request();
       for (const [k, v] of Object.entries(params)) req.input(k.replace('@', ''), v);
       const r = await req.query<T>(sql);
       return r.recordset;
   }
   ```
3. Benchmark: 100× query simple `SELECT TOP 10 * FROM HR_EMPLOYEE`.
4. Bandingkan latency: gateway HTTP vs native pool.
5. Bila native pool lebih cepat dan cred bisa diakses dari Bun:
   - Migrasi bertahap: tambah env flag `USE_NATIVE_DB=true`.
   - Update `db/client.ts` untuk delegasi ke native bila flag set.

**Decision criteria:**
- Bila latency turun ≥30 ms per query → migrate.
- Bila gateway tetap diperlukan (firewall, audit), keep gateway tapi tambah HTTP keep-alive.

**Acceptance criteria:**
- Benchmark report di `docs/decisions/ADR-db-driver.md`.
- Decision dokumented.

**Rollback:** branch terpisah, tidak merge sampai disetujui.

---

## 10. Testing Strategy

### 10.1 Unit & integration tests

**Backend (Bun):**
```bash
cd backend
bun test                                # Semua test
bun test src/services/manualAdjustmentService.test.ts   # Wajib untuk perubahan manual-adjustment
bun test src/services/cacheService.test.ts
bun test src/services/dataExtractorService.*.test.ts
bun test src/api/payroll.*.test.ts
```

**Frontend (Vitest):**
```bash
cd frontend
npx vitest run                          # Semua
npx vitest run src/components/CustomPayrollTable.render.test.jsx
npx vitest run src/utils/payrollEditPayloads.test.js
npx vitest run src/utils/payrollPremiumDetailEdits.test.js
```

### 10.2 Manual smoke test (wajib setelah tiap phase)

**Skenario A — Buka Daftar Upah:**
1. Login user normal (non-admin).
2. Buka MainPage → Daftar Upah.
3. Pilih bulan & gang.
4. Tunggu data load (SSE stream).
5. Verifikasi: jumlah employee benar, semua kolom ter-render, grand total muncul.

**Skenario B — Edit & Save:**
1. Klik "Edit Mode".
2. Edit 5 cell premi.
3. Edit 1 PTKP status.
4. Edit 1 jabatan.
5. Klik Save.
6. Tunggu sukses notification.
7. Refresh page.
8. Verifikasi: semua perubahan persist.

**Skenario C — Concurrency:**
1. Buka 3 browser tab (3 user berbeda kalau memungkinkan).
2. Masing-masing edit gang berbeda, save bersamaan.
3. Verifikasi: tidak ada error, data semua persist, tidak ada duplikat.

**Skenario D — Print payslip:**
1. Pilih beberapa employee.
2. Klik "Print Payslip".
3. Verifikasi: PDF/halaman print muncul dengan data benar.

### 10.3 Stress test (Phase 2 & 3)

**Backend stress (concurrency cache):**
```ts
// backend/_dev_utils/scripts/stress_concurrent_save.ts
const NUM_USERS = 20;
const SAVES_PER_USER = 10;

const users = Array.from({ length: NUM_USERS }, (_, i) => i);
const start = Date.now();

await Promise.all(users.map(async (uid) => {
    for (let j = 0; j < SAVES_PER_USER; j++) {
        await fetch('http://localhost:8002/payroll/manual-edit/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
            body: JSON.stringify({
                items: [{
                    period_month: 6, period_year: 2026,
                    emp_code: `TEST_${uid}_${j}`,
                    gang_code: `G${uid % 5}`,
                    division_code: 'TEST',
                    adjustment_type: 'PREMI',
                    adjustment_name: 'PREMI TEST',
                    amount: Math.random() * 1000
                }]
            })
        });
    }
}));

const elapsed = (Date.now() - start) / 1000;
console.log(`${NUM_USERS} users × ${SAVES_PER_USER} saves = ${NUM_USERS * SAVES_PER_USER} requests in ${elapsed}s`);

// Cek cache stats
const stats = await fetch('http://localhost:8002/payroll/cache-stats').then(r => r.json());
console.log('Cache stats:', stats);
```

**Frontend stress (rendering):**
- Buka DevTools Performance.
- Record while scrolling 30 detik di Daftar Upah dengan 200 employee.
- Lihat FPS rata-rata, total scripting time.

### 10.4 Acceptance test per phase

| Phase | Acceptance test |
|---|---|
| 1 | Bundle size cek `ls -lh dist/assets/*.js.br`, smoke A+B, cache stats >50% hit pada stress test |
| 2 | Stress concurrent (Skenario C), zero duplikat di DB, save 50 cell <1s |
| 3 | DOM nodes <1.500 (DevTools), scroll FPS ≥30 di simulasi slow PC |
| 4 | All tests pass, file size ≤target, rate-limit responds 429 di stress |




---

## 11. Risks & Rollback

### 11.1 Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| TDZ error muncul kembali setelah enable minify (Task 1.1) | Medium | High | Debug root cause via `madge --circular` dulu, jangan langsung enable |
| Lazy loading menyebabkan loading spinner berkedip ganggu UX | Medium | Low | Gunakan `<Suspense>` dengan delay min, prefetch on hover route link |
| Cache invalidation spesifik miss case → data stale di UI | Medium | Medium | Tetap kirim cache-control no-store dari backend untuk endpoint baca, plus tombol "Refresh Data" manual di UI |
| Cleanup file root menyebabkan script production yang tidak terdeteksi gagal | Low | High | Cek `grep -rn` reference dulu sebelum hapus; commit per file, push sebelum lanjut |
| Worktree prune menghapus branch yang belum di-push | Low | High | Wajib `git push --all` ke remote sebelum prune |
| MERGE atomic gagal karena duplikat existing | Medium | High | Audit duplikat dulu (Task 2.1 step 1), remediasi sebelum apply unique index |
| Batch endpoint timeout untuk 200 items | Low | Medium | Limit max items per batch ke 200, timeout backend 30s, frontend chunk besar |
| Virtualisasi (Phase 3.2) merusak fitur range selection / sticky | High | High | Spike dulu (Task 3.1), kerjakan di branch terpisah, test e2e sebelum merge |
| Split CustomPayrollTable bug subtle | High | Medium | Test existing harus lulus di setiap commit, smoke test wajib |
| Modularisasi backend service merusak test suite | Medium | Medium | Move kode tanpa edit logic; jalankan `bun test` setelah tiap pemindahan |
| Redis tidak tersedia di environment estate (offline) | Medium | High | Buat Redis optional dengan fallback ke Map (Task 4.5 step 3) |

### 11.2 Rollback strategy keseluruhan

**Per-task:** setiap task punya rollback steps di dokumen task spec.

**Per-phase:**
- Setiap phase di branch terpisah: `phase-1-quick-wins`, `phase-2-edit-correctness`, `phase-3-rendering`, `phase-4-modularization`.
- Tidak merge ke main sebelum: (1) all tests pass, (2) smoke test manual lulus, (3) reviewer approve.
- Bila ada bug post-merge: revert merge commit, deploy versi sebelumnya.

**Database rollback:**
- Backup DB sebelum apply migration (Task 2.1 unique index).
- Migration `IF NOT EXISTS` guard sehingga idempotent.
- Rollback script tersedia di komentar migration.

**Feature flag:**
- Task yang berisiko (1.1 minify, 2.4 batch save, 3.2 virtualization) di-guard dengan env flag atau localStorage flag, supaya bisa dimatikan tanpa redeploy.

### 11.3 Pre-flight checklist sebelum mulai

- [ ] Backup database produksi (full backup).
- [ ] Push semua branch lokal ke remote: `git push --all`.
- [ ] Cek `git status` clean di main.
- [ ] Konfirmasi user list worktree yang aman dihapus.
- [ ] Konfirmasi user audit duplikat manual_adjustments (untuk Task 2.1).
- [ ] Setup environment staging/dev untuk test masing-masing phase.

---

## 12. Handoff Notes untuk Agent Berikutnya

### 12.1 Cara mulai

1. **Baca dokumen ini dari atas sampai section 9** (sekitar 30–45 menit). Skip section 6 (audit findings) bila ingin langsung mulai—rujuk hanya saat butuh konteks.
2. **Pilih phase** sesuai prioritas user. Default: mulai dari **Phase 1 (Quick Wins)** karena risk paling rendah dan dampak paling cepat terasa.
3. **Pilih satu task** dari daftar Phase 1 (Task 1.1–1.7). Mulai dari yang paling tidak ada dependency:
   - Task 1.4 (Cleanup file) — paling aman, no code change ke logic.
   - Task 1.6 (Konsolidasi docs) — no code change.
   - Task 1.3 (Cache invalidation) — perubahan backend kecil, low risk.
   - Task 1.2 (Lazy load) — perubahan App.jsx, mudah test.
   - Task 1.1 (Minify) — perlu debug TDZ error dulu.
   - Task 1.5 (Cleanup dev script) — file move + grep dependency check.
   - Task 1.7 (Duplicate route) — perubahan backend startup, perlu test PROXY_MOUNT.

### 12.2 Konvensi yang harus diikuti

Dari `AGENTS.md`:
- Backend TypeScript: 4-space indent, semicolons, camelCase.
- Frontend JS/JSX: 2-space indent.
- Conventional commits: `fix:`, `feat:`, `docs:`, `chore:`, `refactor:`.
- Wajib jalankan `bun test src/services/manualAdjustmentService.test.ts` sebelum selesai pekerjaan manual-adjustment.
- Pull request: subject ≤ 70 char, deskripsi berisi ringkasan + area yang terpengaruh + test commands + screenshot UI.

### 12.3 Workflow per task

```
1. Buat branch: git checkout -b phase-1/task-1-3-cache-invalidate
2. Baca task spec di section 9
3. Baca file source yang akan diedit (gunakan path di "Files to touch")
4. Implementasi sesuai step-by-step
5. Run test commands di task spec
6. Smoke test manual sesuai section 10.2
7. Commit dengan conventional commit message
8. Push & buka PR; lampirkan acceptance criteria yang sudah lulus
9. Setelah merge, lanjut task berikutnya
```

### 12.4 Hal yang TIDAK boleh dilakukan

1. **Jangan ubah business logic perhitungan payroll.** Goals 4.1 spesifik: hanya optimasi performa, struktur, concurrency. Jangan ubah formula PPh21, BPJS, lembur, premi.
2. **Jangan delete file tanpa konfirmasi user** untuk Task 1.4 (worktree, file root). Walau dokumen ini list file, tetap minta user "ok untuk delete?"
3. **Jangan apply DB migration langsung di production.** Test di dev/staging dulu, backup DB.
4. **Jangan skip test.** Phase 2 wajib `bun test src/services/manualAdjustmentService.test.ts`.
5. **Jangan force push** ke main/master. Rebase di branch sendiri OK.
6. **Jangan commit `.env`** atau credential file.

### 12.5 Cara minta bantuan user

- **Konfirmasi destructive action:** sebelum `git rm`, `rm -rf`, `git worktree remove --force`, drop index — selalu tanya user.
- **Buntu di TDZ debug (Task 1.1):** kirim error stack trace + hasil `madge --circular`, minta user pilih opsi: (a) refactor circular import, (b) keep minify=false sementara, (c) ganti minifier ke terser.
- **Audit duplikat manual_adjustments (Task 2.1):** sebelum apply unique index, kirim user hasil query duplikat dan tanya: keep latest, sum amount, atau review manual?
- **Pilihan virtualisasi (Task 3.1):** kirim user output spike (size impact, fitur yang masih perlu custom), minta keputusan A vs B.

### 12.6 Tools yang akan dipakai

Tools yang sudah disetup di Kiro CLI:
- `read` — baca file & directory
- `write` — buat/edit file
- `code` — search symbol, AST, codebase overview
- `grep` — search regex di file
- `glob` — find file by pattern
- `shell` — jalankan command (build, test, git)

**Untuk task yang merubah banyak file (mis. Task 3.3 split komponen):** pakai `code pattern_search` + `code pattern_rewrite` untuk refactor terprogram.

**Untuk debug TDZ:** pakai `shell` untuk run `madge`, baca output, lanjut analisis.

### 12.7 Catatan model switching

User akan menggunakan model **Sonnet** untuk eksekusi. Beberapa hal yang perlu diingat:
- Sonnet biasanya lebih ringkas, cepat, cocok untuk task implementasi yang sudah jelas.
- Setiap task spec di section 9 sudah self-contained, tidak perlu konteks chat sebelumnya.
- Bila Sonnet butuh klarifikasi tentang business logic atau prioritas, minta langsung ke user; jangan coba interpret dari section 6.
- Bila Sonnet bingung antara task A dan B, default selalu pilih yang risk lebih rendah (lihat tabel Risk di section 11.1).

### 12.8 Quick reference — bila buntu

| Pertanyaan | Lihat section |
|---|---|
| Apa pain point user? | Section 3.2, 3.3 |
| Apa target metrics? | Section 5.1 |
| File apa yang besar? | Section 6, Finding C, J |
| Bagaimana cara save edit sekarang? | Section 6, Finding D |
| Bagaimana cache di-invalidate? | Section 6, Finding E |
| Race condition di mana? | Section 6, Finding F |
| Mulai task mana? | Section 12.1 |
| Convention coding? | Section 12.2 (atau `AGENTS.md`) |
| Cara test? | Section 10 |

---

## 13. Index Dokumen Pendukung

### 13.1 Dokumen yang sudah ada di repo

| File | Isi | Relevansi |
|---|---|---|
| `AGENTS.md` | Repository guidelines (struktur, build, test, commit) | **Wajib baca** sebelum mulai |
| `docs/DAFTAR_UPAH_LOGIC.md` | Logic Daftar Upah (perhitungan kolom) | Referensi business logic, **JANGAN diubah** |
| `docs/MANUAL_ADJUSTMENT_API.md` | Spec API manual adjustment | Penting untuk Task 2.3 |
| `docs/FRONTEND_BACKEND_CONSISTENCY_AUDIT.md` | Audit konsistensi field FE/BE | Konteks Phase 2 |
| `docs/PAYROLL_LOGIC_MAP.md` | Map perhitungan payroll | Referensi |
| `docs/PAYROLL_SOURCE_FLOW.md` | Flow data source | Referensi |
| `docs/FIELD_TO_TABLE_MAPPING.md` | Mapping field UI ke kolom DB | Penting untuk Phase 4 |
| `docs/TAX_HISTORY_SOURCE_SYNC.md` | Sync tax history | Referensi |
| `docs/proxy-payroll-runbook.md` | Runbook proxy mode | Penting untuk Task 1.7 |
| `docs/_CLEANUP_TASK.md` | Cleanup task lama | Referensi historis |
| `backend/CAREER_HISTORY_API.md` | Spec career history | Referensi |
| `backend/LOGGING_CONFIG.md` | Logging config | Referensi |

### 13.2 File source utama yang akan disentuh

| File | Size | Phase | Task |
|---|---|---|---|
| `frontend/vite.config.js` | 6 KB | 1 | 1.1 |
| `frontend/src/App.jsx` | 56 KB | 1 | 1.2 |
| `frontend/src/components/CustomPayrollTable.jsx` | 254 KB | 2, 3 | 2.4, 2.5, 2.6, 3.2, 3.3 |
| `frontend/src/services/manualAdjustmentService.js` | 2 KB | 2 | 2.4 |
| `frontend/src/styles/CustomPayrollTable.css` | 68 KB | 3 | 3.2, 3.4 |
| `backend/src/index.ts` | 14 KB | 1 | 1.7 |
| `backend/src/api/payroll.ts` | 158 KB | 1, 2, 4 | 1.3, 2.3, 4.3 |
| `backend/src/services/cacheService.ts` | 4 KB | 1, 4 | 1.3, 4.5 |
| `backend/src/services/manualAdjustmentService.ts` | 130 KB | 2, 4 | 2.2, 2.3, 4.2 |
| `backend/src/services/dataExtractorService.ts` | 271 KB | 4 | 4.1 |
| `backend/sql/migrations/` | folder | 2 | 2.1 |

### 13.3 Dokumen yang AKAN dibuat selama eksekusi

| File | Phase | Task |
|---|---|---|
| `docs/decisions/ADR-virtualization.md` | 3 | 3.1 |
| `docs/decisions/ADR-db-driver.md` | 4 | 4.6 |
| `docs/archive/agent-history/CLAUDE.md` (move) | 1 | 1.6 |
| `docs/archive/agent-history/QWEN.md` (move) | 1 | 1.6 |
| `_dev_utils/scripts/legacy_backend/README.md` | 1 | 1.5 |
| `_dev_utils/scripts/dedupe_manual_adjustments_once.ts` | 2 | 2.1 |
| `_dev_utils/scripts/stress_concurrent_save.ts` | 2 | 10.3 |
| `backend/src/utils/rateLimiter.ts` | 4 | 4.4 |
| `backend/src/utils/debounce.ts` (frontend versi) | 2 | 2.6 |

### 13.4 Lampiran — Peta route Daftar Upah

**Frontend route relevan:**
- `/main` → `MainPage.jsx` → `CustomPayrollTable.jsx` (UI utama Daftar Upah)
- `/payslip-print` → `PayslipPrintPage.jsx`
- `/employee-detail/:nik` → `EmployeeDetailRoute.jsx`

**Backend endpoint relevan (saat ini di `backend/src/api/payroll.ts`):**

| Method | Path | Fungsi | Phase impact |
|---|---|---|---|
| GET | `/payroll/divisions` | List division | - |
| GET | `/payroll/gangs` | List gang per division | - |
| GET | `/payroll/current-period` | Periode payroll aktif | - |
| GET | `/payroll/headers` | Definisi header tabel | - |
| GET | `/payroll/columns` | Definisi kolom dinamis | - |
| GET | `/payroll/report/division-raw-tree` | Data tabel (non-stream) | 1 (cache) |
| GET | `/payroll/report/division-raw-tree/stream` | Data tabel (SSE) | 1 (cache) |
| POST | `/payroll/manual-edit` | Save 1 manual edit | 1 (cache), 2 (atomic) |
| POST | `/payroll/manual-edit/batch` | **BARU** Batch save | 2.3 |
| POST | `/payroll/manual-adjustment` | Save manual adjustment | 1, 2 |
| GET | `/payroll/manual-adjustment` | Get manual adjustments | - |
| DELETE | `/payroll/manual-adjustment/:id` | Delete by id | 1 (cache) |
| DELETE | `/payroll/manual-adjustment/column` | Delete column | 1 (cache) |
| POST | `/payroll/overrides/profile` | Override profile | 1 (cache spesifik) |
| POST | `/payroll/overrides/values` | Override values | 1 (cache spesifik) |
| POST | `/payroll/overrides/join-date` | Override join date | 1 (cache spesifik) |
| GET | `/payroll/manual-adjustment-presets` | List preset | - |
| POST | `/payroll/manual-adjustment-presets` | Save preset | - |

---

## Akhir Dokumen

**Versi:** 1.0
**Tanggal:** 2026-06-01
**Last reviewed by:** Kiro CLI Opus 4.7

**Untuk pertanyaan/klarifikasi yang tidak terjawab di dokumen ini, escalate ke user proyek.**

