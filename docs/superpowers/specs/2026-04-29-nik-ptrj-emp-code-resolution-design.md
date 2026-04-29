# NIK to PTRJ EmpCode Resolution Design

## Goal

Create a reliable backend service boundary for detecting employee identifiers and resolving NIK values to PTRJ `emp_code` values before payroll code queries PTRJ tables.

## Context

PTRJ payroll source tables such as `PR_ADTRANS` use letter-prefixed employee codes like `A0713`, `B0745`, or `C0533`. Several API and service paths currently accept either numeric NIK or PTRJ `emp_code`, then resolve them with local regex checks or direct `HR_EMPLOYEE` queries.

The repository already has partial identity services:

- `backend/src/services/employee/NikToNewestEmpCodeService.ts` resolves numeric NIK values through `DuplicateNikMitigationService`.
- `backend/src/services/employeeIdentityResolverService.ts` resolves one identifier through `HR_EMPLOYEE`.
- `backend/src/services/employee/EmployeeResolutionService.ts` has other NIK-oriented helpers.

The implementation should consolidate the NIK-vs-emp-code rule into one service-facing API and migrate the ad-hoc call sites that need PTRJ `emp_code`.

## Identifier Rules

- Trim input before classification.
- Empty input is invalid and unresolved.
- Any all-digit input is a NIK, regardless of length.
- Any non-empty input containing letters is treated as PTRJ `emp_code`.
- PTRJ `emp_code` output is normalized to uppercase.
- NIK values are resolved to PTRJ `emp_code` through the existing duplicate-NIK mitigation logic, preserving the current latest/preferred-gang behavior.
- Unresolved NIK values return a structured unresolved result instead of silently passing the numeric NIK into PTRJ payroll tables.

## Architecture

Enhance `NikToNewestEmpCodeService` into the central service for this scope. It already owns NIK-to-PTRJ resolution and wraps `DuplicateNikMitigationService`, so extending it avoids adding another overlapping resolver.

The service will expose:

- `classifyIdentifier(identifier)`: returns `nik`, `ptrj_emp_code`, or `invalid`.
- `resolveIdentifierToPtrjEmpCode(identifier, options?)`: resolves one identifier to PTRJ `emp_code`.
- `resolveIdentifiersToPtrjEmpCodes(identifiers, options?)`: resolves many identifiers with one API and returns per-input results.

The existing `resolve`, `resolveBatch`, and `getNewestEmpCode` methods remain available for compatibility.

## Data Flow

Single identifier:

1. Caller passes `nik` or `emp_code`.
2. Service trims and classifies input.
3. For PTRJ `emp_code`, service returns normalized uppercase value without database lookup.
4. For NIK, service calls the existing duplicate-NIK mitigation resolver.
5. Caller uses `resolved_emp_code` only when present.

Batch identifiers:

1. Caller passes mixed identifiers.
2. Service groups PTRJ `emp_code` and NIK values.
3. PTRJ `emp_code` values pass through normalized.
4. NIK values resolve via existing batch logic.
5. Returned map preserves every requested identifier's normalized key and resolution metadata.

## Integration Points

The initial refactor should update the call sites already shown to contain ad-hoc detection:

- `backend/src/api/employee.ts`
  - Replace `^\d{10,}$` batch-checkroll detection with the central service.
  - All-digit values become NIK. Letter-containing values become PTRJ `emp_code`.
  - Unresolved NIK values are reported in `not_found` and are not included in downstream PTRJ payroll extraction.
- `backend/src/services/manualAdjustmentService.ts`
  - Replace local identity lookup before `PR_ADTRANS` comparison with the central service.
  - `PR_ADTRANS` checks receive only PTRJ `emp_code` values.
  - Existing gang-scoped resolution behavior should be preserved by passing preferred gang where available.

Additional identity services can remain in place unless a touched call site needs this new PTRJ-specific contract.

## Error Handling

- Invalid empty identifiers return unresolved metadata.
- Unknown NIK returns unresolved metadata with a note such as `NIK not found in HR_EMPLOYEE`.
- Batch callers continue processing other identifiers when one NIK fails.
- No numeric NIK should be sent as `EmpCode` to PTRJ payroll tables after this refactor.

## Testing

Add focused Bun tests for `NikToNewestEmpCodeService`:

- Classifies all-digit strings as NIK.
- Classifies letter-containing strings as PTRJ `emp_code`.
- Normalizes PTRJ `emp_code` to uppercase.
- Resolves all-digit NIK through the existing NIK resolver path.
- Batch resolution preserves PTRJ pass-through values and unresolved NIK metadata.

Update or add narrow tests around the call sites if existing tests can cover them without requiring live database access.

## Out of Scope

- Changing duplicate-NIK ranking rules.
- Rewriting all employee identity services.
- Changing payroll formulas, history append behavior, or frontend rendering.
- Adding a new public API endpoint only for identity resolution.
