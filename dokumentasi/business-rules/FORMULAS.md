# Payroll Formulas - Single Source of Truth

> **CRITICAL:** Semua perhitungan WAJIB gunakan PayrollCalculator
> **Source:** `backend/src/services/payroll/components/PayrollCalculator.ts`

---

## Formula Hierarchy

```
1. UPAH KOTOR       = gaji + tunjangan + premi
   [tanpa koreksi/lainnya]

2. JUMLAH UPAH KOTOR = UPAH KOTOR + koreksi + lainnya
   [untuk tampilan]

3. PENGHASILAN BRUTO = UPAH KOTOR + koreksi + lainnya + astek_m + bpjs_m
   [untuk pajak]

4. UPAH KOTOR PAJAK = UPAH KOTOR + koreksi + lainnya + bpjs_pe
   [untuk header pajak]

5. TOTAL POTONGAN    = astek + bpjs + spsi + pph21 + other + lainnya
   [koreksi TIDAK masuk - sudah di gross]

6. UPAH BERSIH      = jumlah_upah_kotor - total_potongan + premi_pph
   [take-home pay]
```

---

## Balance Check

| Komponen | Di Gross | Di Potongan | Net |
|----------|-----------|-------------|-----|
| koreksi | + | NO | 0 effect |
| lainnya (THR/Bonus/etc) | + | - | 0 |

---

## PTKP → TER Mapping

**Canonical:** `payroll/formulas/PTKPMapper.ts`

### Standard
| Rate | PTKP | TER |
|------|-------|-----|
| 2250 | TK/0 | A |
| 3250 | TK/1 | A |
| 4200 | TK/2 | B |
| 3700 | K/0 | A |
| 4650 | K/1 | B |
| 5500 | K/2 | B |
| 6450 | K/3 | C |

### Legacy DB
| Rate | PTKP |
|------|-------|
| 3150 | TK/1 |
| 4050 | TK/2 |
| 4950 | TK/3 |
| 3600 | K/0 |
| 4500 | K/1 |
| 5400 | K/2 |
| 6300 | K/3 |

---

## Usage

```typescript
// ✓ BENAR - Use PayrollCalculator
import { PayrollCalculator } from './payroll/components/PayrollCalculator';
const result = PayrollCalculator.calculate(input, ptkpStatus, year);

// ✗ SALAH - Don't recalculate manually
const upah_bersih = gaji + tunjangan - potongan; // inconsistent!
```
