# Premi Angkut Kendaraan Subblok and AD Override Design

## Context

The payroll manual adjustment flow already supports structured premium detail metadata through `input_type` values such as `blok`, `exp`, `kendaraan`, and `blok,exp`. Several `PREMI ANGKUT` definitions in `backend/data/premium_definitions.json` use `input_type: "kendaraan"`.

Today, the vehicle detail popup stores each row as:

```json
{
  "nomor_kendaraan": "B1234AB",
  "expense_code": "DRIVER",
  "jumlah": 150000
}
```

Automation responses flatten this metadata into `premium_transactions[]`, and backend response normalization can convert vehicle `expense_code` values to `DRIVER` or `HELPER`.

## Goals

- Add an optional subblok toggle for vehicle-based transport premiums.
- When subblok mode is enabled, each vehicle detail row can include `subblok`.
- Add a column-level override for ADCode / AD_DESC values that normally come from `premium_definitions.json`.
- Keep the override scoped to the whole manual adjustment column, not per employee cell and not per transaction row.
- Preserve compatibility with the existing `input_type: "kendaraan"` flow and automation response contract.

## Non-Goals

- Do not add a mode where one vehicle code is entered once and reused across all transactions.
- Do not make ADCode / AD_DESC override per transaction.
- Do not change global `premium_definitions.json` values when a user creates a one-off override column.

## UX Design

### Vehicle Detail Popup

For `input_type: "kendaraan"`, show a toggle labeled `Pakai Subblok`.

When disabled, keep the current row fields:

- `Nomor Kendaraan`
- `Driver/Expense Code`
- `Jumlah`

When enabled, each detail row becomes:

- `Subblok`
- `Nomor Kendaraan`
- `Driver/Expense Code`
- `Jumlah`

The "Driver" wording maps to the existing `expense_code` field. Backend normalization can continue resolving it to `DRIVER` or `HELPER`.

### Add Manual Adjustment Column Modal

After selecting a definition from `premium_definitions.json`, show a toggle labeled `Override ADCode/AD_DESC`.

When disabled, the column uses the selected definition values:

- `ad_code`
- `task_code`
- `base_task_code`
- `task_desc`
- `remarks`

When enabled, show override inputs for:

- `ADCode`
- `AD_DESC` / `TaskDesc`

Saving the column writes the override values into the column payload. All cells in that manual adjustment column inherit the override because the scope is the column, not a transaction detail.

## Data Design

### Vehicle Metadata

Keep `input_type: "kendaraan"` and allow item-level `subblok`:

```json
{
  "input_type": "kendaraan",
  "items": [
    {
      "subblok": "P0915",
      "nomor_kendaraan": "B1234AB",
      "expense_code": "DRIVER",
      "jumlah": 150000
    }
  ],
  "total_amount": 150000
}
```

Rows without `subblok` remain valid unless the popup toggle is active for the edited metadata.

Backend detail flattening already copies item fields through `buildDetailItem`, so `premium_transactions[]` can include `subblok` for vehicle rows with minimal backend changes. Subblok normalization should reuse the existing `normalizeSubblokCode` behavior and preserve `subblok_raw` when symbols are removed.

### Column AD Override

The override is stored on the added-column payload and saved through existing manual adjustment fields:

```json
{
  "ad_code": "ALXXXX",
  "task_code": "ALXXXX",
  "base_task_code": "ALXXXX",
  "task_desc": "SIMPANG TIGA",
  "remarks": "PREMI ANGKUT TBS | ALXXXX - SIMPANG TIGA | 0 | sync:MISS | match:MISMATCH"
}
```

The column field name and adjustment name still come from the selected premium definition or selected column name. Only the AD mapping is overridden.

## Validation

- Vehicle detail with subblok toggle off requires `nomor_kendaraan`, `expense_code`, and positive `jumlah` for premium rows.
- Vehicle detail with subblok toggle on also requires `subblok` per populated row.
- Negative detail values remain invalid for `PREMI` and allowed-normalized for deduction types, matching current behavior.
- AD override requires a non-empty AD_DESC/TaskDesc when enabled. ADCode can be empty only if the existing flow already permits TaskDesc-only entries; otherwise it follows the current ADCode requirement.

## Testing Plan

- Frontend unit tests for `PremiumDetailPopup`:
  - toggle shows and persists `subblok` on kendaraan metadata.
  - subblok is required only when the toggle is active.
  - saved metadata stays `input_type: "kendaraan"` and includes item-level `subblok`.
- Frontend tests for `ManualAdjustmentColumnModal`:
  - override toggle is hidden/inactive until a definition is selected.
  - override values replace definition AD fields in the saved column payload.
  - override remains column-level and does not appear in per-row detail metadata.
- Frontend utility tests for vehicle metadata validation.
- Backend tests for manual adjustment response normalization:
  - kendaraan item with `subblok` produces `detail_items[]` and `premium_transactions[]` containing normalized `subblok`.
  - raw subblok with separators keeps `subblok_raw`.
- Run focused tests first:
  - `npx vitest run src/components/PremiumDetailPopup.test.jsx src/components/ManualAdjustmentColumnModal.test.jsx src/utils/payrollPremiumDetailEdits.test.js`
  - `bun test src/services/manualAdjustmentService.test.ts`

