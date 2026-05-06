# Report Symbol Watermark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a professional repeated Rebinmas symbol watermark to every printed report, especially slip gaji, without explicit "resmi" or "credential" wording.

**Architecture:** Keep watermark markup reusable and print-safe. Report pages use the shared `ReportWatermark` component with a repeated logo grid; payslip cards use a denser logo-only pattern inside each card. CSS uses a middle layering model: page/card background below, watermark above background, content above watermark.

**Tech Stack:** React 18, JavaScript, CSS print styles, Vitest, Vite.

---

### Task 1: Shared Report Watermark Component

**Files:**
- Modify: `frontend/src/components/common/ReportWatermark.jsx`
- Modify: `frontend/src/components/common/ReportWatermark.test.jsx`

- [ ] **Step 1: Write the failing component test**

Replace the existing test body with assertions for a logo-only repeated pattern:

```jsx
await act(async () => {
  root.render(<ReportWatermark />);
});

const watermark = container.querySelector('.report-watermark');
const pattern = container.querySelector('.report-watermark__pattern');
const marks = container.querySelectorAll('.report-watermark__tile img');

expect(watermark).not.toBeNull();
expect(watermark.getAttribute('aria-hidden')).toBe('true');
expect(pattern).not.toBeNull();
expect(marks.length).toBeGreaterThanOrEqual(18);
expect(marks[0]?.getAttribute('src')).toBe('/images/rebinmas.webp');
expect(container.textContent || '').not.toMatch(/RESMI|CREDENTIAL|REBINMAS/i);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/components/common/ReportWatermark.test.jsx`

Expected: FAIL because `.report-watermark__pattern` and repeated `.report-watermark__tile img` do not exist yet, and current component still renders text.

- [ ] **Step 3: Implement the minimal component change**

Change `ReportWatermark` to render only repeated logo tiles:

```jsx
export default function ReportWatermark({
  imageSrc = '/images/rebinmas.webp',
  tileCount = 28,
}) {
  return (
    <div className="report-watermark" aria-hidden="true">
      <div className="report-watermark__pattern">
        {Array.from({ length: tileCount }, (_, index) => (
          <span className="report-watermark__tile" key={index}>
            <img className="report-watermark__image" src={imageSrc} alt="" />
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/components/common/ReportWatermark.test.jsx`

Expected: PASS.

### Task 2: Report Print Watermark CSS

**Files:**
- Modify: `frontend/src/styles/report-print-foundation.css`
- Modify: `frontend/src/styles/report-print-foundation.test.js`

- [ ] **Step 1: Write the failing CSS test**

Add a test that proves report watermark uses professional middle-layer print behavior:

```js
it('prints a professional repeated symbol watermark above report backgrounds and below content', () => {
  expect(css).toMatch(/\.report-watermark__pattern\s*{[\s\S]*grid-template-columns:\s*repeat\(7,\s*1fr\)/);
  expect(css).toMatch(/\.report-watermark__tile\s*{[\s\S]*opacity:\s*0\.075\s*!important;/);
  expect(css).toMatch(/\.report-watermark__image\s*{[\s\S]*width:\s*18mm\s*!important;/);
  expect(css).toMatch(/\.report-watermark\s*~\s*\*\s*{[\s\S]*z-index:\s*2\s*!important;/);
  expect(css).toMatch(/\.wsp-document,\s*[\s\S]*\.comparison-report-container\s*{[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.88\)\s*!important;/);
});
```

- [ ] **Step 2: Run the CSS test to verify it fails**

Run: `cd frontend && npx vitest run src/styles/report-print-foundation.test.js`

Expected: FAIL because current CSS uses one centered watermark mark and content z-index `1`.

- [ ] **Step 3: Implement print CSS**

Inside `@media print`, make `.report-watermark` fixed, render `.report-watermark__pattern` as a diagonal grid, set tile opacity to `0.075`, set image width to `18mm`, set content siblings to `z-index: 2`, and keep report container backgrounds slightly transparent so boxes do not fully cover the watermark.

- [ ] **Step 4: Run the CSS test to verify it passes**

Run: `cd frontend && npx vitest run src/styles/report-print-foundation.test.js`

Expected: PASS.

### Task 3: Payslip Logo-Only Watermark

**Files:**
- Modify: `frontend/src/components/PayslipCard.jsx`
- Modify: `frontend/src/components/PayslipCard.test.jsx`
- Modify: `frontend/src/styles/payslip-print.css`
- Modify: `frontend/src/styles/payslip-print.test.js`

- [ ] **Step 1: Write the failing payslip markup test**

Replace the existing watermark assertion with logo-only assertions:

```jsx
const tileCount = (html.match(/payslip-watermark__tile/g) || []).length;

expect(tileCount).toBeGreaterThanOrEqual(24);
expect(html).toContain('payslip-watermark__image');
expect(html).toContain('/images/rebinmas.webp');
expect(html).not.toContain('REBINMAS JAYA</span>');
expect(html).not.toMatch(/RESMI|CREDENTIAL/i);
```

- [ ] **Step 2: Run the component test to verify it fails**

Run: `cd frontend && npx vitest run src/components/PayslipCard.test.jsx`

Expected: FAIL because the payslip watermark still renders repeated text spans.

- [ ] **Step 3: Implement payslip markup**

Render 32 image tiles inside `.payslip-watermark`:

```jsx
<div className="payslip-watermark" aria-hidden="true">
  {Array.from({ length: 32 }, (_, idx) => (
    <span key={idx} className="payslip-watermark__tile">
      <img className="payslip-watermark__image" src="/images/rebinmas.webp" alt="" />
    </span>
  ))}
</div>
```

- [ ] **Step 4: Write the failing payslip CSS test**

Add assertions for the payslip middle layer:

```js
it('keeps the payslip symbol watermark professionally proportioned between card background and content', () => {
  expect(css).toMatch(/\.payslip-card\s*{[\s\S]*isolation:\s*isolate;/);
  expect(css).toMatch(/\.payslip-watermark\s*{[\s\S]*grid-template-columns:\s*repeat\(4,\s*1fr\);/);
  expect(css).toMatch(/\.payslip-watermark\s*{[\s\S]*z-index:\s*1;/);
  expect(css).toMatch(/\.payslip-watermark__tile\s*{[\s\S]*opacity:\s*0\.09;/);
  expect(css).toMatch(/\.payslip-watermark__image\s*{[\s\S]*width:\s*12mm;/);
  expect(css).toMatch(/\.payslip-card-header,\s*[\s\S]*\.payslip-note-section\s*{[\s\S]*z-index:\s*2;/);
});
```

- [ ] **Step 5: Run the payslip tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/PayslipCard.test.jsx src/styles/payslip-print.test.js`

Expected: FAIL until CSS is updated.

- [ ] **Step 6: Implement payslip CSS**

Set `.payslip-card { isolation: isolate; }`, make `.payslip-watermark` `z-index: 1`, add `.payslip-watermark__image { width: 12mm; }`, set tile opacity to `0.09`, and keep all payslip content sections at `z-index: 2`.

- [ ] **Step 7: Run focused payslip tests**

Run: `cd frontend && npx vitest run src/components/PayslipCard.test.jsx src/styles/payslip-print.test.js`

Expected: PASS.

### Task 4: Final Verification

**Files:**
- Verify frontend only.

- [ ] **Step 1: Run focused watermark tests**

Run: `cd frontend && npx vitest run src/components/common/ReportWatermark.test.jsx src/styles/report-print-foundation.test.js src/components/PayslipCard.test.jsx src/styles/payslip-print.test.js`

Expected: PASS.

- [ ] **Step 2: Run frontend build**

Run: `cd frontend && npm run build`

Expected: exit code 0.
