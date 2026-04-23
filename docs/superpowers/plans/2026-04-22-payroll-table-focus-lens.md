# Payroll Table Focus Lens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework Daftar Upah table UX so every group except `PAJAK` stays open, group hierarchy is semantically correct, a dynamic horizontal chapter bar appears during scroll, and focus styling makes the active group and selected row immediately readable.

**Architecture:** Keep all behavior inside the existing payroll register frontend. Split the work into three bounded layers: semantic column metadata, visual state/view controls, and dynamic scroll-chapter behavior. Reuse the current table rendering pipeline instead of replacing the table engine.

**Tech Stack:** React, Vite, Vitest, existing `CustomPayrollTable` rendering logic, existing payroll header group utilities and CSS-driven styling

---

## File Structure

**Create**
- `frontend/src/utils/payrollViewportChapters.js`
  - Build chapter segments from `columnDefs`, detect active group from horizontal viewport, and expose scroll-to-group helpers.
- `frontend/src/utils/payrollViewportChapters.test.js`
  - Unit tests for segment building and active chapter detection.
- `frontend/src/components/PayrollScrollChapterBar.jsx`
  - Dynamic chapter bar shown only during horizontal scrolling.
- `frontend/src/components/PayrollViewModeToolbar.jsx`
  - Compact toolbar for `Simple`/`Detail` mode and `Focus Lens` toggle.

**Modify**
- `frontend/src/components/CustomPayrollTable.jsx`
  - Remove collapse behavior for every group except `PAJAK`, fix `POTONGAN UPAH BERSIH` header hierarchy, wire toolbar state, wire chapter bar state, and update selected-row behavior.
- `frontend/src/utils/payrollHeaderGroups.js`
  - Extend group metadata with chapter ordering and group display semantics.
- `frontend/src/utils/payrollHeaderGroups.test.js`
  - Lock canonical labels and toggleable-group behavior to `PAJAK` only.
- `frontend/src/services/tablePreferencesService.js`
  - Add focus-lens/display-mode defaults only if preferences are used for persistence.
- `frontend/src/styles/CustomPayrollTable.css`
  - Add soft group tint refinements, selected-row styling, chapter bar animation, and focus-lens states.

## Constraints

- `PAJAK` is the only collapsible top-level group.
- All other top-level groups must render fully expanded in both `Simple` and `Detail`.
- Horizontal scrolling must never auto-hide or auto-remove columns.
- Chapter bar appears only during active horizontal scroll interaction and fades when idle.
- Focus Lens must adjust emphasis only; it must not hide data.
- The current worktree is dirty. Do not revert or stage unrelated files while executing this plan.

### Task 1: Lock Semantic Group Rules and Open-State Defaults

**Files:**
- Modify: `frontend/src/utils/payrollHeaderGroups.js`
- Modify: `frontend/src/utils/payrollHeaderGroups.test.js`
- Test: `frontend/src/utils/payrollHeaderGroups.test.js`

- [ ] **Step 1: Write the failing test for `PAJAK`-only toggle behavior**

```js
import { describe, expect, it } from 'vitest';
import {
  PAYROLL_HEADER_GROUPS,
  isPayrollGroupToggleable
} from './payrollHeaderGroups';

describe('isPayrollGroupToggleable', () => {
  it('keeps only PAJAK toggleable', () => {
    expect(isPayrollGroupToggleable(PAYROLL_HEADER_GROUPS.PAJAK)).toBe(true);
    expect(isPayrollGroupToggleable(PAYROLL_HEADER_GROUPS.ABSENSI)).toBe(false);
    expect(isPayrollGroupToggleable(PAYROLL_HEADER_GROUPS.PREMI)).toBe(false);
    expect(isPayrollGroupToggleable(PAYROLL_HEADER_GROUPS.POTONGAN_UPAH_BERSIH)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node .\node_modules\vitest\vitest.mjs run src/utils/payrollHeaderGroups.test.js`  
Expected: FAIL because the current utility still marks non-tax groups as toggleable.

- [ ] **Step 3: Update header-group metadata to encode `PAJAK` as the only toggleable group**

```js
export const TOGGLEABLE_GROUPS = new Set([
  PAYROLL_HEADER_GROUPS.PAJAK
]);

export const DISPLAY_MODE_GROUPS = [
  PAYROLL_HEADER_GROUPS.IDENTITAS,
  PAYROLL_HEADER_GROUPS.PAJAK,
  PAYROLL_HEADER_GROUPS.ABSENSI,
  PAYROLL_HEADER_GROUPS.PANEN,
  PAYROLL_HEADER_GROUPS.PENGGAJIAN,
  PAYROLL_HEADER_GROUPS.TUNJANGAN,
  PAYROLL_HEADER_GROUPS.PREMI,
  PAYROLL_HEADER_GROUPS.PENDAPATAN_LAINNYA,
  PAYROLL_HEADER_GROUPS.POTONGAN_UPAH_KOTOR,
  PAYROLL_HEADER_GROUPS.UPAH_KOTOR,
  PAYROLL_HEADER_GROUPS.POTONGAN_UPAH_BERSIH,
  PAYROLL_HEADER_GROUPS.UPAH_BERSIH
];

export const isPayrollGroupToggleable = (label) => {
  const group = normalizePayrollHeaderGroup(label);
  return group ? TOGGLEABLE_GROUPS.has(group) : false;
};
```

- [ ] **Step 4: Rerun the test**

Run: `node .\node_modules\vitest\vitest.mjs run src/utils/payrollHeaderGroups.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/payrollHeaderGroups.js frontend/src/utils/payrollHeaderGroups.test.js
git commit -m "refactor(payroll-table): lock tax as the only collapsible group"
```

### Task 2: Fix Open Header Hierarchy and Selected Row Contrast

**Files:**
- Modify: `frontend/src/components/CustomPayrollTable.jsx`
- Modify: `frontend/src/styles/CustomPayrollTable.css`
- Test: `frontend/src/utils/payrollHeaderGroups.test.js`

- [ ] **Step 1: Write the failing test for `POTONGAN UPAH BERSIH` header aliases**

```js
import { describe, expect, it } from 'vitest';
import {
  PAYROLL_HEADER_GROUPS,
  getPayrollHeaderGroup
} from './payrollHeaderGroups';

describe('getPayrollHeaderGroup', () => {
  it('maps potongan bersih labels to the canonical top-level group', () => {
    expect(getPayrollHeaderGroup('POTONGAN UPAH BERSIH')).toBe(PAYROLL_HEADER_GROUPS.POTONGAN_UPAH_BERSIH);
    expect(getPayrollHeaderGroup('POT BERSIH')).toBe(PAYROLL_HEADER_GROUPS.POTONGAN_UPAH_BERSIH);
  });
});
```

- [ ] **Step 2: Run the test to verify baseline behavior before JSX changes**

Run: `node .\node_modules\vitest\vitest.mjs run src/utils/payrollHeaderGroups.test.js`  
Expected: PASS, confirming the canonical group name is stable before changing JSX.

- [ ] **Step 3: Update `CustomPayrollTable.jsx` so non-tax groups default open and `POTONGAN UPAH BERSIH` renders with `CARUMAN > ASTEK/BPJS > PEK./MAJ.`**

```jsx
const [isTaxExpanded, setIsTaxExpanded] = useState(false);

const showHarvestDetails = true;
const showPayrollDetails = true;
const showAllowanceRates = true;
const showPremiDetails = true;
const showOtherIncomeDetails = true;
const showDeductionDetails = true;

cols.push({
  field: 'pot_astek',
  headers: [POTONGAN_UPAH_BERSIH, 'CARUMAN', 'ASTEK', 'PEK.'],
  w: 75,
  className: 'text-right'
});
cols.push({
  field: 'pot_astek_maj',
  headers: [POTONGAN_UPAH_BERSIH, 'CARUMAN', 'ASTEK', 'MAJ.'],
  w: 75,
  className: 'text-right'
});
cols.push({
  field: 'pot_bpjs_kesehatan_pekerja',
  headers: [POTONGAN_UPAH_BERSIH, 'CARUMAN', 'BPJS KES', 'PEK.'],
  w: 75,
  className: 'text-right'
});
```

- [ ] **Step 4: Update selected-row styling so it beats group tint**

```css
.payroll-table tbody tr.row-highlighted td {
  background-color: #334155 !important;
  color: #f8fafc !important;
}

.payroll-table tbody tr.row-highlighted .sticky-col {
  background-color: #334155 !important;
  color: #f8fafc !important;
}

.payroll-table tbody tr.row-highlighted td .text-right,
.payroll-table tbody tr.row-highlighted td .text-center,
.payroll-table tbody tr.row-highlighted td .text-left {
  color: inherit !important;
}
```

- [ ] **Step 5: Run the frontend build**

Run: `npm run build`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/CustomPayrollTable.jsx frontend/src/styles/CustomPayrollTable.css
git commit -m "fix(payroll-table): restore open hierarchy and readable selected rows"
```

### Task 3: Add Display Mode and Focus Lens Controls

**Files:**
- Create: `frontend/src/components/PayrollViewModeToolbar.jsx`
- Modify: `frontend/src/components/CustomPayrollTable.jsx`
- Modify: `frontend/src/styles/CustomPayrollTable.css`

- [ ] **Step 1: Write a failing test for view-mode state defaults**

```js
import { describe, expect, it } from 'vitest';
import { resolvePayrollDisplayModeState } from './payrollViewportChapters';

describe('resolvePayrollDisplayModeState', () => {
  it('defaults to simple mode with focus lens off', () => {
    expect(resolvePayrollDisplayModeState()).toEqual({
      mode: 'simple',
      focusLens: false
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node .\node_modules\vitest\vitest.mjs run src/utils/payrollViewportChapters.test.js`  
Expected: FAIL because the helper does not exist yet.

- [ ] **Step 3: Implement toolbar component and mode state**

```jsx
export default function PayrollViewModeToolbar({ mode, focusLens, onModeChange, onFocusLensChange }) {
  return (
    <div className="payroll-view-toolbar">
      <button className={mode === 'simple' ? 'is-active' : ''} onClick={() => onModeChange('simple')}>
        Simple
      </button>
      <button className={mode === 'detail' ? 'is-active' : ''} onClick={() => onModeChange('detail')}>
        Detail
      </button>
      <label className="focus-lens-toggle">
        <input type="checkbox" checked={focusLens} onChange={(e) => onFocusLensChange(e.target.checked)} />
        <span>Focus Lens</span>
      </label>
    </div>
  );
}
```

- [ ] **Step 4: Wire the toolbar into `CustomPayrollTable.jsx` and map mode to CSS classes**

```jsx
const [displayMode, setDisplayMode] = useState('simple');
const [focusLensEnabled, setFocusLensEnabled] = useState(false);

<div className={`payroll-table-shell mode-${displayMode} ${focusLensEnabled ? 'focus-lens-on' : 'focus-lens-off'}`}>
  <PayrollViewModeToolbar
    mode={displayMode}
    focusLens={focusLensEnabled}
    onModeChange={setDisplayMode}
    onFocusLensChange={setFocusLensEnabled}
  />
  <div className="payroll-table-container">...</div>
</div>
```

- [ ] **Step 5: Rerun the new test and build**

Run: `node .\node_modules\vitest\vitest.mjs run src/utils/payrollViewportChapters.test.js`  
Expected: PASS.

Run: `npm run build`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/PayrollViewModeToolbar.jsx frontend/src/components/CustomPayrollTable.jsx frontend/src/styles/CustomPayrollTable.css frontend/src/utils/payrollViewportChapters.js frontend/src/utils/payrollViewportChapters.test.js
git commit -m "feat(payroll-table): add display modes and focus lens"
```

### Task 4: Add Dynamic Horizontal Scroll Chapter Bar

**Files:**
- Create: `frontend/src/components/PayrollScrollChapterBar.jsx`
- Create: `frontend/src/utils/payrollViewportChapters.js`
- Create: `frontend/src/utils/payrollViewportChapters.test.js`
- Modify: `frontend/src/components/CustomPayrollTable.jsx`
- Modify: `frontend/src/styles/CustomPayrollTable.css`

- [ ] **Step 1: Write the failing chapter-segment test**

```js
import { describe, expect, it } from 'vitest';
import { buildPayrollViewportChapters, detectActivePayrollChapter } from './payrollViewportChapters';

describe('buildPayrollViewportChapters', () => {
  it('aggregates contiguous columns by top-level group', () => {
    const chapters = buildPayrollViewportChapters([
      { field: 'nik', w: 55, headers: ['IDENTITAS', null, 'NIK'] },
      { field: 'nama', w: 160, headers: ['IDENTITAS', null, 'NAMA'] },
      { field: 'premi_brondol', w: 80, headers: ['PREMI', null, 'BRONDOL'] }
    ]);

    expect(chapters).toEqual([
      { group: 'IDENTITAS', start: 0, width: 215 },
      { group: 'PREMI', start: 215, width: 80 }
    ]);
  });
});

describe('detectActivePayrollChapter', () => {
  it('chooses the chapter occupying the viewport midpoint', () => {
    const active = detectActivePayrollChapter(
      [
        { group: 'IDENTITAS', start: 0, width: 200 },
        { group: 'PREMI', start: 200, width: 300 }
      ],
      { scrollLeft: 180, clientWidth: 240 }
    );

    expect(active).toBe('PREMI');
  });
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run: `node .\node_modules\vitest\vitest.mjs run src/utils/payrollViewportChapters.test.js`  
Expected: FAIL because the utility does not exist yet.

- [ ] **Step 3: Implement chapter utilities**

```js
import { getPayrollHeaderGroup } from './payrollHeaderGroups';

export const buildPayrollViewportChapters = (columnDefs) => {
  const chapters = [];
  let offset = 0;

  for (const col of columnDefs) {
    const group = getPayrollHeaderGroup(col.headers?.[0]);
    if (!group) {
      offset += col.w || 0;
      continue;
    }

    const last = chapters[chapters.length - 1];
    if (last && last.group === group) {
      last.width += col.w || 0;
    } else {
      chapters.push({ group, start: offset, width: col.w || 0 });
    }
    offset += col.w || 0;
  }

  return chapters;
};

export const detectActivePayrollChapter = (chapters, viewport) => {
  const midpoint = viewport.scrollLeft + (viewport.clientWidth / 2);
  const match = chapters.find((chapter) => midpoint >= chapter.start && midpoint < chapter.start + chapter.width);
  return match?.group || null;
};
```

- [ ] **Step 4: Implement dynamic chapter bar component**

```jsx
export default function PayrollScrollChapterBar({ chapters, activeGroup, isVisible, onJumpToGroup }) {
  if (!chapters.length) return null;

  const totalWidth = chapters.reduce((sum, chapter) => sum + chapter.width, 0);

  return (
    <div className={`payroll-scroll-chapter-bar ${isVisible ? 'is-visible' : 'is-hidden'}`}>
      {chapters.map((chapter) => (
        <button
          key={chapter.group}
          className={chapter.group === activeGroup ? 'is-active' : ''}
          style={{ flexGrow: chapter.width / totalWidth }}
          onClick={() => onJumpToGroup(chapter.group)}
        >
          {chapter.group}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Wire horizontal scroll listeners and idle hide behavior into `CustomPayrollTable.jsx`**

```jsx
const [isChapterBarVisible, setChapterBarVisible] = useState(false);
const [activeChapterGroup, setActiveChapterGroup] = useState(null);
const hideTimerRef = useRef(null);

useEffect(() => {
  const container = tableRef.current?.closest('.payroll-table-container');
  if (!container) return;

  const chapters = buildPayrollViewportChapters(columnDefs);

  const onScroll = () => {
    setChapterBarVisible(true);
    setActiveChapterGroup(
      detectActivePayrollChapter(chapters, {
        scrollLeft: container.scrollLeft,
        clientWidth: container.clientWidth
      })
    );

    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setChapterBarVisible(false), 900);
  };

  container.addEventListener('scroll', onScroll, { passive: true });
  return () => {
    container.removeEventListener('scroll', onScroll);
    clearTimeout(hideTimerRef.current);
  };
}, [columnDefs]);
```

- [ ] **Step 6: Run tests and build**

Run: `node .\node_modules\vitest\vitest.mjs run src/utils/payrollViewportChapters.test.js src/utils/payrollHeaderGroups.test.js`  
Expected: PASS.

Run: `npm run build`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/PayrollScrollChapterBar.jsx frontend/src/components/CustomPayrollTable.jsx frontend/src/styles/CustomPayrollTable.css frontend/src/utils/payrollViewportChapters.js frontend/src/utils/payrollViewportChapters.test.js
git commit -m "feat(payroll-table): add dynamic horizontal chapter focus"
```

### Task 5: Add Soft Group Emphasis and Manual QA Hooks

**Files:**
- Modify: `frontend/src/styles/CustomPayrollTable.css`
- Modify: `frontend/src/services/tablePreferencesService.js`

- [ ] **Step 1: Refine soft color tokens for fast group scanning**

```js
export const DEFAULT_CELL_COLORS = {
  IDENTITAS: { bg: '#F8FAFC', text: '#334155', border: '#CBD5E1' },
  PAJAK: { bg: '#FAFAF9', text: '#44403C', border: '#D6D3D1' },
  ABSENSI: { bg: '#F0FDF4', text: '#166534', border: '#86EFAC' },
  PANEN: { bg: '#FEFCE8', text: '#A16207', border: '#FDE047' },
  PENGGAJIAN: { bg: '#F0F9FF', text: '#075985', border: '#7DD3FC' },
  TUNJANGAN: { bg: '#FFF7ED', text: '#C2410C', border: '#FDBA74' },
  PREMI: { bg: '#FFFBEB', text: '#B45309', border: '#FCD34D' },
  'PENDAPATAN LAINNYA': { bg: '#ECFDF5', text: '#047857', border: '#6EE7B7' },
  'POTONGAN UPAH KOTOR': { bg: '#FEF2F2', text: '#B91C1C', border: '#FCA5A5' },
  'UPAH KOTOR': { bg: '#EEF2FF', text: '#4338CA', border: '#A5B4FC' },
  'POTONGAN UPAH BERSIH': { bg: '#FDF2F8', text: '#BE185D', border: '#F9A8D4' },
  'UPAH BERSIH': { bg: '#F0FDFA', text: '#0F766E', border: '#5EEAD4' }
};
```

- [ ] **Step 2: Add CSS classes for focus-lens-on/off and chapter emphasis**

```css
.focus-lens-on .payroll-table thead th[data-active-group="false"] {
  opacity: 0.72;
}

.focus-lens-on .payroll-table tbody td[data-active-group="false"] {
  filter: saturate(0.82) brightness(0.99);
}

.payroll-scroll-chapter-bar.is-visible {
  opacity: 1;
  transform: translateY(0);
}

.payroll-scroll-chapter-bar.is-hidden {
  opacity: 0;
  transform: translateY(-8px);
  pointer-events: none;
}
```

- [ ] **Step 3: Run the build**

Run: `npm run build`  
Expected: PASS.

- [ ] **Step 4: Manual QA**

Run the app and verify:

- all non-tax groups are open without clicking
- `POTONGAN UPAH BERSIH` shows `CARUMAN > ASTEK/BPJS > PEK./MAJ.`
- selected row becomes dark slate with readable text
- chapter bar appears only during horizontal scroll
- chapter active state follows the viewport midpoint
- clicking a chapter jumps the horizontal scroll to the correct group
- `Simple` and `Detail` both keep the same data visible, only the emphasis changes
- `Focus Lens` changes emphasis only, not visibility

- [ ] **Step 5: Commit**

```bash
git add frontend/src/styles/CustomPayrollTable.css frontend/src/services/tablePreferencesService.js
git commit -m "style(payroll-table): add soft focus lens and chapter emphasis"
```

## Self-Review

- Spec coverage:
  - open semantic grid: Task 1 and Task 2
  - `POTONGAN UPAH BERSIH` hierarchy fix: Task 2
  - selected-row visibility: Task 2
  - `Simple`/`Detail` + `Focus Lens`: Task 3
  - dynamic chapter bar on horizontal scroll: Task 4
  - soft color differentiation: Task 5
- Placeholder scan:
  - No `TODO`, `TBD`, or cross-task “same as above” references remain.
- Type consistency:
  - Shared names stay consistent across tasks: `POTONGAN_UPAH_BERSIH`, `buildPayrollViewportChapters`, `detectActivePayrollChapter`, `displayMode`, `focusLensEnabled`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-22-payroll-table-focus-lens.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
