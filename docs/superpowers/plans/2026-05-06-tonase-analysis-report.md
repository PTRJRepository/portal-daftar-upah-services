# Tonase Analysis Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new sidebar report page for estate-wide harvest tonase analysis with 5-month trend, upah bersih/HK, premi/HK, per-ton metrics, premium breakdown, and print-optimized output.

**Architecture:** Add one backend dashboard endpoint that returns a ready-to-render report payload from latest aggregation history rows. Add one frontend service wrapper and one React report page using existing report/print infrastructure. Wire the page into `App.jsx`, `DashboardLayout.jsx`, and the dashboard shortcut list.

**Tech Stack:** Bun/Elysia/TypeScript backend, React/Vite frontend, Axios service wrappers, Recharts charts, existing `wages-summary-professional.css` and `report-print-foundation.css`.

---

### Task 1: Backend Tonase Report Contract

**Files:**
- Create: `backend/src/services/dashboardService.tonaseReport.test.ts`
- Modify: `backend/src/services/dashboardService.ts`
- Modify: `backend/src/api/dashboardRoutes.ts`

- [ ] **Step 1: Write failing backend tests**

Create tests that call `dashboardService.getTonaseAnalysisReport(5, 2026)` with mocked `extendDb.query`, `getGangProduction`, and `getHarvesterBunches`. Assert:

```ts
expect(report.meta.period_window.map(p => `${p.month}-${p.year}`)).toEqual([
    "1-2026",
    "2-2026",
    "3-2026",
    "4-2026",
    "5-2026"
]);
expect(report.kpis.total_tonase).toBe(10);
expect(report.kpis.upah_bersih_per_hk).toBe(20000);
expect(report.kpis.premi_per_hk).toBe(3000);
expect(report.premium_breakdown.map(p => p.key)).toContain("lainnya");
```

- [ ] **Step 2: Run backend test and verify RED**

Run:

```bash
cd backend
bun test src/services/dashboardService.tonaseReport.test.ts
```

Expected: fail because `getTonaseAnalysisReport` does not exist.

- [ ] **Step 3: Implement backend service**

Add `getTonaseAnalysisReport(month, year, divisionCode?)` to `DashboardService`. It should:

- build a 5-month period window,
- query latest aggregation rows for those periods,
- filter harvesting gangs by suffix `H`,
- aggregate `total_upah_bersih`, `total_hk`, `total_premi`, `total_ffb_weight`,
- use `getGangProduction()` as fallback when a gang row has zero tonase,
- return `meta`, `kpis`, `trend`, `premium_breakdown`, `insights`, and `warnings`.

- [ ] **Step 4: Add dashboard route**

Add:

```ts
.get('/tonase-analysis-report', async ({ query, set }) => {
    const month = parseInt(query.month);
    const year = parseInt(query.year);
    const divisionCode = query.division_code;
    const data = await dashboardService.getTonaseAnalysisReport(month, year, divisionCode);
    return { success: true, data };
})
```

- [ ] **Step 5: Verify backend GREEN**

Run:

```bash
cd backend
bun test src/services/dashboardService.tonaseReport.test.ts
```

Expected: pass.

---

### Task 2: Frontend Service and Page Source Guards

**Files:**
- Modify: `frontend/src/services/dashboardService.js`
- Create: `frontend/src/services/dashboardService.tonaseReport.test.js`
- Create: `frontend/src/pages/TonaseAnalysisReportPage.jsx`
- Create: `frontend/src/pages/TonaseAnalysisReportPage.test.js`

- [ ] **Step 1: Write failing frontend service test**

Mock Axios and assert `fetchTonaseAnalysisReport(token, { month: 5, year: 2026 })` calls:

```js
axios.get('payroll/dashboard/tonase-analysis-report', {
  params: { month: '5', year: '2026' },
  headers: {
    Authorization: 'Bearer token-1',
    'Content-Type': 'application/json'
  }
});
```

- [ ] **Step 2: Run frontend service test and verify RED**

Run:

```bash
cd frontend
npx vitest run src/services/dashboardService.tonaseReport.test.js
```

Expected: fail because the service wrapper does not exist.

- [ ] **Step 3: Implement frontend service wrapper**

Export `fetchTonaseAnalysisReport` from `frontend/src/services/dashboardService.js`, and add it to the default export.

- [ ] **Step 4: Create page source guard test**

Read `TonaseAnalysisReportPage.jsx` as source and assert it contains:

```js
expect(source).toContain('fetchTonaseAnalysisReport');
expect(source).toContain('tonase-trend-chart');
expect(source).toContain('premium-breakdown-table');
expect(source).toContain('printReport({ orientation: \\'landscape\\' })');
```

- [ ] **Step 5: Implement report page**

Create `TonaseAnalysisReportPage.jsx` with:

- month/year filters,
- refresh and print buttons,
- `wsp-document` with `id="tonase-analysis-report-content"`,
- KPI cards,
- insight strip,
- Recharts trend chart,
- premium breakdown table,
- 5-month summary table,
- empty/error/loading states.

- [ ] **Step 6: Verify frontend page/service GREEN**

Run:

```bash
cd frontend
npx vitest run src/services/dashboardService.tonaseReport.test.js src/pages/TonaseAnalysisReportPage.test.js
```

Expected: pass.

---

### Task 3: Routing and Sidebar Navigation

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/layouts/DashboardLayout.jsx`
- Modify: `frontend/src/pages/DashboardHome.jsx`
- Create: `frontend/src/pages/TonaseAnalysisNavigation.test.js`

- [ ] **Step 1: Write failing navigation source guard**

Assert:

```js
expect(appSource).toContain("import TonaseAnalysisReportPage from './pages/TonaseAnalysisReportPage'");
expect(appSource).toContain('path="tonase-analysis"');
expect(layoutSource).toContain("to: '/tonase-analysis'");
expect(layoutSource).toContain("label: 'Analisis Tonase'");
expect(homeSource).toContain("navigate('/tonase-analysis')");
```

- [ ] **Step 2: Run navigation test and verify RED**

Run:

```bash
cd frontend
npx vitest run src/pages/TonaseAnalysisNavigation.test.js
```

Expected: fail because route and sidebar entry are missing.

- [ ] **Step 3: Wire route and navigation**

Import the page in `App.jsx`, add route `path="tonase-analysis"`, add sidebar item in `DashboardLayout.jsx` under `Analisis & Laporan`, and add a dashboard shortcut under `Laporan Analisis & Summary`.

- [ ] **Step 4: Verify navigation GREEN**

Run:

```bash
cd frontend
npx vitest run src/pages/TonaseAnalysisNavigation.test.js
```

Expected: pass.

---

### Task 4: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run focused backend tests**

Run:

```bash
cd backend
bun test src/services/dashboardService.tonaseReport.test.ts src/services/dashboardService.test.ts src/services/manualAdjustmentService.test.ts
```

Expected: pass. Existing logger `EPERM` warnings are acceptable only if Bun exits 0.

- [ ] **Step 2: Run focused frontend tests**

Run:

```bash
cd frontend
npx vitest run src/services/dashboardService.tonaseReport.test.js src/pages/TonaseAnalysisReportPage.test.js src/pages/TonaseAnalysisNavigation.test.js
```

Expected: pass.

- [ ] **Step 3: Build frontend**

Run:

```bash
cd frontend
npm run build
```

Expected: Vite build passes.

- [ ] **Step 4: Review changed files**

Run:

```bash
git diff -- backend/src/services/dashboardService.ts backend/src/api/dashboardRoutes.ts frontend/src/services/dashboardService.js frontend/src/pages/TonaseAnalysisReportPage.jsx frontend/src/App.jsx frontend/src/layouts/DashboardLayout.jsx frontend/src/pages/DashboardHome.jsx
```

Expected: changes are scoped to the tonase report and do not revert unrelated work.
