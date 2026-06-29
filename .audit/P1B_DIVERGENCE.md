# P1B Upah Bersih Divergence — Audit Konkret

**Sumber:** User report — P1B upah_bersih: versi lama/canonical = 591 juta, dev = 597 juta (+6 juta, dev lebih besar).
**Canonical truth:** `temp/server-changes-1` @ `c9e72ff6`.

## Akar masalah (2 bug, keduanya bikin dev > canonical)

### Bug 1 — Other income dedupe DROPPED (C2, kontribusi utama +6 juta)
**Bukti kode:**
- Canonical `dataExtractorService.ts:5007`:
  ```ts
  const incomeRowsRaw = await extDb.query<any>(`...`);
  const incomeRows = OtherIncomesService.deduplicateIncomeRows(incomeRowsRaw);
  ```
- Dev `dataExtractorService.ts:4968`:
  ```ts
  const incomeRows = await extDb.query<any>(`...`);  // NO dedupe
  ```

**Mekanisme:** `employee_other_incomes` di `extend_db_ptrj` bisa punya multiple row per (emp_code, income_type, period) dari import lama vs baru. Canonical dedupe by composite key `period|empCode|canonicalType`, keep latest (id terbesar). Dev tidak dedupe → semua row dipakai → income dihitung dobel → upah_bersih bengkak.

**Impl dedupe canonical** (`otherIncomesService.ts:40` `deduplicateIncomeRows`): sort by id asc, Map key `period|employeeKey|incomeType`, `set` overwrite → keep latest id. **Dev PUNYA method ini (line 40) tapi dataExtractorService tidak panggil.**

**Fix:** `dataExtractorService.ts:4968` → rename ke `incomeRowsRaw`, lalu:
```ts
const incomeRowsRaw = await extDb.query<any>(`...`);
const incomeRows = OtherIncomesService.deduplicateIncomeRows(incomeRowsRaw);
```

### Bug 2 — payrollPeriodAdjustments STUB (C1, kontribusi period-spesifik)
**Bukti:**
- Canonical `payrollPeriodAdjustments.ts`: real `getPayrollPeriodAdjustments(row, ctx)` — Mei 2026 only:
  - `B0088` → `jabatanJumlahOverride: 0` (tunjangan jabatan disesuaikan ke 0)
  - `F0529` + divisi ARA → `forcePotPph21ToTer: true` (PPh21 = TER)
- Dev: stub no-op — `resolveAdjustedJabatanJumlah` return fallback unchanged, `shouldForcePotPph21ToTer` always false.

**Mekanisme:** Untuk period Mei 2026, B0088 jabatan harus 0 (dev tetap pakai nilai DB → upah_bersih lebih besar). F0529+ARA PPh21 harus = TER. **Ini period-specific — efeknya cuma Mei 2026 + employee tertentu.**

**Fix:** Ganti dev stub `payrollPeriodAdjustments.ts` dengan canonical real impl (95 lines, lihat `git show c9e72ff6:backend/src/utils/payrollPeriodAdjustments.ts`).

## Verifikasi konsistensi dgn temuan sebelumnya
- DIVERGENCE_REPORT.md C1 (payrollPeriodAdjustments stub→real) = **high** calc-numeric ✓
- DIVERGENCE_REPORT.md C2 (dedupe dropped) = **high** calc-numeric ✓
- Kedua-dua sudah ter-flag di audit sebelumnya. P1B +6 juta = manifestasi nyata C1+C2.

## Urutan fix (prioritas)
1. **C2 dedupe** (1 line change di dataExtractorService:4968) — paling cepat, kontribusi terbesar ke +6 juta.
2. **C1 payrollPeriodAdjustments** (replace stub file dgn canonical) — period-specific tapi fatal untuk Mei 2026 B0088/F0529.

## Validasi pasca-fix
Setelah fix, hitung P1B upah_bersih Mei 2026 dev — harus = 591 juta (match canonical/live). Kalau masih 597, ada bug ke-3 (investigasi C6 normalizeGrossDeductionForDisplay, C7 state).
