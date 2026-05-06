# Summary Report Thumbprint Rowspan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add division-level thumbprint and selisih columns to Summary Report detail with one row-spanned cell per division.

**Architecture:** Backend `summaryService.getDivisionSummary()` attaches `thumb_print` and `selisih` to each gang row from existing thumbprint data keyed by `division_code`. Frontend `SummaryReportPage.jsx` groups visible payroll rows by division for rendering comparison cells once per division, and recomputes visible totals for filters.

**Tech Stack:** Bun tests for backend TypeScript, Vitest source-inspection tests for frontend React, existing Summary Report React/CSS structure.

---

### Task 1: Backend Row Data

**Files:**
- Modify: `backend/src/services/summaryService.test.ts`
- Modify: `backend/src/services/summaryService.ts`

- [ ] **Step 1: Write the failing backend test**

Add this test to `backend/src/services/summaryService.test.ts` inside the existing `describe` block:

```ts
    it("attaches division thumbprint and selisih to gang summary rows", async () => {
        service.extendDb = {
            query: async (sql: string) => {
                if (sql.includes("dbo.history_hr_gang")) {
                    return [
                        { gang_code: "A01", gang_description: "Gang Panen P1A" },
                        { gang_code: "A02", gang_description: "Gang Rawat P1A" }
                    ];
                }

                if (sql.includes("dbo.daftar_upah_aggregation_history")) {
                    return [
                        {
                            id: 1,
                            period_month: 4,
                            period_year: 2026,
                            division_code: "P1A",
                            gang_code: "A01",
                            gang_description: "A01",
                            total_employees: 3,
                            total_hk: 10,
                            total_lembur: 0,
                            total_premi_brondol: 0,
                            total_premi_prunning: 0,
                            total_premi_insentif: 0,
                            total_premi_kinerja: 0,
                            total_premi: 100,
                            dynamic_premi_data: null,
                            informasi_tambahan: null,
                            total_koreksi: 0,
                            total_potongan: 0,
                            total_pph21: 0,
                            total_spsi: 0,
                            total_upah_bersih: 700
                        },
                        {
                            id: 2,
                            period_month: 4,
                            period_year: 2026,
                            division_code: "P1A",
                            gang_code: "A02",
                            gang_description: "A02",
                            total_employees: 2,
                            total_hk: 8,
                            total_lembur: 0,
                            total_premi_brondol: 0,
                            total_premi_prunning: 0,
                            total_premi_insentif: 0,
                            total_premi_kinerja: 0,
                            total_premi: 50,
                            dynamic_premi_data: null,
                            informasi_tambahan: null,
                            total_koreksi: 0,
                            total_potongan: 0,
                            total_pph21: 0,
                            total_spsi: 0,
                            total_upah_bersih: 500
                        }
                    ];
                }

                return [];
            }
        };
        service.loadThumbprintData = async () => ({ P1A: 1000 });

        const result = await summaryService.getDivisionSummary(undefined, 4, 2026, true);

        expect(result.data.map((row: any) => row.thumb_print)).toEqual([1000, 1000]);
        expect(result.data.map((row: any) => row.selisih)).toEqual([200, 200]);
        expect(result.grand_total.thumb_print).toBe(1000);
        expect(result.grand_total.selisih).toBe(200);
    });
```

- [ ] **Step 2: Run backend test to verify it fails**

Run: `cd backend && bun test src/services/summaryService.test.ts`

Expected: FAIL because `thumb_print` and `selisih` are missing from `getDivisionSummary()` rows and grand total.

- [ ] **Step 3: Implement backend data attachment**

In `backend/src/services/summaryService.ts`, inside `getDivisionSummary()`:

```ts
const thumbprintData = month && year ? await this.loadThumbprintData(month, year) : {};
```

After `results` is built, compute division totals and attach values:

```ts
const upahByDivision = results.reduce((acc, row) => {
    const div = row.division_code || "";
    acc[div] = (acc[div] || 0) + Number(row.total_upah_bersih || 0);
    return acc;
}, {} as Record<string, number>);

for (const row of results) {
    const div = row.division_code || "";
    const thumbValue = Number(thumbprintData[div] || 0);
    const divisionUpah = Number(upahByDivision[div] || 0);
    row.thumb_print = thumbValue;
    row.selisih = thumbValue > 0 ? divisionUpah - thumbValue : 0;
}
```

Extend the grand total accumulator with:

```ts
thumb_print: acc.thumb_print + (Number(row.thumb_print) || 0),
selisih: acc.selisih + (Number(row.selisih) || 0),
```

Initialize:

```ts
thumb_print: 0,
selisih: 0,
```

Then deduplicate grand total by division instead of summing row-repeated values before returning:

```ts
const divisionComparisonTotals = Object.entries(upahByDivision).reduce((acc, [div, upah]) => {
    const thumbValue = Number(thumbprintData[div] || 0);
    acc.thumb_print += thumbValue;
    acc.selisih += thumbValue > 0 ? Number(upah || 0) - thumbValue : 0;
    return acc;
}, { thumb_print: 0, selisih: 0 });

grandTotal.thumb_print = divisionComparisonTotals.thumb_print;
grandTotal.selisih = divisionComparisonTotals.selisih;
```

- [ ] **Step 4: Run backend test to verify it passes**

Run: `cd backend && bun test src/services/summaryService.test.ts`

Expected: PASS.

### Task 2: Frontend Layout

**Files:**
- Modify: `frontend/src/pages/SummaryReportPage.printHeader.test.js`
- Modify: `frontend/src/pages/SummaryReportPage.jsx`

- [ ] **Step 1: Write the failing frontend test**

Add this test to `frontend/src/pages/SummaryReportPage.printHeader.test.js`:

```js
  it('adds division-level thumbprint and selisih columns with row-spanned print cells', () => {
    expect(source).toContain('THUMB PRINT');
    expect(source).toContain('SELISIH');
    expect(source).toContain('groupedSummaryScreenRows');
    expect(source).toContain('groupedSummaryPrintRows');
    expect(source).toContain('rowSpan={divisionRowSpan}');
    expect(source).toContain('formatNumber(divisionComparison.thumbPrint)');
    expect(source).toContain('formatNumber(divisionComparison.selisih)');
    expect(source).toContain('filteredGrandTotal.thumb_print');
    expect(source).toContain('filteredGrandTotal.selisih');
  });
```

- [ ] **Step 2: Run frontend test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/SummaryReportPage.printHeader.test.js`

Expected: FAIL because Summary Report detail does not contain the new headers or row-spanned comparison cells.

- [ ] **Step 3: Implement frontend grouping and columns**

In `SummaryReportPage.jsx`:

1. Add helpers near existing memoized report data:

```js
    const buildDivisionRowGroups = useCallback((rows) => {
        const groupsByKey = new Map();
        const groups = [];

        rows.forEach(row => {
            const divisionKey = row.division_code || 'LAINNYA';
            if (!groupsByKey.has(divisionKey)) {
                const nextGroup = { divisionKey, rows: [] };
                groupsByKey.set(divisionKey, nextGroup);
                groups.push(nextGroup);
            }
            groupsByKey.get(divisionKey).rows.push(row);
        });

        return groups.map(group => {
            const totalUpahBersih = group.rows.reduce((sum, row) => sum + Number(row.total_upah_bersih || 0), 0);
            const thumbPrint = Number(group.rows[0]?.thumb_print || 0);
            return {
                ...group,
                divisionComparison: {
                    thumbPrint,
                    selisih: thumbPrint > 0 ? totalUpahBersih - thumbPrint : 0
                }
            };
        });
    }, []);

    const groupedSummaryScreenRows = useMemo(
        () => buildDivisionRowGroups(filteredSummaryData),
        [buildDivisionRowGroups, filteredSummaryData]
    );
```

2. Add `thumb_print` and `selisih` to `filteredGrandTotal` by deduplicating visible division groups:

```js
            totals.thumb_print = groupedSummaryScreenRows.reduce((sum, group) => sum + group.divisionComparison.thumbPrint, 0);
            totals.selisih = groupedSummaryScreenRows.reduce((sum, group) => sum + group.divisionComparison.selisih, 0);
```

3. Render screen and print rows from division groups. On the first row in each division group:

```jsx
{idx === 0 && (
    <>
        <td rowSpan={divisionRowSpan} className="text-right">{formatNumber(divisionComparison.thumbPrint)}</td>
        <td rowSpan={divisionRowSpan} className={`text-right font-bold ${divisionComparison.selisih > 0 ? 'text-diff-neg' : divisionComparison.selisih < 0 ? 'text-diff-pos' : 'text-neutral'}`}>
            {formatNumber(divisionComparison.selisih)}
        </td>
    </>
)}
```

4. Add footer cells:

```jsx
<td className="text-right">{formatNumber(filteredGrandTotal.thumb_print)}</td>
<td className={`text-right font-bold ${filteredGrandTotal.selisih > 0 ? 'text-diff-neg' : filteredGrandTotal.selisih < 0 ? 'text-diff-pos' : 'text-neutral'}`}>
    {formatNumber(filteredGrandTotal.selisih)}
</td>
```

5. Add CSV fields:

```js
Thumb Print,Selisih
```

and row values from division comparison.

- [ ] **Step 4: Run frontend test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/SummaryReportPage.printHeader.test.js`

Expected: PASS.

### Task 3: Verification

**Files:**
- Verify: `frontend/src/pages/SummaryReportPage.jsx`
- Verify: `backend/src/services/summaryService.ts`

- [ ] **Step 1: Run focused backend test**

Run: `cd backend && bun test src/services/summaryService.test.ts`

Expected: PASS.

- [ ] **Step 2: Run focused frontend test**

Run: `cd frontend && npx vitest run src/pages/SummaryReportPage.printHeader.test.js`

Expected: PASS.

- [ ] **Step 3: Inspect changed files**

Run: `git diff -- backend/src/services/summaryService.ts backend/src/services/summaryService.test.ts frontend/src/pages/SummaryReportPage.jsx frontend/src/pages/SummaryReportPage.printHeader.test.js`

Expected: diff only shows Summary Report thumbprint behavior, tests, and no unrelated refactors.
