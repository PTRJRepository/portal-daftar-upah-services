# Report Consistency and Print Phase 1 Design

## Goal

Phase 1 fixes proven report inconsistencies and establishes a small print/layout foundation without redesigning every report at once.

## Current Context

The report surface is split across these pages:

- `SummaryReportPage.jsx`: gang/division detail, edit, validation, seed, THR mode.
- `WagesSummaryRebinmasPage.jsx`: Rebinmas wages summary, comparison, THR, impact shortcut.
- `WagesSummaryIJLPage.jsx`: IJL wages summary, comparison, impact shortcut.
- `ImpactReportPage.jsx`: cost impact analysis using summary data.
- `AnalysisReportPage.jsx`: premi and overtime analysis.
- `PayrollHistoryComparison.jsx`: Daftar Upah vs PR_EMPWAGES audit.

MCP knowledge confirms two guardrails:

- Backend summaries/totals should be the source of truth whenever a report total is displayed.
- Source mode must be explicit. Reports must not silently mix origin/history/overlay data.

## Phase 1 Scope

1. Fix Wages Comparison group filter not refreshing table rows.
2. Add a shared division-type helper for `all`, `real`, and `virtual` report scope.
3. Teach summary backend endpoints to accept `division_type=all|real|virtual` and build totals from the scoped rows.
4. Pass `division_type` from Wages Summary Rebinmas/IJL services so virtual-only mode is real virtual-only data.
5. Pass parent period and estate type into `ImpactReportPage` when opened from Wages Summary pages.
6. Add a minimal shared print foundation for report metadata/source display and safer print behavior.

## Out Of Scope For Phase 1

- Full visual redesign of every report page.
- Replacing all report pages with one report engine.
- Backend filtered totals for Analysis range filters. That remains Phase 2 because it needs a clear API contract for `ot_min`, `ot_max`, `premi_min`, and `premi_max`.
- Tax report changes. MCP says Tax Report already moved aggregate footers to backend summary.

## Architecture

### Backend

`backend/src/api/summary.ts` will own report-level summary scoping because it already builds `kpi_totals`, `group_subtotals`, and `grand_total`.

New helper behavior:

- `division_type=all`: no extra filter.
- `division_type=real`: remove virtual division rows.
- `division_type=virtual`: keep only virtual division rows.

Virtual division codes are based on the current summary service model: `INF`, `NRS`, `WKS_PG`, `WKS_AR`, `WORKSHOP`.

### Frontend

`frontend/src/services/summaryReportService.js` will pass `division_type`.

`WagesSummaryRebinmasPage.jsx` and `WagesSummaryIJLPage.jsx` will send the selected division type to summary and comparison endpoints.

`ImpactReportPage.jsx` will accept initial filter props:

- `initialMonth`
- `initialYear`
- `initialEstateType`

Wages Summary pages will pass their active period and scope when opening Impact Report.

### Print

A small CSS file will provide shared print-safe report primitives:

- source/metadata line
- print-safe table wrappers
- no sticky positioning in print
- consistent page break behavior

This does not replace the existing `wsp-*` print CSS yet; it provides stable shared overrides for Phase 1.

## Testing

Focused tests cover:

- Division type helper classifies real vs virtual rows.
- Summary route helper logic filters rows correctly.
- Wages Comparison group filter recomputes when `group` changes.

Manual/visual verification remains necessary for print layout after implementation.

## Risks

- Existing print CSS has several overlapping `@page` and table rules. Phase 1 reduces risk but does not fully eliminate cascade conflicts.
- Summary detailed `/division` virtual-only semantics are ambiguous for gang-level detail. Phase 1 scopes all-divisions/comparison first because those are the Wages Summary pages with visible division-type controls.

