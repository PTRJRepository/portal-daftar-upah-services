# IMPL PLAN - Admin Auto Key-In Sync Only Unsynced Payroll Columns

## 1. Requirements Summary

Add an admin-only control in the daftar upah payroll table. When user role is admin, show buttons above relevant column groups so admin can choose which payroll category to sync: Premi, Tunjangan, Potongan Upah Kotor, or Potongan Upah Bersih. The action must identify only not-synced items, shown by red mismatch indicators, then trigger/queue Auto Key-In for only those items.

The reference app at `D:\Gawean Rebinmas\Browser_Auto_key_in new\Auto Key In Refactor` provides the process model: category registry, preview records, `only_missing_rows`, runner payload, session-based Plantware automation, compare-adtrans, sync-status audit, dry-run first, then actual run.

## 2. Reference Findings

- `Auto Key In Refactor` runner accepts `RunPayload` with `category_key`, `only_missing_rows`, `records`, `period_month`, `period_year`, `division_code`, `runner_mode`, `max_tabs`, `headless` in `runner/src/types.ts`.
- Supported category strategy keys include `premi`, `premi_tunjangan`, `potongan_upah_kotor`, and `potongan_upah_bersih` in `runner/src/categories/registry.ts`.
- Auto Key In desktop flow uses config -> get session -> fetch/refresh data -> preview -> run -> summary -> verify db_ptrj.
- Reset/delete mismatch flow uses `/payroll/manual-adjustment/compare-adtrans/by-api-key`, filters `status=MISMATCH`, then re-audits via `/payroll/manual-adjustment/sync-status/by-api-key`.
- Reference app treats dry-run as default safety for destructive or live Plantware operations.

## 3. Target Findings

- Admin role exists in `frontend/src/context/AuthContext.jsx`; production mode sets `user.isAdmin` when role is `ADMIN` or divisi is `ALL` and role is not `VISITOR`.
- Payroll table integration point is `frontend/src/components/CustomPayrollTable.jsx`, which already builds manual adjustment columns and renders mismatch markers.
- Red sync frame already exists: `row.value_sync_frame[field] === 'red'` maps to `cell-sync-red` around `frontend/src/components/CustomPayrollTable.jsx`, styled in `frontend/src/styles/CustomPayrollTable.css`.
- Backend manual adjustment endpoints exist in `backend/src/api/payroll.ts`: `/manual-adjustment/by-api-key`, `/manual-adjustment/check-adtrans/by-api-key`, `/manual-adjustment/compare-adtrans/by-api-key`, `/manual-adjustment/sync-status/by-api-key`, `/manual-adjustment/adtrans-doc-ids/by-api-key`.
- Manual adjustment service has update/sync status behavior in `backend/src/services/manualAdjustmentService.ts` and seeder wrapper in `backend/src/services/manualAdjustmentSyncStatusSeederService.ts`.

## 4. Architecture Decisions

- Keep browser automation out of frontend. Frontend should call a backend orchestration endpoint, not run Node/Playwright directly.
- Add a small backend Auto Key-In gateway/service that can call the existing Auto Key In runner command or a local bridge, using server-side config/env only.
- Reuse existing manual-adjustment compare data as source of truth for unsynced records. UI red cells are display evidence, not sole authority.
- Put admin buttons in a compact toolbar above payroll table or group headers, not inside every cell.
- Use category config mapping so labels and payload keys stay boring and testable.
- Always offer preview count and dry-run before actual Plantware input.
- After run, trigger sync-status audit and refresh table data so red indicators disappear only after backend verification.

## 5. Category Mapping

| UI Label | category_key | adjustment_type | Notes |
| --- | --- | --- | --- |
| Premi | `premi` | `PREMI` | Include premium manual/detail records; consider `premi_tunjangan` if existing data marks it separately. |
| Tunjangan | `premi_tunjangan` or auto-buffer categories | `AUTO_BUFFER`/`PREMI` | Needs explicit scope: tunjangan premi only vs masa kerja/jabatan. Confirm before implementation. |
| Potongan Upah Kotor | `potongan_upah_kotor` | `POTONGAN_KOTOR` | Also maps old `koreksi` key to gross deduction category. |
| Potongan Upah Bersih | `potongan_upah_bersih` | `POTONGAN_BERSIH` | Must preserve DocDesc/adcode mapping from reference runner. |

## 6. Task Breakdown

### IMPL-1 - Baseline audit and ownership guard

Goal: Inspect dirty worktree and confirm source file ownership before implementation.

Files: `frontend/src/components/CustomPayrollTable.jsx`, `frontend/src/styles/CustomPayrollTable.css`, `frontend/src/context/AuthContext.jsx`, `frontend/src/services/manualAdjustmentService.js`, `backend/src/api/payroll.ts`, `backend/src/services/manualAdjustmentService.ts`.

Acceptance:
- Current diffs in target files are reviewed.
- Overlap with active workflow sessions is documented.
- Implementation lane owners are assigned.
- No unrelated uncommitted changes are reverted.

Dependencies: none.

### IMPL-2 - Admin-only UI affordance plan

Goal: Add admin-only sync controls above payroll columns without affecting non-admin users.

Files: `frontend/src/components/CustomPayrollTable.jsx`, optional `frontend/src/components/AdminPayrollSyncToolbar.jsx`, tests beside component.

Acceptance:
- Toolbar/buttons render only when `user.isAdmin === true`.
- Non-admin and visitor users see no sync controls.
- Buttons cover only approved categories: Premi, Tunjangan, Potongan Upah Kotor, Potongan Upah Bersih.
- Button state shows unsynced count per category and disables when count is zero.
- UI copy clearly says only red/not-sync items will be processed.

Dependencies: `IMPL-1`.

### IMPL-3 - Unsynced item detection model

Goal: Normalize table red indicators and backend comparison rows into deterministic category-scoped sync targets.

Files: `frontend/src/utils/payrollSyncTargets.js`, `frontend/src/utils/payrollSyncTargets.test.js`, `frontend/src/components/CustomPayrollTable.jsx`.

Acceptance:
- Function maps `value_sync_frame[field] === 'red'` cells to category keys.
- Function ignores green/synced/empty values.
- Function deduplicates by employee, adjustment name/type, detail key, and field.
- Function returns preview metadata: employee count, record count, amount total, fields affected.
- Tests cover red-only, green ignored, mixed category, zero amount, duplicate details.

Dependencies: `IMPL-2`.

### IMPL-4 - Backend compare preview endpoint

Goal: Provide trusted backend preview for unsynced records before running Auto Key-In.

Files: `backend/src/api/payroll.ts`, `backend/src/services/manualAdjustmentService.ts`, optional `backend/src/services/adminAutoKeyInPreviewService.ts`, backend tests.

Acceptance:
- Endpoint accepts period, division, category, optional gang/employee scope.
- Endpoint calls or reuses compare-adtrans/check-adtrans logic and filters `MISSING`/`MISMATCH` only.
- Endpoint returns records compatible with Auto Key In `ManualAdjustmentRecord` shape.
- Endpoint never exposes API key or Plantware credential to frontend.
- Endpoint validates admin auth or server-side permission before returning runnable payload.

Dependencies: `IMPL-1`, `IMPL-3`.

### IMPL-5 - Auto Key-In backend bridge

Goal: Add backend service that triggers Auto Key In runner safely from payroll app.

Files: `backend/src/services/adminAutoKeyInRunService.ts`, `backend/src/api/payroll.ts`, config/env docs, backend tests.

Acceptance:
- Service builds `RunPayload` with `only_missing_rows: true`, selected `category_key`, and preview records only.
- Default operation is dry-run/preview unless request explicitly confirms actual run.
- Runner command and credentials are read from backend environment/config only.
- Service streams or stores run events/results without blocking API indefinitely.
- Failure returns clear non-sensitive error and does not mutate manual adjustment rows.

Dependencies: `IMPL-4`.

### IMPL-6 - Frontend preview, confirm, and run flow

Goal: Wire admin buttons to preview -> confirm -> run -> refresh workflow.

Files: `frontend/src/services/adminAutoKeyInSyncService.js`, `frontend/src/components/AdminPayrollSyncToolbar.jsx`, `frontend/src/components/CustomPayrollTable.jsx`, tests.

Acceptance:
- Clicking category opens preview modal with unsynced count and affected employees.
- Preview must be available before actual run button is enabled.
- Actual run requires confirmation containing category and count.
- UI shows running/progress/result states.
- On success, frontend refreshes payroll data and/or sync status.

Dependencies: `IMPL-5`.

### IMPL-7 - Post-run sync audit and red indicator refresh

Goal: Ensure red indicators reflect verified backend state after Auto Key-In.

Files: `backend/src/services/manualAdjustmentSyncStatusSeederService.ts`, `backend/src/api/payroll.ts`, `frontend/src/services/adminAutoKeyInSyncService.js`, relevant tests.

Acceptance:
- After runner success, backend calls `/manual-adjustment/sync-status/by-api-key` equivalent service path.
- Audit filters same period/division/category as the run.
- Response includes updated count, unchanged count, mismatch count.
- Frontend refreshes table rows and red/green frames from server state.
- Failed audit shows warning while preserving run result.

Dependencies: `IMPL-5`, `IMPL-6`.

### IMPL-8 - Validation and live-run guardrail

Goal: Verify behavior with focused tests and require manual approval for Plantware live run.

Files: test files only plus docs if needed.

Acceptance:
- `bun test src/services/manualAdjustmentService.test.ts` passes in `backend`.
- New backend tests for preview/run service pass.
- New frontend tests for admin visibility and red-only target selection pass.
- `npm run build` passes in `frontend`.
- Live Plantware actual run remains manual/operator-approved; dry-run can be automated in test/staging.

Dependencies: `IMPL-7`.

## 7. Suggested Execution Order

1. `IMPL-1`
2. `IMPL-2` and `IMPL-3` in frontend lane
3. `IMPL-4` in backend preview lane
4. `IMPL-5` backend runner bridge
5. `IMPL-6` frontend preview/confirm/run flow
6. `IMPL-7` post-run audit refresh
7. `IMPL-8` focused test/build/manual dry-run verification

## 8. Risk Assessment

- High conflict risk: repo has many modified/untracked files, including workflow and payroll areas.
- High operational risk: Plantware Auto Key-In changes production data; dry-run and confirmation gates are mandatory.
- Medium data risk: UI red cells may not include enough metadata to build runner records, so backend compare preview must be trusted source.
- Medium category risk: "Tunjangan" needs product decision: only `TUNJANGAN PREMI`, auto-buffer masa kerja/jabatan, or broader allowance set.
- Medium security risk: existing by-api-key endpoints are automation-friendly; new admin flow must not leak bypass key to browser.
- Medium performance risk: compare and runner jobs can be slow; async job/status pattern may be better than long HTTP request.

## 9. Validation Plan

- Backend focused: `cd backend && bun test src/services/manualAdjustmentService.test.ts`.
- Backend new tests: `cd backend && bun test src/services/adminAutoKeyInRunService.test.ts src/api/payroll.adminAutoKeyIn.test.ts`.
- Frontend focused: `cd frontend && npx vitest run src/utils/payrollSyncTargets.test.js src/components/AdminPayrollSyncToolbar.test.jsx`.
- Frontend build: `cd frontend && npm run build`.
- Browser dry-run: login as admin, open daftar upah, confirm buttons appear, choose each category, verify preview contains only red/not-sync items.
- Non-admin browser check: controls hidden.
- Live run: operator approval only, with row limit/small scope first.

## 10. Open Questions

- Should "Tunjangan" mean only `premi_tunjangan`, or include `masa_kerja`, `tunjangan_jabatan`, THR/other income, and other allowance categories?
- Should actual Auto Key-In be triggered by payroll backend directly, or should backend call the existing Auto Key In app API/runner service if it becomes daemonized?
- Should sync buttons live above entire table, above group header, or inside toolbar near edit/save controls?
- Should MISMATCH first delete existing wrong DocID then input corrected rows, or only input MISSING rows and leave reset/delete to separate flow?
