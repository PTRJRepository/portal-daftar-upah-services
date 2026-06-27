# IMPL-6 - Table visual calm-down

## Summary
Scroll-driven active group/focus styles no longer change body cell font weight, text color, or frozen column typography.

## Files Modified
- `frontend/src/styles/CustomPayrollTable.css`

## Key Decisions
- Preserved existing routes and unrelated dirty worktree changes.
- Kept implementation scoped to dashboard/table stability requirements.

## Tests
- Focused Vitest dashboard/table stability tests passed.
- Production frontend build passed.

