# Payslip Activity And Tax Summary Design

## Context

The printable payslip currently fits four employee slips on one A4 portrait page. It already shows core payroll values, but the calculation evidence is not intuitive enough for manual checking:

- Koreksi detail is hidden from the printed slip even though it directly reduces income.
- Activity facts such as sick days and overtime totals are visible in the employee activity detail page, but only partially visible in the slip.
- PPh 21 appears as a deduction, but the slip does not clearly show the compact tax basis that users need to validate the result.
- The signature section is not needed and consumes space that should be used for calculation explanation.

The user approved a compact design that keeps the four-slips-per-A4 format while adding enough explanation for manual checking.

## Goals

- Keep the payslip compact enough for four slips per A4 portrait page.
- Show koreksi in the income column because it reduces income directly.
- Add a compact activity summary showing HK, sick days, overtime, and koreksi.
- Add a compact PPh 21 component explanation including bruto/DPP, other income, Astek/BPJS, TER rate, and PPh 21 amount.
- Remove the signature section from the printed slip.
- Preserve existing totals and avoid changing payroll calculation logic.

## Non-Goals

- Do not add full per-date activity tables to the payslip.
- Do not change backend payroll calculations.
- Do not change the employee activity detail page.
- Do not reduce the page to fewer than four slips per A4 unless the existing data already overflows.

## Layout Design

### Income Column

The income column remains the primary calculation path for gross income:

1. Gaji pokok breakdown.
2. Tunjangan.
3. Premi.
4. Lembur.
5. Pendapatan lainnya.
6. Koreksi pendapatan as a negative income row.
7. Total pendapatan kotor.

Koreksi uses a label such as `Koreksi Pendapatan (-)` and prints the koreksi amount in the same numeric style as other values. It must not appear under the deduction column as `Potongan Upah Kotor`.

### Deduction Column

The deduction column shows net-pay deductions:

1. BPJS Kesehatan.
2. BPJS Pensiun.
3. Astek/JHT.
4. SPSI.
5. PPh 21.
6. Any existing non-duplicate dynamic deductions.
7. Total potongan.

PPh 21 keeps the current tax row, then adds a very small `Komponen Pajak` block when tax-related values exist. The block should be compact and print-safe:

- Bruto/DPP: `penghasilan_bruto` or `jumlah_upah_kotor`.
- Pendapatan Lainnya: total other income included in bruto.
- Astek/BPJS: available worker deductions used as tax/social-security context.
- Tarif TER: `tarif_pajak_ter` with `kategori_ter` and `status_ptkp` when available.
- PPh 21: `pph21_ter` or `pot_pph21`.

### Activity Summary

Add a compact summary row or boxed strip near the top of the slip, after employee info and before the income/deduction columns. It should use the data already passed to `PayslipCard`:

`HK: 20 | Sakit: 2 | Lembur: 6j = 450.000 | Koreksi: 75.000`

Fallbacks:

- HK comes from `jumlah_hk` or `hari_kerja`.
- Sakit comes from attendance summary or `cuti_sakit_haid_hari`.
- Lembur uses `lembur_jam`, `total_jam_lembur`, `lembur_jumlah`, `total_upah_lembur`, or `upah_lembur`.
- Koreksi uses `potongan_upah_kotor_total`, `pot_koreksi`, or summed positive `koreksi_*` fields except `koreksi_hk`.

The summary is explanatory only. It must not change totals.

### Signature Removal

Remove the printed signature section from `PayslipCard`. The freed vertical space is used for the compact activity and tax explanation. No replacement approval text is needed.

## Data Flow

This change is frontend-only unless implementation proves the needed fields are absent from payslip data. `PayslipPrintPage` already passes either cached UI row data or batch checkroll data into `PayslipCard`. The component should derive the new display rows from existing flat payroll fields, nested `attendance.summary`, and existing other-income data.

If an API result lacks a value, the slip should omit the detail or print `0` where the existing slip already prints numeric zero. It should not fabricate values.

## Error Handling

- Missing payroll data keeps the existing `Data Gaji Tidak Ditemukan` behavior.
- Missing optional tax component values omit only that component line.
- Missing activity summary values default to zero.
- Dynamic deduction and koreksi scanning must avoid duplicate labels and avoid counting the same value twice.

## Testing

Add focused frontend tests in `frontend/src/components/PayslipCard.test.jsx`:

- Koreksi appears in the income column as negative income and does not appear as `Potongan Upah Kotor`.
- The compact activity summary prints HK, sick days, overtime, and koreksi.
- PPh 21 component details include bruto/DPP, other income, Astek/BPJS, TER rate, and PPh 21 when values are present.
- The signature section is not rendered.

Run focused tests first:

```bash
cd frontend
npx vitest run src/components/PayslipCard.test.jsx src/styles/payslip-print.test.js
```

Then run a broader frontend build or related test if layout/CSS changes are substantial.

## Self-Review

- No placeholders remain.
- Scope is limited to the printable payslip component and related tests/styles.
- The design keeps four slips per A4 and does not require backend calculation changes.
- Koreksi placement is explicit: income column only, as a negative income row.
- Tax explanation is compact and conditional, so it does not require unavailable fields.
