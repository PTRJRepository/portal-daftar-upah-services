# Premi Angkut Kendaraan Subblok AD Override Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional subblok detail for vehicle-based transport premium rows and column-level ADCode/AD_DESC override for manual adjustment columns.

**Architecture:** Keep `input_type: "kendaraan"` as the canonical metadata mode and add item-level `subblok` only when the user enables `requires_subblok`. Keep AD override at the manual adjustment column payload level so all cells in that column inherit the same AD fields. Backend grouped responses already flatten metadata items; add coverage for vehicle rows with subblok and normalize subblok symbols consistently.

**Tech Stack:** React, Vitest/jsdom, Bun tests, existing payroll manual adjustment services.

---

## File Structure

- Modify `frontend/src/utils/payrollPremiumDetailEdits.js`
  - Owns structured manual adjustment metadata validation and amount normalization.
  - Add `requires_subblok` handling for `kendaraan` metadata.
- Modify `frontend/src/utils/payrollPremiumDetailEdits.test.js`
  - Add focused validation coverage for vehicle rows with optional subblok.
- Modify `frontend/src/components/PremiumDetailPopup.jsx`
  - Owns the structured detail editor UI.
  - Add `Pakai Subblok` toggle for `inputType === "kendaraan"`.
  - Persist `requires_subblok: true` and item-level `subblok` only when active.
- Modify `frontend/src/components/PremiumDetailPopup.test.jsx`
  - Add user-flow tests for the vehicle subblok toggle, validation, and saved metadata.
- Modify `frontend/src/components/ManualAdjustmentColumnModal.jsx`
  - Owns new manual adjustment column configuration.
  - Add column-level ADCode/AD_DESC override toggle and fields.
- Modify `frontend/src/components/ManualAdjustmentColumnModal.test.jsx`
  - Add tests proving override values replace definition AD fields in `onSaved` payload.
- Modify `backend/src/services/manualAdjustmentService.test.ts`
  - Add grouped and flat response coverage for vehicle metadata with `subblok`.
- Modify `docs/MANUAL_ADJUSTMENT_API.md`
  - Document that `kendaraan` metadata can include item-level `subblok` and that AD override is column-level.

---

### Task 1: Vehicle Metadata Validation

**Files:**
- Modify: `frontend/src/utils/payrollPremiumDetailEdits.js`
- Test: `frontend/src/utils/payrollPremiumDetailEdits.test.js`

- [ ] **Step 1: Write failing validation tests**

Add these cases inside `describe('validatePremiumDetailMetadata', () => { ... })` in `frontend/src/utils/payrollPremiumDetailEdits.test.js`:

```javascript
  it('requires subblok for kendaraan details only when subblok mode is active', () => {
    const withoutSubblokMode = validatePremiumDetailMetadata({
      input_type: 'kendaraan',
      items: [{ nomor_kendaraan: 'B1234AB', expense_code: 'DRIVER', jumlah: 150000 }],
    }, 'kendaraan', 'PREMI');

    expect(withoutSubblokMode).toEqual({
      isComplete: true,
      inputType: 'kendaraan',
      reasons: [],
    });

    const withMissingSubblok = validatePremiumDetailMetadata({
      input_type: 'kendaraan',
      requires_subblok: true,
      items: [{ subblok: '', nomor_kendaraan: 'B1234AB', expense_code: 'DRIVER', jumlah: 150000 }],
    }, 'kendaraan', 'PREMI');

    expect(withMissingSubblok.isComplete).toBe(false);
    expect(withMissingSubblok.reasons).toContain('Baris kendaraan 1: subblok wajib diisi.');

    expect(validatePremiumDetailMetadata({
      input_type: 'kendaraan',
      requires_subblok: true,
      items: [{ subblok: 'P09/15', nomor_kendaraan: 'B1234AB', expense_code: 'DRIVER', jumlah: 150000 }],
    }, 'kendaraan', 'PREMI').isComplete).toBe(true);
  });
```

- [ ] **Step 2: Run the focused frontend utility test and verify it fails**

Run:

```powershell
cd frontend
npx vitest run src/utils/payrollPremiumDetailEdits.test.js
```

Expected: FAIL because `validateKendaraanItems` does not require `subblok` when `requires_subblok` is true.

- [ ] **Step 3: Add `requires_subblok` validation**

In `frontend/src/utils/payrollPremiumDetailEdits.js`, replace `validateKendaraanItems` with:

```javascript
function isEnabledFlag(value) {
    return value === true || ['1', 'true', 'yes', 'ya', 'subblok'].includes(String(value || '').trim().toLowerCase());
}

function validateKendaraanItems(items = [], adjustmentType, options = {}) {
    const requireSubblok = Boolean(options.requireSubblok);
    const relevantKeys = requireSubblok
        ? ['subblok', 'nomor_kendaraan', 'expense_code', 'jumlah']
        : ['nomor_kendaraan', 'expense_code', 'jumlah'];
    const relevantItems = (items || []).filter((item) => hasAnyValue(item, relevantKeys));
    const reasons = [];

    if (relevantItems.length === 0) {
        reasons.push('Minimal satu detail kendaraan wajib diisi.');
        return reasons;
    }

    relevantItems.forEach((item, index) => {
        const row = index + 1;
        if (requireSubblok && isBlank(item.subblok)) reasons.push(`Baris kendaraan ${row}: subblok wajib diisi.`);
        if (isBlank(item.nomor_kendaraan)) reasons.push(`Baris kendaraan ${row}: nomor kendaraan wajib diisi.`);
        if (isBlank(item.expense_code)) reasons.push(`Baris kendaraan ${row}: expense code wajib diisi.`);
        if (!isValidDetailAmount(item.jumlah, adjustmentType)) {
            reasons.push(isInvalidSignedAmount(item.jumlah, adjustmentType)
                ? `Baris kendaraan ${row}: jumlah tidak boleh negatif.`
                : `Baris kendaraan ${row}: jumlah wajib lebih dari 0.`);
        }
    });

    return reasons;
}
```

Then change the kendaraan branch in `validatePremiumDetailMetadata` to:

```javascript
    } else if (resolvedInputType === 'kendaraan') {
        reasons.push(...validateKendaraanItems(metadata.items, adjustmentType, {
            requireSubblok: isEnabledFlag(metadata.requires_subblok)
        }));
```

- [ ] **Step 4: Run the utility test and verify it passes**

Run:

```powershell
cd frontend
npx vitest run src/utils/payrollPremiumDetailEdits.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

Run:

```powershell
git add frontend/src/utils/payrollPremiumDetailEdits.js frontend/src/utils/payrollPremiumDetailEdits.test.js
git commit -m "feat: validate vehicle subblok detail"
```

---

### Task 2: Premium Detail Popup Subblok Toggle

**Files:**
- Modify: `frontend/src/components/PremiumDetailPopup.jsx`
- Test: `frontend/src/components/PremiumDetailPopup.test.jsx`

- [ ] **Step 1: Write failing popup tests**

Add these tests inside `describe('PremiumDetailPopup', () => { ... })` in `frontend/src/components/PremiumDetailPopup.test.jsx`:

```javascript
    it('enables subblok for kendaraan rows and saves item-level subblok metadata', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        const onSave = vi.fn();

        try {
            await act(async () => {
                root.render(
                    <PremiumDetailPopup
                        isOpen
                        onClose={() => {}}
                        onSave={onSave}
                        inputType="kendaraan"
                        definitionName="PREMI ANGKUT TBS"
                        adjustmentType="PREMI"
                        storedAmount={150000}
                        initialData={{
                            input_type: 'kendaraan',
                            items: [{ nomor_kendaraan: 'B1234AB', expense_code: 'DRIVER', jumlah: 150000 }],
                            total_amount: 150000
                        }}
                    />
                );
            });

            expect(container.textContent || '').toContain('Pakai Subblok');
            expect(container.querySelector('input[name="kendaraan_subblok"]')).toBeFalsy();

            const toggle = Array.from(container.querySelectorAll('input[type="checkbox"]'))
                .find((input) => input.closest('label')?.textContent?.includes('Pakai Subblok'));
            expect(toggle).toBeTruthy();

            await act(async () => {
                toggle.checked = true;
                toggle.dispatchEvent(new Event('change', { bubbles: true }));
            });

            const subblokInput = container.querySelector('input[name="kendaraan_subblok"]');
            expect(subblokInput).toBeTruthy();

            await act(async () => {
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                setter.call(subblokInput, 'P09/15');
                subblokInput.dispatchEvent(new Event('input', { bubbles: true }));
            });

            const saveButton = findButton(container, 'Simpan Detail');
            expect(saveButton.disabled).toBe(false);

            await act(async () => {
                saveButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            });

            expect(onSave).toHaveBeenCalledTimes(1);
            expect(onSave.mock.calls[0][0]).toEqual({
                input_type: 'kendaraan',
                requires_subblok: true,
                items: [{ subblok: 'P09/15', nomor_kendaraan: 'B1234AB', expense_code: 'DRIVER', jumlah: 150000 }],
                total_amount: 150000
            });
        } finally {
            await act(async () => {
                root.unmount();
            });
            container.remove();
        }
    });

    it('requires subblok in kendaraan popup only after the subblok toggle is active', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);

        try {
            await act(async () => {
                root.render(
                    <PremiumDetailPopup
                        isOpen
                        onClose={() => {}}
                        onSave={() => {}}
                        inputType="kendaraan"
                        definitionName="PREMI ANGKUT TBS"
                        adjustmentType="PREMI"
                        storedAmount={150000}
                        initialData={{
                            input_type: 'kendaraan',
                            items: [{ nomor_kendaraan: 'B1234AB', expense_code: 'DRIVER', jumlah: 150000 }],
                            total_amount: 150000
                        }}
                    />
                );
            });

            expect(container.textContent || '').not.toContain('subblok wajib diisi');

            const toggle = Array.from(container.querySelectorAll('input[type="checkbox"]'))
                .find((input) => input.closest('label')?.textContent?.includes('Pakai Subblok'));

            await act(async () => {
                toggle.checked = true;
                toggle.dispatchEvent(new Event('change', { bubbles: true }));
            });

            expect(container.textContent || '').toContain('subblok wajib diisi');
            expect(findButton(container, 'Simpan Detail').disabled).toBe(true);
        } finally {
            await act(async () => {
                root.unmount();
            });
            container.remove();
        }
    });
```

- [ ] **Step 2: Run the popup test and verify it fails**

Run:

```powershell
cd frontend
npx vitest run src/components/PremiumDetailPopup.test.jsx
```

Expected: FAIL because `Pakai Subblok` is not rendered and saved metadata does not include `requires_subblok`.

- [ ] **Step 3: Add subblok state and row normalization**

In `frontend/src/components/PremiumDetailPopup.jsx`, change the empty vehicle row to:

```javascript
const EMPTY_KENDARAAN_ROW = { subblok: '', nomor_kendaraan: '', expense_code: '', jumlah: 0 };
```

Change `normalizeKendaraanItem` to:

```javascript
function normalizeKendaraanItem(item = {}) {
    return {
        subblok: item.subblok || '',
        nomor_kendaraan: item.nomor_kendaraan || '',
        expense_code: item.expense_code || '',
        jumlah: Number(item.jumlah) || 0
    };
}
```

Add this helper near `normalizeKendaraanItem`:

```javascript
function hasKendaraanSubblok(parsed) {
    if (parsed?.requires_subblok === true) return true;
    return Array.isArray(parsed?.items) && parsed.items.some((item) => !isBlank(item?.subblok));
}
```

Add `kendaraanRequiresSubblok` to the object returned by `buildEditorState`:

```javascript
        kendaraanRequiresSubblok: parsed?.input_type === 'kendaraan' ? hasKendaraanSubblok(parsed) : false,
```

Add popup state:

```javascript
    const [kendaraanRequiresSubblok, setKendaraanRequiresSubblok] = useState(initialEditorState.kendaraanRequiresSubblok);
```

In the `useEffect` reset block, add:

```javascript
        setKendaraanRequiresSubblok(nextState.kendaraanRequiresSubblok);
```

- [ ] **Step 4: Add toggle UI to `KendaraanEditor`**

Change the function signature:

```javascript
function KendaraanEditor({ items, onChange, adjustmentType, readOnly = false, showValidation = false, requiresSubblok = false, onRequiresSubblokChange = () => {} }) {
```

Inside `KendaraanEditor`, before the table, render:

```jsx
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>
                <input
                    type="checkbox"
                    checked={requiresSubblok}
                    disabled={readOnly}
                    onChange={(event) => {
                        if (!readOnly) onRequiresSubblokChange(event.target.checked);
                    }}
                />
                Pakai Subblok
            </label>
```

Change the table header to include conditional subblok:

```jsx
                        {requiresSubblok && <th style={thStyle}>Subblok</th>}
                        <th style={thStyle}>Nomor Kendaraan</th>
                        <th style={thStyle}>Driver/Expense Code</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Jumlah</th>
                        <th style={{ ...thStyle, width: 50 }}></th>
```

At the start of each vehicle `<tr>`, add:

```jsx
                            {requiresSubblok && (
                                <td style={{ padding: 4 }}>
                                    <input
                                        style={{ ...cellInputStyle, ...(showValidation && isBlank(item.subblok) ? invalidInputStyle : {}), ...(readOnly ? readOnlyInputStyle : {}) }}
                                        value={item.subblok || ''}
                                        name="kendaraan_subblok"
                                        aria-label="Subblok kendaraan"
                                        disabled={readOnly}
                                        onChange={(e) => handleChange(i, 'subblok', e.target.value.toUpperCase())}
                                    />
                                </td>
                            )}
```

- [ ] **Step 5: Wire validation, save metadata, and editor props**

In `metadataForValidation`, change the kendaraan case:

```javascript
            case 'kendaraan':
                return {
                    input_type: 'kendaraan',
                    requires_subblok: kendaraanRequiresSubblok,
                    items: kendaraanItems,
                    total_amount: totalAmount
                };
```

Include `kendaraanRequiresSubblok` in that `useMemo` dependency list.

In `handleSave`, change the kendaraan metadata block to:

```javascript
            case 'kendaraan': {
                const relevantItems = kendaraanItems.filter(item => item.subblok || item.nomor_kendaraan || item.expense_code || item.jumlah);
                const normalizedItems = normalizeDetailItems(relevantItems).map((item) => {
                    if (kendaraanRequiresSubblok) return item;
                    const { subblok: _subblok, ...rest } = item;
                    return rest;
                });
                metadataJson = {
                    input_type: 'kendaraan',
                    ...(kendaraanRequiresSubblok ? { requires_subblok: true } : {}),
                    items: normalizedItems,
                    total_amount: totalAmount
                };
                break;
            }
```

Include `kendaraanRequiresSubblok` in the `handleSave` dependency list.

Change the kendaraan render block to:

```jsx
                    {inputType === 'kendaraan' && (
                        <KendaraanEditor
                            items={kendaraanItems}
                            onChange={setKendaraanItems}
                            adjustmentType={adjustmentType}
                            readOnly={!canEdit}
                            showValidation={showDetailValidation}
                            requiresSubblok={kendaraanRequiresSubblok}
                            onRequiresSubblokChange={setKendaraanRequiresSubblok}
                        />
                    )}
```

- [ ] **Step 6: Run popup and utility tests**

Run:

```powershell
cd frontend
npx vitest run src/components/PremiumDetailPopup.test.jsx src/utils/payrollPremiumDetailEdits.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

Run:

```powershell
git add frontend/src/components/PremiumDetailPopup.jsx frontend/src/components/PremiumDetailPopup.test.jsx
git commit -m "feat: add vehicle subblok detail toggle"
```

---

### Task 3: Manual Adjustment Column AD Override

**Files:**
- Modify: `frontend/src/components/ManualAdjustmentColumnModal.jsx`
- Test: `frontend/src/components/ManualAdjustmentColumnModal.test.jsx`

- [ ] **Step 1: Write failing column override test**

Add this test inside `describe('ManualAdjustmentColumnModal', () => { ... })` in `frontend/src/components/ManualAdjustmentColumnModal.test.jsx`:

```javascript
    it('saves column-level ADCode and AD_DESC override instead of the selected definition values', async () => {
        mocked.fetchPremiumDefinitions.mockResolvedValueOnce({
            success: true,
            data: [
                {
                    adjustment_name: 'PREMI ANGKUT TBS',
                    ad_code: 'AL3PT2305',
                    task_desc: '(AL) TUNJANGAN PREMI ANGKUT',
                    input_type: 'kendaraan',
                    is_active: true
                }
            ]
        });

        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        const onSaved = vi.fn();

        try {
            await act(async () => {
                root.render(
                    <ManualAdjustmentColumnModal
                        isOpen
                        onClose={() => {}}
                        onSaved={onSaved}
                        token="test-token"
                        division="AB1"
                    />
                );
            });
            await flushEffects();

            const angkutButton = findButton(container, 'PREMI ANGKUT TBS');
            expect(angkutButton).toBeTruthy();

            await act(async () => {
                angkutButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            });
            await flushEffects();

            const overrideToggle = Array.from(container.querySelectorAll('input[type="checkbox"]'))
                .find((input) => input.closest('label')?.textContent?.includes('Override ADCode/AD_DESC'));
            expect(overrideToggle).toBeTruthy();

            await act(async () => {
                overrideToggle.checked = true;
                overrideToggle.dispatchEvent(new Event('change', { bubbles: true }));
            });
            await flushEffects();

            const adCodeInput = container.querySelector('input[name="ad_code_override"]');
            const adDescInput = container.querySelector('input[name="ad_desc_override"]');
            expect(adCodeInput).toBeTruthy();
            expect(adDescInput).toBeTruthy();

            await act(async () => {
                changeInputValue(adCodeInput, 'AL9999AB1');
                changeInputValue(adDescInput, 'SIMPANG TIGA');
            });
            await flushEffects();

            const saveButton = findButton(container, 'Simpan Kolom');
            expect(saveButton.disabled).toBe(false);

            await act(async () => {
                saveButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            });
            await flushEffects();

            expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
                adjustment_type: 'PREMI',
                adjustment_name: 'PREMI ANGKUT TBS',
                ad_code: 'AL9999AB1',
                task_code: 'AL9999AB1',
                base_task_code: 'AL9999AB1',
                task_desc: 'SIMPANG TIGA',
                input_type: 'kendaraan',
                remarks: 'PREMI ANGKUT TBS | AL9999AB1 - SIMPANG TIGA | 0 | sync:MISS | match:MISMATCH'
            }));
        } finally {
            await act(async () => {
                root.unmount();
            });
            container.remove();
        }
    });
```

- [ ] **Step 2: Run modal tests and verify failure**

Run:

```powershell
cd frontend
npx vitest run src/components/ManualAdjustmentColumnModal.test.jsx
```

Expected: FAIL because the override toggle and fields do not exist.

- [ ] **Step 3: Add override state and resolved AD fields**

In `frontend/src/components/ManualAdjustmentColumnModal.jsx`, add state after `selectedPremiumDef`:

```javascript
    const [isAdOverrideEnabled, setIsAdOverrideEnabled] = useState(false);
    const [overrideAdCode, setOverrideAdCode] = useState('');
    const [overrideTaskDesc, setOverrideTaskDesc] = useState('');
```

Add this helper near `buildRemarks`:

```javascript
function buildRemarksFromValues(adjustmentName, adCode, taskDesc, amount = 0) {
    const code = String(adCode || '').trim();
    const desc = String(taskDesc || '').trim();
    const adPart = code ? `${code}${desc ? ` - ${desc}` : ''}` : (desc || 'MANUAL EDIT');
    return `${adjustmentName} | ${adPart} | ${amount} | sync:MISS | match:MISMATCH`;
}
```

Change `buildRemarks` to:

```javascript
function buildRemarks(definition, adjustmentName, amount = 0) {
    if (!definition) return '';
    return buildRemarksFromValues(adjustmentName, resolveAdCode(definition), definition.task_desc || '', amount);
}
```

Reset override state inside the `useEffect` that runs when the modal opens:

```javascript
        setIsAdOverrideEnabled(false);
        setOverrideAdCode('');
        setOverrideTaskDesc('');
```

Also reset these three values when changing category and when selecting a definition.

- [ ] **Step 4: Add validation and submit payload override**

Add resolved field constants after `selectedDefinition`:

```javascript
    const resolvedAdCode = isAdOverrideEnabled ? overrideAdCode.trim() : resolveAdCode(selectedDefinition);
    const resolvedTaskDesc = isAdOverrideEnabled ? overrideTaskDesc.trim() : (selectedDefinition?.task_desc || '');
    const adOverrideError = isAdOverrideEnabled && !resolvedTaskDesc
        ? 'AD_DESC override wajib diisi.'
        : '';
```

Update `canSave`:

```javascript
        && !adOverrideError
```

In `handleSubmit`, after `premiumSelectionError`, add:

```javascript
        if (adOverrideError) {
            setError(adOverrideError);
            return;
        }
```

Change the save payload in `handleSubmit` to use resolved values:

```javascript
            const adCode = resolvedAdCode;
            await onSaved?.({
                adjustment_type: adjustmentType,
                adjustment_name: resolvedAdjustmentName,
                ad_code: adCode,
                task_code: adCode,
                base_task_code: adCode,
                task_desc: resolvedTaskDesc,
                loc_code: division && division !== 'ALL' ? division : undefined,
                remarks: buildRemarksFromValues(resolvedAdjustmentName, adCode, resolvedTaskDesc, 0),
                input_type: selectedDefinition?.input_type || 'amount'
            });
```

- [ ] **Step 5: Add override UI and summary display**

After the selected-definition list and before `Konfigurasi Terpilih`, render:

```jsx
                        {selectedDefinition && (
                            <div style={{ padding: 12, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
                                    <input
                                        type="checkbox"
                                        checked={isAdOverrideEnabled}
                                        onChange={(event) => {
                                            const checked = event.target.checked;
                                            setIsAdOverrideEnabled(checked);
                                            if (checked) {
                                                setOverrideAdCode(resolveAdCode(selectedDefinition));
                                                setOverrideTaskDesc(selectedDefinition?.task_desc || '');
                                            } else {
                                                setOverrideAdCode('');
                                                setOverrideTaskDesc('');
                                            }
                                            setError('');
                                        }}
                                    />
                                    Override ADCode/AD_DESC
                                </label>
                                {isAdOverrideEnabled && (
                                    <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                                        <input
                                            value={overrideAdCode}
                                            name="ad_code_override"
                                            aria-label="ADCode override"
                                            onChange={(event) => setOverrideAdCode(event.target.value.toUpperCase())}
                                            style={{ padding: 9, borderRadius: 8, border: '1px solid #cbd5e1' }}
                                        />
                                        <input
                                            value={overrideTaskDesc}
                                            name="ad_desc_override"
                                            aria-label="AD_DESC override"
                                            onChange={(event) => setOverrideTaskDesc(event.target.value.toUpperCase())}
                                            style={{ padding: 9, borderRadius: 8, border: adOverrideError ? '1px solid #ef4444' : '1px solid #cbd5e1' }}
                                        />
                                        {adOverrideError && (
                                            <div style={{ color: '#b91c1c', fontSize: 12, fontWeight: 700 }}>{adOverrideError}</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
```

In the summary, display `resolvedAdCode` and `resolvedTaskDesc`:

```jsx
                                    <div style={{ fontSize: 13, marginTop: 4 }}>ADCode: <strong>{resolvedAdCode || '-'}</strong></div>
                                    <div style={{ fontSize: 13, marginTop: 4 }}>TaskDesc: {resolvedTaskDesc || '-'}</div>
```

- [ ] **Step 6: Run modal tests**

Run:

```powershell
cd frontend
npx vitest run src/components/ManualAdjustmentColumnModal.test.jsx
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

Run:

```powershell
git add frontend/src/components/ManualAdjustmentColumnModal.jsx frontend/src/components/ManualAdjustmentColumnModal.test.jsx
git commit -m "feat: add manual column AD override"
```

---

### Task 4: Backend Vehicle Subblok Response Coverage and Docs

**Files:**
- Modify: `backend/src/services/manualAdjustmentService.test.ts`
- Modify: `docs/MANUAL_ADJUSTMENT_API.md`

- [ ] **Step 1: Add backend response test for kendaraan subblok**

Add this test near the existing kendaraan normalization tests in `backend/src/services/manualAdjustmentService.test.ts`:

```typescript
    it("normalizes subblok codes for kendaraan detail items and premium transactions", () => {
        const grouped = buildGroupedManualAdjustmentResponse([
            {
                id: 34,
                period_month: 4,
                period_year: 2026,
                emp_code: "G0352",
                nik: "5203180107750348",
                emp_name: "MAHSUN",
                jabatan: "(PM) DRIVER",
                gang_code: "G1H",
                division_code: "AB1",
                adjustment_type: "PREMI",
                adjustment_name: "PREMI ANGKUT TBS",
                amount: 29475,
                metadata_json: JSON.stringify({
                    input_type: "kendaraan",
                    requires_subblok: true,
                    items: [{ subblok: "P09/01-A", nomor_kendaraan: "BN8781WA", expense_code: "TRANSPORT", jumlah: 29475 }],
                    total_amount: 29475
                })
            }
        ] as any);

        const employee = grouped.divisions[0].gangs[0].employees[0];

        expect(employee.premiums[0].detail_items[0]).toMatchObject({
            detail_type: "kendaraan",
            subblok: "P0901A",
            subblok_raw: "P09/01-A",
            nomor_kendaraan: "BN8781WA",
            expense_code: "DRIVER",
            expense_code_raw: "TRANSPORT",
            expense_code_source: "jabatan",
            jumlah: 29475,
            amount: 29475
        });
        expect(employee.premium_transactions[0]).toMatchObject({
            detail_type: "kendaraan",
            subblok: "P0901A",
            subblok_raw: "P09/01-A",
            nomor_kendaraan: "BN8781WA",
            expense_code: "DRIVER",
            amount: 29475
        });
        expect(JSON.parse(employee.premiums[0].metadata_json as string)).toMatchObject({
            input_type: "kendaraan",
            requires_subblok: true,
            items: [
                {
                    subblok: "P0901A",
                    subblok_raw: "P09/01-A",
                    nomor_kendaraan: "BN8781WA",
                    expense_code: "DRIVER",
                    jumlah: 29475
                }
            ],
            total_amount: 29475
        });
    });
```

- [ ] **Step 2: Run backend test**

Run:

```powershell
cd backend
bun test src/services/manualAdjustmentService.test.ts
```

Expected: PASS if existing `buildDetailItem` already normalizes `subblok` on any detail item. If it fails with missing `subblok_raw`, update `buildDetailItem` by keeping the current `if ("subblok" in item)` normalization outside the detail-type branch:

```typescript
    if ("subblok" in item) {
        const rawSubblok = normalizeText(item.subblok);
        const normalizedSubblok = normalizeSubblokCode(rawSubblok);

        if (rawSubblok) {
            detailItem.subblok = normalizedSubblok;
            if (normalizedSubblok !== rawSubblok) {
                detailItem.subblok_raw = rawSubblok;
            }
        }
    }
```

- [ ] **Step 3: Document vehicle subblok and AD override**

In `docs/MANUAL_ADJUSTMENT_API.md`, update the row for `kendaraan` in the metadata table to:

```markdown
| `kendaraan` | `metadata.items[]` | `jumlah` atau `amount` | `premium_transactions[]` dengan `detail_type: "kendaraan"`, optional `subblok` alphanumeric jika `requires_subblok=true`, `subblok_raw` jika asalnya mengandung simbol, `nomor_kendaraan`, `expense_code` final `DRIVER`/`HELPER`, `expense_code_raw` jika metadata lama berisi nilai seperti `TRANSPORT`, `expense_code_source`, `jumlah`, `amount` |
```

Add this paragraph below the ADCode explanation in the grouped response section:

```markdown
Untuk kolom manual adjustment yang dibuat dari UI, ADCode/AD_DESC dapat dioverride pada level kolom. Override ini berlaku untuk seluruh cell pada kolom tersebut. Detail transaksi di `metadata_json` tidak membawa override AD per baris; automation tetap membaca `ad_code`, `ad_code_desc`, `ad_desc`, dan `task_desc` dari row/transaction response.
```

- [ ] **Step 4: Run backend test again**

Run:

```powershell
cd backend
bun test src/services/manualAdjustmentService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

Run:

```powershell
git add backend/src/services/manualAdjustmentService.test.ts docs/MANUAL_ADJUSTMENT_API.md
git commit -m "test: cover vehicle subblok adjustment response"
```

---

### Task 5: Integrated Verification

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run focused frontend tests**

Run:

```powershell
cd frontend
npx vitest run src/utils/payrollPremiumDetailEdits.test.js src/components/PremiumDetailPopup.test.jsx src/components/ManualAdjustmentColumnModal.test.jsx
```

Expected: PASS.

- [ ] **Step 2: Run focused backend tests**

Run:

```powershell
cd backend
bun test src/services/manualAdjustmentService.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run frontend build**

Run:

```powershell
cd frontend
npm run build
```

Expected: PASS with Vite build output and no compile errors.

- [ ] **Step 4: Review diff for unrelated changes**

Run:

```powershell
git status --short
git diff -- frontend/src/utils/payrollPremiumDetailEdits.js frontend/src/utils/payrollPremiumDetailEdits.test.js frontend/src/components/PremiumDetailPopup.jsx frontend/src/components/PremiumDetailPopup.test.jsx frontend/src/components/ManualAdjustmentColumnModal.jsx frontend/src/components/ManualAdjustmentColumnModal.test.jsx backend/src/services/manualAdjustmentService.test.ts docs/MANUAL_ADJUSTMENT_API.md
```

Expected: only feature-related changes in the files listed above. Existing unrelated dirty files in the worktree remain untouched.

- [ ] **Step 5: Final commit if verification required more edits**

If Task 5 required code or docs changes after the previous commits, run:

```powershell
git add frontend/src/utils/payrollPremiumDetailEdits.js frontend/src/utils/payrollPremiumDetailEdits.test.js frontend/src/components/PremiumDetailPopup.jsx frontend/src/components/PremiumDetailPopup.test.jsx frontend/src/components/ManualAdjustmentColumnModal.jsx frontend/src/components/ManualAdjustmentColumnModal.test.jsx backend/src/services/manualAdjustmentService.test.ts docs/MANUAL_ADJUSTMENT_API.md
git commit -m "chore: verify premi angkut subblok override"
```

Expected: a small verification commit only when there were post-verification edits.
