# P1B Juni — Root Cause Final (B0088 jabatan, live ≠ canonical)

**Divergensi:** P1B Juni grand upah_bersih dev 597,849,140.92 vs live 597,911,640.92 = **-62,500** (dev lebih kecil).
**Satu employee beda:** B0088 (ZUWIRDA/SURYATI, kerani kantor, gang B3M, P1B).

| Field | Dev | Live | Canonical c9e72ff6 (code) |
|---|---|---|---|
| hari_kerja | 0 | 0 | — |
| jumlah_hk | 25 | 25 | — |
| cuti_sakit_haid_hari | 20 | 20 | — |
| jabatan_jumlah | 0 | 62500 | 0 (code: `hariKerja===0 ? 0`) |
| jabatan_rate | 0 | 2500 | — |
| masa_kerja_rate | 0 | 2300 | — |
| total_tunjangan | 113750 | 176250 | — |
| upah_bersih | 3312550 | 3375050 | — |

## Kontradiksi penting: LIVE ≠ CANONICAL c9e72ff6

User anggapan: live = stabil benar, canonical GitHub c9e72ff6 = benar logic. Tapi untuk B0088 Juni:
- **Live** jabatan_jumlah = 62,500 (meski hari_kerja=0)
- **Canonical c9e72ff6 code** `payrollAutoBufferService.ts:267`: `const jabatanAmount = hariKerja === 0 ? 0 : (...)` → B0088 (hk=0) **harus 0** di canonical.

Jadi live deploy BUKAN c9e72ff6 exact. Kemungkinan:
1. Live = versi lebih baru/patched (ada commit setelah c9e72ff6 yang hapus `hariKerja===0 ? 0` guard).
2. Live punya `payroll_manual_adjustments` B0088 dengan jabatan override 62,500 yang `dbJabatanJumlah` baca, TAPI dev `globalJabatanMap` tidak baca manual adjustment tsb.
3. c9e72ff6 bukan tip sebenarnya dari branch canonical.

## Alur dev (line 1530-1545 dataExtractorService + payrollAutoBufferService)
1. `empJabatan` = `globalJabatanMap[B0088]` (line 1538 `dbJabatanJumlah: empJabatan`)
2. `globalJabatanMap` diisi dari `getTunjanganAmount(chunk, ..., "JABATAN", serverProfile)` = PR_ADTRANSLN where DocDesc LIKE '%JABATAN%'.
3. B0088 = sick leave (task_type 3, PERSONNEL SICK LEAVE), kemungkinan **tidak ada row PR_ADTRANSLN JABATAN** untuk B0088 Juni → `globalJabatanMap[B0088]` undefined → fallback 0.
4. `autoBufferVerification.display.jabatanAmount`:
   - `jabatanAmountAuto = hasJabatanRate && attendanceDays>0 ? rate*days : null` → hk=0, kehadiran=0 → null.
   - `jabatanAmount = jabatanAmountAuto !== null ? auto : dbJabatanJumlah` = `dbJabatanJumlah` = 0.
5. Hasil dev: jabatan_jumlah=0.

## Alur live (deduksi dari output)
Live dapat 62,500 untuk B0088 hk=0. Sumber 62,500 kemungkinan:
- `payroll_manual_adjustments` table ada row B0088 Juni adjustment_type=JABATAN amount=62500, DIBACA sebagai `dbJabatanJumlah`, TAPI guard `hariKerja===0?0` di-disable di live.
- ATAU live baca `globalJabatanMap` dari sumber lain (auto-buffer table `auto_buffer_*` yang sudah berisi 62500 untuk B0088).

## Yang perlu klarifikasi user
1. **Live = canonical c9e72ff6 exact?** Kalau ya, canonical code `hariKerja===0?0` harus return 0, tapi live 62,500 → kontradiksi. Verifikasi: cek apakah ada commit setelah c9e72ff6 di temp repo, atau live deploy dari branch lain.
2. **Apakah B0088 punya manual adjustment 62,500 di Juni?** Query `payroll_manual_adjustments` di live untuk B0088 Juni 2026.
3. **Sumber 62,500 live:** PR_ADTRANSLN, manual adjustment, atau auto-buffer table?

## Fix status
- C2 dedupe: COMMITTED (tidak solve P1B Juni — income table kosong).
- **B0088 fix: BLOCKED** — butuh klarifikasi live vs canonical, karena dev ikut canonical code (`hariKerja===0?0`) tapi user mau match live (62,500). Kalau dev=canonical=0 dan live=62,500, maka **live yang menyimpang dari canonical**, bukan dev. Fix dev agar = live = mengikuti logic non-canonical (hapus `hariKerja===0?0` guard + baca manual adjustment). Butuh keputusan user.

## Investigasi berikutnya (butuh akses DB live / keputusan)
1. Query `payroll_manual_adjustments` B0088 Juni 2026 di live DB.
2. Cek `auto_buffer_*` table B0088 Juni.
3. Bandingkan live deploy commit vs c9e72ff6 (apakah live lebih baru).
4. Putuskan: dev ikut canonical (0) atau ikut live (62,500)? User bilang "tidak ingin perbedaan dengan live" → dev harus 62,500 → hapus guard + baca manual adjustment.
