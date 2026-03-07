# Add THR Mode to Summary Report

This plan outlines the steps to add a "THR Mode" to the existing Summary Report page, fetching data from the saved THR records and grouping them by *gang*.

## Proposed Changes

### Backend

#### [MODIFY] backend/src/services/otherIncomesService.ts
- Add a new static method `getThrSummary(year: number, month: number, divisionCode?: string)` that:
  - Queries `employee_other_incomes` for `income_type = 'THR'` matching the `year` and `month`.
  - Filters by `division_code` resolving virtual divisions as done in `getRawIncomes`.
  - Groups the result by `gang_code`.
  - Calculates `COUNT(DISTINCT nik) as total_employees` and `SUM(amount) as total_amount`.
  - Returns `data` (array of gang summaries) and `grand_total`.

#### [MODIFY] backend/src/api/otherIncomesRoutes.ts
- Add a new GET route `/summary` to expose the new `getThrSummary` method.

### Frontend

#### [MODIFY] frontend/src/services/otherIncomesService.js
- Add `getThrSummary: async (year, month, divisionCode) => { ... }` that fetches from `/other-incomes/summary`.

#### [MODIFY] frontend/src/pages/SummaryReportPage.jsx
- Add a UI toggle (e.g., buttons or a dropdown) to switch between **"Payroll Mode"** and **"THR Mode"**.
- Update the `fetchData` function:
  - If "Payroll Mode", it calls the existing `fetchDivisionSummary`.
  - If "THR Mode", it calls `otherIncomesService.getThrSummary`.
- Conditionally render the table headers and logic based on the mode:
  - In THR mode, hide columns that do not apply: HK, Premi columns, Lembur, PPH21, SPSI.
  - Show only: ESTATE/GANG, WORKERS, TOTAL THR.
- Adapt the CSV Export and PDF Print logic to reflect the active mode.

## Verification Plan

### Automated Tests
- Run `bun run build` in both frontend and backend directories to ensure no compilation errors.
- Ensure backend starts successfully (`bun start` in backend).

### Manual Verification
1. Open the **Summary Report** page in the browser.
2. Toggle to **THR Mode**.
3. Select a period and division that has generated THR data.
4. Verify that the table correctly displays the grouped data by *gang* with the correct number of workers and total THR amount per gang.
5. Verify that the Grand Total is accurate.
6. Test the **Cetak Report** (Print) and **Download CSV** buttons in THR Mode to ensure the report format is adjusted and downloads correctly without the hidden columns (like HK, Lembur).
