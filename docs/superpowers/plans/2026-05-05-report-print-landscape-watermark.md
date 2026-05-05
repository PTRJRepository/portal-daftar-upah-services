# Report Print Landscape Watermark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve report print output by enforcing landscape layout, adding a subtle Rebinmas watermark, and showing concise division descriptions.

**Architecture:** Add reusable frontend primitives for print watermark and division labels, then wire them into report headers. Keep CSS print-only and avoid changing payslip portrait layout.

**Tech Stack:** React, JavaScript, CSS, Vitest, Vite.

---

### Task 1: Division Description Labels

**Files:**
- Create: `frontend/src/utils/divisionPresentation.js`
- Test: `frontend/src/utils/divisionPresentation.test.js`

- [ ] **Step 1: Write tests**

Run: `cd frontend && npx vitest run src/utils/divisionPresentation.test.js`

Expected: FAIL before implementation because the module does not exist.

- [ ] **Step 2: Implement utility**

Create `getDivisionShortDescription`, `getDivisionDisplayLabel`, and `getReportDivisionSummary`.

- [ ] **Step 3: Verify tests**

Run: `cd frontend && npx vitest run src/utils/divisionPresentation.test.js`

Expected: PASS.

### Task 2: Print Watermark Component

**Files:**
- Create: `frontend/src/components/common/ReportWatermark.jsx`
- Test: `frontend/src/components/common/ReportWatermark.test.jsx`
- Modify: `frontend/src/styles/report-print-foundation.css`

- [ ] **Step 1: Write component test**

Run: `cd frontend && npx vitest run src/components/common/ReportWatermark.test.jsx`

Expected: FAIL before implementation because the component does not exist.

- [ ] **Step 2: Implement component and print CSS**

Render a print-only watermark image/text behind report content using `rebinmas.webp`.

- [ ] **Step 3: Verify test**

Run: `cd frontend && npx vitest run src/components/common/ReportWatermark.test.jsx`

Expected: PASS.

### Task 3: Wire Reports

**Files:**
- Modify: `frontend/src/pages/SummaryReportPage.jsx`
- Modify: `frontend/src/pages/WagesSummaryRebinmasPage.jsx`
- Modify: `frontend/src/pages/WagesSummaryIJLPage.jsx`
- Modify: `frontend/src/components/PayrollHistoryComparison.jsx`
- Modify: `frontend/src/pages/OtherIncomesPage.jsx`

- [ ] **Step 1: Add watermark to report documents**

Import and render `ReportWatermark` inside print report document wrappers.

- [ ] **Step 2: Add division descriptions to metadata**

Use `getReportDivisionSummary` for detail summary and `getDivisionDisplayLabel` for division rows where appropriate.

- [ ] **Step 3: Force generated THR report print to landscape**

Set the THR preview default orientation to `landscape` and bank-list generated page to landscape.

### Task 4: Verification

**Files:**
- Verify frontend tests and build.

- [ ] **Step 1: Run focused tests**

Run: `cd frontend && npx vitest run src/utils/divisionPresentation.test.js src/components/common/ReportWatermark.test.jsx`

Expected: PASS.

- [ ] **Step 2: Run build**

Run: `cd frontend && npm run build`

Expected: Exit code 0.

