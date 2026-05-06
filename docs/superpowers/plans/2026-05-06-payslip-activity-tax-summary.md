# Payslip Activity Tax Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the printable payslip so koreksi is shown as a negative income row, activity and tax components are compactly explained, and signatures are absent.

**Architecture:** Keep the change frontend-only in `PayslipCard`. Derive display-only summary values from existing `payroll_data` and `attendance.summary`, leaving payroll totals unchanged.

**Tech Stack:** React, Vitest, Vite frontend, existing `payslip-print.css`.

---

## File Structure

- Modify `frontend/src/components/PayslipCard.test.jsx`: add focused server-rendered tests for the new printed text.
- Modify `frontend/src/components/PayslipCard.jsx`: derive compact summary/tax values and update printed markup.
- Modify `frontend/src/styles/payslip-print.css`: add compact print-safe styles for the activity summary and tax component block.

## Task 1: Failing Payslip Tests

**Files:**
- Modify: `frontend/src/components/PayslipCard.test.jsx`

- [ ] **Step 1: Replace the old koreksi-hidden assertion with a koreksi-as-income assertion**

Use this test body:

```jsx
it('shows koreksi as a negative income row instead of a deduction row', () => {
    const html = renderToString(
        <PayslipCard
            data={{
                ...basePayslipData,
                payroll_data: {
                    ...basePayslipData.payroll_data,
                    total_potongan: 0,
                    pot_koreksi: 75000,
                    koreksi_denda_panen: 25000,
                    pot_spsi: 10000,
                },
            }}
            month={4}
            year={2026}
        />
    );

    expect(html).toContain('Koreksi Pendapatan (-)');
    expect(html).toContain('75.000');
    expect(html).not.toMatch(/Pot\. Upah Kotor|Subtotal Pot\. Kotor|Koreksi DENDA PANEN|Koreksi Denda Panen/);
    expect(html).toContain('TOTAL POTONGAN');
    expect(html).toContain('10.000');
});
```

- [ ] **Step 2: Add a compact activity summary test**

Use this test:

```jsx
it('prints a compact activity summary with HK, sick days, overtime, and koreksi', () => {
    const html = renderToString(
        <PayslipCard
            data={{
                ...basePayslipData,
                attendance: { summary: { total_hadir: 18, cuti_sakit: 2 } },
                payroll_data: {
                    ...basePayslipData.payroll_data,
                    jumlah_hk: 20,
                    lembur_jam: 6,
                    lembur_jumlah: 450000,
                    pot_koreksi: 75000,
                },
            }}
            month={4}
            year={2026}
        />
    );

    expect(html).toContain('Ringkasan Aktivitas');
    expect(html).toContain('HK: 20');
    expect(html).toContain('Sakit: 2 hr');
    expect(html).toContain('Lembur: 6j = 450.000');
    expect(html).toContain('Koreksi: 75.000');
});
```

- [ ] **Step 3: Add a compact tax component test**

Use this test:

```jsx
it('explains compact PPh 21 components including other income and Astek BPJS', () => {
    const html = renderToString(
        <PayslipCard
            data={{
                ...basePayslipData,
                payroll_data: {
                    ...basePayslipData.payroll_data,
                    penghasilan_bruto: 2600000,
                    total_pendapatan_lainnya: 150000,
                    pot_astek: 40000,
                    pot_bpjs_kesehatan_pekerja: 25000,
                    pot_bpjs_pensiun_pekerja: 10000,
                    pot_pph21: 130000,
                    pph21_ter: 130000,
                    tarif_pajak_ter: 5,
                    kategori_ter: 'A',
                    status_ptkp: 'TK/0',
                },
            }}
            month={4}
            year={2026}
        />
    );

    expect(html).toContain('Komponen Pajak / PPh 21');
    expect(html).toContain('Bruto/DPP');
    expect(html).toContain('2.600.000');
    expect(html).toContain('Pendapatan Lainnya');
    expect(html).toContain('150.000');
    expect(html).toContain('Astek/BPJS');
    expect(html).toContain('75.000');
    expect(html).toContain('Tarif TER A (TK/0)');
    expect(html).toContain('5.00%');
    expect(html).toContain('PPh 21');
    expect(html).toContain('130.000');
});
```

- [ ] **Step 4: Add a signature absence test**

Use this test:

```jsx
it('does not render signature fields on the compact printed slip', () => {
    const html = renderToString(
        <PayslipCard data={basePayslipData} month={4} year={2026} />
    );

    expect(html).not.toContain('Dibuat Oleh');
    expect(html).not.toContain('Diterima Oleh');
    expect(html).not.toContain('payslip-card-signature');
});
```

- [ ] **Step 5: Run the focused test and verify RED**

Run:

```bash
cd frontend
npx vitest run src/components/PayslipCard.test.jsx
```

Expected: at least the new koreksi/activity/tax tests fail because the production component does not yet render the requested rows.

## Task 2: Payslip Component Implementation

**Files:**
- Modify: `frontend/src/components/PayslipCard.jsx`

- [ ] **Step 1: Add helpers near the existing helper functions**

Add helpers to parse finite display numbers and sum fields:

```jsx
const toFiniteNumber = (value) => {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : 0
}

const sumPositiveFields = (source, predicate) => {
    return Object.entries(source || {}).reduce((sum, [key, val]) => {
        if (!predicate(key)) return sum
        const amount = toFiniteNumber(val)
        return amount > 0 ? sum + amount : sum
    }, 0)
}
```

- [ ] **Step 2: Use the helper in `getNum`**

Change `getNum` to return finite numeric values from either numbers or numeric strings:

```jsx
const getNum = (key) => {
    const val = payroll[key] ?? empInfo[key]
    return toFiniteNumber(val)
}
```

- [ ] **Step 3: Treat koreksi as negative income, not fallback deduction**

Keep `totalPotKotor` as the koreksi display total, but update the fallback total deduction so koreksi is not added:

```jsx
const totalPotongan = getNum('total_potongan_bersih') || getNum('total_potongan') || (
    potBersihList.reduce((acc, curr) => acc + (curr.isCredit ? -curr.value : curr.value), 0)
    + otherIncomeDeductionTotal
);
```

- [ ] **Step 4: Add the activity summary after employee info**

Render a compact summary block after `.payslip-card-info`:

```jsx
<div className="payslip-activity-summary">
    <span>Ringkasan Aktivitas</span>
    <strong>HK: {hk || 0}</strong>
    <strong>Sakit: {attSakit || 0} hr</strong>
    <strong>Lembur: {lemburJam || 0}j = {formatCurrency(lemburJumlah)}</strong>
    <strong>Koreksi: {formatCurrency(totalPotKotor)}</strong>
</div>
```

- [ ] **Step 5: Add koreksi to the income column before total gross**

Render only when `totalPotKotor > 0`:

```jsx
{totalPotKotor > 0 && (
    <div className="payslip-item payslip-income-correction">
        <span className="payslip-item-label">Koreksi Pendapatan (-)</span>
        <span className="payslip-item-value payslip-negative">{formatCurrency(totalPotKotor)}</span>
    </div>
)}
```

- [ ] **Step 6: Replace tax breakdown markup**

Replace the old `Detail Kalkulasi PPh21 (TER)` block with a compact component block containing `Bruto/DPP`, `Pendapatan Lainnya`, `Astek/BPJS`, `Tarif TER`, and `PPh 21`.

- [ ] **Step 7: Keep signature markup absent**

Confirm `PayslipCard.jsx` has no `payslip-card-signature`, `Dibuat Oleh`, or `Diterima Oleh` strings.

## Task 3: Compact Print Styling

**Files:**
- Modify: `frontend/src/styles/payslip-print.css`
- Modify: `frontend/src/styles/payslip-print.test.js` if a style contract is needed

- [ ] **Step 1: Add compact activity and correction styles**

Add:

```css
.payslip-activity-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5mm;
    margin-bottom: 0.35mm;
    padding: 0.35mm 0.5mm;
    border: 1px solid var(--payslip-rule, #000);
    background: rgba(255, 255, 255, 0.9);
    font-size: 5.5pt;
    line-height: 1;
    position: relative;
    z-index: 2;
}

.payslip-activity-summary span {
    font-weight: 900;
    text-transform: uppercase;
}

.payslip-activity-summary strong {
    font-weight: 800;
    white-space: nowrap;
}

.payslip-income-correction {
    border-top: 0.5px dashed #777;
    padding-top: 0.15mm;
    margin-top: 0.15mm;
}
```

- [ ] **Step 2: Add compact tax row styles**

Add:

```css
.payslip-tax-breakdown-title,
.payslip-tax-breakdown-row {
    display: flex;
    justify-content: space-between;
    gap: 1mm;
}

.payslip-tax-breakdown-title {
    border-bottom: 0.5px dashed #999;
    margin-bottom: 0.35mm;
    padding-bottom: 0.25mm;
    font-weight: 900;
    font-style: normal;
}

.payslip-tax-breakdown-row span:last-child {
    font-family: 'Courier New', Courier, monospace;
    font-weight: 800;
}
```

## Task 4: Verification

**Files:**
- Verify: `frontend/src/components/PayslipCard.test.jsx`
- Verify: `frontend/src/styles/payslip-print.test.js`

- [ ] **Step 1: Run focused tests**

Run:

```bash
cd frontend
npx vitest run src/components/PayslipCard.test.jsx src/styles/payslip-print.test.js
```

Expected: all tests pass.

- [ ] **Step 2: Run frontend build**

Run:

```bash
cd frontend
npm run build
```

Expected: build exits with code 0.

- [ ] **Step 3: Review git diff**

Run:

```bash
git diff -- frontend/src/components/PayslipCard.jsx frontend/src/components/PayslipCard.test.jsx frontend/src/styles/payslip-print.css frontend/src/styles/payslip-print.test.js docs/superpowers/plans/2026-05-06-payslip-activity-tax-summary.md
```

Expected: diff only contains the approved payslip layout/test/plan changes plus pre-existing user edits preserved.

## Self-Review

- Spec coverage: koreksi income placement, activity summary, tax components, and signature removal are each covered.
- Placeholder scan: no placeholders remain.
- Type consistency: helpers and JSX use existing `payroll_data`, `attendance.summary`, and existing CSS class naming.
