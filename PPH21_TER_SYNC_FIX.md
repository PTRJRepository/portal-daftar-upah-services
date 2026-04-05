# PPh21 TER Synchronization Fix

## Problem Summary

Pajak TER dan pajak input tidak sama - tax report showing **0** for most employees when reading from history database, while daftar upah showed correct values.

### Example Issue
For gang **A1H** in division **P1A**:
- **Expected total PPh21 TER**: ~8,719,772 (from proper calculation)
- **Actual from history database**: 241,791 (only 3 out of 31 employees had values)
- **Most employees**: pph21_ter = **0**

## Root Causes

### 1. **dataExtractorService.ts - Phase 4b Bug**
**File**: `backend/src/services/dataExtractorService.ts`

**Problem**: PPh21 TER was only calculated for employees **WITH** other incomes (THR, Bonus, Custom).

```typescript
// BEFORE: Inside "if incomes.length > 0" block
for (const emp of employees) {
    const incomes = incomeByEmp.get(emp.emp_code) || [];
    // ... only calculated if incomes.length > 0
    if (incomes.length > 0) {
        // PPh21 TER calculated HERE
        const pphResult = pph21TerService.calculatePph21Ter(...);
        emp.pph21_ter = pphResult.tax_amount;
    }
}
```

**Impact**: 
- Employees WITHOUT THR/Bonus/Custom incomes never got PPh21 TER calculated
- History database stored `pph21_ter = 0` for most employees
- Only ~10% of employees had tax values in history

### 2. **taxReportService.ts - Recalculation Mismatch**
**File**: `backend/src/services/taxReportService.ts`

**Problem**: Tax report was **recalculating** PPh21 instead of using stored values.

```typescript
// BEFORE: Always recalculated
const penghasilanBruto = calculatePenghasilanBruto(...);
penghasilanBruto += (thrAmount + exgratiaAmount); // Added THR again!
const pphResult = pph21TerService.calculatePph21Ter(penghasilanBruto, masterPtkp);
const pph21 = pphResult.tax_amount; // Different from stored value!
```

**Impact**:
- Different THR amounts caused different PPh21 calculations
- Tax report didn't match daftar upah (original payroll calculation)
- Made cross-validation impossible

## Solutions Applied

### Fix 1: Calculate PPh21 TER for ALL Employees

**File**: `backend/src/services/dataExtractorService.ts` (Line ~3838)

**Changes**:
1. Moved PPh21 TER calculation **OUTSIDE** the "other incomes" loop
2. Now runs for **EVERY** employee in the payroll
3. Always calculates `penghasilan_bruto` with employer BPJS portions

```typescript
// AFTER: Separate loop for ALL employees
debug(CATEGORY, `🧮 Calculating PPh21 TER for all ${employees.length} employees...`);
let employeesWithTax = 0;
for (const emp of employees) {
    // ALWAYS recalculate penghasilan_bruto
    const caruman = calculateAllCaruman(...);
    emp.penghasilan_bruto = (emp.jumlah_upah_kotor || 0) + astekMajikan + bpjsMajikan;

    // Calculate PPh21 TER for EVERYONE
    const pphResult = pph21TerService.calculatePph21Ter(emp.penghasilan_bruto, statusPTKP);
    emp.pph21_ter = pphResult.tax_amount || 0;
    emp.tarif_pajak_ter = pphResult.rate_percent || 0;
    
    if (emp.pph21_ter > 0) {
        employeesWithTax++;
    }
}
debug(CATEGORY, `✅ PPh21 TER calculated: ${employeesWithTax}/${employees.length} employees with tax > 0`);
```

### Fix 2: Use Stored PPh21 Values in Tax Report

**File**: `backend/src/services/taxReportService.ts` (Line ~682)

**Changes**:
1. Check if stored `pph21_ter` or `pot_pph21` exists in row data
2. Use stored value if available (from original payroll calculation)
3. Only recalculate if no stored value exists (current period, missing data)

```typescript
// AFTER: Use stored value first
const storedPph21Ter = row.pph21_ter || row.pot_pph21 || 0;

let pph21: number;
let tarifPajakTer: number;

if (storedPph21Ter > 0) {
    // Use stored tax value from original payroll calculation
    pph21 = storedPph21Ter;
    // Calculate effective rate for display
    tarifPajakTer = penghasilanBruto > 0 ? (pph21 / penghasilanBruto) * 100 : 0;
} else {
    // No stored value - calculate fresh (for current period or missing data)
    const pphResult = pph21TerService.calculatePph21Ter(penghasilanBruto, masterPtkp);
    pph21 = pphResult.tax_amount;
    tarifPajakTer = pphResult.rate_percent;
}
```

## Expected Results After Fix

### For New History Seeding
When re-seeding history data:
- ✅ **ALL employees** get PPh21 TER calculated (not just those with other incomes)
- ✅ `pph21_ter` field populated correctly in `payroll_history_detail`
- ✅ Expected: 100% of employees with valid income should have `pph21_ter > 0`

### For Tax Reports
When viewing tax reports:
- ✅ Tax report uses **same PPh21 values** as daftar upah
- ✅ No recalculation discrepancies
- ✅ Cross-validation shows **0 differences**
- ✅ THR amounts don't cause double-counting or mismatches

## Testing Instructions

### 1. Re-seed History Data
```bash
# Use the seeder API to re-seed historical data
POST /api/aggregation/seed
{
    "month": 1,
    "year": 2025,
    "divisionCode": "P1A",
    "gangCode": "A1H"
}
```

### 2. Verify PPh21 TER in History
```bash
# Run debug script to check values
bun run backend/src/scripts/debug_pph21_history.ts
```

Expected output:
```
Total employees: 31
Employees with pph21_ter > 0: 31 (was: 3)
Total pph21_ter: 8,719,772 (was: 241,791)
```

### 3. Compare Daftar Upah vs Tax Report
```bash
# Run comparison script
bun run backend/src/tests/check_history_data.ts
```

Expected: All `diffs.pph21` values should be **0** or very close (< 10 rounding difference)

## Files Changed

1. **backend/src/services/dataExtractorService.ts**
   - Added separate PPh21 TER calculation loop for all employees
   - Moved outside "other incomes" conditional block
   - Lines: ~3838-3873

2. **backend/src/services/taxReportService.ts**
   - Modified to use stored PPh21 values instead of recalculating
   - Added fallback to recalculation only when stored value missing
   - Lines: ~682-711

## Commit Info

```
Commit: 0ed42f3
Branch: server-history-3
Message: fix: Synchronize PPh21 TER between payroll calculation and tax report
```

## Important Notes

⚠️ **Existing History Data Still Has Zeros**
- Already-seeded history data will still show `pph21_ter = 0` for most employees
- **Solution**: Re-seed all historical periods using the aggregation seeder

⚠️ **THis Fix Affects Future Seeding Only**
- The fix ensures NEW seeding will have correct values
- Does NOT retroactively fix old seeded data

⚠️ **Tax Report Now Reads Stored Values**
- Tax report will now match daftar upah exactly
- Any previous mismatches were due to recalculation with different inputs

## Next Steps

1. **Re-seed all historical periods** (Jan-Dec 2025) for all divisions
2. **Verify** PPh21 TER values in history database
3. **Run** comparison script to confirm synchronization
4. **Update** frontend to display stored PPh21 values consistently

## Related Documentation

- `MASA_KERJA_PPH21_FIX.md` - Previous PPh21 calculation fixes
- `SEEDER_FIX.md` - History seeder implementation details
- `QWEN.md` - Project context and tax calculation rules
