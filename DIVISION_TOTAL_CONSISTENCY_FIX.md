# Division Total Consistency Fix - Summary

## Problem
Division totals in wages report and other reports were showing incorrect values due to:
1. Virtual gangs (AMC, INF, INT, B2N, HMC) not being properly subtracted from parent divisions
2. Division code aliases (PG1A, PG1B, etc.) not being normalized to canonical codes (P1A, P1B)
3. Inconsistent handling across different report endpoints

## Solution Applied

### 1. Fixed Virtual Gang Subtraction (`backend/src/services/summaryService.ts`)
- **Line 382-406**: Added `resolveDivisionAlias()` function to handle division code aliases
- **Problem**: Virtual gangs were being subtracted from 'P1A' but actual data was stored as 'PG1A'
- **Fix**: Now resolves P1A → PG1A before subtraction

### 2. Added Division Code Normalization (`backend/src/services/summaryService.ts`)
- **Line 569-595**: Added Step 6.5 to normalize all division codes
- **Aliases normalized**:
  - PG1A, P1a, pg1a, PLASMA1A → P1A
  - PG1B, P1b, pg1b, PLASMA1B → P1B
  - PG2A, P2a, pg2a, PLASMA2A → P2A
  - PG2B, P2b, pg2b, PLASMA2B → P2B

### 3. Fixed Description Lookup (`backend/src/services/summaryService.ts`)
- **Line 631-646**: Added reverse alias lookup for descriptions
- **Ensures**: P1A gets description from PG1A if not found directly

### 4. Fixed Wages Recap-All Endpoint (`backend/src/api/wagesRoutes.ts`)
- **Line 163-166**: Added virtual divisions to division list
- **Line 236-254**: Fixed gang-to-division mapping logic
- **Line 258-293**: Added division code normalization to match summary service

## Reports Fixed

All reports now show consistent, correct totals:

### ✅ Wages Summary Report (`/upah/wages-rebinmas`)
- **Endpoint**: `/payroll/summary/all-divisions`
- **P1A Total**: 893.458.118,76 (expected: 893.458.119) ✓
- **Method**: Uses `getAllDivisionsPremiTotals()` with normalization

### ✅ Wages Comparison Report
- **Endpoint**: `/payroll/summary/comparison`
- **Method**: Uses `getAllDivisionsPremiTotals()` for both current and previous months
- **Consistency**: ✓ Same data source, same normalization

### ✅ Impact Report
- **Endpoint**: `/payroll/summary/impact-report`
- **Method**: Uses `getAllDivisionsPremiTotals()` for current and previous data
- **Consistency**: ✓ Same data source, same normalization

### ✅ Wages Recap-All Report
- **Endpoint**: `/payroll/wages/recap-all`
- **Method**: Direct query with gang-to-division mapping
- **Consistency**: ✓ Now includes normalization matching summary service

## Grand Total Consistency

All reports now share:
1. **Same data source**: `daftar_upah_aggregation_history`
2. **Same normalization**: Alias mapping applied consistently
3. **Same virtual division handling**: AMC→WKS_PG, INF/INT→INF, B2N→NRS, HMC→WKS_AR
4. **Same subtraction logic**: Virtual gangs subtracted from parent divisions

## Verification

### P1A Division (March 2026)
- **Before Fix**: 1.419.539.324,98 (included virtual gangs)
- **After Fix**: 893.458.118,76 ✓
- **Gangs**: 8 (A1H, A1M, A1T, A2M, A2T, A3H, A3M, A3T)
- **Employees**: 184
- **Description**: "Parit Gunung 1A" (correctly resolved)

### Virtual Divisions Separated
- **INF (Infrastruktur)**: 268.241.870,26 (56 employees, 2 gangs)
- **NRS (Nursery)**: 203.476.408,84 (42 employees, 1 gang)
- **WKS_PG (Workshop PG)**: 257.839.335,96 (45 employees, 1 gang)
- **WKS_AR (Workshop AR)**: 52.297.557,98 (10 employees, 1 gang)
- **WORKSHOP (Combined)**: 310.136.893,94 (55 employees, 2 gangs)

## Files Modified

1. `backend/src/services/summaryService.ts` - Core normalization logic
2. `backend/src/api/wagesRoutes.ts` - Recap-all endpoint normalization

## Commits

1. **608e3b0** - `fix: Correct division totals in wages report`
2. **d92a28e** - `fix: Ensure grand total consistency across all reports`

## Testing

Run verification:
```bash
bun run check_p1a_summary.ts
```

Expected output:
- P1A Total: 893.458.118,76
- Description: "Parit Gunung 1A"
- Total Gangs: 8
- Total Employees: 184
