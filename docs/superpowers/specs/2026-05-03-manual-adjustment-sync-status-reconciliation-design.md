# Manual Adjustment Sync Status Reconciliation Design

## Goal

Make the Seeder page "Seed Sync Status Manual Adj" button re-audit manual adjustment sync status for the selected payroll period and division scope. The audit must compare `extend_db_ptrj.dbo.payroll_manual_adjustments` rows against `db_ptrj` Plantware ADTRANS rows and rewrite remarks status based on the current total value.

## Source Of Truth

- Stored rows are read from `extend_db_ptrj.dbo.payroll_manual_adjustments`.
- Plantware comparison rows are read from `db_ptrj.dbo.PR_ADTRANS` + `PR_ADTRANSLN` and `db_ptrj.dbo.PR_ADTRANS_ARC` + `PR_ADTRANSLN_ARC`.
- The comparison key is employee, period, division/LocCode, and the adjustment category/name mapping.
- Multiple matching ADTRANS rows are totaled before comparison, following the existing daftar upah behavior.

## Daftar Upah Aggregation Rules To Reuse

- Premi: daftar upah sums `PR_ADTRANSLN.Amount` grouped by employee, DocDesc, TaskCode, and TaskDesc, then sums again into the normalized premium field.
- Potongan and koreksi: daftar upah sums `COALESCE(Amount, 0)` and applies `Math.abs()` when merging into the employee potongan field.
- Jabatan and masa kerja auto-buffer: daftar upah sums all matching ADTRANS amounts per employee.
- SPSI auto-buffer: daftar upah compares against the absolute SPSI deduction value.
- Manual adjustment overlay already aggregates duplicate stored adjustment rows that map to the same field.

## Required Behavior

For every selected period row, including rows already marked `sync:SYNC`:

- If total matching ADTRANS amount equals the stored target amount within 0.01, remarks become `sync:SYNC | match:MATCH`.
- If matching ADTRANS rows exist but the total amount differs, remarks become `sync:DIFF | match:MISMATCH`.
- If no matching ADTRANS amount exists, remarks become `sync:MISS | match:MISMATCH`.

The target stored amount uses metadata detail totals when available, otherwise `payroll_manual_adjustments.amount`. Deduction-like values compare by absolute value, consistent with daftar upah potongan handling.

## Adjustment Coverage

The seeder must process:

- `PREMI`
- `POTONGAN_KOTOR`
- `POTONGAN_BERSIH`
- `AUTO_BUFFER`

AUTO_BUFFER adjustment names map to ADTRANS text as:

- `TUNJANGAN JABATAN` and legacy `AUTO TUNJANGAN JABATAN` -> `jabatan`
- `MASA KERJA` and legacy `AUTO MASA KERJA` -> `masa kerja`
- `SPSI` and legacy `AUTO SPSI` -> `spsi`

## Data Flow

1. Frontend sends selected `period_month`, `period_year`, and division scope to `/payroll/manual-adjustment/seed-sync-status`.
2. Backend seeder expands default adjustment types to include manual adjustment types plus `AUTO_BUFFER`.
3. Backend reads all candidate manual adjustment rows with pipe-delimited remarks containing `sync:`.
4. Backend reads ADTRANS details for all candidate employees and LocCodes in one query.
5. Backend filters and totals matching ADTRANS details per candidate row.
6. Backend updates only the status segments inside remarks:
   - `sync:<status>`
   - `match:<status>`
7. Backend returns row-level status, target amount, ADTRANS amount, diff, and ADTRANS details for audit logging.

## Testing

Focused backend tests should cover:

- existing `sync:SYNC` rows are rechecked and can become `sync:DIFF`;
- multiple ADTRANS rows are summed before comparison;
- missing ADTRANS writes `sync:MISS | match:MISMATCH`;
- AUTO_BUFFER rows are included and mapped to jabatan, masa kerja, and SPSI categories;
- potongan and koreksi compare by absolute value.

Frontend testing can stay light unless the UI payload or log fields change.
