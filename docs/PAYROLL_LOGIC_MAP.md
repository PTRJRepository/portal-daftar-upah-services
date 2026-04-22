# Portal Daftar Upah - Complete Business Logic Map

**Document Version:** 1.0.0  
**Last Updated:** 2026-04-21  
**Project:** Portal Daftar Upah PT Rebinmas

---

## Table of Contents

1. [Employee Data Flow](#1-employee-data-flow)
2. [Attendance & Leave Logic](#2-attendance--leave-logic)
3. [Overtime (Lembur) Calculation](#3-overtime-lembur-calculation)
4. [Gaji Pokok Calculation](#4-gaji-pokok-calculation)
5. [Tunjangan (Allowances) Calculation](#5-tunjangan-allowances-calculation)
6. [Premi (Premium) Calculation](#6-premi-premium-calculation)
7. [Caruman (BPJS) Calculation](#7-caruman-bpjs-calculation)
8. [Tax (PPh21 TER) Calculation](#8-tax-pph21-ter-calculation)
9. [Take-Home Pay (Upah Bersih) Calculation](#9-take-home-pay-upah-bersih-calculation)
10. [Employee Filtering Logic](#10-employee-filtering-logic)
11. [Pendapatan Lainnya (THR, Bonus, etc)](#11-pendapatan-lainnya-thr-bonus-etc)
12. [Data Extraction Flow](#12-data-extraction-flow)

---

## 1. Employee Data Flow

### Source Tables
- `HR_EMPLOYEE` - Master employee data
- `HR_GANGLN` - Gang membership
- `HR_GANG` - Gang definitions
- `HR_PAYROLL` - Payroll rates (PayRate, BerasRate)

### Key Fields
```typescript
interface Employee {
    emp_code: string;        // Plantware internal ID
    nik: string;             // KTP NIK (from NewICNo)
    nama: string;            // Employee name
    jenis_kelamin: string;   // 'L' or 'P'
    gang_code: string;        // Gang assignment
    pay_rate: number;         // Daily wage rate (from HR_PAYROLL)
    beras_rate: number;      // Rice ration rate (maps to PTKP)
    join_date: string;       // Employment start date
    loc_code: string;        // Location code
}
```

### Employee Resolution Flow
```
NIK Lookup
    │
    ├── NIK found in HR_EMPLOYEE → Use existing emp_code
    └── NIK not found → Check DuplicateNikMitigationService
                            │
                            ├── Duplicate NIK exists → Use Mitigated emp_code
                            └── No duplicate → Insert new employee
```

### Jabatan (Job Title) Source
**CRITICAL:** Jabatan comes from:
- `extend_db_ptrj.dbo.employee_estate` (PRIMARY)
- `extend_db_ptrj.dbo.history_gang_member` (FALLBACK)

**NOT** from `HR_GANGLN` - that table only has gang membership.

---

## 2. Attendance & Leave Logic

### Source Tables
- `PR_TASKREGLN` - Active attendance records
- `PR_TASKREGLN_ARC` - Archived attendance records

### Leave Types (Cuti)
| Type | Field | Description |
|------|-------|-------------|
| Cuti Tahunan | `cuti_tahunan` | Annual leave |
| Cuti Sakit/Haid | `cuti_sakit_haid` | Sick leave + menstrual leave |
| Cuti Minggu | `cuti_minggu` | Sunday (not working) |
| Cuti Nasional | `cuti_nasional` | National holidays |
| Total HK | `jumlah_hk` | Total working days in period |

### Leave Calculation (CutiService)
```typescript
calculateWorkingDays(input: CutiCalculationInput): CutiCalculationResult {
    // Effective working days = HK - (Minggu + Nasional)
    // This is what determines if employee appears in payroll
    const effectiveWorkingDays = Math.max(0, totalHk - cutiMinggu - cutiNasional);

    // Other leave (tahunan, sakit/haid) - doesn't affect HK calculation
    const otherLeave = cutiTahunan + cutiSakit;

    // Exclusion check
    const isExcludedFromPayroll = effectiveWorkingDays <= 0 && otherLeave === 0;
}
```

### Hari Kerja Calculation
```typescript
// Hari Kerja = HK - (Cuti Tahunan + Cuti Sakit + Minggu + Nasional)
hari_kerja = jumlah_hk - (cuti_tahunan + cuti_sakit_haid + cuti_minggu + cuti_nasional)
hari_kerja = Math.max(0, hari_kerja)
```

---

## 3. Overtime (Lembur) Calculation

### Source
- `PR_TASKREGLN` with `OT = 1` (active)
- `PR_TASKREGLN_ARC` with `OT = 1` (archived)

### Day Type Classification (LemburCalculator)
```typescript
enum DayType {
    WORKDAY_LONG = "WORKDAY_LONG",     // Mon, Tue, Wed, Thu, Sat (7+ hours)
    WORKDAY_SHORT = "WORKDAY_SHORT",   // Friday (5+ hours)
    SUNDAY = "SUNDAY",                 // Sunday
    HOLIDAY_REGULAR = "HOLIDAY_REGULAR", // Non-religious holiday
    HOLIDAY_RELIGIOUS = "HOLIDAY_RELIGIOUS" // Religious holiday
}
```

### Overtime Rate Tiers
| Day Type | Tier 1 | Tier 2 | Tier 3 | Tier 1 Boundary |
|----------|--------|--------|--------|------------------|
| WORKDAY_LONG | 1.5x | 2x | 2x | 1 hour |
| WORKDAY_SHORT | 1.5x | 2x | 2x | 1 hour |
| SUNDAY | 2x | 3x | 4x | 5/7 hours |
| HOLIDAY_REGULAR | 2x | 3x | 4x | 5/7 hours |
| HOLIDAY_RELIGIOUS | 3x | 4x | 4x | 5/7 hours |

### UPJ Calculation
```typescript
// UPJ = (PayRate × 30) / 173
const upj = payRate > 0 ? (payRate * 30) / 173 : env.LEMBUR_UPJ || 17257;
```

### Overtime Payment Formula
```typescript
calculateOvertimePayment(hours: number, dayType: DayType, upj: number, isFriday: boolean) {
    const config = OVERTIME_RATES[dayType];
    const boundary = isFriday ? config.tier_1_boundary_short : config.tier_1_boundary_long;

    // Tier 1: First N hours
    const tier_1_hours = Math.min(hours, boundary);
    const tier_1_amount = tier_1_hours * upj * config.tier_1_rate;

    // Tier 2 & 3: Remaining hours
    const remaining_hours = Math.max(0, hours - boundary);
    const tier_2_hours = Math.min(remaining_hours, boundary);
    const tier_2_amount = tier_2_hours * upj * config.tier_2_rate;

    const tier_3_hours = Math.max(0, remaining_hours - boundary);
    const tier_3_amount = tier_3_hours * upj * config.tier_3_rate;

    return {
        total_amount: tier_1_amount + tier_2_amount + tier_3_amount,
        tier_1_hours, tier_1_amount,
        tier_2_hours, tier_2_amount,
        tier_3_hours, tier_3_amount
    };
}
```

---

## 4. Gaji Pokok Calculation

### Formula
```typescript
// Gaji Pokok Aktual = Hari Kerja × PayRate
// Hari Kerja = HK - (Cuti Tahunan + Cuti Sakit + Minggu + Nasional)
gaji_pokok_aktual = hari_kerja * pay_rate

// Gaji Pokok Ideal = HK × PayRate (full month)
gaji_pokok_ideal = jumlah_hk * pay_rate
```

### GajiPokokService Method
```typescript
calculateGajiPokok(
    hkCount: number,
    payrate: number,
    cutiTahunan: number = 0,
    cutiSakit: number = 0,
    hkMinggu: number = 0,
    hkNasional: number = 0
): number {
    const totalCuti = cutiTahunan + cutiSakit + hkMinggu + hkNasional;
    const hariKerja = Math.max(0, hkCount - totalCuti);
    return payrate ? hariKerja * payrate : 0;
}
```

---

## 5. Tunjangan (Allowances) Calculation

### Components
| Component | Source | Formula |
|-----------|--------|---------|
| Beras | `PR_ADTRANSLN` DocDesc like '%BERAS%' | `beras_rate × HK` |
| Jabatan | `PR_ADTRANSLN` DocDesc like '%JABATAN%' | Direct from DB |
| Masa Kerja | `PR_ADTRANSLN` DocDesc like '%MASA KERJA%' | Direct from DB |
| Lembur | `PR_TASKREGLN` (OT=1) | From LemburCalculator |

### Total Tunjangan Formula
```typescript
total_tunjangan = beras_jumlah + jabatan_jumlah + masa_kerja_jumlah + lembur_jumlah
```

---

## 6. Premi (Premium) Calculation

### Source
- `PR_ADTRANS` and `PR_ADTRANSLN` where `DocDesc LIKE '%PREMI%'`

### Excluded Patterns (PremiumExtractor)
```typescript
const DEFAULT_EXCLUDE_PATTERNS = [
    'PPH', 'PPH21', 'PPH 21',  // Tax
    'LEMBUR',                    // Overtime
    'BRONDOL',                   // → Static premi_brondol
    'PRUN', 'PRUNING',           // → Static premi_pruning
    'KOREKSI', 'KOREKSI PANEN',  // Correction
    'POTONGAN KOREKSI',
    'SPSI',
    'TUNJANGAN JABATAN',
    'TUNJANGAN MASA KERJA',
    'TUNJANGAN BERAS',
    'JABATAN', 'BERAS', 'MASA', 'POTONGAN'
];
```

### Premi Categories
```typescript
interface PremiOutput {
    total_premi: number;      // brondol + dynamic_premi
    brondol: number;          // From PR_LOOSEFRUIT + PR_ADTRANS (BRONDOL)
    pruning: number;          // Static column
    dynamic_premi: Record<string, number>;  // Other premiums by DocDesc
}
```

### Total Premi Formula
```typescript
// NOTE: Koreksi is NOT included in total_premi
total_premi = premi_brondol + premi_pruning + SUM(dynamic_premi)
```

---

## 7. Caruman (BPJS) Calculation

### Source
- `carumanDefinitions.ts` (Single Source of Truth)

### Base Calculation
```typescript
// BASE = (Upah Dasar × 30) + Tunjangan Masa Kerja
const base = (upah_dasar * 30) + masa_kerja_jumlah;
const gaji_standar = upah_dasar * 30;
```

### Rate Definitions (carumanDefinitions.ts)
```typescript
const CARUMAN_RATES = {
    // ASTEK / Jamsostek
    ASTEK_PEKERJA_JHT: 0.02,        // 2%
    ASTEK_MAJIKAN_JKK_JKM: 0.0084,  // 0.84%
    ASTEK_MAJIKAN_JHT: 0.037,       // 3.7%

    // BPJS Kesehatan
    BPJS_KES_PEKERJA: 0.01,         // 1%
    BPJS_KES_MAJIKAN: 0.04,         // 4%

    // BPJS Pensiun
    BPJS_PENSIUN_PEKERJA: 0.01,     // 1%
    BPJS_PENSIUN_MAJIKAN: 0.02,     // 2%
};
```

### Caruman Components
```typescript
interface CarumanResult {
    // ASTEK
    astek_pekerja: base * 0.02;
    astek_majikan_jkk_jkm: base * 0.0084;
    astek_majikan_jht: base * 0.037;

    // BPJS Kesehatan
    bpjs_kes_pekerja: base * 0.01;
    bpjs_kes_majikan: base * 0.04;

    // BPJS Pensiun
    bpjs_pensiun_pekerja: base * 0.01;
    bpjs_pensiun_majikan: base * 0.02;
}
```

---

## 8. Tax (PPh21 TER) Calculation

### PTKP Mapping (PTKPMapper.ts - Single Source of Truth)
```typescript
const BERAS_RATE_TO_PTKP = {
    // Standard rates
    2250: 'TK/0', 3250: 'TK/1', 4200: 'TK/2',
    3700: 'K/0', 4650: 'K/1', 5500: 'K/2', 6450: 'K/3',
    // Legacy DB mappings (150/kg formulas)
    3150: 'TK/1', 4050: 'TK/2', 4950: 'TK/3',
    3600: 'K/0', 4500: 'K/1', 5400: 'K/2', 6300: 'K/3',
};

const PTKP_TO_TER = {
    'TK/0': 'TER A', 'TK/1': 'TER A', 'K/0': 'TER A',
    'TK/2': 'TER B', 'TK/3': 'TER B', 'K/1': 'TER B', 'K/2': 'TER B',
    'K/3': 'TER C',
};
```

### PTKP Amounts by Year
```typescript
const PTKP_AMOUNTS = {
    2025: {
        'TK/0': 54000000, 'TK/1': 58500000, 'TK/2': 63000000, 'TK/3': 67500000,
        'K/0': 58500000, 'K/1': 63000000, 'K/2': 67500000, 'K/3': 72000000,
    },
    2026: {
        'TK/0': 54000000, 'TK/1': 58500000, 'TK/2': 63000000, 'TK/3': 67500000,
        'K/0': 58500000, 'K/1': 63000000, 'K/2': 67500000, 'K/3': 72000000,
    }
};
```

### TER Rate Layers (PP 58/2023 / PER-16/PJ/2022)
```
Gross Monthly Income (Upah Kotor)
    ├── 0 - 5,400,000        → 0.00%
    ├── 5,400,001 - 5,650,000 → 0.25%
    ├── 5,650,001 - 5,950,000 → 0.50%
    ├── ... (40-44 layers per category)
    └── Highest income       → 34%
```

### Taxable Income Formula
```typescript
// For PPh21 TER calculation:
// Bruto = Gaji + Tunjangan + Lembur + Premi + astek_m + bpjs_m
// Penghasilan Bruto = jumlah_upah_kotor + astek_majikan + bpjs_majikan

// Then apply TER rate based on monthly gross income
```

---

## 9. Take-Home Pay (Upah Bersih) Calculation

### PayrollCalculator (Single Source of Truth)

#### 3-Level Upah Architecture
```typescript
// Level 1: UPAH KOTOR (Gross without koreksi/pendapatan_lainnya)
upah_kotor = gaji_pokok_aktual + total_tunjangan + total_premi

// Level 2: JUMLAH UPAH KOTOR (Daftar Upah display)
jumlah_upah_kotor = upah_kotor + pot_koreksi + pendapatan_lainnya
// NOTE: koreksi SUBTRACTED from display, lainnya ADDED

// Level 3: PENGHASILAN BRUTO (For PPh21 TER)
penghasilan_bruto = jumlah_upah_kotor + astek_majikan + bpjs_majikan
// NOTE: koreksi & lainnya ARE part of taxable income
```

#### Total Potongan Formula
```typescript
// IMPORTANT: koreksi NOT included (already in jumlah_upah_kotor)
// IMPORTANT: pendapatan_lainnya MUST be included (to offset the + in gross)
total_potongan =
    astek_pekerja +
    bpjs_kes_pekerja +
    bpjs_pensiun_pekerja +
    spsi +
    pph21 +
    other_potongan +
    pendapatan_lainnya  // WAJIB - offsets the + in gross
```

#### Upah Bersih Formula
```typescript
// NOTE: premi_pph = ADDITION (+), not deduction (-)
upah_bersih = jumlah_upah_kotor - total_potongan + premi_pph
```

---

## 10. Employee Filtering Logic

### Critical Filter Rules (dataExtractorService.ts)

```typescript
// Effective Work HK = HK - (Minggu + Libur Nasional)
const effective_work_hk = hk - (empCuti.cuti_minggu + empCuti.cuti_nasional);

// Cuti lain (tahunan, sakit/haid)
const other_cuti = empCuti.cuti_tahunan + empCuti.cuti_sakit_haid;

// FILTER LOGIC:
// - effective_work_hk <= 0 AND other_cuti == 0 → FILTERED OUT
// - effective_work_hk <= 0 BUT other_cuti > 0 → KEPT
// - effective_work_hk > 0 → Always KEPT
if (effective_work_hk <= 0 && other_cuti == 0) {
    continue; // Skip this employee
}
```

### Filter Decision Table
| HK | Minggu | Nasional | Tahunan | Sakit/Haid | Result |
|----|--------|----------|---------|------------|--------|
| >0 | any | any | any | any | **KEPT** |
| 0 | 0 | 0 | 0 | 0 | **FILTERED OUT** |
| 0 | 0 | 0 | >0 | 0 | **KEPT** |
| 0 | 0 | 0 | 0 | >0 | **KEPT** |
| 0 | >0 | >0 | 0 | 0 | **FILTERED OUT** |
| 0 | >0 | >0 | >0 | 0 | **KEPT** |

---

## 11. Pendapatan Lainnya (THR, Bonus, etc)

### Source
- `PR_ADTRANS` and `PR_ADTRANSLN` with specific DocDesc patterns
- `OtherIncomesService` processes these

### Categories
```typescript
interface PendapatanLainnya {
    thr?: number;              // Tunjangan Hari Raya
    bonus?: number;            // Bonus
    custom?: number;           // Custom income types
    kontan?: number;           // Cash allowance
}
```

### Flow in PayrollCalculator
```typescript
// Pendapatan Lainnya Flow:
// 1. jumlah_upah_kotor: ADDED (+)
// 2. total_potongan: SUBTRACTED (-) to offset
// 3. Net effect on upah_bersih = 0 (but required for slip display)
```

---

## 12. Data Extraction Flow

### Main Flow (dataExtractorService.extractPayrollData)

```
Request (month, year, gangCode)
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 1. INTERCEPTOR CHECK                                          │
│    Check cacheService for historical period data              │
│    If cached → return cached data                              │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 2. PARALLEL DATA FETCHING (Promise.all)                       │
├───────────────────────────────────────────────────────────────┤
│ • getEmployees()          → HR_EMPLOYEE, HR_GANGLN           │
│ • getAttendance()        → PR_TASKREGLN (+ ARC fallback)    │
│ • getCuti()              → PR_TASKREGLN (leave types)        │
│ • getPremi()             → PR_ADTRANS (DocDesc like PREMI%)  │
│ • getPotongan()          → PR_ADTRANS (DocDesc like POT%)    │
│ • getLemburDetails()     → lemburCalculator.calculate()      │
│ • getOtherIncomes()      → OtherIncomesService               │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 3. EMPLOYEE FILTERING                                          │
│    Apply HK > 0 filter rules (see Section 10)                 │
│    Skip excluded employees                                     │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 4. PAYROLL CALCULATION (PayrollCalculator)                    │
│    For each employee:                                          │
│    • Calculate gaji_pokok_aktual/ideal                        │
│    • Calculate total_tunjangan                                 │
│    • Calculate total_premi (excluding koreksi)                │
│    • Calculate caruman (BPJS) components                       │
│    • Calculate pph21_ter                                      │
│    • Calculate upah_bersih                                     │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 5. RESPONSE FORMATION                                          │
│    Build PayrollRow[] with all computed fields                │
│    Return JSON tree structure                                  │
└───────────────────────────────────────────────────────────────┘
```

### Progressive Streaming Flow (extractPayrollDataProgressive)

```
Request (month, year, division, SSE)
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 1. PARALLEL GANG QUERIES                                      │
│    For each gang in division:                                 │
│    • Query employees                                          │
│    • Query attendance                                        │
│    • Query premiums, deductions, overtime                    │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 2. SSE META EVENT                                             │
│    Send: { headers, total_gangs, total_employees }            │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 3. STREAM GANG DATA (batched by 5)                             │
│    For each batch:                                            │
│    • Send 'gang' event with employees + totals               │
│    • Send 'progress' event                                    │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 4. SSE COMPLETE EVENT                                         │
│    Send: { grand_total, execution_time }                     │
└───────────────────────────────────────────────────────────────┘
```

---

## Appendix: Service to File Mapping

| Service | File Location |
|---------|---------------|
| DataExtractorService | `backend/src/services/dataExtractorService.ts` |
| PayrollService | `backend/src/services/payrollService.ts` |
| LemburCalculator | `backend/src/services/lemburCalculator.ts` |
| CutiService | `backend/src/services/employee/CutiService.ts` |
| CarumanDefinitions | `backend/src/services/carumanDefinitions.ts` |
| PTKPMapper | `backend/src/services/payroll/formulas/PTKPMapper.ts` |
| PayrollCalculator | `backend/src/services/payroll/components/PayrollCalculator.ts` |
| PremiService | `backend/src/services/payroll/components/PremiService.ts` |
| TaxCalculationService | `backend/src/services/tax/TaxCalculationService.ts` |
| DivisionConfigService | `backend/src/services/config/DivisionConfigService.ts` |

---

## Appendix: Key Business Rules Summary

1. **NIK Immutable**: Once stored, NIK cannot be updated
2. **Append-Only History**: Use INSERT with version_index, not UPDATE
3. **Caruman Base = Gaji Standar + Masa Kerja**: `base = (payrate × 30) + masa_kerja_jumlah`
4. **Koreksi NOT in Potongan**: Already in jumlah_upah_kotor display
5. **Pendapatan Lainnya MUST in Potongan**: To offset the + in gross
6. **premi_pph is ADDITION**: Not subtraction in upah_bersih calculation
