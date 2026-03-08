# Adding Details to THR Summary Report

We need to add Tunjangan Beras Total, Tunjangan Jabatan, and counts for Full vs Proportional workers to the THR UI summary report mode.

## Proposed Changes

### Backend

#### [MODIFY] otherIncomesService.ts
- Modify `getIncomesWithDetails` and `calculateTHRData` to include `JABATAN_JUMLAH` in `details.variables`.
- Update `getThrSummary` to aggregate new fields:
  - `full_workers`: Count of workers where `PROPORTION_FACTOR` evaluates to 1.
  - `prop_workers`: Count of workers where `PROPORTION_FACTOR` evaluates to < 1.
  - `tunjangan_beras`: Sum of `(BERAS_RATE * 30) * PROPORTION_FACTOR`.
  - `tunjangan_jabatan`: Sum of `JABATAN_JUMLAH * PROPORTION_FACTOR`.
  - Add these fields into the `gangMap` object and `grandTotal`.

### Frontend

#### [MODIFY] SummaryReportPage.jsx
- Update the table header in THR mode to include the new columns:
  - `PEKERJA FULL`, `PEKERJA PROPORSI`, `TUNJ. BERAS`, `TUNJ. JABATAN`.
- Render the corresponding data in the table body.
- Render the new grand totals in the table footer.
- Incorporate these new columns into the Excel CSV export logic for THR Mode.

## Verification Plan

### Automated Tests
- Run `bun run dev` frontend and `bun run dev` backend to ensure no compilation errors.

### Manual Verification
- Go to the Summary Report page.
- Toggle to THR Mode.
- Verify the new columns (Pekerja Full, Pekerja Proporsi, Tunj. Beras, Tunj. Jabatan) appear and display populated numbers.
- Verify the CSV export matches the new columns.
