# Planning Context: tunjangan_jabatan multiplier fix (hari_kerja strict)

## Source Evidence
- `backend/src/services/payroll/payrollAutoBufferService.ts:255-257` — bug site
  - Line 255: `const hariKerja = Math.max(0, toNumber(input.hariKerja));`
  - Line 256: `const kehadiran = Math.max(0, toNumber(input.kehadiran));`
  - Line 257: `const attendanceDays = hariKerja > 0 ? hariKerja : kehadiran;`  ← silent inflation
- `backend/src/services/payroll/payrollAutoBufferService.ts:268,281,284` — three usage sites of `attendanceDays`
  - Line 268: `jabatanAmountAuto = hasJabatanRate && attendanceDays > 0 ? (jabatanRateResolved as number) * attendanceDays : null`
  - Line 281: `jabatanRate: attendanceDays > 0 ? jabatanAmount / attendanceDays : 0`
  - Line 284: `masaKerjaRate: attendanceDays > 0 ? masaKerjaAmount / attendanceDays : 0`
- `backend/src/services/payroll/payrollAutoBufferService.test.ts` — 6 existing tests (all use `hariKerja === kehadiran`, so unaffected by removing fallback)
- `backend/data/rate_tunjagan_jabatan.json` — daily rate config (e.g. 3500 for mandor, 2500 for karyawan)
- Callers (not modified, only consume output):
  - `backend/src/services/dataExtractorService.ts:1533, 4779` (calculateVerificationValues)
  - `backend/src/services/autoBufferManualAdjustmentSeederService.ts:185` (calculateAutomaticValues)
- `CLAUDE.md` — project rule: aggregation history table lives in `extend_db_ptrj` via `SERVER_PROFILE_1`

## Understanding

### Current State
- `payrollAutoBufferService.calculateAutomaticValues(input)` computes `attendanceDays = hariKerja > 0 ? hariKerja : kehadiran`
- When `hariKerja = 0` AND `kehadiran > 0` (e.g. employee on full cuti/sakit/izin, but raw HK still positive), `attendanceDays` silently becomes `kehadiran`
- This inflates `jabatanAmount = jabatanRateResolved * attendanceDays` and propagates into the auto-buffer verification display

### Problem
- Silent value inflation breaks payroll correctness for edge-case employees (full cuti/sakit/izin)
- `hari_kerja` is the canonical "effective work days" (excludes cuti/sakit/izin)
- `kehadiran` is raw attendance HK (INCLUDES cuti/sakit/izin) — wrong multiplier
- No logging or signal flags the fallback to the caller

### Approach
- Remove `attendanceDays` fallback; use `hariKerja` strictly
- Treat `null`/`undefined`/`NaN` `hariKerja` as `0` (already handled by `Math.max(0, toNumber(...))`)
- Apply formula `tunjangan_jabatan = (tunjangan / 25) * hari_kerja`
  - In code: `jabatanAmount = jabatanRateResolved * hariKerja` (since `jabatanRateResolved` = daily rate = `tunjangan / 25`)
- When `hariKerja = 0` → `jabatanAmount = 0` (already correct after removing fallback: `attendanceDays > 0` guard remains, but uses `hariKerja` not the inflated value)
- Keep `jabatanRate = hariKerja > 0 ? jabatanAmount / hariKerja : 0`
- Update test cases to cover the new edge cases (hari_kerja=0, kehadiran>0)
- Public API contract unchanged (input/output shapes identical)

## Key Decisions

- Decision: Remove `attendanceDays` variable entirely, use `hariKerja` directly at all 3 use sites
  - Rationale: Simplest fix; eliminates whole class of fallback bugs; user explicitly said "no fallback"
  - Evidence: `payrollAutoBufferService.ts:257,268,281,284`

- Decision: Keep `hariKerja > 0` guard in `jabatanAmountAuto` computation
  - Rationale: Guards against `null`/`undefined` reaching multiplication; user wants `tunjangan=0` when `hari_kerja=0`
  - Evidence: existing line 268 guard pattern

- Decision: Do NOT modify `masaKerjaRate` calculation path beyond removing `attendanceDays`
  - Rationale: User scope is `tunjangan_jabatan` only; `masaKerjaAmount` is a separate config-driven value (not per-day multiplied)
  - Evidence: `payrollAutoBufferService.ts:271-273, 284` — `masaKerjaAmount` already uses annual lookup, not per-day

- Decision: Add new test cases (don't break existing 6 tests)
  - Rationale: Existing tests pass `hariKerja === kehadiran` so they pass regardless; new tests cover the bug scenario
  - Evidence: `payrollAutoBufferService.test.ts:4-107` — all existing tests use identical values

- Decision: Touch ONLY `payrollAutoBufferService.ts` and its test file
  - Rationale: Public API surface (input/output) unchanged; callers (`dataExtractorService`, `autoBufferManualAdjustmentSeederService`) consume result without depending on fallback behavior
  - Evidence: grep shows no `attendanceDays` references outside this file

## Dependencies
- Depends on: none (self-contained service fix)
- Provides for: correct payroll calculation when `hari_kerja=0` and `kehadiran>0`; downstream `dataExtractorService` verification, `autoBufferManualAdjustmentSeederService` seeding, Excel/HTML export recomputation will all see correct values automatically

## Affected Scope
- 1 source file modified: `backend/src/services/payroll/payrollAutoBufferService.ts`
- 1 test file updated: `backend/src/services/payroll/payrollAutoBufferService.test.ts`
- 0 caller file changes needed (public API preserved)
