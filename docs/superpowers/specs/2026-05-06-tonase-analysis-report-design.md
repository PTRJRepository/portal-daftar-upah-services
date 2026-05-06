# Tonase Analysis Report Design

## Goal

Add a professional, print-optimized tonase report that gives management a general estate-wide view of harvest productivity and payroll efficiency. The report explains movement over the last 5 months, not only raw numbers.

## Scope

Create a new sidebar report page for tonase analysis. The page is accessible from the `Analisis & Laporan` sidebar section alongside existing analysis and report entries.

The report covers the selected month and the 4 previous months. If the user selects May 2026, the trend window is January 2026 through May 2026.

The default scope is the whole estate, summarized like other total/general reports. The report does not default to per-employee detail. Gang-level data can be used internally to calculate harvest-only metrics, but the printed output focuses on estate totals and compact analytical breakdowns.

## Metrics

The report uses harvest gang data for productivity and Cost/HK analysis. Harvest gangs follow the existing gang classification rule used by dashboard services.

Primary metrics:

- Total tonase.
- Total HK.
- Total upah bersih.
- Total premi.
- Upah bersih per HK.
- Premi per HK.
- Upah bersih per ton.
- Premi per ton.
- Premi share against upah bersih.

The Cost/HK basis is upah bersih, not gross wage.

## Report Layout

Use a one-report-page structure designed for screen and print:

- Header with report title, selected period, generated timestamp, and filter scope.
- KPI row for total tonase, upah bersih/HK, premi/HK, upah bersih/ton, and total premi.
- Insight strip with short automatic observations:
  - month with highest tonase,
  - largest month-to-month tonase movement,
  - whether upah bersih/HK is rising or falling,
  - premium share against upah bersih,
  - missing or zero tonase warning when relevant.
- 5-month trend chart showing tonase movement and efficiency lines.
- Premium breakdown section showing total premi by type and per-HK impact.
- Compact summary table for the 5 monthly periods.

The design is restrained and operational: dense enough for review, clean enough for printing, and consistent with existing report components.

## Data Flow

Add a backend report endpoint that returns a ready-to-render payload:

`GET /payroll/dashboard/tonase-analysis-report?month=&year=&division_code=`

The service will:

- Build the 5-month period window from the selected month/year.
- Read aggregation history for the matching periods.
- Filter harvest gangs for HK, upah bersih, premi, and efficiency metrics.
- Use existing tonase fields from aggregation history, with the current dashboard production fallback where needed.
- Aggregate all estate data into period totals.
- Return premium component totals from `total_premi_brondol`, `total_premi_prunning`, `total_premi_insentif`, `total_premi_kinerja`, and a computed `Lainnya` bucket from the remainder of `total_premi`.
- Compute insight values in the backend service so the frontend can render a stable report contract.

Suggested response shape:

- `meta`: selected period, period window, scope label.
- `kpis`: current month estate totals and efficiency metrics.
- `trend`: 5 rows, one per month.
- `premium_breakdown`: premium categories with total amount, per-HK value, per-ton value, and share.
- `insights`: concise computed observations.
- `warnings`: data quality notes, especially missing tonase or zero HK.

## Frontend

Add a frontend service wrapper for the new endpoint and a new route/page:

- Route: `/tonase-analysis`.
- Page: `frontend/src/pages/TonaseAnalysisReportPage.jsx`.
- Sidebar label: `Analisis Tonase`.

The page reuses existing report infrastructure where possible:

- existing filter patterns for month/year and division scope,
- Recharts for the trend chart,
- existing print metadata and watermark helpers,
- existing report print foundation CSS.

Add the sidebar entry to the existing `Analisis & Laporan` section in `frontend/src/layouts/DashboardLayout.jsx`. Add a Dashboard shortcut under `Laporan Analisis & Summary` only if it fits the existing shortcut pattern without crowding the page.

## Print Rules

Print uses A4 landscape. The first printed page contains the report header, KPI row, insight strip, trend chart, premium breakdown, and monthly summary table when space allows.

Print CSS will:

- avoid wide horizontal overflow,
- use fixed table layout for summary tables,
- keep chart height stable,
- avoid nested cards,
- use compact type and consistent spacing,
- page-break before any appendix only if extra detail becomes necessary.

No per-employee appendix is required for this feature.

## Error Handling

When no data exists for the selected period, show an empty state that explains the period and scope being queried.

When tonase is missing but payroll data exists, still show HK, upah bersih, and premi totals, then mark tonase-dependent metrics as unavailable.

When HK is zero, avoid divide-by-zero output and show the related per-HK metric as unavailable.

## Testing

Backend tests cover:

- 5-month period window across year boundaries.
- harvest-only aggregation for HK/upah bersih/premi.
- upah bersih per HK calculation.
- premi per HK and per-ton calculation.
- zero HK and zero tonase handling.

Frontend tests cover:

- endpoint URL construction,
- render of key KPI labels,
- empty-state behavior,
- print/source guard for the main report sections.

Run focused tests first. Because this work touches manual adjustment context in the same branch, include `bun test src/services/manualAdjustmentService.test.ts` before finishing.

## Non-Goals

No per-employee payroll appendix. No Excel export in the first pass. No changes to payroll calculation rules. No change to existing Analysis, Productivity, or Mill Production reports except sidebar navigation if needed.
