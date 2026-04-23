# Payroll Manual Adjustment Dynamic Columns Design

Date: 2026-04-23
Status: Draft approved in chat, documented for implementation planning
Scope: `daftar upah` edit mode, manual adjustment storage, dynamic payroll headers, payroll calculations

## Goal

Enable edit mode in `daftar upah` to:

- add new dynamic columns under `PREMI`
- add new dynamic columns under `POTONGAN UPAH KOTOR`
- add new dynamic columns under `POTONGAN UPAH BERSIH`
- persist those columns and values through `manual adjustment`
- make newly added columns appear immediately in the currently opened gang/division scope even when values are still empty
- make saved changes refresh back into `daftar upah` without manual remapping

The main business driver is stable mapping between:

- user-created UI columns
- backend extractor field names
- payroll calculations
- persisted manual adjustment records

## Confirmed Business Rules

### Naming Rule

`adjustment_name` must be stored in full with its category prefix. This is required so backend mapping and UI rendering can rely on the same canonical name.

Examples:

- `PREMI INSENTIF`
- `PREMI TARGET`
- `KOREKSI DENDA PANEN`
- `KOREKSI SELISIH HK`
- `POTONGAN LAINNYA KASBON`
- `POTONGAN LAINNYA BPJS TAMBAHAN`

The prefix is not presentation-only. It is part of the stored value.

### Scope Rule

A newly added column belongs to the current opened payroll scope:

- `period_month`
- `period_year`
- `division_code`
- `gang_code`

If the user opens division `AB1`, gang `A1`, month `4`, year `2026`, the manual column is applied to that scope only.

It must not automatically appear in:

- other gangs inside the same division
- other divisions
- other periods

### Empty Column Rule

When a user adds a column, the column must appear immediately for the currently opened gang/division even when all employee values are still empty.

This requires persistence of a header placeholder record, not only value records.

### Calculation Rule

Manual dynamic columns affect payroll totals by category:

- `PREMI ...` adds into `total_premi`
- `KOREKSI ...` adds into `pot_koreksi`
- `KOREKSI ...` reduces `jumlah_upah_kotor`
- `POTONGAN LAINNYA ...` adds into `other_potongan`
- `POTONGAN LAINNYA ...` reduces `upah_bersih`

## Current System Constraints

The current codebase already has:

- frontend edit state for `editedCells`
- frontend support for `addedColumns`
- backend persistence through `manualAdjustmentService.saveAdjustment`
- extractor injection of manual adjustments into payroll rows
- dynamic header transport through `dynamic_premi_headers`, `dynamic_potongan_headers`, `premi_title_map`, and `potongan_title_map`

Current gaps:

- add-column UI exists only for potongan areas, not `PREMI`
- stored names are not yet normalized around full prefixed naming
- extractor logic can produce duplicate prefixes such as `PREMI_PREMI_*` or `KOREKSI_KOREKSI_*`
- field key generation is not yet standardized across all manual categories
- empty-column persistence depends on placeholder behavior that needs to be formalized by scope

## Recommended Design

Use the existing `dbo.payroll_manual_adjustments` table for both:

- manual numeric values
- dynamic column placeholders

Do not introduce a new header table in this iteration.

### Why

- It minimizes schema changes.
- It preserves current save endpoints.
- It matches the user requirement to move this behavior into `manual adjustment`.
- It allows dynamic headers to be rebuilt from one source of truth.

## Data Model Contract

### Manual Adjustment Record

For standard payroll manual adjustments, the canonical key is:

- `period_month`
- `period_year`
- `division_code`
- `gang_code`
- `emp_code`
- `adjustment_type`
- `adjustment_name`

For header-only placeholders, use the first employee in the active scope as anchor data, but treat the column as scope-owned because the extractor will read it from the full scope result set.

### Placeholder Record Contract

When a user adds a column but has not entered any numeric value yet, create a record with:

- `amount = 0`
- `remarks` containing `INIT_COLUMN`
- full `adjustment_name`
- current `period/division/gang` scope

This placeholder must not be deleted by zero-value logic while the `INIT_COLUMN` marker is present.

Example:

- `adjustment_type = PREMI`
- `adjustment_name = PREMI INSENTIF`
- `amount = 0`
- `remarks = INIT_COLUMN - Kolom ditambahkan tanpa nilai`

## Field Mapping Rules

Backend row fields and header maps must be normalized from the canonical stored name.

### Mapping Function

1. Uppercase and trim the stored `adjustment_name`.
2. Detect category from the actual stored prefix, not only from `adjustment_type`.
3. Remove only the canonical leading category phrase.
4. Convert the remainder into snake_case.
5. Re-attach the correct frontend/backend field prefix.

### Expected Mappings

Stored name `PREMI INSENTIF`

- row field: `premi_insentif`
- title map label: `PREMI INSENTIF`
- contributes to: `total_premi`

Stored name `KOREKSI DENDA PANEN`

- row field: `koreksi_denda_panen`
- title map label: `KOREKSI DENDA PANEN`
- contributes to: `pot_koreksi`

Stored name `POTONGAN LAINNYA KASBON`

- row field: `potongan_lainnya_kasbon`
- title map label: `POTONGAN LAINNYA KASBON`
- contributes to: `other_potongan`

### Invalid Outcome to Prevent

These outputs are explicitly wrong and must not be generated:

- `PREMI_PREMI_INSENTIF`
- `KOREKSI_KOREKSI_DENDA_PANEN`
- `POTONGAN_POTONGAN_LAINNYA_KASBON`

## Frontend Design

### Add Column Entry Points

Edit mode must expose add-column buttons in three groups:

- `PREMI`
- `POTONGAN UPAH KOTOR`
- `POTONGAN UPAH BERSIH`

### User Input Rule

The user enters only the core name.

Examples:

- `Insentif`
- `Denda Panen`
- `Kasbon`

Frontend builds the stored canonical name:

- `PREMI Insentif`
- `KOREKSI Denda Panen`
- `POTONGAN LAINNYA Kasbon`

Before save, normalize to uppercase storage form:

- `PREMI INSENTIF`
- `KOREKSI DENDA PANEN`
- `POTONGAN LAINNYA KASBON`

### Save Flow

When the user clicks add column:

1. create the column in local UI state immediately
2. add it to the active dynamic field list
3. queue a placeholder manual adjustment record in `addedColumns`
4. persist it through the existing manual-edit endpoint during save
5. refresh the payroll table
6. rebuild columns from backend dynamic headers and title maps

### Display Rule

The table header should display the full business label, not a shortened or stripped version that hides the category meaning.

Recommended display:

- `PREMI INSENTIF`
- `KOR. DENDA PANEN` for compact potongan kotor header rendering is acceptable in the cell header as long as the stored and mapped canonical label remains `KOREKSI DENDA PANEN`
- `POT. LAINNYA KASBON` for compact rendering is acceptable if the canonical title map stays complete

Compact rendering is a UI concern only. Canonical label storage and mapping stay unchanged.

## Backend Design

### manualAdjustmentService

Keep `saveAdjustment` as the persistence entry point for:

- value rows
- placeholder rows

Required refinement:

- exact-match lookup must continue using `adjustment_type + adjustment_name`
- zero-value deletion must keep placeholder rows when `remarks` includes `INIT_COLUMN`
- scope data `division_code` and `gang_code` must be preserved on insert/update

### dataExtractorService

Refine manual adjustment injection to use canonical normalization helpers.

For `PREMI`:

- normalize `PREMI INSENTIF` to `premi_insentif`
- add the field to row data
- add the field to `dynamicPremiSet`
- add the canonical title to `premiTitleMap`
- include the amount in `total_premi`

For `POTONGAN_KOTOR`:

- normalize `KOREKSI DENDA PANEN` to `koreksi_denda_panen`
- add the field to row data and `koreksiVariations`
- add the field to `dynamicPotonganSet`
- add the canonical title to `potonganTitleMap`
- include the amount in `pot_koreksi`

For `POTONGAN_BERSIH`:

- normalize `POTONGAN LAINNYA KASBON` to `potongan_lainnya_kasbon`
- add the field to row data
- add the field to `dynamicPotonganSet`
- add the canonical title to `potonganTitleMap`
- include the amount in `other_potongan`

### Calculation Pipeline

No new formula model is needed. The implementation must feed normalized manual fields into the existing payroll calculator inputs:

- `total_premi`
- `pot_koreksi`
- `other_potongan`

This preserves the existing final formulas:

- `jumlah_upah_kotor = upah_kotor - pot_koreksi + pendapatan_lainnya`
- `upah_bersih = jumlah_upah_kotor - total_potongan + premi_pph`

## Scope and Refresh Behavior

After successful save:

- clear cache for the active period as already implemented
- refresh the currently opened payroll scope
- receive the new dynamic headers from the backend response
- rebuild frontend columns from backend data, not from stale local state

This ensures the source of truth remains the backend extractor result.

## Error Handling

### Duplicate Name in Same Scope

If a user adds a column whose canonical stored name already exists for the same category and scope:

- do not create a duplicate header
- treat it as the same column
- keep editing values in that existing column

### Invalid Input

Reject blank or punctuation-only names after sanitization.

If sanitization removes all useful content, the column must not be created.

### Unknown Prefix Mismatch

If stored `adjustment_name` does not match the expected canonical prefix for its `adjustment_type`, the extractor should prefer safe normalization and log a warning instead of silently generating malformed fields.

## Testing Strategy

Implementation must add or update tests for the following:

1. Frontend add-column naming
   Verify `Insentif` under `PREMI` is stored as `PREMI INSENTIF`.

2. Placeholder persistence
   Verify adding a column with no value creates a zero-value `INIT_COLUMN` record that is not deleted by save logic.

3. Extractor normalization
   Verify full prefixed names become:
   - `premi_insentif`
   - `koreksi_denda_panen`
   - `potongan_lainnya_kasbon`

4. No duplicate prefix generation
   Verify extractor never emits:
   - `PREMI_PREMI_*`
   - `KOREKSI_KOREKSI_*`
   - `POTONGAN_POTONGAN_*`

5. Scope isolation
   Verify a column added in one gang does not appear in a different gang for the same period unless separately created there.

6. Payroll totals
   Verify:
   - `PREMI ...` increases `total_premi`
   - `KOREKSI ...` increases `pot_koreksi` and reduces `jumlah_upah_kotor`
   - `POTONGAN LAINNYA ...` increases `other_potongan` and reduces `upah_bersih`

## Implementation Boundaries

Included:

- frontend add-column UI for all three groups
- canonical prefixed storage naming
- placeholder persistence through manual adjustment
- backend extractor normalization
- immediate refresh in `daftar upah`
- tests for naming, normalization, scope, and calculation effects

Not included:

- new database table for header metadata
- cross-gang bulk propagation of manual columns
- cross-period header templates
- redesign of historical snapshot schema

## Open Questions Resolved During Brainstorming

- Should the prefix be stored in database: yes
- Should new columns appear even before values are entered: yes
- Should the column apply only to the currently opened scope: yes

## Implementation Recommendation

Proceed with the existing `manual adjustment` table as the single persistence mechanism, add canonical normalization helpers for prefixed names, and make backend dynamic headers the source of truth for rebuilt UI columns after every save.
