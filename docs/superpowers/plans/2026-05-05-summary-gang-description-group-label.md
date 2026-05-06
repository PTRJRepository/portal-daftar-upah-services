# Summary Gang Description Group Label Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render Summary Report detail print group labels from inferred `gang_description` names instead of only `Group 1` / `Group 2`.

**Architecture:** Add a focused frontend utility that infers a label from repeated gang descriptions, then call it from `SummaryReportPage.jsx` when building print groups and group-total labels. Keep the existing asistensi key for filtering and row membership.

**Tech Stack:** React, JavaScript, Vitest.

---

## File Structure

- Create: `frontend/src/utils/gangDescriptionGroupLabel.js`
  - Owns token cleanup, repeated suffix inference, single-description fallback, and final fallback handling.
- Create: `frontend/src/utils/gangDescriptionGroupLabel.test.js`
  - Tests the inference rules directly with real inputs.
- Modify: `frontend/src/pages/SummaryReportPage.jsx`
  - Imports the utility.
  - Adds fallback label helpers.
  - Adds inferred labels to `groupedSummaryPrintRows`.
  - Uses inferred group label in print group rows and total rows.
- Modify: `frontend/src/pages/SummaryReportPage.printHeader.test.js`
  - Updates source assertions so the print row no longer depends on hardcoded `GROUP {group}`.

---

### Task 1: Add Tested Group Label Utility

**Files:**
- Create: `frontend/src/utils/gangDescriptionGroupLabel.js`
- Create: `frontend/src/utils/gangDescriptionGroupLabel.test.js`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/utils/gangDescriptionGroupLabel.test.js`:

```javascript
import { describe, expect, it } from 'vitest';
import { buildGangDescriptionGroupLabel } from './gangDescriptionGroupLabel.js';

describe('buildGangDescriptionGroupLabel', () => {
  it('uses the shared meaningful suffix from repeated gang descriptions', () => {
    const label = buildGangDescriptionGroupLabel([
      { gang_code: 'A1H', gang_description: 'Gang Panen Air Papan' },
      { gang_code: 'A1M', gang_description: 'Gang Rawat Air Papan' }
    ], { fallbackLabel: 'Group 1' });

    expect(label).toBe('Air Papan');
  });

  it('cleans generic leading words when only one description exists', () => {
    const label = buildGangDescriptionGroupLabel([
      { gang_code: 'A2H', gang_description: 'Gang Pruning Bukit Batu' }
    ], { fallbackLabel: 'Group 2' });

    expect(label).toBe('Bukit Batu');
  });

  it('falls back when the description has no meaningful group name', () => {
    const label = buildGangDescriptionGroupLabel([
      { gang_code: 'A3H', gang_description: 'Gang Panen' }
    ], { fallbackLabel: 'Group 3' });

    expect(label).toBe('Group 3');
  });
});
```

- [ ] **Step 2: Run the test to verify RED**

Run:

```bash
cd frontend && npx vitest run src/utils/gangDescriptionGroupLabel.test.js
```

Expected: FAIL because `gangDescriptionGroupLabel.js` does not exist.

- [ ] **Step 3: Implement the utility**

Create `frontend/src/utils/gangDescriptionGroupLabel.js`:

```javascript
const GENERIC_LEADING_WORDS = new Set([
  'gang',
  'kemandoran',
  'mandor',
  'panen',
  'rawat',
  'rawatan',
  'pruning',
  'prunning',
  'bhl',
  'harian',
  'pemeliharaan',
  'perawatan',
  'maintenance',
  'umum',
  'buah',
  'brondol',
  'angkut',
  'muat',
  'pupuk',
  'semprot',
  'tunas'
]);

function normalizeWords(value) {
  return String(value || '')
    .replace(/[()[\]{}.,;:/\\|_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function isGenericWord(word) {
  return GENERIC_LEADING_WORDS.has(String(word || '').toLowerCase());
}

function isMeaningfulWords(words) {
  return words.length > 0 && words.some((word) => !isGenericWord(word));
}

function cleanLeadingGenericWords(words) {
  const cleaned = [...words];
  while (cleaned.length > 1 && isGenericWord(cleaned[0])) {
    cleaned.shift();
  }
  return isMeaningfulWords(cleaned) && !isGenericWord(cleaned[0]) ? cleaned : [];
}

function getDescriptionWords(rows) {
  return rows
    .map((row) => normalizeWords(row?.gang_description || row?.description || ''))
    .filter((words) => isMeaningfulWords(words));
}

function findSharedMeaningfulSuffix(wordLists) {
  if (wordLists.length < 2) return [];

  const suffixes = new Map();
  wordLists.forEach((words, rowIndex) => {
    for (let length = words.length; length >= 1; length -= 1) {
      const suffix = words.slice(words.length - length);
      if (!isMeaningfulWords(suffix) || isGenericWord(suffix[0])) continue;

      const key = suffix.join('\u0000').toLowerCase();
      const existing = suffixes.get(key) || { words: suffix, rows: new Set(), firstRow: rowIndex };
      existing.rows.add(rowIndex);
      suffixes.set(key, existing);
    }
  });

  return Array.from(suffixes.values())
    .filter((item) => item.rows.size >= 2)
    .sort((a, b) => {
      if (b.words.length !== a.words.length) return b.words.length - a.words.length;
      if (b.rows.size !== a.rows.size) return b.rows.size - a.rows.size;
      return a.firstRow - b.firstRow;
    })[0]?.words || [];
}

export function buildGangDescriptionGroupLabel(rows = [], options = {}) {
  const fallbackLabel = options.fallbackLabel || 'Group';
  const wordLists = getDescriptionWords(rows);
  const sharedSuffix = findSharedMeaningfulSuffix(wordLists);

  if (sharedSuffix.length > 0) {
    return sharedSuffix.join(' ');
  }

  const cleaned = cleanLeadingGenericWords(wordLists[0] || []);
  if (cleaned.length > 0) {
    return cleaned.join(' ');
  }

  return fallbackLabel;
}
```

- [ ] **Step 4: Run the test to verify GREEN**

Run:

```bash
cd frontend && npx vitest run src/utils/gangDescriptionGroupLabel.test.js
```

Expected: PASS.

---

### Task 2: Wire Inferred Labels Into Summary Report

**Files:**
- Modify: `frontend/src/pages/SummaryReportPage.jsx`
- Modify: `frontend/src/pages/SummaryReportPage.printHeader.test.js`

- [ ] **Step 1: Update the source-inspection test before production wiring**

Modify `frontend/src/pages/SummaryReportPage.printHeader.test.js` in the second test:

```javascript
  it('groups summary detail print rows and emphasizes gang description before gang code', () => {
    expect(source).toContain('groupedSummaryPrintRows');
    expect(source).toContain('summary-print-group-row');
    expect(source).toContain('buildGangDescriptionGroupLabel');
    expect(source).toContain('summaryGroupLabel.toUpperCase()');
    expect(source).not.toContain('GROUP {group}');
    expect(source.indexOf('summary-print-desc')).toBeLessThan(source.indexOf('summary-print-code'));
  });
```

- [ ] **Step 2: Run the source-inspection test to verify RED**

Run:

```bash
cd frontend && npx vitest run src/pages/SummaryReportPage.printHeader.test.js
```

Expected: FAIL because `SummaryReportPage.jsx` still contains `GROUP {group}` and does not import the helper.

- [ ] **Step 3: Wire the helper into `SummaryReportPage.jsx`**

Add this import near other utility imports:

```javascript
import { buildGangDescriptionGroupLabel } from '../utils/gangDescriptionGroupLabel';
```

Add a fallback helper near `formatNumber`:

```javascript
const getSummaryGroupFallbackLabel = (group) => {
    return group && group !== 'LAINNYA' ? `Group ${group}` : 'Lainnya';
};

const formatSummaryGroupLabel = (label) => String(label || '').toUpperCase();
```

Add this memo before `filteredGrandTotal`:

```javascript
    const activeSummaryGroupLabel = useMemo(() => {
        if (!groupFilter) return '';
        const rows = mergedSummaryData.filter(row => getAsistensi(row.gang_code, division) === groupFilter);
        return buildGangDescriptionGroupLabel(rows, {
            fallbackLabel: getSummaryGroupFallbackLabel(groupFilter)
        });
    }, [groupFilter, mergedSummaryData, getAsistensi, division]);

    const filteredGrandTotalLabel = groupFilter
        ? `TOTAL ${formatSummaryGroupLabel(activeSummaryGroupLabel)}`
        : 'GRAND TOTAL';
```

Change `groupedSummaryPrintRows` so each group includes `summaryGroupLabel`:

```javascript
        return groups.map(groupData => ({
            ...groupData,
            summaryGroupLabel: buildGangDescriptionGroupLabel(groupData.rows, {
                fallbackLabel: getSummaryGroupFallbackLabel(groupData.group)
            })
        })).sort((a, b) => {
```

Change print row mapping and label:

```javascript
                                        groupedSummaryPrintRows.map(({ group, summaryGroupLabel, rows }) => (
                                            <React.Fragment key={`summary-print-group-${group}`}>
                                                <tr className="summary-print-group-row">
                                                    <td colSpan="8">{formatSummaryGroupLabel(summaryGroupLabel)}</td>
                                                </tr>
```

Replace footer labels:

```javascript
<td>{filteredGrandTotalLabel}</td>
```

- [ ] **Step 4: Run focused tests to verify GREEN**

Run:

```bash
cd frontend && npx vitest run src/utils/gangDescriptionGroupLabel.test.js src/pages/SummaryReportPage.printHeader.test.js
```

Expected: PASS.

---

### Task 3: Final Verification

**Files:**
- Verify modified files only.

- [ ] **Step 1: Run focused frontend tests**

Run:

```bash
cd frontend && npx vitest run src/utils/gangDescriptionGroupLabel.test.js src/pages/SummaryReportPage.printHeader.test.js
```

Expected: PASS.

- [ ] **Step 2: Inspect git diff**

Run:

```bash
git diff -- frontend/src/utils/gangDescriptionGroupLabel.js frontend/src/utils/gangDescriptionGroupLabel.test.js frontend/src/pages/SummaryReportPage.jsx frontend/src/pages/SummaryReportPage.printHeader.test.js docs/superpowers/plans/2026-05-05-summary-gang-description-group-label.md
```

Expected: Only the planned helper, tests, Summary Report wiring, and plan file changed.
