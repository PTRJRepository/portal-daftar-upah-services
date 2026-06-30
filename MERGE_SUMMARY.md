# Merge Summary — server-dev-merger-1

> **Date:** 2026-06-30 | **Branch:** `server-dev-merger-1` | **Canonical:** `temp/server-changes-1` @ `c9e72ff6` | **Live:** `ptrjestate.rebinmas.com:3001/upah`

## What was merged

Two merges performed:

### 1. Merge `origin/main` → `server-dev-merger-1` (June 27)
4 commits from upstream: premi bulan lalu, router stuck fix, pr_agangan history, laporan 7 juta. 15 conflict files resolved (backend + frontend). Build + backend boot fixed (stub utils, App.jsx, gangService.js).

### 2. Merge `server-fix-1` → `server-dev-merger-1` (June 28-29)
21 commits of dashboard refactor, payslip, summary, staging, perf phases. 14 conflict files resolved. Dashboard refactor: ProfessionalDashboard, sawit banner, group/asistensi filter, KPI per-division, module reorder. Snapshot versioning activated. Frontend build passes.

## What was fixed (4 logic divergences from canonical)

| # | Fix | File | Before (dev) | After (canonical) | Impact |
|---|---|---|---|---|---|
| C2 | Income dedupe | `dataExtractorService.ts` | No dedupe, double income | `OtherIncomesService.deduplicateIncomeRows()` | All months, all divisions. ~6M P1B. |
| — | payrollAutoBuffer | `payrollAutoBufferService.ts` | Guard `hariKerja===0 ? 0`, no attendanceDays | `attendanceDays = hariKerja>0?hariKerja:kehadiran`, no guard | Sick-leave employees. B0088: 62,500. |
| C4 | AutoBuffer seeder | `autoBufferManualAdjustmentSeederService.ts` + `autoBufferAdcodeMap.ts` | PPH protected from seeder | No PPH guard | PPH auto-buffer seeding. |
| C1 | Period-adjustment | `payrollPeriodAdjustments.ts` (stub→real) + `dataExtractorService.ts` (3 call sites) | Stub no-op | May 2026: B0088 jabatan=0, F0529+ARA PPh21=TER | May 2026 only. B0088: -62,500. F0529: PPh21→TER. |

## Parity verification result

**28/28 division×month combos MATCH (May+June 2026).** 0 employee diffs. Verified via raw-tree live calc (NOT aggregation snapshot). All 14 divisions: PG1A, PG1B, PG2A, PG2B, DME, ARA, ARB1, ARB2, ARC, IJL, INF, PGE, STF-OFFICE, SECURITY.

| Example | Dev | Live | Rows |
|---|---|---|---|
| PG1A June | 2,336,704,743 | 2,336,704,743 | 187/187 |
| PG1B June | 2,108,793,210 | 2,108,793,210 | 179/179 |
| DME June | 2,483,661,574 | 2,483,661,574 | 187/187 |
| ARC June | 1,148,744,217 | 1,148,744,217 | 274/274 |
| P1B May | 1,838,500,142 | 1,838,500,142 | 179/179 |

## What was added (dev features, not in canonical)

- Dashboard per-division/group KPI (`executive-summary` division_code/gang_code/gang_prefix filter)
- Snapshot versioning (`requestedSnapshotVersion`, `available_snapshot_versions` in meta)
- Sawit banner + group/asistensi filter in ProfessionalDashboard
- ProfessionalDashboard refactor (config/helpers/component split)
- Module reorder (primary access above fold)
- Premium-seeder routes (dry-run, import, progress, template)
- Division normalization (ARB1↔AB1, ARB2↔AB2 aliases)

## What was NOT changed (kept from dev)

- `historyDatabaseService.ts` snapshot versioning (C3) — additive, null=canonical path
- `frontend/src/services/manualAdjustmentService.js` `saveManualAdjustmentBatch` — dev feature with backend endpoint
- `apiBase.js` / `buildBackendUrl` — proxy gateway support
- `serveStaticAsset` with precompressed br/gz — perf improvement over canonical

## Documentation

- `CLAUDE.md` — updated with canonical truth, parity status, fix details, verify patterns
- `ARCHITECTURE.md` — big-picture diagram, pipeline phases, invariants
- `DEPLOYMENT.md` — local/proxy/live setup, build & deploy, post-deploy verify
- `DOCS.md` — master index linking all docs
- `.audit/` — 6 audit reports + 4 re-runnable workflow scripts