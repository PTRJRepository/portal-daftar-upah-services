# IMPL PLAN - Dashboard Daftar Upah V3 + Table Stability

## 1. Requirements Summary

Build a modern enterprise dashboard for daftar upah with clean hierarchy, KPI cards, analytics widgets, grouped bento modules, role-aware visibility, and sidebar alignment. Also fix the daftar upah table visual behavior: scrolling must not change font, color, height, or make the table jump up/down.

## 2. Architecture Decisions

- Preserve existing routes in `App.jsx`; redesign should not break current report links.
- Keep `ProfessionalDashboard.jsx` as entry point, but move repeated dashboard data/config into small helpers only when needed.
- Reuse `ReportContext` for period/division/gang filters instead of creating parallel filter state.
- Keep table stabilization isolated in `CustomPayrollTable.jsx`, `CustomPayrollTable.css`, and `payrollResponsiveScale.js`.
- Make scroll state informational only. Active chapter/gang state can update a compact navigator, but must not restyle table cells in ways that change perceived font/color/height while scrolling.

## 3. Task Breakdown

### IMPL-1 - Baseline audit and merge guard

Goal: Inspect dirty worktree and establish safe source-file ownership before implementation.

Files: `frontend/src/App.jsx`, `frontend/src/pages/ProfessionalDashboard.jsx`, `frontend/src/layouts/DashboardLayout.jsx`, `frontend/src/components/CustomPayrollTable.jsx`, `frontend/src/styles/CustomPayrollTable.css`, `frontend/src/pages/MainPage.jsx`.

Acceptance:
- Current user/agent edits are identified.
- No unrelated change is overwritten.
- Implementation order is confirmed around overlapping files.

Dependencies: none.

### IMPL-2 - Dashboard shell polish and IA completion

Goal: Finish the V3 dashboard structure: header, sticky filter, KPI row, role modules, analytics, reports, and activity/status.

Files: `frontend/src/pages/ProfessionalDashboard.jsx`, optional `frontend/src/components/dashboard/*`.

Acceptance:
- Dashboard follows HEADER -> FILTER BAR -> KPI -> ROLE MODULES -> ANALYTICS -> REPORTS -> ACTIVITY/STATUS.
- Cards use clean spacing, strong hierarchy, restrained border, and no cluttered menu dump.
- Filter bar remains sticky and collapses cleanly on mobile.

Dependencies: `IMPL-1`.

### IMPL-3 - Role-aware dashboard registry and sidebar alignment

Goal: Make module visibility consistent for Payroll Admin, Estate Manager, Finance, and Executive.

Files: `frontend/src/pages/ProfessionalDashboard.jsx`, `frontend/src/layouts/DashboardLayout.jsx`, related tests.

Acceptance:
- Payroll Admin sees operational and verification modules.
- Estate Manager sees KPI, productivity, comparison, and impact modules but not seeder/correction.
- Finance sees financial modules and cost analytics.
- Executive sees KPI/trends/summary/risk without detailed operational menu.
- Sidebar hides unavailable modules and matches dashboard groups.

Dependencies: `IMPL-2`.

### IMPL-4 - KPI and analytics data wiring

Goal: Wire dashboard KPI and analytics cards to existing summary data with graceful fallbacks.

Files: `frontend/src/pages/ProfessionalDashboard.jsx`, `frontend/src/components/dashboard/*`, relevant service/util files if existing API adapters are reused.

Acceptance:
- Total Upah, Total HK, Jumlah Karyawan, and Cost/HK show stable values or clear empty states.
- Analytics cards render trend/cost/top division/productivity insight surfaces without layout breaks.
- Missing API data does not collapse card height or throw errors.

Dependencies: `IMPL-2`.

### IMPL-5 - Dashboard responsive and visual QA pass

Goal: Make desktop/tablet/mobile layouts match PRD without overlap or excessive scrolling.

Files: `frontend/src/pages/ProfessionalDashboard.jsx`, dashboard components/styles, related layout tests.

Acceptance:
- Desktop behaves like 12-column dashboard.
- Tablet uses tighter grid.
- Mobile stacks sections and keeps filters usable.
- Text fits inside cards/buttons.

Dependencies: `IMPL-2`, `IMPL-3`, `IMPL-4`.

### IMPL-6 - Table visual calm-down: remove scroll-triggered font/color shifts

Goal: Make table appearance stable while scrolling.

Files: `frontend/src/styles/CustomPayrollTable.css`, `frontend/src/components/CustomPayrollTable.jsx`.

Acceptance:
- Horizontal/vertical scroll does not change body cell font weight, font size, text color, or sticky column theme.
- `data-active-group` and `data-focus-dim` styles no longer create strong color/weight changes during scroll.
- Row highlight remains intentional and click-driven, not scroll-driven.
- Frozen columns stay readable without flashing between light/dark modes.

Dependencies: `IMPL-1`.

### IMPL-7 - Table layout stability: stop height and sticky offset feedback loop

Goal: Fix table jumping up/down by stabilizing row height, header top offsets, and observer behavior.

Files: `frontend/src/components/CustomPayrollTable.jsx`, `frontend/src/utils/payrollResponsiveScale.js`, `frontend/src/styles/CustomPayrollTable.css`.

Acceptance:
- `ResizeObserver` does not observe the table element in a way that feeds its own width/height changes back into scale.
- `rowHeight` does not change during scroll.
- Sticky header top and gang header top use stable metrics.
- `payroll-table-shell` height works with parent layout without viewport recalculation jitter.

Dependencies: `IMPL-6`.

### IMPL-8 - Table scroll controls and animations cleanup

Goal: Keep chapter bar/scroll dock useful without causing motion sickness or perceived layout changes.

Files: `frontend/src/components/PayrollScrollChapterBar.jsx`, `frontend/src/components/CustomPayrollTable.jsx`, `frontend/src/styles/CustomPayrollTable.css`.

Acceptance:
- Scroll chapter indicator can update, but table cell styling stays stable.
- Streaming row/gang animations are disabled or scoped so normal scroll does not animate rows.
- Reduced-motion preference is respected.

Dependencies: `IMPL-7`.

### IMPL-9 - Focused tests for dashboard and table stability

Goal: Add coverage around role visibility, dashboard shell requirements, and table stability rules.

Files: `frontend/src/pages/ProfessionalDashboard.test.jsx`, `frontend/src/layouts/DashboardLayout.test.jsx`, `frontend/src/components/CustomPayrollTable.*.test.jsx`, `frontend/src/utils/payrollResponsiveScale.test.js`.

Acceptance:
- Tests assert role-specific module visibility.
- Tests assert core module routes remain available.
- Tests cover stable responsive scale/row height behavior where practical.
- Tests prevent reintroducing scroll-driven active-group table restyling.

Dependencies: `IMPL-3`, `IMPL-6`, `IMPL-7`.

### IMPL-10 - Build and browser verification

Goal: Verify implementation after execution.

Files: no production ownership; validation only.

Acceptance:
- Focused frontend tests pass.
- `npm run build` passes in `frontend`.
- Browser check confirms dashboard visual hierarchy and table scroll stability on desktop/mobile.

Dependencies: `IMPL-5`, `IMPL-8`, `IMPL-9`.

## 4. Suggested Execution Order

1. `IMPL-1`
2. `IMPL-2`
3. `IMPL-3`
4. `IMPL-4`
5. `IMPL-5`
6. `IMPL-6`
7. `IMPL-7`
8. `IMPL-8`
9. `IMPL-9`
10. `IMPL-10`

Parallel option after `IMPL-1`: dashboard lane (`IMPL-2` to `IMPL-5`) and table lane (`IMPL-6` to `IMPL-8`) can run separately if source-file ownership is explicit.

## 5. Risk Assessment

- High conflict risk: target frontend files already modified.
- Medium behavior risk: table scroll logic is shared with focus mode, chapter navigation, sticky headers, and edit mode.
- Medium design risk: dashboard already partially redesigned; implementation should polish rather than rewrite blindly.
- Low backend risk: current PRD scope is frontend-heavy, unless dashboard API data gaps are discovered.

## 6. Validation Plan

- Run focused tests first: `npx vitest run src/pages/ProfessionalDashboard.test.jsx src/layouts/DashboardLayout.test.jsx` from `frontend`.
- Run focused table tests: `npx vitest run src/components/CustomPayrollTable.render.test.jsx src/components/CustomPayrollTable.focus-navigation.test.jsx src/utils/payrollResponsiveScale.test.js` from `frontend`.
- Run `npm run build` from `frontend`.
- Browser verify `/` and `/operational`: scroll table vertically/horizontally and confirm no font/color/height shifting or table jump.

## 7. Quality Gate

Proceed with caution. Implementation should not start until dirty worktree ownership is checked. Table stability fixes must be measured visually, because the bug is mostly rendered behavior.
