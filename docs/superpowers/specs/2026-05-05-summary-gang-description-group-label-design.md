# Summary Gang Description Group Label Design

## Context

Summary Report detail currently groups gang rows by an asistensi number inferred from `gang_code`, then prints labels like `GROUP 1` and `GROUP 2`.

The requested behavior is to derive the visible group/division name from `gang_description` instead. Example descriptions may repeat a role or activity prefix and only differ in the final location/division name:

- `Gang Panen Air Papan`
- `Gang Rawat Air Papan`

The intended visible group label is `Air Papan`, not `Group 1` or the full activity description.

## Current Data Flow

- Backend `summaryService.getDivisionSummary()` reads summary rows from `daftar_upah_aggregation_history`.
- Backend also exposes `GET /payroll/summary/gang-descriptions`.
- Frontend `SummaryReportPage.jsx` loads that map and merges `gang_description` into each row.
- `SummaryReportPage.jsx` still groups rows by `getAsistensi(row.gang_code)` and prints `GROUP {group}`.

## Goal

Use the repeated wording in `gang_description` to infer a human group label for the Summary Report detail print grouping.

The grouping key should remain the existing asistensi number so filters and row membership do not change. Only the visible label changes.

## Proposed Behavior

For each print group:

1. Keep grouping rows by the existing asistensi key.
2. Collect non-empty `gang_description` values for rows in the group.
3. Normalize descriptions by trimming whitespace and splitting into words.
4. Infer the common meaningful suffix:
   - Prefer the longest suffix shared by at least two descriptions in the same group.
   - Ignore suffixes that are only generic words.
   - Use the suffix as the display label.
5. If no shared suffix can be found, use a fallback cleaner on the first description:
   - Remove generic leading words such as `gang`, `kemandoran`, `panen`, `rawat`, `pruning`, `bhl`, `harian`, `pemeliharaan`, and similar operational prefixes.
   - Use the remaining words if any remain.
6. If inference is still empty or unsafe, fall back to `Group {group}`.

Examples:

- `Gang Panen Air Papan`, `Gang Rawat Air Papan` -> `Air Papan`
- `Panen Bukit Batu`, `Rawat Bukit Batu` -> `Bukit Batu`
- `A1H` with no description -> `Group 1`

## UI Scope

Change only `SummaryReportPage.jsx` first:

- Print group row label changes from `GROUP {group}` to the inferred label, uppercased for report style.
- Footer total label can use the same inferred label when a group filter is active.
- The group dropdown can remain `Group 1`, `Group 2` for now because its purpose is selection, not report naming.

No backend schema or endpoint change is required.

## Testing

Update the existing `SummaryReportPage.printHeader.test.js` source-inspection test to assert:

- Group label inference helper exists.
- Print rows render an inferred group label instead of hardcoded `GROUP {group}`.
- Existing description-before-code assertion remains valid.

Run the focused frontend test:

```bash
cd frontend && npx vitest run src/pages/SummaryReportPage.printHeader.test.js
```

## Risks

`gang_description` values may not always share a clean suffix. The fallback to `Group {group}` prevents misleading labels when inference fails.

The heuristic may need additional generic words after seeing real production descriptions. Those additions should be small and test-backed.
