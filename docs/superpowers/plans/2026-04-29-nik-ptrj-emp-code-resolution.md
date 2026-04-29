# NIK PTRJ EmpCode Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize employee identifier detection so all-digit inputs resolve as NIK and PTRJ payroll queries receive letter-prefixed `emp_code` values.

**Architecture:** Extend `NikToNewestEmpCodeService` as the backend service boundary for identifier classification and NIK-to-PTRJ resolution. Then replace the two ad-hoc call sites found during discovery: employee batch checkroll and manual-adjustment `PR_ADTRANS` comparison.

**Tech Stack:** Bun test runner, TypeScript backend services, Elysia route module, SQL Gateway database client.

---

## File Structure

- Create: `backend/src/services/employee/NikToNewestEmpCodeService.test.ts`
  - Focused tests for classification, PTRJ pass-through, NIK resolution, and mixed batch resolution.
- Modify: `backend/src/services/employee/NikToNewestEmpCodeService.ts`
  - Add identifier classification and PTRJ resolver APIs while preserving existing NIK-only methods.
- Modify: `backend/src/api/employee.ts`
  - Replace inline `^\d{10,}$` batch-checkroll resolution and direct `HR_EMPLOYEE.NewICNo IN (...)` query with the central service.
- Modify: `backend/src/services/manualAdjustmentService.ts`
  - Replace local gang-scoped identity query before `PR_ADTRANS` comparison with the central service and `preferredGang`.

## Task 1: Central Resolver Tests and Service API

**Files:**
- Create: `backend/src/services/employee/NikToNewestEmpCodeService.test.ts`
- Modify: `backend/src/services/employee/NikToNewestEmpCodeService.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/services/employee/NikToNewestEmpCodeService.test.ts`:

```ts
import { afterEach, describe, expect, it } from "bun:test";
import { duplicateNikMitigationService } from "../DuplicateNikMitigationService";
import { NikToNewestEmpCodeService } from "./NikToNewestEmpCodeService";

const service = new NikToNewestEmpCodeService();

const originalResolveEmpCode = duplicateNikMitigationService.resolveEmpCode;
const originalBulkResolveEmpCodes = duplicateNikMitigationService.bulkResolveEmpCodes;

afterEach(() => {
    (duplicateNikMitigationService as any).resolveEmpCode = originalResolveEmpCode;
    (duplicateNikMitigationService as any).bulkResolveEmpCodes = originalBulkResolveEmpCodes;
});

describe("NikToNewestEmpCodeService identifier resolution", () => {
    it("classifies every all-digit identifier as NIK regardless of length", () => {
        expect(service.classifyIdentifier("7")).toEqual({
            input: "7",
            normalized: "7",
            type: "nik"
        });
        expect(service.classifyIdentifier(" 1902051212790002 ")).toEqual({
            input: " 1902051212790002 ",
            normalized: "1902051212790002",
            type: "nik"
        });
    });

    it("classifies letter-containing identifiers as PTRJ emp_code", () => {
        expect(service.classifyIdentifier(" b0745 ")).toEqual({
            input: " b0745 ",
            normalized: "B0745",
            type: "ptrj_emp_code"
        });
        expect(service.classifyIdentifier("123A")).toEqual({
            input: "123A",
            normalized: "123A",
            type: "ptrj_emp_code"
        });
    });

    it("passes PTRJ emp_code through as uppercase without database resolution", async () => {
        let resolveCalled = false;
        (duplicateNikMitigationService as any).resolveEmpCode = async () => {
            resolveCalled = true;
            throw new Error("PTRJ emp_code should not call NIK resolver");
        };

        const result = await service.resolveIdentifierToPtrjEmpCode(" b0745 ");

        expect(resolveCalled).toBe(false);
        expect(result).toMatchObject({
            input: " b0745 ",
            normalized_input: "B0745",
            identifier_type: "ptrj_emp_code",
            resolved_emp_code: "B0745",
            is_resolved: true,
            resolution_method: "passthrough",
            confidence: "high",
            all_emp_codes: ["B0745"]
        });
    });

    it("resolves all-digit NIK through duplicate-NIK mitigation", async () => {
        (duplicateNikMitigationService as any).resolveEmpCode = async (nik: string, options?: { preferredGang?: string }) => ({
            nik,
            resolved_emp_code: "C0533",
            resolution_method: options?.preferredGang ? "gang_match" : "latest",
            all_emp_codes: ["A0533", "C0533"],
            confidence: "high",
            notes: "mocked resolution"
        });

        const result = await service.resolveIdentifierToPtrjEmpCode("1902051212790002", {
            preferredGang: "C1H"
        });

        expect(result).toMatchObject({
            input: "1902051212790002",
            normalized_input: "1902051212790002",
            identifier_type: "nik",
            resolved_emp_code: "C0533",
            is_resolved: true,
            resolution_method: "gang_match",
            confidence: "high",
            all_emp_codes: ["A0533", "C0533"],
            notes: "mocked resolution"
        });
    });

    it("batch-resolves mixed NIK and PTRJ identifiers without returning unresolved NIK as emp_code", async () => {
        (duplicateNikMitigationService as any).bulkResolveEmpCodes = async (niks: string[]) => {
            expect(niks).toEqual(["1902051212790002", "999"]);
            return new Map([
                ["1902051212790002", {
                    nik: "1902051212790002",
                    resolved_emp_code: "C0533",
                    resolution_method: "latest",
                    all_emp_codes: ["C0533"],
                    confidence: "high",
                    notes: "mocked batch resolution"
                }]
            ]);
        };

        const results = await service.resolveIdentifiersToPtrjEmpCodes([
            " b0745 ",
            "1902051212790002",
            "999"
        ]);

        expect(results.get("B0745")?.resolved_emp_code).toBe("B0745");
        expect(results.get("1902051212790002")?.resolved_emp_code).toBe("C0533");
        expect(results.get("999")).toMatchObject({
            identifier_type: "nik",
            resolved_emp_code: null,
            is_resolved: false,
            notes: "NIK not found in HR_EMPLOYEE"
        });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd backend
bun test src/services/employee/NikToNewestEmpCodeService.test.ts
```

Expected: FAIL because `classifyIdentifier`, `resolveIdentifierToPtrjEmpCode`, and `resolveIdentifiersToPtrjEmpCodes` do not exist yet.

- [ ] **Step 3: Implement the minimal service API**

In `backend/src/services/employee/NikToNewestEmpCodeService.ts`, add these exported types after the existing imports:

```ts
export type EmployeeIdentifierType = "nik" | "ptrj_emp_code" | "invalid";

export interface EmployeeIdentifierClassification {
    input: string;
    normalized: string;
    type: EmployeeIdentifierType;
}

export interface PtrjEmpCodeResolutionOptions {
    preferredGang?: string;
}

export interface PtrjEmpCodeResolutionEntry {
    input: string;
    normalized_input: string;
    identifier_type: EmployeeIdentifierType;
    resolved_emp_code: string | null;
    is_resolved: boolean;
    resolution_method: NikResolutionResult["resolution_method"] | "passthrough" | "invalid";
    confidence: NikResolutionResult["confidence"];
    all_emp_codes: string[];
    notes?: string;
}
```

Inside `NikToNewestEmpCodeService`, add these methods before the existing `isValidNik` method:

```ts
classifyIdentifier(identifier: unknown): EmployeeIdentifierClassification {
    const input = String(identifier ?? "");
    const normalized = input.trim().toUpperCase();

    if (!normalized) {
        return { input, normalized, type: "invalid" };
    }

    if (/^\d+$/.test(normalized)) {
        return { input, normalized, type: "nik" };
    }

    if (/[A-Z]/.test(normalized)) {
        return { input, normalized, type: "ptrj_emp_code" };
    }

    return { input, normalized, type: "invalid" };
}

async resolveIdentifierToPtrjEmpCode(
    identifier: unknown,
    options?: PtrjEmpCodeResolutionOptions
): Promise<PtrjEmpCodeResolutionEntry> {
    const classification = this.classifyIdentifier(identifier);

    if (classification.type === "invalid") {
        return {
            input: classification.input,
            normalized_input: classification.normalized,
            identifier_type: "invalid",
            resolved_emp_code: null,
            is_resolved: false,
            resolution_method: "invalid",
            confidence: "low",
            all_emp_codes: [],
            notes: "Identifier is empty or invalid"
        };
    }

    if (classification.type === "ptrj_emp_code") {
        return {
            input: classification.input,
            normalized_input: classification.normalized,
            identifier_type: "ptrj_emp_code",
            resolved_emp_code: classification.normalized,
            is_resolved: true,
            resolution_method: "passthrough",
            confidence: "high",
            all_emp_codes: [classification.normalized]
        };
    }

    const resolution = await this.resolve(classification.normalized, options?.preferredGang);
    return {
        input: classification.input,
        normalized_input: classification.normalized,
        identifier_type: "nik",
        resolved_emp_code: resolution.resolved_emp_code,
        is_resolved: Boolean(resolution.resolved_emp_code),
        resolution_method: resolution.resolution_method,
        confidence: resolution.confidence,
        all_emp_codes: resolution.all_emp_codes,
        notes: resolution.notes
    };
}

async resolveIdentifiersToPtrjEmpCodes(
    identifiers: unknown[],
    options?: { preferredGangs?: Map<string, string> }
): Promise<Map<string, PtrjEmpCodeResolutionEntry>> {
    const results = new Map<string, PtrjEmpCodeResolutionEntry>();
    const niks: string[] = [];

    for (const identifier of identifiers || []) {
        const classification = this.classifyIdentifier(identifier);
        const key = classification.normalized;

        if (classification.type === "invalid") {
            results.set(key, {
                input: classification.input,
                normalized_input: key,
                identifier_type: "invalid",
                resolved_emp_code: null,
                is_resolved: false,
                resolution_method: "invalid",
                confidence: "low",
                all_emp_codes: [],
                notes: "Identifier is empty or invalid"
            });
            continue;
        }

        if (classification.type === "ptrj_emp_code") {
            results.set(key, {
                input: classification.input,
                normalized_input: key,
                identifier_type: "ptrj_emp_code",
                resolved_emp_code: key,
                is_resolved: true,
                resolution_method: "passthrough",
                confidence: "high",
                all_emp_codes: [key]
            });
            continue;
        }

        niks.push(key);
    }

    const preferredGangs = options?.preferredGangs
        ? new Map(Array.from(options.preferredGangs.entries()).map(([key, value]) => [
            String(key || "").trim().toUpperCase(),
            String(value || "").trim().toUpperCase()
        ]))
        : undefined;
    const nikResolutions = await this.resolveBatch(Array.from(new Set(niks)), preferredGangs);

    for (const nik of niks) {
        const resolution = nikResolutions.get(nik);
        results.set(nik, {
            input: nik,
            normalized_input: nik,
            identifier_type: "nik",
            resolved_emp_code: resolution?.resolved_emp_code || null,
            is_resolved: Boolean(resolution?.resolved_emp_code),
            resolution_method: resolution?.resolution_method || "single",
            confidence: resolution?.confidence || "low",
            all_emp_codes: resolution?.all_emp_codes || [],
            notes: resolution?.notes || "NIK not found in HR_EMPLOYEE"
        });
    }

    return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd backend
bun test src/services/employee/NikToNewestEmpCodeService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/employee/NikToNewestEmpCodeService.ts backend/src/services/employee/NikToNewestEmpCodeService.test.ts
git commit -m "feat(employee): centralize nik ptrj emp code resolution"
```

## Task 2: Use Central Resolver in Batch Checkroll

**Files:**
- Modify: `backend/src/api/employee.ts`
- Test: `backend/src/services/employee/NikToNewestEmpCodeService.test.ts`

- [ ] **Step 1: Write the regression expectation**

The service test from Task 1 already proves mixed batch identifiers produce PTRJ `emp_code` values and never return unresolved numeric NIK as `resolved_emp_code`. No new API test is added because `handleBatchCheckroll` is local to `employee.ts` and the route requires broader Elysia/auth setup.

- [ ] **Step 2: Verify the old inline implementation exists**

Run:

```bash
rg -n "nikToResolve|NewICNo\\) IN|\\^\\\\d\\{10,\\}" backend/src/api/employee.ts
```

Expected before implementation: output includes the batch-checkroll local NIK resolution block around `nikToResolve`.

- [ ] **Step 3: Replace local batch NIK resolution**

In `backend/src/api/employee.ts`, add this import with the other service imports:

```ts
import { nikToNewestEmpCodeService } from "../services/employee/NikToNewestEmpCodeService";
```

Replace the block starting at:

```ts
// OPTIMIZATION: Batch NIK Resolution - single query for all NIKs
const nikToResolve = empCodes.filter(code => typeof code === 'string' && code.trim() !== "" && /^\d{10,}$/.test(code.trim()));
const codeToResolve = empCodes.filter(code => typeof code === 'string' && code.trim() !== "" && !/^\d{10,}$/.test(code.trim()));
```

through the `if (nikToResolve.length > 0) { ... }` block with:

```ts
const resolvedEmpCodes: string[] = [];
const identifierResolutions = await nikToNewestEmpCodeService.resolveIdentifiersToPtrjEmpCodes(empCodes);

for (const originalIdentifier of empCodes) {
    const key = String(originalIdentifier || "").trim().toUpperCase();
    const resolution = identifierResolutions.get(key);

    if (resolution?.resolved_emp_code) {
        resolvedEmpCodes.push(resolution.resolved_emp_code);
        continue;
    }

    notFound.push({
        empCode: key || String(originalIdentifier || ""),
        reason: resolution?.notes || "Employee identifier not resolved"
    });
}

console.log(`[Batch Checkroll] Resolved ${resolvedEmpCodes.length}/${empCodes.length} identifiers to PTRJ EmpCode`);
```

Leave the existing `const db = Database.getInstance();` because later employee-info queries still use it.

- [ ] **Step 4: Verify old inline resolution is gone**

Run:

```bash
rg -n "nikToResolve|NewICNo\\) IN" backend/src/api/employee.ts
```

Expected: no output.

- [ ] **Step 5: Run focused tests**

Run:

```bash
cd backend
bun test src/services/employee/NikToNewestEmpCodeService.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/api/employee.ts
git commit -m "fix(employee): resolve batch identifiers through ptrj service"
```

## Task 3: Use Central Resolver Before PR_ADTRANS Comparison

**Files:**
- Modify: `backend/src/services/manualAdjustmentService.ts`
- Test: `backend/src/services/employee/NikToNewestEmpCodeService.test.ts`
- Test: `backend/src/services/manualAdjustmentService.test.ts`

- [ ] **Step 1: Write the regression expectation**

The service test from Task 1 already proves unresolved NIK values do not become PTRJ `emp_code` values. The manual-adjustment change should consume that service result before calling `checkAdtransDirectly`.

- [ ] **Step 2: Verify old local query exists**

Run:

```bash
rg -n "gangScopedIdentity|storedIdentifier, storedIdentifier, gangCode|employeeIdentityResolverService.resolve\\(storedIdentifier\\)" backend/src/services/manualAdjustmentService.ts
```

Expected before implementation: output includes the local `HR_EMPLOYEE`/`HR_GANGLN` lookup in the auto-buffer comparison path.

- [ ] **Step 3: Replace local identity lookup with central resolver**

In `backend/src/services/manualAdjustmentService.ts`, add this import near the existing service imports:

```ts
import { nikToNewestEmpCodeService } from "./employee/NikToNewestEmpCodeService";
```

Replace the `dbPtrj`, `ptrjEmpCodeByStoredIdentifier`, and `for (const row of adjustmentRows)` resolver block before the `PR_ADTRANS.EmpCode` comment with:

```ts
        const ptrjEmpCodeByStoredIdentifier = new Map<string, string>();
        for (const row of adjustmentRows) {
            const storedIdentifier = String(row.emp_code || '').trim();
            if (!storedIdentifier || ptrjEmpCodeByStoredIdentifier.has(storedIdentifier)) continue;

            const gangCode = String(row.gang_code || '').trim().toUpperCase();
            const resolution = await nikToNewestEmpCodeService.resolveIdentifierToPtrjEmpCode(storedIdentifier, {
                preferredGang: gangCode || undefined
            });

            if (resolution.resolved_emp_code) {
                ptrjEmpCodeByStoredIdentifier.set(storedIdentifier, resolution.resolved_emp_code);
            } else {
                console.warn(`[ManualAdjustment] Could not resolve identifier ${storedIdentifier} to PTRJ EmpCode: ${resolution.notes || 'unresolved'}`);
            }
        }
```

Keep the existing `employeeIdentityResolverService` import because `saveAdjustment` and sync detail code still use it for employee names.

- [ ] **Step 4: Verify old local query is gone**

Run:

```bash
rg -n "gangScopedIdentity|storedIdentifier, storedIdentifier, gangCode|employeeIdentityResolverService.resolve\\(storedIdentifier\\)" backend/src/services/manualAdjustmentService.ts
```

Expected: no output.

- [ ] **Step 5: Run focused tests**

Run:

```bash
cd backend
bun test src/services/employee/NikToNewestEmpCodeService.test.ts
bun test src/services/manualAdjustmentService.test.ts
```

Expected: both commands PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/manualAdjustmentService.ts
git commit -m "fix(payroll): use ptrj resolver for adtrans identifiers"
```

## Task 4: Final Verification

**Files:**
- Review: `backend/src/services/employee/NikToNewestEmpCodeService.ts`
- Review: `backend/src/api/employee.ts`
- Review: `backend/src/services/manualAdjustmentService.ts`

- [ ] **Step 1: Run focused backend tests**

```bash
cd backend
bun test src/services/employee/NikToNewestEmpCodeService.test.ts
bun test src/services/manualAdjustmentService.test.ts
```

Expected: both commands PASS.

- [ ] **Step 2: Confirm targeted ad-hoc resolution is removed**

```bash
rg -n "nikToResolve|NewICNo\\) IN" backend/src/api/employee.ts
rg -n "gangScopedIdentity|storedIdentifier, storedIdentifier, gangCode|employeeIdentityResolverService.resolve\\(storedIdentifier\\)" backend/src/services/manualAdjustmentService.ts
```

Expected: both commands produce no output.

- [ ] **Step 3: Review git diff for scoped changes**

```bash
git diff -- backend/src/services/employee/NikToNewestEmpCodeService.ts backend/src/services/employee/NikToNewestEmpCodeService.test.ts backend/src/api/employee.ts backend/src/services/manualAdjustmentService.ts
```

Expected: diff only contains resolver API, batch-checkroll resolver wiring, and manual-adjustment resolver wiring.

- [ ] **Step 4: Commit final verification note if any test-only or cleanup changes remain**

If Task 1-3 commits already include all changes, do not create an empty commit. If cleanup changes remain:

```bash
git add backend/src/services/employee/NikToNewestEmpCodeService.ts backend/src/services/employee/NikToNewestEmpCodeService.test.ts backend/src/api/employee.ts backend/src/services/manualAdjustmentService.ts
git commit -m "test(employee): verify nik ptrj resolver integration"
```
