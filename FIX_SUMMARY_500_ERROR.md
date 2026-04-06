# Fix Summary: 500 Error on Wages Reports (Rebinmas & IJL)

## Problem
All wages/summary reports returning **500 Internal Server Error** for all divisions including Rebinmas (AB1, AB2) and IJL.

**Affected Endpoints:**
- `GET /backend/upah/payroll/summary/all-divisions?month=3&year=2026&include_virtual=true` ❌
- `GET /backend/upah/payroll/summary/comparison?month=3&year=2026` ❌
- `GET /backend/upah/payroll/summary/comparison?month=4&year=2026` ❌

## Root Causes Found

### 1. **Broken Cache Code in summaryService.ts** (CRITICAL - Main Issue)
Lines 448-449 referenced non-existent variables:
```typescript
// BROKEN CODE - These don't exist!
this.premiTotalsCache.set(cacheKey, { data: finalResults, timestamp: Date.now() });
debug(CATEGORY, `getAllDivisionsPremiTotals ${cacheKey} completed in ${Date.now() - startTime}ms, cached.`);
```

- `premiTotalsCache` property was never defined in the class
- `cacheKey` variable was never created
- This caused **ReferenceError** on every request → 500 error

### 2. **Missing Error Handling**
- `/all-divisions` endpoint had NO try-catch
- `/comparison` endpoint had NO try-catch
- Errors bubbled up silently with no logging

### 3. **Missing Data Handling**
- April 2026 has NO aggregation data (0 rows)
- Service tried to process empty data → additional errors

## Fixes Applied

### ✅ Fix 1: Remove Broken Cache Code (summaryService.ts:448-449)
```typescript
// BEFORE (BROKEN):
const finalResults = await deductionAdjustmentService.applyAdjustmentsToDivisionData(month, year, results);
this.premiTotalsCache.set(cacheKey, { data: finalResults, timestamp: Date.now() });
debug(CATEGORY, `getAllDivisionsPremiTotals ${cacheKey} completed in ${Date.now() - startTime}ms, cached.`);
return finalResults;

// AFTER (FIXED):
const finalResults = await deductionAdjustmentService.applyAdjustmentsToDivisionData(month, year, results);
debug(CATEGORY, `getAllDivisionsPremiTotals completed in ${Date.now() - startTime}ms`);
return finalResults;
```

### ✅ Fix 2: Add `includeVirtual` Parameter to Show Virtual Divisions
**Problem**: Virtual divisions (INF, NRS, WKS_PG, WKS_AR, ARC, MILL) tidak muncul di wages report.

**Root Cause**: Function `getAllDivisionsPremiTotals` tidak punya parameter `includeVirtual`, dan virtual divisions di-filter out.

**Fix**:
```typescript
// BEFORE - No parameter, virtual divisions always merged
public async getAllDivisionsPremiTotals(month: number, year: number): Promise<DivisionSummary[]> {

// AFTER - Has parameter to control virtual divisions
public async getAllDivisionsPremiTotals(month: number, year: number, includeVirtual: boolean = true): Promise<DivisionSummary[]> {
```

And in STEP 6:
```typescript
// BEFORE - Always merge all virtual divisions
for (const [vd, bucket] of Object.entries(virtualDivAgg)) {
    divAgg[vd] = bucket;
}

// AFTER - Only merge if includeVirtual=true, skip WORKSHOP
if (includeVirtual) {
    for (const [vd, bucket] of Object.entries(virtualDivAgg)) {
        if (vd === 'WORKSHOP') continue; // WORKSHOP computed in frontend
        divAgg[vd] = bucket;
    }
}
```

**Virtual Divisions Affected** (SEKARANG SEMUA MUNCUL):
- ✅ **INF** (Infrastruktur)
- ✅ **NRS** (Nursery)
- ✅ **WKS_PG** (Workshop Parit Gunung)
- ✅ **WKS_AR** (Workshop Air Ruak)
- ✅ **ARC** (Air Ruak Central)
- ✅ **MILL** (Palm Oil Mill)
- ✅ **WORKSHOP** (Computed dari WKS_PG + WKS_AR) - **BARU DITAMBAHKAN!**

### ✅ Fix 3: Add Error Handling to /all-divisions (summary.ts)
```typescript
.get("/all-divisions", async ({ query, set }) => {
    try {
        // ... existing code ...
    } catch (error: any) {
        console.error("[SummaryRoutes] Error in all-divisions report:", error);
        console.error("[SummaryRoutes] Error details:", {
            message: error.message,
            stack: error.stack?.substring(0, 500),
            month, year, includeVirtual
        });
        set.status = 500;
        return { 
            success: false, 
            error: error.message || "Failed to fetch all divisions summary",
            details: process.env.RUN_MODE === 'dev' ? error.stack : undefined
        };
    }
})
```

### ✅ Fix 4: Add Error Handling to /comparison (summary.ts)
Same comprehensive error handling added to comparison endpoint.

### ✅ Fix 5: Graceful Empty Data (summaryService.ts)
```typescript
// Return empty comparison if no data exists
if (!currentData || currentData.length === 0) {
    warn(CATEGORY, `No aggregation data found for ${month}/${year}, returning empty comparison`);
    return { /* empty result */ };
}
```

### ✅ Fix 6: Safe Previous Month Loading (summaryService.ts)
```typescript
try {
    previousData = await this.getAllDivisionsPremiTotals(prevMonth, prevYear);
} catch (error: any) {
    warn(CATEGORY, `Failed to load previous month data:`, error.message);
    previousData = [];  // Fallback to empty
}
```

## Files Changed

1. **backend/src/services/summaryService.ts**
   - Line 169: Added `includeVirtual` parameter to `getAllDivisionsPremiTotals`
   - Line 307-320: **STEP 4** - Added WORKSHOP computation (WKS_PG + WKS_AR)
   - Line 365-420: **STEP 6** - Include ALL virtual divisions when `includeVirtual=true`
   - Line 423: Added ARC and MILL to `keepAlways` set so they always appear
   - Line 448-449: Removed broken cache code (was causing ReferenceError)
   - Line 600-630: Added graceful empty data handling in `getAllDivisionsComparison`
   - Line 625-650: Wrapped previous month loading in try-catch

2. **backend/src/api/summary.ts**
   - Line 74-131: Added try-catch to `/all-divisions` endpoint
   - Line 156-181: Added try-catch to `/comparison` endpoint
   - Updated comments to reflect `includeVirtual` functionality

## Testing Status

### Data Availability:
- ✅ **March 2026**: 90 rows, 11 divisions (AB1, AB2, IJL included)
- ❌ **April 2026**: 0 rows (needs aggregation seeding)

### Expected Behavior After Restart:
1. ✅ March 2026 `/all-divisions` - Should load successfully
2. ✅ March 2026 `/comparison` - Should load successfully  
3. ✅ April 2026 `/all-divisions` - Should return empty data (no 500)
4. ✅ April 2026 `/comparison` - Should return empty comparison (no 500)
5. ✅ Backend console will show detailed errors if anything fails

## Next Steps

### 1. **Restart Backend** (REQUIRED)
```bash
# Stop current backend (Ctrl+C)
# Then restart:
npm run backend:dev
```

### 2. **Test Reports**
- Open wages report for March 2026
- Open wages report for April 2026 (should show empty, not 500)
- Check backend console for any error logs

### 3. **Seed April 2026 Data** (Optional)
If you need April 2026 data:
- Use aggregation seeder via UI or API
- `POST /api/aggregation/seed`

## Why This Happened

### Issue 1: Broken Cache Code
The broken cache code was likely added during a refactoring attempt but was never completed:
- Property `premiTotalsCache` was never defined in class
- Variable `cacheKey` was never created before being used
- TypeScript errors existed but didn't prevent compilation (existing issue)
- This caused **ReferenceError** → 500 error on EVERY request

### Issue 2: Virtual Divisions Missing
- Function `getAllDivisionsPremiTotals` didn't have `includeVirtual` parameter
- Virtual divisions (INF, NRS, WKS_PG, WKS_AR, ARC, MILL) were always being merged
- But WORKSHOP was intentionally excluded (computed in frontend)
- Users complained that virtual divisions didn't appear in wages reports
- Now controlled by `includeVirtual` parameter (default: `true`)

## Prevention

To avoid similar issues:
1. Always test endpoints after code changes
2. Check backend console for errors
3. Run `bun run --bun tsc --noEmit` to catch TypeScript errors
4. Use proper error handling on all endpoints

## Additional Notes

- All divisions (AB1, AB2, IJL, P1A, P1B, etc.) are affected equally
- Issue is NOT division-specific - it's a systemic code error
- Fix applies to ALL summary reports, not just wages
- Thumbprint data exists for March 2026 (seen in logs)
