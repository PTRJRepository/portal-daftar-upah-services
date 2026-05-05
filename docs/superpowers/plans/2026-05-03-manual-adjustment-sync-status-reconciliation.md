# Manual Adjustment Sync Status Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-audit manual adjustment sync remarks from current Plantware ADTRANS totals, including AUTO_BUFFER and previously synced rows.

**Architecture:** Keep the existing `/payroll/manual-adjustment/seed-sync-status` endpoint and `ManualAdjustmentSyncStatusSeederService` facade. Move the status decision into `ManualAdjustmentService.updateManualAdjustmentSyncStatus()` by totaling matched ADTRANS details per row and rewriting both `sync:` and `match:` remark segments.

**Tech Stack:** Bun test, TypeScript backend services, Elysia route, React Seeder page payload.

---

## File Structure

- Modify `backend/src/utils/manualAdjustmentRemarkParser.ts`: add a pipe-delimited status updater that can update both `sync:` and `match:` segments.
- Modify `backend/src/utils/manualAdjustmentRemarkParser.test.ts`: test `sync:DIFF | match:MISMATCH` and `sync:MISS | match:MISMATCH` rewrites.
- Modify `backend/src/services/manualAdjustmentService.ts`: include AUTO_BUFFER sync types, compare total ADTRANS amounts, and return `diff`.
- Modify `backend/src/services/manualAdjustmentService.test.ts`: add focused tests for summing, DIFF, MISS, AUTO_BUFFER, and absolute potongan comparison.
- Modify `backend/src/services/manualAdjustmentSyncStatusSeederService.ts`: default types include `AUTO_BUFFER`.
- Modify `backend/src/services/manualAdjustmentSyncStatusSeederService.test.ts`: assert default payload includes `AUTO_BUFFER`.
- Modify `frontend/src/pages/AggregationSeederPage.jsx`: include AUTO_BUFFER in the UI payload and logs.

### Task 1: Remark Status Parser

**Files:**
- Modify: `backend/src/utils/manualAdjustmentRemarkParser.ts`
- Test: `backend/src/utils/manualAdjustmentRemarkParser.test.ts`

- [ ] **Step 1: Write the failing tests**

Add tests that call the new updater:

```typescript
expect(updatePipeDelimitedSyncAndMatchStatus(
    "PREMI JAGA | AL0018 - JAGA | 350000 | sync:SYNC | match:MATCH",
    "DIFF",
    "MISMATCH"
)).toEqual({
    remarks: "PREMI JAGA | AL0018 - JAGA | 350000 | sync:DIFF | match:MISMATCH",
    oldSyncStatus: "SYNC",
    newSyncStatus: "DIFF",
    oldMatchStatus: "MATCH",
    newMatchStatus: "MISMATCH",
    changed: true
});
```

- [ ] **Step 2: Run parser test to verify failure**

Run: `bun test src/utils/manualAdjustmentRemarkParser.test.ts`

Expected: fail because `updatePipeDelimitedSyncAndMatchStatus` is not exported.

- [ ] **Step 3: Implement the parser updater**

Add exported function:

```typescript
export function updatePipeDelimitedSyncAndMatchStatus(value: unknown, syncStatus: unknown, matchStatus: unknown): PipeDelimitedSyncAndMatchStatusUpdate | null
```

It must preserve all non-status segments and return `changed: false` when both statuses are already equal.

- [ ] **Step 4: Run parser test to verify pass**

Run: `bun test src/utils/manualAdjustmentRemarkParser.test.ts`

Expected: pass.

### Task 2: Backend Reconciliation Logic

**Files:**
- Modify: `backend/src/services/manualAdjustmentService.ts`
- Test: `backend/src/services/manualAdjustmentService.test.ts`

- [ ] **Step 1: Write failing service tests**

Add tests for these cases:

```typescript
// Existing sync row, ADTRANS total differs -> updates to DIFF/MISMATCH.
// Two ADTRANS detail rows 200000 + 150000 equal target 350000 -> stays or updates to SYNC/MATCH.
// No ADTRANS detail -> updates to MISS/MISMATCH.
// AUTO_BUFFER MASA KERJA maps to "masa kerja" and is processed.
// POTONGAN_KOTOR target -10000 matches ADTRANS amount 10000 by absolute value.
```

- [ ] **Step 2: Run service test to verify failure**

Run: `bun test src/services/manualAdjustmentService.test.ts`

Expected: new tests fail because AUTO_BUFFER is filtered out and mismatch rows are skipped instead of updated to DIFF/MISMATCH.

- [ ] **Step 3: Implement reconciliation**

Change `ManualAdjustmentSyncStatusRowResult` to include:

```typescript
diff: number | null;
match_status: string | null;
```

Change sync type normalization to allow `AUTO_BUFFER`. Remove the SQL and post-query exclusion that blocks AUTO_BUFFER. Replace partial/missing skip decisions with:

```typescript
const hasAdtrans = matchingDetails.length > 0 && totalAmountAbs > 0.01;
const isMatch = hasAdtrans && Math.abs(totalAmountAbs - targetAmountAbs) <= 0.01;
const nextSyncStatus = isMatch ? "SYNC" : hasAdtrans ? "DIFF" : "MISS";
const nextMatchStatus = isMatch ? "MATCH" : "MISMATCH";
```

Use the new parser updater to update both `sync:` and `match:`.

- [ ] **Step 4: Run service test to verify pass**

Run: `bun test src/services/manualAdjustmentService.test.ts`

Expected: pass.

### Task 3: Seeder Defaults And UI Payload

**Files:**
- Modify: `backend/src/services/manualAdjustmentSyncStatusSeederService.ts`
- Test: `backend/src/services/manualAdjustmentSyncStatusSeederService.test.ts`
- Modify: `frontend/src/pages/AggregationSeederPage.jsx`

- [ ] **Step 1: Write failing seeder test**

Update expected default types:

```typescript
["PREMI", "POTONGAN_KOTOR", "POTONGAN_BERSIH", "AUTO_BUFFER"]
```

- [ ] **Step 2: Run seeder test to verify failure**

Run: `bun test src/services/manualAdjustmentSyncStatusSeederService.test.ts`

Expected: fail because default list does not include `AUTO_BUFFER`.

- [ ] **Step 3: Implement defaults and UI payload**

Set the backend default list and frontend payload/log label to include `AUTO_BUFFER`.

- [ ] **Step 4: Run focused tests**

Run:

```bash
bun test src/services/manualAdjustmentSyncStatusSeederService.test.ts
bun test src/services/manualAdjustmentService.test.ts
```

Expected: pass.

### Task 4: Verification

**Files:**
- Verify backend tests only unless frontend compile catches syntax.

- [ ] **Step 1: Run focused backend tests**

Run:

```bash
bun test src/utils/manualAdjustmentRemarkParser.test.ts
bun test src/services/manualAdjustmentSyncStatusSeederService.test.ts
bun test src/services/manualAdjustmentService.test.ts
```

Expected: pass.

- [ ] **Step 2: Run frontend build if UI file changed**

Run from `frontend`: `npm run build`

Expected: build completes.
