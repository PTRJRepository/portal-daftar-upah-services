# IMPL-8 - Table scroll controls and animations cleanup

## Summary
Row/gang entrance animations disabled for normal table rendering; reduced-motion guard added.

## Files Modified
- `frontend/src/styles/CustomPayrollTable.css`

## Key Decisions
- Preserved existing routes and unrelated dirty worktree changes.
- Kept implementation scoped to dashboard/table stability requirements.

## Tests
- Focused Vitest dashboard/table stability tests passed.
- Production frontend build passed.

