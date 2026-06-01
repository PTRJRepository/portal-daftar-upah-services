## Summary
Added conservative backend performance boundaries for payroll SSE: slow stream log, cancel log, and max runtime error event.

## Files Modified
- `backend/src/api/payroll.ts`

## Key Decisions
No extractor refactor; boundary is applied around existing progressive stream loop to reduce risk.

## Tests
- `bun test src/api/payroll.proxy.test.ts` passed.