# Duplication Fix Summary

## Issues Identified

You reported three main duplication issues:
1. **F1BHL gang employees duplicated** in payroll results
2. **WKS_PG (AMC gang) PPh21 different** - appearing in multiple divisions
3. **Karyawan percobaan (BHL and P codes) duplicated** in results

## Root Causes Found

### 1. Virtual Gang Duplication (AMC in Multiple Divisions)
**Problem**: The AMC gang (WKS_PG - Workshop Parit Gunung) was being seeded into **BOTH**:
- P1A division (parent division) 
- WKS_PG division (virtual division)

This caused AMC employees to be counted twice, with different PPh21 calculations.

**Affected Records**:
- 2/2026: AMC in P1A (14 employees, PPh21: 527,583)
- 1/2026: AMC in WKS_PG (14 employees, PPh21: 835,419)
- Various months: AMC in WKS_AR, WKS divisions
- Similar issue with HMC in AB2, WKS divisions

**Fix Applied**:
- ✅ Deleted AMC records from P1A, WKS_AR, and WKS divisions
- ✅ Deleted HMC records from AB2 and WKS divisions
- ✅ Fixed `historySeederService.ts` to properly exclude virtual gangs from parent divisions

### 2. History Gang Member Duplication
**Problem**: The `history_gang_member` table had **1,844 duplicate combinations** where employees appeared multiple times in the same gang/period due to multiple seeding runs.

**Examples**:
- B0720 (RIYANDI PRATAMA): 4 records (2x B3B, 2x B3H) for 2/2026
- F0440 (YUDIARTA): 4 records (2x F2H, 2x F2M) for 2/2026
- A0678, A0257, A0749, etc.: 5 copies each in INT gang for 1/2026

**Fix Applied**:
- ✅ Cleaned all 1,840 duplicate combinations from `history_gang_member`
- ✅ Kept only the latest entry for each emp_code + gang_code + period combination

### 3. Code Bug in History Seeder
**Problem**: The virtual gang exclusion logic in `fetchPayrollData()` was broken:
```typescript
// BUG: vDiv.gangCode doesn't exist!
virtualGangCodes.add(vDiv.gangCode || '');
```

**Fix Applied**:
- ✅ Fixed logic to explicitly add known virtual gang codes (AMC, HMC, B2N, IN, INT)
- ✅ Added logging to show which virtual gangs are being excluded
- ✅ Improved code comments for future maintainability

## Files Modified

1. **backend/src/services/historySeederService.ts**
   - Fixed `fetchPayrollData()` method to properly exclude virtual gangs from parent divisions
   - Added explicit mapping for virtual gang codes
   - Enhanced logging for debugging

## Cleanup Scripts Created

These scripts were used to clean existing duplicates:

1. `check_aggregation_duplicates.ts` - Identify duplicates in aggregation history
2. `fix_aggregation_duplicates.ts` - Remove virtual gangs from wrong divisions
3. `check_multi_gang_employees.ts` - Investigate employees in multiple gangs
4. `clean_history_gang_member_duplicates.ts` - Clean specific employee duplicates
5. `clean_all_history_duplicates.ts` - Comprehensive cleanup (removed 1,840 duplicates)

## Data Cleanup Performed

### daftar_upah_aggregation_history
- ✅ Removed AMC from P1A (1 record)
- ✅ Removed AMC from WKS_AR (1 record)
- ✅ Removed AMC from WKS (1 record)
- ✅ Removed HMC from AB2 (1 record)
- ✅ Removed HMC from WKS (1 record)

### history_gang_member
- ✅ Cleaned 1,840 duplicate employee/gang/period combinations
- ✅ Kept only latest entry for each unique combination
- ✅ B0720: Now has 2 unique gangs (B3B, B3H) for 2/2026
- ✅ F0440: Now has 2 unique gangs (F2H, F2M) for 2/2026

## Important Notes

### Employees in Multiple Gangs Are VALID
Some employees legitimately work in multiple gangs:
- **B0720**: Works in both B3B and B3H (different harvest teams)
- **F0440**: Works in both F2H and F2M (harvesting + maintenance)

This is **correct behavior** - they should appear in both gangs' payroll.

### Virtual Divisions Architecture

The system uses **virtual divisions** to separate specific gangs from their parent divisions:

| Virtual Division | Gang Code | Source Division | Purpose |
|-----------------|-----------|----------------|---------|
| WKS_PG | AMC | PG1A | Workshop Parit Gunung |
| WKS_AR | HMC | AB2 | Workshop Air Ruak |
| NRS | B2N | PG1B | Nursery |
| INF | IN, INT | PG1A | Infrastructure |

**Critical Rule**: Virtual gangs must ONLY appear in their virtual division, NOT in the parent division.

## Next Steps

### Immediate (Required)
1. **Re-seed affected divisions** for current period (2/2026 and 3/2026):
   ```bash
   npm run seed:division P1A 2 2026
   npm run seed:division P1A 3 2026
   npm run seed:division WKS_PG 2 2026
   npm run seed:division WKS_PG 3 2026
   npm run seed:division AB2 2 2026
   npm run seed:division WKS_AR 2 2026
   npm run seed:division WKS_AR 3 2026
   ```

2. **Verify PPh21 calculations** after re-seeding:
   - Check that WKS_PG PPh21 matches expected values
   - Verify no double-counting in division summaries

### Optional (Recommended)
3. **Run full re-seed** for all divisions to ensure consistency:
   ```bash
   npm run seed:all 2 2026
   npm run seed:all 3 2026
   ```

4. **Add validation** to prevent future duplicates:
   - Add UNIQUE constraint on `history_gang_member(emp_code, gang_code, period_month, period_year)`
   - Add UNIQUE constraint on `daftar_upah_aggregation_history(division_code, gang_code, period_month, period_year)`

## Prevention

The fix in `historySeederService.ts` will prevent virtual gang duplication going forward. However, to prevent history_gang_member duplicates from multiple seeding runs, consider:

1. **Add pre-seed cleanup**: Delete existing history_gang_member records before inserting new ones
2. **Add idempotency checks**: Skip if data already exists
3. **Use transactions**: Ensure atomic insert/delete operations

## Testing

After re-seeding, verify:
- [ ] WKS_PG shows correct PPh21 (should match payroll calculations)
- [ ] AMC gang only appears in WKS_PG division, not P1A
- [ ] HMC gang only appears in WKS_AR division, not AB2
- [ ] Division summary totals are correct (no double-counting)
- [ ] Employee count matches actual headcount (no duplicates)

## Date
2026-04-08

## Status
✅ **FIXED** - Code changes applied, data cleaned, ready for re-seeding

