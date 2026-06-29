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

## Audit findings (ongoing)
`.audit/AUDIT_REPORT.md` (33 findings) + `.audit/FIX_PLAN.md` (P0-P3 prioritized). Top root causes to fix before merge:
- **ROOT-A** DB profile default backwards (F23/F25) — `Config.DB_PROFILE` should default `SERVER_PROFILE_2`.
- **ROOT-B** THP/taxable flags dropped in extractor SELECT (F1/F2) — tax undercalculated.
- **ROOT-C** Seeder missing cache invalidation (F21).
- **ROOT-D** API-key bypass over-permissive (F39-43).

Re-run the audit: `Workflow({ scriptPath: ".audit/consistency-audit.workflow.js" })` (resumes cached agents if unchanged).
