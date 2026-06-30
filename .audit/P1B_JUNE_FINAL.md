# P1B Juni — Fix Status Final

## Fix logic: DONE (dev = canonical c9e72ff6)
`payrollAutoBufferService.ts` + `payrollAutoBufferService.test.ts` checked out dari canonical `c9e72ff6`. Test 6 pass.

Perubahan: hapus guard `hariKerja===0?0` + tambah `attendanceDays = hariKerja>0?hariKerja:kehadiran` fallback. B0088 (sick leave hari_kerja=0) sekarang pakai `kehadiran`(=hk) → rate×hk.

## Sisa divergensi: DATA DB, bukan logic

Post-fix, B0088 P1B Juni dev vs live:
| Field | Dev post-fix | Live | 
|---|---|---|
| jabatan_rate | 2500 ✅ | 2500 |
| jabatan_jumlah | 70000 | 62500 |
| masa_kerja_rate | 2053.57 | 2300 |
| jumlah_hk | **28** | **25** |
| cuti_tahunan_hari | **6** | **4** |
| hari_kerja | 0 | 0 |

Logic `attendanceDays=hariKerja>0?hariKerja:kehadiran(=hk)`:
- Dev: hk=28 → 2500×28 = 70,000
- Live: hk=25 → 2500×25 = 62,500

**hk dev=28 vs live=25** = data `PR_TASKREGLN`/`PR_TASKREGLN_ARC` beda. `getAttendance` query identik dev vs canonical (COUNT DISTINCT TrxDate, UNION ALL LIVE+ARC). Jadi:
- Logic dev = canonical ✅
- Tapi DB dev (via SQL gateway lokal) punya row PR_TASKREGLN_ARC B0088 Juni berbeda dari DB live → hk beda → jabatan beda.

`cuti_tahunan_hari` juga beda (6 vs 4) — dari query cuti, data beda.

## Kesimpulan
- **Logic fix complete** — dev = canonical c9e72ff6 untuk payrollAutoBuffer + getAttendance.
- Divergensi tersisa = **data DB** (PR_TASKREGLN_ARC B0088 Juni di gateway lokal ≠ live DB). Bukan code fix.
- Untuk full parity: sync DB dev = DB live, ATAU verifikasi via DB live langsung.

## Catatan
- Sebelum fix: dev B0088 jabatan=0 (guard blok). 
- Post-fix: dev B0088 jabatan=70,000 (logic benar, tapi input hk=28 dari DB lokal).
- Live=62,500 (logic benar, input hk=25 dari DB live).
- Logic sama, data beda. Fix logic tidak akan membuat dev=live sampai DB disamakan.
