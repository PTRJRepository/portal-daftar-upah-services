# Architecture — Daftar Upah Refactor Production

> TS refactor (Bun + Elysia + Vite/React). For the Python engines, see parent `../CLAUDE.md` and `DAFTAR_UPAH_LOGIC.md`. For command reference, see `CLAUDE.md`.

## Big picture

```
                ┌─────────────────────────────────────────────┐
                │  Proxy Gateway (ptrjestate.rebinmas.com:3001)│
                │  /upah/* ──────────► backend :8002          │
                │  /api/auth/* ──────► auth service           │
                └───────────────┬─────────────────────────────┘
                                │
        ┌───────────────────────┴───────────────────────┐
        ▼                                               ▼
┌──────────────────┐                          ┌─────────────────┐
│  Backend (Bun)   │                          │  Frontend (Vite)│
│  Elysia :8002    │                          │  React 18 SPA   │
│                  │   serves dist/ at /upah  │  dist/ build    │
│  29 route mods   │ ◄──────────────────────  │  AG-Grid +      │
│  ~91 services    │                          │  recharts       │
└────────┬─────────┘                          └─────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────┐
│  SQL Gateway (:8001) ──► MSSQL (per-profile routing)│
└──────────────────────────────────────────────────────┘
         │
   ┌─────┴──────────┬──────────────┬───────────────┐
   ▼                ▼              ▼               ▼
SERVER_PROFILE_1  PROFILE_2     PROFILE_3        staging
extend_db_ptrj    db_ptrj       VenusHR14 /      staging_PTRJ
(aggregation,     (payroll:     db_ptrj_mill     (auto-buffer)
 history,          PR_TASKREG,
 analysis)         HR_*, PR_ADTRANS)
```

## Backend layout (`backend/src/`)

- `index.ts` — Elysia app; registers all route modules via `.use()`; serves frontend `dist/` (static plugin + `serveIndexHtml`/`serveStaticAsset` for precompressed br/gz + immutable cache).
- `config.ts` — all env-driven config: DB profiles, API keys, RUN_MODE, feature flags.
- `db/client.ts` — `Database` singleton per (database, profile). Methods: `getInstance(db?, profile?)`, `getExtendedInstance()` (PROFILE_1), `getVenusInstance()`/`getMillInstance()` (PROFILE_3).
- `api/` (29 modules) — Elysia route groups, each `prefix: "/payroll/..."` or `"/api/..."`. Notable: `payroll.ts` (largest, ~3700 lines, all daftar-upah + manual-edit + premium + seeder-chain routes), `dashboardRoutes`, `taxReportRoutes`, `aggregationSeederRoutes`, `historyRoutes`.
- `services/` (~91 files) — business logic. Anchor: `dataExtractorService.ts` (~5700 lines, the payroll pipeline). Others: `dashboardService`, `taxReportService`, `reportService`, `manualAdjustmentService`, `historyDatabaseService`, `aggregationService`, `*Seeder*`, `payroll/components/*` (GajiPokok, Tunjangan, etc).
- `repositories/` — DB access objects (employee, history, payroll). `utils/` — pure helpers (logger, authBypass, queryParsers, payrollTableFormatters, otherIncomeCanonical, payrollPeriodAdjustments).

## Frontend layout (`frontend/src/`)

- `App.jsx` — router + auth gate. Lazy-loads report pages; static imports for always-used (DashboardHome, EmployeeDetailRoute, LoginPage, etc). Route `/` index = `ProfessionalDashboard`.
- `context/ReportContext.jsx` — shared payroll filter state (month, year, division, gang, gangPrefix, gangs, allDivisions, isLockedMode, isAdminUser, currentPeriod). Persists to localStorage.
- `context/AuthContext.jsx` — token, user, lockedDivision, role.
- `pages/` (~60) — one per report. `ProfessionalDashboard` split into config + helpers + component (see CLAUDE.md).
- `components/CustomPayrollTable.jsx` — the daftar-upah grid (AG-Grid), manual edit, save, snapshot UI.
- `services/` — API clients (gangService, payrollService, taxReportService, dashboardService). `utils/prodModeUtils.js` — `isProdMode`, `buildAppPath`, `buildBackendUrl`, `getBasePath` (proxy-aware).

## Payroll extraction pipeline

`DataExtractorService.extractPayrollData(month, year, gangCode, divisionCode, specificEmpCode?, serverProfile?, includeVirtualGangs?, useHistoryDb?, gangPrefix?, skipHarvest?, skipHeavyDetails?, snapshotVersion?, valuePriorityMode?)`

- **Phase 0** — `getEmployees()`: HR_EMPLOYEE ⨝ HR_GANGLN ⨝ HR_GANG (db_ptrj, PROFILE_2). Builds `codeToDesc`/`descToCode` maps for frontend Code↔Description mapping.
- **Phase 1** — parallel chunks of emp_codes; per-emp component fetch.
- **Phase 2** — 4 parallel calls: premi, potongan, lembur, tunjangan.
- **Phase 3** — row assembly; merge manual adjustments (`payroll_manual_adjustments`) + auto-buffer; apply gangPrefix filter.
- **Phase 4b** — final calc: upah_bersih, pph21 TER, penghasilan_bruto, total_potongan_bersih.

`extractPayrollDataProgressive` — async generator yielding phases over SSE for progressive UI. `extractPayrollDataWithComponents` — experimental, returns `PayrollComponent` with traceable metadata.

**History intercept (~line 820):** when `isHistorical && isHistoryMode() && valuePriorityMode==='db_ptrj_only'`, skip live calc; serve from `payroll_history_detail` via `historyDatabaseService.getHistoricalPayrollDataAsExtractorFormat(month, year, gang, division, emp, gangPrefix, requestedSnapshotVersion?)`. Returns `snapshot_version`/`requested_snapshot_version`/`available_snapshot_versions` in meta.

## Database profile rules (enforced, see CLAUDE.md for table)

- `extend_db_ptrj` (PROFILE_1) — aggregation history + analysis + `daftar_upah_aggregation_history`. **Mandatory.**
- `db_ptrj` (PROFILE_2) — payroll tables. **HR_GANG/HR_EMPLOYEE/PR_* live here, not on extend.**
- PROFILE_3 (Venus/mill) — employee master + FFB only.

**Cross-DB subqueries fail** (SQL Gateway routes per-profile). Pattern for filtering aggregation by division: resolve gang codes via `divisionConfigService.getGangsForDivision(div)` (queries HR_GANG on PROFILE_2), then pass `IN (...)` to the extendDb aggregation query.

## Auth & access

- User auth: JWT (proxy gateway `/api/auth/login` → token) OR internal `authService`.
- Service auth: `x-api-key` header → `Config.API_KEY_BYPASS` → `authBypass.resolveUserFromHeaders` (ADMIN-equivalent, audit F39 flags over-permissive).
- KERANI = division-locked. Read endpoints gate division ownership; **write endpoints currently do NOT** (audit F37/P0-6 — open fix).

## Key business invariants (do not break)

- PTRJ `AccMonth` = calendar month (1:1).
- PR_ADTRANS needs letter-prefixed PTRJ EmpCode.
- Manual adjustment remarks pipe-format with `sync:MANUAL` + `AD CODE:` markers (seeder protection).
- Cache keys `:${month}:${year}` / `:${month}:${year}:${division}`.
- History merge order: seed > manual override (manual wins).

## Related docs

- `CLAUDE.md` — commands + conventions (start here).
- `.audit/AUDIT_REPORT.md` + `.audit/FIX_PLAN.md` — 33 inconsistencies, P0-P3 plan.
- `DAFTAR_UPAH_LOGIC.md`, `PAYROLL_LOGIC_MAP.md`, `FIELD_TO_TABLE_MAPPING.md` — deep field/logic maps.
- `proxy-payroll-runbook.md` — proxy operations.
- `DOCS.md` — master index of all docs.
