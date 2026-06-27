# IMPL-9 - Focused tests for dashboard and table stability

## Summary
Added guards for role visibility, collapsed sidebar, dashboard header, table ResizeObserver, active-group styling, and animation calm-down.

## Files Modified
- `frontend/src/pages/ProfessionalDashboard.test.jsx`
- `frontend/src/layouts/DashboardLayout.test.jsx`
- `frontend/src/components/CustomPayrollTable.visual-stability.test.js`

## Key Decisions
- Preserved existing routes and unrelated dirty worktree changes.
- Kept implementation scoped to dashboard/table stability requirements.

## Tests
- Focused Vitest dashboard/table stability tests passed.
- Production frontend build passed.

