# PTKP Master Tax Portal Editing Feature

This feature will allow administrators to edit the PTKP Master Tax directly from the portal when edit mode is activated.

## User Review Required

The PTKP data is managed on a yearly basis in the `history_ptkp_pajak` table (extend_db_ptrj) via `ptkpTaxService`. When an admin updates an employee's PTKP from the portal, the update will immediately affect the given year in this table as well as `history_hr_employee`. I am confident that this is the best design choice because:
1. It separates master tax changes from standard payroll value changes.
2. It persists the change for the rest of the year.

## Proposed Changes

### Backend

#### [MODIFY] backend/src/services/ptkpTaxService.ts
- Add a new method `updatePtkpStatus(year: number, empCode: string, ptkpStatus: string, updatedBy: string = 'system')`.
- This method will update `ptkp_status` and `kategori_ter` in `history_ptkp_pajak`.
- This method will also sync the new status to `ptkp_pajak` in `history_hr_employee` for that year.

#### [MODIFY] backend/src/api/taxReportRoutes.ts
- Add a new restricted endpoint: `PUT /tax-report/ptkp` or `PUT /tax-report/ptkp/:emp_code`.
- Accept `{ year, ptkp_status }` in the body.
- Call `ptkpTaxService.updatePtkpStatus()`.
  
### Frontend

#### [MODIFY] frontend/src/components/CustomPayrollTable.jsx
- Update the `status_ptkp` column definition to render an editable `<select>` input containing valid PTKP options (`TK/0`, `TK/1`, `TK/2`, `TK/3`, `K/0`, `K/1`, `K/2`, `K/3`) when `isEditMode` is active and `row.type === 'employee'`.
- Use the existing `handleCellEdit` to capture the change, tagging it with a specific type (e.g., `'MASTER_TAX'`).
- Update `handleSaveEdits` to segregate `'MASTER_TAX'` edits and send them to the new backend API endpoint.
- Since it manages `emp_code`, I need to make sure `emp_code` is properly accessed. The `CustomPayrollTable` row object has `emp_code`, `nik`, etc.

## Verification Plan

### Automated Tests
- Running the standard unit test routines over `CustomPayrollTable`.

### Manual Verification
1. Login with an admin account (Kerani or higher permissions).
2. Go to Payroll / Laporan Pajak.
3. Toggle "Edit Mode".
4. Modify the "PTKP" value for a specific employee.
5. Click "Simpan Edit" (Save Edits).
6. Verify the successful toast notification, and observe that the PTKP and automatically the "TARIF TER (%)" values have changed according to the new tax classification.
7. Switch between periods in the same year to verify the master tax configuration persists properly.
