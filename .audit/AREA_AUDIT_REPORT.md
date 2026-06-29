# AREA_AUDIT_REPORT.md

**Repo:** `D:/Gawean Rebinmas/PORTAL_ESTATE/Plantware_Auto_Report/Daftar_Upah_baru/payroll_daftar_upah/refactor_production`
**Branch:** `server-dev-merger-1`
**Synthesized:** 2026-06-29 from 6 parallel area audits (53 raw findings)

---

## 1. Executive Summary

### Counts by area x severity

| Area | Crit | High | Med | Low | Total |
|---|---|---|---|---|---|
| 1. Live Output Parity (dev vs live, 6/2026) | 1 | 3 | 3 | 1 | 8 |
| 2. Backend Test Coverage (bun test) | 4 | 3 | 2 | 0 | 9 |
| 3. CONFIG/ENV DIVERGENCE | 3 | 4 | 4 | 1 | 12 |
| 4. dead_code_audit | 0 | 1 | 1 | 10 | 12 |
| 5. Frontend-Backend Contract | 0 | 0 | 0 | 5 | 5 |
| 6. DATA INTEGRITY | 3 | 3 | 1 | 0 | 7 |
| **Total** | **11** | **14** | **11** | **17** | **53** |

### Top 5 cross-area risks

1. **Hardcoded secrets with no env override / no fail-fast (Area 3, 3 critical).** `config.ts:68,72,175` ship `SYSTEM_TOKEN`, `JWT_SECRET='default_debug_secret'`, and the real `ABSENSI_API_KEY` as code defaults. Any leak (git, build artifact, error message) = full auth compromise or forged JWTs. Highest-leverage single fix in the whole audit.
2. **No transaction boundary on any multi-step write path (Area 6, 3 critical).** `db.transaction()` exists (`client.ts:195`) but is never called. `deleteHistoryForPeriodAndLocation` (6 sequential DELETEs across 2 DBs), `seedPayrollHistory` (5-step), and `autoBufferManualAdjustmentSeederService` (DELETE then INSERT loop) all leave partial/inconsistent state on mid-flight failure — manual data repair or full re-seed required.
3. **Zero test coverage on 4 core payroll-calc services (Area 2, 4 critical).** `taxReportService`, `aggregationService`, `reportService`, `daftarUpahExcelService` have no `*.test.ts`. Phase 4b `pph21_ter` priority, BRONDOL consolidation, `upah_bersih` fallback, THR/exgratia override, and koreksi sign convention have zero regression guard. Excel is the primary deliverable.
4. **Missing DB-level integrity constraints (Area 6).** No FK on `payroll_history_detail.master_id` (orphans on manual header delete), no UNIQUE on `payroll_manual_adjustments` or `payroll_history_detail` (duplicate rows accumulate on re-run), `snapshot_version INT NULL` read via `ISNULL(...,0)` conflates NULL and real-0. Compounds the transaction gap — re-seeding silently corrupts.
5. **Stub-as-production-code (Area 1 + Area 2).** `payrollPeriodAdjustments.ts` and `otherIncomeCanonical.ts` are stubs consumed by live tax/payroll paths. `shouldForcePotPph21ToTer` always false → PPh21 override missing; canonical grouping not applied. Overlaps DIVERGENCE_REPORT C1/L1 (already flagged).

---

## 2. Per-Area Findings Table

### Area 1 — Live Output Parity (dev vs live, period 6/2026)

| Sev | Title | Evidence |
|---|---|---|
| high | C1 payrollPeriodAdjustments stubs: period-specific PPh21 override missing | `payrollPeriodAdjustments.ts:1-77` all 3 exports stubs; `shouldForcePotPph21ToTer()` always false; `taxReportRoutes.ts:1291-1298` calls on every row |
| high | C2 Dedupe key mismatch: emp_code-only vs emp_code\|\|nik\|\|actual_nik | `dataExtractorService.ts:2521` dedupe=emp_code only; `taxReportRoutes.ts:499` dedupe=emp_code\|\|nik\|\|actual_nik; NULL emp_code rows dropped in extractor, retained in taxReport |
| high | C3 PayrollDataService aggregation totals diverge from dataExtractor direct path | `payrollDataService.ts:327-423` total_premi recalculated by header name match; FIX at :406 uses totals.total_prepr direct; total_pph21=totals.pot_pph21 (stored, not pph21_ter) |
| critical | C4 Dashboard reads aggregation_history table (may have old buggy data) | `dashboardService.ts:82` all KPI endpoints read `daftar_upah_aggregation_history`; written by seeder; if not re-run for 6/2026 after per-division fix, holds old data |
| medium | C5 New meta fields (snapshot_version) added to response | `payroll.ts:1257` adds meta.snapshot_version, meta.available_snapshot_versions; `taxReportRoutes.ts:795` embeds identical meta; `dataExtractorService.ts:828` only populates from seeded history path |
| medium | C6 slimEmployee strips per-row array fields (other_incomes etc) | `payroll.ts:34` strips shortage_details[], excess_details[], other_incomes[], lembur_records[]; frontend reading emp.other_incomes gets undefined on dev |
| low | C7 recap-all hardcoded division list may miss new divisions | `wagesRoutes.ts:200` recap-all hardcodes division list; aliasMap PG1A->P1A; WORKSHOP=WKS_PG+WKS_AR; static vs live dynamic HR tables |
| medium | C8 pph21_ter vs pot_pph21 priority edge case | `taxReportRoutes.ts:556` pph21 = row.pph21_ter \|\| row.pot_pph21; if pph21_ter=0 but pot_pph21 non-zero, tax shows 0 while payroll shows non-zero |

### Area 2 — Backend Test Coverage (bun test)

| Sev | Title | Evidence |
|---|---|---|
| critical | taxReportService — no test file at all | `backend/src/services/taxReportService.ts` 0 lines tested; getMonthlyTaxReport (Phase 4b pph21_ter, other income grouping, BRONDOL consolidation), getAnnualTaxReport (progressive PPH21, THR/exgratia overrides), getDecemberTaxReport (bruto fallback chain), shouldForcePotPph21ToTer integration all untested |
| critical | aggregationService — no test file at all | `backend/src/services/aggregationService.ts`; applyBusinessRules (upah_bersih fallback when DB=0), aggregateColumn (edge cases), createAggregatedResponse untested; calculateRowTotalPotonganBersih excludes 'majikan' keys but pot_bpjs_kes (worker) included — regression corrupts totals silently |
| critical | reportService — no test file at all | `backend/src/services/reportService.ts`; separate payroll path from dataExtractor; generateReport (useArc path, employeeMap HK=0 filter), processResults (PayrollCalculator integration, other_incomes, caruman/carumanBase, db_bpjs_kes merge) untested |
| critical | daftarUpahExcelService — no test file at all | `backend/src/services/daftarUpahExcelService.ts`; generateDaftarUpahExcel (dynamic column layout, formula result vs object, gang separators, grand total SUM, koreksi sign convention, carumanBase ASTEK/BPJS formula) untested; Excel = primary deliverable |
| high | historyDatabaseService — partial coverage, snapshot selection untested | has test file but only 3 methods; missing getPphFromAdtransByYear, isHistoryMode, getLatestPayrollHistory (snapshot version selection), savePayrollHistoryMaster, bulk upsert/delete |
| high | dashboardService — tonase and trend methods untested | has test file covering getDivisionBreakdown + getGangComparison; missing getTonaseReport, getEmployeeCountTrend, getPremiumTrend; row_rank ordering changes silently corrupt totals |
| high | dataExtractorService — Phase 4b calc and snapshot selection untested | 4 focused test files cover division exclusions, join date overlay, manual adjustment metadata/policy; core Phase 4b (upah_bersih via PayrollCalculator, pph21_ter priority), snapshot version selection, manual adjustment merge priority, other income canonical grouping NOT covered |
| medium | otherIncomeCanonical — stub with no tests (test-stale risk) | `backend/src/utils/otherIncomeCanonical.ts` STATUS: STUB; getCanonicalOtherIncomeType via string.includes for {THR,BONUS,KONTAN,EXGRATIA}; no test asserts behavior |
| medium | payrollPeriodAdjustments — stub with no tests (test-stale risk) | `backend/src/utils/payrollPeriodAdjustments.ts` STATUS: STUB; resolveAdjustedJabatanJumlah returns fallback, shouldForcePotPph21ToTer returns false, attachPayrollPeriodAdjustmentNotes no-op; taxReportService.getMonthlyTaxReport:638-665 depends on stub |

### Area 3 — CONFIG/ENV DIVERGENCE

| Sev | Title | Evidence |
|---|---|---|
| critical | SYSTEM_TOKEN hardcoded with no env override | `config.ts:72` hardcoded SYSTEM_TOKEN; any leak (git/log/build artifact) = full system access |
| critical | JWT_SECRET has known hardcoded fallback default | `config.ts:68` JWT_SECRET defaults to 'default_debug_secret'; if .env missing, server starts with well-known default; attacker can forge valid JWTs |
| critical | Real production API key hardcoded as config default | `config.ts:175` ABSENSI_API_KEY defaults to real prod key '2a993486e7a...'; if unset in .env, key leaks into compiled binary and error messages |
| high | DB_PROFILE default is SERVER_PROFILE_1 (history) not SERVER_PROFILE_2 (payroll) | `config.ts:36` DB_PROFILE defaults SERVER_PROFILE_1 (history/extend DB); prod needs SERVER_PROFILE_2 (payroll); wrong profile = payroll queries hit wrong server or fail silently |
| high | isHistoryMode coupled to RUN_MODE=prod — silent prod-only behavior divergence | `historyDatabaseService.ts:380-381` isHistoryMode() = RUN_MODE==='prod'; no independent flag; no way to enable history in dev without all prod behavior |
| high | DB_API_URL defaults to localhost — fails silently on prod | `config.ts:34` DB_API_URL defaults 'http://localhost:8001'; if unset on prod, server silently connects to nonexistent localhost; confusing connection errors |
| high | Staging DB DISABLE_STAGING_DB=false contradicts DB_STAGING_PROFILE=SERVER_PROFILE_2 | `backend/.env:45` DISABLE_STAGING_DB=false but DB_STAGING_PROFILE defaults SERVER_PROFILE_2 (payroll server); if flipped for testing, staging queries hit wrong profile |
| medium | backend/.env.example is stale (c9e72ff6) — values wrong for current codebase | c9e72ff6 .env.example has PORT=3000, DB_PROFILE=192.168.1.100, AUTH_MODE=session, TELEGRAM_BOT_TOKEN; reflects old PHP/Next.js, not current Bun/Elysia |
| medium | frontend/.env.production VITE_BACKEND_URL is empty and undocumented | `frontend/.env.production:1` VITE_BACKEND_URL= (empty); no VITE_ feature flags documented in .env.example |
| medium | RSA key paths hardcoded with no env override | `config.ts:75-76` PUBLIC_KEY_PATH/PRIVATE_KEY_PATH hardcoded relative 'keys/public.pem'/'keys/private.pem'; not configurable per environment |
| medium | Root .env contains stale credentials from old stack — creates confusion | root .env (different from backend/.env) contains legacy DATABASE_* vars with plaintext passwords (ptrj@123, supp0rt@), NextAuth vars, SERVER_2=10.0.2 with password 'supp0rt@'; Bun backend loads only backend/.env — root .env is dead config |
| low | DB_QUERY_TIMEOUT dev default (60) differs from prod .env (90) | `config.ts:41` DB_QUERY_TIMEOUT default 60s; backend/.env sets 90s; dev false confidence |

### Area 4 — dead_code_audit

| Sev | Title | Evidence |
|---|---|---|
| medium | virtualDivisionRegistry.ts — orphan service, never imported | `backend/src/services/virtualDivisionRegistry.ts` no import reference in any .ts file; only exports singleton; ~414 lines dead weight |
| high | debug_arc.ts + 5 other debug scripts — merge artifacts, no production purpose | `backend/src/debug_arc.ts`, `debug_profiles.ts`, `verify_fix.ts`, `verify_gang_mapping.ts`, `verify_profile_fix.ts` — zero import references from api/service; `output.txt` binary garbage; `debug_profiles.ts` queries two DB profiles (potential info disclosure) |
| low | MainPage.jsx — orphan page, not routed | `frontend/src/pages/MainPage.jsx` no import reference; static import at App.jsx:6 but never mounted in any Route |
| low | LockedMainPage.jsx — orphan page, not routed | `frontend/src/pages/LockedMainPage.jsx` not used in any Route in App.jsx |
| low | Report.jsx — orphan page, not routed | `frontend/src/pages/Report.jsx` not used in any Route in App.jsx |
| low | Employees.jsx — orphan page, not routed | `frontend/src/pages/Employees.jsx` not used in any Route in App.jsx |
| low | DivisionDetailCard.jsx — orphan page, not routed | `frontend/src/pages/DivisionDetailCard.jsx` not used in any Route in App.jsx |
| low | EmployeeDirectoryPage.jsx — orphan page, not routed | `frontend/src/pages/EmployeeDirectoryPage.jsx` not used in any Route in App.jsx |
| low | onlyIJLReportPages.jsx — orphan page, not routed | `frontend/src/pages/onlyIJLReportPages.jsx` not used in any Route in App.jsx |
| low | StagingEmployeeDetailModal.jsx — orphan modal, not routed | `frontend/src/pages/StagingEmployeeDetailModal.jsx` only appears in test files (themselves orphan) |
| low | GangHistoricalReportPage.jsx — orphan page, not routed | `frontend/src/pages/GangHistoricalReportPage.jsx` not used in any Route in App.jsx |
| low | backend/src/index.ts — duplicate otherIncomesRoutes registration (line 281 and 311) | `backend/src/index.ts:281` and `:311` both call `.use(otherIncomesRoutes)`; second is no-op (Elysia ignores duplicate mounts) but copy-paste hazard |

### Area 5 — Frontend-Backend Contract (all ALIGNED)

| Sev | Title | Evidence |
|---|---|---|
| low | Payroll report gangs/employees fields: ALIGNED | `payroll.ts:1246-1251` returns {gangs:[{gang_code, employees:slimEmployees, gang_totals, tax_matrix_totals}]}; `CustomPayrollTable.jsx:701-734` reads same; SSE `payroll.ts:3057-3061` + `usePayrollStream.js:209-245` match; no breakage |
| low | Snapshot meta fields: ALIGNED | `payroll.ts:3057-3059` SSE 'headers' emits snapshot_version/requested_snapshot_version/available_snapshot_versions; `dataExtractorService.ts:769-771` declares same; `usePayrollStream.js:256-259` + `CustomPayrollTable.jsx:626,656-660` read all three; wired correctly end-to-end |
| low | Executive-summary KPI fields: ALIGNED; available_snapshot_versions absent by design | `dashboardRoutes.ts:49-56` returns kpi{curr_wage, curr_headcount, prev_wage, prev_ot, curr_ot, prev_headcount}; `professionalDashboard.helpers.js:43-48` reads kpi?.curr_wage/curr_headcount; matches; no snapshot picker by design |
| low | Manual adjustment save payload fields: ALIGNED | `CustomPayrollTable.jsx:1787-1794` builds payload {period_month, period_year, emp_code, nik, emp_name, gang_code, division_code, adjustment_type, adjustment_name, amount, remarks, ad_code, task_code, base_task_code, task_desc, metadata_json}; `payroll.ts:750-757` validates then delegates; `manualAdjustmentService.ts:612-627` ManualAdjustment interface identical |
| low | gang_code and division_code naming: ALIGNED | `manualAdjustmentService.ts:621-622` gang_code:string, division_code?:string; `dashboardRoutes.ts:10-34` uses both; `CustomPayrollTable.jsx:1789` sends gang_code + division_code; `GangFilter.jsx:34-46` reads gang.gang_code; consistent |

### Area 6 — DATA INTEGRITY AUDIT

| Sev | Title | Evidence |
|---|---|---|
| medium | NULL vs 0 ambiguity in snapshot_version INT NULL read via ISNULL(...,0) | `historyDatabaseService.ts:1139` ISNULL(h.snapshot_version,0)=?; :1145 ISNULL(MAX(h2.snapshot_version),0); `PayrollHistoryRepository.ts:32` snapshot_version\|\|null in upsert lookup; migration add_payroll_snapshot_version_columns.sql:129-132 defines INT NULL; if version-0 rows exist alongside v1+ rows, wrong snapshot selected |
| high | INSERT without unique constraint on payroll_manual_adjustments — duplicate row risk on re-run | `autoBufferManualAdjustmentSeederService.ts:396-416` counts existing AUTO_BUFFER rows, DELETE by scope, then :428-448 INSERT loop; no UNIQUE constraint anywhere (grep returned zero); if DELETE skipped, re-run appends duplicates; inflates amounts, corrupts aggregation |
| high | savePayrollHistoryDetail INSERT-only with no unique constraint — duplicate detail rows on re-seeding | `historyDatabaseService.ts:927-930` checks existing by master_id+emp_code then always INSERTs (never UPDATEs); comment :908-922 documents append-only intent; no DB UNIQUE on (master_id, emp_code); `historySeederService.ts:317-321` calls in loop with no batch DELETE before it; in-memory dedup at :1246 masks problem on reads but write-side duplicates accumulate |
| critical | No FK/cascade defined — payroll_history_detail.master_id orphaned if header deleted manually | `historyDatabaseService.ts:1582-1585` DELETE detail by master_id then DELETE header; `historyRoutes.ts:408` comment says 'cascade will delete details'; no FK definition in any migration (grep FOREIGN KEY returned zero); comment is assumption, not enforced; orphans consume storage, skew counts, invisible to master_id queries |
| critical | deleteHistoryForPeriodAndLocation — 6 sequential DELETEs without transaction boundary | `historyDatabaseService.ts:1555-1592` issues 6 sequential queries (hr_employee, hr_gang, detail, header, taskreg, adtrans) across two DBs with no transaction wrapper; `db.transaction()` implemented in `client.ts:195` but never called from historyDatabaseService; partial delete on mid-flight failure, no rollback, manual repair required |
| critical | Seeder multi-step write without transaction — partial failure leaves inconsistent state | `historySeederService.ts:112-162` seedPayrollHistory runs cleanupAggregationHistory → fetchPayrollData → seedGangs → seedTransactions → seedHrData as 5 independent try/catch; if seedGangs succeeds but seedTransactions fails, payroll exists without transactions; `autoBufferManualAdjustmentSeederService.ts:416` DELETE and :428-448 INSERT loop not in same transaction; AutoBuffer re-seed mid-month wipes existing adjustments with no recovery |
| high | Unprotected JSON.parse on dynamic_premi_data / dynamic_potongan_data / lembur_records — malformed data causes crash | `dataExtractorService.ts:114` JSON.parse(value) no try/catch; `pph21TerService.ts:84` JSON.parse(rawData) no try/catch; `summaryService.ts:748,763,1037,1043,1080,1701,1708,2051` multiple JSON.parse on dynamic_premi_data/informasi_tambahan/lembur_records without try/catch; `dashboardService.ts:740` same; `authService.ts:106` JSON.parse on row.divisions unprotected; `historyDatabaseService.ts:1187,1191,1441,1464,1473,1483` ARE protected by try/catch+logError; corrupt JSON crashes pph21TerService on startup or crashes summary/dashboard endpoints; protected history reads silently skip corrupt rows (data invisible) |

---

## 3. Cross-Cutting Root Causes

- **RC1 — Stub-as-production-code.** `payrollPeriodAdjustments.ts` + `otherIncomeCanonical.ts` are stubs consumed by live tax/payroll paths (`taxReportRoutes.ts:1291-1298`, `dataExtractorService.ts:~5020`). Spans Area 1 (C1), Area 2 (2 test-stale items + taxReportService dependency). = DIVERGENCE_REPORT C1/L1, P1B_DIVERGENCE Bug 2.
- **RC2 — No transaction discipline on write paths.** `db.transaction()` exists (`client.ts:195`) but is never called in history/seeder/auto-buffer. Spans Area 6 (3 critical: deleteHistory, seedPayrollHistory, autoBuffer DELETE+INSERT). Partial failure → inconsistent state, data loss.
- **RC3 — Secrets hardcoded as code defaults, no fail-fast.** `config.ts` pattern `env.X || 'hardcoded'` for SYSTEM_TOKEN (:72), JWT_SECRET (:68), ABSENSI_API_KEY (:175), RSA paths (:75-76), DB_API_URL (:34). Spans Area 3 (3 critical + 2 medium). Single leak = full auth compromise.
- **RC4 — Missing DB-level integrity constraints.** No FK on `payroll_history_detail.master_id`, no UNIQUE on `payroll_manual_adjustments` or `payroll_history_detail`, `snapshot_version INT NULL`. App-level dedupe/DELETE-ordering assumed but not enforced. Spans Area 6 (4 items). Compounds RC2 — re-seeding silently corrupts.
- **RC5 — Three different dedupe semantics.** `dataExtractorService.ts:2521` emp_code-only; `taxReportRoutes.ts:499` emp_code\|\|nik\|\|actual_nik; canonical `OtherIncomesService.deduplicateIncomeRows` dropped (DIVERGENCE C2). Employee counts and income totals diverge between paths. Spans Area 1 (C2, C3).
- **RC6 — RUN_MODE overloaded.** Gates `isHistoryMode` (`historyDatabaseService.ts:380-381`), couples dev/prod behavior. No way to test history branch in dev. Spans Area 3. = AUDIT_REPORT F31.
- **RC7 — Unprotected JSON.parse on dynamic columns.** 11 unprotected call sites across `dataExtractorService`, `pph21TerService`, `summaryService` (8 sites), `dashboardService`, `authService`. Corrupt JSON = crash or silent data loss. Spans Area 6.

---

## 4. Prioritized Action List

### P0 — Critical (data-loss / security)

| # | Area | Evidence | Action |
|---|---|---|---|
| 1 | 3 | `config.ts:72` SYSTEM_TOKEN hardcoded | Add `env.SYSTEM_TOKEN` override; fail-fast at startup if absent; add to `.env.example` REQUIRED |
| 2 | 3 | `config.ts:68` JWT_SECRET defaults 'default_debug_secret' | Fail-fast at startup if JWT_SECRET absent (throw, no default); add to `.env.example` REQUIRED |
| 3 | 3 | `config.ts:175` ABSENSI_API_KEY defaults to real prod key | Change default to empty string; fail-fast if IT Solution API reachable but key missing; add to `.env.example` REQUIRED |
| 4 | 6 | `historyDatabaseService.ts:1555-1592` 6 sequential DELETEs no transaction | Wrap all 6 deletes in single `db.transaction()` (client.ts:195); rollback on any failure |
| 5 | 6 | `historySeederService.ts:112-162` + `autoBufferManualAdjustmentSeederService.ts:396-448` multi-step writes no transaction | Wrap each logical unit (delete + full insert) in `db.transaction()`; use idempotent upsert semantics so re-run is always safe |
| 6 | 6 | `historyDatabaseService.ts:1582-1585` no FK/cascade on payroll_history_detail.master_id | `ALTER TABLE dbo.payroll_history_detail ADD CONSTRAINT FK_detail_master FOREIGN KEY (master_id) REFERENCES dbo.payroll_history_header(id) ON DELETE CASCADE`; verify with sys.foreign_keys query |

### P1 — High

| # | Area | Evidence | Action |
|---|---|---|---|
| 7 | 3 | `config.ts:36` DB_PROFILE default SERVER_PROFILE_1 (history) | Change default to SERVER_PROFILE_2 (payroll); document in `.env.example` **[OVERLAP AUDIT_REPORT F25/ROOT-A, F23/F30 — same root]** |
| 8 | 3 | `config.ts:34` DB_API_URL defaults localhost | Fail-fast on startup if DB_API_URL not set; add to `.env.example` REQUIRED |
| 9 | 3 | `historyDatabaseService.ts:380-381` isHistoryMode coupled to RUN_MODE=prod | Extract HISTORY_MODE into dedicated env var independent of RUN_MODE **[OVERLAP AUDIT_REPORT F31]** |
| 10 | 3 | `backend/.env:45` DISABLE_STAGING_DB=false vs DB_STAGING_PROFILE=SERVER_PROFILE_2 | Document DB_STAGING_PROFILE in `.env.example`; default DISABLE_STAGING_DB=true if staging unreachable |
| 11 | 6 | `autoBufferManualAdjustmentSeederService.ts:396-448` INSERT without unique constraint | Add `UNIQUE(period_month, period_year, division_code, gang_code, emp_code, adjustment_name)` on payroll_manual_adjustments; catch unique-violation → upsert |
| 12 | 6 | `historyDatabaseService.ts:927-930` savePayrollHistoryDetail INSERT-only | Add `UNIQUE(master_id, emp_code)` on payroll_history_detail; catch unique-violation → SKIP (idempotent) or UPDATE |
| 13 | 6 | `dataExtractorService.ts:114`; `pph21TerService.ts:84`; `summaryService.ts:748,763,1037,1043,1080,1701,1708,2051`; `dashboardService.ts:740`; `authService.ts:106` unprotected JSON.parse | Add try/catch to all unprotected JSON.parse; on failure log + return safe fallback ({} or []); add DB CHECK constraint on JSON columns; startup health-check validating sample |
| 14 | 1 | `payrollPeriodAdjustments.ts:1-77` stubs; `taxReportRoutes.ts:1291-1298` calls every row | Replace stubs with real impl OR document period-specific TER override disabled; verify against a month where live showed divergence **[OVERLAP DIVERGENCE C1, AUDIT F7/F10, P1B Bug 2 — DO NOT re-recommend, already in fix plan]** |
| 15 | 1 | `dataExtractorService.ts:2521` vs `taxReportRoutes.ts:499` dedupe key mismatch | Align dedupe keys; add runtime assertion that employee counts match between dataExtractor and taxReportRoutes for same period/division **[RELATED DIVERGENCE C2/P1B Bug 1 — dedupe-dropped angle already flagged; THIS item is key-mismatch angle, distinct fix]** |
| 16 | 1 | `payrollDataService.ts:327-423` aggregation diverges from dataExtractor | Compare PayrollDataService vs dataExtractor totals for a sample gang; verify FIX at :406 applied; check header normalization consistency |
| 17 | 1 | `dashboardService.ts:82` reads aggregation_history (may have old data) | Check if daftar_upah_aggregation_history re-seeded for 6/2026 after per-division fix; re-run seeder; verify seeder uses dataExtractor with dedupe fix **[RELATED AUDIT F21 (cache) — re-seed angle is new]** |
| 18 | 4 | `debug_arc.ts`, `debug_profiles.ts`, `verify_fix.ts`, `verify_gang_mapping.ts`, `verify_profile_fix.ts`, `output.txt` merge artifacts | Delete all 6 files; one-off debug artifacts with no production purpose; debug_profiles.ts queries two DB profiles (info disclosure) **[CONFLICT AUDIT_REPORT F29 said "acceptable dev-only, no fix needed" — Area 4 disagrees; resolve conflict]** |
| 19 | 2 | `taxReportService.ts` 0 lines tested | Write test: getMonthlyTaxReport mock row where pph21_ter != pot_pph21 → assert pph21_ter used; other income canonical grouping (THR + BONUS independent); BRONDOL consolidation (brondol_loosefruit=4 + brondol_adtrans=6 → single BRONDOL=10) |
| 20 | 2 | `aggregationService.ts` no test | Write test: applyBusinessRules rows where upah_bersih=0 and jumlah_upah_kotor=0 → assert fallback from component sum; calculateRowTotalPotonganBersih row with pot_bpjs_kesehatan_pekerja=50000 + _majikan=50000 → assert only worker counted |
| 21 | 2 | `reportService.ts` no test | Write test: processResults mock all 12 DB query results → assert emp.upah_bersih = PayrollCalculator output; useArc=true → assert arc suffix removed from SQL; other_incomes dedup two rows same nik different emp_code → single aggregated entry |
| 22 | 2 | `daftarUpahExcelService.ts` no test | Write test: 3 employees mixed gangs → assert column count, gang headers, grand total row; koreksi sign getKoreksiValue=200 → COL_POT_KOREKSI=-200; formula vs result gpAktual=1000+tunj=300+premi=200 → COL_UPAH_KOTOR result=1500 |
| 23 | 2 | `historyDatabaseService.ts` partial coverage | Write test: getLatestPayrollHistory two snapshots same period/gang (batch_id 5 and 7) → assert 7 returned; getPphFromAdtransByYear rows spanning PR_ADTRANS and PR_ADTRANS_ARC → assert pph summed per emp_code per month |
| 24 | 2 | `dashboardService.ts` tonase/trend untested | Write test: getTonaseReport mock millProductionService + harvesterService → assert aggregation groups by gang sums ffb_weight; getGangComparison multiple versions per period/gang → assert highest row_rank=1 used |
| 25 | 2 | `dataExtractorService.ts` Phase 4b untested | Write test: Phase 4b mock row pot_pph21=28655 + pph21_ter=93435 → assert pph21_ter prioritized; manual adjustment merge row auto jabatan_jumlah=50000 + DB=0 → assert automatic wins when edit-mode checkbox=false; snapshot version 1 and 2 same period/gang → assert version 2 returned |

### P2 — Medium

| # | Area | Evidence | Action |
|---|---|---|---|
| 26 | 1 | `payroll.ts:1257`; `dataExtractorService.ts:828` snapshot_version meta fields | Verify meta.snapshot_version is null for current periods; runtime check `curl /report/division-raw-tree?division_code=P1A&month=6&year=2026` |
| 27 | 1 | `payroll.ts:34` slimEmployee strips per-row array fields | Search frontend for other_incomes, shortage_details, excess_details on row objects; remove frontend code or add separate endpoint preserving arrays |
| 28 | 1 | `taxReportRoutes.ts:556` pph21_ter vs pot_pph21 priority edge | Log when pph21_ter===0 but pot_pph21!=0; spot-check one such employee on dev vs live for 6/2026 |
| 29 | 3 | `backend/.env.example` stale (c9e72ff6) | Rewrite from `backend/.env` as source of truth; mark REQUIRED (JWT_SECRET, DB_API_URL, DB_API_KEY, ABSENSI_API_KEY) vs OPTIONAL |
| 30 | 3 | `frontend/.env.production:1` VITE_BACKEND_URL empty | Populate with `VITE_BACKEND_URL=https://<prod-host>/backend/upah`; create `frontend/.env.example` documenting all VITE_ flags |
| 31 | 3 | `config.ts:75-76` RSA key paths hardcoded | Add PUBLIC_KEY_PATH/PRIVATE_KEY_PATH env override; add to `.env.example` |
| 32 | 3 | root `.env` stale credentials | Delete root .env or rename to `.env.old`; document in README which .env the Bun/Elysia backend loads |
| 33 | 4 | `virtualDivisionRegistry.ts` orphan (never imported) | Delete or archive; verify feature deployed/used before removing |
| 34 | 6 | `historyDatabaseService.ts:1139,1145` NULL vs 0 snapshot_version | Enforce `snapshot_version INT NOT NULL DEFAULT 0` so NULL never enters column; OR add explicit `snapshot_version > 0` filter when requesting latest **[OVERLAP AUDIT F36, DIVERGENCE L3/C3 — same root]** |
| 35 | 2 | `otherIncomeCanonical.ts` stub no tests | Write test documenting stub contract: 'pendapatan_thr'→'THR', 'income_type:bonus'→'BONUS', 'income_type:exgratia'→'EXGRATIA', unknown→uppercased; update when real impl replaces stub **[OVERLAP DIVERGENCE L1 — stub-vs-real already flagged]** |
| 36 | 2 | `payrollPeriodAdjustments.ts` stub no tests | Write test asserting stub pass-through: shouldForcePotPph21ToTer returns false for all inputs; resolveAdjustedJabatanJumlah returns fallback unchanged **[OVERLAP DIVERGENCE C1]** |

### P3 — Low

| # | Area | Evidence | Action |
|---|---|---|---|
| 37 | 1 | `wagesRoutes.ts:200` recap-all hardcoded division list | Compare recap-all division list against live available divisions for 6/2026; add any missing |
| 38 | 3 | `config.ts:41` DB_QUERY_TIMEOUT dev 60 vs prod 90 | Document DB_QUERY_TIMEOUT=90 prod / 60 dev in `.env.example`; or raise dev default to 90 |
| 39 | 4 | 8 orphan frontend pages: `MainPage.jsx`, `LockedMainPage.jsx`, `Report.jsx`, `Employees.jsx`, `DivisionDetailCard.jsx`, `EmployeeDirectoryPage.jsx`, `onlyIJLReportPages.jsx`, `StagingEmployeeDetailModal.jsx`, `GangHistoricalReportPage.jsx` | Delete all; remove MainPage lazy import from App.jsx:6 |
| 40 | 4 | `backend/src/index.ts:281` and `:311` duplicate `.use(otherIncomesRoutes)` | Remove duplicate at line 311; keep only line 281 |
| 41 | 5 | 5 FE-BE contract items ALIGNED | No action required; maintain parallel — if backend changes gang-level shape, update streamRows memo and usePayrollStream event handler simultaneously |

---

## 5. Already Covered by Prior Audit (do NOT re-recommend)

| Area item | Prior audit citation | Status |
|---|---|---|
| Area 1 C1 — payrollPeriodAdjustments stubs (PPh21 override missing) | DIVERGENCE_REPORT C1; AUDIT_REPORT F7/F10; P1B_DIVERGENCE Bug 2 | Already in fix plan as REVERT-DEV-TO-CANONICAL (replace stub w/ real `getPayrollPeriodAdjustments`) |
| Area 2 — otherIncomeCanonical stub no test | DIVERGENCE_REPORT L1 / Area A | Already flagged STUB-vs-REAL; fix = replace dev stub with canonical real impl (EXGRATIA→BONUS alias, PENDAPATAN BONUS/KONTANAN labels) |
| Area 2 — payrollPeriodAdjustments stub no test | DIVERGENCE_REPORT C1 | Same stub as Area 1 C1; same fix |
| Area 1 C2 — dedupe key mismatch | DIVERGENCE_REPORT C2; P1B_DIVERGENCE Bug 1 | RELATED but DISTINCT: prior audits flag dedupe DROPPED entirely (restore `deduplicateIncomeRows` call); Area 1 C2 flags KEY MISMATCH (emp_code-only vs emp_code\|\|nik\|\|actual_nik) between two live paths. Fix dedupe-drop first; then align keys. Do not collapse into one ticket |
| Area 3 — DB_PROFILE default SERVER_PROFILE_1 | AUDIT_REPORT F25/ROOT-A, F23/F30 | Same root cause; one config fix + call-site fixes clears cluster |
| Area 3 — isHistoryMode coupled to RUN_MODE=prod | AUDIT_REPORT F31 | Same; split guard |
| Area 6 — NULL vs 0 snapshot_version ambiguity | AUDIT_REPORT F36; DIVERGENCE_REPORT L3/C3 | Same root; standardize NOT NULL DEFAULT 0 or >0 filter. Note DIVERGENCE C3 was verdict KEEP-DEV (intentional versioning feature) — constraint fix still applies |
| Area 1 C4 — dashboard reads stale aggregation_history | AUDIT_REPORT F21 (no cache invalidation after seeder), F17 (auto-trigger history seeder deletes recent writes) | RELATED: prior audits cover cache + auto-trigger; Area 1 C4 adds re-seed-required angle. Verify seeder uses fixed dataExtractor, then re-run for 6/2026 |
| Area 6 — seeder DELETE cross-division scope | AUDIT_REPORT F16 (uiBasedSeeder DELETE misses division_code) | RELATED: prior audit covers missing division_code in WHERE; Area 6 adds transaction-boundary angle. Both fixes needed: add division_code AND wrap in transaction |
| Area 4 — debug scripts | AUDIT_REPORT F29 | **CONFLICT**: F29 said "acceptable dev-only, no fix needed"; Area 4 says high/delete (debug_profiles.ts queries 2 profiles = info disclosure). Resolve conflict — recommend delete per Area 4 |

---

## 6. Quick Wins

1. **Delete 6 debug scripts + `output.txt`** (Area 4, P1 #18) — immediate, zero-risk; removes `debug_profiles.ts` info-disclosure surface. Resolves F29 conflict.
2. **Delete 8 orphan frontend pages** (Area 4, P3 #39) — bundle parse savings, zero-risk; remove `MainPage.jsx` import from `App.jsx:6`.
3. **Remove duplicate `.use(otherIncomesRoutes)` at `index.ts:311`** (Area 4, P3 #40) — one line.
4. **Add SYSTEM_TOKEN / JWT_SECRET / ABSENSI_API_KEY env override + fail-fast** (Area 3, P0 #1-3) — 3-line `config.ts` edits; blocks biggest security hole.
5. **Wrap `deleteHistoryForPeriodAndLocation` in `db.transaction()`** (Area 6, P0 #4) — `client.ts:195` already implemented; just call it around the 6 DELETEs.
6. **Add UNIQUE constraints** on `payroll_manual_adjustments` + `payroll_history_detail` (Area 6, P1 #11-12) — 2 `ALTER TABLE` statements; stops duplicate accumulation on re-seed.
7. **Rewrite `backend/.env.example` from `backend/.env`** (Area 3, P2 #29) — docs only; unblocks new devs immediately.
8. **Add try/catch to `pph21TerService.ts:84` JSON.parse** (Area 6, P1 #13) — single-site fix prevents startup crash on corrupt `rawData`.
