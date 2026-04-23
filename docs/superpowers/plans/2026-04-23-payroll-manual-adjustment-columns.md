# Payroll Manual Adjustment Dynamic Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add scoped dynamic edit-mode columns for `PREMI`, `POTONGAN UPAH KOTOR`, and `POTONGAN UPAH BERSIH`, persist them through `manual adjustment`, and make saved columns/values reappear immediately in `daftar upah` with correct payroll totals.

**Architecture:** Keep `dbo.payroll_manual_adjustments` as the single persistence source for manual dynamic columns and values. Split the implementation into two bounded layers: frontend canonical naming/UI wiring and backend canonical normalization/application. Use small pure helpers for naming and adjustment application so the hard business rules are locked by tests before the large files are edited.

**Tech Stack:** React, Vite, Vitest, Bun test, existing `CustomPayrollTable` flow, `manualAdjustmentService`, `dataExtractorService`, and `PayrollCalculator`

---

## File Structure

**Create**
- `frontend/src/utils/payrollManualAdjustmentNames.js`
  - Frontend-only helper for sanitizing user-entered column names, building canonical prefixed names, and building optimistic pending-column metadata.
- `frontend/src/utils/payrollManualAdjustmentNames.test.js`
  - Locks naming behavior for `PREMI`, `KOREKSI`, and `POTONGAN LAINNYA`.
- `backend/src/services/payroll/manualAdjustments/manualAdjustmentNaming.ts`
  - Pure backend helper for canonical name normalization, field-name generation, and placeholder retention rules.
- `backend/src/services/payroll/manualAdjustments/manualAdjustmentNaming.test.ts`
  - Locks duplicate-prefix prevention and `INIT_COLUMN` zero-retention behavior.
- `backend/src/services/payroll/manualAdjustments/manualAdjustmentApplier.ts`
  - Pure helper that applies normalized manual adjustments into employee row maps and total accumulators.
- `backend/src/services/payroll/manualAdjustments/manualAdjustmentApplier.test.ts`
  - Verifies `PREMI`, `KOREKSI`, and `POTONGAN LAINNYA` map to the correct fields and totals.

**Modify**
- `frontend/src/components/CustomPayrollTable.jsx`
  - Add `PREMI` add-column entry point, use canonical names when saving edits, include `division_code` in pending manual columns, and keep the current scope refresh flow.
- `frontend/src/components/CustomPayrollTable.render.test.jsx`
  - Lock the edit-mode headers that expose add-column actions.
- `backend/src/services/manualAdjustmentService.ts`
  - Normalize stored names, preserve `INIT_COLUMN` rows at zero, and filter adjustments by `division_code` + `gang_code`.
- `backend/src/services/dataExtractorService.ts`
  - Replace inline manual-adjustment loops with the new pure applier helper and pass `division_code` into the adjustment query.
- `backend/src/services/payroll/components/PayrollCalculator.test.ts`
  - Add regression coverage for the expected total deltas caused by manual dynamic columns.

## Constraints

- `adjustment_name` must be stored in full canonical form, for example `PREMI INSENTIF` or `POTONGAN LAINNYA KASBON`.
- New columns are scoped to the active `period_month + period_year + division_code + gang_code`.
- Placeholder rows with `INIT_COLUMN` must survive zero-value saves so empty columns still render after refresh.
- Backend row field names must be normalized to lowercase snake_case without duplicate prefixes, for example `premi_insentif`, `koreksi_denda_panen`, and `potongan_lainnya_kasbon`.
- The current worktree is dirty. Do not revert or stage unrelated files while executing this plan.

### Task 1: Lock Frontend Canonical Naming Before Touching the Table

**Files:**
- Create: `frontend/src/utils/payrollManualAdjustmentNames.js`
- Create: `frontend/src/utils/payrollManualAdjustmentNames.test.js`
- Test: `frontend/src/utils/payrollManualAdjustmentNames.test.js`

- [ ] **Step 1: Write the failing frontend naming test**

```js
import { describe, expect, it } from 'vitest';
import {
  buildCanonicalManualAdjustmentName,
  buildPendingManualColumn
} from './payrollManualAdjustmentNames';

describe('payrollManualAdjustmentNames', () => {
  it('builds canonical prefixed names for each supported group', () => {
    expect(buildCanonicalManualAdjustmentName('PREMI', 'Insentif')).toBe('PREMI INSENTIF');
    expect(buildCanonicalManualAdjustmentName('POTONGAN UPAH KOTOR', 'Denda Panen')).toBe('KOREKSI DENDA PANEN');
    expect(buildCanonicalManualAdjustmentName('POTONGAN UPAH BERSIH', 'Kasbon')).toBe('POTONGAN LAINNYA KASBON');
  });

  it('builds optimistic pending column metadata with field and scope', () => {
    expect(buildPendingManualColumn({
      groupLabel: 'PREMI',
      rawName: 'Insentif',
      division: 'AB1',
      firstEmployee: { nik: '3171', emp_code: 'B0001', gang_code: 'A1' }
    })).toEqual({
      fieldName: 'premi_insentif',
      adjustmentType: 'PREMI',
      adjustmentName: 'PREMI INSENTIF',
      activeFieldBucket: 'premi',
      payload: {
        nik: '3171',
        emp_code: 'B0001',
        gang_code: 'A1',
        division_code: 'AB1',
        type: 'PREMI',
        name: 'PREMI INSENTIF'
      }
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node .\node_modules\vitest\vitest.mjs run src/utils/payrollManualAdjustmentNames.test.js`  
Workdir: `frontend`  
Expected: FAIL because `payrollManualAdjustmentNames.js` does not exist yet.

- [ ] **Step 3: Implement the minimal frontend naming helper**

```js
const CANONICAL_PREFIX = {
  'PREMI': 'PREMI',
  'POTONGAN UPAH KOTOR': 'KOREKSI',
  'POTONGAN UPAH BERSIH': 'POTONGAN LAINNYA'
};

const TYPE_BY_GROUP = {
  'PREMI': 'PREMI',
  'POTONGAN UPAH KOTOR': 'POTONGAN_KOTOR',
  'POTONGAN UPAH BERSIH': 'POTONGAN_BERSIH'
};

const FIELD_PREFIX_BY_GROUP = {
  'PREMI': 'premi',
  'POTONGAN UPAH KOTOR': 'koreksi',
  'POTONGAN UPAH BERSIH': 'potongan_lainnya'
};

export function sanitizeManualAdjustmentLabel(input) {
  return String(input || '')
    .replace(/[^A-Za-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildCanonicalManualAdjustmentName(groupLabel, rawName) {
  const cleaned = sanitizeManualAdjustmentLabel(rawName).toUpperCase();
  if (!cleaned) return '';
  return `${CANONICAL_PREFIX[groupLabel]} ${cleaned}`.trim();
}

export function buildPendingManualColumn({ groupLabel, rawName, division, firstEmployee }) {
  const adjustmentName = buildCanonicalManualAdjustmentName(groupLabel, rawName);
  if (!adjustmentName || !firstEmployee) return null;

  const suffix = adjustmentName
    .replace(/^(PREMI|KOREKSI|POTONGAN LAINNYA)\s+/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  const fieldPrefix = FIELD_PREFIX_BY_GROUP[groupLabel];
  return {
    fieldName: `${fieldPrefix}_${suffix}`,
    adjustmentType: TYPE_BY_GROUP[groupLabel],
    adjustmentName,
    activeFieldBucket: groupLabel === 'PREMI' ? 'premi' : 'potongan',
    payload: {
      nik: firstEmployee.nik,
      emp_code: firstEmployee.emp_code || firstEmployee.nik,
      gang_code: firstEmployee.gang_code,
      division_code: division,
      type: TYPE_BY_GROUP[groupLabel],
      name: adjustmentName
    }
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node .\node_modules\vitest\vitest.mjs run src/utils/payrollManualAdjustmentNames.test.js`  
Workdir: `frontend`  
Expected: PASS with both canonical-name assertions green.

- [ ] **Step 5: Commit the helper**

```bash
git add frontend/src/utils/payrollManualAdjustmentNames.js frontend/src/utils/payrollManualAdjustmentNames.test.js
git commit -m "test(payroll): lock canonical manual adjustment naming"
```

### Task 2: Wire Canonical Manual Columns Into CustomPayrollTable

**Files:**
- Modify: `frontend/src/components/CustomPayrollTable.jsx`
- Modify: `frontend/src/components/CustomPayrollTable.render.test.jsx`
- Test: `frontend/src/components/CustomPayrollTable.render.test.jsx`
- Test: `frontend/src/utils/payrollManualAdjustmentNames.test.js`

- [ ] **Step 1: Write the failing render test for the three add-column entry points**

```jsx
/** @vitest-environment jsdom */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import CustomPayrollTable from './CustomPayrollTable';

vi.mock('../hooks/usePayrollStream', () => ({
  usePayrollStream: () => ({
    gangs: [],
    meta: {
      dynamic_premi_headers: [],
      dynamic_potongan_headers: [],
      premi_title_map: {},
      potongan_title_map: {}
    },
    progress: { stage: null },
    grandTotal: null,
    error: null,
    isComplete: true
  })
}));

describe('CustomPayrollTable render', () => {
  it('shows add-column affordances for premi and both potongan groups in edit mode', () => {
    const html = renderToString(
      <CustomPayrollTable
        token="test-token"
        division="AB1"
        gangCode="A1"
        month={4}
        year={2026}
        isEditMode
      />
    );

    expect(html).toContain('Tambah kolom premi baru');
    expect(html).toContain('Tambah kolom potongan kotor baru');
    expect(html).toContain('Tambah kolom potongan bersih baru');
  });
});
```

- [ ] **Step 2: Run the render test to verify it fails**

Run: `node .\node_modules\vitest\vitest.mjs run src/components/CustomPayrollTable.render.test.jsx`  
Workdir: `frontend`  
Expected: FAIL because the current component only renders add-column controls for potongan groups and still saves display labels instead of canonical labels.

- [ ] **Step 3: Update `CustomPayrollTable` to use canonical helper output for optimistic columns and saves**

```jsx
import {
  buildCanonicalManualAdjustmentName,
  buildPendingManualColumn
} from '../utils/payrollManualAdjustmentNames';

const handleAddColumn = (groupLabel) => {
  const rawName = window.prompt(`Masukkan nama kolom baru untuk ${groupLabel}:`);
  const firstEmp = displayRows.find((row) => row.type === 'employee');
  const pendingColumn = buildPendingManualColumn({
    groupLabel,
    rawName,
    division,
    firstEmployee: firstEmp
  });

  if (!pendingColumn) return;

  if (pendingColumn.activeFieldBucket === 'premi') {
    setActivePremiFields((prev) => [...new Set([...prev, pendingColumn.fieldName])]);
  } else {
    setActivePotFields((prev) => [...new Set([...prev, pendingColumn.fieldName])]);
  }

  setAddedColumns((prev) => [...prev, pendingColumn.payload]);
};

const canonicalCellName =
  dynamicHeaders.premi?.[field] ||
  dynamicHeaders.potongan?.[field] ||
  buildCanonicalManualAdjustmentName(groupLabel, displayLabel);

handleCellEdit(row, field, e.target.value, val, 'PREMI', canonicalCellName);
```

Also update the header button conditions so edit mode exposes:

```jsx
{isEditMode && cell.topHeader === PREMI && cell.label === 'TOTAL PREMI' && (
  <button
    title="Tambah kolom premi baru"
    onClick={(e) => {
      e.stopPropagation();
      handleAddColumn(PREMI);
    }}
  >
    +
  </button>
)}
```

and keep separate titles for the two potongan groups:

```jsx
title="Tambah kolom potongan kotor baru"
title="Tambah kolom potongan bersih baru"
```

- [ ] **Step 4: Run the targeted frontend tests**

Run: `node .\node_modules\vitest\vitest.mjs run src/utils/payrollManualAdjustmentNames.test.js src/components/CustomPayrollTable.render.test.jsx`  
Workdir: `frontend`  
Expected: PASS with the render test finding all three edit-mode add-column titles.

- [ ] **Step 5: Commit the table wiring**

```bash
git add frontend/src/components/CustomPayrollTable.jsx frontend/src/components/CustomPayrollTable.render.test.jsx
git commit -m "feat(payroll): add scoped dynamic manual column controls"
```

### Task 3: Lock Backend Canonical Normalization and Placeholder Retention

**Files:**
- Create: `backend/src/services/payroll/manualAdjustments/manualAdjustmentNaming.ts`
- Create: `backend/src/services/payroll/manualAdjustments/manualAdjustmentNaming.test.ts`
- Modify: `backend/src/services/manualAdjustmentService.ts`
- Test: `backend/src/services/payroll/manualAdjustments/manualAdjustmentNaming.test.ts`

- [ ] **Step 1: Write the failing backend naming/retention test**

```ts
import { describe, expect, it } from 'bun:test';
import {
  normalizeStoredAdjustmentName,
  toManualAdjustmentFieldName,
  shouldDeleteStoredAdjustment
} from './manualAdjustmentNaming';

describe('manualAdjustmentNaming', () => {
  it('normalizes stored names into stable field names without duplicate prefixes', () => {
    expect(normalizeStoredAdjustmentName(' PREMI   INSENTIF ')).toBe('PREMI INSENTIF');
    expect(toManualAdjustmentFieldName('PREMI', 'PREMI INSENTIF')).toBe('premi_insentif');
    expect(toManualAdjustmentFieldName('POTONGAN_KOTOR', 'KOREKSI DENDA PANEN')).toBe('koreksi_denda_panen');
    expect(toManualAdjustmentFieldName('POTONGAN_BERSIH', 'POTONGAN LAINNYA KASBON')).toBe('potongan_lainnya_kasbon');
  });

  it('retains zero-value placeholder rows with INIT_COLUMN remarks', () => {
    expect(shouldDeleteStoredAdjustment(0, 'INIT_COLUMN - Kolom ditambahkan tanpa nilai')).toBe(false);
    expect(shouldDeleteStoredAdjustment(0, 'Edited via UI')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the backend test to verify it fails**

Run: `bun test src/services/payroll/manualAdjustments/manualAdjustmentNaming.test.ts`  
Workdir: `backend`  
Expected: FAIL because the helper file does not exist yet.

- [ ] **Step 3: Implement the pure backend naming helper**

```ts
const PREFIX_PATTERN = {
  PREMI: /^PREMI\s+/i,
  POTONGAN_KOTOR: /^KOREKSI\s+/i,
  POTONGAN_BERSIH: /^POTONGAN\s+LAINNYA\s+/i
};

const FIELD_PREFIX = {
  PREMI: 'premi',
  POTONGAN_KOTOR: 'koreksi',
  POTONGAN_BERSIH: 'potongan_lainnya'
};

export function normalizeStoredAdjustmentName(name: string): string {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

export function toManualAdjustmentFieldName(adjustmentType: 'PREMI' | 'POTONGAN_KOTOR' | 'POTONGAN_BERSIH', adjustmentName: string): string {
  const normalized = normalizeStoredAdjustmentName(adjustmentName);
  const suffix = normalized
    .replace(PREFIX_PATTERN[adjustmentType], '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return `${FIELD_PREFIX[adjustmentType]}_${suffix}`;
}

export function shouldDeleteStoredAdjustment(amount: number, remarks?: string | null): boolean {
  const isInitColumn = String(remarks || '').includes('INIT_COLUMN');
  return Number(amount || 0) === 0 && !isInitColumn;
}
```

- [ ] **Step 4: Integrate the helper into `manualAdjustmentService`**

```ts
import {
  normalizeStoredAdjustmentName,
  shouldDeleteStoredAdjustment
} from './payroll/manualAdjustments/manualAdjustmentNaming';

public async getAdjustments(
  month: number,
  year: number,
  gangCode?: string,
  empCode?: string,
  divisionCode?: string
): Promise<ManualAdjustment[]> {
  let query = `
    SELECT * FROM dbo.payroll_manual_adjustments
    WHERE period_month = ? AND period_year = ?
  `;
  const params: any[] = [month, year];

  if (divisionCode) {
    query += ` AND division_code = ?`;
    params.push(divisionCode);
  }

  if (gangCode && gangCode !== 'ALL') {
    query += ` AND gang_code = ?`;
    params.push(gangCode);
  }
```

and normalize before exact-match lookup:

```ts
const normalizedName = normalizeStoredAdjustmentName(data.adjustment_name);
const parsedAmount = parseFloat(data.amount.toString()) || 0;
```

and replace the zero-delete branch:

```ts
if (existing) {
  if (shouldDeleteStoredAdjustment(parsedAmount, data.remarks)) {
    await db.query(`DELETE FROM dbo.payroll_manual_adjustments WHERE id = ?`, [existing.id]);
    return existing.id;
  }
```

- [ ] **Step 5: Run the backend naming test and commit**

Run: `bun test src/services/payroll/manualAdjustments/manualAdjustmentNaming.test.ts`  
Workdir: `backend`  
Expected: PASS with stable field-name and retention assertions.

```bash
git add backend/src/services/payroll/manualAdjustments/manualAdjustmentNaming.ts backend/src/services/payroll/manualAdjustments/manualAdjustmentNaming.test.ts backend/src/services/manualAdjustmentService.ts
git commit -m "refactor(payroll): normalize stored manual adjustment names"
```

### Task 4: Apply Normalized Manual Adjustments in the Extractor and Lock Total Effects

**Files:**
- Create: `backend/src/services/payroll/manualAdjustments/manualAdjustmentApplier.ts`
- Create: `backend/src/services/payroll/manualAdjustments/manualAdjustmentApplier.test.ts`
- Modify: `backend/src/services/dataExtractorService.ts`
- Modify: `backend/src/services/payroll/components/PayrollCalculator.test.ts`
- Test: `backend/src/services/payroll/manualAdjustments/manualAdjustmentApplier.test.ts`
- Test: `backend/src/services/payroll/components/PayrollCalculator.test.ts`

- [ ] **Step 1: Write the failing applier test**

```ts
import { describe, expect, it } from 'bun:test';
import { applyManualAdjustmentsToEmployee } from './manualAdjustmentApplier';

describe('applyManualAdjustmentsToEmployee', () => {
  it('maps prefixed stored names into normalized fields and totals', () => {
    const result = applyManualAdjustmentsToEmployee({
      adjustments: [
        { adjustment_type: 'PREMI', adjustment_name: 'PREMI INSENTIF', amount: 25000 },
        { adjustment_type: 'POTONGAN_KOTOR', adjustment_name: 'KOREKSI DENDA PANEN', amount: 10000 },
        { adjustment_type: 'POTONGAN_BERSIH', adjustment_name: 'POTONGAN LAINNYA KASBON', amount: 5000 }
      ],
      empPremi: {},
      empPotongan: {},
      premiTitleMap: {},
      potonganTitleMap: {}
    });

    expect(result.empPremi.premi_insentif).toBe(25000);
    expect(result.koreksiVariations.koreksi_denda_panen).toBe(10000);
    expect(result.empPotongan.potongan_lainnya_kasbon).toBe(5000);
    expect(result.totalPremiDelta).toBe(25000);
    expect(result.potKoreksiDelta).toBe(10000);
    expect(result.otherPotonganDelta).toBe(5000);
  });
});
```

- [ ] **Step 2: Run the backend applier test to verify it fails**

Run: `bun test src/services/payroll/manualAdjustments/manualAdjustmentApplier.test.ts`  
Workdir: `backend`  
Expected: FAIL because the helper file does not exist yet.

- [ ] **Step 3: Implement the pure applier helper**

```ts
import { toManualAdjustmentFieldName } from './manualAdjustmentNaming';

export function applyManualAdjustmentsToEmployee({
  adjustments,
  empPremi,
  empPotongan,
  premiTitleMap,
  potonganTitleMap
}) {
  const koreksiVariations: Record<string, number> = {};
  let totalPremiDelta = 0;
  let potKoreksiDelta = 0;
  let otherPotonganDelta = 0;

  for (const adjustment of adjustments) {
    if (adjustment.adjustment_type === 'PREMI') {
      const fieldName = toManualAdjustmentFieldName('PREMI', adjustment.adjustment_name);
      empPremi[fieldName] = (empPremi[fieldName] || 0) + Number(adjustment.amount || 0);
      premiTitleMap[fieldName] = adjustment.adjustment_name;
      totalPremiDelta += Number(adjustment.amount || 0);
      continue;
    }

    if (adjustment.adjustment_type === 'POTONGAN_KOTOR') {
      const fieldName = toManualAdjustmentFieldName('POTONGAN_KOTOR', adjustment.adjustment_name);
      const amount = Number(adjustment.amount || 0);
      empPotongan[fieldName] = (empPotongan[fieldName] || 0) + amount;
      koreksiVariations[fieldName] = (koreksiVariations[fieldName] || 0) + amount;
      potonganTitleMap[fieldName] = adjustment.adjustment_name;
      potKoreksiDelta += amount;
      continue;
    }

    if (adjustment.adjustment_type === 'POTONGAN_BERSIH') {
      const fieldName = toManualAdjustmentFieldName('POTONGAN_BERSIH', adjustment.adjustment_name);
      const amount = Number(adjustment.amount || 0);
      empPotongan[fieldName] = (empPotongan[fieldName] || 0) + amount;
      potonganTitleMap[fieldName] = adjustment.adjustment_name;
      otherPotonganDelta += amount;
    }
  }

  return { empPremi, empPotongan, koreksiVariations, totalPremiDelta, potKoreksiDelta, otherPotonganDelta };
}
```

- [ ] **Step 4: Replace inline manual-adjustment loops in `dataExtractorService` and add calculator regression coverage**

In `dataExtractorService.ts`, replace:

```ts
const empAdjustments = manualAdjustments ? manualAdjustments.filter(...) : [];
// existing inline loops for PREMI / POTONGAN_KOTOR / POTONGAN_BERSIH
```

with:

```ts
const empAdjustments = manualAdjustments.filter((adjustment) =>
  String(adjustment.emp_code).trim() === String(emp.emp_code).trim()
);

const manualApplied = applyManualAdjustmentsToEmployee({
  adjustments: empAdjustments,
  empPremi,
  empPotongan,
  premiTitleMap,
  potonganTitleMap
});

Object.assign(koreksiVariations, manualApplied.koreksiVariations);
total_premi += manualApplied.totalPremiDelta;
pot_koreksi += manualApplied.potKoreksiDelta;
other_potongan += manualApplied.otherPotonganDelta;
```

and change the adjustment query to pass division scope:

```ts
safeQuery('getManualAdj', () => manualAdjustmentService.getAdjustments(month, year, gangCode || undefined, undefined, divisionCode), [])
```

Then extend `PayrollCalculator.test.ts` with explicit delta assertions:

```ts
test('Manual kategori deltas: premi naik, koreksi turun, potongan bersih turun', () => {
  const manual = PayrollCalculator.calculate({
    ...base,
    total_premi: base.total_premi + 25_000,
    pot_koreksi: base.pot_koreksi + 10_000,
    other_potongan: base.other_potongan + 5_000
  }, 'K/1', 2025);

  return assert('premi delta', manual.upah_kotor, baseCalc.upah_kotor + 25_000) &&
    assert('koreksi delta', manual.jumlah_upah_kotor, baseCalc.jumlah_upah_kotor + 25_000 - 10_000) &&
    assert('potongan bersih delta', manual.upah_bersih, baseCalc.upah_bersih + 25_000 - 10_000 - 5_000);
});
```

- [ ] **Step 5: Run the backend tests and commit**

Run: `bun test src/services/payroll/manualAdjustments/manualAdjustmentApplier.test.ts src/services/payroll/components/PayrollCalculator.test.ts`  
Workdir: `backend`  
Expected: PASS with normalized-field assertions and the new manual-delta regression green.

```bash
git add backend/src/services/payroll/manualAdjustments/manualAdjustmentApplier.ts backend/src/services/payroll/manualAdjustments/manualAdjustmentApplier.test.ts backend/src/services/dataExtractorService.ts backend/src/services/payroll/components/PayrollCalculator.test.ts
git commit -m "feat(payroll): apply scoped manual dynamic adjustments"
```

## Final Verification

- Run: `node .\node_modules\vitest\vitest.mjs run src/utils/payrollManualAdjustmentNames.test.js src/components/CustomPayrollTable.render.test.jsx`
  - Workdir: `frontend`
  - Expected: PASS
- Run: `bun test src/services/payroll/manualAdjustments/manualAdjustmentNaming.test.ts src/services/payroll/manualAdjustments/manualAdjustmentApplier.test.ts src/services/payroll/components/PayrollCalculator.test.ts`
  - Workdir: `backend`
  - Expected: PASS
- Run: `git status --short`
  - Workdir: repo root
  - Expected: only the intended implementation files remain modified

## Spec Coverage Check

- Canonical prefixed storage names: covered by Task 1 and Task 3
- Add-column UI for all three groups: covered by Task 2
- Empty placeholder persistence: covered by Task 3
- Scope filtering by division and gang: covered by Task 3 and Task 4
- Extractor normalization without duplicate prefixes: covered by Task 3 and Task 4
- Correct payroll total effects: covered by Task 4

