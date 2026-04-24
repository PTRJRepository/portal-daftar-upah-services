# Payroll Source Flow (Canonical)

Last updated: 2026-04-24

Tujuan dokumen ini: memastikan semua engineer/agent memakai sumber nilai yang sama, dalam urutan yang sama, dan tidak mengulang perhitungan dari sumber alternatif.

## 1. Source Mode Contract

- `origin`:
  - baca data operasional (`db_ptrj` + tabel HR terkait).
- `history`:
  - baca snapshot/history (`extend_db_ptrj`) sesuai `snapshot_version` bila diminta.
- `overlay/manual adjustment`:
  - diterapkan di atas data base sesuai mode, lalu seluruh nilai turunan dihitung ulang oleh kalkulator kanonik.

Rule:
- jangan campur mode dalam satu response payload.
- jangan fallback antar mode tanpa kontrak eksplisit.

## 2. Raw/Resolved Field Sources

### Employee identity/profile
- `emp_code`, `nama`, `gender`, `gang_code`, `loc_code`:
  - base dari extractor query employee.
- `nik`:
  - prioritas: history/override mapping (`history_hr_employee`/profile source) lalu fallback ke employee source.
- `jabatan` (role text):
  - prioritas: `history_gang_member.jabatan` -> `employee_estate.jabatan` -> fallback terbatas dari source employee bila kosong.

### Attendance and work
- `jumlah_hk`, `total_jam_kerja`, `gaji_pokok_aktual`:
  - dari agregasi attendance extractor.
- `cuti_*`:
  - dari leave extractor.
- `hari_kerja`:
  - turunan dari `jumlah_hk - total_cuti`.

### Allowance/premium/deduction raw components
- `lembur_jam`, `lembur_jumlah`:
  - dari overtime extractor.
- `beras_jumlah`, `jabatan_jumlah`, `masa_kerja_jumlah`:
  - dari upah/tunjangan resolver.
- `premi_*`, `potongan_*`:
  - dari premi/potongan extractor + manual adjustment overlay.
- `pendapatan_lainnya`:
  - dari `employee_other_incomes` (THR/Bonus/Custom/dll).

## 3. Derived Field Contract (Single Path)

Semua field turunan payroll wajib dihitung oleh:
- `backend/src/services/payroll/components/PayrollCalculator.ts`

Jangan hitung ulang manual di service lain untuk field ini:
- `upah_kotor`
- `jumlah_upah_kotor`
- `upah_kotor_pajak`
- `penghasilan_bruto`
- `total_potongan`
- `total_potongan_bersih`
- `upah_bersih`
- `pph21_ter`, `tarif_pajak_ter`

Formula kanonik:
- `total_tunjangan = beras_jumlah + jabatan_jumlah + masa_kerja_jumlah + lembur_jumlah`
- `upah_kotor = gaji_pokok_aktual + total_tunjangan + total_premi`
- `jumlah_upah_kotor = upah_kotor - pot_koreksi + pendapatan_lainnya`

Critical rule:
- karena `total_tunjangan` sudah mencakup `lembur_jumlah`, jangan pernah menambahkan `lembur_jumlah` lagi di rumus gross.

## 4. Aggregation Contract

- Gang/division/grand totals harus menjumlah field row yang sudah kanonik.
- Jangan tambahkan kompensasi/hack khusus field (`jumlah_upah_kotor`, dll) di layer total.

## 5. Implementation Anchors

- Row extraction + enrichment:
  - `backend/src/services/dataExtractorService.ts`
- Canonical formulas:
  - `backend/src/services/payroll/components/PayrollCalculator.ts`
- Totals:
  - `backend/src/services/payrollTotalsCalculator.ts`
- Aggregation adapter:
  - `backend/src/services/payroll/formulas/adapters/aggregationAdapter.ts`

## 6. Guardrails for Future Changes

- Jika menambah field baru:
  - tentukan `raw source` + `source precedence` + `derived rule` di dokumen ini.
- Jika field memengaruhi net/gross/tax:
  - integrasikan ke `PayrollCalculator`, bukan ke patch manual di extractor.
- Jika butuh fallback:
  - tulis fallback di komentar kode tepat di titik resolver, dengan alasan bisnisnya.
