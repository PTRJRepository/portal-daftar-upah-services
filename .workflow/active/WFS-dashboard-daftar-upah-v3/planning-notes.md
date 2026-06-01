# Planning Notes - Dashboard Daftar Upah V3

## User Goal

Redesign dashboard daftar upah agar terasa modern enterprise, lebih rapi, lebih cepat discan, analytics-driven, dan role-aware. Scope replan juga mencakup tabel daftar upah: hilangkan efek visual yang berubah ketika scroll, terutama perubahan font/warna/tinggi yang bikin pusing, dan fix bug tabel naik turun.

## Current Code Context

- Home route sudah memakai `ProfessionalDashboard` dari `frontend/src/App.jsx`.
- `ProfessionalDashboard.jsx` sudah punya dasar V3: token warna, module groups, KPI blueprint, role guessing, filter bar, analytics preview, dan bento sections.
- `DashboardLayout.jsx` sudah punya sidebar grouping dan perlu disejajarkan dengan registry dashboard.
- `CustomPayrollTable.jsx` adalah pusat tabel daftar upah. File ini mengatur responsive scale, row height, sticky headers, scroll chapter bar, active group, dan scroll sync.
- `CustomPayrollTable.css` mengatur sticky header/column, active group, focus lens, row highlight, gang sticky row, animasi streaming, dan responsive scale melalui CSS variables.
- Worktree sedang dirty pada file target seperti `frontend/src/App.jsx`, `frontend/src/layouts/DashboardLayout.jsx`, `frontend/src/pages/ProfessionalDashboard.jsx`, `frontend/src/components/CustomPayrollTable.jsx`, dan `frontend/src/pages/MainPage.jsx`. Eksekusi wajib merge-aware.

## Evidence-Based Findings

1. Dashboard sudah memakai pola config-driven melalui `MODULE_GROUPS`, `KPI_BLUEPRINT`, `guessRole`, dan `getVisibleGroups`.
2. Sidebar sudah punya section config di `DashboardLayout.jsx`; bisa disinkronkan dengan dashboard tanpa ubah route besar.
3. Tabel memakai `tableContainerWidth` untuk menghitung `effectiveScale`, lalu mengubah `--payroll-font-size-base`, `--payroll-header-font-size`, padding, dan `--payroll-row-height`.
4. `ResizeObserver` di `CustomPayrollTable.jsx` mengamati container dan table. Saat table width/scrollbar berubah, observer bisa memicu perubahan width -> scale -> rowHeight -> sticky top -> layout jump.
5. Scroll handler mengubah active chapter/gang marker. CSS `data-active-group` dan `data-focus-dim` mengubah font weight, warna, shadow, dan highlight. Ini cocok dengan keluhan font/warna berubah ketika scroll.
6. `.gang-header-row td` sticky dengan top berbasis `4 * --payroll-row-height`; bila rowHeight berubah, gang header tampak naik turun.
7. CSS punya animasi row/gang streaming dengan transform/opacity. Perlu dibatasi agar tidak muncul saat user scroll biasa.

## Design Requirements

- Header area: logo, role, notification, profile, global search, breadcrumb.
- Sticky filter bar: periode, divisi, gang/kemandoran, estate, generate.
- KPI cards: total upah, total HK, jumlah karyawan, cost/HK.
- Analytics: payroll trend, cost/HK, top divisi, productivity vs cost, quick insight.
- Bento modules: Operational, Analysis, Finance, Verification.
- Role rules: Payroll Admin, Estate Manager, Finance, Director/Executive.
- Sidebar: collapsed default, role-aware, grouped.
- Responsive: desktop 12 columns, tablet 8, mobile stacked, chart/table horizontal scroll.
- Table stability: scroll must not change typography, colors, row height, sticky offsets, or table vertical position.

## Recommended Architecture Direction

- Keep current route paths stable.
- Extract dashboard module/role registry only if it reduces duplication between dashboard and sidebar.
- Treat table stability as separate task lane from dashboard redesign.
- Make table typography and row height stable from explicit user/layout mode, not from scroll/ResizeObserver feedback.
- Make scroll state update only navigation indicators, not cell font/color/height.
- Prefer CSS simplification over more JS for visual stability.

## Conflict Notes

- Conflict risk: high because target frontend files already have uncommitted changes.
- Execution should begin with a diff audit and explicit ownership of source files.
- Source edits are not part of this workflow-plan turn.
