# IMPL-3 - Role-aware dashboard registry and sidebar alignment

## Summary
Role rules tightened for Payroll Admin, Estate Manager, Finance, and Executive. Sidebar now defaults collapsed and filters items by role.

## Files Modified
- `frontend/src/pages/ProfessionalDashboard.jsx`
- `frontend/src/layouts/DashboardLayout.jsx`

## Key Decisions
- Preserved existing routes and unrelated dirty worktree changes.
- Kept implementation scoped to dashboard/table stability requirements.

## Tests
- Focused Vitest dashboard/table stability tests passed.
- Production frontend build passed.

