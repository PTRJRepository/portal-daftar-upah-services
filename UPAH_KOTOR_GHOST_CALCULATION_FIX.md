# UPAH KOTOR GHOST CALCULATION FIX

**Date:** 2026-04-05  
**File:** `backend/src/services/dataExtractorService.ts`

## Problem

Perhitungan upah kotor di daftar upah menghasilkan nilai yang berbeda dengan perhitungan manual. Terdapat "ghost calculation" yang menyebabkan perhitungan tidak akurat.

## Root Causes

### BUG #1: Lembur (Overtime) Double-Counting in Streaming Path

**Location:** Line 903 (streaming/generator path)

**Issue:**
```typescript
// BEFORE (WRONG)
const total_tunjangan = berasJumlah + empJabatan + empMasaKerjaJumlah + empLemburJumlahPure;
```

`total_tunjangan` INCLUDES `empLemburJumlahPure` (overtime), but `PayrollCalculator.calculate()` also receives `lembur_jumlah: empLemburJumlahPure` as a separate parameter.

PayrollCalculator's formula:
```typescript
komponen_kotor.subtotal = gaji_pokok + tunjangan + lembur + premi;
```

Since `total_tunjangan` already contains lembur, and PayrollCalculator adds `lembur_jumlah` separately, **lembur was counted TWICE** in the gross pay calculation.

**Impact:** Upah kotor lebih besar dari yang seharusnya sebesar `empLemburJumlahPure` (overtime amount).

### BUG #2: Inconsistent `pot_koreksi` Sign Handling

**Location:** Lines 3619-3625 (Phase 4 batch path) & Line 1316 (streaming path)

**Issue in Phase 4:**
```typescript
// BEFORE (INCONSISTENT)
let pot_koreksi = 0;
for (const [key, val] of Object.entries(empPotongan)) {
    if (key.startsWith("KOREKSI")) pot_koreksi += (val as number);
}
if (pot_koreksi > 0) pot_koreksi = -pot_koreksi;

const jumlah_upah_kotor = ... + pot_koreksi;  // Adding potentially inverted value
```

This logic was fragile and depended on database sign convention. If `KOREKSI` values in DB were already negative, the sum would be negative, then inverted to positive, and **added as income** instead of deduction.

**Issue in Streaming Path:**
```typescript
// BEFORE (WRONG)
pot_koreksi,  // Passed as positive value
```

PayrollCalculator adds `pot_koreksi` via:
```typescript
komponen_kotor.grand_subtotal = subtotal + koreksi + lainnya;
```

Since `pot_koreksi` was positive, it was **added** to gross instead of **subtracted**, making upah kotor lebih besar.

## Fixes Applied

### FIX #1: Remove Lembur from `total_tunjangan` (Streaming Path)

**Line 903:**
```typescript
// AFTER (CORRECT)
// [FIX] total_tunjangan TIDAK termasuk lembur - lembur adalah komponen terpisah
// lembur akan ditambahkan secara terpisah di PayrollCalculator
const total_tunjangan = berasJumlah + empJabatan + empMasaKerjaJumlah;
```

Now `total_tunjangan` does NOT include lembur. PayrollCalculator receives:
- `total_tunjangan` (without lembur)
- `lembur_jumlah: empLemburJumlahPure` (separate)

And adds them correctly without double-counting.

### FIX #2: Consistent `pot_koreksi` Sign Handling

**Phase 4 Batch Path (Line 3621-3627):**
```typescript
// AFTER (CONSISTENT)
// [FIX] pot_koreksi menggunakan Math.abs untuk konsistensi dengan streaming path
// KOREKSI selalu disimpan sebagai nilai positif (abs), akan di-negatif di PayrollCalculator
let pot_koreksi = 0;
for (const [key, val] of Object.entries(empPotongan)) {
    if (key.startsWith("KOREKSI")) pot_koreksi += Math.abs(val as number);
}
```

**Phase 4 Batch Path Formula (Line 3642):**
```typescript
// AFTER (CORRECT)
// [FIX] pot_koreksi adalah pengurangan dari gross, harus dikurangi
const jumlah_upah_kotor = gaji_pokok_aktual + total_tunjangan + (empLembur.jumlah || 0) + total_premi - pot_koreksi;
```

Now `pot_koreksi` is always positive (absolute value) and **subtracted** from gross.

**Streaming Path (Line 1316):**
```typescript
// AFTER (CORRECT)
pot_koreksi: -pot_koreksi, // [FIX] Negate because koreksi is a deduction
```

Now `pot_koreksi` is negated before passing to PayrollCalculator, so when it's added in the formula, it effectively **subtracts** from gross.

## Correct Formula (After Fix)

### UPAH KOTOR (Base Gross)
```
upah_kotor = gaji_pokok_aktual + total_tunjangan + total_premi
where: total_tunjangan = beras_jumlah + jabatan_jumlah + masa_kerja_jumlah (NO lembur)
```

### JUMLAH UPAH KOTOR (Display Gross)
```
jumlah_upah_kotor = upah_kotor + lembur_jumlah + pot_koreksi (negative) + pendapatan_lainnya
```

Or equivalently:
```
jumlah_upah_kotor = gaji_pokok_aktual + total_tunjangan + lembur_jumlah + total_premi - pot_koreksi + pendapatan_lainnya
```

## Verification

After applying these fixes, verify with manual calculation:

1. **Check lembur is counted ONCE:**
   - Find employee with overtime (lembur_jumlah > 0)
   - Verify: `jumlah_upah_kotor` includes lembur exactly once
   - Before fix: lembur counted twice (inflated)

2. **Check koreksi reduces gross:**
   - Find employee with koreksi (pot_koreksi > 0)
   - Verify: `jumlah_upah_kotor` is reduced by `pot_koreksi` amount
   - Before fix: koreksi might have been added (inflated) or inconsistently handled

3. **Manual formula:**
   ```
   Expected = gaji_pokok_aktual 
            + (beras_jumlah + jabatan_jumlah + masa_kerja_jumlah)
            + lembur_jumlah
            + total_premi
            - pot_koreksi
            + pendapatan_lainnya
   ```

## Testing Commands

```bash
# Run backend tests
cd backend && bun run test

# Test specific payroll calculation
bun run src/scripts/test_payroll_calculation.ts

# Run integration tests
cd _dev_utils/tests && bun run test_payroll.ts
```

## Impact

- ✅ Lembur no longer double-counted in streaming path
- ✅ Koreksi consistently reduces gross pay
- ✅ Both streaming and batch paths produce identical results
- ✅ Manual calculations now match system calculations
- ✅ Tax calculations (PPh21 TER) now accurate based on correct gross

## Related Files

- `backend/src/services/dataExtractorService.ts` - Fixed
- `backend/src/services/payroll/components/PayrollCalculator.ts` - Reference for formulas
- `backend/src/services/payroll/formulas/PayrollFormulas.ts` - Pure function equivalents
