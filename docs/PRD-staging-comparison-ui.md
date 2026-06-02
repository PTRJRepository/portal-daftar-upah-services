# PRD — UI Report Detail Matriks: Staging vs DB Plantware

> **Status**: Ready to implement
> **Author**: Plan dihasilkan dari eksplorasi + smoke test live (backend port 8002)
> **Owner**: Pengembang yang menjalankan rencana ini (target: Sonnet)
> **Pre-req doc**: `docs/STAGING_VS_DBPTRJ_MAPPING.md`
> **Versi**: 1.0 — 2026-06-01

---

## 1. Latar Belakang & Tujuan

### 1.1 Konteks
Aplikasi payroll PT Rebinmas Jaya menarik data dari `db_ptrj` (Plantware production DB) untuk menampilkan Daftar Upah. Sebelum masuk ke `db_ptrj`, data berasal dari `staging_PTRJ_iFES_Plantware` (raw scan device). Mapping & verifikasi sudah dibakukan di `docs/STAGING_VS_DBPTRJ_MAPPING.md`.

Backend Elysia `/api/staging/*` (8 endpoint) sudah hidup dan diuji (smoke test 2026-06-01) — sumber data UI siap pakai. Yang belum ada: **UI yang menampilkan komparasi tersebut secara matriks per modul (kehadiran, lembur, brondol)** termasuk meng-expose **anomali ID double** (contoh `LF90439471_01`) yang biasanya disembunyikan dari laporan upah.

### 1.2 Tujuan UI
Menyediakan halaman investigasi `/staging-comparison` di Dashboard yang:
1. Menampilkan **3 matriks komparasi**: Kehadiran, Lembur, Brondol (Loosefruit) — Staging vs DB Plantware.
2. Menampilkan **anomali ID double** (record `PR_LOOSEFRUIT_ARC` yang `DocDate`-nya berisi kode `LF########_##` alih-alih tanggal valid) sebagai kategori discrepancy yang berdiri sendiri — bukan dibuang seperti di laporan payroll.
3. Mendukung drill-down per-tanggal (daily summary) dan per-baris (row-level).
4. Mengikuti konvensi UI yang sudah ada (`DataVerificationPage`, `DbPtrjCompareReportModal`).

### 1.3 Non-Goals
- Tidak menulis ke DB. UI ini read-only investigasi.
- Tidak mereplikasi seluruh fungsi `Report Verifikasi Data` yang sudah ada — fokus hanya komparasi staging vs db_ptrj.
- Tidak mengubah logika perhitungan brondol payroll (filter `CHARINDEX('_', DocDate) = 0` tetap berlaku di laporan upah).

---

## 2. Hasil Eksplorasi & Validasi (sumber kebenaran)

### 2.1 Endpoint backend (sudah ada, sudah diuji)

Base path: `/api/staging` (dimount di `backend/src/index.ts:285,310`).

| # | Method | Path | Query (default) | Hasil smoke test 2026-06-01 |
|---|--------|------|-----------------|----------------------------|
| 1 | GET | `/explore/tables` | — | ✅ 30 tabel |
| 2 | GET | `/explore/table/:name` | `sample=10` | ✅ (tidak diuji ulang) |
| 3 | GET | `/compare/attendance` | `date=2026-05-28&limit=50` | ✅ 5/5=100%, staging=1534, prod=1731 |
| 4 | GET | `/compare/overtime` | `date=2026-05-28&limit=50` | ✅ 4/5=80%, A0001 staging_only |
| 5 | GET | `/compare/loosefruit` | `date=2026-05-28&limit=50` | ✅ 5/5=100%, staging=518, prod=518 |
| 6 | GET | `/compare/daily-attendance` | `month=5&year=2026&top=15` | ✅ |
| 7 | GET | `/compare/daily-overtime` | `month=5&year=2026&top=15` | ✅ |
| 8 | GET | `/compare/daily-loosefruit` | `month=5&year=2026&top=15` | ❌ **BUG**: `Invalid column name 'cnt'` |

Schema response (sudah dikonfirmasi via curl):
```jsonc
// /compare/{attendance|overtime|loosefruit}
{ "success": true, "data": { "rows": [...], "summary": { "match_count", "staging_only", "prod_only", "staging_total", "prod_total", "pct_match" } } }

// /compare/daily-{attendance|overtime|loosefruit}
{ "success": true, "data": [ { "date", "staging", "prod_taskreg", "prod_arc" }, ... ] }
```

Field tiap row (contoh attendance):
```jsonc
{ "emp_code": "A0001", "job_code": "PM0110", "trans_date": "2026-05-28",
  "staging_trx": 1, "prod_found": true, "prod_task_code": "PM0110P1A",
  "prod_hours": 7, "prod_ot": false }
```

### 2.2 Pola ID Double `LF########_##` — Penemuan Kritis

**Lokasi pola**: kolom `DocDate` (BUKAN `DocNo`/`DocID`) di tabel `PR_LOOSEFRUIT_ARC` di `db_ptrj`.

**Bukti di codebase**:
- `backend/src/services/reportService.ts:186` — comment: `Filter out ID codes like LF50317375_01, only use real dates`
- `backend/query/Tunjangan/get_brondol_amount.sql:8` — filter aktif: `AND CHARINDEX('_', LF.DocDate) = 0`

**Implikasi untuk laporan upah** (existing): record dengan pola `LF########_##` di-EXCLUDE supaya tidak ikut perhitungan brondol.

**Implikasi untuk UI komparasi** (PRD ini): record-record itu justru harus DI-INCLUDE dengan flag visual karena:
- Mereka adalah baris valid yang ada di staging tapi tampil "missing" di payroll.
- Mereka adalah sumber utama selisih `staging_total` vs `prod_total` di modul brondol.
- User butuh tahu eksistensinya untuk audit data integrity.

### 2.3 Bug yang harus diperbaiki sebelum UI dipakai

**File**: `backend/src/services/additional_service/explore_staging/stagingComparisonService.ts`
**Method**: `dailyLoosefruitSummary` (sekitar line 422-445)
**Bug**: `ORDER BY cnt DESC` — alias `cnt` tidak ada di SELECT, yang ada `trx_count`.
**Fix**: ganti `ORDER BY cnt DESC` → `ORDER BY trx_count DESC`.

### 2.4 Risiko keamanan endpoint staging

**File**: `backend/src/api/stagingRoutes.ts`
**Temuan**: BELUM ada middleware auth (tidak ada `Authorization` check / token verifikasi).
**Konsekuensi**: endpoint `/api/staging/*` saat ini publik via proxy.
**Rekomendasi**: tambah guard JWT/token sama seperti pola di `payrollRoutes` / `summaryRoutes`. Tetapi tahap pertama UI ini boleh tetap pakai endpoint publik untuk kecepatan delivery — **flag sebagai TODO P1** setelah UI rilis.

### 2.5 Risiko SQL injection ringan

Service melakukan string interpolation `'${date}'` untuk parameter `date` di staging query (`stagingComparisonService.ts` line ~92, ~152, ~233). `date` berasal dari query string. Saat ini fungsi service dipanggil dari route Elysia tanpa whitelist regex `^\d{4}-\d{2}-\d{2}$`.
**Mitigasi mudah**: tambah validasi regex di route handler sebelum panggil service. Masuk daftar TODO P2.

---

## 3. Skema Data (rangkuman dari DB schema)

### 3.1 Staging
| Tabel | Kolom Penting |
|---|---|
| `Gwscannerdata` | WORKERCODE, JOBCODE, TRANSDATE, TRANSNO, FIELDNO, FROMOCCODE |
| `Overtime` | WORKERCODE, JOBCODE, HOURS, BASICRATE, ADDRATE, TRANSDATE, TRANSNO |
| `Ffbscannerdata` | WORKERCODE, FROMOCCODE, TRANSDATE, LOOSEFRUIT, RIPE, UNRIPE, TASKNO, TRANSNO |

### 3.2 db_ptrj
| Tabel | Kolom Penting |
|---|---|
| `PR_TASKREGLN` | EmpCode, TaskCode, TrxDate, Hours, OT, Rate, ChargeTo, ID |
| `PR_LOOSEFRUITLN` | EmpCode, TrxDate, MT, ChargeTo, MasterID, ID |
| `PR_LOOSEFRUIT` (header) | ID, DocDate, DocDesc, DocID |
| `PR_LOOSEFRUIT_ARC` (archive) | sama, **DocDate sebagian berisi kode `LF########_##`** |

### 3.3 Mapping kunci

```
Kehadiran:    Gwscannerdata(WORKERCODE+JOBCODE+TRANSDATE) → PR_TASKREGLN(EmpCode+TaskCode LIKE %JOBCODE%+TrxDate)
Lembur:       Overtime(WORKERCODE+TRANSDATE)              → PR_TASKREGLN(EmpCode+TrxDate+OT=1) [fallback PR_MTHRATEDOTLN]
Brondol:      Ffbscannerdata.LOOSEFRUIT(WORKERCODE+TRANSDATE+FROMOCCODE) → PR_LOOSEFRUITLN(EmpCode+TrxDate)
```


---

## 4. Desain UI

### 4.1 Lokasi dalam aplikasi

| Aspek | Nilai |
|---|---|
| Route | `/staging-comparison` |
| Page file | `frontend/src/pages/StagingComparisonPage.jsx` |
| Service file | `frontend/src/services/stagingComparisonService.js` |
| Wrapper | `<SummaryReportWrapper component={StagingComparisonPage} />` di `App.jsx` |
| Sidebar section | `Verification` (di `DashboardLayout.jsx` `navItems`) |
| Sidebar item label | `Komparasi Staging vs DB` |
| Icon | `GitCompare` dari `lucide-react` (atau `Database` jika belum ada) |
| Roles yang melihat menu | `payroll_admin`, `finance` |

### 4.2 Layout halaman (top-down)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Header                                                             │
│  ─ Title: "Komparasi Staging vs DB Plantware"                       │
│  ─ Subtitle: ringkasan periode aktif + invariant info               │
├─────────────────────────────────────────────────────────────────────┤
│  Toolbar (sticky)                                                   │
│  ─ Tab: [Kehadiran] [Lembur] [Brondol]                              │
│  ─ Mode: [Daily Summary] [Row Detail]                               │
│  ─ Picker: Bulan/Tahun (untuk Daily) ATAU Tanggal (untuk Row)       │
│  ─ Limit row (untuk Row Detail): 50/100/250/500                     │
│  ─ Action: [Refresh] [Export CSV]                                   │
├─────────────────────────────────────────────────────────────────────┤
│  Summary KPI Cards (4-6 cards)                                      │
│  ─ Staging Total | Prod Total | Match | Staging-only | Prod-only    │
│    | Pct Match (gauge)                                              │
│  ─ Untuk tab Brondol tambahan: "ID Double Detected" card            │
├─────────────────────────────────────────────────────────────────────┤
│  Body (mode-dependent)                                              │
│  ─ DAILY MODE: tabel per-tanggal + bar chart staging vs prod        │
│  ─ ROW MODE: tabel detail dengan filter status & search             │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.3 Komponen yang harus dibuat

#### 4.3.1 `frontend/src/services/stagingComparisonService.js`
Wrapper axios untuk 6 endpoint compare (skip explore — bukan kebutuhan UI ini).

```js
import axios from 'axios';
import { buildBackendUrl } from '../utils/apiBase';

const get = async (path, params = {}, token) => {
  const url = buildBackendUrl(path);
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await axios.get(url, { params, headers });
  if (res.data?.success === false) throw new Error(res.data.error || 'Request failed');
  return res.data?.data;
};

export const fetchAttendanceCompare = (token, { date, limit = 50 }) =>
  get('/api/staging/compare/attendance', { date, limit }, token);
export const fetchOvertimeCompare = (token, { date, limit = 50 }) =>
  get('/api/staging/compare/overtime', { date, limit }, token);
export const fetchLoosefruitCompare = (token, { date, limit = 50 }) =>
  get('/api/staging/compare/loosefruit', { date, limit }, token);

export const fetchDailyAttendance = (token, { month, year, top = 31 }) =>
  get('/api/staging/compare/daily-attendance', { month, year, top }, token);
export const fetchDailyOvertime = (token, { month, year, top = 31 }) =>
  get('/api/staging/compare/daily-overtime', { month, year, top }, token);
export const fetchDailyLoosefruit = (token, { month, year, top = 31 }) =>
  get('/api/staging/compare/daily-loosefruit', { month, year, top }, token);
```

#### 4.3.2 `frontend/src/pages/StagingComparisonPage.jsx`
Page utama. State minimum:
- `module` ∈ `{'attendance','overtime','loosefruit'}` (tab utama)
- `mode` ∈ `{'daily','row'}`
- `month`, `year` (default dari `useReport()`), `date` (default `2026-05-28` atau hari ke-28 di bulan terpilih)
- `limit` (default 50)
- `loading`, `error`, `data`, `summary`
- `searchQuery`, `statusFilter`

Pola hampir identik dengan `DataVerificationPage.jsx` — gunakan sebagai template untuk:
- summary cards
- tab buttons
- filter row (search + status select)
- table dengan `idx % 2 === 0` zebra striping
- CSV export button

#### 4.3.3 Sub-komponen (boleh inline di page atau dipisah)
- `StagingComparisonSummaryCards` — 5-6 KPI cards.
- `DailySummaryTable` — kolom: Tanggal | Staging | Prod | Selisih | %match (mini bar).
- `AttendanceRowTable` — kolom: EmpCode | JobCode | Date | Staging Trx | Prod TaskCode | Prod Hours | Prod OT | Status badge.
- `OvertimeRowTable` — kolom: EmpCode | JobCode | Date | Staging Hours | Staging Rate | Prod Table | Prod TaskCode | Prod Hours | Status.
- `LoosefruitRowTable` — kolom: EmpCode | Date | OC | Staging Bunches | Prod MT | **DocID Flag** | Status.
- (Opsional v2) `DoubleIdInspectorPanel` — untuk modul Brondol, panel khusus yang memanggil endpoint baru `/compare/loosefruit-anomaly` (lihat §5).

### 4.4 Status row & color coding (konsisten dengan pola existing)

| Status | Trigger logic | Color |
|---|---|---|
| `MATCH` | `prod_found = true` & nilai numeric staging ≈ prod | `#047857` / `#ecfdf5` |
| `STAGING_ONLY` | `prod_found = false` | `#dc2626` / `#fef2f2` |
| `VALUE_DIFF` | `prod_found = true` tapi selisih > toleransi | `#b45309` / `#fffbeb` |
| `DOUBLE_ID` | (Loosefruit only) record `PR_LOOSEFRUIT_ARC` dengan `DocDate` mengandung `_` | `#7c3aed` / `#f5f3ff` |

Toleransi `VALUE_DIFF`:
- Hours: selisih > 0.01 jam.
- MT/Bunches: selisih bukan 0 (staging dalam bunches, prod dalam MT — sesuai doc 1:1, sehingga selisih ≠ 0 = anomaly nyata).

### 4.5 Interaksi

1. Default page load: `module=attendance`, `mode=daily`, `month/year` dari ReportContext, fetch `daily-attendance`.
2. Ganti tab → fetch endpoint sesuai modul.
3. Toggle mode → fetch endpoint daily/row.
4. Klik baris di Daily table → switch ke Row mode dengan `date` baris itu (deep-dive).
5. Search input → filter client-side (emp_code/job_code/oc).
6. Status filter dropdown → filter client-side berdasarkan kolom status.
7. Refresh button → re-fetch.
8. Export CSV → flatten rows + summary, sama dengan pola di `DataVerificationPage.exportCSV`.

### 4.6 Empty / Loading / Error states (wajib)
- Loading: `<LoadingScreen isLoading={loading} message="Memuat komparasi..." />`.
- Error: panel merah (mirror `DataVerificationPage`).
- Empty: panel abu dengan icon dan teks "Tidak ada data untuk periode ini".

### 4.7 Print/Print-friendly
Tidak diprioritaskan di v1. Namun struktur HTML dijaga supaya print default browser tetap readable.


---

## 5. Perubahan Backend yang Dibutuhkan

### 5.1 Fix bug `dailyLoosefruitSummary` (WAJIB sebelum UI dipakai)

**File**: `backend/src/services/additional_service/explore_staging/stagingComparisonService.ts`
**Lokasi**: method `dailyLoosefruitSummary`, query staging, line ~432.

```diff
  GROUP BY CAST(TRANSDATE AS DATE)
- ORDER BY cnt DESC
+ ORDER BY trx_count DESC
```

Lalu di mapping output, field `staging_workers` & `staging_lf_bunches` sudah benar (pakai `row.workers` & `row.total_lf`). Tidak perlu ubah field lain.

**Verifikasi**: `curl http://localhost:8002/api/staging/compare/daily-loosefruit?month=5&year=2026&top=5` harus return `success:true`.

### 5.2 Endpoint baru `/api/staging/compare/loosefruit-anomaly` (untuk fitur Double ID)

**Tujuan**: menyajikan baris-baris `PR_LOOSEFRUIT_ARC` yang `DocDate`-nya mengandung underscore (kode `LF########_##`) — yang biasa di-EXCLUDE dari laporan upah.

**Method baru di service**:

```ts
async loosefruitAnomalies(month: number, year: number, limit = 100): Promise<{
    rows: Array<{
        doc_id: string;
        doc_no: string;
        doc_date_raw: string;     // contoh: "LF90439471_01"
        emp_codes: string[];      // dari PR_LOOSEFRUITLN
        line_count: number;
        total_mt: number;
        total_amount: number;
    }>;
    summary: {
        total_anomaly_headers: number;
        total_anomaly_lines: number;
        total_amount_excluded: number;
    };
}> {
    // Query header anomaly
    const headers = await this.prodDb.query<any>(
        `SELECT TOP ${limit}
                LF.ID, LF.DocID, LF.DocNo, LF.DocDate as DocDateRaw,
                COUNT(LFLN.ID) as LineCount,
                SUM(LFLN.MT) as TotalMT,
                SUM(LFLN.Amount) as TotalAmount
         FROM PR_LOOSEFRUIT_ARC LF WITH (NOLOCK)
         LEFT JOIN PR_LOOSEFRUITLN_ARC LFLN WITH (NOLOCK) ON LF.ID = LFLN.MasterID
         WHERE CHARINDEX('_', LF.DocDate) > 0
           AND LF.DocDate LIKE 'LF%_%'
         GROUP BY LF.ID, LF.DocID, LF.DocNo, LF.DocDate
         ORDER BY LF.ID DESC`
    );

    // Query emp codes per header (top 5 emp per header to avoid bloat)
    const rows = [];
    for (const h of headers) {
        const emps = await this.prodDb.query<any>(
            `SELECT TOP 5 DISTINCT EmpCode FROM PR_LOOSEFRUITLN_ARC WITH (NOLOCK)
             WHERE MasterID = ?`,
            [h.ID],
        );
        rows.push({
            doc_id: h.DocID,
            doc_no: h.DocNo,
            doc_date_raw: h.DocDateRaw,
            emp_codes: emps.map(e => String(e.EmpCode).trim()),
            line_count: h.LineCount,
            total_mt: h.TotalMT,
            total_amount: h.TotalAmount,
        });
    }

    // Summary
    const sum = await this.prodDb.queryOne<any>(
        `SELECT COUNT(DISTINCT LF.ID) as headers,
                COUNT(LFLN.ID) as lines,
                SUM(LFLN.Amount) as total_amount
         FROM PR_LOOSEFRUIT_ARC LF WITH (NOLOCK)
         LEFT JOIN PR_LOOSEFRUITLN_ARC LFLN WITH (NOLOCK) ON LF.ID = LFLN.MasterID
         WHERE CHARINDEX('_', LF.DocDate) > 0
           AND LF.DocDate LIKE 'LF%_%'`,
    );

    return {
        rows,
        summary: {
            total_anomaly_headers: sum?.headers ?? 0,
            total_anomaly_lines: sum?.lines ?? 0,
            total_amount_excluded: sum?.total_amount ?? 0,
        },
    };
}
```

**Catatan**: filter `month`/`year` SENGAJA TIDAK dipakai untuk anomaly karena `DocDate` tidak berisi tanggal valid — filter waktu harus pakai field lain (mis. join ke `PR_LOOSEFRUITLN_ARC.TrxDate` jika ada). Untuk v1 cukup tampilkan ALL anomaly (jumlah biasanya kecil — puluhan record).

**Route baru** di `backend/src/api/stagingRoutes.ts`:

```ts
.get("/compare/loosefruit-anomaly", async ({ query, set }) => {
    try {
        const month = parseInt(query.month as string || "5");
        const year = parseInt(query.year as string || "2026");
        const limit = parseInt(query.limit as string || "100");
        const result = await comparator.loosefruitAnomalies(month, year, limit);
        return { success: true, data: result };
    } catch (e: any) {
        logError("StagingAPI", "Loosefruit anomaly fetch failed", e);
        set.status = 500;
        return { success: false, error: e.message };
    }
}, {
    query: t.Object({
        month: t.Optional(t.String()),
        year: t.Optional(t.String()),
        limit: t.Optional(t.String()),
    }),
})
```

**Frontend service**:
```js
export const fetchLoosefruitAnomalies = (token, { month, year, limit = 100 }) =>
  get('/api/staging/compare/loosefruit-anomaly', { month, year, limit }, token);
```

### 5.3 Hardening (TIDAK BLOKER UI v1, masuk follow-up)

| TODO | Severity | File |
|---|---|---|
| Tambah middleware auth (JWT verify) ke `stagingRoutes` | P1 | `backend/src/api/stagingRoutes.ts` |
| Validasi regex `^\d{4}-\d{2}-\d{2}$` untuk param `date` di route | P2 | sda |
| Ganti string interpolation `'${date}'` di service dengan param `?` | P2 | `stagingComparisonService.ts` |

---

## 6. Test Plan

### 6.1 Test backend (Bun)
File baru: `backend/src/services/additional_service/explore_staging/stagingComparisonService.test.ts`

Cases:
1. `dailyLoosefruitSummary(5, 2026)` tidak throw (regression test bug §5.1).
2. `loosefruitAnomalies()` mengembalikan `success:true` dan `summary.total_anomaly_headers >= 0`.
3. Smoke test integrasi: panggil 4 endpoint compare row-level (attendance, overtime, loosefruit, **loosefruit-anomaly**) dan assert response shape.

Run: `cd backend && bun test src/services/additional_service/explore_staging/stagingComparisonService.test.ts`

### 6.2 Test frontend (Vitest)
File baru: `frontend/src/pages/StagingComparisonPage.test.jsx`

Cases:
1. Render initial state — page tampilkan summary skeleton.
2. Mock fetchAttendanceCompare → render row table dengan 5 baris.
3. Tab switch ke "Brondol" → service `fetchLoosefruitCompare` dipanggil dengan param yg benar.
4. Status filter `STAGING_ONLY` → hanya baris dengan `prod_found:false` yang tampil.
5. Export CSV — verify CSV string mengandung header & rows.

Run: `cd frontend && npx vitest run src/pages/StagingComparisonPage.test.jsx`

### 6.3 Manual smoke test (sesudah implement)
```powershell
# 1. Start backend
cd backend ; bun run dev
# 2. Start frontend
cd frontend ; npm run dev:test
# 3. Navigate ke http://localhost:5175/staging-comparison
# 4. Coba 3 tab × 2 mode = 6 kombinasi
# 5. Pastikan tab Brondol Daily Mode sudah TIDAK error (bug §5.1 sudah di-fix)
# 6. Pastikan Anomaly panel di tab Brondol menampilkan record LF########_##
```


---

## 7. Execution Checklist (urutan kerja)

### Phase A — Backend fix & extension (~30 menit)

- [ ] **A1** Fix bug `dailyLoosefruitSummary` (§5.1).
- [ ] **A2** Tambah method `loosefruitAnomalies` di `stagingComparisonService.ts` (§5.2).
- [ ] **A3** Tambah route `/compare/loosefruit-anomaly` di `stagingRoutes.ts` (§5.2).
- [ ] **A4** Tambah test backend (§6.1). Run: `cd backend && bun test src/services/additional_service/explore_staging/stagingComparisonService.test.ts`.
- [ ] **A5** Smoke test 4 endpoint via curl pada port 8002 — semua harus return `success:true`. Khususnya `daily-loosefruit` & `loosefruit-anomaly`.

### Phase B — Frontend service & routing (~20 menit)

- [ ] **B1** Buat `frontend/src/services/stagingComparisonService.js` dengan 7 fetcher (§4.3.1 + §5.2).
- [ ] **B2** Tambah lazy import & `<Route path="staging-comparison" element={<SummaryReportWrapper component={StagingComparisonPage} />} />` di `App.jsx`.
- [ ] **B3** Tambah item nav di `DashboardLayout.jsx` `navItems` section `Verification` (§4.1).

### Phase C — Frontend page (~2-3 jam)

- [ ] **C1** Buat `StagingComparisonPage.jsx` skeleton dengan state, fetch logic, dan layout `header → toolbar → cards → body`.
- [ ] **C2** Implement tab switcher (Kehadiran/Lembur/Brondol) + mode switcher (Daily/Row).
- [ ] **C3** Implement summary cards (5-6 cards berbasis `summary` object).
- [ ] **C4** Implement Daily table dengan kolom `date|staging|prod|delta|pct`.
- [ ] **C5** Implement Row table per modul (`AttendanceRowTable`, `OvertimeRowTable`, `LoosefruitRowTable`).
- [ ] **C6** Implement client-side search + status filter.
- [ ] **C7** Implement Export CSV button (mirror `DataVerificationPage.exportCSV`).
- [ ] **C8** Tambah panel anomaly Brondol — render hanya saat `module === 'loosefruit'`, fetch `fetchLoosefruitAnomalies`, tampilkan tabel dengan `doc_date_raw` highlighted.
- [ ] **C9** Tambah loading & error states.

### Phase D — Test & polish (~1 jam)

- [ ] **D1** Tulis test frontend (§6.2). Run: `cd frontend && npx vitest run src/pages/StagingComparisonPage.test.jsx`.
- [ ] **D2** Manual smoke test (§6.3) — ceklis 6 kombinasi tab × mode + anomaly panel.
- [ ] **D3** Bandingkan summary numerik dengan response curl manual untuk satu tanggal — pastikan UI tidak menyembunyikan data.
- [ ] **D4** Visual sanity check — gunakan tone & spacing konsisten dengan `DataVerificationPage`.

### Phase E — Optional follow-up (di-PR terpisah)

- [ ] **E1** Tambah auth middleware ke `stagingRoutes` (§5.3 P1).
- [ ] **E2** Validasi & sanitasi parameter `date` (§5.3 P2).
- [ ] **E3** Update `docs/STAGING_VS_DBPTRJ_MAPPING.md` — tambah section "Anomaly: ID Double LF########_##".
- [ ] **E4** Print-friendly stylesheet untuk halaman ini.

---

## 8. Acceptance Criteria

UI dianggap selesai jika SEMUA criteria di bawah terpenuhi:

1. ✅ Menu `Komparasi Staging vs DB` muncul di sidebar untuk role `payroll_admin` & `finance`.
2. ✅ Halaman `/staging-comparison` me-render tanpa error pada periode default (Mei 2026).
3. ✅ Tiga tab modul (Kehadiran/Lembur/Brondol) bisa di-switch dan masing-masing fetch endpoint yang sesuai.
4. ✅ Mode Daily Summary menampilkan tabel per-tanggal dengan kolom Staging vs Prod vs Delta. **Tab Brondol Daily Mode harus berhasil load tanpa error 500** (bukti bug §5.1 sudah di-fix).
5. ✅ Mode Row Detail menampilkan tabel detail dengan kolom modul-spesifik dan badge status.
6. ✅ Tab Brondol menampilkan panel **Anomaly ID Double** dengan minimal 1 contoh record `LF########_##` jika ada di DB.
7. ✅ Search + status filter bekerja client-side.
8. ✅ Tombol Export CSV menghasilkan file yang valid (header + data rows).
9. ✅ Test backend & frontend lulus.
10. ✅ `bun test` & `npx vitest run` di project lulus tanpa regresi.

---

## 9. File yang Dibuat / Diubah

### Created
| File | Deskripsi |
|---|---|
| `frontend/src/services/stagingComparisonService.js` | Wrapper axios untuk 7 endpoint |
| `frontend/src/pages/StagingComparisonPage.jsx` | Page utama |
| `frontend/src/pages/StagingComparisonPage.test.jsx` | Test komponen |
| `backend/src/services/additional_service/explore_staging/stagingComparisonService.test.ts` | Test service |
| `docs/PRD-staging-comparison-ui.md` | Dokumen ini |

### Modified
| File | Deskripsi perubahan |
|---|---|
| `backend/src/services/additional_service/explore_staging/stagingComparisonService.ts` | Fix `dailyLoosefruitSummary` ORDER BY + tambah `loosefruitAnomalies` |
| `backend/src/api/stagingRoutes.ts` | Tambah route `/compare/loosefruit-anomaly` |
| `frontend/src/App.jsx` | Tambah lazy import & `<Route>` |
| `frontend/src/layouts/DashboardLayout.jsx` | Tambah item di section `Verification` |

---

## 10. Referensi Cepat (untuk implementer)

### 10.1 Lokasi penting
- `backend/src/index.ts:25,285,310` → mounting stagingRoutes
- `backend/src/services/reportService.ts:186` → bukti pola ID double
- `backend/query/Tunjangan/get_brondol_amount.sql:8` → bukti pola ID double
- `frontend/src/pages/DataVerificationPage.jsx` → template page (paling mirip)
- `frontend/src/components/DbPtrjCompareReportModal.jsx` → template modal compare
- `frontend/src/utils/apiBase.js` → `buildBackendUrl`
- `frontend/src/context/AuthContext.jsx` → `useAuth()`
- `frontend/src/context/ReportContext.jsx` → `useReport()` (month/year/division)

### 10.2 Endpoint cheatsheet
```
GET /api/staging/compare/attendance?date=YYYY-MM-DD&limit=N
GET /api/staging/compare/overtime?date=YYYY-MM-DD&limit=N
GET /api/staging/compare/loosefruit?date=YYYY-MM-DD&limit=N
GET /api/staging/compare/daily-attendance?month=M&year=Y&top=N
GET /api/staging/compare/daily-overtime?month=M&year=Y&top=N
GET /api/staging/compare/daily-loosefruit?month=M&year=Y&top=N      [BUG → fix dulu]
GET /api/staging/compare/loosefruit-anomaly?month=M&year=Y&limit=N  [BARU]
```

### 10.3 Kombinasi yang harus diuji manual
| Modul | Mode | Endpoint | Expected |
|---|---|---|---|
| Attendance | Daily | daily-attendance | Top-N tanggal, staging~1500-1600/hari |
| Attendance | Row | attendance | 5+ baris match 100% di 2026-05-28 |
| Overtime | Daily | daily-overtime | Top-N tanggal, prod_taskreg_ot_rows > 0 |
| Overtime | Row | overtime | 4/5 match, 1 staging-only di 2026-05-28 |
| Brondol | Daily | daily-loosefruit | Top-N tanggal, staging_workers ~500-600 |
| Brondol | Row | loosefruit | 5/5 match 100% di 2026-05-28 |
| Brondol | Anomaly | loosefruit-anomaly | Beberapa record dengan doc_date_raw='LF...' |

### 10.4 Konvensi gaya yang harus diikuti
- TypeScript backend: 4-space indent, semicolon.
- React frontend: 2-space indent, semicolon, JSX style: inline objects (lihat `DataVerificationPage`).
- Naming: camelCase untuk function/var, PascalCase untuk komponen.
- Color tokens: gunakan palette yang sama dengan `DataVerificationPage` (`#047857` match, `#dc2626` missing, dll).

---

## 11. Open Questions (boleh diabaikan, default sudah aman)

1. Apakah perlu filter divisi/gang di UI komparasi? **Default**: tidak — komparasi global per tanggal.
2. Apakah perlu preview multi-tanggal (range) di Row mode? **Default**: tidak — single date saja di v1.
3. Apakah perlu diff inline untuk hours numeric (mis. ±0.5)? **Default**: ya, kolom Delta dengan warna.
4. Apakah anomaly panel perlu link ke detail per-line LFLN? **Default**: tidak di v1, cukup tampilan ringkas.

---

**End of PRD.** Implementer (Sonnet) cukup eksekusi checklist §7 secara berurutan. Setiap fase punya kriteria selesai yang jelas. Semua keputusan desain sudah dibakukan; jangan deviasi tanpa menambah catatan ke §11 dulu.
