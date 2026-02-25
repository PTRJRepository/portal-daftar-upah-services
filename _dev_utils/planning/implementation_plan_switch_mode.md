# Database Switch Mode Implementation Plan

This plan details the steps to introduce a "Switch Mode" in the Daftar Upah (Payroll Report) page, allowing users to explicitly choose to fetch data from the Original (Live) Database or the History Database.

## Proposed Changes

### Backend

#### [MODIFY] backend/src/services/dataExtractorService.ts
- Modify `extractPayrollData` and `extractPayrollDataWithComponents` to accept an optional `useHistoryDb?: boolean | null` parameter.
- Update the deep history interceptor logic:
  - If `useHistoryDb === true`, strictly attempt fetching from history. (If missing, it can fallback to live or return empty).
  - If `useHistoryDb === false`, strictly BYPASS the history interceptor and fetch live data from the original database.
  - If `useHistoryDb === undefined` or `null`, use the legacy rule (`isHistorical && historyDatabaseService.isHistoryMode()`).

#### [MODIFY] backend/src/api/payroll.ts
- Update the following endpoints to accept an optional `use_history` query string:
  - `GET /report/division-raw-tree`
  - `GET /locked/report/raw-tree`
  - `GET /report`
  - `GET /report-with-components`
- Pass `use_history === 'true'` (as true) or `use_history === 'false'` (as false) down to `dataExtractorService`. Pass `null` if the param is not provided.

### Frontend

#### [MODIFY] frontend/src/services/payrollService.js
- Update `fetchReportRowsSimple`, `fetchReportDivisionOptimized`, `fetchReportRows`, and `fetchReportRowsBatched` to accept `use_history` in their arguments/config and pass it to the API requests as `params.use_history`.

#### [MODIFY] frontend/src/pages/Report.jsx
- Add a state hook `const [useHistory, setUseHistory] = useState(false)` (or let it be null by default, and a toggle will switch it between true and false/null).
- UI Update: Add a Switch / Checkbox inside the `ReportToolbar` or right next to the month/year/gang filters labeled "Mode History (Gunakan Database History)".
- Inject `use_history: useHistory` into the parameters passed to `fetchReportDivisionOptimized` and `fetchReportRowsSimple`.
- Trigger a re-fetch of the report data when the switch is toggled.

## Verification Plan
1. Start both the backend (`bun start`) and the frontend (`npm run dev`).
2. Navigate to the Daftar Upah (Report) page in the browser.
3. Test loading a historical month (e.g., January 2026). Check if it loads correctly.
4. Toggle "Mode History" off. It should trigger a re-calculation from the original database and display the Live data.
5. Toggle "Mode History" on. It should return the seeded snapshot data instantly from `extend_db_ptrj`.
6. Inspect network requests to confirm the `/payroll/report/real` or `/payroll/report/division-optimized` endpoints are being called with `?use_history=true` or `?use_history=false`.
