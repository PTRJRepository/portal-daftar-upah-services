# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the PT Rebinmas Daftar Upah payroll reporting system. It is a full-stack app with:

- `backend/`: Bun + Elysia API server for payroll extraction, calculations, auth, summaries, aggregation, spreadsheet sync, and admin tools.
- `frontend/`: React + Vite UI using AG Grid Enterprise plus a custom payroll table for operational Daftar Upah views.
- `dokumentasi/`: Indonesian project documentation.
- `_dev_utils/`: one-off investigation scripts, debugging scripts, integration checks, and planning notes. Do not put temporary scripts under `backend/src/scripts/`.

## Common Commands

### Backend

```bash
cd backend
bun run dev                                      # start API with watch mode, default port 8002
bun run start                                    # start API without watch mode
bun run test                                     # run Bun tests
bun test src/services/manualAdjustmentService.test.ts
bun test src/services/manualAdjustmentService.test.ts -t "requires ADCode"
```

### Frontend

```bash
cd frontend
npm run dev          # Vite dev server, default port 5173
npm run dev:network  # host 0.0.0.0 on port 5175
npm run dev:proxy    # proxy mode with /backend/upah prefix
npm run dev:lan      # LAN mode targeting configured backend host
npm run build        # production build
npm run preview      # preview production build on port 5175
npm run test         # currently prints tests-disabled and exits 0
```

If Vite reports an outdated optimized dependency, remove `frontend/node_modules/.vite`, reinstall if needed, and restart the dev server.

### Core verification scripts

Keep stable verification scripts in `_dev_utils/scripts/` (not under `backend/src/scripts/` — that directory doesn't exist):

```bash
cd backend
bun run src/scripts/test_division_mapping.ts
bun run src/scripts/test_thr_summary.ts
bun run src/scripts/check_thr_data.ts
```

Temporary checks, data exports, and debugging scripts belong in `_dev_utils/scripts/debugging/` or `_dev_utils/tests/`.

## Runtime Architecture

The backend does not connect directly to MSSQL. It uses a Python SQL Gateway:

```text
Bun/Elysia backend -> SQL Gateway API -> MSSQL databases
```

Gateway requests go to `POST {DB_API_URL}/v1/query` with `{ sql, params, server, database }`. Use `?` placeholders with array params in backend queries; the database client converts them to gateway parameters.

The frontend talks to backend endpoints directly in dev (`/payroll/*`, `/summary/*`, `/auth/*`) or through the proxy prefix (`/backend/upah/*`) when proxy mode is enabled. The backend also serves the built frontend in production with SPA fallback for non-API routes.

## Database Profiles and Source Rules

Use the correct database instance/profile:

| Purpose | Database | Profile / method |
| --- | --- | --- |
| Main payroll production data | `db_ptrj` | `Database.getInstance()`; `SERVER_PROFILE_2` in prod |
| Aggregation history and analysis reports | `extend_db_ptrj` | `Database.getExtendedInstance()`; `SERVER_PROFILE_1` |
| Employee master and VenusHR data | `VenusHR14` | `Database.getVenusInstance()`; `SERVER_PROFILE_3` |
| Mill/FFB data | `db_ptrj_mill` | `Database.getMillInstance()`; `SERVER_PROFILE_3` |

Never use the Venus profile for `extend_db_ptrj`, aggregation history, or analysis-report queries.

## Backend Structure

- `backend/src/api/`: route modules for payroll, summary, auth, aggregation, spreadsheet sync, etc.
- `backend/src/services/`: business logic. Services generally use singleton exports.
- `backend/src/db/`: SQL Gateway client and parameter conversion.
- `backend/src/config.ts`: environment-driven runtime configuration.
- `backend/data/`: persisted local data such as thumbprint data.

Important services:

- `dataExtractorService`: main payroll extraction and progressive SSE payroll data flow.
- `payroll/components/PayrollCalculator`: single source of truth for derived payroll formulas.
- `payroll/payrollAutoBufferService`: automatic buffer values and sync/miss frame coloring.
- `payroll/manualAdjustments/*`: manual adjustment naming, application, and AD code handling.
- `config/DivisionConfigService`: single source of truth for division aliases, virtual divisions, and gang resolution.
- `historyDatabaseService` / aggregation services: historical payroll snapshots and append-style history workflows.

## Frontend Structure

- `frontend/src/pages/`: page-level routes. `/upah/operational` is handled by `MainPage.jsx`.
- `frontend/src/components/CustomPayrollTable.jsx`: custom Daftar Upah table, value-source mode, streaming rendering, edit mode, export integration, sticky gang rows.
- `frontend/src/components/PayrollViewModeToolbar.jsx`: table display controls, including the `Show DB_PTRJ` value-source toggle.
- `frontend/src/hooks/usePayrollStream.js`: consumes `/payroll/report/division-raw-tree/stream` with SSE.
- `frontend/src/services/`: Axios API wrappers.
- `frontend/src/context/`: auth/header/gang filter state.
- `frontend/src/styles/CustomPayrollTable.css`: styling for the custom table and toolbar.

## Payroll Data Flow

Operational Daftar Upah generally flows as:

1. Frontend selects division, gang/group, month, year, and source mode.
2. `CustomPayrollTable` / `usePayrollStream` requests `/payroll/report/division-raw-tree/stream` with query params such as `division_code`, `month`, `year`, optional `gang_code`, optional `gang_prefix`, `use_history`, `snapshot_version`, and `value_priority_mode`.
3. `dataExtractorService.extractPayrollDataProgressive()` streams phases: identity, attendance, overtime, premium, complete.
4. Backend calculates allowances, premiums, deductions, tax, leave, overtime, totals, and sync/miss frame metadata.
5. Frontend renders gang sections and totals progressively.

When `gang_code=ALL`, omit `gang_prefix` for all gangs in the division; include `gang_prefix` only when the intended scope is a group/asistensi subset.

## Value Source Modes

Payroll rows can be rendered with different value priorities:

- `smart`: manual adjustment and auto buffer can override raw db values.
- `db_ptrj_only`: use raw values from `db_ptrj` in the same existing columns; do not add duplicate DB_PTRJ columns.
- `manual_buffer_only`: use adjustment/buffer values where applicable.

For UI comparison, show active/manual-buffer value and `db_ptrj` value inside the same cell rather than creating columns like `SPSI (db_ptrj)`. The intended simple comparison format is:

```text
active_value | db_ptrj_value
```

## Business Rules to Preserve

### Employee filtering

The critical payroll filter is:

```ts
const effective_work_hk = hk - (cuti_minggu + cuti_nasional);
const other_cuti = cuti_tahunan + cuti_sakit_haid;
if (effective_work_hk <= 0 && other_cuti == 0) continue;
```

Do not add a separate `hari_kerja <= 0` filter; employees with zero effective work HK but other leave must remain visible.

### Derived payroll formulas

Use `PayrollCalculator` for derived payroll fields. Important formula intent:

- `upah_kotor = gaji_pokok_aktual + total_tunjangan + total_premi`
- `jumlah_upah_kotor = upah_kotor + pot_koreksi + pendapatan_lainnya`
- Taxable gross includes koreksi, pendapatan lainnya, and employer BPJS/ASTEK components.
- `total_potongan` includes worker caruman, SPSI, PPH21, other deductions, and pendapatan_lainnya; koreksi is not deducted again.
- `upah_bersih = jumlah_upah_kotor - total_potongan + premi_pph`

### Dynamic headers

Dynamic premium headers exclude PPH/PPH21, lembur, pruning, koreksi, SPSI, tunjangan jabatan/masa kerja/beras, and brondol. Brondol and pruning roll into static premium columns.

Dynamic deduction headers exclude broad `POT%`, SPSI, beras, jabatan, masa, lembur, and broad `PPH%` patterns.

### Append-only history intent

Payroll history/aggregation workflows should preserve historical records. Prefer appending new versions and reading the latest by `version_index` or timestamp instead of overwriting historical data, especially for employee identity data.

## Development Notes

- There is no root `package.json`; run backend commands from `backend/` and frontend commands from `frontend/`.
- `npm run build` is the practical frontend verification command.
- Backend `bun run test` runs Bun tests; TypeScript checks may include `_dev_utils` files if invoked broadly, so isolate failures before treating them as production errors.
- Current frontend tests are disabled by package script.
- Existing generated files, debugging exports, and `.claude`/worktree artifacts may be present; do not stage or commit them unless explicitly requested.
