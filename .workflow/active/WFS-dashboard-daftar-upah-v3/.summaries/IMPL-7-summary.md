# IMPL-7 - Table layout stability

## Summary
ResizeObserver feedback loop reduced by observing container only; table shell now uses parent height and stable min-height.

## Files Modified
- `frontend/src/components/CustomPayrollTable.jsx`
- `frontend/src/styles/CustomPayrollTable.css`

## Key Decisions
- Preserved existing routes and unrelated dirty worktree changes.
- Kept implementation scoped to dashboard/table stability requirements.

## Tests
- Focused Vitest dashboard/table stability tests passed.
- Production frontend build passed.

