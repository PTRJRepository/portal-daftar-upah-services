# Auto Buffer Potongan PPH Design

## Goal

Extend the existing Seeder page "Seed Auto Buffer -> Manual Adj" flow so it also stores calculated PPh21 TER as an auto-buffer manual adjustment named `POTONGAN PPH`.

The seeded nominal must come from the Daftar Upah calculated tax field:

```text
POTONGAN PPH.amount = payroll row pph21_ter
```

`pot_pph21` from Plantware/db_ptrj is only a comparison source for sync status. It must not be used as the seeded amount.

## Current Context

The existing frontend button calls:

```text
POST /payroll/manual-adjustment/seed-auto-buffer
```

The backend route delegates to `autoBufferManualAdjustmentSeederService.seedPeriod()`. That service extracts Daftar Upah rows through `dataExtractorService.extractPayrollData(...)` and currently writes three `AUTO_BUFFER` rows per employee:

- `TUNJANGAN JABATAN`
- `MASA KERJA`
- `SPSI`

Daftar Upah already exposes:

- `pph21_ter`: calculated PPh21 TER from `PayrollCalculator`.
- `pot_pph21`: existing Plantware/db_ptrj PPh21 deduction, if it has already been input.

## Required Behavior

When the existing auto-buffer seeder runs, it must generate four `AUTO_BUFFER` rows per valid employee:

- `TUNJANGAN JABATAN`
- `MASA KERJA`
- `SPSI`
- `POTONGAN PPH`

For `POTONGAN PPH`:

- `adjustment_type` is `AUTO_BUFFER`.
- `adjustment_name` is `POTONGAN PPH`.
- `amount` is `Math.abs(row.pph21_ter || 0)`.
- `metadata_json.amount` and `metadata_json.total_amount` use the same `pph21_ter` amount.
- Remarks use the pipe-delimited auto-buffer format with AD mapping `DEPH21 - (DE) POTONGAN PPH21`.
- Initial remark status compares the seeded `pph21_ter` amount with `row.pot_pph21` when available.

The seeder's existing replace behavior remains unchanged:

- delete seed-owned `AUTO_BUFFER` rows in the selected period/division/gang scope;
- preserve rows marked manual via `sync:MANUAL` or `match:MANUAL`;
- skip newly generated rows that conflict with preserved manual rows.

## Architecture

Keep the change inside the existing auto-buffer path:

- Extend the auto-buffer adjustment name/adcode mapping to include `POTONGAN PPH`.
- Extend `ExtractedPayrollLike` with `pph21_ter` and `pot_pph21`.
- Extend `buildAutoBufferSeedEntries()` to add one `POTONGAN PPH` entry per employee.
- Extend validation/sync mapping so `POTONGAN PPH` compares against ADTRANS rows whose DocDesc or TaskDesc maps to PPh21, including `POTONGAN PPH`, `POTONGAN PPH21`, and `DEPH21`.
- Leave the frontend button and route unchanged, except UI text/log totals can mention that PPH is now included if needed.

No new table, route, or standalone button is required.

## Data Flow

1. User clicks `Seed Auto Buffer -> Manual Adj`.
2. Frontend posts the same payload to `/payroll/manual-adjustment/seed-auto-buffer`.
3. Backend extracts Daftar Upah rows for the selected period/division.
4. For each valid employee, backend builds four auto-buffer entries.
5. `POTONGAN PPH` uses `pph21_ter` as the stored target amount.
6. Backend writes rows to `extend_db_ptrj.dbo.payroll_manual_adjustments`.
7. Backend validates seed-owned rows against db_ptrj ADTRANS totals and updates `sync:` / `match:` remarks.

## Error Handling

- Missing or non-numeric `pph21_ter` is treated as `0`, matching existing auto-buffer numeric handling.
- Rows with numeric-only NIK in `emp_code` remain skipped, matching existing identity safety behavior.
- Unknown auto-buffer adjustment names still throw from ADCode resolution, so mapping gaps fail loudly during tests.
- Validation must use absolute deduction amounts to match Daftar Upah potongan handling.

## Testing

Focused backend tests should cover:

- `buildAutoBufferSeedEntries()` creates four entries per employee.
- `POTONGAN PPH.amount` equals `pph21_ter`, not `pot_pph21`.
- `POTONGAN PPH` metadata stores `amount` and `total_amount` equal to `pph21_ter`.
- ADCode mapping resolves `POTONGAN PPH` to `DEPH21 - (DE) POTONGAN PPH21`.
- validation marks `POTONGAN PPH` as `SYNC/MATCH` when db_ptrj PPh21 total equals the seeded TER amount.
- validation marks mismatch when db_ptrj PPh21 differs from the seeded TER amount.

Frontend testing can stay minimal because no new control flow is added.
