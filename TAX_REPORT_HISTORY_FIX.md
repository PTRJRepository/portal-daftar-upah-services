# Fix Summary: Tax Report Month 3 Data Source Issue

## Problem
After seeding data for month 3 (March 2026), the tax report was not displaying the seeded data. Instead, it was trying to fetch from live payroll tables.

## Root Cause
The `fetchPayrollData` method in `taxReportService.ts` had the following logic:
1. **First**: Try to fetch LIVE data from `DataExtractorService` (queries `PR_TASKREGLN` and `PR_ADTRANS`)
2. **Fallback**: Only check history database if live data is **completely empty**

Since there was live data present (1611 rows from current payroll tables), the service never checked the history database where your seeded data was stored (1609 rows).

## Solution
Modified `fetchPayrollData` in `backend/src/services/taxReportService.ts` to:

1. **Detect if the requested period is historical** (past month) by comparing with current date
2. **For historical periods**: Try HISTORY data FIRST, then fallback to LIVE data
3. **For current/future periods**: Use LIVE data as before

### Code Change
```typescript
// BEFORE: Always tried LIVE data first
const originData = await DataExtractorService.extractPayrollData(...);
if (!originData || originData.data_rows.length === 0) {
    // Only then check history
}

// AFTER: Check if this is a historical request
const isHistoricalRequest = year < currentYear || (year === currentYear && month < currentMonth);
if (isHistoricalRequest) {
    // Try HISTORY data FIRST for past months
    const historyData = await historyDatabaseService.getHistoricalPayrollDataAsExtractorFormat(...);
    if (historyData && historyData.data_rows.length > 0) {
        return { data: historyData, isSourceCurrent: false };
    }
}
// Fallback to LIVE data
```

## Verification
After the fix, the diagnostic shows:
```
[TaxReportService] Historical period detected (3/2026) - checking HISTORY data first.
[TaxReportService] History data found: 1609 rows - using HISTORY as primary source.
Data Source: history
Total Employees: 1609
Total PPH21: 247,658,485
```

## Impact
- **Past months** (e.g., March 2026 when current is April 2026): Will use seeded history data
- **Current month** (April 2026): Will use live payroll data
- **Future months**: Will use live payroll data (if available)

## Files Modified
- `backend/src/services/taxReportService.ts` - Modified `fetchPayrollData` method (lines 417-463)

## Testing
Run the diagnostic script to verify:
```bash
bun run check_month3_tax_report.ts
```

Expected output should show `Data Source: history` and `Total Employees: 1609`.
