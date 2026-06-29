# P1B Juni — Root Cause FINAL CONFIRMED

**Divergensi:** P1B Juni B0088 jabatan_jumlah dev=0 vs live=62,500. Grand upah_bersih dev 597,849,140 vs live 597,911,640 (-62,500).

## Sumber truth yang benar
- User tunjuk canonical = `temp/server-changes-1` @ `c9e72ff6` → punya guard `hariKerja===0?0` + tidak ada `attendanceDays` fallback.
- **Tapi live deploy = `origin/server-changes-1` @ `253eb1ea`** (1 commit behind temp) → TANPA guard + ADA `attendanceDays` fallback.
- Live B0088=62,500 → live = origin/253eb1ea, BUKAN temp/c9e72ff6.

**Konflik:** user anggap canonical c9e72ff6 = live, tapi ternyata live = origin 253eb1ea (code beda untuk B0088). User mau dev = live → dev harus ikut **origin/253eb1ea**, bukan temp/c9e72ff6.

## Perbedaan tepat (`payrollAutoBufferService.ts` ~line 264-269)

### DEV (HEAD) — B0088=0 ❌
```ts
const jabatanAmountAuto = forceZeroRate
    ? 0
    : (hasJabatanRate && hariKerja > 0 ? (jabatanRateResolved as number) * hariKerja : null);
const jabatanAmount = hariKerja === 0
    ? 0
    : (jabatanAmountAuto !== null ? jabatanAmountAuto : dbJabatanJumlah);
```
- Tidak ada `attendanceDays` var.
- Guard `hariKerja === 0 ? 0` blok fallback.
- B0088 (hari_kerja=0): jabatanAmountAuto=null (karena hariKerja>0 false) → guard return 0.

### ORIGIN/live (253eb1ea) — B0088=62,500 ✅
```ts
const kehadiran = Math.max(0, toNumber(input.kehadiran));
const attendanceDays = hariKerja > 0 ? hariKerja : kehadiran;
...
const jabatanAmountAuto = forceZeroRate
    ? 0
    : (hasJabatanRate && attendanceDays > 0 ? (jabatanRateResolved as number) * attendanceDays : null);
const jabatanAmount = jabatanAmountAuto !== null ? jabatanAmountAuto : dbJabatanJumlah;
```
- `attendanceDays` fallback: hariKerja=0 → pakai `kehadiran` (=hk=25).
- Tidak ada guard `hariKerja===0?0`.
- B0088: attendanceDays=25, rate=2500 → jabatanAmountAuto=62,500 → jabatanAmount=62,500. ✅

## B0088 data
- hari_kerja=0 (sick leave: jumlah_hk=25, cuti_sakit=20, cuti lain=5 → 25-25=0)
- kehadiran/hk = 25
- jabatan = kerani kantor, rate 2500
- Tidak ada manual adjustment Juni (count=0 di dev & live)
- Live default: 62,500 (dari rate×attendanceDays=2500×25)
- Live db_ptrj_only/history: 0 (snapshot menyimpan 0)

## Fix
Samakan dev `payrollAutoBufferService.ts` ke origin/253eb1ea:
1. Tambah `const kehadiran = Math.max(0, toNumber(input.kehadiran));`
2. Tambah `const attendanceDays = hariKerja > 0 ? hariKerja : kehadiran;`
3. Ganti `hariKerja > 0` → `attendanceDays > 0` di jabatanAmountAuto
4. Ganti `hariKerja > 0 ? ... : hariKerja` → `attendanceDays > 0 ? ... : attendanceDays` di jabatanRate
5. Hapus guard `hariKerja === 0 ? 0 :` → `jabatanAmount = jabatanAmountAuto !== null ? jabatanAmountAuto : dbJabatanJumlah`
6. `jabatanUsedFallback`: `jabatanAmountAuto === null` (bukan `hariKerja > 0 && ...`)
7. Sama untuk masa_kerja_rate (pakai attendanceDays)

## Catatan: canonical c9e72ff6 vs origin 253eb1ea
c9e72ff6 (temp) = 1 commit ahead origin, nambah guard `hariKerja===0?0`. Tapi live deploy dari origin (tanpa guard). User bilang "canonical GitHub c9e72ff6 = benar logic" tapi juga "live = stabil benar". Dua konflik untuk B0088. Keputusan: ikut live (62,500) karena user mau "tidak ada perbedaan dengan live". Berarti c9e72ff6 guard itu SALAH untuk live parity.

Investigasi: apakah c9e72ff6 guard itu intentional fix atau bug? Commit msg c9e72ff6 "Consolidate in-progress changes" — guard mungkin eksperimen. Live (origin) tidak pakai → live = truth.
