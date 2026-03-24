# 📘 Kalkulator PPh21 TER (Tarif Efektif Rata-rata)

> **Dokumentasi Lengkap Sistem Perhitungan Pajak PPh21 dengan Metode TER**  
> Berdasarkan **PP 58 Tahun 2023**

---

## 📋 Daftar Isi

1. [Konsep Dasar](#1-konsep-dasar)
2. [Struktur Data (JSON Rules)](#2-struktur-data-json-rules)
3. [Mapping PTKP → Kategori TER](#3-mapping-ptkp--kategori-ter)
4. [Algoritma Perhitungan](#4-algoritma-perhitungan)
5. [Implementasi Core Logic](#5-implementasi-core-logic)
6. [Komponen Penghasilan Bruto](#6-komponen-penghasilan-bruto)
7. [Contoh Perhitungan Lengkap](#7-contoh-perhitungan-lengkap)
8. [Template Implementasi](#8-template-implementasi-untuk-codebase-baru)
9. [Testing & Validasi](#9-testing--validasi)
10. [Referensi File](#10-referensi-file)

---

## 1️⃣ Konsep Dasar

### Apa itu PPh21 TER?

**PPh21 TER** (Tarif Efektif Rata-rata) adalah metode perhitungan pajak penghasilan pasal 21 yang berlaku sejak **1 Juli 2023** berdasarkan **PP 58 Tahun 2023**.

### Rumus Utama

```
PPh21 = Penghasilan Bruto × Tarif TER
```

**Dimana:**
- **Penghasilan Bruto** = Semua penghasilan kotor (termasuk tunjangan, premi, ASTEK, BPJS)
- **Tarif TER** = Persentase berdasarkan **kategori TER** dan **besarnya penghasilan**

### Perbedaan dengan Metode Lama

| Aspek | Metode Lama (Gross-Up) | Metode TER (Baru) |
|-------|------------------------|-------------------|
| Dasar perhitungan | Penghasilan Nettable | Penghasilan Bruto |
| Kompleksitas | Tinggi (iteratif) | Rendah (langsung) |
| Tarif | Progresif 5%-30% | Efektif 0%-34% |
| PTKP | Diperhitungkan | Tidak dihitung langsung |

---

## 2️⃣ Struktur Data (JSON Rules)

**Lokasi File:** `Additional_services/hitung_pajak/rule_TER_pajak.json`

### Struktur Lengkap

```json
{
  "tarif_pph21_ter": {
    "ter_a": {
      "kategori": "TER A",
      "ptkp_status": ["TK/0", "TK/1", "K/0"],
      "layers": [
        {
          "no": 1,
          "min_bruto": 0,
          "max_bruto": 5400000,
          "tarif": 0.0
        },
        {
          "no": 2,
          "min_bruto": 5400001,
          "max_bruto": 5650000,
          "tarif": 0.25
        },
        {
          "no": 3,
          "min_bruto": 5650001,
          "max_bruto": 5950000,
          "tarif": 0.50
        }
        // ... total 44 layers untuk TER A
      ]
    },
    "ter_b": {
      "kategori": "TER B",
      "ptkp_status": ["TK/2", "TK/3", "K/1", "K/2"],
      "layers": [
        // ... 40 layers
      ]
    },
    "ter_c": {
      "kategori": "TER C",
      "ptkp_status": ["K/3"],
      "layers": [
        // ... 41 layers
      ]
    }
  }
}
```

### Deskripsi Field JSON

| Field | Tipe | Keterangan |
|-------|------|------------|
| `tarif_pph21_ter` | Object | Container utama aturan tarif |
| `ter_a/b/c` | Object | Kategori TER (A, B, C) |
| `kategori` | String | Nama kategori ("TER A", "TER B", "TER C") |
| `ptkp_status` | Array | Daftar status PTKP yang masuk kategori ini |
| `layers` | Array | Daftar layer tarif berdasarkan penghasilan |
| `no` | Number | Nomor layer (1-44) |
| `min_bruto` | Number | Batas bawah penghasilan (dalam Rupiah) |
| `max_bruto` | Number/Null | Batas atas (null = tak terbatas/Infinity) |
| `tarif` | Number | Persentase pajak (0.25 = 0.25%) |

### Contoh Layer TER A (Beberapa Pertama)

```json
{
  "ter_a": {
    "layers": [
      { "no": 1, "min_bruto": 0, "max_bruto": 5400000, "tarif": 0.0 },
      { "no": 2, "min_bruto": 5400001, "max_bruto": 5650000, "tarif": 0.25 },
      { "no": 3, "min_bruto": 5650001, "max_bruto": 5950000, "tarif": 0.50 },
      { "no": 4, "min_bruto": 5950001, "max_bruto": 6300000, "tarif": 0.75 },
      { "no": 5, "min_bruto": 6300001, "max_bruto": 6750000, "tarif": 1.00 },
      { "no": 6, "min_bruto": 6750001, "max_bruto": 7500000, "tarif": 1.25 },
      { "no": 7, "min_bruto": 7500001, "max_bruto": 8550000, "tarif": 1.50 },
      // ... hingga layer 44 (tarif 34% untuk > 1.4M)
    ]
  }
}
```

---

## 3️⃣ Mapping PTKP → Kategori TER

### Tabel Mapping

```
┌─────────────────────────────────────────┐
│  PTKP Status  →  Kategori TER           │
├─────────────────────────────────────────┤
│  TK/0         →  TER A                  │
│  TK/1         →  TER A                  │
│  K/0          →  TER A                  │
├─────────────────────────────────────────┤
│  TK/2         →  TER B                  │
│  TK/3         →  TER B                  │
│  K/1          →  TER B                  │
│  K/2          →  TER B                  │
├─────────────────────────────────────────┤
│  K/3          →  TER C                  │
└─────────────────────────────────────────┘
```

### Keterangan PTKP

| Kode | Arti |
|------|------|
| **TK** | Tidak Kawin |
| **K** | Kawin |
| **/0** | Tanpa tanggungan |
| **/1** | 1 tanggungan |
| **/2** | 2 tanggungan |
| **/3** | 3 tanggungan (maksimal) |

### Implementasi Mapping

```typescript
const PTKP_TO_TER: Record<string, string> = {
  'TK/0': 'ter_a', 'TK/1': 'ter_a', 'K/0': 'ter_a',
  'TK/2': 'ter_b', 'TK/3': 'ter_b', 'K/1': 'ter_b', 'K/2': 'ter_b',
  'K/3': 'ter_c'
};
```

---

## 4️⃣ Algoritma Perhitungan

### Flow Diagram

```
┌─────────────────────────────────┐
│  Input:                         │
│  - Penghasilan Bruto (gross)    │
│  - Status PTKP (e.g., "TK/0")   │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  1. Tentukan Kategori TER       │
│     dari PTKP                   │
│     "TK/0" → "TER A"            │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  2. Cari Layer yang Sesuai      │
│     berdasarkan gross income    │
│     TER A, Rp 5.900.240         │
│     → Layer 3 (5.650.001-5.950.000) │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  3. Ambil Tarif dari Layer      │
│     Layer 3 → Tarif 0.50%       │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  4. Hitung PPh21                │
│     PPh21 = Bruto × Tarif       │
│     PPh21 = 5.900.240 × 0.50%   │
│     PPh21 = 29.501              │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Output:                        │
│  - PPh21 Amount                 │
│  - TER Category                 │
│  - Rate                         │
│  - Layer Info                   │
└─────────────────────────────────┘
```

### Pseudocode

```
FUNCTION calculate_pph21(gross_income, ptkp_status):
    // Step 1: Map PTKP to TER category
    ter_category = lookup_ter_category(ptkp_status)
    
    // Step 2: Get layers for this category
    layers = get_layers(ter_category)
    
    // Step 3: Find matching layer
    FOR each layer IN layers:
        IF gross_income >= layer.min_bruto 
           AND (layer.max_bruto IS NULL OR gross_income <= layer.max_bruto):
            rate = layer.tarif
            BREAK
    
    // Step 4: Calculate tax
    pph21 = gross_income × (rate / 100)
    
    RETURN {
        ter_category: ter_category,
        gross_income: gross_income,
        rate: rate,
        pph21: ROUND(pph21)
    }
```

---

## 5️⃣ Implementasi Core Logic

### TypeScript Version (Backend)

**Lokasi:** `backend/src/services/pph21TerService.ts`

```typescript
import * as fs from 'fs';
import * as path from 'path';

interface TerLayer {
    no: number;
    min_bruto: number;
    max_bruto: number | null;
    tarif: number; // 0.25 = 0.25%
}

interface TerCategoryData {
    kategori: string;
    ptkp_status: string[];
    layers: TerLayer[];
}

interface TerRules {
    tarif_pph21_ter: {
        ter_a: TerCategoryData;
        ter_b: TerCategoryData;
        ter_c: TerCategoryData;
    };
}

export interface Pph21TerResult {
    ptkp_status: string;
    ter_category: string;
    gross_income: number;
    rate: number;          // Decimal format (0.005)
    rate_percent: number;  // Percentage format (0.50)
    tax_amount: number;
}

class Pph21TerService {
    private static instance: Pph21TerService;
    private rules: TerRules | null = null;
    private ptkpMap: Record<string, string> = {};

    private constructor() {
        this.loadRules();
    }

    public static getInstance(): Pph21TerService {
        if (!Pph21TerService.instance) {
            Pph21TerService.instance = new Pph21TerService();
        }
        return Pph21TerService.instance;
    }

    private loadRules() {
        const possiblePaths = [
            path.resolve(process.cwd(), 'Additional_services/hitung_pajak/rule_TER_pajak.json'),
            path.resolve(__dirname, '../../Additional_services/hitung_pajak/rule_TER_pajak.json'),
        ];

        let jsonPath = possiblePaths.find(p => fs.existsSync(p));
        
        if (!jsonPath) {
            throw new Error('Rules file not found');
        }

        const rawData = fs.readFileSync(jsonPath, 'utf-8');
        this.rules = JSON.parse(rawData);
        this.buildPtkpMap();
    }

    private buildPtkpMap() {
        if (!this.rules) return;

        const cats = this.rules.tarif_pph21_ter;
        for (const key in cats) {
            const catData = cats[key];
            for (const ptkp of catData.ptkp_status) {
                this.ptkpMap[ptkp.toUpperCase()] = key;
            }
        }
    }

    public getTerCategoryKey(ptkpStatus: string): string {
        const normalized = (ptkpStatus || '').toUpperCase().trim();
        return this.ptkpMap[normalized] || 'ter_b';
    }

    public getTerRate(categoryKey: string, grossIncome: number): number {
        if (!this.rules) this.loadRules();
        
        const categoryData = this.rules!.tarif_pph21_ter[categoryKey];
        
        for (const layer of categoryData.layers) {
            const max = layer.max_bruto === null ? Infinity : layer.max_bruto;
            
            if (grossIncome >= layer.min_bruto && grossIncome <= max) {
                return layer.tarif;
            }
        }
        
        return categoryData.layers[categoryData.layers.length - 1].tarif;
    }

    public calculatePph21Ter(grossIncome: number, ptkpStatus: string): Pph21TerResult {
        const categoryKey = this.getTerCategoryKey(ptkpStatus);
        const categoryName = this.rules?.tarif_pph21_ter[categoryKey]?.kategori || categoryKey;
        
        const ratePercent = this.getTerRate(categoryKey, grossIncome);
        const rateDecimal = ratePercent / 100;
        const taxAmount = Math.round(grossIncome * rateDecimal);

        return {
            ptkp_status: ptkpStatus,
            ter_category: categoryName,
            gross_income: grossIncome,
            rate: rateDecimal,
            rate_percent: ratePercent,
            tax_amount: taxAmount
        };
    }
}

export const calculatePph21Ter = (grossIncome: number, ptkpStatus: string) => {
    return Pph21TerService.getInstance().calculatePph21Ter(grossIncome, ptkpStatus);
};
```

### Python Version (GUI Calculator)

**Lokasi:** `Additional_services/hitung_pajak/pajak_calculator_gui.py`

```python
import json
import os

class PPH21TERCalculator:
    """Kelas utama untuk perhitungan PPh21 dengan metode TER"""

    def __init__(self, rule_file=None):
        self.ter_a_brackets = []
        self.ter_b_brackets = []
        self.ter_c_brackets = []
        self.ptkp_mapping = {}

        if rule_file:
            self.load_rules(rule_file)
        else:
            default_path = os.path.join(os.path.dirname(__file__), "rule_TER_pajak.json")
            if os.path.exists(default_path):
                self.load_rules(default_path)

    def load_rules(self, rule_file):
        """Memuat aturan TER dari file JSON"""
        with open(rule_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        tarif = data['tarif_pph21_ter']

        # Load TER A brackets
        for layer in tarif['ter_a']['layers']:
            self.ter_a_brackets.append({
                'min': layer['min_bruto'],
                'max': layer['max_bruto'],
                'rate': layer['tarif'] / 100
            })

        # Build PTKP mapping
        for status in tarif['ter_a']['ptkp_status']:
            self.ptkp_mapping[status] = 'TER A'
        for status in tarif['ter_b']['ptkp_status']:
            self.ptkp_mapping[status] = 'TER B'
        for status in tarif['ter_c']['ptkp_status']:
            self.ptkp_mapping[status] = 'TER C'

    def get_ter_category(self, ptkp_status):
        """Menentukan kategori TER berdasarkan status PTKP"""
        return self.ptkp_mapping.get(ptkp_status.upper().strip(), 'Unknown')

    def calculate_pph21(self, gross_income, ptkp_status):
        """
        Menghitung PPh21 dengan metode TER
        
        Args:
            gross_income: Penghasilan bruto (integer)
            ptkp_status: Status PTKP (TK/0, TK/1, dll)
        
        Returns:
            Dictionary dengan detail perhitungan
        """
        ter_category = self.get_ter_category(ptkp_status)
        
        # Pilih bracket berdasarkan kategori
        brackets = {
            'TER A': self.ter_a_brackets,
            'TER B': self.ter_b_brackets,
            'TER C': self.ter_c_brackets
        }.get(ter_category, [])
        
        # Cari bracket yang sesuai
        for bracket in brackets:
            min_val = bracket['min']
            max_val = bracket['max']
            
            if max_val is None or gross_income <= max_val:
                if gross_income >= min_val:
                    tax_rate = bracket['rate']
                    pph21 = round(gross_income * tax_rate)
                    
                    return {
                        'gross_income': gross_income,
                        'ptkp_status': ptkp_status,
                        'ter_category': ter_category,
                        'tax_rate_pct': tax_rate * 100,
                        'pph21_amount': pph21
                    }
        
        return {'error': 'Cannot determine tax bracket'}
```

---

## 6️⃣ Komponen Penghasilan Bruto

### ⚠️ PENTING!

**Penghasilan Bruto untuk PPh21 TIDAK sama dengan Gaji Pokok!**

### Formula Penghasilan Bruto

```typescript
function calculatePenghasilanBruto(
    gajiPokokAktual: number,        // Gaji pokok
    berasJumlah: number,            // Tunjangan beras
    jabatanJumlah: number,          // Tunjangan jabatan
    masaKerjaJumlah: number,        // Tunjangan masa kerja
    lemburJumlah: number,           // Lembur
    totalPremi: number,             // Premi/insentif
    astekPekerja: number,           // BPJS Pensiun pekerja (0.84%)
    bpjsKesehatanMajikan: number,   // BPJS Kesehatan majikan (4%)
    potKoreksi: number = 0          // Potongan koreksi
): number {
    return gajiPokokAktual +
           berasJumlah +
           jabatanJumlah +
           masaKerjaJumlah +
           lemburJumlah +
           totalPremi +
           astekPekerja +
           bpjsKesehatanMajikan -
           potKoreksi;
}
```

### Komponen yang Termasuk Bruto

| Komponen | Keterangan | Termasuk Bruto? |
|----------|------------|-----------------|
| Gaji Pokok | Gaji dasar bulanan | ✅ Ya |
| Tunjangan Beras | Allowance beras (HR_PAYROLL.RiceRation × HK) | ✅ Ya |
| Tunjangan Jabatan | Structural allowance | ✅ Ya |
| Tunjangan Masa Kerja | Service time allowance | ✅ Ya |
| Lembur | Overtime payment | ✅ Ya |
| Premi | Premi panen, TBS, berondol | ✅ Ya |
| ASTEK Pekerja | BPJS Pensiun 0.84% (employer) | ✅ Ya |
| BPJS Kesehatan Majikan | 4% (employer) | ✅ Ya |
| THR/Bonus | Tahunan | ✅ Ya |
| Potongan Koreksi | Adjustment/penalty | ❌ Dikurangi |
| Potongan Alpa | Absensi | ❌ Dikurangi |

### Contoh Perhitungan Bruto

```
ARDIYANSA (TK/0):
├─ Gaji Pokok:                    4.169.500
├─ Tunjangan Beras:                  69.750
├─ Tunjangan Jabatan:                55.000
├─ Tunjangan Masa Kerja:          1.376.098
├─ ASTEK (0.84% dari gaji):          34.171
├─ BPJS Kesehatan (4% dari gaji):   162.720
└─ Total Penghasilan Bruto:       5.900.240
```

---

## 7️⃣ Contoh Perhitungan Lengkap

### Contoh 1: ARDIYANSA (TK/0 → TER A)

**Data Karyawan:**
```json
{
  "nama": "ARDIYANSA",
  "ptkp": "TK/0",
  "gaji_pokok": 4169500,
  "beras": 69750,
  "jabatan": 55000,
  "masa_kerja": 1376098,
  "astek": 34171,
  "bpjs_kesehatan": 162720,
  "premi": 0
}
```

**Step-by-Step:**

```
Step 1: Hitung Penghasilan Bruto
─────────────────────────────────
Bruto = 4.169.500 + 69.750 + 55.000 + 1.376.098 + 34.171 + 162.720
Bruto = 5.900.240

Step 2: Tentukan Kategori TER
──────────────────────────────
PTKP: TK/0
→ TER A (berdasarkan mapping)

Step 3: Cari Layer yang Sesuai
───────────────────────────────
TER A Layers:
- Layer 1: 0 - 5.400.000 → 0.00%
- Layer 2: 5.400.001 - 5.650.000 → 0.25%
- Layer 3: 5.650.001 - 5.950.000 → 0.50% ← MATCH!

Bruto 5.900.240 ada di Layer 3
→ Tarif: 0.50%

Step 4: Hitung PPh21
────────────────────
PPh21 = 5.900.240 × 0.50%
PPh21 = 5.900.240 × 0.005
PPh21 = 29.501,20
PPh21 = 29.501 (dibulatkan)
```

**Output:**
```json
{
  "nama": "ARDIYANSA",
  "ptkp": "TK/0",
  "ter_category": "TER A",
  "gross_income": 5900240,
  "rate_percent": 0.50,
  "rate_decimal": 0.005,
  "pph21_amount": 29501,
  "layer": 3
}
```

---

### Contoh 2: AMRIL (K/1 → TER B)

**Data Karyawan:**
```json
{
  "nama": "AMRIL",
  "ptkp": "K/1",
  "gaji_pokok": 4169500,
  "beras": 144150,
  "jabatan": 60000,
  "masa_kerja": 3696806,
  "astek": 34318,
  "bpjs_kesehatan": 163420,
  "premi": 0
}
```

**Step-by-Step:**

```
Step 1: Hitung Penghasilan Bruto
─────────────────────────────────
Bruto = 4.169.500 + 144.150 + 60.000 + 3.696.806 + 34.318 + 163.420
Bruto = 8.318.695

Step 2: Tentukan Kategori TER
──────────────────────────────
PTKP: K/1
→ TER B (berdasarkan mapping)

Step 3: Cari Layer yang Sesuai
───────────────────────────────
TER B Layers:
- Layer 4: 6.850.001 - 7.300.000 → 0.75%
- Layer 5: 7.300.001 - 9.200.000 → 1.00% ← MATCH!

Bruto 8.318.695 ada di Layer 5
→ Tarif: 1.00%

Step 4: Hitung PPh21
────────────────────
PPh21 = 8.318.695 × 1.00%
PPh21 = 8.318.695 × 0.01
PPh21 = 83.186,95
PPh21 = 83.187 (dibulatkan)
```

**Output:**
```json
{
  "nama": "AMRIL",
  "ptkp": "K/1",
  "ter_category": "TER B",
  "gross_income": 8318695,
  "rate_percent": 1.00,
  "rate_decimal": 0.01,
  "pph21_amount": 83187,
  "layer": 5
}
```

---

### Contoh 3: Karyawan dengan Premi (POPPY ADEYANTI)

**Data Karyawan:**
```json
{
  "nama": "POPPY ADEYANTI",
  "ptkp": "TK/0",
  "gaji_pokok": 4169500,
  "beras": 69750,
  "jabatan": 55000,
  "masa_kerja": 0,
  "astek": 34171,
  "bpjs_kesehatan": 162720,
  "insentif_panen": 1605385
}
```

**Step-by-Step:**

```
Step 1: Hitung Penghasilan Bruto
─────────────────────────────────
Bruto = 4.169.500 + 69.750 + 55.000 + 0 + 34.171 + 162.720 + 1.605.385
Bruto = 6.129.526

Step 2: Tentukan Kategori TER
──────────────────────────────
PTKP: TK/0
→ TER A

Step 3: Cari Layer yang Sesuai
───────────────────────────────
TER A Layer 4: 5.950.001 - 6.300.000 → 0.75%

Bruto 6.129.526 ada di Layer 4
→ Tarif: 0.75%

Step 4: Hitung PPh21
────────────────────
PPh21 = 6.129.526 × 0.75%
PPh21 = 6.129.526 × 0.0075
PPh21 = 45.971,445
PPh21 = 45.971 (dibulatkan)
```

**Output:**
```json
{
  "nama": "POPPY ADEYANTI",
  "ptkp": "TK/0",
  "ter_category": "TER A",
  "gross_income": 6129526,
  "rate_percent": 0.75,
  "rate_decimal": 0.0075,
  "pph21_amount": 45971,
  "layer": 4
}
```

---

## 8️⃣ Template Implementasi untuk Codebase Baru

### Step 1: Siapkan JSON Rules

Simpan file `rule_TER_pajak.json` dengan struktur lengkap (lihat [Bagian 2](#2-struktur-data-json-rules)).

### Step 2: Buat Service Class (TypeScript)

```typescript
// pph21TerService.ts
import * as fs from 'fs';
import * as path from 'path';

interface TerLayer {
    min_bruto: number;
    max_bruto: number | null;
    tarif: number;
}

interface TerRules {
    tarif_pph21_ter: {
        ter_a: { ptkp_status: string[]; layers: TerLayer[] };
        ter_b: { ptkp_status: string[]; layers: TerLayer[] };
        ter_c: { ptkp_status: string[]; layers: TerLayer[] };
    };
}

export class Pph21TerCalculator {
    private rules: TerRules;
    private ptkpMap: Record<string, string> = {};

    constructor(ruleFilePath: string) {
        const rawData = fs.readFileSync(ruleFilePath, 'utf-8');
        this.rules = JSON.parse(rawData);
        this.buildPtkpMap();
    }

    private buildPtkpMap() {
        const tarif = this.rules.tarif_pph21_ter;
        Object.entries(tarif).forEach(([key, value]: [string, any]) => {
            value.ptkp_status.forEach((ptkp: string) => {
                this.ptkpMap[ptkp] = key;
            });
        });
    }

    public calculate(grossIncome: number, ptkpStatus: string) {
        const categoryKey = this.ptkpMap[ptkpStatus.toUpperCase()] || 'ter_b';
        const layers = this.rules.tarif_pph21_ter[categoryKey].layers;
        
        let rate = 0;
        for (const layer of layers) {
            const max = layer.max_bruto ?? Infinity;
            if (grossIncome >= layer.min_bruto && grossIncome <= max) {
                rate = layer.tarif / 100;
                break;
            }
        }

        return {
            ter_category: categoryKey.toUpperCase().replace('_', ' '),
            gross_income: grossIncome,
            rate: rate,
            pph21: Math.round(grossIncome * rate)
        };
    }
}
```

### Step 3: Gunakan di Kode Anda

```typescript
// Usage example
const calculator = new Pph21TerCalculator('./rule_TER_pajak.json');

const result = calculator.calculate(5900240, 'TK/0');
console.log(result);
// Output:
// {
//   ter_category: 'TER A',
//   gross_income: 5900240,
//   rate: 0.005,
//   pph21: 29501
// }
```

### Step 4: Integrasi dengan Payroll System

```typescript
// payrollService.ts
import { Pph21TerCalculator } from './pph21TerService';

interface PayrollInput {
    gajiPokok: number;
    tunjanganBeras: number;
    tunjanganJabatan: number;
    tunjanganMasaKerja: number;
    lembur: number;
    premi: number;
    astekPekerja: number;
    bpjsKesehatanMajikan: number;
    ptkp: string;
}

export function calculatePayroll(input: PayrollInput) {
    const calculator = new Pph21TerCalculator('./rule_TER_pajak.json');
    
    // Hitung penghasilan bruto
    const penghasilanBruto = 
        input.gajiPokok +
        input.tunjanganBeras +
        input.tunjanganJabatan +
        input.tunjanganMasaKerja +
        input.lembur +
        input.premi +
        input.astekPekerja +
        input.bpjsKesehatanMajikan;
    
    // Hitung PPh21
    const pph21Result = calculator.calculate(penghasilanBruto, input.ptkp);
    
    return {
        penghasilanBruto,
        pph21: pph21Result.pph21,
        takeHomePay: penghasilanBruto - pph21Result.pph21,
        taxDetails: pph21Result
    };
}
```

---

## 9️⃣ Testing & Validasi

### Data Sampel Testing

**Lokasi:** `Additional_services/hitung_pajak/sample.json`

```typescript
const testCases = [
    {
        nama: 'SUDARMONO',
        bruto: 6135189,
        ptkp: 'K/2',
        expected_pph21: 0,
        expected_ter: 'TER B'
    },
    {
        nama: 'ARDIYANSA',
        bruto: 5900240,
        ptkp: 'TK/0',
        expected_pph21: 29501,
        expected_ter: 'TER A'
    },
    {
        nama: 'AMRIL',
        bruto: 8318695,
        ptkp: 'K/1',
        expected_pph21: 83187,
        expected_ter: 'TER B'
    },
    {
        nama: 'MARTUTI',
        bruto: 4354408,
        ptkp: 'TK/0',
        expected_pph21: 0,
        expected_ter: 'TER A'
    },
    {
        nama: 'POPPY ADEYANTI',
        bruto: 6129526,
        ptkp: 'TK/0',
        expected_pph21: 45971,
        expected_ter: 'TER A'
    },
    {
        nama: 'HENDRI',
        bruto: 4285051,
        ptkp: 'K/2',
        expected_pph21: 0,
        expected_ter: 'TER B'
    }
];
```

### Test Suite (Jest)

```typescript
// pph21TerService.test.ts
import { Pph21TerCalculator } from './pph21TerService';

describe('Pph21TerCalculator', () => {
    let calculator: Pph21TerCalculator;

    beforeAll(() => {
        calculator = new Pph21TerCalculator('./rule_TER_pajak.json');
    });

    test.each(testCases)(
        'should calculate correct PPh21 for $nama',
        ({ bruto, ptkp, expected_pph21, expected_ter }) => {
            const result = calculator.calculate(bruto, ptkp);
            
            expect(result.pph21).toBe(expected_pph21);
            expect(result.ter_category).toBe(expected_ter);
        }
    );

    test('should handle edge case: minimum salary', () => {
        const result = calculator.calculate(4169500, 'TK/0');
        expect(result.pph21).toBe(0); // Below taxable threshold
    });

    test('should handle edge case: very high salary', () => {
        const result = calculator.calculate(150000000, 'TK/0');
        expect(result.rate).toBe(0.34); // Maximum rate
    });

    test('should handle all PTKP statuses', () => {
        const ptkpStatuses = ['TK/0', 'TK/1', 'TK/2', 'TK/3', 'K/0', 'K/1', 'K/2', 'K/3'];
        
        ptkpStatuses.forEach(ptkp => {
            const result = calculator.calculate(10000000, ptkp);
            expect(result.ter_category).toBeDefined();
            expect(result.pph21).toBeGreaterThanOrEqual(0);
        });
    });
});
```

### Manual Testing dengan GUI

**Lokasi:** `Additional_services/hitung_pajak/pajak_calculator_gui.py`

```bash
# Run GUI calculator
cd Additional_services/hitung_pajak
python pajak_calculator_gui.py
```

GUI menyediakan:
- ✅ Input manual untuk testing
- ✅ Data sampel karyawan
- ✅ Detail breakdown perhitungan
- ✅ Info TER lengkap

---

## 🔟 Referensi File

### File Utama

| File | Lokasi | Fungsi |
|------|--------|--------|
| `rule_TER_pajak.json` | `Additional_services/hitung_pajak/` | Data tarif TER |
| `pph21TerService.ts` | `backend/src/services/` | Service TypeScript |
| `pajak_calculator_gui.py` | `Additional_services/hitung_pajak/` | GUI Calculator |
| `sample.json` | `Additional_services/hitung_pajak/` | Data testing |

### File Pendukung

| File | Lokasi | Fungsi |
|------|--------|--------|
| `run_calculator.bat` | `Additional_services/hitung_pajak/` | Launcher Windows |
| `README.md` | `Additional_services/hitung_pajak/` | Panduan penggunaan |
| `web_simulasi/` | `Additional_services/pajak_kalkulator/` | Versi web |

### Query Database Terkait

```sql
-- Mendapatkan RiceRation untuk tunjangan beras
SELECT RiceRation 
FROM HR_PAYROLL 
WHERE EmpCode = ?;

-- Mendapatkan data karyawan dengan PTKP
SELECT 
    EmpCode,
    EmpName,
    PTKP,
    BasicSalary
FROM HR_EMPLOYEE
WHERE Active = 1;
```

---

## 📝 Ringkasan

### Poin Penting

1. **PPh21 TER** menggunakan metode sederhana: `Bruto × Tarif`
2. **Tarif** ditentukan oleh:
   - Kategori TER (dari PTKP)
   - Besarnya penghasilan bruto
3. **Penghasilan Bruto** mencakup SEMUA penghasilan (gaji, tunjangan, premi, ASTEK, BPJS)
4. **Mapping PTKP → TER** bersifat tetap (lihat tabel di [Bagian 3](#3-mapping-ptkp--kategori-ter))
5. **JSON Rules** dapat diupdate jika ada perubahan tarif pemerintah

### Best Practices

- ✅ Selalu load rules dari JSON (jangan hardcode)
- ✅ Handle edge cases (penghasilan sangat rendah/tinggi)
- ✅ Validasi status PTKP sebelum kalkulasi
- ✅ Gunakan singleton pattern untuk service
- ✅ Test dengan data sampel yang valid

### Common Pitfalls

- ❌ Menggunakan gaji pokok sebagai dasar (harus bruto lengkap)
- ❌ Lupa include ASTEK & BPJS majikan
- ❌ Salah mapping PTKP ke TER
- ❌ Tidak handle `max_bruto: null` (infinity)

---

## 📞 Kontak & Support

Untuk pertanyaan terkait implementasi:
- 📧 Email: [Tambahkan email tim]
- 💬 Slack: [Tambahkan channel]
- 📚 Dokumentasi terkait: `dokumentasi/README.md`

---

**Versi Dokumentasi:** 1.0  
**Terakhir Update:** Maret 2026  
**Dasar Hukum:** PP 58 Tahun 2023
