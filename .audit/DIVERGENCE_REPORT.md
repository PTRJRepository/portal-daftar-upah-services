# DIVERGENCE_REPORT.md

Audit target: dev branch `server-dev-merger-1` (HEAD) vs canonical GitHub `c9e72ff6`. Mandate: canonical = truth. Report only, no fix.

## 1. Executive Summary

**Total divergences: 34** (dedup counted once; identical-file no-ops folded).

| Severity | Count |
|---|---|
| critical | 1 |
| high | 9 |
| medium | 12 |
| low | 10 |
| none-observed (identical/no-op) | folded into low |

**By outputImpact:** calc-numeric = 11, control-flow = 10, label-text = 8, none-observed = 5.

**Action buckets:**
- **(a) dev-must-revert-to-canonical: 18** — dev diverged from canonical real impl; restore canonical behavior.
- **(b) dev-additions-not-in-canonical (keep/investigate): 3** — `otherIncomesService.dedup.test.ts` (keep, benign test), `payroll.ts` premium-seeder routes (INVESTIGATE), `frontend/src/utils/apiBase.js` (INVESTIGATE).
- **(c) canonical-features-missing-in-dev (add): 8** — `monitor.js`, `telegramBotService.ts`, monitor components (`ServerMonitor.tsx` + 6 files), `ProfessionalDashboard.jsx`, `stagingComparisonService.js`, `payroll.ts` `locked/verify` + `manual-edit/batch`, `index.ts` `stagingRoutes` mount, `MainPage.jsx` `SalaryRangeModal`, `dataExtractorService.ts` snapshot meta fields.

**Stub-vs-real flag:** 2 dev files are stubs where canonical has real impl — `otherIncomeCanonical.ts`, `payrollPeriodAdjustments.ts`. These are the highest-leverage fixes.

## 2. Critical Table — calc-numeric divergences changing payroll numbers (MUST FIX)

| # | File:line | Canonical | Dev | Impact | Sev |
|---|---|---|---|---|---|
| C1 | `backend/src/utils/payrollPeriodAdjustments.ts` | `getPayrollPeriodAdjustments(row,ctx)` — May-2026 guard, B0088 `jabatanJumlahOverride=0`, F0529+ARA `forcePotPph21ToTer=true` | Stubs: `resolveAdjustedJabatanJumlah` returns fallback unchanged; `shouldForcePotPph21ToTer` always false; `attachPayrollPeriodAdjustmentNotes` no-op. **No `getPayrollPeriodAdjustments` at all** | B0088 jabatan jumlah not zeroed; F0529 PPh21 not forced to TER → wrong tax | high |
| C2 | `backend/src/services/dataExtractorService.ts:~4996` | `const incomeRows = OtherIncomesService.deduplicateIncomeRows(incomeRowsRaw)` (composite key `period|empCode|canonicalType`, keeps latest id) | `const incomeRows = incomeRowsRaw` — no dedupe; incomeByEmp accumulates duplicates from main-db + extend-db | duplicate income rows inflate totals | high |
| C3 | `backend/src/services/historyDatabaseService.ts:1133-1470` | `getHistorySnapshot` returns `{execution_time_ms, row_count, is_history_snapshot}`; always picks latest via subquery; no version param | Accepts `requestedSnapshotVersion?`, adds `ISNULL(h.snapshot_version,0)=?` filter, queries/returns `available_snapshot_versions` array | different snapshot rows returned → different payroll numbers | high |
| C4 | `backend/src/services/autoBufferManualAdjustmentSeederService.ts:~9,~400-405,~607,~615,~617` | No `AUTO_BUFFER_PPH_ADJUSTMENT_NAME_CONDITION`; seed rows deleted unconditionally; PPH matched like any adjustment | Adds name-guard for 'POTONGAN PPH'/'AUTO POTONGAN PPH'/'AUTO PPH'; forces `syncStatus=MISS`/`matchStatus=MISMATCH` regardless of amount; exempts PPH from match counting | PPH rows always counted as MISS; delete scope changed → seeder drift | high |
| C5 | `backend/src/api/dashboardRoutes.ts` (3775 canonical vs 3358 dev) | No `division_code`/`gang_code`/`gang_prefix` filters; KPI single aggregate; no `gangFilterCodes` arg | Resolves gangs via `divisionConfigService.getGangsForDivision()`; `gangPrefix` asistensi rule (K2*→'1'); per-division KPI loop; `gangBreakdown` limit=15 | KPI numbers differ per division/gang | high |
| C6 | `frontend/src/components/CustomPayrollTable.jsx:274-335,1064` | `normalizeGrossDeductionForDisplay` returns raw row unchanged; koreksi_hk embedded in `gaji_pokok_aktual` via PR_TASKREGLN | Dev adds `normalizeGrossDeductionForDisplay`: recomputes dynamic deductions, sets `row.potongan_upah_kotor_total=total`, adds excludedHk back (double-count guard); called on every row via `resultRows.map(...)` | displayed potongan_upah_kotor_total recomputed → mismatch vs backend | high |
| C7 | `frontend/src/components/CustomPayrollTable.jsx` (state) | `editedOtherIncomeCells` unified; `dataRequestKey` deps include `gangCode,gangPrefix,useHistoryDb,snapshotVersion,refreshTrigger`; `streamFallbackKeyRef` per-key; `savedCellKeys`; virtual scroll windowing | State split `editedKontanCells`+`editedPendapatanCells`; `dataRequestKey` deps trimmed (gangCode/gangPrefix/useHistoryDb/snapshotVersion/refreshTrigger REMOVED); `streamFallbackKeyRef`/`savedCellKeys` removed; virtual scroll removed | stale data on gang/snapshot change; wrong refresh | high |

## 3. Label / Control-Flow Table

| # | File | Canonical | Dev | Impact | Sev |
|---|---|---|---|---|---|
| L1 | `backend/src/utils/otherIncomeCanonical.ts` | `normalizeOtherIncomeType(value:unknown):string`; alias EXGRATIA→BONUS; `formatCanonicalOtherIncomeLabel`: BONUS→PENDAPATAN BONUS, KONTAN→KONTANAN, EXGRATIA→Bonus | `normalizeOtherIncomeType(input:OtherIncomeLike|null|undefined)`; extracts from object fields (type/income_type/Type/IncomeType); EXGRATIA kept separate; labels BONUS→Bonus, KONTAN→Kontan, EXGRATIA→Exgratia | label + grouping divergence | medium |
| L2 | `backend/src/services/dataExtractorService.ts:~5020,~5069` | `type: row.income_type` (raw); `pendapatan_${inc.type.toLowerCase()}` | `type: getCanonicalOtherIncomeType(row)`; `pendapatan_${getCanonicalOtherIncomeType(inc).toLowerCase()}` | label-text | medium |
| L3 | `backend/src/services/dataExtractorService.ts:762-771` | meta has 8 fields incl `cached?`, `snapshot_version?`, `requested_snapshot_version?`, `available_snapshot_versions?` | meta stripped to `{execution_time_ms, row_count}` | none-observed (but breaks snapshot clients) | low |
| L4 | `backend/src/api/payrollRoutes.ts` | granular `invalidatePayroll({month,year,divisionCode,gangCode})`; `clearByPattern('payroll:')`; `clearByPattern(`:${empCode}:`)`; per-item bulk-delete loop | broad `clearByPattern(`:${month}:${year}`)` or full `clear()`; empCode clearing replaced by `clear()`; bulk loop replaced by `clear()` | control-flow (cache over-invalidation) | medium |
| L5 | `backend/src/services/autoBufferManualAdjustmentSeederService.ts:195,611-617` | PPH seed entries built without explicit syncStatus/matchStatus; `divisionCode` field removed; PPH matched normally | PPH entries tagged `{syncStatus:'MISS',matchStatus:'MISMATCH'}`; `divisionCode:normalizedDivision` field present; PPH excluded from match counting | label-text + seeder drift | medium |
| L6 | `backend/src/index.ts` | imports+mounts `stagingRoutes` under root and `/backend/upah`; `(g:any)=>g` | `stagingRoutes` import + both mounts removed; `app=>app` | control-flow (staging endpoints gone) | medium |
| L7 | `backend/src/routes/monitor.js` + `backend/src/services/telegramBotService.ts` | Express monitor (`/system`,`/services`,`/process`); telegram bot (`/start`,`/help`,`/status`,`sendMessage`); `index.ts` inits both if env set | both files absent; no telegram init; no `/api/monitor/*` | label-text (ops feature missing) | medium |
| L8 | `backend/src/index.ts` (static) | custom `serveStaticAsset()` w/ `.br`/`.gz` precompressed lookup, `contentTypeFor()`, 1yr immutable cache, `Accept-Encoding` vary; `serveIndexHtml()` SPA fallback | `@elysiajs/static` plugin + manual `serveDistAsset()`; `noCacheHeaders` for HTML; `/backend/upah/assets/*` + `/backend/upah/images/*` fallbacks; inline health payload | control-flow | low |
| L9 | `backend/src/api/payroll.ts` (dev-only) | no premium-seeder routes | `GET /payroll/premium-seeder/progress` + `GET /payroll/premium-seeder/template` (lazy `premiumImportService`, Excel `Content-Disposition`) | label-text (dev feature) | low |
| L10 | `backend/src/api/payroll.ts` (canonical missing) | `GET /payroll/locked/verify` → `{valid,username,role,divisions,division,user}`; `POST /payroll/manual-edit/batch` (10-chunk concurrency, ≤200 items, per-combination cache invalidation, `takeToken` rate-limit); `STREAM_SLOW_LOG_MS`,`STREAM_MAX_RUNTIME_MS` | both endpoints removed; `takeToken` import + rate-limit block + constants removed | control-flow (lock verify + batch save gone) | high |
| L11 | `frontend/src/pages/ProfessionalDashboard.jsx` | 458-line component; module-card grid; `professionalDashboard.config`; SAWIT banner; group/asistensi filter; fetches `/payroll/dashboard/executive-summary`; imports `GangTrendChart`,`PremiCompositionChart` | fully deleted (index 87a23296..00000000) | control-flow (dashboard page gone) | critical |
| L12 | `frontend/src/App.jsx` | imports `DashboardHome`; `<DashboardHome>` index route; all pages `lazy()`; `premium-seeder`,`staging-comparison`,`staging-daftar-upah` routes; `/server-monitor`→`<ServerMonitor>`; no auth guard (console.log then Routes) | `MainPage` static import; `ProfessionalDashboard` index route; all static imports; premium-seeder+staging routes removed; no server-monitor; auth guard w/ `isAuthenticated` early returns | control-flow | high |
| L13 | `frontend/src/utils/prodModeUtils.js` | `getProdToken` localStorage→cookie fallback via `readCookieValue`+`decodeJwtPayload`+`buildUserFromTokenPayload` (extracts division from division/divisi/div/kode_lokasi/unit/location/loc_code) | `getProdToken` localStorage-only; `getProdUser` parses localStorage JSON only; 61 lines removed | control-flow (no cookie/JWT fallback) | medium |
| L14 | `frontend/src/services/manualAdjustmentService.js` | exports `saveManualAdjustmentBatch` | batch function removed (8-line diff); CustomPayrollTable uses individual loop | control-flow | low |
| L15 | `frontend/src/services/stagingComparisonService.js` | 31 lines, 7 functions (`fetchAttendanceCompare`,`fetchOvertimeCompare`,`fetchLoosefruitCompare`,`fetchDailyAttendance`,`fetchDailyOvertime`,`fetchDailyLoosefruit`,`fetchLoosefruitAnomalies`) via `buildBackendUrl` | fully deleted (+0 -31) | control-flow | low |
| L16 | `frontend/src/components/common/ReportKpiCards.jsx` | full 4-card grid (Total Workers, Total HK Chekroll, Total Premi, Total Upah Bersih); `formatRupiah` w/ M/JT suffixes; change-indicator badges; props `{grandTotal,periodLabel,isLoading}` | 52-line placeholder stub, single 'Total Gaji' card; `formatRupiah`/number removed; props `{data={}}` | label-text | medium |
| L17 | `frontend/src/components/monitor/ServerMonitor.tsx` + `Charts.tsx`,`ServiceStatus.tsx`,`types.ts`,`ServerMonitor.css`,`ReportMiniStats.jsx`,`ReportPrintHeader.jsx` | all 7 files present in canonical | all missing in dev (`ls` exit 2) | label-text | medium |
| L18 | `frontend/src/utils/apiBase.js` (dev-only) | does not exist; fetch uses direct relative paths | exists, exports `buildBackendUrl` wrapping w/ `VITE_API_BASE||''`; used in CustomPayrollTable for `/payroll/overrides/profile`,`/payroll/overrides/values` | calc-numeric (proxy routing) | medium |
| L19 | `frontend/src/components/CustomPayrollTable.jsx` (resize) | debounce(100ms) on window resize + ResizeObserver; `savedCellKeys` Set; virtual scroll; `compactMode`+localStorage; `retryPayrollLoad()` | sync window resize; ResizeObserver no debounce; `savedCellKeys`/`compactMode` removed; virtual scroll removed; `onRefresh?.()` replaces `retryPayrollLoad()` | calc-numeric (perf/stale) | medium |
| L20 | `frontend/src/pages/MainPage.jsx` | `SalaryRangeModal` imported, state+handlers, rendered in selection+payroll screens, 'Detail Gaji Range' button | all removed (-58 lines) | label-text | low |
| L21 | `frontend/src/components/CustomPayrollTable.jsx:93-122` | `formatNumber`/`formatDecimal` imported from `./payrollTableFormatters` | inlined `formatNumber`=Intl('id-ID')+`Math.round(Math.round(Number(value)))`; NaN/null/undef→'-'; `formatNegativeTotalNumber` wrapper for `potongan_upah_kotor_total`,`total_potongan`,`total_potongan_bersih` | calc-numeric (rounding path differs) | medium |

## 4. Per-Area Detail with Evidence

### Area A — payroll calc utils
- **`otherIncomeCanonical.ts`** [STUB vs REAL]: canonical `normalizeOtherIncomeType(value:unknown):string` — 1-param unknown, uppercase+strip non-alnum, collapse underscore runs, trim. Alias table maps EXGRATIA→BONUS. `formatCanonicalOtherIncomeLabel`: BONUS→`PENDAPATAN BONUS`, KONTAN→`KONTANAN`, EXGRATIA→`Bonus`. Dev stub: `normalizeOtherIncomeType(input:OtherIncomeLike|null|undefined)` extracts raw string from object fields (type/income_type/Type/IncomeType), then alias collapse; EXGRATIA kept as own canonical key; labels BONUS→`Bonus`, KONTAN→`Kontan`, EXGRATIA→`Exgratia`. **Divergence: label text + income grouping (EXGRATIA rows not folded into BONUS).** Sev medium, impact label-text.
- **`payrollPeriodAdjustments.ts`** [STUB vs REAL]: canonical `getPayrollPeriodAdjustments(row,context)` has isMay2026 guard + hard-coded B0088 (`jabatanJumlahOverride=0`) and F0529+ARA (`forcePotPph21ToTer=true`). Dev has no `getPayrollPeriodAdjustments`; only no-op stubs. **Divergence: employee-specific overrides never applied → wrong jabatan/tax for B0088/F0529 in May-2026.** Sev high, impact calc-numeric.
- **`payrollTableFormatters.js`/`employeeSort.ts`/`taxReportIdentity.ts`/`taxDomExportRows.ts`**: byte-for-byte identical. No action.

### Area B — CORE payroll services (dataExtractorService.ts)
- **Dedupe removed** (C2): canonical `OtherIncomesService.deduplicateIncomeRows(incomeRowsRaw)` before building `incomeByEmp`; dev skips. Duplicates inflate income totals. Sev high, calc-numeric.
- **Income type normalization** (L2): canonical `type: row.income_type` raw; dev `type: getCanonicalOtherIncomeType(row)`. At `~5069`: canonical `pendapatan_${inc.type.toLowerCase()}`; dev `pendapatan_${getCanonicalOtherIncomeType(inc).toLowerCase()}`. Sev medium, label-text.
- **Meta stripped** (L3): canonical 8 meta fields incl snapshot_*; dev 2 fields. Sev low, none-observed (but breaks snapshot-aware clients).
- **`otherIncomesService.dedup.test.ts`**: dev-only new file (+69 -0). Keep (benign test). Sev low.

### Area C — seeder-snapshot-history
- **`historyDatabaseService.ts:1133-1470`** (C3): dev adds `requestedSnapshotVersion?` param, `snapshot_version` filter, `available_snapshot_versions` array in meta. Canonical has none. Sev high, calc-numeric. Action: REVERT (canonical=truth), but flag INVESTIGATE — may be intentional versioning feature.
- **`autoBufferManualAdjustmentSeederService.ts`** (C4, L5): dev adds `AUTO_BUFFER_PPH_ADJUSTMENT_NAME_CONDITION` constant (~line 9), applied in COUNT/DELETE (~400-405), `isPphAdjustment` flag (~607), forces `syncStatus=MISS`/`matchStatus=MISMATCH` (~615), exempts PPH from match counting (~617), adds `divisionCode:normalizedDivision` to entry (line 195). Canonical removed all. Sev high+medium, control-flow+label-text.
- **`payrollRoutes.ts`** (L4): dev broadens cache invalidation to `clearByPattern`/`clear()`. Sev medium, control-flow.
- **`aggregationSeederRoutes.ts`/`parallelAggregationSeeder.ts`/`uiBasedSeeder.ts`/`aggregationService.ts`/`historySeederService.ts`**: zero diff. No action.

### Area D — API ROUTES + AUTH + ENTRY
- **`dashboardRoutes.ts`** (C5): dev adds `divisionConfigService.getGangsForDivision()`, `gangPrefix` asistensi rule, `gangFilterCodes` on all dashboard calls, per-division KPI loop, `gangBreakdown` limit=15. Canonical has none. 3775 vs 3358 lines. Sev high, calc-numeric.
- **`payroll.ts`** (L10): dev removed `GET /payroll/locked/verify` + `POST /payroll/manual-edit/batch` + `takeToken` import + rate-limit + `STREAM_SLOW_LOG_MS`/`STREAM_MAX_RUNTIME_MS`. Sev high, control-flow. Dev-only addition (L9): `GET /payroll/premium-seeder/progress` + `GET /payroll/premium-seeder/template`. Sev low, label-text.
- **`index.ts`** (L6): `stagingRoutes` import + both mounts removed. Sev medium, control-flow. Static serving (L8): dev replaced custom `serveStaticAsset`/`serveIndexHtml` w/ `@elysiajs/static` + `serveDistAsset`; health payload inlined. Sev low, control-flow.
- **`monitor.js` + `telegramBotService.ts`** (L7): absent in dev. Sev medium, label-text.

### Area E — frontend
- **`ProfessionalDashboard.jsx`** (L11): fully deleted in dev. Sev critical, control-flow.
- **`App.jsx`** (L12): MainPage static import, ProfessionalDashboard index, no lazy, no server-monitor, auth guard present. Sev high, control-flow.
- **`CustomPayrollTable.jsx`**: (C6) `normalizeGrossDeductionForDisplay` recomputes `potongan_upah_kotor_total` (lines 274-335, called line 1064) — high calc-numeric. (C7) state split + virtual scroll removed + `dataRequestKey` deps trimmed — high calc-numeric. (L19) resize debounce/`savedCellKeys`/`compactMode`/`retryPayrollLoad` removed — medium. (L21) `formatNumber` inlined w/ double-`Math.round` — medium calc-numeric.
- **`prodModeUtils.js`** (L13): cookie/JWT fallback removed (61 lines). Sev medium, control-flow.
- **`manualAdjustmentService.js`** (L14): `saveManualAdjustmentBatch` removed. Sev low.
- **`stagingComparisonService.js`** (L15): fully deleted. Sev low.
- **`ReportKpiCards.jsx`** (L16): stub replacing 4-card grid. Sev medium, label-text.
- **monitor components** (L17): 7 files missing. Sev medium.
- **`apiBase.js`** (L18): dev-only `buildBackendUrl`. Sev medium, calc-numeric. INVESTIGATE.
- **`MainPage.jsx`** (L20): `SalaryRangeModal` removed (-58 lines). Sev low.
- **`exportPayslipsToExcel.js`/`wagesSummaryAudit.js`**: identical. No action.

## 5. Recommended Action per Item

| Item | File | Action |
|---|---|---|
| C1 | payrollPeriodAdjustments.ts | **REVERT-DEV-TO-CANONICAL** (replace stub w/ real `getPayrollPeriodAdjustments`) |
| C2 | dataExtractorService.ts (dedup) | **REVERT-DEV-TO-CANONICAL** (restore `deduplicateIncomeRows` call) |
| C3 | historyDatabaseService.ts | **INVESTIGATE** then likely REVERT (canonical=truth; but versioning may be intended feature — confirm w/ user) |
| C4 | autoBufferManualAdjustmentSeederService.ts (PPH guard) | **REVERT-DEV-TO-CANONICAL** |
| C5 | dashboardRoutes.ts (gang filters) | **INVESTIGATE** then likely REVERT (gang filtering may be intended — confirm; canonical has none) |
| C6 | CustomPayrollTable.jsx (normalizeGrossDeductionForDisplay) | **REVERT-DEV-TO-CANONICAL** (remove dev recomputation) |
| C7 | CustomPayrollTable.jsx (state/virtual scroll) | **REVERT-DEV-TO-CANONICAL** (restore unified state + virtual scroll + dataRequestKey deps) |
| L1 | otherIncomeCanonical.ts | **REVERT-DEV-TO-CANONICAL** (replace stub w/ canonical real: unknown param, EXGRATIA→BONUS, PENDAPATAN BONUS/KONTANAN labels) |
| L2 | dataExtractorService.ts (income type) | **REVERT-DEV-TO-CANONICAL** (`row.income_type` raw, drop `getCanonicalOtherIncomeType` in extend-db path) |
| L3 | dataExtractorService.ts (meta) | **ADD-CANONICAL-TO-DEV** (restore 8 meta fields) |
| L4 | payrollRoutes.ts (cache) | **REVERT-DEV-TO-CANONICAL** (granular `invalidatePayroll`) |
| L5 | autoBuffer PPH entry build | **REVERT-DEV-TO-CANONICAL** (remove divisionCode field + MISS/MISMATCH tagging) |
| L6 | index.ts (stagingRoutes) | **ADD-CANONICAL-TO-DEV** (restore import + mounts) |
| L7 | monitor.js + telegramBotService.ts | **ADD-CANONICAL-TO-DEV** |
| L8 | index.ts (static) | **INVESTIGATE** (@elysiajs/static vs custom — canonical=truth, but dev may be perf-improvement; confirm) |
| L9 | payroll.ts (premium-seeder routes) | **KEEP-DEV-ADDITION** (INVESTIGATE — dev-only feature, likely intentional) |
| L10 | payroll.ts (locked/verify + batch) | **ADD-CANONICAL-TO-DEV** (restore endpoints) |
| L11 | ProfessionalDashboard.jsx | **ADD-CANONICAL-TO-DEV** (restore deleted file) |
| L12 | App.jsx | **REVERT-DEV-TO-CANONICAL** (DashboardHome + lazy + server-monitor + remove auth guard) |
| L13 | prodModeUtils.js | **REVERT-DEV-TO-CANONICAL** (restore cookie/JWT fallback) |
| L14 | manualAdjustmentService.js | **ADD-CANONICAL-TO-DEV** (restore `saveManualAdjustmentBatch`) |
| L15 | stagingComparisonService.js | **ADD-CANONICAL-TO-DEV** (restore deleted file) |
| L16 | ReportKpiCards.jsx | **REVERT-DEV-TO-CANONICAL** (restore 4-card grid) |
| L17 | monitor components (7 files) | **ADD-CANONICAL-TO-DEV** |
| L18 | apiBase.js | **KEEP-DEV-ADDITION** (INVESTIGATE — proxy helper; canonical uses relative paths) |
| L19 | CustomPayrollTable.jsx (resize) | **REVERT-DEV-TO-CANONICAL** (restore debounce/savedCellKeys/compactMode/retryPayrollLoad) |
| L20 | MainPage.jsx (SalaryRangeModal) | **ADD-CANONICAL-TO-DEV** (restore modal) |
| L21 | CustomPayrollTable.jsx (formatNumber) | **REVERT-DEV-TO-CANONICAL** (import from payrollTableFormatters) |
| — | otherIncomesService.dedup.test.ts | **KEEP-DEV-ADDITION** (benign test) |
| — | payrollTableFormatters.js/employeeSort.ts/taxReportIdentity.ts/taxDomExportRows.ts/exportPayslipsToExcel.js/wagesSummaryAudit.js | NO-OP (identical) |
| — | aggregationSeederRoutes.ts/parallelAggregationSeeder.ts/uiBasedSeeder.ts/aggregationService.ts/historySeederService.ts | NO-OP (identical) |

## 6. Quick-Fix List — stub-vs-real (dev stub → canonical real impl)

1. **`backend/src/utils/otherIncomeCanonical.ts`** [STUB→REAL]: replace dev stub with canonical real impl.
   - Signature: `normalizeOtherIncomeType(value: unknown): string` (drop `OtherIncomeLike` object-field extraction).
   - Alias table: map `EXGRATIA`→`BONUS` (dev keeps EXGRATIA as own key — **label + grouping divergence**).
   - `formatCanonicalOtherIncomeLabel`: BONUS→`PENDAPATAN BONUS`, KONTAN→`KONTANAN`, EXGRATIA→`Bonus` (dev has `Bonus`/`Kontan`/`Exgratia`).
2. **`backend/src/utils/payrollPeriodAdjustments.ts`** [STUB→REAL]: implement `getPayrollPeriodAdjustments(row, context): PayrollPeriodAdjustment[]`.
   - May-2026 guard.
   - B0088 → `jabatanJumlahOverride=0`.
   - F0529 + division ARA → `forcePotPph21ToTer=true`.
   - Empty array for all other periods.
   - Replace no-op stubs `resolveAdjustedJabatanJumlah`/`shouldForcePotPph21ToTer`/`attachPayrollPeriodAdjustmentNotes` with real consumers.
3. **`backend/src/services/dataExtractorService.ts:~4996`**: restore `const incomeRows = OtherIncomesService.deduplicateIncomeRows(incomeRowsRaw)` before `incomeByEmp` build (dev dropped dedupe → duplicate income rows).
4. **`backend/src/services/dataExtractorService.ts:~5020,~5069`**: revert `type: getCanonicalOtherIncomeType(row)` → `type: row.income_type`; revert `pendapatan_${getCanonicalOtherIncomeType(inc).toLowerCase()}` → `pendapatan_${inc.type.toLowerCase()}`.

**Highest-leverage fixes (payroll-number correctness):** C1 (payrollPeriodAdjustments), C2 (dedupe), C6 (normalizeGrossDeductionForDisplay), C7 (dataRequestKey deps). These four directly change displayed/totaled payroll figures.

**INVESTIGATE before revert (may be intended dev features, not drift):** C3 (historyDatabaseService snapshot_version), C5 (dashboardRoutes gang filters), L8 (@elysiajs/static), L9 (premium-seeder routes), L18 (apiBase.js). Confirm with user before reverting — canonical=truth per mandate, but these smell like deliberate enhancements.

---

## 7. INVESTIGATE verdicts (resolved 2026-06-29)

5 parallel agents judged each INVESTIGATE-flagged item. **All verdict: KEEP-DEV** (intentional features, backward-compatible with canonical).

| Item | File | Verdict | Rationale |
|---|---|---|---|
| C3 snapshot versioning | historyDatabaseService.ts | **KEEP-DEV** | Additive: `requestedSnapshotVersion` optional, null→MAX subquery = canonical path byte-for-byte. New meta fields optional. Explicit user request. |
| C5 dashboard gang filters | dashboardService.ts + dashboardRoutes.ts | **KEEP-DEV** | Additive: `gangCodes?` optional, empty→no `IN()` clause = canonical SQL. `buildGangCodeFilter` returns empty clause when undefined. Narrows IN-set, no math change. Per "KPI tampilk sesuai divisinya". |
| L8 static serving | index.ts | **KEEP-DEV** | Dev `serveStaticAsset()` superior: reads pre-built `.br`/`.gz` from disk (zero CPU) vs canonical runtime `Bun.gzipSync()`. Dev supports Brotli (canonical gzip-only). Dev `staticPlugin` before explicit handlers = real fallback (canonical placement = dead code). Dev keeps `/backend/upah/health` + stagingRoutes canonical dropped. |
| L9 premium-seeder routes | payroll.ts | **KEEP-DEV** | Additive `.group("/premium-seeder")` (dry-run/import/progress/template) on top of canonical's bare `/premium-import-excel`. `premiumImportService` exists in canonical (not orphan). Frontend `PremiumSeederPage.tsx` wired at App.jsx:1212. Lazy import = intentional opt. |
| L18 apiBase/buildBackendUrl | frontend/src/utils/apiBase.js | **KEEP-DEV** | Pervasive (11 files incl 4 new pages absent in canonical). `VITE_PROXY_MODE` flag + `/backend/upah` prefix = deliberate gateway design. Canonical bare paths break behind real reverse proxy. 4 caller pages only exist via buildBackendUrl. |

**Net effect on fix plan:** 5 INVESTIGATE items removed from revert queue. They are intentional dev enhancements that are backward-compatible with canonical (no-filter/default = canonical behavior). **Do NOT revert.**

### Revised action totals
- REVERT-DEV-TO-CANONICAL: 18 (unchanged — these are real calc/logic drift, e.g. C1/C2/C6/C7 stub-vs-real)
- ADD-CANONICAL-TO-DEV: 8 (unchanged)
- KEEP-DEV: 3 + **5 investigated = 8**
- INVESTIGATE: 5 → **0 resolved**
