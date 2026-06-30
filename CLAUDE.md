# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> This directory (`refactor_production`) is the **TypeScript refactor** of the Python payroll engines described in the parent `../CLAUDE.md`. Stack: **Bun + Elysia** backend, **Vite + React 18** frontend, **MSSQL** via SQL Gateway proxy. The parent CLAUDE.md's DB-profile rules and business conventions still apply — this file adds the TS-specific architecture and commands.

## Commands

### Backend (`backend/`)
```bash
cd backend
bun install                 # install deps
bun run dev                 # watch mode (auto-reload)
bun run start               # run once (port 8002)
bun test                    # run all *.test.ts
bun test src/services/dataExtractorService.manualAdjustmentMetadata.test.ts   # single test file
bun test --test-name-pattern "should preserve"   # single test by name
bunx tsc --noEmit           # type-check only (no emit) — catches merge/type errors
```
Backend serves on `0.0.0.0:8002`. Production via proxy gateway at `ptrjestate.rebinmas.com:3001` (route `/upah` → backend 8002).

### Frontend (`frontend/`)
```bash
cd frontend
bun install                 # bun lockfile (preferred over npm)
npm run dev                 # vite dev server (local, port 5173)
npm run dev:test            # test-mode vite (port 5174)
npm run dev:proxy           # proxy-mode vite (simulates /upah prefix, port 5175)
npm run dev:lan             # LAN mode w/ custom backend host
npm run build               # production build → dist/ (backend serves this at /upah)
npm run test                # tests currently disabled (stub)
```
Frontend has NO test runner active (`test` script is a no-op). The `dist/` folder is served by the backend in production via `@elysiajs/static` + custom asset helpers (`serveIndexHtml`/`serveStaticAsset` in `backend/src/index.ts`).

### SQL Gateway (external dependency)
Payroll DB queries route through a **SQL Gateway** (port 8001) → MSSQL. If gateway is down, all payroll-extraction endpoints timeout (500). Light endpoints (health, current-period cached) still work. Start the gateway separately — it is NOT part of this repo.

## Architecture

### Two-app monorepo
- `backend/` — Elysia server, all API routes under `/payroll`, `/api`, `/upah` prefixes. Entry: `backend/src/index.ts` registers ~29 route modules via `.use()`.
- `frontend/` — Vite SPA (React 18 + AG-Grid + recharts). Routes defined in `frontend/src/App.jsx`. Production build served by backend.

### Database profile routing (CRITICAL — most bugs live here)
Four MSSQL profiles, each pointing at a different server/database. Per `../CLAUDE.md` + `backend/src/config.ts`:

| Profile | DB | Purpose |
|---|---|---|
| `SERVER_PROFILE_1` | `extend_db_ptrj` | **Aggregation history + analysis** only (`daftar_upah_aggregation_history`, `payroll_history_*`). `Database.getExtendedInstance()` |
| `SERVER_PROFILE_2` | `db_ptrj` | **Payroll tables** (`PR_TASKREG`, `PR_TASKREGLN`, `HR_GANG`, `HR_EMPLOYEE`, `HR_GANGLN`, `PR_ADTRANS`). `Config.DB_PROFILE` |
| `SERVER_PROFILE_3` | `VenusHR14` / `db_ptrj_mill` | **Employee master + FFB weight** only. `Database.getVenusInstance()` / `getMillInstance()` |
| staging | `staging_PTRJ_iFES_Plantware` | Staging buffer |

**Known invariant violation (audit ROOT-A):** `Config.DB_PROFILE` defaults to `SERVER_PROFILE_1` (history DB), but `HR_*` / `PR_*` tables live on `SERVER_PROFILE_2`. Bare `Database.getInstance()` (no profile arg) hits the wrong DB. When writing payroll queries, **always pass the explicit profile** — never rely on the default. See `.audit/AUDIT_REPORT.md` finding F23/F25 for the full fix plan.

When a query joins a `db_ptrj` table (e.g. `HR_GANG`) inside an `extend_db_ptrj` query, it will fail with `Invalid object name 'HR_GANG'` — the SQL Gateway routes per-profile. Resolve division/gang codes on the correct DB first, then pass as an `IN (...)` list (see `dashboardService.getAllGangsTrend` for the pattern).

### Payroll extraction pipeline (`dataExtractorService.ts`, ~5700 lines)
`extractPayrollData(month, year, gangCode, divisionCode, ...)` is the core. Phases:
- **Phase 0** — `getEmployees()` (HR_GANGLN join, db_ptrj PROFILE_2)
- **Phase 1** — parallel chunks: per-emp-code payroll components
- **Phase 2** — 4 parallel calls (premi, potongan, lembur, tunjangan)
- **Phase 3** — row assembly + manual-adjustment merge
- **Phase 4b** — final calc (upah_bersih, pph21 TER, penghasilan_bruto)

`extractPayrollDataProgressive` (generator) streams phases over SSE for progressive UI render. `extractPayrollDataWithComponents` is the experimental metadata-rich variant.

**History/snapshot path:** when `isHistorical && isHistoryMode() && valuePriorityMode==='db_ptrj_only'`, extraction is intercepted (~line 820) and served from `payroll_history_detail` via `historyDatabaseService.getHistoricalPayrollDataAsExtractorFormat`. `isHistoryMode()` = `RUN_MODE==='prod'` — **dev never hits this branch** (mask bugs). Snapshot versioning: `snapshot_version` INT on `payroll_history_header`; `MAX()` = latest, or pass `requestedSnapshotVersion`.

### Manual adjustments + seeder
- `manualAdjustmentService` — `payroll_manual_adjustments` table; remarks use pipe-delimited format with `sync:MANUAL` and `AD CODE:` markers (seeder protection — do NOT strip).
- `autoBufferManualAdjustmentSeederService` — seeds auto-buffer adjustments.
- Seeder entrypoints: `aggregationSeederRoutes` (parallel), `parallelAggregationSeeder`, `uiBasedSeeder` — all write `daftar_upah_aggregation_history`. **DELETE must scope by `division_code`** or cross-division data destruction occurs (audit F16). **Must invalidate payroll cache after write** (audit F21/ROOT-C).

### Frontend prod-mode / proxy
`frontend/src/utils/prodModeUtils.js`:
- `isProdMode()` — true when behind proxy gateway (port 3001, `VITE_BACKEND_HOST`, or built dist).
- `buildAppPath(path)` / `buildBackendUrl(path)` — prefix `/upah` in proxy mode. **Always use these for navigation + fetch URLs**, never bare `/...`.
- `getBasePath()` — `/upah` in proxy mode, `/` locally. React Router `basename` uses this.

### Context + report state
`frontend/src/context/ReportContext.jsx` holds shared payroll filter state: `month, year, division, gang, gangPrefix, gangs, allDivisions, isLockedMode, isAdminUser, currentPeriod`. Consumed by `MainPage`, `ProfessionalDashboard`, `CustomPayrollTable`. KERANI users are division-locked (`isLockedMode`).

### Dashboard (`ProfessionalDashboard.jsx` + helpers)
Route `/` index = `ProfessionalDashboard`. Refactored into 3 files:
- `professionalDashboard.config.js` — module registry, KPI blueprint, formatters (pure data)
- `professionalDashboard.helpers.js` — role derivation, KPI builder, group/asistensi logic (pure, shared w/ Daftar Upah)
- `ProfessionalDashboard.jsx` — component only

KPI per-division/group: `executive-summary` endpoint resolves gang codes via `divisionConfigService.getGangsForDivision` (queries `HR_GANG` on db_ptrj correctly), passes `IN (...)` to extendDb aggregation queries.

## Conventions

- **PTRJ AccMonth = calendar month** — period math is 1:1 with calendar months. Do not "fix" accrual timing.
- **PR_ADTRANS queries require letter-prefixed PTRJ EmpCode**, not numeric NIK.
- **Business calc logic is untouchable** without sign-off: tax brackets, PTKP tiers, `jabatan_rate * hari_kerja`, brondol static rollup, dynamic premi keyword mapping (`PR_ADTRANS` DocDesc `LIKE '%JABATAN%'` filter).
- **Cache keys**: `:${month}:${year}` and `:${month}:${year}:${division}`. Use `cacheService.invalidatePayroll` / `clearByPattern` after any write that changes payroll/aggregation data.
- **Auth**: token-based for users; `x-api-key` header bypass for service integrations (`Config.API_KEY_BYPASS`). API-key bypass currently grants ADMIN-equivalent — audit flags this for scoping (F39).

## Canonical truth source (CRITICAL)

**Two GitHub repos must be considered together:**

- **Canonical logic**: `temp/server-changes-1` @ `c9e72ff6` (remote `PTRJRepository/temp_portal_daftar_upah`). This is the **ground truth** for payroll calculation logic. Dev logic must match this exactly.
- **Live deploy**: `origin/server-changes-1` @ `253eb1ea` (1 commit behind canonical). Live `ptrjestate.rebinmas.com:3001/upah` deploys from here. The dev branch (`server-dev-merger-1`) diverged by adding features (dashboard per-division, snapshot versioning, sawit banner) but also drifted from canonical logic in 4 areas (see fixes below).

**Always compare dev against canonical `c9e72ff6` first, then verify parity with live.** When live and canonical conflict (rare), canonical wins — live may be running older code.

```bash
git remote add temp https://github.com/PTRJRepository/temp_portal_daftar_upah.git
git fetch temp
# Compare dev vs canonical
git diff HEAD..c9e72ff6 -- backend/src/services/
```

## Parity status (verified 2026-06-30)

**28/28 division×month combos (May+June 2026) MATCH** — verified via `/payroll/report/division-raw-tree` (live calc from DB, NOT aggregation snapshot). 0 employee diffs. Logic dev = canonical `c9e72ff6` = live.

### 4 logic fixes applied (restored canonical parity)

| Fix | File | What was wrong | Impact |
|---|---|---|---|
| **C2 income dedupe** | `dataExtractorService.ts:4968` | Dev dropped `OtherIncomesService.deduplicateIncomeRows()` call. `employee_other_incomes` rows doubled → upah_bersih inflated. Restored dedupe + SELECT `id,new_nik`. | All months, all divisions. ~6M for P1B. |
| **payrollAutoBuffer attendanceDays** | `payrollAutoBufferService.ts:264-269` | Dev had guard `hariKerja===0?0` + no `attendanceDays` fallback. Canonical: `attendanceDays = hariKerja>0?hariKerja:kehadiran`, no guard. Checked out canonical file + test. | Sick-leave employees (hari_kerja=0). B0088 P1B: 62,500 vs 0. |
| **autoBuffer seeder PPH guard** | `autoBufferManualAdjustmentSeederService.ts` + `autoBufferAdcodeMap.ts` | Dev had `AUTO_BUFFER_PPH_ADJUSTMENT_NAME_CONDITION` protecting PPH from seeder (syncStatus MISS, matchStatus MISMATCH). Canonical: no guard. Checked out canonical. | PPH auto-buffer seeding. |
| **period-adjustment (C1)** | `payrollPeriodAdjustments.ts` (stub→real) + `dataExtractorService.ts` (3 call sites) | Dev stub no-op. Canonical: `getPayrollPeriodAdjustments` — **May 2026 only** (`isMay2026`). B0088 jabatan=0, F0529+ARA PPh21=TER. Applied to progressive path only (canonical-consistent). Test 3 pass. | May 2026 only. B0088 P1B: -62,500. F0529 ARA: PPh21→TER. |

### Period-adjustment scope (DO NOT BREAK)
`payrollPeriodAdjustments.ts` is **May 2026 only** — `isMay2026(context)` returns `true` only for month=5, year=2026. For ALL other months it returns `[]`. The adjustment call sites exist only on the **progressive path** (NOT the default raw-tree path), matching canonical behavior. Do NOT extend to other months or paths without explicit user request.

### Verifying parity (dev vs live)
```bash
# Login to live
TOKEN=$(curl -s -X POST http://ptrjestate.rebinmas.com:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin","password":"admin123"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Compare raw-tree (live calc, NOT aggregation)
curl -s -H "x-api-key: $API_KEY" "http://localhost:8002/payroll/report/division-raw-tree?division_code=PG1A&month=6&year=2026&gang_code=ALL"
curl -s -H "Authorization: Bearer $TOKEN" "http://ptrjestate.rebinmas.com:3001/upah/payroll/report/division-raw-tree?division_code=PG1A&month=6&year=2026&gang_code=ALL"
# Compare grand total: grep -oE '"upah_bersih":[0-9.]+' | awk sum
# Compare per-emp: extract emp_code + upah_bersih pairs, diff
```

**Query gateway directly** (bypass app layer):
```bash
curl -s -X POST http://10.0.0.110:8001/v1/query \
  -H "x-api-key: $DB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sql":"SELECT ...","params":{},"server":"SERVER_PROFILE_2","database":"db_ptrj","timeout":60}'
# Body format: {sql, params, server, database, timeout}
# params: {p0:"val", p1:"val"} with @p0, @p1 in SQL
```

## Division normalization
- ARB1↔AB1, ARB2↔AB2 are **aliases** (same division). `gangService.normalizeDivisionCode()` resolves them at query time. Output is identical for both codes.
- `DivisionConfigService.getAllDivisionCodes()` returns ALL keys including aliases → division dropdown shows duplicates (ARB1 + AB1). This is canonical behavior, not a bug. If needed, filter to canonical codes only.

## Audit findings
`.audit/` directory contains all audit reports:
- **AUDIT_REPORT.md** (33 consistency findings) + **FIX_PLAN.md** (P0-P3)
- **DIVERGENCE_REPORT.md** (34 dev vs canonical divergences, action buckets)
- **AREA_AUDIT_REPORT.md** (53 area findings: live parity, test gaps, config/env, dead code, data integrity)
- **DEEP_VERIFY_REPORT.md** (28/28 parity verified)
- **P1B_JUNE_ROOTCAUSE.md** (B0088 jabatan investigation)
- Re-runnable workflows: `consistency-audit.workflow.js`, `canonical-diff.workflow.js`, `deep-verify.workflow.js`
