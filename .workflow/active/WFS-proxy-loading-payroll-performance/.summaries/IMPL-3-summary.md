## Summary
Added bounded stream watchdog, one-shot fallback, retry reload path, and proxy-safe auth redirect behavior.

## Files Modified
- `frontend/src/hooks/usePayrollStream.js`
- `frontend/src/components/CustomPayrollTable.jsx`
- `frontend/src/context/AuthContext.jsx`
- `frontend/src/utils/httpSetup.js`

## Key Decisions
Failed/stalled SSE no longer leaves payroll loading forever; fallback fetch is allowed once per request key.

## Tests
- `npx vitest run src/utils/apiBase.test.js src/utils/payrollClientRuntime.test.js` passed.
- `npm run build` passed.