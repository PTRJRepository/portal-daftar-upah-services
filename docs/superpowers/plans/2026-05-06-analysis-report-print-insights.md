# Analysis Report Print Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a print-safe executive Premi/Lembur analysis report for `/analysis`.

**Architecture:** Add a tested utility that derives insights and print-safe top-premi rows from the existing analysis payload. Wire that utility into `AnalysisReportPage.jsx`, then add `#wsp-report-content` scoped print CSS to prevent overflow.

**Tech Stack:** React, Vite, Vitest, CSS print media.

---

### Task 1: Insight Utility

**Files:**
- Create: `frontend/src/utils/analysisReportInsights.js`
- Test: `frontend/src/utils/analysisReportInsights.test.js`

- [ ] Write tests for percent deltas, largest current/diff rows, top 8 premi headers, and `LAINNYA`.
- [ ] Run `npx vitest run src/utils/analysisReportInsights.test.js` from `frontend` and confirm RED.
- [ ] Implement `buildAnalysisReportInsights`.
- [ ] Re-run the focused test and confirm GREEN.

### Task 2: Report Markup

**Files:**
- Modify: `frontend/src/pages/AnalysisReportPage.jsx`
- Test: `frontend/src/pages/AnalysisReportPage.printInsights.test.js`

- [ ] Add a source guard test for print insight classes and top-premi appendix usage.
- [ ] Run `npx vitest run src/pages/AnalysisReportPage.printInsights.test.js` and confirm RED.
- [ ] Import and use `buildAnalysisReportInsights`.
- [ ] Add print-first insight strip and compact appendix props.
- [ ] Re-run the focused page test and confirm GREEN.

### Task 3: Print CSS

**Files:**
- Modify: `frontend/src/styles/report-print-foundation.css`
- Test: `frontend/src/styles/report-print-foundation.test.js`

- [ ] Add CSS test assertions for `#wsp-report-content .analysis-print-*` selectors.
- [ ] Run `npx vitest run src/styles/report-print-foundation.test.js` and confirm RED.
- [ ] Add scoped A4 landscape print styles for the executive block, fixed progress table, and top-premi appendix.
- [ ] Re-run the CSS test and confirm GREEN.

### Task 4: Verification

**Files:**
- No new files.

- [ ] Run the three focused Vitest commands.
- [ ] Run `npm run build` from `frontend`.
- [ ] Review `git diff -- frontend/src/pages/AnalysisReportPage.jsx frontend/src/utils/analysisReportInsights.js frontend/src/styles/report-print-foundation.css`.
