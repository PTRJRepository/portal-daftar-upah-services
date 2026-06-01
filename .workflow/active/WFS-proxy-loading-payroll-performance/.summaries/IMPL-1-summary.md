## Summary
Added canonical API base tests and isolated env behavior for proxy/local URL resolution.

## Files Modified
- `frontend/src/utils/apiBase.js`
- `frontend/src/utils/apiBase.test.js`
- `frontend/src/utils/httpSetup.js`

## Key Decisions
Explicit backend env values still win; proxy mode uses `/backend/upah`.

## Tests
- `npx vitest run src/utils/apiBase.test.js src/utils/payrollClientRuntime.test.js` passed.