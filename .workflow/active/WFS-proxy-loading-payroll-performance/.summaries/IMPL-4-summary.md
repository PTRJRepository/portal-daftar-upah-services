## Summary
Added backend proxy contract coverage and restored locked token verification route used by frontend auth.

## Files Modified
- `backend/src/index.ts`
- `backend/src/api/payroll.ts`
- `backend/src/api/payroll.proxy.test.ts`

## Key Decisions
`/backend/upah` mirrors core API routes. `/payroll/locked/verify` returns a compact validity payload from existing auth middleware.

## Tests
- `bun test src/api/payroll.proxy.test.ts` passed.