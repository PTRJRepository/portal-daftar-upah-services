## Summary
Normalized payroll raw-tree stream and fallback fetch URLs through `buildBackendUrl`.

## Files Modified
- `frontend/src/hooks/usePayrollStream.js`
- `frontend/src/components/CustomPayrollTable.jsx`
- `frontend/src/App.jsx`
- `frontend/src/pages/Report.jsx`

## Key Decisions
Axios services keep relative paths through `axios.defaults.baseURL`; direct fetch calls use the canonical URL builder.

## Tests
- `npx vitest run src/utils/apiBase.test.js src/utils/payrollClientRuntime.test.js` passed.
- `npm run build` passed.