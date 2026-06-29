: FIX_PLAN.md ===

```markdown
# FIX PLAN — Daftar Upah Refactor Production
**Branch:** `server-dev-merger-1`
**Severities fixed:** 9 CRIT / 16 HIGH / 12 MED / 7 LOW (33 unique)
**Effort key:** S = ≤2h, M = ≤1 day, L = >1 day.

---

## P0 — Critical / data-loss / security (immediate, this branch before merge)

### P0-1 — DB profile routing inverted (ROOT-A, cross-subsystem)
**Subsystem:** Database Profile Routing (drives Seeder + dataExtractor)
**Effort:** M
**Depends on:** none (unblocks P0-3, P0-4)
**Files:**
- `backend/src/config.ts:36` — `DB_PROFILE` default
- `backend/src/config.ts:49` — `DB_EXTEND_PROFILE` default
- `backend/src/services/dataExtractorService.ts:735` — `this.db = Database.getInstance()`
- `backend/src/services/dataExtractorService.ts:3513` — `getTaskCodes` fallback
- `backend/src/services/gangService.ts:27` — hardcoded `"SERVER_PROFILE_1"`
- `backend/src/api/uiBasedSeeder.ts:70` — hardcoded `"SERVER_PROFILE_2"`
**Steps:**
1. Decide canonical mapping: `DB_PROFILE` → `SERVER_PROFILE_2` (payroll `db_ptrj`); `DB_EXTEND_PROFILE` → `SERVER_PROFILE_1` (`extend_db_ptrj`). Flip defaults in `config.ts` so a missing `.env` lands on the payroll DB, not the history DB. Keep `.env` authoritative in prod.
2. `dataExtractorService.ts:735` → `this.db = Database.getInstance(undefined, Config.DB_PROFILE)`. Existing callers passing explicit `SERVER_PROFILE_2` keep working.
3. `gangService.ts:27` estate return → `return Config.DB_PROFILE;` (mill stays `SERVER_PROFILE_3`).
4. `uiBasedSeeder.ts:70` → replace literal `"SERVER_PROFILE_2"` with `Config.DB_PROFILE`.
5. Add startup assertion in config init: `SELECT TOP 1 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='PR_TASKREG'` against `DB_PROFILE`; warn to logs if missing.
**Acceptance:**
- `dataExtractorService.getTaskCodes()` returns rows with no explicit `serverProfile` arg in a prod-shaped env.
- `gangService.getServerProfile()` reflects `.env` changes.
- Startup log shows resolved profile + table reachability.

### P0-2 — THP/taxable flags dropped end-to-end (ROOT-B)
**Subsystem:** payroll_manual_adjustments / employee_other_incomes
**Effort:** S
**Depends on:** none
**Files:**
- `backend/src/services/dataExtractorService.ts:4969-4970` — SELECT
- `backend/src/services/manualAdjustmentService.ts:2149` — hardcoded `is_paid_in_thp=0`
- `backend/src/api/payroll.ts:2322` — hardcoded `is_paid_in_thp=1`
**Steps:**
1. Add `is_paid_in_thp, is_taxable` to SELECT at `dataExtractorService.ts:4969-4970`.
2. `manualAdjustmentService.ts:2149` — replace hardcoded `0` with the incoming `isPaidInThp`/`isTaxable` from the adjustment payload (derive defaults by `adjustment_type`: KONTAN→thp1/tax0, BONUS/EXGRATIA→thp0/tax1, unless caller overrides).
3. `payroll.ts:2322` — parameterize INSERT: pass `isPaidInThp`, `isTaxable` instead of literal `1` and `?`.
4. Add a one-line assert self-check: after extraction, fail loud if any row has `is_taxable===undefined`.
**Acceptance:**
- A `BONUS` row with `is_taxable=1` in DB contributes to taxable income in tax report.
- KONTAN THP inclusion is consistent across `saveAdjustment` and `/locked/pendapatan-lainnya-edit`.

### P0-3 — Manual adjustments missing from payroll_history snapshot
**Subsystem:** payroll_manual_adjustments / employee_other_incomes
**Effort:** M
**Depends on:** P0-2 (so merged values carry correct flags)
**Files:** `backend/src/services/historyDatabaseService.ts:1027-1060, :1186-1191`
**Steps:**
1. Before the `payroll_history_detail` INSERT, fetch `payroll_manual_adjustments` for `(period, emp_code)`.
2. Merge adjustments into the detail row (override premi/potongan/pendapatan-lainnya fields), OR serialize into `dynamic_premi_data`/`dynamic_potongan_data` JSON columns as an `adjustments` array.
3. Document the merge order: seed > manual override (manual wins).
**Acceptance:**
- After a post-seed edit + history re-seed, `payroll_history_detail` reflects the manual override.
- Re-running payroll from history reproduces the edited totals.

### P0-4 — Cross-division data destruction: seeder DELETE missing division_code
**Subsystem:** Seeder / Aggregation
**Effort:** S
**Depends on:** none
**Files:**
- `backend/src/api/uiBasedSeeder.ts:104-106`
- `backend/src/api/aggregationSeederRoutes.ts:1076-1078`
- `backend/src/api/parallelAggregationSeeder.ts:64-65` (parallelAggregator)
**Steps:**
1. Add `AND division_code = ?` to all three DELETE WHERE clauses; pass `division` param.
2. Verify `aggregationSeederRoutes.ts:799-804` (already correct) remains the reference pattern.
**Acceptance:**
- Seeding division PG1A does not delete PG2A rows even when gang_codes collide.

### P0-5 — No cache invalidation after seeder write (ROOT-C)
**Subsystem:** Seeder / Aggregation
**Effort:** S
**Depends on:** none
**Files:**
- `backend/src/api/aggregationSeederRoutes.ts:~1013`
- `backend/src/api/parallelAggregationSeeder.ts` (parallelAggregator `:~144`)
- `backend/src/api/uiBasedSeeder.ts:~187`
**Steps:**
1. After each seeder's final INSERT, `await cacheService.clearByPattern(\`:${month}:${year}\`)`.
2. Confirm `cacheService` import path matches `payroll.ts` usage.
**Acceptance:**
- After a seeder run, frontend `/payroll` read returns fresh aggregation totals (no stale cache hit).

### P0-6 — KERANI division-gate absent on writes (CRITICAL, security)
**Subsystem:** Auth / Access Control
**Effort:** M
**Depends on:** none
**Files:** `backend/src/api/payroll.ts:565-698, :750-866, :1053-1179, :2109-2345` (all write handlers)
**Steps:**
1. Extract the division-gate from `locked/report/raw-tree` (`:1963-1985`) into a helper `assertDivisionOwnership(currentUser, divisionCode)`.
2. Call it at the top of every write handler; `403` on mismatch.
3. Normalize payload `division_code` via `divisionDefinition.resolveDivisionCode` before compare.
**Acceptance:**
- `kerani_pg2a` POST with `division_code=PG1A` → 403.
- Admin still writes to any division.

### P0-7 — Unguarded income-delete endpoint (CRITICAL, security)
**Subsystem:** Auth / Access Control
**Effort:** S
**Depends on:** P0-6 (helper reuse)
**Files:** `backend/src/api/payroll.ts:2200-2237`
**Steps:**
1. Require `currentUser.role === UserRole.ADMIN` (else 403).
2. For KERANI (if later allowed), add `assertDivisionOwnership` scoped to the NIK's division.
3. Validate `income_type` against an allowlist (`['THR','BONUS','EXGRATIA','KONTAN', ...]`).
**Acceptance:**
- KERANI/VISITOR → 403 on `/locked/income-delete`.
- ADMIN can still delete; invalid `income_type` → 400.

---

## P1 — High (this sprint)

| ID | Title | Subsystem | Effort | Deps | Acceptance |
|---|---|---|---|---|---|
| P1-1 | Frontend remarks call buildManualAdjustmentRemarks (F4) | manual_adjustments | M | P0-2 | UI save preserves `sync:MANUAL`; seeder skips re-seeded rows |
| P1-2 | Seeder updated count increment (F5) | manual_adjustments | S | — | `updated` reflects `action==='updated'` |
| P1-3 | takeToken on /by-api-key POST (F6, F39) | Auth | S | — | API-key writes throttled |
| P1-4 | resolveAdjustedJabatanJumlah in annual+December (F7) | jabatan | S | — | All 3 paths use resolver |
| P1-5 | SeederOptions.createdBy optional (F14) | Seeder | S | — | tsc strict passes; callers don't pass createdBy |
| P1-6 | Remove auto-trigger from per-division loop (F17) | Seeder | M | P0-4 | No stale-read window; history seeder runs after all divisions |
| P1-7 | Split isHistoryMode gate (F31) | Snapshot | M | — | `useHistoryDb=true` forces history path in dev |
| P1-8 | Document/db_ptrj_only coupling (F32) | Snapshot | S | — | Field renamed or commented; contract in README |
| P1-9 | Scope available_snapshot_versions (F33) | Snapshot | S | — | Scoped query or error object on scope mismatch |
| P1-10 | API-key role/division scoping (F39) | Auth | M | P0-6 | API-key cannot write SYNC_STATUS; division-checked |
| P1-11 | takeToken on all write endpoints (F40) | Auth | M | — | Every POST/DELETE mutator rate-limited |
| P1-12 | /seed + /seed-ui role gate ADMIN (F41) | Auth | S | — | VISITOR token → 403 on seed |
| P1-13 | CSRF Origin guard + lockout on /by-api-key (F43) | Auth | M | P1-3 | No-origin request → 403; repeated key failures → lockout |

---

## P2 — Medium (next sprint)

| ID | Title | Subsystem | Effort | Deps | Acceptance |
|---|---|---|---|---|---|
| P2-1 | Centralize jabatan fallback rate*hari_kerja (F8) | jabatan | S | P1-4 | Single fallback in `resolveAdjustedJabatanJumlah` |
| P2-2 | Implement attachPayrollPeriodAdjustmentNotes (F10) | jabatan | M | P1-4 | Annotation column in tax Excel |
| P2-3 | Wire jabatan_rate into PayrollCalculator (F11) | jabatan | M | P2-1 | Decision doc + rate consumed if rate-based |
| P2-4 | Document snapshot_version flat vs versioned (F18) | Seeder | S | — | README + config comment |
| P2-5 | Dedupe DIVISION_CODE_MAP to shared util (F19) | Seeder | S | — | Single `divisionCodeMap.ts` import |
| P2-6 | validatePeriod uses Config.DB_PROFILE (F22) | Seeder | S | P0-1 | Validation creds match extraction creds |
| P2-7 | dashboardService startup SELECT 1 health check (F26) | DB Profile | S | P0-1 | Warn to logs if extend_db_ptrj unreachable |
| P2-8 | Progressive stream is_history_snapshot in meta (F34) | Snapshot | S | — | SSE sends true when serving snapshot |
| P2-9 | Normalize is_history_snapshot location (F35) | Snapshot | S | P2-8 | Always inside `meta` in both APIs |
| P2-10 | Standardize NULL vs 0 snapshot_version (F36) | Snapshot | M | — | Seeder writes >=1; partial unique index on NULL |
| P2-11 | API-key bypass identity in username (F42) | Auth | S | P1-10 | Audit log shows key purpose |

---

## P3 — Low (backlog)

| ID | Title | Subsystem | Effort | Acceptance |
|---|---|---|---|---|
| P3-1 | Normalize tunjangan_jabatan→jabatan_jumlah (F9) | jabatan | S | One field name; dataExtractor sets both for compat |
| P3-2 | Route 3 jabatan query paths through repository (F12) | jabatan | M | Single `getTunjanganJabatan()` caller |
| P3-3 | Cast rowsAffected[0] or fix QueryResponse type (F13) | Seeder | S | Type matches driver behavior |
| P3-4 | Prefix useParallel with _ or comment (F15) | Seeder | S | No misleading variable |
| P3-5 | source_endpoint enum/const (F20) | Seeder | S | Consistent literals |
| P3-6 | Remove PayrollService dead this.db (F28) | DB Profile | S | No dead field |
| P3-7 | (No action) Debug scripts (F29) | DB Profile | — | Acceptable dev-only |
| P3-8 | (No action) isAdminUser regression test (F44) | Auth | S | Add KERANI-blocked test |

---

## Quick wins (<1hr each)
- **P1-2** Seeder updated count: one `if` line in `autoBufferManualAdjustmentSeederService.ts:467`.
- **P1-3** `takeToken(1)` in `/by-api-key` POST handler `payroll.ts:943`.
- **P1-5** `createdBy?: string` in `historySeederService.ts:49`.
- **P1-12** `if (currentUser?.role !== UserRole.ADMIN) return 403` in `/seed` + `/seed-ui`.
- **P0-2 step 1** Add `is_paid_in_thp, is_taxable` to one SELECT (`dataExtractorService.ts:4969`).
- **P3-6** Delete `this.db` line in `payrollService.ts:18`.
- **P3-4** Rename `useParallel` → `_useParallel` in `aggregationSeederRoutes.ts:95`.
- **P2-5** Extract `DIVISION_CODE_MAP` to `backend/src/utils/divisionCodeMap.ts`, delete dead module-level copy at `parallelAggregationSeeder.ts:23-28`.

---

## DO NOT BREAK (untouchable invariants)

- **PTRJ `AccMonth` = calendar month rule.** Period math (`period_month`/`period_year`) must remain 1:1 with calendar months. Do not "fix" accrual timing.
- **Business calculation logic.** Tax brackets, PTKP tiers, `jabatan_rate * hari_kerja`, brondol static rollup, dynamic premi keyword mapping (`PR_ADTRANS` DocDesc `LIKE '%JABATAN%'` filter), koreksi dynamic potongan — leave formulas intact. F8/F11 only *centralize* the fallback, do not change the multiplier semantics without business sign-off.
- **Letter-prefixed PTRJ EmpCode for `PR_ADTRANS`.** Queries require letter-prefixed EmpCode, not numeric NIK. Do not "normalize" to numeric.
- **`SERVER_PROFILE_3` (VenusHR14) is ONLY for** employee master data + FFB weight (`db_ptrj_mill`). Never route `extend_db_ptrj` or analysis queries here. (CLAUDE.md mandate.)
- **`extend_db_ptrj` + `SERVER_PROFILE_1`** is the mandatory profile for aggregation history + analysis report + `daftar_upah_aggregation_history`. P0-1 flips the *default* for `DB_PROFILE` only, NOT `DB_EXTEND_PROFILE` — `DB_EXTEND_PROFILE` stays `SERVER_PROFILE_1`.
- **Cache key format** `:${month}:${year}` and `:${month}:${year}:${division}`. P0-5 reuses existing `clearByPattern`; do not introduce a new key scheme.
- **`payroll_history_header` uniqueness** includes `snapshot_version` (`payrollSnapshotBatchService.ts:52-84`). P2-10 adds a partial unique index on NULL sentinel — do not drop the existing composite uniqueness.
- **Seeder protection markers** `sync:MANUAL`, `AD CODE:` in remarks. P1-1 must *preserve* these, not rewrite the format.
- **Merge order in history** seed > manual override (manual wins). P0-3 honors this; do not invert.
- **`isPipeDelimitedRemarks()` preservation** (`manualAdjustmentService.ts:395-414`). Keep the guard; route frontend through it rather than removing it.

---

## Recommended order
1. P0-1 (DB profile) — unblocks P0-3, P0-4 verification, P2-6, P2-7.
2. P0-2 (THP/taxable SELECT + INSERT) — unblocks P0-3, P1-1.
3. P0-4 + P0-5 (seeder DELETE scope + cache) — independent, ship together.
4. P0-6 + P0-7 (division-gate + income-delete) — security, independent of data fixes.
5. P0-3 (history snapshot merge) — after P0-2.
6. P1 batch (observability + rate-limit + role gates).
7. P2/P3 as capacity allows.
```

Both documents reference verified file:line locations. P0-1 (ROOT-A) and P0-2 (ROOT-B) are the cross-subsystem root causes flagged in the executive summary; fixing them collapses 6 of the 9 critical items.
