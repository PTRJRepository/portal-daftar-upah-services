# Planning Context: GET /payroll/staging-comparison

## Task Summary
Add a new GET endpoint at `/payroll/staging-comparison` (Elysia prefix). Real URL via proxy: `http://localhost:3001/backend/upah/payroll/staging-comparison`. Returns monthly brondol (loosefruit) selisih (staging vs plantware) aggregated per employee per periode. Identity fields included.

## Evidence Paths

### Codebase Anchors
- `backend/src/api/payroll.ts:187` — Elysia chain export `payrollRoutes` (prefix `/payroll`). Append new route at end of chain.
- `backend/src/api/payroll.ts:3585-3599` — Last route in chain (premium-seeder/template). New route appends after this.
- `backend/src/services/additional_service/explore_staging/stagingComparisonService.ts:57-1180` — Host service with reusable patterns.
- `backend/src/services/additional_service/explore_staging/stagingComparisonService.ts:90-112` — `getEmpInfo()` returns `{name, gang_code, division}` map keyed by EmpCode. Reusable.
- `backend/src/services/additional_service/explore_staging/stagingComparisonService.ts:932-980` — `monthlyLoosefruit(month, year, gang?, division?)` — already does exactly the staging vs prod loosefruit per employee per month. **Reuse as-is** (no internal refactor needed; output already has the right shape).
- `backend/src/services/additional_service/explore_staging/stagingComparisonService.test.ts:1-39` — bun:test regression tests. Add 1 case for new route handler logic.
- `backend/src/config.ts:36,49,52` — DB profiles: SERVER_PROFILE_1 (default db_ptrj) and SERVER_PROFILE_2 (staging). No getVenusInstance needed (HR_EMPLOYEE is on db_ptrj SERVER_PROFILE_1).
- `backend/src/api/stagingRoutes.ts:121-156` — Existing `/compare/brondol-missing` route. Direct template for envelope and error handling.

### Existing Return Shape of monthlyLoosefruit (already matches user spec)
```ts
{
  rows: [{
    emp_code, emp_name, gang_code, division,
    staging_bunches, staging_trx,
    prod_mt, prod_days,
    delta,                 // = staging_bunches - prod_mt (signed)
    status: 'match' | 'diff' | 'miss'
  }],
  summary: { total, match, diff, pct_match }
}
```

## User Clarifications (final decisions)
1. Envelope: `{ success, data: { rows, summary } }` — matches monthlyLoosefruit directly
2. Selisih direction: signed (staging - prod) — `delta` field is already signed
3. NIK: SKIP — do not include
4. Estate source: `estate = LocCode` — re-use `division` field name from existing `getEmpInfo()` (HR_GANG.LocCode). Rename `division` → `estate` in row output if user-facing, but to match existing data, keep as `division` (HR_GANG.LocCode IS the estate code per the codebase convention).
5. Test scope: service regression test only

## Database Strategy
- Staging: `Database.getStagingInstance()` (SERVER_PROFILE_2, `staging_PTRJ_iFES_Plantware.dbo.Ffbscannerdata` column LOOSEFRUIT)
- Prod: `Database.getInstance()` (SERVER_PROFILE_1, `db_ptrj.dbo.PR_LOOSEFRUITLN` column MT)
- Master: HR_EMPLOYEE + HR_GANGLN + HR_GANG on db_ptrj (SERVER_PROFILE_1, getInstance())
- No SERVER_PROFILE_3 / VenusHR14 / getVenusInstance needed
- Per CLAUDE.md: `db_ptrj` and `extend_db_ptrj` use SERVER_PROFILE_1 — safe.

## Implementation Approach
1. **New route** in `backend/src/api/payroll.ts` (append to chain, before final closing):
   - Import `StagingComparisonService` (already imported via staging routes — need new import in payroll.ts)
   - Add `.get("/staging-comparison", handler, { query: schema })`
   - Handler splits `periode` (YYYY-MM) into month+year, defaults to current month
   - Calls `StagingComparisonService.getInstance().monthlyLoosefruit(month, year, gang, division)`
   - Returns `{ success: true, data: { rows, summary } }`
2. **No service refactor needed** — `monthlyLoosefruit` already returns the right shape (signed delta, status, identity fields).
3. **Test** in `stagingComparisonService.test.ts` — 1 new case: `monthlyLoosefruit(5, 2026)` returns shape `{ rows, summary }` with status field per row.

## Files to Change
- `backend/src/api/payroll.ts` — add 1 import + 1 route (≈25 lines)
- `backend/src/services/additional_service/explore_staging/stagingComparisonService.test.ts` — add 1 test case (≈12 lines)

## Risks
- `monthlyLoosefruit` was named "Loosefruit" in the original codebase; user calls it "brondol". The output `emp_code`, `staging_bunches`, `prod_mt`, `delta` (signed), `status` matches what user described as "staging_brondol, plantware_brondol, selisih". **Reuse as-is**.
- Periode parsing: helper needed for `YYYY-MM` → `{month, year}`. Place inline in handler (or a 3-line helper in payroll.ts).

## Effort Estimate
~30 minutes
