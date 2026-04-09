# PPh21 Discrepancy Fix - ARA Division

## Problem

**PPh21 berbeda antara Daftar Upah dan Export Pajak untuk ARA:**

| Report | Employees | PPh21 Total |
|--------|-----------|-------------|
| Daftar Upah (Aggregation) | 139 | 784.267 |
| Tax Report | 130 | 678.917 |
| **Difference** | **-9** | **-105.350** (-13.43%) |

## Root Causes Identified

### 1. Missing Gangs in Tax Report

**F1BHL (PERCOBAAN HARVESTING BUKIT PANJANG)**:
- 2 employees: F0520 (NORMAN), F0524 (SAMRONI)
- Exists in HR_GANG and HR_GANGLN (live tables)
- **NOT in PR_GANGLN_ARC** for 2/2026 (historical table)
- Present in Aggregation (was seeded previously)
- **Missing from Tax Report** (queries PR_GANGLN_ARC for historical periods)

**F2 (PERCOBAAN HARVESTING PADANG PANJANG)**:
- 3 employees in aggregation history
- Exists in HR_GANG but **NOT in HR_GANGLN** (no active employees)
- **NOT in PR_GANGLN_ARC** for 2/2026
- Present in Aggregation (seeded from older data)
- **Missing from Tax Report**

### 2. Employee Count Differences

Some gangs have different employee counts:

| Gang | Aggregation | Tax Report | Difference |
|------|-------------|------------|------------|
| F1H | 32 | 29 | -3 |
| F2H | 31 | 30 | -1 |
| F2T | 8 | 9 | +1 |

**Reason**: Tax Report uses `isHistorical=true` for period 2/2026 (because current period is 3/2026), which queries PR_GANGLN_ARC. Some employees may:
- Have transactions in PR_TASKREGLN but NOT registered in PR_GANGLN_ARC for the correct accounting period
- Be filtered out by the historical query conditions

## Data Flow Analysis

### Daftar Upah (Aggregation)
```
History Seeder → extractPayrollData (2/2026)
  → Queries HR_GANGLN (live) OR PR_GANGLN_ARC (historical)
  → For 2/2026: Used live data (HR_GANGLN)
  → Saved to daftar_upah_aggregation_history
  → INCLUDES F1BHL and F2
```

### Tax Report
```
getMonthlyTaxReport (2/2026)
  → currentPeriodService.getCurrentPeriod() = 3/2026
  → 2/2026 < 3/2026, so isHistorical = true
  → Queries PR_GANGLN_ARC with AccMonth=2, AccYear=2026
  → EXCLUDES F1BHL and F2 (not in ARC table)
```

## Solutions

### Option 1: Re-seed Aggregation with Historical Data (RECOMMENDED)

Re-seed ARA division to ensure aggregation matches Tax Report data source:

```bash
npm run seed:division ARA 2 2026
```

**Effect**: This will re-query data for 2/2026 and should match Tax Report more closely.

### Option 2: Include Missing Gangs in Tax Report

Modify Tax Report to fallback to live tables when historical data is missing:

**File**: `backend/src/services/taxReportService.ts`

In `fetchPayrollData()` method, add fallback logic:
```typescript
// If historical query returns no data for specific gangs,
// fallback to live HR_GANGLN for those gangs
if (historicalRows.length === 0 || missingGangs.length > 0) {
    const liveRows = await this.getEmployeesFromLiveTable(missingGangs, month, year);
    historicalRows.push(...liveRows);
}
```

### Option 3: Force Tax Report to Use Current Period Logic

For recent months (within 1-2 months), use current/live path instead of historical:

**File**: `backend/src/services/taxReportService.ts`

Change threshold:
```typescript
// Use historical path only for periods older than 2 months
const isHistorical = (year < currentYear) || 
                     (year === currentYear && month < currentMonth - 1);
```

## Recommended Action Plan

### Immediate (Today)
1. ✅ **This document created** - root cause identified
2. **Re-seed ARA for 2/2026**:
   ```bash
   npm run seed:division ARA 2 2026
   ```
3. **Verify PPh21 after re-seeding**:
   - Check aggregation history for ARA
   - Compare with Tax Report
   - Should now match

### Short-term (This Week)
4. **Add validation** to detect gang mismatches:
   - Script to compare gangs in aggregation vs HR_GANGLN
   - Alert when gangs are missing
   
5. **Fix employee filtering** in Tax Report:
   - Ensure all employees with transactions are included
   - Check PR_GANGLN_ARC registration logic

### Long-term (Next Month)
6. **Unify data sources**:
   - Both Daftar Upah and Tax Report should use same data extraction method
   - Consider creating a shared service for employee + gang resolution
   
7. **Add automated tests**:
   - Test that PPh21 matches between reports
   - Test that all gangs are included

## Files Involved

- `backend/src/services/taxReportService.ts` - Tax Report service
- `backend/src/services/dataExtractorService.ts` - Payroll data extraction
- `backend/src/services/historySeederService.ts` - Aggregation seeding
- `backend/src/services/currentPeriodService.ts` - Period determination
- `backend/src/services/summaryService.ts` - Aggregation queries

## Verification Steps

After applying fixes, verify:

1. **Check ARA gangs in aggregation**:
   ```bash
   bun run check_f1bhl_gang.ts
   bun run compare_pph21_ara.ts
   ```

2. **Compare PPh21 totals**:
   ```bash
   bun run compare_pph21_detailed.ts
   ```

3. **Expected result**:
   - All ARA gangs present (F1BHL, F1H, F1M, F1T, F2, F2H, F2M, F2T)
   - Employee count matches between reports
   - PPh21 totals match (within rounding tolerance)

## Date
2026-04-08

## Status
🔍 **DIAGNOSED** - Root cause identified, fix pending
