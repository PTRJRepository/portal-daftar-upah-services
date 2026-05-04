# Auto Buffer Potongan PPH Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `POTONGAN PPH` to the existing auto-buffer seeder, with the stored amount taken from Daftar Upah `pph21_ter`.

**Architecture:** Keep the change in the current `/payroll/manual-adjustment/seed-auto-buffer` path. Extend the auto-buffer name mapping, add one generated seed entry per payroll row, and update auto-buffer validation plus sync-status reconciliation so PPh21 ADTRANS rows compare against the seeded TER amount.

**Tech Stack:** Backend TypeScript, Bun test runner, SQL Server via the existing `Database` wrapper, existing `payroll_manual_adjustments` table.

---

## File Structure

- Modify `backend/src/services/payroll/manualAdjustments/autoBufferAdcodeMap.ts`
  - Owns canonical auto-buffer adjustment names and remark AD mapping.
- Modify `backend/src/services/payroll/manualAdjustments/autoBufferAdcodeMap.test.ts`
  - Covers canonical `POTONGAN PPH` mapping and legacy aliases.
- Modify `backend/src/services/autoBufferManualAdjustmentSeederService.ts`
  - Owns seed entry generation, replace behavior, and validation against db_ptrj ADTRANS.
- Modify `backend/src/services/autoBufferManualAdjustmentSeederService.test.ts`
  - Covers 4 generated rows, `pph21_ter` amount source, metadata, preservation, insert counts, and validation.
- Modify `backend/src/services/manualAdjustmentService.ts`
  - Owns manual adjustment sync-status category matching for `AUTO_BUFFER`.
- Modify `backend/src/services/manualAdjustmentService.test.ts`
  - Covers sync-status reconciliation for `AUTO_BUFFER` `POTONGAN PPH`.
- Modify `docs/MANUAL_ADJUSTMENT_API.md`
  - Documents that the auto-buffer seeder now creates `POTONGAN PPH` from `pph21_ter`.

---

### Task 1: Add Auto-Buffer AD Mapping For `POTONGAN PPH`

**Files:**
- Modify: `backend/src/services/payroll/manualAdjustments/autoBufferAdcodeMap.test.ts`
- Modify: `backend/src/services/payroll/manualAdjustments/autoBufferAdcodeMap.ts`

- [ ] **Step 1: Write failing tests for canonical mapping and aliases**

In `backend/src/services/payroll/manualAdjustments/autoBufferAdcodeMap.test.ts`, update the mapping test and add `POTONGAN PPH` cases:

```ts
it("keeps exact adcode mapping required by seeder", () => {
    expect(AUTO_BUFFER_ADCODE_BY_ADJUSTMENT_NAME["SPSI"]).toBe("potongan spsi");
    expect(AUTO_BUFFER_ADCODE_BY_ADJUSTMENT_NAME["MASA KERJA"]).toBe("masa kerja");
    expect(AUTO_BUFFER_ADCODE_BY_ADJUSTMENT_NAME["TUNJANGAN JABATAN"]).toBe("tunjangan jabatan");
    expect(AUTO_BUFFER_ADCODE_BY_ADJUSTMENT_NAME["POTONGAN PPH"]).toBe("DEPH21 - (DE) POTONGAN PPH21");
});

it("builds remark for POTONGAN PPH from calculated TER value", () => {
    expect(buildAutoBufferSeedRemark("POTONGAN PPH", 93435, 93435)).toBe(
        "POTONGAN PPH | DEPH21 - (DE) POTONGAN PPH21 | 93435 | sync:SYNC | match:MATCH"
    );
    expect(buildAutoBufferSeedRemark("POTONGAN PPH", 93435, 28655)).toBe(
        "POTONGAN PPH | DEPH21 - (DE) POTONGAN PPH21 | 93435 | sync:MISS | match:MISMATCH"
    );
});

it("accepts legacy AUTO-prefixed PPH names but emits canonical names", () => {
    expect(buildAutoBufferSeedRemark("AUTO POTONGAN PPH", 5000, 5000)).toBe(
        "POTONGAN PPH | DEPH21 - (DE) POTONGAN PPH21 | 5000 | sync:SYNC | match:MATCH"
    );
});
```

- [ ] **Step 2: Run the focused mapping test and verify it fails**

Run:

```powershell
cd backend
bun test src/services/payroll/manualAdjustments/autoBufferAdcodeMap.test.ts
```

Expected: FAIL because `POTONGAN PPH` is not configured and `resolveAutoBufferAdcode()` throws.

- [ ] **Step 3: Implement mapping and alias support**

In `backend/src/services/payroll/manualAdjustments/autoBufferAdcodeMap.ts`, update the constants:

```ts
export const AUTO_BUFFER_ADCODE_BY_ADJUSTMENT_NAME = {
    "TUNJANGAN JABATAN": "tunjangan jabatan",
    "MASA KERJA": "masa kerja",
    "SPSI": "potongan spsi",
    "POTONGAN PPH": "DEPH21 - (DE) POTONGAN PPH21"
} as const;

const LEGACY_AUTO_BUFFER_ADJUSTMENT_NAME_ALIASES: Record<string, AutoBufferAdjustmentName> = {
    "AUTO TUNJANGAN JABATAN": "TUNJANGAN JABATAN",
    "AUTO MASA KERJA": "MASA KERJA",
    "AUTO SPSI": "SPSI",
    "AUTO POTONGAN PPH": "POTONGAN PPH",
    "AUTO PPH": "POTONGAN PPH"
};
```

- [ ] **Step 4: Run the focused mapping test and verify it passes**

Run:

```powershell
cd backend
bun test src/services/payroll/manualAdjustments/autoBufferAdcodeMap.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

Run:

```powershell
git add backend/src/services/payroll/manualAdjustments/autoBufferAdcodeMap.ts backend/src/services/payroll/manualAdjustments/autoBufferAdcodeMap.test.ts
git commit -m "feat: map auto buffer potongan pph"
```

---

### Task 2: Generate `POTONGAN PPH` Seed Entries From `pph21_ter`

**Files:**
- Modify: `backend/src/services/autoBufferManualAdjustmentSeederService.test.ts`
- Modify: `backend/src/services/autoBufferManualAdjustmentSeederService.ts`

- [ ] **Step 1: Write failing tests for four entries and TER amount source**

In `backend/src/services/autoBufferManualAdjustmentSeederService.test.ts`, replace the first test with this version:

```ts
it("builds 4 AUTO_BUFFER entries per employee including POTONGAN PPH from pph21_ter", () => {
    const entries = buildAutoBufferSeedEntries([
        {
            emp_code: "A0001",
            gang_code: "AB1",
            jabatan_estate: "Mandor 1",
            hari_kerja: 24,
            jumlah_hk: 24,
            masa_kerja_tahun: 5,
            is_spsi_member: true,
            jabatan_jumlah: 0,
            masa_kerja_jumlah: 0,
            pot_spsi: 0,
            pot_pph21: 28655,
            pph21_ter: 93435
        }
    ], 4, 2026, "AB1");

    expect(entries.length).toBe(4);
    expect(entries.every((entry) => entry.adjustment_type === "AUTO_BUFFER")).toBe(true);
    expect(entries.map((entry) => entry.adjustment_name).sort()).toEqual([
        "MASA KERJA",
        "POTONGAN PPH",
        "SPSI",
        "TUNJANGAN JABATAN"
    ]);

    const pphEntry = entries.find((entry) => entry.adjustment_name === "POTONGAN PPH");
    expect(Number(pphEntry?.amount || 0)).toBe(93435);
    expect(pphEntry?.remarks).toBe(
        "POTONGAN PPH | DEPH21 - (DE) POTONGAN PPH21 | 93435 | sync:MISS | match:MISMATCH"
    );
    expect(JSON.parse(pphEntry?.metadata_json || "{}")).toMatchObject({
        input_type: "auto_buffer",
        adjustment_type: "AUTO_BUFFER",
        adjustment_name: "POTONGAN PPH",
        amount: 93435,
        total_amount: 93435
    });

    const spsiEntry = entries.find((entry) => entry.adjustment_name === "SPSI");
    expect(Number(spsiEntry?.amount || 0)).toBe(4000);
    expect(spsiEntry?.remarks).toBe("SPSI | potongan spsi | 4000 | sync:MISS | match:MISMATCH");
});
```

Update existing count assertions in the same file:

```ts
expect(entries.length).toBe(4);
```

Use that replacement for tests currently expecting `3` entries from one valid employee.

- [ ] **Step 2: Update affected seedPeriod count expectations to the new 4-row behavior**

In `backend/src/services/autoBufferManualAdjustmentSeederService.test.ts`, update affected `seedPeriod` tests:

```ts
expect(result.inserted).toBe(3);
expect(insertCalls.length).toBe(3);
expect(insertCalls.some((call) => call.params?.[8] === "SPSI")).toBe(false);
expect(insertCalls.some((call) => call.params?.[8] === "POTONGAN PPH")).toBe(true);
```

for the test that preserves a manual `SPSI` row, and:

```ts
expect(result.inserted).toBe(4);
```

for the gang-specific replace test that inserts all generated rows.

- [ ] **Step 3: Run the focused seeder test and verify it fails**

Run:

```powershell
cd backend
bun test src/services/autoBufferManualAdjustmentSeederService.test.ts
```

Expected: FAIL because only three entries are generated and `ExtractedPayrollLike` has no `pph21_ter` / `pot_pph21` fields.

- [ ] **Step 4: Implement `POTONGAN PPH` seed generation**

In `backend/src/services/autoBufferManualAdjustmentSeederService.ts`, extend the adjustment names:

```ts
const AUTO_BUFFER_ADJUSTMENT_NAME = {
    jabatan: "TUNJANGAN JABATAN",
    masaKerja: "MASA KERJA",
    spsi: "SPSI",
    potonganPph: "POTONGAN PPH"
} as const;
```

Extend `ExtractedPayrollLike`:

```ts
    pot_spsi?: number;
    pot_pph21?: number;
    pph21_ter?: number;
    is_spsi_member?: boolean;
```

After `spsiEntry`, add the PPH entry:

```ts
        const pph21TerAmount = Math.abs(toNumber(row.pph21_ter));
        const dbPotPph21 = Math.abs(toNumber(row.pot_pph21));
        const potonganPphEntry = {
                period_month: periodMonth,
                period_year: periodYear,
                emp_code: empCode,
                nik,
                emp_name: empName,
                gang_code: gangCode,
                division_code: normalizedDivision,
                adjustment_type: AUTO_BUFFER_ADJUSTMENT_TYPE,
                adjustment_name: AUTO_BUFFER_ADJUSTMENT_NAME.potonganPph,
                amount: pph21TerAmount,
                remarks: buildAutoBufferSeedRemark(
                    AUTO_BUFFER_ADJUSTMENT_NAME.potonganPph,
                    pph21TerAmount,
                    dbPotPph21
                )
        };

        entries.push(...[jabatanEntry, masaKerjaEntry, spsiEntry, potonganPphEntry].map((entry) => ({
            ...entry,
            metadata_json: serializeAutoBufferMetadata(entry)
        })));
```

Remove the old three-entry `entries.push(...[jabatanEntry, masaKerjaEntry, spsiEntry]...)` block.

- [ ] **Step 5: Run the focused seeder test and verify it passes**

Run:

```powershell
cd backend
bun test src/services/autoBufferManualAdjustmentSeederService.test.ts
```

Expected: PASS for builder and existing seeder behavior after count updates.

- [ ] **Step 6: Commit Task 2**

Run:

```powershell
git add backend/src/services/autoBufferManualAdjustmentSeederService.ts backend/src/services/autoBufferManualAdjustmentSeederService.test.ts
git commit -m "feat: seed auto buffer potongan pph"
```

---

### Task 3: Validate Seed-Owned `POTONGAN PPH` Against db_ptrj PPh21 ADTRANS

**Files:**
- Modify: `backend/src/services/autoBufferManualAdjustmentSeederService.test.ts`
- Modify: `backend/src/services/autoBufferManualAdjustmentSeederService.ts`

- [ ] **Step 1: Write failing validation tests for PPh21 match and mismatch**

Append these tests inside the `describe("seedPeriod", () => { ... })` block in `backend/src/services/autoBufferManualAdjustmentSeederService.test.ts`:

```ts
it("validates POTONGAN PPH against db_ptrj PPh21 ADTRANS and marks SYNC when it equals pph21_ter", async () => {
    const extendedQueryCalls: SqlCall[] = [];
    const mainQueryCalls: SqlCall[] = [];

    const mockExtendedDb = {
        query: async (sql: string, params?: any[]) => {
            extendedQueryCalls.push({ sql, params: params || [] });
            if (sql.includes("SELECT id, emp_code, adjustment_name, amount, remarks")) {
                return [{
                    id: 40,
                    emp_code: "A0001",
                    nik: "1902050504860001",
                    adjustment_name: "POTONGAN PPH",
                    amount: 93435,
                    remarks: "POTONGAN PPH | DEPH21 - (DE) POTONGAN PPH21 | 93435 | sync:MISS | match:MISMATCH"
                }];
            }
            return [];
        }
    };

    const mockMainDb = {
        query: async (sql: string, params?: any[]) => {
            mainQueryCalls.push({ sql, params: params || [] });
            if (sql.includes("DEPH21") && sql.includes("POTONGAN PPH")) {
                return [{
                    emp_code: "A0001",
                    nik: "1902050504860001",
                    adjustment_name: "POTONGAN PPH",
                    total: -93435
                }];
            }
            return [];
        }
    };

    (Database as any).getExtendedInstance = () => mockExtendedDb;
    (Database as any).getInstance = () => mockMainDb;

    const service = AutoBufferManualAdjustmentSeederService.getInstance();
    const result = await service.validatePeriod({
        period_month: 4,
        period_year: 2026,
        division_code: "AB1",
        created_by: "tester"
    });

    expect(result.processed).toBe(1);
    expect(result.matches).toBe(1);
    expect(result.misses).toBe(0);
    expect(mainQueryCalls[0]?.sql).toContain("DEPH21");
    expect(mainQueryCalls[0]?.sql).toContain("POTONGAN PPH");

    const updateCall = extendedQueryCalls.find((call) => call.sql.includes("UPDATE dbo.payroll_manual_adjustments"));
    expect(updateCall?.params[0]).toBe("POTONGAN PPH | DEPH21 - (DE) POTONGAN PPH21 | 93435 | sync:SYNC | match:MATCH");
});

it("keeps POTONGAN PPH MISS when db_ptrj PPh21 differs from seeded pph21_ter", async () => {
    const extendedQueryCalls: SqlCall[] = [];

    const mockExtendedDb = {
        query: async (sql: string, params?: any[]) => {
            extendedQueryCalls.push({ sql, params: params || [] });
            if (sql.includes("SELECT id, emp_code, adjustment_name, amount, remarks")) {
                return [{
                    id: 41,
                    emp_code: "A0002",
                    nik: "1902050504860002",
                    adjustment_name: "POTONGAN PPH",
                    amount: 93435,
                    remarks: "POTONGAN PPH | DEPH21 - (DE) POTONGAN PPH21 | 93435 | sync:SYNC | match:MATCH"
                }];
            }
            return [];
        }
    };

    const mockMainDb = {
        query: async (sql: string) => {
            if (sql.includes("DEPH21") && sql.includes("POTONGAN PPH")) {
                return [{
                    emp_code: "A0002",
                    nik: "1902050504860002",
                    adjustment_name: "POTONGAN PPH",
                    total: -28655
                }];
            }
            return [];
        }
    };

    (Database as any).getExtendedInstance = () => mockExtendedDb;
    (Database as any).getInstance = () => mockMainDb;

    const service = AutoBufferManualAdjustmentSeederService.getInstance();
    const result = await service.validatePeriod({
        period_month: 4,
        period_year: 2026,
        division_code: "AB1",
        created_by: "tester"
    });

    expect(result.processed).toBe(1);
    expect(result.matches).toBe(0);
    expect(result.misses).toBe(1);

    const updateCall = extendedQueryCalls.find((call) => call.sql.includes("UPDATE dbo.payroll_manual_adjustments"));
    expect(updateCall?.params[0]).toBe("POTONGAN PPH | DEPH21 - (DE) POTONGAN PPH21 | 93435 | sync:MISS | match:MISMATCH");
});
```

- [ ] **Step 2: Run the focused seeder test and verify it fails**

Run:

```powershell
cd backend
bun test src/services/autoBufferManualAdjustmentSeederService.test.ts
```

Expected: FAIL because validation SQL does not include PPh21 conditions and does not map `POTONGAN PPH`.

- [ ] **Step 3: Extend the validation SQL CASE and filters**

In `backend/src/services/autoBufferManualAdjustmentSeederService.ts`, update the `trueValuesQuery`:

```ts
        const trueValuesQuery = `
            SELECT RTRIM(t.EmpCode) as emp_code,
                   MAX(RTRIM(ISNULL(e.NewICNo, ''))) as nik,
                   CASE
                       WHEN UPPER(ISNULL(ln.TaskCode, '')) LIKE '%DEPH21%'
                         OR UPPER(ISNULL(mt.TaskDesc, '')) LIKE '%POTONGAN PPH21%'
                         OR (
                            (UPPER(t.DocDesc) LIKE '%PPH%' OR UPPER(t.DocDesc) LIKE '%PAJAK%')
                            AND UPPER(t.DocDesc) NOT LIKE '%PREMI%'
                         ) THEN 'POTONGAN PPH'
                       WHEN UPPER(t.DocDesc) LIKE '%JABATAN%' THEN 'TUNJANGAN JABATAN'
                       WHEN UPPER(t.DocDesc) LIKE '%MASA%KERJA%' THEN 'MASA KERJA'
                       WHEN UPPER(t.DocDesc) LIKE '%SPSI%' THEN 'SPSI'
                   END as adjustment_name,
                   SUM(ln.Amount) as total
            FROM (
                SELECT t.EmpCode, t.ID, t.DocDesc, t.DocDate
                FROM PR_ADTRANS t
                ${gangJoin}
                WHERE t.DocDate >= ? AND t.DocDate < ? ${gangCondition}
                
                UNION ALL
                
                SELECT t.EmpCode, t.ID, t.DocDesc, t.DocDate
                FROM PR_ADTRANS_ARC t
                ${gangJoin}
                WHERE t.DocDate >= ? AND t.DocDate < ? ${gangCondition}
            ) t
            LEFT JOIN HR_EMPLOYEE e ON RTRIM(e.EmpCode) = RTRIM(t.EmpCode)
            JOIN (
                SELECT MasterID, TaskCode, Amount FROM PR_ADTRANSLN
                UNION ALL
                SELECT MasterID, TaskCode, Amount FROM PR_ADTRANSLN_ARC
            ) ln ON t.ID = ln.MasterID
            LEFT JOIN PR_TASKCODE mt ON RTRIM(mt.TaskCode) = RTRIM(ln.TaskCode)
            WHERE UPPER(t.DocDesc) LIKE '%JABATAN%' 
               OR UPPER(t.DocDesc) LIKE '%MASA%KERJA%' 
               OR UPPER(t.DocDesc) LIKE '%SPSI%'
               OR UPPER(ISNULL(ln.TaskCode, '')) LIKE '%DEPH21%'
               OR UPPER(ISNULL(mt.TaskDesc, '')) LIKE '%POTONGAN PPH21%'
               OR (
                    (UPPER(t.DocDesc) LIKE '%PPH%' OR UPPER(t.DocDesc) LIKE '%PAJAK%')
                    AND UPPER(t.DocDesc) NOT LIKE '%PREMI%'
               )
            GROUP BY RTRIM(t.EmpCode),
                   CASE 
                       WHEN UPPER(ISNULL(ln.TaskCode, '')) LIKE '%DEPH21%'
                         OR UPPER(ISNULL(mt.TaskDesc, '')) LIKE '%POTONGAN PPH21%'
                         OR (
                            (UPPER(t.DocDesc) LIKE '%PPH%' OR UPPER(t.DocDesc) LIKE '%PAJAK%')
                            AND UPPER(t.DocDesc) NOT LIKE '%PREMI%'
                         ) THEN 'POTONGAN PPH'
                       WHEN UPPER(t.DocDesc) LIKE '%JABATAN%' THEN 'TUNJANGAN JABATAN'
                       WHEN UPPER(t.DocDesc) LIKE '%MASA%KERJA%' THEN 'MASA KERJA'
                       WHEN UPPER(t.DocDesc) LIKE '%SPSI%' THEN 'SPSI'
                   END
        `;
```

- [ ] **Step 4: Run the focused seeder test and verify it passes**

Run:

```powershell
cd backend
bun test src/services/autoBufferManualAdjustmentSeederService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

Run:

```powershell
git add backend/src/services/autoBufferManualAdjustmentSeederService.ts backend/src/services/autoBufferManualAdjustmentSeederService.test.ts
git commit -m "fix: validate auto buffer potongan pph"
```

---

### Task 4: Include `POTONGAN PPH` In Manual Adjustment Sync Status Reconciliation

**Files:**
- Modify: `backend/src/services/manualAdjustmentService.test.ts`
- Modify: `backend/src/services/manualAdjustmentService.ts`

- [ ] **Step 1: Write failing sync-status test for `AUTO_BUFFER` `POTONGAN PPH`**

In `backend/src/services/manualAdjustmentService.test.ts`, add this test near the existing sync-status reconciliation tests:

```ts
it("reconciles AUTO_BUFFER POTONGAN PPH against PPh21 ADTRANS by absolute TER amount", async () => {
    const originalGetInstance = Database.getInstance;
    const calls: QueryCall[] = [];
    const dbExtend = {
        query: async (sql: string, params?: any[]) => {
            calls.push({ sql, params: params || [] });
            if (sql.includes("SELECT TOP") && sql.includes("FROM dbo.payroll_manual_adjustments")) {
                return [
                    {
                        id: 33,
                        period_month: 4,
                        period_year: 2026,
                        emp_code: "A0006",
                        gang_code: "G1H",
                        division_code: "AB1",
                        adjustment_type: "AUTO_BUFFER",
                        adjustment_name: "POTONGAN PPH",
                        amount: 93435,
                        remarks: "POTONGAN PPH | MANUAL EDIT | 93435 | sync:MISS | match:MISMATCH"
                    }
                ];
            }
            return [];
        }
    };
    const dbPtrj = {
        query: async (sql: string, params?: any[]) => {
            calls.push({ sql, params: params || [] });
            return [
                { emp_code: "A0006", doc_id: "AD007", doc_desc: "PPH21", amount: -93435 }
            ];
        }
    };

    (Database as any).getInstance = (database?: string) => database ? dbExtend : dbPtrj;

    try {
        const result = await manualAdjustmentService.updateManualAdjustmentSyncStatus({
            periodMonth: 4,
            periodYear: 2026,
            divisionCode: "AB1",
            adjustmentTypes: ["AUTO_BUFFER"],
            syncStatus: "SYNC",
            updatedBy: "agent_sync",
            onlyIfAdtransExists: true
        });

        const updateCalls = calls.filter((call) => call.sql.includes("UPDATE dbo.payroll_manual_adjustments"));
        expect(updateCalls).toHaveLength(1);
        expect(updateCalls[0].params).toEqual([
            "POTONGAN PPH | MANUAL EDIT | 93435 | sync:SYNC | match:MATCH",
            "agent_sync",
            33
        ]);
        expect(result.rows[0]).toMatchObject({
            id: 33,
            adjustment_type: "AUTO_BUFFER",
            adjustment_name: "POTONGAN PPH",
            target_amount: 93435,
            adtrans_amount: 93435,
            diff: 0,
            new_sync_status: "SYNC",
            match_status: "MATCH"
        });
    } finally {
        (Database as any).getInstance = originalGetInstance;
    }
});
```

- [ ] **Step 2: Run the focused manual adjustment test and verify failure**

Run:

```powershell
cd backend
bun test src/services/manualAdjustmentService.test.ts
```

Expected: FAIL if the row is not matched by fallback category mapping for PPh21 text.

- [ ] **Step 3: Add `POTONGAN PPH` category mapping**

In `backend/src/services/manualAdjustmentService.ts`, update `resolveManualAdjustmentAdtransCategory()`:

```ts
    if (adjustmentType === "AUTO_BUFFER") {
        const autoBufferName = normalizeAutoBufferAdjustmentName(adjustmentName);
        if (autoBufferName === "TUNJANGAN JABATAN") return "jabatan";
        if (autoBufferName === "MASA KERJA") return "masa kerja";
        if (autoBufferName === "SPSI") return "spsi";
        if (autoBufferName === "POTONGAN PPH") return "pph";
    }
```

This keeps ADCode/remarks matching as the first matching strategy and adds a clear fallback when remarks are incomplete.

- [ ] **Step 4: Run the focused manual adjustment test and verify it passes**

Run:

```powershell
cd backend
bun test src/services/manualAdjustmentService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

Run:

```powershell
git add backend/src/services/manualAdjustmentService.ts backend/src/services/manualAdjustmentService.test.ts
git commit -m "fix: reconcile auto buffer potongan pph sync"
```

---

### Task 5: Document Auto-Buffer PPh Behavior

**Files:**
- Modify: `docs/MANUAL_ADJUSTMENT_API.md`

- [ ] **Step 1: Update the auto-buffer documentation**

In `docs/MANUAL_ADJUSTMENT_API.md`, update the Auto Buffer Seeder section text from:

```md
Seeder untuk generate otomatis adjustment tipe `AUTO_BUFFER`. Digunakan untuk mengisi `AUTO TUNJANGAN JABATAN`, `AUTO MASA KERJA`, dan `AUTO SPSI` secara otomatis dari data payroll.
```

to:

```md
Seeder untuk generate otomatis adjustment tipe `AUTO_BUFFER`. Digunakan untuk mengisi `TUNJANGAN JABATAN`, `MASA KERJA`, `SPSI`, dan `POTONGAN PPH` secara otomatis dari data payroll. Nominal `POTONGAN PPH` selalu memakai hasil kalkulasi Daftar Upah `pph21_ter`; nilai `pot_pph21` dari Plantware/db_ptrj hanya dipakai sebagai pembanding status sync.
```

Update the response example totals so one employee produces four entries:

```json
{
  "period_month": 4,
  "period_year": 2026,
  "division_code": "AB1",
  "gang_code": "ALL",
  "source_rows": 25,
  "seeded_entries": 100,
  "inserted": 95,
  "updated": 0,
  "deleted_existing": 0,
  "replace_existing": true,
  "value_priority_mode_source": "db_ptrj_only"
}
```

- [ ] **Step 2: Review the changed documentation**

Run:

```powershell
git diff -- docs/MANUAL_ADJUSTMENT_API.md
```

Expected: diff only mentions the new fourth auto-buffer row and `pph21_ter` source-of-truth.

- [ ] **Step 3: Commit Task 5**

Run:

```powershell
git add docs/MANUAL_ADJUSTMENT_API.md
git commit -m "docs: describe auto buffer potongan pph"
```

---

### Task 6: Final Verification

**Files:**
- Verify only; no planned file edits.

- [ ] **Step 1: Run mapping tests**

Run:

```powershell
cd backend
bun test src/services/payroll/manualAdjustments/autoBufferAdcodeMap.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run auto-buffer seeder tests**

Run:

```powershell
cd backend
bun test src/services/autoBufferManualAdjustmentSeederService.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run required manual adjustment tests**

Run:

```powershell
cd backend
bun test src/services/manualAdjustmentService.test.ts
```

Expected: PASS.

- [ ] **Step 4: Inspect changed files**

Run:

```powershell
git status --short
git diff --stat
```

Expected: only intended files changed after the task commits. Existing unrelated dirty files may still appear; do not modify or revert them.

- [ ] **Step 5: Commit any uncommitted verification/doc cleanup**

If `git status --short` shows intended task files still modified, commit them:

```powershell
git add backend/src/services/payroll/manualAdjustments/autoBufferAdcodeMap.ts backend/src/services/payroll/manualAdjustments/autoBufferAdcodeMap.test.ts backend/src/services/autoBufferManualAdjustmentSeederService.ts backend/src/services/autoBufferManualAdjustmentSeederService.test.ts backend/src/services/manualAdjustmentService.ts backend/src/services/manualAdjustmentService.test.ts docs/MANUAL_ADJUSTMENT_API.md
git commit -m "chore: finalize auto buffer potongan pph"
```

Expected: commit created only if there are intended remaining changes.
