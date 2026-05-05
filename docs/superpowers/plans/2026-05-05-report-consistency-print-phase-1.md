# Report Consistency and Print Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Phase 1 report data bugs and add a small print foundation for consistent report output.

**Architecture:** Keep report totals in backend summary endpoints. Add shared frontend/backend helpers only where they reduce duplicated report scoping logic. Keep visual changes narrow and compatible with existing `wsp-*`/`phc-*` report CSS.

**Tech Stack:** Bun + Elysia + TypeScript backend, React + Vite + Vitest frontend, custom CSS print styles.

---

### Task 1: Shared Division Type Scope

**Files:**
- Create: `frontend/src/utils/reportDivisionType.js`
- Test: `frontend/src/utils/reportDivisionType.test.js`
- Modify: `frontend/src/services/summaryReportService.js`

- [ ] **Step 1: Write failing tests**

Test `isVirtualReportDivision()` and `filterRowsByDivisionType()` with real and virtual rows.

- [ ] **Step 2: Run the focused test**

Run: `cd frontend && npx vitest run src/utils/reportDivisionType.test.js`

- [ ] **Step 3: Implement helper**

Implement virtual code detection for `INF`, `NRS`, `WKS_PG`, `WKS_AR`, and `WORKSHOP`.

- [ ] **Step 4: Verify helper test passes**

Run: `cd frontend && npx vitest run src/utils/reportDivisionType.test.js`

### Task 2: Backend Summary Division Type

**Files:**
- Modify: `backend/src/api/summary.ts`
- Test: `backend/src/utils/summaryReportScope.test.ts`
- Create: `backend/src/utils/summaryReportScope.ts`

- [ ] **Step 1: Write failing backend tests**

Test that `filterRowsBySummaryDivisionType(rows, "virtual")` keeps only virtual division rows and `"real"` removes them.

- [ ] **Step 2: Run focused backend test**

Run: `cd backend && bun test src/utils/summaryReportScope.test.ts`

- [ ] **Step 3: Implement helper and wire route**

Use the helper in `/payroll/summary/all-divisions` and `/payroll/summary/comparison`.

- [ ] **Step 4: Verify backend test passes**

Run: `cd backend && bun test src/utils/summaryReportScope.test.ts`

### Task 3: Frontend Wages Summary Wiring

**Files:**
- Modify: `frontend/src/services/summaryReportService.js`
- Modify: `frontend/src/pages/WagesSummaryRebinmasPage.jsx`
- Modify: `frontend/src/pages/WagesSummaryIJLPage.jsx`

- [ ] **Step 1: Pass `divisionType` to service calls**

Send `division_type` for all-divisions and comparison requests.

- [ ] **Step 2: Keep backend totals as displayed totals**

Do not recompute `grandTotal`, `groupSubtotals`, or comparison grand totals in the page.

### Task 4: Wages Comparison Group Filter

**Files:**
- Modify: `frontend/src/components/PayrollHistoryComparison.jsx`
- Test: `frontend/src/components/PayrollHistoryComparison.group-filter.test.jsx`

- [ ] **Step 1: Write failing component test**

Render Wages Comparison with two groups, change group selector, and assert rows update.

- [ ] **Step 2: Run focused frontend test**

Run: `cd frontend && npx vitest run src/components/PayrollHistoryComparison.group-filter.test.jsx`

- [ ] **Step 3: Fix dependency list**

Add `group` to the filtered data `useMemo` dependency list.

- [ ] **Step 4: Verify focused test passes**

Run: `cd frontend && npx vitest run src/components/PayrollHistoryComparison.group-filter.test.jsx`

### Task 5: Impact Report Parent Period

**Files:**
- Modify: `frontend/src/pages/ImpactReportPage.jsx`
- Modify: `frontend/src/pages/WagesSummaryRebinmasPage.jsx`
- Modify: `frontend/src/pages/WagesSummaryIJLPage.jsx`

- [ ] **Step 1: Accept initial props**

Add `initialMonth`, `initialYear`, and `initialEstateType`.

- [ ] **Step 2: Pass props from Wages Summary pages**

Rebinmas opens impact with `non-ijl`; IJL opens impact with `ijl`.

### Task 6: Print Foundation

**Files:**
- Create: `frontend/src/styles/report-print-foundation.css`
- Modify: report pages importing `wages-summary-professional.css`

- [ ] **Step 1: Add safe print primitives**

Add shared metadata/source line styles, print-only visibility, table break safety, and sticky reset under `@media print`.

- [ ] **Step 2: Import foundation where reports use `wsp-*`**

Import the CSS after the main report CSS so it can normalize print behavior.

### Task 7: Verification

**Files:**
- No production files.

- [ ] **Step 1: Run focused frontend tests**

Run: `cd frontend && npx vitest run src/utils/reportDivisionType.test.js src/components/PayrollHistoryComparison.group-filter.test.jsx`

- [ ] **Step 2: Run focused backend tests**

Run: `cd backend && bun test src/utils/summaryReportScope.test.ts`

- [ ] **Step 3: Build frontend**

Run: `cd frontend && npm run build`

