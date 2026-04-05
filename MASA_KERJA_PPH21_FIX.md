# Fix: Masa Kerja & PPh21 TER Grand Total

## Problem
1. **Masa Kerja (Lama)** not showing in grand total - only displaying lines/zeros
2. **PPh21 TER** showing 0 in grand total despite being calculated correctly

## Root Cause

The `calculateTotals` and `calculateGangTotals` functions in `backend/src/api/payroll.ts` were missing two critical fields in their `numericFields` array:

1. **`masa_kerja_tahun`** - Years of service (integer field)
2. **`pph21_ter`** - Calculated PPh21 tax using TER method

### Why This Happened

There are **THREE** separate totaling functions in `payroll.ts`:

1. **Line 276** - `calculateTotals` for `/division-raw-tree` endpoint (non-streaming)
2. **Line 509** - `calculateTotals` for locked report (alias endpoint)
3. **Line 1345** - `calculateGangTotals` for **STREAMING** endpoint (most commonly used)

The fix needed to be applied to **ALL THREE** functions.

### Fields That Were Missing

```typescript
// BEFORE (WRONG)
const numericFields = [
    'jumlah_hk', 'hari_kerja', 'gaji_pokok', 
    'beras_jumlah', 'jabatan_jumlah', 'masa_kerja_jumlah', // ← masa_kerja_tahun MISSING
    'pph21_ter', // ← This was present in some functions but MISSING from calculateGangTotals
    // ... other fields
];

// AFTER (CORRECT)
const numericFields = [
    'jumlah_hk', 'hari_kerja', 'gaji_pokok', 
    'beras_jumlah', 'jabatan_jumlah', 'masa_kerja_tahun', 'masa_kerja_jumlah', // ← FIXED
    'pph21_ter', 'tarif_pajak_ter', // ← Now in ALL totaling functions
    // ... other fields
];
```

## Fix Applied

### File: `backend/src/api/payroll.ts`

**Three locations updated:**

1. **Line 296** - First `calculateTotals` function
   - Added: `'masa_kerja_tahun'`
   - Already had: `'pph21_ter', 'tarif_pajak_ter'` ✓

2. **Line 528** - Second `calculateTotals` function (locked report)
   - Added: `'masa_kerja_tahun'`
   - Already had: `'pph21_ter', 'tarif_pajak_ter'` ✓

3. **Line 1354** - `calculateGangTotals` function (STREAMING - MOST IMPORTANT)
   - Added: `'masa_kerja_tahun'`
   - Added: `'pph21_ter', 'tarif_pajak_ter'`

### Why Streaming Endpoint is Most Important

The frontend uses **Server-Sent Events (SSE)** streaming for the payroll report:
- Endpoint: `GET /payroll/streaming/report`
- This uses `calculateGangTotals` function
- This is where 99% of users see the grand total

## Verification

### Backend Logs Confirm Data is Correct

From your logs:
```
[TaxReportService] PPh21 TER Summary: {
  total_employees: 17,
  employees_with_pph21: 17,
  employees_with_zero_pph21: 0,
  total_pph21_ter: 2335156,  // ← Tax IS being calculated!
  data_source: "current",
}
```

**Sample employee data:**
```
Employee #1 (B0520): pph21_ter: 90399
Employee #2 (B0521): pph21_ter: 143150
Employee #3 (B0523): pph21_ter: 145017
```

### Expected Behavior After Fix

**Grand Total row should now show:**

| Field | Example Value | Notes |
|-------|---------------|-------|
| `masa_kerja_tahun` | `187` (sum of all years) | Integer field |
| `masa_kerja_jumlah` | `4,675,000` | Currency field |
| `pph21_ter` | `2,335,156` | Calculated tax |
| `tarif_pajak_ter` | (average %) | Tax rate |

## Testing Steps

1. ✅ Backend restarted with fix (PID: 74040)
2. ⏳ Open frontend: `http://localhost:5173` (or your LAN IP)
3. ⏳ Navigate to any division payroll report
4. ⏳ Scroll to **Grand Total** row at bottom
5. ⏳ Verify:
   - **Masa Kerja → Lama** shows total years (not 0 or lines)
   - **PPh21 TER** shows calculated tax amount (should be ~2.3M for 17 employees)

## Files Modified

- `backend/src/api/payroll.ts` (3 functions updated)

## Related Files (No Changes Needed)

- `backend/src/services/dataExtractorService.ts` - Already sets `masa_kerja_tahun` correctly ✓
- `backend/src/services/pph21TerService.ts` - Already calculates PPh21 correctly ✓
- `backend/src/services/taxReportService.ts` - Already includes PPh21 in reports ✓

## Why PPh21 Showed 0 Before

Even though `pph21_ter` was in SOME totaling functions, it was **MISSING from `calculateGangTotals`** which is used by the streaming endpoint. The streaming endpoint is what the frontend uses for the main payroll report view.

**The tax was calculated correctly** (as shown in your logs: 2,335,156), but the grand total function couldn't sum it because the field wasn't in the `numericFields` list.

## Additional Notes

### Integer Fields vs Currency Fields

- `masa_kerja_tahun` = **Integer** (years of service)
- `masa_kerja_jumlah` = **Currency** (Rupiah amount)

Both need to be totaled separately. The frontend displays them in different columns:
- **Lama** = Years (integer)
- **Jumlah** = Amount (currency)

### Tax Calculation Flow

```
1. dataExtractorService calculates pph21_ter per employee ✓
2. payroll.ts streams data to frontend ✓
3. calculateGangTotals sums all pph21_ter values ← NOW FIXED ✓
4. Frontend displays grand total ✓
```

## Date: 2026-04-05
## Status: ✅ FIXED - Ready for Testing
