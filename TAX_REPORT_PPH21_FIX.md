# Tax Report PPh21 TER Fix - Matching Daftar Upah

**Date:** 2026-04-05  
**Issue:** Tax report (Report Pajak) showing different PPh21 TER values compared to Daftar Upah  
**Root Cause:** Incorrect handling of `pendapatan_lainnya` (THR, Bonus, Custom income) in tax calculation

---

## Problem Analysis

### Before Fix

**Daftar Upah (reportService.ts + dataExtractorService.ts):**
```typescript
// ✅ CORRECT: Uses PayrollCalculator which includes pendapatan_lainnya
const calc = PayrollCalculator.calculate({
    // ... other fields
    pendapatan_lainnya: pendapatan_lainnya_amount, // THR + Bonus + Custom
});
// penghasilan_bruto = upah_kotor + koreksi + pendapatan_lainnya + astek_majikan + bpjs_majikan
// pph21_ter = calculatePph21Ter(penghasilan_bruto, ptkp_status)
```

**Tax Report (taxReportService.ts):**
```typescript
// ❌ WRONG: Calculate bruto WITHOUT pendapatan_lainnya
let penghasilanBruto = pph21TerService.calculatePenghasilanBruto(
    gajiPokokAktual, tunjanganBeras, tunjanganJabatan, tunjanganMasaKerja,
    tunjanganLembur, totalPremi, astek084, bpjsKesehatanMajikan4Pct, 
    row.pot_koreksi || 0
    // ❌ Missing: pendapatan_lainnya parameter
);

// ❌ WRONG: Then ADD it again (double-counting for current data)
penghasilanBruto += (thrAmount + exgratiaAmount + otherIncomeAmount);

// Result: 
// - Current data: pendapatan_lainnya counted TWICE → tax too HIGH
// - History data: pendapatan_lainnya = 0 (not stored) → tax too LOW
```

### Impact

| Data Source | Issue |
|-------------|-------|
| **Current Period** (from dataExtractorService) | `pendapatan_lainnya` already in row data, but added AGAIN → **Tax HIGHER than Daftar Upah** |
| **History Period** (from historyDatabaseService) | `pendapatan_lainnya` NOT stored (0), fallback THR formula calculated but NOT added to bruto → **Tax LOWER than it should be** |

---

## Solution

### Key Changes in `taxReportService.ts`

#### 1. Include `pendapatan_lainnya` in `calculatePenghasilanBruto()` call

```typescript
// ✅ Get from row data (already includes THR/Bonus/Custom from payroll calculation)
let rowPendapatanLainnya = row.total_pendapatan_lainnya || row.pendapatan_lainnya || 0;

// ✅ Pass it to the calculation
let penghasilanBruto = pph21TerService.calculatePenghasilanBruto(
    gajiPokokAktual, tunjanganBeras, tunjanganJabatan, tunjanganMasaKerja,
    tunjanganLembur, totalPremi, astek084, bpjsKesehatanMajikan4Pct, 
    row.pot_koreksi || 0,
    rowPendapatanLainnya // ✅ NOW INCLUDED
);
```

#### 2. Handle History Data Fallback

```typescript
// Calculate fallback values (for when DB doesn't have other incomes)
const computedPendapatanLainnya = thrAmount + exgratiaAmount + otherIncomeAmount;

// Use row value if available, otherwise use computed
const pendapatan_tidak_tetap_thp = rowPendapatanLainnyaValue > 0 
    ? rowPendapatanLainnyaValue 
    : computedPendapatanLainnya;

// ✅ If history data doesn't have pendapatan_lainnya, add computed value
if (rowPendapatanLainnyaValue === 0 && computedPendapatanLainnya > 0) {
    penghasilanBruto += computedPendapatanLainnya;
    rowPendapatanLainnya = computedPendapatanLainnya;
}
// NOTE: If rowPendapatanLainnyaValue > 0, it's ALREADY in penghasilanBruto
// from calculatePenghasilanBruto(), so we DON'T add it again.
```

#### 3. Return Actual Values for Display

```typescript
return {
    // ... other fields
    penghasilan_bruto: penghasilanBruto,
    tarif_pajak_ter: tarifPajakTer,
    pph21_ter: pph21,
    // ✅ Include for transparency
    pendapatan_tidak_tetap_thp, // For display
    pendapatan_lainnya: rowPendapatanLainnya // Actual value used in calculation
};
```

---

## How It Works Now

### Scenario 1: Current Period Data (from dataExtractorService)

```
Row Data:
├─ pendapatan_lainnya = 5,000,000 (THR + Bonus + Custom already calculated)
└─ Stored in history tables during seeding

Tax Report Calculation:
├─ rowPendapatanLainnya = 5,000,000 ✅ (from row data)
├─ penghasilanBruto = calculatePenghasilanBruto(..., 5,000,000) ✅
├─ computedPendapatanLainnya = thrAmount + exgratiaAmount + otherIncomeAmount
├─ Check: rowPendapatanLainnyaValue (5M) > 0 → DON'T add again ✅
└─ pph21_ter = calculatePph21Ter(penghasilanBruto) ✅ MATCHES Daftar Upah!
```

### Scenario 2: History Period Data (from historyDatabaseService)

```
Row Data:
├─ pendapatan_lainnya = 0 (NOT stored in old history tables)
└─ Need to calculate from fallback formula

Tax Report Calculation:
├─ rowPendapatanLainnya = 0 (from row data)
├─ penghasilanBruto = calculatePenghasilanBruto(..., 0) 
├─ computedPendapatanLainnya = thrAmount + exgratiaAmount + otherIncomeAmount
│   └─ e.g., THR formula: (upahDasar * 30) + (berasRate * 30) + masaKerja
├─ Check: rowPendapatanLainnyaValue (0) === 0 → ADD computed value ✅
├─ penghasilanBruto += computedPendapatanLainnya ✅
├─ rowPendapatanLainnya = computedPendapatanLainnya ✅
└─ pph21_ter = calculatePph21Ter(penghasilanBruto) ✅ CORRECT!
```

---

## Verification Steps

### 1. Test Current Period (March 2026 - THR Month)

```bash
# Start backend
cd backend && bun run dev

# Call tax report API
curl -X GET "http://localhost:8002/api/tax-report/monthly?year=2026&month=3"

# Call daftar upah for same period
curl -X GET "http://localhost:8002/payroll/report?year=2026&month=3&division=P1A"

# Compare: pph21_ter should MATCH for same employee
```

### 2. Test History Period (e.g., January 2026)

```bash
# Call tax report for history month
curl -X GET "http://localhost:8002/api/tax-report/monthly?year=2026&month=1"

# Verify THR is 0 (not THR month)
# Verify tax matches daftar upah calculation
```

### 3. Check Specific Employee

```typescript
// Employee with THR
{
    emp_code: "EMP001",
    penghasilan_bruto: 8500000,  // Should include all income
    tarif_pajak_ter: 5,          // TER A rate
    pph21_ter: 425000,           // 8,500,000 * 5%
    pendapatan_lainnya: 3500000, // THR amount used
    thr_amount: 3500000
}
```

---

## Files Modified

| File | Changes |
|------|---------|
| `backend/src/services/taxReportService.ts` | ✅ Fixed `penghasilanBruto` calculation to include `pendapatan_lainnya` |
| | ✅ Added fallback logic for history data without `pendapatan_lainnya` |
| | ✅ Updated `MonthlyTaxRow` interface with `pendapatan_lainnya` field |
| | ✅ Added comments explaining the calculation flow |

---

## Important Notes

### THR 2026 Configuration

```typescript
// THR 2026 is given in MARCH (month 3), NOT February
function loadActiveThrPeriode(): ThrPeriode | null {
    return {
        year: 2026,
        month: 3,  // ← March
        type: 'THR',
        name: 'THR 2026',
        is_active: true
    };
}
```

### Pendapatan Lainnya Types

| Type | Taxable | Source |
|------|---------|--------|
| **THR** | ✅ Yes | Database OR Formula: `(upahDasar * 30) + (berasRate * 30) + masaKerja` |
| **Bonus/Exgratia** | ✅ Yes | Database OR Static JSON files |
| **Custom** | ✅ Yes | Database (manual entry) |
| **KONTAN** | ✅ Yes | Database (potongan, not income) |

### Calculation Flow

```
1. Get row data (from dataExtractorService or historyDatabaseService)
2. Extract base income components (gaji, tunjangan, premi, etc.)
3. Get pendapatan_lainnya from row.pendapatan_lainnya
4. Calculate penghasilanBruto INCLUDING pendapatan_lainnya
5. If row.pendapatan_lainnya === 0 (history data), calculate fallback and ADD to bruto
6. Calculate PPh21 TER using final penghasilanBruto
7. Return tax values that MATCH Daftar Upah calculation
```

---

## Testing Checklist

- [ ] Tax report PPh21 matches Daftar Upah for current period (March 2026)
- [ ] Tax report PPh21 matches Daftar Upah for history periods
- [ ] THR calculation correct for employees with masa_kerja >= 1 year
- [ ] Custom incomes from database included in tax calculation
- [ ] Non-taxable incomes (if any) NOT included in penghasilanBruto
- [ ] TER category (A/B/C) correctly mapped from PTKP status
- [ ] Tax rates match rule_TER_pajak.json layered rates

---

## Related Documentation

- `dokumentasi/KALKULATOR_PPH21_TER.md` - TER tax calculation details
- `asknowledge/02_THR_2026_IMPLEMENTATION_CHECKLIST.md` - THR 2026 changes
- `backend/src/services/payroll/components/PayrollCalculator.ts` - Single source of truth for payroll formulas
- `backend/src/services/pph21TerService.ts` - Core TER tax engine
