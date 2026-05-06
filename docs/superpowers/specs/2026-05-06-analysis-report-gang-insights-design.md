# Analysis Report Gang Insight Redesign

## Context

The `/upah/analysis` page is intended to compare premi and lembur between the selected month and the previous month. The current backend payload for `premi_ot_table` is produced from `getDivisionSummary()`, which returns gang-level rows. The UI labels the first column as estate/division and mostly displays `description`, so repeated estate or division descriptions appear as duplicate rows even when the actual separator is `gang_code`.

## Goals

- Make the row separator explicit: the report detail rows are per gang.
- Keep estate/division visible as the parent grouping, not as the only row label.
- Add gang description beside the gang code so repeated estate/division names are explainable.
- Improve insight density with clear driver, riser, reducer, and per-row diagnostic text.
- Preserve existing analysis filters, period selectors, print/PDF actions, and current backend endpoint contract where possible.

## Recommended Approach

Use a grouped report layout:

- Group rows by `division_code` and `description`.
- Render each estate/division as a group header with group totals and net variance.
- Render child rows per gang with `gang_code`, `gang_description`, premi previous/current/diff, OT previous/current/diff, net diff, and a compact insight label.
- Keep full premi breakdown based on the same gang rows, but label the first column as gang instead of division.

This matches the real data shape and fixes the confusing repetition without requiring a backend data model change.

## Data Shape

The page should continue consuming `premi_ot_table`, with each row treated as a gang row. The frontend should normalize each row to include:

- `division_code`: parent division or estate code.
- `description` or `estate`: parent division or estate description.
- `gang_code`: detail row identity.
- `gang_description`: human-readable gang description.
- `prev_premi`, `curr_premi`, `diff_premi`.
- `prev_ot`, `curr_ot`, `diff_ot`.
- `premi_breakdown`: current-month dynamic premi amounts.

If `gang_code` or `gang_description` is missing, the UI should fall back to the division code/description so old payloads still render.

## Insight Rules

Compute insights in the existing `analysisReportInsights` helper:

- `total_diff = diff_premi + diff_ot`.
- `topCostDrivers`: largest positive net variance rows.
- `topCostReducers`: most negative net variance rows.
- `largestPremiumGang`: row with the largest current premi.
- `largestOvertimeGang`: row with the largest current OT.
- Group summaries: count of gangs, total current premi, total current OT, net variance, and top driver per division.

Per-row insight label should be deterministic:

- Positive net variance driven more by premi: `Premi naik dominan`.
- Positive net variance driven more by OT: `Lembur naik dominan`.
- Negative net variance: `Menekan biaya`.
- No meaningful variance: `Stabil`.

## UI Layout

The report should use option B from the visual companion:

- Top KPI cards remain, but labels clarify that the detail is gang-level.
- Add an insight strip below KPI cards with four concise cards: driver terbesar, premi terbesar, lembur terbesar, and saving terbesar.
- Replace the flat Summary Premi & OT table with a grouped table:
  - Group header row: `division_code - description`, gang count, current premi, current OT, net variance.
  - Child rows: gang code, gang description, previous/current/diff columns, net diff, insight.
- Update the full premi breakdown table so the first columns are `Estate/Divisi`, `Gang`, and `Uraian`, followed by dynamic premi headers and total premi.

## Print Behavior

Print should remain landscape. Group headers and child rows should print in a compact table. Sticky screen-only behavior must be disabled in print. Existing print appendix behavior should remain, but row labels should identify gangs rather than only divisions.

## Error Handling

- Empty rows: show the existing report shell with zeroed insights and an empty-state row.
- Missing previous month: show current values, zero previous values, and `Periode baru` percentage text.
- Missing gang description: display `gang_code` and `-` for the description.

## Testing

- Add or update frontend unit tests for `buildAnalysisReportInsights()` to verify grouped summaries, top reducers, largest premium gang, and row insight labels.
- Add a page source/render-oriented test if existing patterns allow it, verifying the analysis page imports/uses grouped labels and displays gang-level columns.
- Run focused Vitest tests for analysis report helpers and page print checks.
