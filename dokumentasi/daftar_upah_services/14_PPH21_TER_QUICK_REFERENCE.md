# 🧮 PPh21 TER - Quick Reference Guide

> **Ringkasan cepat implementasi Kalkulator PPh21 TER**  
> 📚 Dokumentasi lengkap: `../KALKULATOR_PPH21_TER.md`

---

## 🚀 Quick Start

### 1. Load Rules JSON

```typescript
import * as fs from 'fs';
const rules = JSON.parse(fs.readFileSync('rule_TER_pajak.json', 'utf-8'));
```

### 2. Mapping PTKP → TER

```typescript
const PTKP_TO_TER = {
  'TK/0': 'ter_a', 'TK/1': 'ter_a', 'K/0': 'ter_a',
  'TK/2': 'ter_b', 'TK/3': 'ter_b', 'K/1': 'ter_b', 'K/2': 'ter_b',
  'K/3': 'ter_c'
};
```

### 3. Hitung Bruto

```typescript
const bruto = 
  gajiPokok + 
  tunjanganBeras + 
  tunjanganJabatan + 
  tunjanganMasaKerja + 
  lembur + 
  premi + 
  astekPekerja +        // 0.84%
  bpjsKesehatanMajikan; // 4%
```

### 4. Cari Tarif TER

```typescript
function getTarif TER(category: 'ter_a' | 'ter_b' | 'ter_c', bruto: number) {
  const layers = rules.tarif_pph21_ter[category].layers;
  
  for (const layer of layers) {
    const max = layer.max_bruto ?? Infinity;
    if (bruto >= layer.min_bruto && bruto <= max) {
      return layer.tarif / 100; // Convert to decimal
    }
  }
}
```

### 5. Hitung PPh21

```typescript
const pph21 = Math.round(bruto * tarif);
```

---

## 📊 Mapping PTKP ke TER

| PTKP | Kategori TER | Keterangan |
|------|--------------|------------|
| TK/0 | **TER A** | Tidak Kawin, 0 tanggungan |
| TK/1 | **TER A** | Tidak Kawin, 1 tanggungan |
| K/0  | **TER A** | Kawin, 0 tanggungan |
| TK/2 | **TER B** | Tidak Kawin, 2 tanggungan |
| TK/3 | **TER B** | Tidak Kawin, 3 tanggungan |
| K/1  | **TER B** | Kawin, 1 tanggungan |
| K/2  | **TER B** | Kawin, 2 tanggungan |
| K/3  | **TER C** | Kawin, 3 tanggungan |

---

## 💰 Tarif TER (Ringkasan)

### TER A (TK/0, TK/1, K/0)

| Layer | Rentang Bruto | Tarif |
|-------|---------------|-------|
| 1 | 0 - 5.400.000 | 0.00% |
| 2 | 5.400.001 - 5.650.000 | 0.25% |
| 3 | 5.650.001 - 5.950.000 | 0.50% |
| 4 | 5.950.001 - 6.300.000 | 0.75% |
| 5 | 6.300.001 - 6.750.000 | 1.00% |
| 6 | 6.750.001 - 7.500.000 | 1.25% |
| 7 | 7.500.001 - 8.550.000 | 1.50% |
| ... | ... | ... |
| 44 | > 1.400.000.000 | 34.00% |

### TER B (TK/2, TK/3, K/1, K/2)

| Layer | Rentang Bruto | Tarif |
|-------|---------------|-------|
| 1 | 0 - 6.200.000 | 0.00% |
| 2 | 6.200.001 - 6.500.000 | 0.25% |
| 3 | 6.500.001 - 6.850.000 | 0.50% |
| 4 | 6.850.001 - 7.300.000 | 0.75% |
| 5 | 7.300.001 - 9.200.000 | 1.00% |
| ... | ... | ... |

### TER C (K/3)

| Layer | Rentang Bruto | Tarif |
|-------|---------------|-------|
| 1 | 0 - 6.600.000 | 0.00% |
| 2 | 6.600.001 - 6.950.000 | 0.25% |
| 3 | 6.950.001 - 7.350.000 | 0.50% |
| 4 | 7.350.001 - 7.800.000 | 0.75% |
| 5 | 7.800.001 - 8.850.000 | 1.00% |
| ... | ... | ... |

---

## 📝 Contoh Perhitungan

### Contoh 1: Karyawan TK/0, Bruto 5.9 Juta

```typescript
// Input
const ptkp = 'TK/0';
const bruto = 5900240;

// Process
const terCategory = 'ter_a'; // dari mapping
const tarif = 0.005; // Layer 3: 0.50%

// Result
const pph21 = Math.round(5900240 * 0.005); // 29,501
```

### Contoh 2: Karyawan K/1, Bruto 8.3 Juta

```typescript
// Input
const ptkp = 'K/1';
const bruto = 8318695;

// Process
const terCategory = 'ter_b'; // dari mapping
const tarif = 0.01; // Layer 5: 1.00%

// Result
const pph21 = Math.round(8318695 * 0.01); // 83,187
```

---

## 🔧 Implementasi Service

### TypeScript (Backend)

```typescript
// backend/src/services/pph21TerService.ts
import { pph21TerService } from '@/services/pph21TerService';

// Calculate PPh21
const result = pph21TerService.calculatePph21Ter(5900240, 'TK/0');
console.log(result);
// {
//   ter_category: 'TER A',
//   gross_income: 5900240,
//   rate: 0.005,
//   rate_percent: 0.50,
//   tax_amount: 29501
// }

// Calculate Bruto
const bruto = pph21TerService.calculatePenghasilanBruto(
  4169500, // gaji pokok
  69750,   // beras
  55000,   // jabatan
  1376098, // masa kerja
  0,       // lembur
  0,       // premi
  34171,   // astek
  162720   // bpjs kesehatan
);
// bruto = 5900240
```

### Python (GUI Calculator)

```python
# Additional_services/hitung_pajak/pajak_calculator_gui.py
calculator = PPH21TERCalculator('rule_TER_pajak.json')

result = calculator.calculate_pph21(5900240, 'TK/0')
print(result)
# {
#   'gross_income': 5900240,
#   'ptkp_status': 'TK/0',
#   'ter_category': 'TER A',
#   'tax_rate_pct': 0.50,
#   'pph21_amount': 29501
# }
```

---

## ✅ Testing Checklist

- [ ] Test dengan semua status PTKP (TK/0, TK/1, ..., K/3)
- [ ] Test edge case: bruto minimum (≤ 5.4jt untuk TER A)
- [ ] Test edge case: bruto maksimum (> 1.4M)
- [ ] Test dengan komponen lengkap (gaji + semua tunjangan + premi)
- [ ] Test dengan potongan koreksi
- [ ] Validasi dengan sample.json (6 karyawan sampel)

### Sample Test Cases

```typescript
const testCases = [
  { nama: 'ARDIYANSA', bruto: 5900240, ptkp: 'TK/0', expected: 29501 },
  { nama: 'AMRIL', bruto: 8318695, ptkp: 'K/1', expected: 83187 },
  { nama: 'POPPY ADEYANTI', bruto: 6129526, ptkp: 'TK/0', expected: 45971 },
  { nama: 'SUDARMONO', bruto: 6135189, ptkp: 'K/2', expected: 0 },
  { nama: 'MARTUTI', bruto: 4354408, ptkp: 'TK/0', expected: 0 },
  { nama: 'HENDRI', bruto: 4285051, ptkp: 'K/2', expected: 0 },
];
```

---

## ⚠️ Common Pitfalls

### ❌ SALAH

```typescript
// 1. Menggunakan gaji pokok sebagai dasar
const pph21 = gajiPokok * tarif; // WRONG!

// 2. Lupa include ASTEK & BPJS
const bruto = gajiPokok + tunjangan; // INCOMPLETE!

// 3. Salah mapping PTKP
const ter = ptkp === 'K/3' ? 'ter_b' : 'ter_a'; // WRONG!
```

### ✅ BENAR

```typescript
// 1. Hitung bruto lengkap dulu
const bruto = 
  gajiPokok + 
  beras + 
  jabatan + 
  masaKerja + 
  lembur + 
  premi + 
  astekPekerja + 
  bpjsKesehatanMajikan;

// 2. Map PTKP dengan benar
const terMap = {
  'TK/0': 'ter_a', 'TK/1': 'ter_a', 'K/0': 'ter_a',
  'TK/2': 'ter_b', 'TK/3': 'ter_b', 'K/1': 'ter_b', 'K/2': 'ter_b',
  'K/3': 'ter_c'
};

// 3. Hitung PPh21
const pph21 = Math.round(bruto * tarif);
```

---

## 📁 File References

| File | Lokasi | Purpose |
|------|--------|---------|
| `rule_TER_pajak.json` | `Additional_services/hitung_pajak/` | Data tarif TER |
| `pph21TerService.ts` | `backend/src/services/` | Service TS |
| `pajak_calculator_gui.py` | `Additional_services/hitung_pajak/` | GUI Calculator |
| `sample.json` | `Additional_services/hitung_pajak/` | Test data |
| `KALKULATOR_PPH21_TER.md` | `dokumentasi/` | Full documentation |

---

## 🔗 Links

- 📚 [Dokumentasi Lengkap](../KALKULATOR_PPH21_TER.md)
- 💻 [PPH21 Ter Service](../../backend/src/services/pph21TerService.ts)
- 🧮 [GUI Calculator](../../Additional_services/hitung_pajak/pajak_calculator_gui.py)
- 📊 [Sample Data](../../Additional_services/hitung_pajak/sample.json)

---

**Versi:** 1.0 | **Update:** Maret 2026 | **PP 58/2023**
