# Analysis Report Print Insights Design

## Goal

Improve the `/analysis` report print output for Premi and Lembur so the printed report reads as an executive analysis, not a wide data dump, and does not overflow A4 landscape.

## Scope

The change targets `frontend/src/pages/AnalysisReportPage.jsx` and print-specific CSS used by `#wsp-report-content`. The `/comprehensive` payroll analysis page is out of scope.

## Design

Use the approved "Print Executive + Appendix" approach.

Screen mode keeps the current detailed report structure and full premi breakdown table. Print mode prioritizes a compact first page:

- Header and metadata.
- KPI comparison for total premi and total lembur.
- Insight strip with automatic callouts:
  - total variance percentage for Premi and Lembur,
  - largest cost driver by division,
  - largest current Premi division,
  - largest current Lembur division.
- Compact progress table per division with fixed column widths.
- Appendix page for premi breakdown using the top 8 current-month premi categories plus `LAINNYA`.

## Data Flow

Create a small frontend utility to derive report insights from the existing API payload:

- input: `premi_ot_table`, `totals`, `all_premi_headers`, `breakdown_totals`;
- output: percent deltas, top division callouts, print-safe premi headers, and rows with a computed `LAINNYA` bucket.

This keeps calculations testable and avoids adding backend work for a print-only presentation change.

## Print Layout Rules

Print CSS is scoped to `#wsp-report-content` to avoid conflicting with global `.wsp-table` rules. Wide tables use `table-layout: fixed`, explicit column widths, compact type, wrapped labels, and no sticky columns. The appendix has a page break before it and never prints all dynamic premi columns directly.

## Testing

Add focused Vitest coverage for the new insight utility and CSS/source guard tests for the print-only top-premi appendix selectors. Run the smallest relevant tests first, then build the frontend.

## Non-Goals

No API contract changes, no changes to `/comprehensive`, no PDF generator rewrite, and no new print mode selector.
