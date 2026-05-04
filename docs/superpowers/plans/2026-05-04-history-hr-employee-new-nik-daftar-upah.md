# history_hr_employee new_nik Daftar Upah Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show effective NIK in Daftar Upah from existing `history_hr_employee.new_nik`, falling back to old `nik` and then `emp_code`, with full-value toggle and audit fields preserved.

**Architecture:** Add a focused backend NIK identity utility that owns `new_nik || nik || emp_code` resolution and the latest-history NIK query. Wire `dataExtractorService` to use that utility so row payloads expose `nik`, `new_nik`, `nik_display`, `nik_source`, and `has_nik_change`. Add a frontend `NIK` identity column that renders `nik_display` with ellipsis/full toggle and align Excel export to the effective NIK value.

**Tech Stack:** TypeScript backend, Bun tests, React/Vite frontend, Vitest, existing SQL Server `Database` client, existing Daftar Upah table/export modules.

---

## File Structure

**Create**

- `backend/src/utils/payrollNikIdentity.ts`
  - Pure helpers for cleaning NIK strings, resolving effective display NIK, applying `history_hr_employee` rows to employee objects, and building the latest-history NIK query.
- `backend/src/utils/payrollNikIdentity.test.ts`
  - Bun unit tests for `new_nik` priority, fallback behavior, change detection, and query shape.

**Modify**

- `backend/src/services/dataExtractorService.ts`
  - Import backend NIK identity helpers.
  - Replace the current `SELECT RTRIM(nik) as nik` history lookup with `nik` + `new_nik` lookup.
  - Build payroll rows with separate audit and display fields.
- `frontend/src/components/CustomPayrollTable.jsx`
  - Add per-row NIK expansion state.
  - Add a `nik_display` column under `IDENTITAS`.
  - Render NIK cells with ellipsis, `Full`/`Hide`, and changed-NIK tooltip.
- `frontend/src/components/CustomPayrollTable.render.test.jsx`
  - Add render tests for the new visible NIK column and collapsed full-value affordance.
- `frontend/src/utils/payrollHeaderLayout.js`
  - Allow `nik_display` as a sortable identity field.
- `frontend/src/utils/exportPayrollToExcel.js`
  - Export the complete effective NIK, not UI ellipsis.
  - Include `nik_display` in summary/print export field allow-lists.
- `frontend/src/utils/exportPayrollToExcel.test.js`
  - Add tests for effective NIK export value and summary/print column selection.

## Task 1: Backend NIK Identity Utility

**Files:**
- Create: `backend/src/utils/payrollNikIdentity.ts`
- Create: `backend/src/utils/payrollNikIdentity.test.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/utils/payrollNikIdentity.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import {
    applyHistoryNikSourcesToEmployees,
    buildLatestHistoryNikQuery,
    resolvePayrollNikIdentity
} from "./payrollNikIdentity";

describe("payroll NIK identity resolution", () => {
    it("uses new_nik as display while keeping old nik for audit", () => {
        expect(resolvePayrollNikIdentity({
            emp_code: "B0745",
            nik: "1902050504860001",
            new_nik: "1902051212790002"
        })).toEqual({
            nik: "1902050504860001",
            new_nik: "1902051212790002",
            nik_display: "1902051212790002",
            nik_source: "new_nik",
            has_nik_change: true
        });
    });

    it("falls back to old nik, actual_nik, then emp_code", () => {
        expect(resolvePayrollNikIdentity({
            emp_code: "B0745",
            nik: "1902050504860001",
            new_nik: ""
        }).nik_display).toBe("1902050504860001");

        expect(resolvePayrollNikIdentity({
            emp_code: "B0745",
            actual_nik: "3171000000000001"
        })).toMatchObject({
            nik: "3171000000000001",
            new_nik: "",
            nik_display: "3171000000000001",
            nik_source: "actual_nik",
            has_nik_change: false
        });

        expect(resolvePayrollNikIdentity({
            emp_code: "B0745"
        })).toMatchObject({
            nik: "",
            new_nik: "",
            nik_display: "B0745",
            nik_source: "emp_code_fallback",
            has_nik_change: false
        });
    });

    it("does not flag nik change when values are equal after trimming", () => {
        expect(resolvePayrollNikIdentity({
            emp_code: "B0745",
            nik: " 1902051212790002 ",
            new_nik: "1902051212790002"
        })).toMatchObject({
            nik: "1902051212790002",
            new_nik: "1902051212790002",
            nik_display: "1902051212790002",
            nik_source: "new_nik",
            has_nik_change: false
        });
    });

    it("applies latest history NIK rows to employee objects", () => {
        const employees: any[] = [
            { emp_code: "B0745", actual_nik: "OLDLIVE", emp_name: "Siti" },
            { emp_code: "C0533", actual_nik: "LIVEONLY", emp_name: "Budi" }
        ];

        const applied = applyHistoryNikSourcesToEmployees(employees, [
            { emp_code: "B0745", nik: "1902050504860001", new_nik: "1902051212790002" }
        ]);

        expect(applied).toBe(1);
        expect(employees[0]).toMatchObject({
            nik: "1902050504860001",
            new_nik: "1902051212790002",
            nik_display: "1902051212790002",
            nik_source: "new_nik",
            has_nik_change: true,
            actual_nik: "1902051212790002"
        });
        expect(employees[1]).toMatchObject({
            nik: "LIVEONLY",
            new_nik: "",
            nik_display: "LIVEONLY",
            nik_source: "actual_nik",
            has_nik_change: false,
            actual_nik: "LIVEONLY"
        });
    });

    it("builds a deterministic latest history query that selects new_nik", () => {
        const sql = buildLatestHistoryNikQuery("'B0745','C0533'");

        expect(sql).toContain("new_nik");
        expect(sql).toContain("ROW_NUMBER()");
        expect(sql).toContain("PARTITION BY RTRIM(emp_code)");
        expect(sql).toContain("period_month = ? AND period_year = ?");
        expect(sql).toContain("ORDER BY");
        expect(sql).toContain("id DESC");
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd backend
bun test src/utils/payrollNikIdentity.test.ts
```

Expected: FAIL because `payrollNikIdentity.ts` does not exist.

- [ ] **Step 3: Add the utility implementation**

Create `backend/src/utils/payrollNikIdentity.ts`:

```ts
export type PayrollNikSource = "new_nik" | "nik" | "actual_nik" | "emp_code_fallback";

export interface PayrollNikSourceRow {
    emp_code?: unknown;
    nik?: unknown;
    new_nik?: unknown;
    actual_nik?: unknown;
}

export interface PayrollNikIdentity {
    nik: string;
    new_nik: string;
    nik_display: string;
    nik_source: PayrollNikSource;
    has_nik_change: boolean;
}

function cleanIdentityValue(value: unknown): string {
    return String(value ?? "").trim();
}

export function resolvePayrollNikIdentity(source: PayrollNikSourceRow): PayrollNikIdentity {
    const empCode = cleanIdentityValue(source.emp_code).toUpperCase();
    const oldNik = cleanIdentityValue(source.nik);
    const newNik = cleanIdentityValue(source.new_nik);
    const actualNik = cleanIdentityValue(source.actual_nik);

    let nikDisplay = "";
    let nikSource: PayrollNikSource = "emp_code_fallback";

    if (newNik) {
        nikDisplay = newNik;
        nikSource = "new_nik";
    } else if (oldNik) {
        nikDisplay = oldNik;
        nikSource = "nik";
    } else if (actualNik) {
        nikDisplay = actualNik;
        nikSource = "actual_nik";
    } else {
        nikDisplay = empCode;
    }

    const auditNik = oldNik || (nikSource === "actual_nik" ? actualNik : "");
    const hasNikChange = Boolean(auditNik && newNik && auditNik !== newNik);

    return {
        nik: auditNik,
        new_nik: newNik,
        nik_display: nikDisplay,
        nik_source: nikSource,
        has_nik_change: hasNikChange
    };
}

export function applyHistoryNikSourcesToEmployees(
    employees: Array<Record<string, any>>,
    historyRows: PayrollNikSourceRow[] = []
): number {
    const historyByEmpCode = new Map<string, PayrollNikSourceRow>();

    for (const row of historyRows || []) {
        const empCode = cleanIdentityValue(row.emp_code).toUpperCase();
        if (!empCode || historyByEmpCode.has(empCode)) continue;
        historyByEmpCode.set(empCode, row);
    }

    let historyApplied = 0;

    for (const emp of employees || []) {
        const empCode = cleanIdentityValue(emp.emp_code).toUpperCase();
        const history = historyByEmpCode.get(empCode);
        const identity = resolvePayrollNikIdentity({
            emp_code: empCode,
            nik: history?.nik ?? emp.nik,
            new_nik: history?.new_nik ?? emp.new_nik,
            actual_nik: emp.actual_nik
        });

        emp.nik = identity.nik;
        emp.new_nik = identity.new_nik;
        emp.nik_display = identity.nik_display;
        emp.nik_source = identity.nik_source;
        emp.has_nik_change = identity.has_nik_change;
        emp.actual_nik = identity.nik_display;

        if (history) historyApplied++;
    }

    return historyApplied;
}

export function buildLatestHistoryNikQuery(empCodeList: string): string {
    return `
        SELECT emp_code, nik, new_nik
        FROM (
            SELECT
                RTRIM(emp_code) AS emp_code,
                NULLIF(RTRIM(ISNULL(nik, '')), '') AS nik,
                NULLIF(RTRIM(ISNULL(new_nik, '')), '') AS new_nik,
                ROW_NUMBER() OVER (
                    PARTITION BY RTRIM(emp_code)
                    ORDER BY
                        CASE WHEN period_month = ? AND period_year = ? THEN 0 ELSE 1 END,
                        period_year DESC,
                        period_month DESC,
                        id DESC
                ) AS rn
            FROM dbo.history_hr_employee
            WHERE RTRIM(emp_code) IN (${empCodeList})
              AND (
                  NULLIF(RTRIM(ISNULL(nik, '')), '') IS NOT NULL
                  OR NULLIF(RTRIM(ISNULL(new_nik, '')), '') IS NOT NULL
              )
        ) ranked
        WHERE rn = 1
    `;
}
```

- [ ] **Step 4: Run the focused backend test**

Run:

```bash
cd backend
bun test src/utils/payrollNikIdentity.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/payrollNikIdentity.ts backend/src/utils/payrollNikIdentity.test.ts
git commit -m "feat(payroll): resolve effective nik identity"
```

## Task 2: Use `history_hr_employee.new_nik` in Daftar Upah Backend Rows

**Files:**
- Modify: `backend/src/services/dataExtractorService.ts`
- Test: `backend/src/utils/payrollNikIdentity.test.ts`

- [ ] **Step 1: Verify the current old-NIK-only query exists**

Run:

```bash
rg -n "SELECT RTRIM\\(emp_code\\) as emp_code, RTRIM\\(nik\\) as nik|NIK lookup \\(history_hr_employee\\)" backend/src/services/dataExtractorService.ts
```

Expected: output includes the `history_hr_employee` NIK lookup block.

- [ ] **Step 2: Import the NIK identity helpers**

In `backend/src/services/dataExtractorService.ts`, add this import near the other `../utils` imports:

```ts
import {
    applyHistoryNikSourcesToEmployees,
    buildLatestHistoryNikQuery,
    resolvePayrollNikIdentity
} from "../utils/payrollNikIdentity";
```

- [ ] **Step 3: Replace the history NIK enrichment block**

In `backend/src/services/dataExtractorService.ts`, replace the block that calls:

```ts
extendDb.query<any>(`
    SELECT RTRIM(emp_code) as emp_code, RTRIM(nik) as nik
    FROM dbo.history_hr_employee
    WHERE RTRIM(emp_code) IN (${empCodeList})
      AND nik IS NOT NULL AND RTRIM(nik) != ''
`)
```

with:

```ts
const nikRows = await withTimeout('NIK lookup (history_hr_employee)',
    extendDb.query<any>(buildLatestHistoryNikQuery(empCodeList), [month, year]),
    5000
);
if (nikRows) {
    nikFound = applyHistoryNikSourcesToEmployees(employees as any[], nikRows);
    debug(CATEGORY, `NIK from history_hr_employee: ${nikFound}/${employees.length}`);
}
```

Keep the existing `try/catch` and timeout behavior.

- [ ] **Step 4: Ensure fallback identity fields exist when history lookup fails**

Immediately after the `try/catch` for history NIK lookup, add:

```ts
applyHistoryNikSourcesToEmployees(employees as any[], []);
```

This makes fallback rows still expose `nik`, `new_nik`, `nik_display`, `nik_source`, and `has_nik_change` even when the database lookup times out or fails.

- [ ] **Step 5: Update payroll row construction**

In the `const row: PayrollRow = { ... }` block, replace:

```ts
nik: emp.actual_nik || emp.emp_code,
new_nik: emp.actual_nik || emp.emp_code,
```

with:

```ts
nik: emp.nik || "",
new_nik: emp.new_nik || "",
nik_display: emp.nik_display || emp.new_nik || emp.nik || emp.actual_nik || emp.emp_code,
nik_source: emp.nik_source || resolvePayrollNikIdentity(emp).nik_source,
has_nik_change: Boolean(emp.has_nik_change),
```

- [ ] **Step 6: Run focused backend tests**

Run:

```bash
cd backend
bun test src/utils/payrollNikIdentity.test.ts
```

Expected: PASS.

- [ ] **Step 7: Confirm old query shape is gone**

Run:

```bash
rg -n "SELECT RTRIM\\(emp_code\\) as emp_code, RTRIM\\(nik\\) as nik" backend/src/services/dataExtractorService.ts
```

Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add backend/src/services/dataExtractorService.ts
git commit -m "fix(payroll): hydrate daftar upah nik from history new nik"
```

## Task 3: Add Visible NIK Column with Ellipsis and Full Toggle

**Files:**
- Modify: `frontend/src/components/CustomPayrollTable.jsx`
- Modify: `frontend/src/components/CustomPayrollTable.render.test.jsx`
- Modify: `frontend/src/utils/payrollHeaderLayout.js`
- Test: `frontend/src/components/CustomPayrollTable.render.test.jsx`

- [ ] **Step 1: Write the render test**

Add this test to `frontend/src/components/CustomPayrollTable.render.test.jsx`:

```jsx
it('renders effective NIK with full-value affordance and changed-NIK marker', () => {
    mocked.streamMeta = {
        dynamic_premi_headers: [],
        dynamic_potongan_headers: [],
        premi_title_map: {},
        potongan_title_map: {}
    };
    mocked.streamEmployee = {
        nik: '1902050504860001',
        new_nik: '1902051212790002',
        nik_display: '1902051212790002',
        nik_source: 'new_nik',
        has_nik_change: true,
        emp_code: 'B0745',
        gang_code: 'D1H',
        nama: 'Siti Aminah'
    };

    const html = renderToString(
        <CustomPayrollTable
            token="test-token"
            division="PG2B"
            gangCode="D1H"
            month={4}
            year={2026}
        />
    );

    expect(html).toContain('data-field="nik_display"');
    expect(html).toContain('>NIK<');
    expect(html).toContain('1902051212790002');
    expect(html).toContain('Full');
    expect(html).toContain('BARU');
    expect(html).toContain('NIK lama: 1902050504860001');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd frontend
npx vitest run src/components/CustomPayrollTable.render.test.jsx
```

Expected: FAIL because `nik_display` column is not rendered yet.

- [ ] **Step 3: Add per-row expansion state**

In `frontend/src/components/CustomPayrollTable.jsx`, near the other `useState` declarations, add:

```jsx
const [expandedNikCells, setExpandedNikCells] = useState(() => new Set());
```

- [ ] **Step 4: Add the NIK cell renderer**

In `frontend/src/components/CustomPayrollTable.jsx`, before `const columnDefs = useMemo(() => {`, add:

```jsx
const renderNikCell = (row) => {
    if (row.type !== 'employee') return row.nik_display || row.new_nik || row.nik || '-';

    const value = String(row.nik_display || row.new_nik || row.nik || row.emp_code || '').trim();
    const oldNik = String(row.nik || '').trim();
    const newNik = String(row.new_nik || '').trim();
    const rowKey = String(row.emp_code || row.id || value);
    const isExpanded = expandedNikCells.has(rowKey);
    const hasChange = Boolean(row.has_nik_change || (oldNik && newNik && oldNik !== newNik));
    const title = hasChange
        ? `NIK lama: ${oldNik || '-'}\nnew_nik: ${newNik || '-'}`
        : value;

    return (
        <div title={title} style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%', minWidth: 0 }}>
            <span
                style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: isExpanded ? 'visible' : 'hidden',
                    textOverflow: isExpanded ? 'clip' : 'ellipsis',
                    whiteSpace: isExpanded ? 'normal' : 'nowrap',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    fontSize: 11
                }}
            >
                {value || '-'}
            </span>
            {hasChange && (
                <span style={{
                    border: '1px solid #fed7aa',
                    background: '#fff7ed',
                    color: '#9a3412',
                    borderRadius: 999,
                    padding: '1px 5px',
                    fontSize: 9,
                    fontWeight: 800,
                    lineHeight: 1.2
                }}>
                    BARU
                </span>
            )}
            {value.length > 10 && (
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        setExpandedNikCells((prev) => {
                            const next = new Set(prev);
                            if (next.has(rowKey)) next.delete(rowKey);
                            else next.add(rowKey);
                            return next;
                        });
                    }}
                    style={{
                        border: '1px solid #94a3b8',
                        background: '#f8fafc',
                        color: '#334155',
                        borderRadius: 5,
                        padding: '2px 5px',
                        fontSize: 10,
                        fontWeight: 800,
                        cursor: 'pointer',
                        lineHeight: 1.2,
                        flexShrink: 0
                    }}
                >
                    {isExpanded ? 'Hide' : 'Full'}
                </button>
            )}
        </div>
    );
};
```

- [ ] **Step 5: Add the column definition**

In `frontend/src/components/CustomPayrollTable.jsx`, add this column immediately after the `nama` column block:

```jsx
{
    field: 'nik_display',
    headers: ['IDENTITAS', null, 'NIK'],
    w: displayMode === 'detail' ? 145 : 120,
    className: 'text-left',
    render: renderNikCell
},
```

Add `expandedNikCells` to the `useMemo` dependency array for `columnDefs`.

- [ ] **Step 6: Allow NIK display sorting**

In `frontend/src/utils/payrollHeaderLayout.js`, replace:

```js
sortable: colSpan === 1 && ['emp_code', 'nik', 'nama'].includes(colObj.field),
```

with:

```js
sortable: colSpan === 1 && ['emp_code', 'nik', 'nik_display', 'nama'].includes(colObj.field),
```

- [ ] **Step 7: Run the render test**

Run:

```bash
cd frontend
npx vitest run src/components/CustomPayrollTable.render.test.jsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/CustomPayrollTable.jsx frontend/src/components/CustomPayrollTable.render.test.jsx frontend/src/utils/payrollHeaderLayout.js
git commit -m "feat(frontend): show effective nik in daftar upah"
```

## Task 4: Export Complete Effective NIK

**Files:**
- Modify: `frontend/src/utils/exportPayrollToExcel.js`
- Modify: `frontend/src/utils/exportPayrollToExcel.test.js`
- Test: `frontend/src/utils/exportPayrollToExcel.test.js`

- [ ] **Step 1: Write export tests**

Add this test after the employee-name export test in `frontend/src/utils/exportPayrollToExcel.test.js`:

```js
it('exports complete effective NIK for nik_display columns', () => {
  const value = formatPayrollExportCellValue(
    {
      emp_code: 'B0745',
      nik: '1902050504860001',
      new_nik: '1902051212790002',
      nik_display: '1902051212790002',
    },
    { field: 'nik_display' },
    'detail'
  );

  expect(value).toBe('1902051212790002');
});
```

Update the compact Ringkas test in the same file so the input `columnDefs` includes:

```js
{ field: 'nik_display', headers: ['IDENTITAS', null, null, 'NIK'], w: 145 },
```

and the expected fields start with:

```js
'emp_code',
'nik_display',
'nama',
```

Update the Print report test so `columnDefs` uses:

```js
{ field: 'nik_display', headers: ['IDENTITAS', null, null, 'NIK'], w: 145 },
```

and the expected fields start with:

```js
'emp_code',
'nik_display',
'nama',
```

- [ ] **Step 2: Run export tests to verify failure**

Run:

```bash
cd frontend
npx vitest run src/utils/exportPayrollToExcel.test.js
```

Expected: FAIL because `nik_display` is not yet in the summary/print allow-lists.

- [ ] **Step 3: Update NIK export formatting**

In `frontend/src/utils/exportPayrollToExcel.js`, inside `formatPayrollExportCellValue`, add this before numeric formatting:

```js
if (field === 'nik_display' || field === 'nik') {
    return row?.nik_display || row?.new_nik || row?.nik || row?.emp_code || '-';
}
```

- [ ] **Step 4: Add `nik_display` to export allow-lists**

In `frontend/src/utils/exportPayrollToExcel.js`, add `nik_display` after `emp_code` in `SUMMARY_EXPORT_FIELDS`:

```js
'emp_code',
'nik_display',
'nik',
'nama',
```

Add `nik_display` after `emp_code` in `PRINT_EXPORT_FIELDS`:

```js
'emp_code',
'nik_display',
'nama',
```

- [ ] **Step 5: Run export tests**

Run:

```bash
cd frontend
npx vitest run src/utils/exportPayrollToExcel.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/utils/exportPayrollToExcel.js frontend/src/utils/exportPayrollToExcel.test.js
git commit -m "fix(frontend): export effective nik display value"
```

## Task 5: Final Verification

**Files:**
- Review: `backend/src/utils/payrollNikIdentity.ts`
- Review: `backend/src/services/dataExtractorService.ts`
- Review: `frontend/src/components/CustomPayrollTable.jsx`
- Review: `frontend/src/utils/exportPayrollToExcel.js`

- [ ] **Step 1: Run focused backend test**

```bash
cd backend
bun test src/utils/payrollNikIdentity.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run focused frontend tests**

```bash
cd frontend
npx vitest run src/components/CustomPayrollTable.render.test.jsx src/utils/exportPayrollToExcel.test.js
```

Expected: PASS.

- [ ] **Step 3: Build frontend**

```bash
cd frontend
npm run build
```

Expected: PASS and Vite build completes.

- [ ] **Step 4: Confirm the old history query shape is removed**

```bash
rg -n "SELECT RTRIM\\(emp_code\\) as emp_code, RTRIM\\(nik\\) as nik" backend/src/services/dataExtractorService.ts
```

Expected: no output.

- [ ] **Step 5: Review changed files**

```bash
git diff --stat HEAD
git diff -- backend/src/utils/payrollNikIdentity.ts backend/src/services/dataExtractorService.ts frontend/src/components/CustomPayrollTable.jsx frontend/src/utils/exportPayrollToExcel.js
```

Expected: only effective-NIK backend utility, Daftar Upah payload hydration, NIK UI column, and export behavior changed.

## Self-Review

### Spec Coverage

- Existing `history_hr_employee.new_nik` column is used without schema changes: Tasks 1 and 2.
- Old `nik` remains available for audit: Task 1 utility and Task 2 row payload.
- `nik_display = new_nik || nik || emp_code`: Task 1.
- Frontend visible NIK column with ellipsis and `Full` toggle: Task 3.
- Excel export uses complete effective NIK: Task 4.
- Payroll formulas and totals are untouched: all tasks are identity/display/export scoped.

### Placeholder Scan

No placeholders are intentionally left. Every task includes file paths, code snippets, commands, expected results, and commit commands.

### Type Consistency

The plan consistently uses `nik`, `new_nik`, `nik_display`, `nik_source`, and `has_nik_change`. `actual_nik` remains a backend legacy/effective identity field for existing consumers, while the row payload keeps old and new NIK separate.
