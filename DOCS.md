# Documentation Index — Daftar Upah Refactor Production

> Branch: `server-dev-merger-1` | Stack: Bun + Elysia backend, Vite + React 18 frontend, MSSQL via SQL Gateway.

## Start here (read in order)

1. **[CLAUDE.md](CLAUDE.md)** — commands (build/test/run), conventions, DB-profile rules, audit summary. **Read first.**
2. **[AGENTS.md](AGENTS.md)** — repo structure & coding style (complements CLAUDE.md).
3. **[ARCHITECTURE.md](ARCHITECTURE.md)** — big-picture diagram, backend/frontend layout, payroll extraction pipeline phases, auth, invariants.
4. **[DEPLOYMENT.md](DEPLOYMENT.md)** — local/proxy/live setup, build & deploy, post-deploy verification, rollback, troubleshooting.

## Audit (consistency findings + fix plan)

- **[.audit/AUDIT_REPORT.md](.audit/AUDIT_REPORT.md)** — 33 inconsistencies across 6 subsystems (manual adjustment, jabatan, seeder, DB-profile routing, snapshot/history, auth). 9 critical / 16 high / 12 medium / 7 low.
- **[.audit/FIX_PLAN.md](.audit/FIX_PLAN.md)** — P0-P3 prioritized fix plan with file:line + steps + acceptance criteria + DO-NOT-BREAK list.
- **[.audit/consistency-audit.workflow.js](.audit/consistency-audit.workflow.js)** — re-runnable multi-agent audit script (`Workflow({ scriptPath: ".audit/consistency-audit.workflow.js" })`).
- **[.audit/DIVERGENCE_REPORT.md](.audit/DIVERGENCE_REPORT.md)** — dev (`server-dev-merger-1`) vs canonical GitHub (`temp/server-changes-1` @ `c9e72ff6`) diff: 34 divergences, 7 critical/high calc-numeric. Stub-vs-real flag for `otherIncomeCanonical` + `payrollPeriodAdjustments`. Action buckets: REVERT-DEV-TO-CANONICAL (18) / ADD-CANONICAL-TO-DEV (8) / KEEP (8) / INVESTIGATE (0 resolved).
- **[.audit/P1B_DIVERGENCE.md](.audit/P1B_DIVERGENCE.md)** — concrete root cause of P1B upah_bersih +6jt (597 vs 591): C2 dedupe dropped + C1 payrollPeriodAdjustments stub.
- **[.audit/AREA_AUDIT_REPORT.md](.audit/AREA_AUDIT_REPORT.md)** — 6 area audit (53 findings): live parity, test gaps, config/env, dead code, frontend-backend contract, data integrity. 11 critical (hardcoded secrets, no transactions, 4 calc services untested). Section 5 cross-references prior audits to avoid duplicate work.

> Status: verified against current code 2026-06-29 — F1 (SELECT omits is_paid_in_thp at `dataExtractorService.ts:4969`), F16 (uiBasedSeeder DELETE missing division_code), F23 (`this.db = Database.getInstance()` bare at `:735`), F25 (`DB_PROFILE` defaults SERVER_PROFILE_1 at `config.ts:36`) all confirmed present. The `.audit/` files are untracked; commit them before merge.

## Live system reference

- Live URL: `ptrjestate.rebinmas.com:3001` (proxy gateway → backend :8002)
- Login: `admin` / `admin123` (proxy auth `/api/auth/login`, field `email`+`password`)
- Payroll API base (via proxy): `/upah/payroll/*`
- Health: `GET /upah/health` (no auth)

## Backend deep-dive (read code, no separate docs)

The previous Python-era docs (`ARSITEKTUR_DAFTAR_UPAH_COMPLETE.md`, `PAYROLL_LOGIC_MAP.md`, `FIELD_TO_TABLE_MAPPING.md`, `MANUAL_ADJUSTMENT_API.md`, etc.) were deleted in the Phase 1.4-1.6 cleanup. Deep logic now lives in code + comments. Key entry points:

| Topic | File | What |
|---|---|---|
| Payroll pipeline | `backend/src/services/dataExtractorService.ts` | `extractPayrollData` + phases 0-4b, progressive stream, history intercept |
| Manual adjustments | `backend/src/services/manualAdjustmentService.ts` | save/apply, remarks pipe-format, seeder protection |
| Seeder | `backend/src/api/aggregationSeederRoutes.ts`, `parallelAggregationSeeder.ts`, `uiBasedSeeder.ts` | aggregation history writes |
| Snapshot/history | `backend/src/services/historyDatabaseService.ts` | `getHistoricalPayrollDataAsExtractorFormat`, snapshot_version |
| Tax report | `backend/src/services/taxReportService.ts` + `api/taxReportRoutes.ts` | PPh21 TER, snapshot fields |
| Dashboard | `backend/src/services/dashboardService.ts` + `api/dashboardRoutes.ts` | KPI per division/group, trend |
| DB profiles | `backend/src/config.ts` + `db/client.ts` | 4 profiles, getInstance/getExtendedInstance/getVenusInstance |
| Auth | `backend/src/utils/authBypass.ts` + `services/authService.ts` | token + api-key bypass |
| Business calc | `backend/src/services/payroll/components/*` | GajiPokok, Tunjangan, Premi, Potongan, PPh21TER |
| Gang/division mapping | `backend/src/services/config/DivisionConfigService.ts` + `gangService.ts` | HR_GANG LocCode↔gang, virtual divisions |

## Frontend deep-dive

| Topic | File | What |
|---|---|---|
| Router + auth gate | `frontend/src/App.jsx` | lazy routes, ProtectedRoute, role checks |
| Shared state | `frontend/src/context/ReportContext.jsx` | month/year/division/gang/gangPrefix, locked mode |
| Prod/proxy utils | `frontend/src/utils/prodModeUtils.js` | `isProdMode`, `buildAppPath`, `buildBackendUrl` |
| Daftar Upah grid | `frontend/src/components/CustomPayrollTable.jsx` | AG-Grid, manual edit, snapshot UI |
| Dashboard | `frontend/src/pages/ProfessionalDashboard.jsx` + `professionalDashboard.config.js` + `professionalDashboard.helpers.js` | KPI, modules, group filter, sawit banner |

## Planning artifacts (in-repo, not primary docs)

- `.workflow/.lite-plan/*` — feature planning contexts (premium-excel-seeder, tunjangan-jabatan, staging-comparison).
- `.workflow/active/WFS-*` — active workflow session summaries (dashboard v3, admin-auto-key-in).

## Parent repo

`../CLAUDE.md` — the **Python** payroll engines (Engine_Templating, Engine_HTML_Templating, Explore_database, context_portal). Different stack; DB-profile + business rules there still apply to this TS refactor.
