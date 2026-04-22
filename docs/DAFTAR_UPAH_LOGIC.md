# Daftar Upah - Complete Calculation Logic

**Document Version:** 1.0.0  
**Last Updated:** 2026-04-22  
**Single Source of Truth:** `PayrollCalculator.ts`, `lemburCalculator.ts`, `carumanDefinitions.ts`, `pph21TerService.ts`

---

## Table of Contents

1. [Attendance & HK](#1-attendance--hk)
2. [Gaji Pokok](#2-gaji-pokok)
3. [Tunjangan](#3-tunjangan)
4. [Lembur (Overtime)](#4-lembur-overtime)
5. [Premi](#5-premi)
6. [Caruman (BPJS/Astek)](#6-caruman-bpjsastek)
7. [Tax (PPh21 TER)](#7-tax-pph21-ter)
8. [3-Level Upah Architecture](#8-3-level-upah-architecture)
9. [Total Potongan](#9-total-potongan)
10. [Upah Bersih](#10-upah-bersih)
11. [Complete Field Map](#11-complete-field-map)

---

## 1. Attendance & HK

### Source
- `PR_TASKREGLN` and `PR_TASKREGLN_ARC` (attendance transactions)

### Fields
| Field | Source | Formula |
|-------|--------|---------|
| `jumlah_hk` | From PR_TASKREGLN | Total HK in period |
| `hari_kerja` | Calculated | `jumlah_hk - (cuti_tahunan + cuti_sakit_haid + cuti_minggu + cuti_nasional)` |
| `cuti_tahunan` | PR_TASKREGLN | Leave type = 'TAHUNAN' |
| `cuti_sakit_haid` | PR_TASKREGLN | Leave type = 'SAKIT' or 'HAID' |
| `cuti_minggu` | PR_TASKREGLN | Leave type = 'MINGGU' |
| `cuti_nasional` | PR_TASKREGLN | Leave type = 'NASIONAL' |

### Hari Kerja Formula
```typescript
hari_kerja = Math.max(0, jumlah_hk - cuti_tahunan - cuti_sakit_haid - cuti_minggu - cuti_nasional)
```

---

## 2. Gaji Pokok

### Source
- `HR_PAYROLL.PayRate` (daily wage rate)
- Attendance data

### Fields
| Field | Formula |
|-------|---------|
| `upah_dasar` | `PayRate` from HR_PAYROLL |
| `gaji_pokok_aktual` | `hari_kerja × pay_rate` |
| `gaji_pokok_ideal` | `jumlah_hk × pay_rate` |

### GajiPokokService Formula
```typescript
gaji_pokok_aktual = hari_kerja × pay_rate
gaji_pokok_ideal = jumlah_hk × pay_rate
```

---

## 3. Tunjangan

### Source
- `PR_ADTRANSLN` where DocDesc contains specific keywords

### Components
| Field | Source | Formula |
|-------|--------|---------|
| `beras_rate` | HR_PAYROLL.BerasRate | Rice ration rate |
| `beras_jumlah` | Calculated | `beras_rate × jumlah_hk` |
| `jabatan_rate` | PR_ADTRANSLN | Rate from DB |
| `jabatan_jumlah` | PR_ADTRANSLN | Amount from DB |
| `masa_kerja_tahun` | Calculated | `JOIN_DATE → years of service` |
| `masa_kerja_rate` | PR_ADTRANSLN | Rate from DB |
| `masa_kerja_jumlah` | PR_ADTRANSLN | Amount from DB |

### Total Tunjangan Formula
```typescript
total_tunjangan = beras_jumlah + jabatan_jumlah + masa_kerja_jumlah + lembur_jumlah
```

### Note
Tunjangan displayed in Komponen Kotor EXCLUDES lembur:
```typescript
tunjangan_tanpa_lembur = beras_jumlah + jabatan_jumlah + masa_kerja_jumlah
```

---

## 4. Lembur (Overtime)

### Source
- `PR_TASKREGLN` and `PR_TASKREGLN_ARC` where `OT = 1`

### UPJ Calculation
```typescript
// UPJ = (PayRate × 30) / 173
// Fallback: env.LEMBUR_UPJ (default: 17257)
UPJ = payRate > 0 ? (payRate × 30) / 173 : this.upjValue
```

### Day Type Classification
| Day Type | Classification | Day of Week |
|----------|---------------|-------------|
| `WORKDAY_LONG` | Mon, Tue, Wed, Thu, Sat | 1-4, 6 |
| `WORKDAY_SHORT` | Friday | 5 |
| `SUNDAY` | Sunday | 0 |
| `HOLIDAY_REGULAR` | Non-religious holiday | - |
| `HOLIDAY_RELIGIOUS` | Religious holiday | - |

### Holiday Detection
```typescript
// From HR_GPH table
// Religious holidays: contains "IDUL", "NATAR", "IMLEK", "WAISAK", "NYEPI", "ISRA", "MAULID"
```

### Overtime Rate Tiers
| Day Type | Tier 1 | Tier 2 | Tier 3 | Boundary |
|----------|--------|--------|--------|----------|
| `WORKDAY_LONG` | 1.5x | 2x | 2x | 1 hour |
| `WORKDAY_SHORT` | 1.5x | 2x | 2x | 1 hour |
| `SUNDAY` | 2x | 3x | 4x | 7 hours (long), 5 hours (short) |
| `HOLIDAY_REGULAR` | 2x | 3x | 4x | 7 hours (long), 5 hours (short) |
| `HOLIDAY_RELIGIOUS` | 3x | 4x | 4x | 7 hours (long), 5 hours (short) |

### Overtime Payment Formula
```typescript
calculateOvertimePayment(hours, dayType, upj, isShortDay) {
    const boundary = isShortDay ? tier_1_boundary_short : tier_1_boundary_long;
    
    // Tier 1: First N hours
    tier_1_hours = min(hours, boundary)
    tier_1_amount = tier_1_hours × upj × tier_1_rate
    
    // Tier 2: Next hours (1 hour for Sunday/Holiday, rest for workday)
    tier_2_hours = min(remaining_hours, tier_2_limit)
    tier_2_amount = tier_2_hours × upj × tier_2_rate
    
    // Tier 3: Remaining hours
    tier_3_hours = remaining_hours - tier_2_hours
    tier_3_amount = tier_3_hours × upj × tier_3_rate
    
    total_amount = tier_1_amount + tier_2_amount + tier_3_amount
}
```

### Lembur Result Fields
```typescript
{
    emp_code: string,
    upj: number,              // Calculated UPJ
    records: OvertimeRecord[], // Individual transactions
    total_hours: number,       // Sum of all hours
    total_payment: number,     // Sum of all amounts
    record_count: number
}
```

---

## 5. Premi

### Source
- `PR_ADTRANS` and `PR_ADTRANSLN` where `DocDesc LIKE '%PREMI%'`

### Excluded Patterns
```typescript
const EXCLUDED = [
    'PPH', 'PPH21', 'PPH 21',  // Tax
    'LEMBUR',                    // Overtime
    'BRONDOL',                   // → Static premi_brondol
    'PRUN', 'PRUNING',           // → Static premi_pruning
    'KOREKSI', 'KOREKSI PANEN', // Correction
    'SPSI',
    'TUNJANGAN JABATAN',
    'TUNJANGAN MASA KERJA',
    'TUNJANGAN BERAS',
    'JABATAN', 'BERAS', 'MASA', 'POTONGAN'
];
```

### Premi Fields
| Field | Formula |
|-------|---------|
| `premi_brondol` | From PR_LOOSEFRUIT + PR_ADTRANS (BRONDOL) |
| `premi_pruning` | Static column (PRUN patterns) |
| `premi` | Dynamic object keyed by DocDesc |
| `total_premi` | `premi_brondol + SUM(dynamic_premi)` |

### Total Premi Formula
```typescript
// NOTE: Koreksi is NOT included in total_premi
total_premi = premi_brondol + SUM(other dynamic premi)
```

---

## 6. Caruman (BPJS/Astek)

### Single Source of Truth
`carumanDefinitions.ts`

### Base Calculation
```typescript
BASE = (Upah Dasar × 30) + Tunjangan Masa Kerja
Gaji Standar = Upah Dasar × 30
```

### Rate Definitions
| Component | Pekerja | Majikan | Total |
|-----------|---------|---------|-------|
| ASTEK JHT | 2% | 3.7% | 5.7% |
| ASTEK JKK/JKM | - | 0.84% | 0.84% |
| **ASTEK Total** | **2%** | **4.54%** | **6.54%** |
| BPJS Kesehatan | 1% | 4% | 5% |
| BPJS Pensiun | 1% | 2% | 3% |

### Caruman Formulas
```typescript
calculateAllCaruman(upahDasar, masaKerjaJumlah) {
    gajiStandar = upahDasar × 30
    base = gajiStandar + masaKerjaJumlah
    
    astek_pekerja_jht = round(base × 0.02)
    astek_majikan_jkk_jkm = round(base × 0.0084)
    astek_majikan_jht = round(base × 0.037)
    astek_majikan_total = round(base × 0.0454)
    
    bpjs_kes_pekerja = round(base × 0.01)
    bpjs_kes_majikan = round(base × 0.04)
    
    bpjs_pensiun_pekerja = round(base × 0.01)
    bpjs_pensiun_majikan = round(base × 0.02)
    
    total_pekerja = astek_pekerja_jht + bpjs_kes_pekerja + bpjs_pensiun_pekerja
    total_majikan = astek_majikan_total + bpjs_kes_majikan + bpjs_pensiun_majikan
}
```

### Caruman Fields in Daftar Upah
| Field | Source |
|-------|--------|
| `pot_astek_pekerja` | ASTEK JHT pekerja (2%) |
| `pot_astek_majikan` | ASTEK total majikan (4.54%) |
| `pot_astek_jumlah` | Total ASTEK |
| `pot_bpjs_kesehatan_pekerja` | BPJS Kesehatan pekerja (1%) |
| `pot_bpjs_kesehatan_majikan` | BPJS Kesehatan majikan (4%) |
| `pot_bpjs_kesehatan_jumlah` | Total BPJS Kesehatan |
| `pot_bpjs_pensiun_pekerja` | BPJS Pensiun pekerja (1%) |
| `pot_bpjs_pensiun_majikan` | BPJS Pensiun majikan (2%) |
| `pot_bpjs_pensiun_jumlah` | Total BPJS Pensiun |

---

## 7. Tax (PPh21 TER)

### Single Source of Truth
- `PTKPMapper.ts` - PTKP mapping
- `pph21TerService.ts` - TER calculation
- `rule_TER_pajak.json` - TER rate layers

### PTKP Mapping (beras_rate → PTKP → TER)

| beras_rate | PTKP Status | TER Category |
|------------|-------------|--------------|
| 2250 | TK/0 | TER A |
| 3250 | TK/1 | TER A |
| 3700 | K/0 | TER A |
| 4200 | TK/2 | TER B |
| 4650 | K/1 | TER B |
| 5500 | K/2 | TER B |
| 6450 | K/3 | TER C |

### TER Categories
| Category | PTKP Status | PTKP Amount (2025/2026) |
|----------|-------------|------------------------|
| TER A | TK/0, TK/1, K/0 | ≤ 58,500,000 |
| TER B | TK/2, TK/3, K/1, K/2 | 63,000,000 - 67,500,000 |
| TER C | K/3 | 72,000,000 |

### TER Rate Layers (PP 58/2023)

Rates are LOADED from `rule_TER_pajak.json` - approximately 40-44 layers per category:

```
Gross Monthly Income
    ├── 0 - 5,400,000        → 0.00%
    ├── 5,400,001 - 5,650,000 → 0.25%
    ├── 5,650,001 - 5,950,000 → 0.50%
    ├── ... (continues up to)
    └── Highest income       → 34%
```

### PPh21 TER Formula
```typescript
calculatePph21Ter(grossIncome, ptkpStatus) {
    // 1. Determine TER category from PTKP
    categoryKey = getTerCategoryKey(ptkpStatus)  // 'ter_a', 'ter_b', 'ter_c'
    
    // 2. Get TER rate from layer based on gross income
    rate = getTerRate(categoryKey, grossIncome)  // e.g., 5.0 for 5%
    
    // 3. Calculate tax
    tax = grossIncome × (rate / 100)
    
    return { ptkp_status, ter_category, gross_income, rate, rate_percent, tax_amount }
}
```

### Tax Fields in Daftar Upah
| Field | Description |
|-------|-------------|
| `status_ptkp` | PTKP status (TK/0, K/1, etc.) |
| `kategori_ter` | TER category (TER A, TER B, TER C) |
| `pot_pph21` | PPh21 deducted in payroll |
| `pph21_ter` | Calculated TER tax |
| `tarif_pajak_ter` | TER percentage (e.g., 5.00) |

---

## 8. 3-Level Upah Architecture

### Level 1: UPAH KOTOR (Gross without koreksi/lainnya)
```typescript
upah_kotor = gaji_pokok_aktual + total_tunjangan + total_premi
```

### Level 2: JUMLAH UPAH KOTOR (Daftar Upah display)
```typescript
jumlah_upah_kotor = upah_kotor - pot_koreksi + pendapatan_lainnya
```
**NOTE:** koreksi SUBTRACTED, lainnya ADDED for display only

### Level 3: PENGHASILAN BRUTO (For PPh21 TER)
```typescript
penghasilan_bruto = jumlah_upah_kotor + astek_majikan + bpjs_majikan
```
**NOTE:** koreksi & lainnya ARE part of taxable income

### Upah Kotor Pajak (For header/tampilan pajak)
```typescript
upah_kotor_pajak = upah_kotor - pot_koreksi + pendapatan_lainnya + bpjs_pekerja
```

---

## 9. Total Potongan

### Formula
```typescript
total_potongan = 
    astek_pekerja + 
    bpjs_kes_pekerja + 
    bpjs_pensiun_pekerja + 
    spsi + 
    pph21 + 
    other_potongan + 
    pendapatan_lainnya
```

### Critical Rules

1. **Koreksi NOT in total_potongan:**
   - Koreksi already in jumlah_upah_kotor (subtracted)
   - If included in total_potongan, would be subtracted 2x → WRONG

2. **Pendapatan Lainnya MUST in total_potongan:**
   - THR, Bonus, Custom, KONTAN added to jumlah_upah_kotor (+)
   - Must also be subtracted in total_potongan to offset
   - Net effect on upah_bersih = 0

### Components
| Component | Included | Formula |
|-----------|----------|---------|
| astek_pekerja | ✅ | From caruman |
| bpjs_kes_pekerja | ✅ | From caruman |
| bpjs_pensiun_pekerja | ✅ | From caruman |
| spsi | ✅ | From PR_ADTRANS |
| pph21 | ✅ | pot_pph21 |
| other_potongan | ✅ | Dynamic deductions |
| pot_koreksi | ❌ | Already in jumlah_upah_kotor |
| pendapatan_lainnya | ✅ | To offset the + in gross |

### Total Potongan Bersih
```typescript
total_potongan_bersih = total_potongan - premi_pph
```

---

## 10. Upah Bersih

### Formula
```typescript
upah_bersih = jumlah_upah_kotor - total_potongan + premi_pph
```

### Key Points
- `premi_pph` is ADDITION (+), not deduction (-)
- premi_pph adds back to upah_bersih (not subtract)

### Expanded Formula
```typescript
upah_bersih = 
    (upah_kotor - pot_koreksi + pendapatan_lainnya) 
    - (astek + bpjs + spsi + pph21 + other + pendapatan_lainnya) 
    + premi_pph

// Simplified:
// = upah_kotor - pot_koreksi - astek - bpjs - spsi - pph21 - other + premi_pph
```

---

## 11. Complete Field Map

### Input Fields (From Database)

| Field | Source Table | Description |
|-------|-------------|-------------|
| `nik` | HR_EMPLOYEE.NewICNo | KTP NIK |
| `emp_code` | HR_EMPLOYEE.EmpCode | Plantware internal ID |
| `nama` | HR_EMPLOYEE.EmpName | Employee name |
| `jenis_kelamin` | HR_EMPLOYEE.Gender | L or P |
| `gang_code` | HR_GANGLN | Gang assignment |
| `jabatan` | employee_estate / history_gang_member | Job title (NOT from HR_GANGLN) |
| `pay_rate` | HR_PAYROLL.PayRate | Daily wage rate |
| `beras_rate` | HR_PAYROLL.BerasRate | Rice ration rate |
| `join_date` | HR_EMPLOYEE.JoinDate | Employment start |
| `jumlah_hk` | PR_TASKREGLN | Total working days |

### Attendance Fields (Calculated)

| Field | Formula |
|-------|---------|
| `hari_kerja` | `jumlah_hk - cuti_tahunan - cuti_sakit_haid - cuti_minggu - cuti_nasional` |
| `cuti_tahunan_hari` | From PR_TASKREGLN |
| `cuti_sakit_haid_hari` | From PR_TASKREGLN |
| `cuti_minggu_hari` | From PR_TASKREGLN |
| `cuti_nasional_hari` | From PR_TASKREGLN |

### Gaji Pokok Fields

| Field | Formula |
|-------|---------|
| `upah_dasar` | `pay_rate` from HR_PAYROLL |
| `gaji_pokok` | `hari_kerja × pay_rate` |
| `gaji_pokok_aktual` | `hari_kerja × pay_rate` |
| `gaji_pokok_ideal` | `jumlah_hk × pay_rate` |

### Tunjangan Fields

| Field | Formula |
|-------|---------|
| `beras_rate` | `beras_rate` from HR_PAYROLL |
| `beras_jumlah` | `beras_rate × jumlah_hk` |
| `jabatan_rate` | From PR_ADTRANSLN |
| `jabatan_jumlah` | From PR_ADTRANSLN |
| `masa_kerja_tahun` | Calculated from join_date |
| `masa_kerja_rate` | From PR_ADTRANSLN |
| `masa_kerja_jumlah` | From PR_ADTRANSLN |
| `total_tunjangan` | `beras_jumlah + jabatan_jumlah + masa_kerja_jumlah + lembur_jumlah` |

### Lembur Fields

| Field | Formula |
|-------|---------|
| `lembur_jam` | Sum of hours from PR_TASKREGLN (OT=1) |
| `lembur_jumlah` | Calculated from tier-based rates |
| `lembur_records` | Array of individual transactions |

### Premi Fields

| Field | Formula |
|-------|---------|
| `premi_brondol` | From PR_LOOSEFRUIT + PR_ADTRANS |
| `premi` | Dynamic object by DocDesc |
| `total_premi` | `premi_brondol + SUM(dynamic)` |

### Caruman Fields

| Field | Formula |
|-------|---------|
| `pot_astek_pekerja` | `base × 0.02` |
| `pot_astek_majikan` | `base × 0.0454` |
| `pot_bpjs_kesehatan_pekerja` | `base × 0.01` |
| `pot_bpjs_kesehatan_majikan` | `base × 0.04` |
| `pot_bpjs_pensiun_pekerja` | `base × 0.01` |
| `pot_bpjs_pensiun_majikan` | `base × 0.02` |

### Tax Fields

| Field | Formula |
|-------|---------|
| `status_ptkp` | From beras_rate mapping |
| `kategori_ter` | TER A/B/C from PTKP |
| `pot_pph21` | From Daftar Upah deduction |
| `pph21_ter` | `penghasilan_bruto × TER_rate` |
| `tarif_pajak_ter` | TER percentage |

### Upah Fields (Calculated)

| Field | Formula |
|-------|---------|
| `upah_kotor` | `gaji_pokok_aktual + total_tunjangan + total_premi` |
| `jumlah_upah_kotor` | `upah_kotor - pot_koreksi + pendapatan_lainnya` |
| `potongan_upah_kotor` | `pot_koreksi` (displayed separately) |
| `total_potongan` | `astek + bpjs_kes + bpjs_pensiun + spsi + pph21 + other + pendapatan_lainnya` |
| `total_potongan_bersih` | `total_potongan - premi_pph` |
| `upah_bersih` | `jumlah_upah_kotor - total_potongan + premi_pph` |

### Other Fields

| Field | Description |
|-------|-------------|
| `pot_spsi` | From PR_ADTRANS |
| `pot_koreksi` | Correction deduction |
| `pendapatan_lainnya` | THR, Bonus, Custom, KONTAN |
| `premi_pph` | ADDITION to upah_bersih |

---

## Summary: Complete Upah Bersih Formula

```typescript
// 1. Base components
gaji_pokok_aktual = hari_kerja × pay_rate
total_tunjangan = beras_jumlah + jabatan_jumlah + masa_kerja_jumlah + lembur_jumlah
total_premi = premi_brondol + SUM(dynamic_premi)

// 2. UPAH KOTOR
upah_kotor = gaji_pokok_aktual + total_tunjangan + total_premi

// 3. JUMLAH UPAH KOTOR
jumlah_upah_kotor = upah_kotor - pot_koreksi + pendapatan_lainnya

// 4. PENGHASILAN BRUTO (for tax)
base = (pay_rate × 30) + masa_kerja_jumlah
astek_m = round(base × 0.0454)
bpjs_m = round(base × 0.04)
penghasilan_bruto = jumlah_upah_kotor + astek_m + bpjs_m

// 5. TOTAL POTONGAN
total_potongan = 
    round(base × 0.02) +           // astek_pekerja
    round(base × 0.01) +           // bpjs_kes_pekerja
    round(base × 0.01) +           // bpjs_pensiun_pekerja
    spsi + 
    pot_pph21 + 
    other_potongan + 
    pendapatan_lainnya             // MUST offset the + in gross

// 6. UPAH BERSIH
upah_bersih = jumlah_upah_kotor - total_potongan + premi_pph
```
