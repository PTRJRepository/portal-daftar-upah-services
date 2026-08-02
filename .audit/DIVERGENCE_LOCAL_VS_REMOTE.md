# Divergence: Local (server-dev-merger-1) vs Remote (origin/server-changes-1)

> **Read-only audit. Nothing changed.**
> Date: 2026-08-02 · Branch: `server-dev-merger-1` (clean tree) · Remote ref: `origin/server-changes-1` @ `253eb1ea`
> Canonical ground truth for logic: `temp/server-changes-1` @ `c9e72ff6` (per CLAUDE.md)

## TL;DR

- **Local = working, optimized, redesigned.** Remote (`origin/server-changes-1`) as committed is **not even bootable**: it imports `../utils/otherIncomeCanonical` from 5 services but the file **does not exist** in that tree.
- User's goal (keep local dashboard design + optimizations, guardrail output to match remote) is **achievable** — but the guardrail target is `temp/server-changes-1` (canonical), because remote-live is a stale, unbootable snapshot.
- **4 output-affecting divergences** exist (classifier, TER-recalc, pph21 display, upah_kotor field). These are the guardrail candidates. Everything else is additive (new feature) or optimization/design (keep).

---

## A. Output-affecting divergences (guardrail candidates)

All in `backend/src/services/dataExtractorService.ts`. Compare is **dev vs canonical** (`temp/server-changes-1`), since remote imports a file it lacks.

### A1. Other-income classifier: canonical mapping dropped

| | canonical | local dev |
|---|---|---|
| classify | `getCanonicalOtherIncomeType(oi)` — fuzzy: `EXGRATIA`→BONUS, `Bonus / Exgratia`→BONUS, `KONTANAN`→KONTAN, `PENDAPATAN TIDAK TETAP`→CUSTOM | raw `(oi.type||'').toUpperCase()` — exact string match |
| `standardTypes` | `{THR, BONUS, CUSTOM}` (canonicalized) | `{THR, BONUS, CUSTOM, 'PENDAPATAN TIDAK TETAP'}` (raw) |
| amount read | `amount ?? taxable_amount ?? income_amount ?? value ?? jumlah` | `Number(oi.amount||0)` only |

Consequences:
- **`KONTANAN`** income_type → canonical: KONTAN (standard) → **excluded** from `customTypesTotal` → **not** deducted in `pendapatan_lainnya_amount`. Local: **included** in `customTypesTotal` → **deducted** from `upah_bersih`. → **upah_bersih / pendapatan_lainnya differ for every KONTANAN recipient.** July kontanan seeder writes `income_type='KONTANAN'` (12 refs in `seed_kontanan_juli_2026.ts`) → **live-relevant, not hypothetical.**
- `EXGRATIA`, `Bonus / Exgratia`, `PENDAPATAN BONUS` → canonical: BONUS bucket. Local: land in `customTypesTotal` (non-standard raw string). → upah_bersih differs for bonus/exgratia recipients.
- `PENDAPATAN TIDAK TETAP` → canonical: CUSTOM (standard, counted via `getOiByType('CUSTOM')`). Local: raw standard set also excludes it from custom bucket, but `getOiByType('CUSTOM')` does exact match → the amount is counted **only if raw type is literally `CUSTOM`**. Alias spellings diverge.

Verdict: **real output divergence.** Canonical behavior spec in `temp/server-changes-1:backend/src/utils/otherIncomeCanonical.test.ts`.

### A2. TER-forced PPh21 recalculation removed

| | canonical | local dev |
|---|---|---|
| calc | if `shouldForcePotPph21ToTer`: set `calculatorInput.pot_pph21 = adjustedPotPph21` and **re-run `PayrollCalculator.calculate`** | compute `adjustedPotPph21` but **never re-run** the calculator |
| `emp.pph21` | `adjustedPotPph21` | `pot_pph21` (raw) |

Consequences:
- canonical `calc.upah_bersih`, `calc.total_potongan` use the **TER-forced** PPh21; local uses the raw `pot_pph21`. → **upah_bersih diverges** for employees hitting `shouldForcePotPph21ToTer`.
- `emp.pph21` column/export differs too.
- (This is the C1/period-adjustment fix family — the period-adjustment call sites exist on both paths in canonical and local, so this is purely the recalc step.)

### A3. `upah_kotor` (gross, pre-koreksi) field removed

Canonical computes and emits `upah_kotor = gaji_pokok_aktual + total_tunjangan + total_premi` (separate from `jumlah_upah_kotor` which includes koreksi/pendapatan_lainnya). Local removed the `upah_kotor` field entirely (both the standalone calc and the emitted `emp.upah_kotor`).

Consequence: any consumer reading `upah_kotor` (tax/export) gets undefined in local. Checked `taxReportService`/`daftarUpahExcelService` — they read canonical types from `otherIncomeCanonical`, but if they read `emp.upah_kotor` the value is now missing. **Verify before shipping.**

### A4. `otherIncomeCanonical.ts` stub is a DEGRADED substitute (not the real logic)

Local added `backend/src/utils/otherIncomeCanonical.ts` marked **"STATUS: STUB — never committed to git"**. It's a functional stand-in so the 5 importing services boot. Its mapping is simpler than canonical's real `otherIncomeCanonical.ts` (canonical repo has the real file + test).

Consequence: `taxReportService`, `reportService`, `daftarUpahExcelService`, `taxReportExcelService`, `otherIncomesService`, `taxDomExportRows` all consume the **stub**, not the real canonical mapping. Tax-report and Excel-export bucketing can drift. **The stub must be replaced with canonical's real implementation** for guardrail parity.

---

## B. Optimization / additive (keep — this is the "optimasi dari local")

Behavior-preserving, safe to keep:

| Area | What | Verdict |
|---|---|---|
| `App.jsx` | `React.lazy` code-splitting all report pages; `buildBackendUrl` for proxy | optimization, keep |
| `index.ts` | static-asset precompression (br/gz) + immutable cache headers, content-hashed | optimization, keep |
| `usePayrollStream` | 45s idle watchdog + fallback messaging | robustness, keep |
| `cacheService.invalidatePayroll` | targeted per-(gang,division,month,year) invalidation (replaces blanket `clearByPattern`) | optimization, keep |
| `payroll.ts` | `manual-edit/batch`, `high-earners`, `salary-range-detail`, `premium-seeder` group | new feature, keep |
| `stagingRoutes.ts` + `stagingComparisonService` | staging compare/explore | new feature, keep |
| `dashboardService` | optional `gangCodes` IN-filter (per-division scoping) — no change for unfiltered calls | additive, keep |
| `historyDatabaseService` | requested `snapshot_version` selection + `available_snapshot_versions` | additive, keep |
| `config.ts` | `PROXY_MOUNT`, `DISABLE_STAGING_DB` env flags (off by default) | additive, keep |
| `premiumImportService` | column-mapping engine, dry-run, seeder progress | new feature, keep |

## C. Design / dashboard (keep — this is the "desain dashboard dari local")

Local-only (not present in remote):

- `ProfessionalDashboard.jsx` (458 lines) + `professionalDashboard.config.js` + `professionalDashboard.helpers.js`
- `styles/dashboard-dark-palm.css` (741 lines)
- `styles/wages-summary-professional.css`
- `components/common/ReportKpiCards.jsx`, `ReportMiniStats.jsx`, `ReportPrintHeader.jsx`
- Route swap: local `/` → `ProfessionalDashboard`; remote `/` → `DashboardHome`
- `DashboardLayout.jsx` (66-line diff)

All pure design/presentation layer. **No output impact. Keep.**

## D. Parity verification status (CLAUDE.md)

CLAUDE.md documents **28/28 division×month combos MATCH (May+June 2026)** verified via `/payroll/report/division-raw-tree`, with 4 logic fixes restoring canonical parity (C2 income dedupe, attendanceDays, PPH seeder guard, period-adjustment C1).

But this audit found **new** drift vs canonical in the OI classifier + TER-recalc — not covered by those 4 fixes. Recommendation: re-run the raw-tree parity check after applying A1–A4, especially for divisions with KONTANAN/BONUS recipients and TER-forced employees.

---

## E. RUN RESULTS (2026-08-02) — live parity verification

### Backend test suite: 348 pass / 4 fail
- `taxDomExportRows.test.ts:69` — **REAL divergence A1/A4** — "keeps exgratia visible to tax export by canonicalizing it into bonus": received bonus=0, expected 125000. Local stub maps EXGRATIA→EXGRATIA (own type); canonical maps EXGRATIA→BONUS. `resolveBonusValue` → `sumOtherIncomeByCanonicalType(other_incomes,"BONUS")` → 0.
- `payroll.otherIncomeEdit.test.ts` — DB-state pollution (id 88 vs 25957, inserted vs updated) — not logic.
- 1 DivisionConfigService flake.

### Live parity — `/payroll/report/division-raw-tree` June 2026 (live calc, not snapshot)

| Div | Local | Live | Diff |
|---|---|---|---|
| **PG1A** | 944,330,155.11 | 944,330,155.11 | **0** ✅ |
| **P1B** | 641,604,844.62 | 641,529,844.62 | **-75,000** ❌ |

Isolated to **1 employee**: B0088 ZUWIRDA (P1B/B3M, sick leave `(AL) PERSONNEL SICK LEAVE`).
- Local: `jabatan_jumlah=75000`, `upah_bersih=4,071,300` (non_db_ptrj)
- Live: `jabatan_jumlah=0`, `upah_bersih=3,996,300` (both modes)
- B0202 = float epsilon (0.000000001), not real.

### Mechanism — DEEP DIVE (2026-08-02, user-confirmed business rule)

**User's business rule:** *"jabatan pakai HK kehadiran... sakit tidak dihitung sebagai perkalian tunjangan jabatan"* — jabatan allowance multiplies **attendance HK (hadir) only**; sick/leave days excluded.

**Empirical divergence (P1B June, non_db_ptrj):**
- B0088 (all 30 days leave, `hari_kerja=0`, `hk=30`): local jabatan 75k, live **0**
- B0660 (29 HK, 21 hadir): both 52,500 (2500×21) — matches
- **B0088 is the ONLY divergent employee in all 155** (pattern scan confirms)

**DB forensics:**
- B0088 June attendance lives in `PR_TASKREGLN_ARC` (30 rows, TaskType 3 = ANNUAL LEAVE, 202h, 4,035,000); `PR_TASKREGLN` LIVE empty
- No JABATAN row in `PR_ADTRANS` or `PR_ADTRANS_ARC` → `dbJabatanJumlah=0` confirmed
- AUTO_BUFFER "TUNJANGAN JABATAN" amount=0 manual row exists in shared DB (sync:SYNC match:MATCH)

**Code forensics (all three trees verified byte-identical for this path):**
`dataExtractorService` (local, origin/server-changes-1, temp/server-changes-1) all feed `kehadiran: hk` (total, incl. leave) at the raw-tree calc loop, and `payrollAutoBufferService.attendanceDays = hariKerja>0 ? hariKerja : kehadiran` → for B0088: `hariKerja=0 → attendanceDays=kehadiran=30 → 75k`. **Committed code in ALL trees produces 75k.**

**Conclusion:** the **running live is NOT any committed tree**. Live's runtime applies the user's hadir-HK rule (`attendanceDays` for jabatan = hadir HK, sick/leave excluded → B0088 = 0). Live output for B0088 (jabatan 0) is **correct per business rule**; local (and canonical, and origin) are **wrong for this edge** — they fall back to total HK when hari_kerja=0.

**Exact mechanism (pinpointed):**
- `payrollAutoBufferService.calculateAutomaticValues` line 257: `attendanceDays = hariKerja > 0 ? hariKerja : kehadiran`
- B0660 (hadir 21): `hariKerja=21>0` → attendanceDays=21 → 2500×21=52,500 ✓ both
- B0088 (hadir 0, total hk 30): `hariKerja=0` → **falls back to kehadiran=30** → 75k (local/canonical/origin) vs live **0** (hadir-only, no fallback)
- Both B0088 & B0660 are all-TaskType-3 in ARC; the separator is **`hari_kerja` (hadir after cuti)** — B0088 = 0, B0660 = 21

**Fix for guardrail:** jabatan multiplier must use `hari_kerja` strictly (hadir HK) — **no `kehadiran` fallback** when hari_kerja=0. One-line change in `payrollAutoBufferService.ts:257` (or feed `kehadiran: hari_kerja` at raw-tree call sites). This matches live + user business rule. NOTE: committed trees (incl. canonical) all have the fallback — so this is a **live-only runtime behavior not in any repo**.

---

## G. FIX APPLIED + VERIFIED (2026-08-02, systematic-debugging)

### Change
`backend/src/services/payroll/payrollAutoBufferService.ts:261` — `calculateAutomaticValues`:
```diff
- const attendanceDays = hariKerja > 0 ? hariKerja : kehadiran;
+ // Business rule: tunjangan (jabatan) multiplies HADIR (attendance) HK only.
+ // Leave/sick days are NOT counted. When hariKerja=0 (full leave month), jabatan=0.
+ const attendanceDays = hariKerja;
```

### Method (TDD red-green)
- **Red:** added test `payrollAutoBufferService.test.ts:73-91` — `hariKerja=0, kehadiran=30, jabatanText="kerani kantor", dbJabatanJumlah=0` asserts `jabatanAmount=0`. Failed: received 75000. ✅ reproduced.
- **Green:** fix applied → 7/7 pass.

### Full-suite: 349 pass / 4 fail (same pre-existing 4: taxDom A4, payroll.otherIncomeEdit DB-pollution, DivisionConfig flake). No new failures.
### TSC: only pre-existing seed_*.ts errors (ManualAdjustmentService private ctor + Date type). Not from this change.

### Parity VERIFIED (3 parallel subagents)
| Div | Local | Live | Per-emp |
|---|---|---|---|
| P1B | 641,529,844.62 | 641,529,844.62 | **155/155 MATCH** |
| PG1A | 944,330,155.11 | 944,330,155.11 | **177/177 MATCH** |

B0088: jabatan 0, upah_bersih 3,996,300 = live. **0 new employee diffs.**

### Regression audit
- **masa_kerja_jumlah safe**: derives from `resolveMasaKerjaAmount(masaKerjaTahun)` (by-years config), independent of attendanceDays. Only display rates gate on it (rate = amount/hadir-HK — correct semantics).
- **History snapshots unaffected**: `historyDatabaseService` serves stored values, never re-runs autobuffer. Live-vs-snapshot mismatch for B0088 (snapshot jabatan 50-57k vs live 0) is **snapshot-staleness inherent to append-only design**, not this fix.
- **3 call sites consistent**: raw-tree (1539), progressive (4777), seeder (185) all pass `hariKerja: hari_kerja`.

### Ops note (from verification subagent)
`bun run src/index.ts` (non-watch) does NOT hot-reload. A stale pre-fix server can shadow port 8002 and answer with old code — verification of future fixes must confirm server start time > file save time (or use `bun run dev`). Stale PID 16132 killed.

### Guardrail status
- **PG1A: full parity** (177 emp, 0 diff).
- **P1B: 1/155 employees off by exactly the AUTO_BUFFER jabatan=0 row**.
- A1/A4 (EXGRATIA→BONUS), A2 (TER-recalc), A3 (`upah_kotor` missing locally) are **real but latent** — they surface for EXGRATIA/BONUS-alias and TER-forced employees, not in this June sample. Local lacks `upah_kotor` field that live emits.

---

## F. What the guardrail should be

| Layer | Keep from local | Align to (for output parity) |
|---|---|---|
| Payroll calc (`upah_bersih`, `pendapatan_lainnya`, `pph21`) | — | **canonical `temp/server-changes-1`** — apply A1–A4 |
| Dashboard design | ✅ local | — |
| Frontend optimizations | ✅ local | — |
| New features (staging, premium-seeder, snapshot) | ✅ local | — |
| Deployment infra (proxy, asset precompression) | ✅ local | — |

**Remote `origin/server-changes-1` is NOT a valid parity target** — it lacks `otherIncomeCanonical.ts` and would crash. Use `temp/server-changes-1` @ `c9e72ff6` as the logic source of truth, then verify live parity via `division-raw-tree`.

## F. Guardrail implementation sketch (no changes made)

1. Replace stub `otherIncomeCanonical.ts` with canonical's real implementation (`git show temp/server-changes-1:backend/src/utils/otherIncomeCanonical.ts`) + its test.
2. In `dataExtractorService.ts`: restore `getCanonicalOtherIncomeType`/`sumOtherIncomeByCanonicalType` classifier + `standardTypes={THR,BONUS,CUSTOM}` (remove raw `'PENDAPATAN TIDAK TETAP'`; let canonicalization handle it).
3. Restore TER-forced calculator re-run (`calculatorInput.pot_pph21 = adjustedPotPph21; calc = PayrollCalculator.calculate(...)`) and `emp.pph21 = adjustedPotPph21`.
4. Restore `upah_kotor` field emission; verify `taxReportService`/`daftarUpahExcelService` consumers.
5. Re-run `/payroll/report/division-raw-tree` parity (dev vs live vs canonical) — expect **no employee diffs** once A1–A4 applied.
