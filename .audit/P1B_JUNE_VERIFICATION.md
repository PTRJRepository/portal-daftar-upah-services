# P1B Juni — Verifikasi Penyebab Divergensi

**User report:** P1B upah_bersih Juni — versi lama/canonical vs dev beda (dev lebih besar ~+6jt).

## Verifikasi periode

### C1 (payrollPeriodAdjustments) — BUKAN penyebab Juni
Canonical `payrollPeriodAdjustments.ts:30-31`:
```ts
function isMay2026(context) { return Number(context.month) === 5 && Number(context.year) === 2026; }
// line 51: if (!isMay2026(context)) return [];
```
`getPayrollPeriodAdjustments` return **empty array** untuk SEMUA periode kecuali Mei 2026. Untuk Juni:
- Canonical: empty adjustments → `resolveAdjustedJabatanJumlah` return currentValue (fallback DB) → `shouldForcePotPph21ToTer` return false.
- Dev stub: same return (fallback, false).
- **Hasil: canonical ≡ dev untuk Juni di path ini.** C1 bukan penyebab divergensi Juni.

C1 relevan HANYA untuk Mei 2026 (B0088 jabatan=0, F0529+ARA PPh21=TER).

### C2 (dedupe dropped) — PENYEBAB UTAMA Juni (aktif semua bulan)
**Bukti:**
- Dev `dataExtractorService.ts:4968`:
  ```ts
  const incomeRows = await extDb.query<any>(`SELECT ... FROM employee_other_incomes WHERE period_month=? AND period_year=? ...`);
  // line 4988: for (const row of incomeRows) { ... }  // RAW, no dedupe
  ```
- Canonical `:4999-5007`:
  ```ts
  const incomeRowsRaw = await extDb.query<any>(`SELECT id, ..., new_nik, ... ORDER BY id`);
  const incomeRows = OtherIncomesService.deduplicateIncomeRows(incomeRowsRaw);
  ```

**Mekanisme:** `employee_other_incomes` di extend_db_ptrj bisa punya row duplikat per (emp_code, income_type, period) — dari import lama (NIK-based) vs baru (emp_code-based), atau re-seed tanpa DELETE bersih. Canonical dedupe by composite key `period|empCode|canonicalType` keep latest id. Dev pakai SEMUA row → income dobel dihitung → `incomeByEmp` bengkak → `total_pendapatan_lainnya` + `upah_bersih` naik.

**Untuk Juni:** dev +6jt vs canonical = income dobel P1B Juni ikut terhitung. Aktif SEMUA bulan (bukan period-specific seperti C1).

### Divergensi SELECT tambahan (komplikasi)
Dev SELECT tidak ambil `id` + `new_nik`; canonical ambil keduanya. Dedupe canonical BUTUH `id` (sort by id asc, keep last) + `new_nik` (composite key fallback). Jadi fix C2 bukan cuma "tambah call" — SELECT juga harus tambah `id, new_nik` agar dedupe canonical jalan benar.

## Kesimpulan
- **Juni divergensi = C2 (dedupe dropped), bukan C1.** C1 period-specific Mei 2026 saja.
- Penyebab lain aktif Juni: perlu cek C3 (snapshot, tidak relevan live), C6 (frontend display only, tidak ubah backend total). Kandidat lain: RC5 (3 dedupe semantics — taxReport path pakai key beda, bisa beda angka di tax report vs daftar upah).
- **Fix Juni:** restore dedupe call + SELECT `id, new_nik` di `dataExtractorService.ts:4968`.

## Validasi
Setelah fix C2:
1. Bandingkan P1B Juni upah_bersih dev vs live/canonical — harus match.
2. Log debug canonical: `Found X records, Y after dedupe` — Y < X berarti ada duplikat ter-dedupe.
3. Kalau masih beda setelah C2 fix → investigasi RC5 (dedupe key mismatch antar path) atau query P1B Juni income rows langsung untuk lihat duplikat.
