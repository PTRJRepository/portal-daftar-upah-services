# history_hr_employee new_nik Daftar Upah Design

Date: 2026-05-04

Scope: Daftar Upah identity display, `history_hr_employee.new_nik` consumption, Excel export identity value, NIK full/ellipsis UI.

## Goal

Use the existing `extend_db_ptrj.dbo.history_hr_employee.new_nik` column to display the latest NIK in Daftar Upah without overwriting or waiting on the old `nik` value.

The user-facing table should show a NIK column by default. Long NIK values are truncated with ellipsis first, with a small per-cell control to reveal the full value. Audit-safe fields remain available in the row payload so old and new NIK values stay traceable.

## Existing Context

`history_hr_employee` already has these relevant columns:

- `nik`
- `new_nik`
- `emp_code`
- `emp_name`
- period and gang/division fields

Current Daftar Upah enrichment reads `history_hr_employee.nik` for NIK lookup, but it does not consistently select or prioritize `new_nik` for the main table display. Some downstream export/report code already expects a `new_nik || nik` pattern, so the safest design is to make the row payload explicit instead of relying on scattered fallbacks.

## Non-Goals

- Do not add a new database column for this feature.
- Do not overwrite `history_hr_employee.nik`.
- Do not change payroll formulas, tax formulas, totals, or manual adjustment amount logic.
- Do not use NIK display values as PTRJ `EmpCode` values for payroll source queries.
- Do not redesign the whole identity resolver stack.

## Field Contract

Backend Daftar Upah rows expose these fields:

| Field | Meaning |
| --- | --- |
| `nik` | Old/original NIK from `history_hr_employee.nik` or existing fallback. Kept for audit. |
| `new_nik` | New NIK from `history_hr_employee.new_nik` when present. |
| `nik_display` | Effective NIK shown in Daftar Upah: `new_nik || nik || emp_code`. |
| `nik_source` | One of `new_nik`, `nik`, or `emp_code_fallback`. |
| `has_nik_change` | `true` when both `nik` and `new_nik` are present and differ after trimming. |

Normalization rules:

- Trim whitespace.
- Treat empty strings as missing.
- Preserve numeric string content exactly after trimming.
- Do not uppercase numeric NIK values in display, but normalize source keys such as `emp_code` to existing codebase conventions.

## Source Precedence

For Daftar Upah identity display:

1. Latest applicable `history_hr_employee.new_nik`
2. Latest applicable `history_hr_employee.nik`
3. Live employee source NIK already returned by the extractor, such as `HR_EMPLOYEE.NewICNo`
4. `emp_code` as the final fallback so the cell is never blank

The `history_hr_employee` query must read the latest row per `emp_code` using a deterministic rule. Prefer the current period row when period data is available; otherwise use the latest row by `id`, matching the existing latest-history pattern used for join date and SPSI enrichment.

## Data Flow

1. Data extractor fetches employees from the current Daftar Upah scope.
2. Backend enriches employee identity from `history_hr_employee`, selecting `nik` and `new_nik`.
3. A small backend helper resolves `nik_display`, `nik_source`, and `has_nik_change`.
4. Payroll row construction keeps `nik` as the old/audit value and assigns `new_nik` separately.
5. Frontend Daftar Upah renders the `nik_display` column under `IDENTITAS`.
6. Excel export uses `nik_display` or `new_nik || nik || emp_code`, never the ellipsis text.

## UI Design

Add a visible `NIK` column in the `IDENTITAS` group near `EMP CODE` and `NAMA`.

Default cell behavior:

- Show `nik_display` in monospace.
- Apply ellipsis when the value is too long for the column.
- Add a compact `Full` control inside the cell.
- Clicking `Full` expands only that employee's NIK cell to the complete value.
- Clicking again collapses it back to ellipsis.

Changed-NIK behavior:

- If `has_nik_change` is true, show a small `BARU` indicator or tooltip.
- Tooltip includes both old `nik` and `new_nik`.
- The row still sorts/searches by the effective display value first.

This keeps the table narrow for daily scanning while still making the full NIK available when needed.

## Export Behavior

Excel export must output the complete effective NIK, not the truncated UI text.

Export source:

```text
nik_display || new_nik || nik || emp_code
```

If a separate audit export is later needed, it can include both `nik` and `new_nik`, but the standard Daftar Upah export should use the effective NIK as the visible `NIK` column.

## Error Handling

- If `new_nik` is empty, display falls back to `nik`.
- If both are empty, display falls back to `emp_code`.
- If `new_nik` equals `nik` after trimming, `has_nik_change` is false.
- If the history query fails, existing extractor fallback behavior remains active and the row still renders.
- Backend should avoid emitting undefined identity fields; use empty strings or explicit nulls consistently.

## Testing

Backend focused tests:

- `new_nik` present and different from `nik` produces `nik_display = new_nik`.
- Empty `new_nik` falls back to `nik`.
- Empty `new_nik` and `nik` falls back to `emp_code`.
- Same `new_nik` and `nik` does not set `has_nik_change`.
- History enrichment query maps latest row per `emp_code` deterministically.

Frontend focused tests:

- Daftar Upah column definition includes `NIK` under `IDENTITAS`.
- Long NIK renders collapsed by default.
- Full toggle reveals and hides the complete NIK per employee.
- Export receives the complete effective NIK value, not the UI ellipsis.

## Rollout

1. Add backend helper and tests for effective NIK resolution.
2. Update Daftar Upah employee identity enrichment to select `new_nik` from `history_hr_employee`.
3. Update payroll row payload to include `nik`, `new_nik`, `nik_display`, `nik_source`, and `has_nik_change`.
4. Add the frontend `NIK` column with ellipsis/full toggle.
5. Align Excel export to the effective NIK field.
6. Run focused backend and frontend tests, then a frontend build if UI code changes are included.

## Self-Review Notes

The design uses an existing database column and does not require schema migration. It keeps old NIK immutable, isolates display logic from payroll formulas, and defines deterministic fallback behavior for missing or duplicate history rows.
