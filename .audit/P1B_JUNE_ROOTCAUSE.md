# P1B Juni — Root Cause SEBENARNYA (B0088 jabatan)

**Laporan user:** P1B upah_bersih dev ≠ live.
**Hasil investigasi konkret (post C2 fix):** Grand total dev 597,849,140.92 vs live 597,911,640.92 = **-62,500** (dev lebih kecil).

## Penyebab SEBENARNYA (bukan C2)

C2 (dedupe) TIDAK relevan — `employee_other_incomes` P1B Juni kosong (Phase 4b log: 0 employee dengan income). C2 fix sudah di-commit tapi tidak solve divergensi.

**Satu-satunya employee beda: B0088 (ZUWIRDA / SURYATI), kerani kantor, gang B3M, P1B.**

| Field | Dev | Live/Canonical | Diff |
|---|---|---|---|
| jabatan_rate | 0 | 2500 | |
| jabatan_jumlah | 0 | 62500 | **-62500** |
| masa_kerja_rate | 0 | 2300 | |
| total_tunjangan | 113750 | 176250 | -62500 |
| upah_bersih | 3312550 | 3375050 | **-62500** |

Diff upah_bersih = persis `jabatan_jumlah` B0088 (62,500). Dev set jabatan_jumlah=0 untuk B0088 Juni; canonical set 62,500.

## Catatan penting: B0088 + Mei 2026
Canonical `payrollPeriodAdjustments.ts` menyebut B0088 untuk **Mei 2026** (jabatanJumlahOverride=0). Tapi:
- Untuk **Juni**, `isMay2026` false → canonical return [] → `resolveAdjustedJabatanJumlah` return currentValue (fallback, BUKAN 0).
- Jadi dev set 0 untuk B0088 Juni = **BUKAN dari payrollPeriodAdjustments stub** (stub juga return fallback).

## Sumber dev set jabatan_jumlah=0 (investigasi lanjut)
`dataExtractorService.ts:4462`: `emp.jabatan_jumlah = globalJabatanMap[emp.emp_code] || 0;`
- Dev: `globalJabatanMap['B0088']` = undefined → fallback 0.
- Live/canonical: `globalJabatanMap['B0088']` = 62500.

Berarti **dev miss B0088 di globalJabatanMap** — query/join yang bangun `globalJabatanMap` tidak include B0088. B0088 = kerani kantor (task_type 3, PERSONNEL SICK LEAVE). Kemungkinan:
1. Query jabatan filter out task_type tertentu (sick leave?) yang B0088 punya.
2. Join PR_ADTRANS/HR_ miss B0088 karena gang B3M atau task_code GA9126P1B.
3. Dedup/sort issue di globalJabatanMap population.

## Fix status
- C2 dedupe fix: COMMITTED (restore `OtherIncomesService.deduplicateIncomeRows` + SELECT id/new_nik). Benar tapi tidak solve P1B Juni (income table kosong).
- **B0088 jabatan fix: BELUM.** Investigasi `globalJabatanMap` population — kenapa B0088 miss.

## Langkah investigasi berikutnya
1. Cari query yang populate `globalJabatanMap` (grep `globalJabatanMap` + `jabatanB`).
2. Compare dev vs canonical query — apakah canonical include B0088 via join/condition beda.
3. Jalankan query manual untuk B0088 P1B Juni di db_ptrj (PR_ADTRANS jabatan) — apakah row ada?
4. Fix query agar B0088 (dan employee serupa sick-leave) ter-include.
