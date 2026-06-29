# AUDIT REPORT — Daftar Upah Refactor Production
**Repo:** `D:/Gawean Rebinmas/PORTAL_ESTATE/Plantware_Auto_Report/Daftar_Upah_baru/payroll_daftar_upah/refactor_production`
**Branch:** `server-dev-merger-1`
**Audited:** 2026-06-28
**Scope:** 6 parallel auditor passes, 40 raw findings (deduplicated into 33 unique items).

---

## 1. Executive Summary

### Counts by severity (unique items)
| Severity | Count |
|---|---|
| Critical | 9 |
| High | 16 |
| Medium | 12 |
| Low | 7 |
| **Total** | **33** (40 raw → 33 after cross-auditor dedup) |

### Top 5 risks
1. **DB profile routing inverted (cross-subsystem root cause).** `Config.DB_PROFILE` defaults to `SERVER_PROFILE_1` (= `extend_db_ptrj`, the history DB), but payroll tables (`PR_TASKREGLN`, `HR_*`) live on `SERVER_PROFILE_2` (`db_ptrj`). `dataExtractorService.ts:735` `this.db = Database.getInstance()` and `getTaskCodes` (`:3513`) both default to the wrong DB. In prod where the profiles diverge: 500 errors or empty data; where they resolve to the same server: silently wrong data. Drives findings #23, #24, #27, #30.
2. **THP/taxable flags dropped end-to-end.** Extractor SELECT (`dataExtractorService.ts:4969-4970`) fetches neither `is_paid_in_thp` nor `is_taxable`; Phase 4b reads (`:1328, :1344`) are therefore always falsy. Save paths hardcode opposite values (`manualAdjustmentService.ts:2149` → 0; `payroll.ts:2322` → 1). Net effect: BONUS/EXGRATIA treated non-taxable, KONTAN THP behavior depends on save path. Tax undercalculated silently.
3. **Cross-division data destruction.** `uiBasedSeeder.ts:104-106` DELETE scopes only on `(period_month, period_year, gang_code)` — no `division_code`. If two divisions share a gang_code scheme, one seeder run wipes the other's aggregation history. Same gap in `aggregationSeederRoutes.ts:1076-1078` and `parallelAggregator.ts:64-65`.
4. **Division-gate enforced on reads, absent on writes.** Locked read endpoints (`payroll.ts:1963`, `:2403`) correctly check KERANI division ownership; all write endpoints (`:565, :750, :1053, :1179, :2109, :2239`) do not. `income-delete` (`:2200`) checks nothing but `currentUser` — any authenticated user deletes any income for any NIK in any period/division.
5. **Manual adjustments missing from payroll_history snapshot.** `historyDatabaseService.ts` writes `payroll_history_detail` from aggregated/extracted data only; no join of `payroll_manual_adjustments`. Post-seeding premium/potongan/pendapatan-lainnya edits vanish from the period snapshot. Re-running payroll from history silently drops all post-seed edits (data-integrity loss, not a crash).

### Cross-subsystem root causes (explicit)
- **ROOT-A — DB profile default backwards.** `config.ts:36, :49` set `DB_PROFILE`/`DB_EXTEND_PROFILE` both to `SERVER_PROFILE_1`. Propagates to `dataExtractorService.ts:735`, `:3513`, `gangService.ts:27`, and `uiBasedSeeder.ts:70` (which hardcodes the *other* value). One fix at the config + three call-sites clears findings #23, #24, #27, #30 and most of #22.
- **ROOT-B — THP/taxable hardcoded + SELECT omission.** Cluster of findings #1, #2. One SELECT edit + parameterizing two INSERT sites fixes the cluster.
- **ROOT-C — Seeder cache invalidation missing.** `payroll.ts` mutators invalidate cache 10+ times; seeder write paths (`aggregationSeederRoutes`, `parallelAggregator`, `uiBasedSeeder`) do it zero times. Finding #21.
- **ROOT-D — Bypass identity / rate-limit gap.** `authBypass.ts:40-65` creates ADMIN-equivalent sessions; `/by-api-key` and most write endpoints skip `takeToken`. Cluster of findings #6, #35, #36, #40.

---

## 2. Per-Subsystem Findings Table

### 2.1 `payroll_manual_adjustments / employee_other_incomes`
| # | Sev | Title | Files | Impact |
|---|---|---|---|---|
| 1 | CRIT | Extractor SELECT omits is_paid_in_thp and is_taxable | dataExtractorService.ts:4968-4974; :1328-1344 | All `employee_other_incomes` rows treated as non-THP and non-taxable regardless of DB flags |
| 2 | CRIT | is_paid_in_thp hardcoded opposite values in saveAdjustment vs locked endpoint | manualAdjustmentService.ts:2149; payroll.ts:2322 | KONTAN THP behavior depends on save path; BONUS/EXGRATIA always non-taxable via saveAdjustment |
| 3 | CRIT | Manual adjustments not written to payroll_history snapshot | historyDatabaseService.ts:1027-1060; :1186-1191 | Post-seed edits absent from history snapshot; re-run from history drops all edits |
| 4 | HIGH | Frontend remarks bypass buildManualAdjustmentRemarks, breaks seeder protection | CustomPayrollTable.jsx:1792, :1880; manualAdjustmentService.ts:395-414 | Every UI save strips `sync:MANUAL` markers; manual edits re-seeded/overwritten |
| 5 | HIGH | Seeder updated count always 0, masking update behavior | autoBufferManualAdjustmentSeederService.ts:420; :467 | Seed observability broken; update bugs undetected |
| 6 | HIGH | API-key bypass endpoint has no rate limiting | payroll.ts:568-571; :943-982 | Unthrottled writes via API key |

### 2.2 `jabatan / tunjangan jabatan subsystem`
| # | Sev | Title | Files | Impact |
|---|---|---|---|---|
| 7 | HIGH | resolveAdjustedJabatanJumlah called in monthly but NOT in annual/December | taxReportService.ts:638-642; :1137; :1877; payrollPeriodAdjustments.ts:37-45 | Monthly respects stub override; annual/December bypass — permanent divergence once override is real |
| 8 | MED | Divergent fallback formulas for missing PR_ADTRANS JABATAN rows | otherIncomesService.ts:1543-1546; TunjanganService.ts:42 | rate*30 vs rate*hari_kerja → different amounts for same employee |
| 9 | LOW | Duplicate field names tunjangan_jabatan vs jabatan_jumlah; source sets one | taxReportService.ts:255-256, :284-285; taxReportExcelService.ts:499; dataExtractorService.ts:1988-1994 | Misleading `??` chain always falls through |
| 10 | MED | attachPayrollPeriodAdjustmentNotes is a no-op stub, no consumer | payrollPeriodAdjustments.ts:71-76; taxReportService.ts:665 | Dead code; no provenance surfaced to reports |
| 11 | MED | TunjanganService derives jabatan_rate but never wired into PayrollCalculator | TunjanganService.ts:42, :68; dataExtractorService.ts:1988-1994, :2077; PayrollCalculator.ts:48 | Rate exists in phase-3 only, never consumed downstream |
| 12 | LOW | Three parallel query paths for same jabatan data | reportService.ts:518; dataExtractorService.ts:3161-3176, :4444; PayrollTunjanganRepository.ts:37-52 | Latent divergence between archived vs pre-aggregated totals |

### 2.3 `Seeder / Aggregation / Data Update Subsystem`
| # | Sev | Title | Files | Impact |
|---|---|---|---|---|
| 13 | LOW | rowsAffected treated as scalar, declared as array in QueryResponse | parallelAggregationSeeder.ts:68; aggregationSeederRoutes.ts:806; uiBasedSeeder.ts:53 | Type wrong; silently 0/NaN if driver returns multi result-set |
| 14 | HIGH | SeederOptions.createdBy required by interface, never passed by any caller | historySeederService.ts:49-59; aggregationSeederRoutes.ts:918-924, :983-990; parallelAggregationSeeder.ts:332-337 | TS should error; service defaults to 'system' but interface lies |
| 15 | LOW | useParallel accepted from API body, silently discarded | aggregationSeederRoutes.ts:95-104; parallelAggregationSeeder.ts:38 | Misleading variable; route-only flag |
| 16 | CRIT | uiBasedSeeder DELETE misses division_code — cross-division data destruction | uiBasedSeeder.ts:104-106; aggregationSeederRoutes.ts:799-804, :1076-1078; parallelAggregator.ts:64-65 | One division's seeder wipes another's aggregation history |
| 17 | HIGH | Auto-triggered history seeder cleanup deletes aggregation seeder's recent writes | historySeederService.ts:125, :165-181; aggregationSeederRoutes.ts:918-924, :983-990 | Brief stale-read window per division inside loop |
| 18 | MED | snapshot_version in payroll_history_header but not aggregation_history; paths undocumented | historyDatabaseService.ts:1136-1152, :1159-1171; autoBufferSeeder.ts:362; aggregationSeederRoutes.ts:1083 | Confusing flat-table vs versioned-table contract |
| 19 | MED | DIVISION_CODE_MAP duplicated 3 places; dead code in parallelAggregator module scope | parallelAggregationSeeder.ts:23-28, :53-58; aggregationSeederRoutes.ts:1147-1153 | Dead module-level map; sequential vs parallel can diverge |
| 20 | LOW | source_endpoint written with 3 literals, never read | parallelAggregationSeeder.ts:38; aggregationSeederRoutes.ts:818; uiBasedSeeder.ts:163 | Write-only audit column; inconsistent naming |
| 21 | CRIT | No cache invalidation after any seeder write — stale reads | aggregationSeederRoutes.ts; parallelAggregationSeeder.ts; uiBasedSeeder.ts; payroll.ts:591-1106 | Frontend renders outdated aggregation totals after seed |

### 2.4 `Database Profile Routing`
| # | Sev | Title | Files | Impact |
|---|---|---|---|---|
| 22 | MED | uiBasedSeeder hardcodes SERVER_PROFILE_2; validatePeriod bypasses Config | uiBasedSeeder.ts:70; autoBufferSeeder.ts:517, :350-364 | Inconsistent routing; validation against different creds than extraction |
| 23 | CRIT | dataExtractorService.this.db defaults to SERVER_PROFILE_1 — payroll queries use wrong DB | dataExtractorService.ts:735, :2578+, :2280 | 500 or empty data in prod; silent wrong data if profiles resolve same |
| 24 | HIGH | gangService.getServerProfile() hardcodes SERVER_PROFILE_1 | gangService.ts:27, :77 | Estate gang queries hit wrong profile; downstream consumers wrong |
| 25 | HIGH | Config.DB_PROFILE default points to extend_db_ptrj (SERVER_PROFILE_1) — backwards | config.ts:36, :49 | Any bare `getInstance()` hits history DB, not payroll DB |
| 26 | MED | dashboardService uses Config.DB_EXTEND_PROFILE with no runtime validation | dashboardService.ts:44 | Silent empty charts if profile can't reach extend_db_ptrj |
| 27 | MED | getServerProfile() hardcodes SERVER_PROFILE_1 — not configurable via .env | gangService.ts:27 | (duplicate root of #24) gang routing ignores Config |
| 28 | LOW | PayrollService dead this.db field on wrong profile | payrollService.ts:18 | Dead code; risk of future misuse |
| 29 | INFO | Debug scripts hardcode profile strings — acceptable dev-only | debug_arc.ts:6; debug_profiles.ts:9 | No production impact; no fix needed |
| 30 | CRIT | getTaskCodes default targets extend_db_ptrj — task display broken in prod | dataExtractorService.ts:3513 | Task type display fails/empty in prod unless explicit SERVER_PROFILE_2 |

### 2.5 `SNAPSHOT/HISTORY data flow`
| # | Sev | Title | Files | Impact |
|---|---|---|---|---|
| 31 | HIGH | isHistoryMode gate masks history branch in dev | historyDatabaseService.ts:380-382; dataExtractorService.ts:818, :821-825 | Entire history branch untestable in dev; bugs surface in prod only |
| 32 | HIGH | History branch only reachable via valuePriorityMode=db_ptrj_only | dataExtractorService.ts:827-828, :851-858 | Snapshot is opt-in, not a universal historical fallback |
| 33 | HIGH | Silent null when requested snapshot version covers period globally but not division/gang | historyDatabaseService.ts:1157-1174 | 404 with no actionable signal that version doesn't cover scope |
| 34 | MED | Progressive stream history yield omits is_history_snapshot from meta | dataExtractorService.ts:765-772, :3896-3910; payroll.ts:3057-3060 | SSE always sends false even when serving snapshot |
| 35 | MED | is_history_snapshot field location inconsistent payroll stream vs taxReport | taxReportRoutes.ts:795-809; payroll.ts:1268, :3057-3061 | Frontend must know both location and absence |
| 36 | MED | NULL vs 0 snapshot_version ambiguity in snapshot read/write parity | historyDatabaseService.ts:1137-1152; payrollSnapshotBatchService.ts:52-84 | Version 0 matches NULL and real-0; unversioned seeders accumulate |

### 2.6 `Auth / Access Control`
| # | Sev | Title | Files | Impact |
|---|---|---|---|---|
| 37 | CRIT | KERANI can mutate data for unauthorized divisions — division-gate on reads only | payroll.ts:565-698, :750-866, :1053-1179, :2109-2345, :1963-1985 | Cross-division data mutation by kerani_pg2a writing division_code=PG1A |
| 38 | CRIT | Unguarded income-delete endpoint — any authenticated user deletes any income | payroll.ts:2200-2237 | KERANI/VISITOR can delete THR/BONUS/KONTAN for any NIK/period |
| 39 | HIGH | API-key bypass grants ADMIN-equivalent without role/division scoping or rate limiting | authBypass.ts:40-51; payroll.ts:943-982, :1771-1834, :1296-1597, :1836-1874 | API-key writes to any division at full speed; audit = 'api_key_bypass' |
| 40 | HIGH | Most authenticated write endpoints missing Phase 4.4 rate limiter | payroll.ts:1876-1934, :2109-2345, :1053-1179, :3137-3155, :3662-3745 | Flood DB with writes; /locked/income-delete also no role gate |
| 41 | HIGH | Aggregation seeder endpoints accept any Bearer token — VISITOR can seed | aggregationSeederRoutes.ts:87-128, :130-166; authBypass.ts:68-81; uiBasedSeeder.ts:26-203 | Compromised visitor token wipes division aggregation history |
| 42 | MED | API-key bypass identity opaque in audit logs — 3 bypass mechanisms indistinguishable | authBypass.ts:40-65; authService.ts:147-159; payroll.ts:953 | No traceability to which key holder performed action |
| 43 | HIGH | No CSRF/origin validation and no brute-force protection on API-key auth | payroll.ts:1296-1597; authBypass.ts:28-34 | sync-adtrans writes with no origin check; key is plain string compare |
| 44 | LOW | isAdminUser out-of-scope bug confirmed fixed — no regression | App.jsx:54-60, :100-106, :257; ReportContext.jsx:212 | No fix needed |

---

## 3. Detailed Findings

### F1 — Extractor SELECT omits is_paid_in_thp and is_taxable (CRITICAL)
**Evidence:** `dataExtractorService.ts:4968-4974`
```sql
SELECT RTRIM(emp_code) as emp_code, RTRIM(nik) as nik, RTRIM(income_type) as income_type,
       RTRIM(income_name) as income_name, amount
FROM dbo.employee_other_incomes
WHERE period_month = ? AND period_year = ?
```
`dataExtractorService.ts:1328` `if (inc.is_paid_in_thp)` and `:1344` `if (inc.is_taxable)` — both always falsy.
**Impact:** THR/BONUS rows with `is_taxable=1` in DB ignored in tax math. All other incomes treated as non-THP.
**Fix:** Add `is_paid_in_thp, is_taxable` to SELECT at `:4969-4970`.

### F2 — is_paid_in_thp hardcoded opposite values (CRITICAL)
**Evidence:** `manualAdjustmentService.ts:2149` hardcodes `is_paid_in_thp=0`. `payroll.ts:2322` hardcodes `is_paid_in_thp=1` in INSERT VALUES — `isPaidInThp` body var computed but unused. `manualAdjustmentService.ts` also hardcodes `is_taxable=0` for BONUS/EXGRATIA.
**Impact:** Same KONTAN income: THP-included via locked endpoint, THP-excluded via saveAdjustment. BONUS/EXGRATIA always non-taxable via saveAdjustment → tax undercalculated silently.
**Fix:** Insert `isPaidInThp` and `isTaxable` as parameters at `:2323` instead of hardcoded `1`/`?`. Pass `is_taxable` through from `adjustment_type` matching locked-endpoint logic.

### F3 — Manual adjustments not written to payroll_history snapshot (CRITICAL)
**Evidence:** `historyDatabaseService.ts:1027-1060` writes `payroll_history_detail` from aggregated/extracted data only. No join of `payroll_manual_adjustments`. `dynamic_premi_data`/`dynamic_potongan_data` (`:1186-1191`) store header JSON only.
**Impact:** Post-seeding premium corrections, potongan overrides, pendapatan lainnya absent from period snapshot. Re-running payroll from history or auditing silently drops all post-seed edits.
**Fix:** Before inserting `payroll_history_detail`, fetch `payroll_manual_adjustments` for period+emp and merge, OR serialize into `dynamic_premi_data`/`dynamic_potongan_data` JSON.

### F4 — Frontend remarks bypass buildManualAdjustmentRemarks (HIGH)
**Evidence:** `CustomPayrollTable.jsx:1792, :1880` builds pipe-delimited remarks inline. `manualAdjustmentService.ts:401-403` `isPipeDelimitedRemarks()` preserves existing remarks — dead for UI saves. Frontend overwrites fresh strings, stripping `sync:MANUAL` and `AD CODE:` markers.
**Impact:** Every UI save resets `sync:MANUAL` → seeder protection broken. Manual edits re-seeded/overwritten every seed run.
**Fix:** Expose `buildManualAdjustmentRemarks()` via shared util or call server-side before save. At minimum, frontend emits `sync:MANUAL` in remarks for user-initiated edits.

### F5 — Seeder updated count always 0 (HIGH)
**Evidence:** `autoBufferManualAdjustmentSeederService.ts:420` `let updated = 0` — never incremented. `:467` returns `updated:0` always.
**Impact:** Seed observability broken; callers can't detect updates. Update bugs undetected.
**Fix:** `if ((result as any)?.action === 'updated') updated++`.

### F6 — API-key bypass endpoint has no rate limiting (HIGH)
**Evidence:** `payroll.ts:943-982` `/manual-adjustment/by-api-key` POST has no `takeToken()`. Contrast `:568-571` `/manual-edit` POST calls `takeToken()`.
**Impact:** API-key clients unlimited requests/min.
**Fix:** `takeToken(1)` (or per-key allowance) inside by-api-key POST handler.

### F7 — resolveAdjustedJabatanJumlah in monthly but NOT annual/December (HIGH)
**Evidence:** `taxReportService.ts:638-642` (monthly) calls `resolveAdjustedJabatanJumlah()` (stub at `payrollPeriodAdjustments.ts:37-45`). `:1137` (annual) and `:1877` (December) read `row.jabatan_jumlah` directly.
**Impact:** Monthly respects stub; annual/December bypass. Once override is real, monthly diverges permanently.
**Fix:** Call `resolveAdjustedJabatanJumlah()` in annual (`~1137`) and December (`~1877`) where `row.jabatan_jumlah` is read.

### F8–F12 — Jabatan fallback/field/notes/rate/query-path divergence
See table §2.2. F8 centralize fallback to `rate*hari_kerja` in `resolveAdjustedJabatanJumlah`. F9 normalize to `jabatan_jumlah`, set `tunjangan_jabatan = jabatan_jumlah` for compat. F10 implement `attachPayrollPeriodAdjustmentNotes` + consume in Excel. F11 decide rate-based vs total-from-DB, wire `jabatan_rate` into `PayrollCalculator` if rate-based. F12 route all 3 callers through `PayrollTunjanganRepository.getTunjanganJabatan()`.

### F16 — uiBasedSeeder DELETE misses division_code (CRITICAL)
**Evidence:** `uiBasedSeeder.ts:104-106` `DELETE FROM daftar_upah_aggregation_history WHERE period_month=? AND period_year=? AND gang_code=?` — no `division_code`. Same in `aggregationSeederRoutes.ts:1076-1078`, `parallelAggregator.ts:64-65`. Contrast `aggregationSeederRoutes.ts:799-804` pre-seed DELETE DOES include `division_code`.
**Impact:** uiBasedSeeder wipes ALL rows for period+gang across ALL divisions. Gang_code can appear under multiple divisions.
**Fix:** Add `division_code` to WHERE clause in all three DELETE sites.

### F17 — Auto-triggered history seeder cleanup deletes recent writes (HIGH)
**Evidence:** `historySeederService.ts:125` calls `cleanupAggregationHistory` FIRST (`:165-181` deletes by period+division_code). `aggregationSeederRoutes.ts:918-924, :983-990` auto-trigger history seeder AFTER writing `daftar_upah_aggregation_history`, inside the per-division loop.
**Impact:** Stale-read window per division: aggregation seeder writes, history seeder deletes, then re-inserts via `seedGangs`.
**Fix:** Remove auto-trigger from per-division loop; trigger only after all divisions complete, OR decouple tables entirely.

### F21 — No cache invalidation after seeder write (CRITICAL)
**Evidence:** No `cacheService.invalidatePayroll`/`clearByPattern` after seeder writes to `daftar_upah_aggregation_history`. Contrast `payroll.ts` 10+ invalidation calls (`:591, :667, :764, :815, :844, :851, :956, :1015, :1068, :1106`).
**Impact:** After seeder run, payroll cache (keyed `month:year` or `month:year:division`) holds stale data. Frontend renders outdated aggregation totals.
**Fix:** Append `await cacheService.clearByPattern(\`:${month}:${year}\`)` after `aggregationSeederRoutes.ts:1013`, `parallelAggregator.ts:144`, `uiBasedSeeder.ts:187`.

### F23/F30 — dataExtractorService.this.db + getTaskCodes default to wrong profile (CRITICAL)
**Evidence:** `dataExtractorService.ts:735` `this.db = Database.getInstance()` → default `SERVER_PROFILE_1` (extend_db_ptrj). `:3513` `getTaskCodes` falls back to `this.db` when no `serverProfile` arg. Query targets `PR_TASKREGLN`, `PR_TASKREG`, `HR_*` — all on `db_ptrj` (`SERVER_PROFILE_2`).
**Impact:** 500 or empty data in prod where profiles diverge; silent wrong data if both resolve same server.
**Fix:** `:735` → `this.db = Database.getInstance(undefined, Config.DB_PROFILE)`. Every query method already accepts `serverProfile` override, so explicit callers keep working.

### F24/F25/F27 — DB profile default backwards + gangService hardcoded (HIGH/MED, ROOT-A)
**Evidence:** `config.ts:36, :49` `DB_PROFILE`/`DB_EXTEND_PROFILE` default `SERVER_PROFILE_1`. `gangService.ts:27` returns hardcoded `"SERVER_PROFILE_1"` for estate; `:77` hardcodes `SERVER_PROFILE_2`. `uiBasedSeeder.ts:70` hardcodes `"SERVER_PROFILE_2"`.
**Impact:** Bare `getInstance()` hits history DB not payroll DB; gang routing ignores `.env`; seeder profile inconsistent with Config.
**Fix:** `gangService.ts:27` → `return Config.DB_PROFILE`. `uiBasedSeeder.ts:70` → `Config.DB_PROFILE`. Either flip config defaults (`DB_PROFILE=SERVER_PROFILE_2`) or add startup validation asserting `DB_PROFILE` reaches a server with `PR_TASKREG`.

### F31–F36 — Snapshot/history flow
F31 `isHistoryMode()` (`historyDatabaseService.ts:380-382` = `RUN_MODE==='prod'`) AND-gates history branch (`dataExtractorService.ts:818, :821-825`) → untestable in dev. Split guard: let `useHistoryDb=true` force path regardless of RUN_MODE. F32 history intercept (`:827-828`) only fires when `valuePriorityMode==='db_ptrj_only'` — document or remove condition. F33 `available_snapshot_versions` (`:1157-1173`) unscoped by division/gang → silent null when version exists globally but not for scope; scope the query or return error object. F34 progressive stream history yield (`:3896-3910`) omits `is_history_snapshot` from meta → SSE always false; add it + add to return type. F35 normalize `is_history_snapshot` to always live inside `meta` in both payroll stream and taxReport. F36 standardize: always write `version>=1`, treat NULL as no-snapshot sentinel with partial unique index, OR document `ISNULL(x,0)` as explicit sentinel.

### F37 — KERANI division-gate on reads only (CRITICAL)
**Evidence:** `payroll.ts:1963-1985, :2403-2424` enforce KERANI division-gate on reads. Write handlers `:565, :620, :750, :831, :1053, :1092, :1179, :2109, :2239` have none.
**Impact:** `kerani_pg2a` can POST `division_code=PG1A` and backend accepts. Cross-division mutation.
**Fix:** Replicate `locked/report/raw-tree` pattern into every write handler: normalize payload `division_code` via `divisionDefinition.resolveDivisionCode`, compare against `currentUser.divisions`, 403 on mismatch.

### F38 — Unguarded income-delete (CRITICAL)
**Evidence:** `payroll.ts:2200-2237` only checks `if (!currentUser)` — no role guard, no division check, no `income_type` allowlist.
**Impact:** Any authenticated user (incl. KERANI/VISITOR) deletes THR/BONUS/KONTAN for any NIK/period/division.
**Fix:** Require `currentUser.role === UserRole.ADMIN`; add division scope check for KERANI; validate `income_type` against allowlist.

### F39–F43 — Auth bypass cluster (ROOT-D)
F39 `authBypass.ts:40-51` `buildApiKeyBypassUser` grants role=ADMIN + all divisions; `/by-api-key` writes (`payroll.ts:943-982, :1771-1834, :1296-1597, :1836-1874`) skip division-ownership. Add role scoping + `takeToken` + division check. F40 apply `takeToken('write:{username}', {capacity:60, refillPerSec:6})` to all POST/DELETE mutators (`:1876, :2109-2345, :1053-1179, :3137, :3662-3745`); role-gate `/locked/income-delete` ADMIN-only. F41 `/seed` and `/seed-ui` (`aggregationSeederRoutes.ts:87-128, :130-166`) use `getForwardAuthorizationHeader` (no role) → any Bearer token seeds; switch to `resolveUserFromHeaders` and require `UserRole.ADMIN`. F42 encode key purpose in bypass username (`api_key:sync-service`); log which bypass used per request. F43 add Elysia `onBeforeHandle` CSRF guard (Origin check) to `/by-api-key` routes; add per-IP failed-auth lockout.

### F44 — isAdminUser confirmed fixed (LOW, no action)
`App.jsx:54-60` scopes `isAdminUser` locally inside `OperationalReportWrapper` from `ReportContext`. No regression. Confirm via test: KERANI blocked at frontend route + backend role check for `/seed`, `/premium-seeder`.
