# ADJ DocDesc Filter Implementation

**Date:** 2026-04-05  
**Purpose:** Ignore/skip all entries with "ADJ" in the DocDesc field from payroll processing

## Overview

Implemented filtering to exclude any PR_ADTRANS/PR_ADTRANSLN records where `DocDesc` contains "ADJ" (adjustment) from all payroll calculations, header generation, and income processing.

## Files Modified

### 1. `backend/src/services/dataExtractorService.ts`
**Lines ~2105-2135**

Added `UPPER(t.DocDesc) NOT LIKE '%ADJ%'` to:
- Historical premi extraction query
- Non-historical premi extraction query

**Impact:** ADJ entries will not appear as dynamic premium columns in the payroll report.

### 2. `backend/src/services/payroll/extractors/PremiumExtractor.ts`
**Lines ~115-145**

Added `UPPER(t.DocDesc) NOT LIKE '%ADJ%'` to both:
- PR_ADTRANS query (active table)
- PR_ADTRANS_ARC query (archived table)

**Impact:** Premium extractor will ignore ADJ entries when extracting premium data.

### 3. `backend/src/services/payroll/components/PotonganService.ts`
**Line ~252**

Added `'ADJ'` to the `excludePatterns` array:
```typescript
const excludePatterns = ['POT', 'SPSI', 'BERAS', 'JABATAN', 'MASA', 'LEMBUR', 'PPH', 'PREMI', 'ASTEK', 'BPJS', 'ADJ'];
```

**Impact:** Dynamic potongan (deductions) processing will skip any DocDesc containing "ADJ".

### 4. `backend/src/services/payroll/otherIncomes/OtherIncomeProcessor.ts`
**Line ~207**

Added `AND UPPER(t.DocDesc) NOT LIKE '%ADJ%'` to the raw incomes query:
```sql
WHERE t.DocDate >= ? AND t.DocDate < ?
  AND t.DocType IN ('UPAH LEBIH', 'UPAH LAIN', 'POTONGAN TAMBAHAN')
  AND UPPER(t.DocDesc) NOT LIKE '%ADJ%'
```

**Impact:** ADJ entries will not be processed as other incomes (THR, Bonus, etc.).

### 5. `backend/src/services/headerService.ts`
**Lines ~88-106, ~139-157, ~162**

Added filtering in three places:
1. Dynamic premi headers query (gang-specific)
2. Dynamic premi headers query (all gangs)
3. Dynamic potongan headers query (gang-specific)
4. Dynamic potongan headers query (all gangs)
5. Added `'adj'` to the `excluded` patterns array for potongan headers

**Impact:** ADJ entries will not appear as column headers in AG Grid.

## Testing Recommendations

1. **Test with ADJ entries in database:**
   - Query `SELECT * FROM PR_ADTRANS WHERE UPPER(DocDesc) LIKE '%ADJ%'` to find ADJ entries
   - Run payroll report for the period containing ADJ entries
   - Verify ADJ entries do NOT appear in the report

2. **Verify normal entries still work:**
   - Ensure PREMI, POT, JABATAN, and other valid DocDesc entries still appear
   - Check that all payroll calculations are correct

3. **Check dynamic headers:**
   - Verify ADJ does not appear in column headers
   - Verify other dynamic headers still generate correctly

## Business Logic

**Why filter ADJ?**
- ADJ (Adjustment) entries are typically correction/reversal entries
- They should not be included in regular payroll calculations
- Filtering them out prevents double-counting or incorrect totals

**Filter Pattern:**
- Case-insensitive: `UPPER(t.DocDesc) NOT LIKE '%ADJ%'`
- Matches: "ADJ", "adj", "Adjustment", "ADJ_2024", etc.

## Notes

- All changes are backward compatible
- No database schema changes required
- Filter is applied at query level (no data deletion)
- ADJ entries remain in database for audit purposes
