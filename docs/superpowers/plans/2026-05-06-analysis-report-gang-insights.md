# Analysis Report Gang Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/upah/analysis` so repeated estate/division names are clearly grouped and each detail row is identified as a gang with actionable premi/OT variance insight.

**Architecture:** Keep the existing backend endpoint and enrich the frontend helper layer. `analysisReportInsights.js` will normalize gang-level rows, compute row labels and division groups, and the page will render grouped tables from that derived model.

**Tech Stack:** React, JavaScript ES modules, Vitest, existing report CSS in `frontend/src/styles/report-print-foundation.css`.

---

## File Structure

- Modify: `frontend/src/utils/analysisReportInsights.js`
  - Normalize analysis rows, compute gang labels, group summaries, top reducers, largest premium/OT gang, and deterministic row insight labels.
- Modify: `frontend/src/utils/analysisReportInsights.test.js`
  - Add tests for gang row normalization, grouping, reducers, and labels.
- Modify: `frontend/src/pages/AnalysisReportPage.jsx`
  - Replace the flat Summary Premi & OT table with a grouped gang table.
  - Update insight cards and premi breakdown labels to show gang identity.
- Modify: `frontend/src/pages/AnalysisReportPage.printInsights.test.js`
  - Keep source-level coverage for the new grouped table and gang-level labels.
- Modify: `frontend/src/styles/report-print-foundation.css`
  - Add compact screen/print styling for analysis group rows and gang labels.

## Task 1: Helper Tests for Gang Insights

**Files:**
- Modify: `frontend/src/utils/analysisReportInsights.test.js`

- [ ] **Step 1: Add failing tests for group summaries and gang labels**

Add this test case inside the existing `describe('buildAnalysisReportInsights', ...)` block:

```js
it('normalizes gang rows and groups them by division for the analysis report', () => {
  const insights = buildAnalysisReportInsights({
    rows: [
      {
        division_code: 'PG1A',
        description: 'Estate Parit Gunung 1A',
        gang_code: 'A01',
        gang_description: 'Gang Panen Air Papan',
        prev_premi: 100,
        curr_premi: 220,
        diff_premi: 120,
        prev_ot: 20,
        curr_ot: 40,
        diff_ot: 20,
        premi_breakdown: { PREMI_A: 220 },
      },
      {
        division_code: 'PG1A',
        description: 'Estate Parit Gunung 1A',
        gang_code: 'A02',
        gang_description: 'Gang Rawat Air Papan',
        prev_premi: 200,
        curr_premi: 120,
        diff_premi: -80,
        prev_ot: 40,
        curr_ot: 10,
        diff_ot: -30,
        premi_breakdown: { PREMI_A: 120 },
      },
      {
        division_code: 'AB2',
        description: 'Estate Air Ruak 2',
        gang_code: 'B01',
        gang_description: '',
        prev_premi: 50,
        curr_premi: 70,
        diff_premi: 20,
        prev_ot: 10,
        curr_ot: 80,
        diff_ot: 70,
        premi_breakdown: { PREMI_A: 70 },
      },
    ],
    totals: {},
    headers: ['PREMI_A'],
    breakdownTotals: { PREMI_A: 410 },
  });

  expect(insights.rows[0]).toMatchObject({
    row_key: 'PG1A::A01',
    gang_label: 'A01',
    gang_description_label: 'Gang Panen Air Papan',
    division_label: 'PG1A - Estate Parit Gunung 1A',
    total_diff: 140,
    insight_label: 'Premi naik dominan',
  });
  expect(insights.rows[1].insight_label).toBe('Menekan biaya');
  expect(insights.rows[2].insight_label).toBe('Lembur naik dominan');
  expect(insights.rows[2].gang_description_label).toBe('-');
  expect(insights.groupedRows).toHaveLength(2);
  expect(insights.groupedRows[0]).toMatchObject({
    division_code: 'PG1A',
    division_label: 'PG1A - Estate Parit Gunung 1A',
    gang_count: 2,
    curr_premi: 340,
    curr_ot: 50,
    total_diff: 30,
  });
  expect(insights.groupedRows[0].top_driver.gang_code).toBe('A01');
  expect(insights.topCostReducers[0].gang_code).toBe('A02');
  expect(insights.largestPremiumGang.gang_code).toBe('A01');
  expect(insights.largestOvertimeGang.gang_code).toBe('B01');
});
```

- [ ] **Step 2: Run the focused helper test and verify failure**

Run:

```bash
cd frontend && npx vitest run src/utils/analysisReportInsights.test.js
```

Expected: FAIL because `groupedRows`, `topCostReducers`, `largestPremiumGang`, `largestOvertimeGang`, and normalized row label fields do not exist yet.

## Task 2: Implement Insight Normalization and Grouping

**Files:**
- Modify: `frontend/src/utils/analysisReportInsights.js`

- [ ] **Step 1: Add normalization helpers**

Add these functions after `resolvePremiumHeaders`:

```js
const cleanText = (value) => String(value || '').trim();

const getDivisionLabel = (row) => {
  const code = cleanText(row.division_code);
  const description = cleanText(row.description || row.estate);
  if (code && description && description.toUpperCase() !== code.toUpperCase()) {
    return `${code} - ${description}`;
  }
  return code || description || '-';
};

const getGangLabel = (row) => cleanText(row.gang_code) || cleanText(row.division_code) || '-';

const getGangDescriptionLabel = (row) => (
  cleanText(row.gang_description) || cleanText(row.gang_desc) || '-'
);

const getInsightLabel = (row) => {
  const totalDiff = toNumber(row.diff_premi) + toNumber(row.diff_ot);
  if (totalDiff < 0) return 'Menekan biaya';
  if (totalDiff === 0) return 'Stabil';
  return Math.abs(toNumber(row.diff_ot)) > Math.abs(toNumber(row.diff_premi))
    ? 'Lembur naik dominan'
    : 'Premi naik dominan';
};
```

- [ ] **Step 2: Add grouped summary builder**

Add this function after the helper block:

```js
const buildGroupedRows = (rows) => {
  const groups = new Map();

  rows.forEach((row) => {
    const key = row.division_code || row.division_label || '-';
    if (!groups.has(key)) {
      groups.set(key, {
        division_code: row.division_code || '-',
        division_label: row.division_label,
        description: row.description || row.estate || '',
        rows: [],
        gang_count: 0,
        prev_premi: 0,
        curr_premi: 0,
        diff_premi: 0,
        prev_ot: 0,
        curr_ot: 0,
        diff_ot: 0,
        total_diff: 0,
        top_driver: null,
      });
    }

    const group = groups.get(key);
    group.rows.push(row);
    group.gang_count += 1;
    group.prev_premi += toNumber(row.prev_premi);
    group.curr_premi += toNumber(row.curr_premi);
    group.diff_premi += toNumber(row.diff_premi);
    group.prev_ot += toNumber(row.prev_ot);
    group.curr_ot += toNumber(row.curr_ot);
    group.diff_ot += toNumber(row.diff_ot);
    group.total_diff += toNumber(row.total_diff);
    group.top_driver = !group.top_driver || row.total_diff > group.top_driver.total_diff
      ? row
      : group.top_driver;
  });

  return Array.from(groups.values());
};
```

- [ ] **Step 3: Replace the `normalizedRows` mapping**

Use this mapping inside `buildAnalysisReportInsights`:

```js
const normalizedRows = rows.map((row) => {
  const normalized = {
    ...row,
    division_code: cleanText(row.division_code),
    description: cleanText(row.description || row.estate),
    gang_code: cleanText(row.gang_code || row.division_code),
    gang_description: cleanText(row.gang_description || row.gang_desc),
    prev_premi: toNumber(row.prev_premi),
    curr_premi: toNumber(row.curr_premi),
    diff_premi: toNumber(row.diff_premi),
    prev_ot: toNumber(row.prev_ot),
    curr_ot: toNumber(row.curr_ot),
    diff_ot: toNumber(row.diff_ot),
  };

  normalized.total_diff = normalized.diff_premi + normalized.diff_ot;
  normalized.division_label = getDivisionLabel(normalized);
  normalized.gang_label = getGangLabel(normalized);
  normalized.gang_description_label = getGangDescriptionLabel(normalized);
  normalized.row_key = `${normalized.division_code || '-'}::${normalized.gang_code || '-'}`;
  normalized.insight_label = getInsightLabel(normalized);
  return normalized;
});
```

- [ ] **Step 4: Extend the returned object**

Add `groupedRows`, `topCostReducers`, `largestPremiumGang`, and `largestOvertimeGang` while preserving old keys:

```js
const groupedRows = buildGroupedRows(normalizedRows);
const sortedReducers = [...normalizedRows].sort((a, b) => a.total_diff - b.total_diff);

return {
  rows: normalizedRows,
  groupedRows,
  premiChangePercent: percentChange({
    current: totals.curr_premi,
    previous: totals.prev_premi,
    diff: totals.diff_premi,
  }),
  overtimeChangePercent: percentChange({
    current: totals.curr_ot,
    previous: totals.prev_ot,
    diff: totals.diff_ot,
  }),
  largestCostDriver: maxBy(normalizedRows, (row) => row.total_diff),
  largestCostReducer: minBy(normalizedRows, (row) => row.total_diff),
  largestPremiumDivision: maxBy(normalizedRows, (row) => row.curr_premi),
  largestOvertimeDivision: maxBy(normalizedRows, (row) => row.curr_ot),
  largestPremiumGang: maxBy(normalizedRows, (row) => row.curr_premi),
  largestOvertimeGang: maxBy(normalizedRows, (row) => row.curr_ot),
  topCostDrivers: sortedDrivers.filter((row) => row.total_diff > 0).slice(0, 3),
  topCostReducers: sortedReducers.filter((row) => row.total_diff < 0).slice(0, 3),
  printPremiHeaders,
  printPremiRows,
  otherPremiTotal,
};
```

- [ ] **Step 5: Run the helper test and verify pass**

Run:

```bash
cd frontend && npx vitest run src/utils/analysisReportInsights.test.js
```

Expected: PASS.

## Task 3: Page Tests for Gang-Level UI

**Files:**
- Modify: `frontend/src/pages/AnalysisReportPage.printInsights.test.js`

- [ ] **Step 1: Add source checks for grouped gang UI**

Append this test:

```js
it('renders analysis rows as grouped gang-level output', () => {
  expect(source).toContain('GroupedPremiOTTable');
  expect(source).toContain('groupedRows={analysisInsights.groupedRows}');
  expect(source).toContain('Gang / Uraian');
  expect(source).toContain('analysis-group-row');
  expect(source).toContain('analysis-gang-code');
});
```

- [ ] **Step 2: Run the page source test and verify failure**

Run:

```bash
cd frontend && npx vitest run src/pages/AnalysisReportPage.printInsights.test.js
```

Expected: FAIL because the page still renders `SummaryPremiOTTable`.

## Task 4: Render Grouped Analysis Table

**Files:**
- Modify: `frontend/src/pages/AnalysisReportPage.jsx`

- [ ] **Step 1: Update the insight label helper**

Replace `getDivisionLabel` with:

```js
const getAnalysisRowLabel = (row) => row?.gang_label || row?.gang_code || row?.description || row?.division_code || '-';
```

- [ ] **Step 2: Update insight cards to show gang labels**

Inside `AnalysisPrintInsights`, use `largestPremiumGang`, `largestOvertimeGang`, and `largestCostReducer`:

```js
const largestDriver = insights.largestCostDriver;
const largestPremium = insights.largestPremiumGang || insights.largestPremiumDivision;
const largestOvertime = insights.largestOvertimeGang || insights.largestOvertimeDivision;
const largestReducer = insights.largestCostReducer;
```

Use these labels in cards:

```jsx
{getAnalysisRowLabel(largestDriver)}
{getAnalysisRowLabel(largestPremium)}
{getAnalysisRowLabel(largestOvertime)}
{getAnalysisRowLabel(largestReducer)}
```

- [ ] **Step 3: Replace `SummaryPremiOTTable` usage**

Render:

```jsx
<GroupedPremiOTTable
  groupedRows={analysisInsights.groupedRows}
  totals={reportData.totals}
  prevMonthLabel={`${prevMonthName}-${prevYearShort}`}
  currMonthLabel={`${currMonthName}-${currYearShort}`}
  formatCurrency={formatCurrency}
  getDiffClass={getDiffClass}
/>
```

- [ ] **Step 4: Replace `SummaryPremiOTTable` component**

Create `GroupedPremiOTTable` with columns for estate/division group headers and child gang rows:

```jsx
const GroupedPremiOTTable = ({ groupedRows = [], totals, prevMonthLabel, currMonthLabel, formatCurrency, getDiffClass }) => (
  <div className="analysis-section" style={{ marginTop: '2rem' }}>
    <div className="analysis-section-title">
      <span>Summary Premi & OT Progress per Gang</span>
      <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>Pemisah baris: kode gang dan uraian gang</span>
    </div>
    <div className="wsp-table-wrapper">
      <table className="wsp-table analysis-grouped-table">
        <thead>
          <tr className="wsp-header-master">
            <th rowSpan="2" style={{ textAlign: 'left', width: '120px' }}>ESTATE / DIVISI</th>
            <th rowSpan="2" style={{ textAlign: 'left', width: '220px' }}>Gang / Uraian</th>
            <th colSpan="2">{prevMonthLabel}</th>
            <th colSpan="2">{currMonthLabel}</th>
            <th colSpan="3">PROGRESS (VARIANCE)</th>
          </tr>
          <tr className="wsp-header-sub">
            <th>PREMI</th>
            <th>OT</th>
            <th>PREMI</th>
            <th>OT</th>
            <th>PREMI DIFF</th>
            <th>OT DIFF</th>
            <th>INSIGHT</th>
          </tr>
        </thead>
        <tbody>
          {groupedRows.length === 0 && (
            <tr>
              <td colSpan="9" className="text-left">Tidak ada data gang untuk periode ini.</td>
            </tr>
          )}
          {groupedRows.map((group) => (
            <React.Fragment key={group.division_code || group.division_label}>
              <tr className="analysis-group-row">
                <td colSpan="2" className="text-left">
                  <span className="analysis-group-title">{group.division_label}</span>
                  <span className="analysis-group-note">{group.gang_count} gang</span>
                </td>
                <td className="text-right">{formatCurrency(group.prev_premi)}</td>
                <td className="text-right">{formatCurrency(group.prev_ot)}</td>
                <td className="text-right">{formatCurrency(group.curr_premi)}</td>
                <td className="text-right">{formatCurrency(group.curr_ot)}</td>
                <td className={`text-right ${getDiffClass(group.diff_premi)}`}>{formatCurrency(group.diff_premi)}</td>
                <td className={`text-right ${getDiffClass(group.diff_ot)}`}>{formatCurrency(group.diff_ot)}</td>
                <td className={`text-right ${getDiffClass(group.total_diff)}`}>{formatCurrency(group.total_diff)}</td>
              </tr>
              {group.rows.map((row) => (
                <tr key={row.row_key}>
                  <td className="text-left analysis-division-cell">{row.division_code}</td>
                  <td className="text-left">
                    <span className="analysis-gang-code">{row.gang_label}</span>
                    <span className="analysis-gang-desc">{row.gang_description_label}</span>
                  </td>
                  <td className="text-right">{formatCurrency(row.prev_premi)}</td>
                  <td className="text-right">{formatCurrency(row.prev_ot)}</td>
                  <td className="text-right font-bold">{formatCurrency(row.curr_premi)}</td>
                  <td className="text-right font-bold">{formatCurrency(row.curr_ot)}</td>
                  <td className={`text-right font-bold ${getDiffClass(row.diff_premi)}`}>{formatCurrency(row.diff_premi)}</td>
                  <td className={`text-right font-bold ${getDiffClass(row.diff_ot)}`}>{formatCurrency(row.diff_ot)}</td>
                  <td className="text-left analysis-insight-cell">{row.insight_label}</td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr className="wsp-grand-total">
            <td colSpan="2" className="text-right" style={{ paddingRight: '15px' }}>TOTAL C/ROLL</td>
            <td className="text-right">{formatCurrency(totals.prev_premi)}</td>
            <td className="text-right">{formatCurrency(totals.prev_ot)}</td>
            <td className="text-right">{formatCurrency(totals.curr_premi)}</td>
            <td className="text-right">{formatCurrency(totals.curr_ot)}</td>
            <td className="text-right">{formatCurrency(totals.diff_premi)}</td>
            <td className="text-right">{formatCurrency(totals.diff_ot)}</td>
            <td className="text-right">{formatCurrency((totals.diff_premi || 0) + (totals.diff_ot || 0))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
);
```

- [ ] **Step 5: Run the page source test and verify pass**

Run:

```bash
cd frontend && npx vitest run src/pages/AnalysisReportPage.printInsights.test.js
```

Expected: PASS.

## Task 5: Update Premi Breakdown Gang Labels

**Files:**
- Modify: `frontend/src/pages/AnalysisReportPage.jsx`

- [ ] **Step 1: Update full breakdown headers**

In `FullPremiBreakdownTable`, replace the first `DIVISI` header with two columns:

```jsx
<th style={{ textAlign: 'left', width: '130px', position: 'static', left: 0, zIndex: 5 }}>ESTATE / DIVISI</th>
<th style={{ textAlign: 'left', width: '170px' }}>GANG / URAIAN</th>
```

- [ ] **Step 2: Update full breakdown body row label**

Use:

```jsx
<td className="text-left font-bold">
  {row.division_label || row.division_code}
</td>
<td className="text-left">
  <span className="analysis-gang-code">{row.gang_label || row.gang_code}</span>
  <span className="analysis-gang-desc">{row.gang_description_label || '-'}</span>
</td>
```

- [ ] **Step 3: Update full breakdown footer colspan**

Use:

```jsx
<td className="text-left" colSpan="2">TOTAL</td>
```

- [ ] **Step 4: Update print appendix labels**

In the print-only appendix, use two first columns:

```jsx
<th>ESTATE / DIVISI</th>
<th>GANG / URAIAN</th>
```

And row cells:

```jsx
<td className="text-left font-bold">{row.division_label || row.division_code}</td>
<td className="text-left">
  <span className="analysis-gang-code">{row.gang_label || row.gang_code}</span>
  <span className="analysis-gang-desc">{row.gang_description_label || '-'}</span>
</td>
```

## Task 6: CSS Polish for Screen and Print

**Files:**
- Modify: `frontend/src/styles/report-print-foundation.css`

- [ ] **Step 1: Add screen styles near existing analysis styles**

Add:

```css
.analysis-grouped-table .analysis-group-row td {
  background: #e2e8f0;
  color: #0f172a;
  font-weight: 900;
}

.analysis-group-title,
.analysis-gang-code,
.analysis-gang-desc,
.analysis-group-note {
  display: block;
  min-width: 0;
  overflow-wrap: anywhere;
}

.analysis-group-title {
  font-size: 0.78rem;
  line-height: 1.15;
}

.analysis-group-note,
.analysis-gang-desc {
  margin-top: 0.15rem;
  color: #64748b;
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1.15;
}

.analysis-gang-code {
  color: #0f172a;
  font-size: 0.78rem;
  font-weight: 900;
  line-height: 1.12;
}

.analysis-insight-cell {
  color: #334155;
  font-size: 0.72rem;
  font-weight: 800;
}
```

- [ ] **Step 2: Add print overrides inside `@media print`**

Add under the `#wsp-report-content .wsp-table` print rules:

```css
#wsp-report-content .analysis-grouped-table .analysis-group-row td {
  background: #e5e7eb !important;
  color: #000 !important;
  font-weight: 900 !important;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}

#wsp-report-content .analysis-group-title,
#wsp-report-content .analysis-gang-code,
#wsp-report-content .analysis-gang-desc,
#wsp-report-content .analysis-group-note {
  display: block !important;
  overflow-wrap: anywhere !important;
}

#wsp-report-content .analysis-gang-code {
  font-size: 6.8pt !important;
  font-weight: 900 !important;
  line-height: 1.05 !important;
}

#wsp-report-content .analysis-gang-desc,
#wsp-report-content .analysis-group-note,
#wsp-report-content .analysis-insight-cell {
  font-size: 5.8pt !important;
  line-height: 1.05 !important;
}
```

## Task 7: Final Verification

**Files:**
- Verify: frontend tests and build

- [ ] **Step 1: Run focused tests**

Run:

```bash
cd frontend && npx vitest run src/utils/analysisReportInsights.test.js src/pages/AnalysisReportPage.printInsights.test.js src/styles/report-print-foundation.test.js
```

Expected: PASS.

- [ ] **Step 2: Run frontend build**

Run:

```bash
cd frontend && npm run build
```

Expected: PASS with Vite production build output.

- [ ] **Step 3: Review working tree**

Run:

```bash
git status --short
git diff -- frontend/src/utils/analysisReportInsights.js frontend/src/utils/analysisReportInsights.test.js frontend/src/pages/AnalysisReportPage.jsx frontend/src/pages/AnalysisReportPage.printInsights.test.js frontend/src/styles/report-print-foundation.css docs/superpowers/plans/2026-05-06-analysis-report-gang-insights.md
```

Expected: only the plan and intended frontend files are changed by this implementation.
