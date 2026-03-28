# Flow Diagram: Other Income dan Perhitungan Pajak

## 1. Overview System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SYSTEM ARCHITECTURE                                   │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  OtherIncomes    │      │  TaxCalculation  │      │  TaxReport       │
│  Service         │      │  Service         │      │  Service         │
│                  │      │                  │      │                  │
│  - THR           │─────▶│  - PTKP Mapping  │─────▶│  - Form 1721     │
│  - Bonus         │      │  - TER Category  │      │  - Monthly Tax   │
│  - Custom        │      │  - Tax Rates     │      │  - Annual Tax    │
└──────────────────┘      └──────────────────┘      └──────────────────┘
         │                         │                         │
         │                         │                         │
         ▼                         ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATABASE                                        │
│  - employee_other_incomes                                               │
│  - HR_EMPLOYEE, HR_PAYROLL, HR_HISTORY                                 │
│  - Tax calculation results                                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Alur Perhitungan THR

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FLOW: PERHITUNGAN THR 2026                           │
└─────────────────────────────────────────────────────────────────────────┘

START
  │
  ▼
┌──────────────────────────────────────────────────────────────┐
│ 1. LOAD ACTIVE THR PERIOD                                     │
│    loadActiveThrPeriode()                                     │
│                                                               │
│    Returns: { year: 2026, month: 3, type: 'THR' }            │
└──────────────────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. GET ALL EMPLOYEES                                          │
│    - Filter by division/gang                                 │
│    - Filter active employees only                            │
│                                                               │
│    Source: HR_EMPLOYEE, HR_GANGLN                            │
└──────────────────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. FOR EACH EMPLOYEE:                                         │
│                                                               │
│    ┌─────────────────────────────────────────────────────┐   │
│    │ 3a. GET EMPLOYEE DATA                                │   │
│    │     - PayRate (upah_dasar)                          │   │
│    │     - RiceRation (beras_rate)                       │   │
│    │     - Join Date                                     │   │
│    │                                                      │   │
│    │     Source: HR_PAYROLL, HR_EMPLOYMENT               │   │
│    └─────────────────────────────────────────────────────┘   │
│    │
│    ▼
│    ┌─────────────────────────────────────────────────────┐   │
│    │ 3b. GET MASA KERJA                                  │   │
│    │     - masa_kerja_jumlah                             │   │
│    │     - masa_kerja_tahun                              │   │
│    │                                                      │   │
│    │     Source: PR_ADTRANS / HR_HISTORY                 │   │
│    └─────────────────────────────────────────────────────┘   │
│    │
│    ▼
│    ┌─────────────────────────────────────────────────────┐   │
│    │ 3c. CHECK BLACKLIST                                 │   │
│    │     - Skip if employee in blacklist                 │   │
│    │                                                      │   │
│    │     Table: employee_other_incomes_blacklist         │   │
│    └─────────────────────────────────────────────────────┘   │
│    │
│    ▼
│    ┌─────────────────────────────────────────────────────┐   │
│    │ 3d. CALCULATE THR                                    │   │
│    │                                                      │   │
│    │     Formula:                                         │   │
│    │     THR = (UPAH_DASAR × 30) +                       │   │
│    │             (BERAS_RATE × 30) +                     │   │
│    │             MASA_KERJA_JUMLAH                       │   │
│    │                                                      │   │
│    │     If masa_kerja_tahun < 1:                        │   │
│    │     THR = (Full THR × working_months) / 12          │   │
│    └─────────────────────────────────────────────────────┘   │
│    │
│    ▼
│    ┌─────────────────────────────────────────────────────┐   │
│    │ 3e. SAVE TO DATABASE                                 │   │
│    │                                                      │   │
│    │     INSERT INTO employee_other_incomes (             │   │
│    │       nik, emp_name, period_year,                   │   │
│    │       period_month, income_type, amount,            │   │
│    │       is_taxable, details_json                      │   │
│    │     )                                                │   │
│    └─────────────────────────────────────────────────────┘   │
  │
  ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. VERIFICATION                                               │
│    - Count saved records                                     │
│    - Verify total amount                                     │
│    - Check details_json populated                            │
└──────────────────────────────────────────────────────────────┘
  │
  ▼
END (THR saved for period_month = 3)
```

---

## 3. Alur Perhitungan Pajak dengan THR

```
┌─────────────────────────────────────────────────────────────────────────┐
│                FLOW: PERHITUNGAN PAJAK DENGAN THR                        │
└─────────────────────────────────────────────────────────────────────────┘

START (Monthly Tax Calculation)
  │
  ▼
┌──────────────────────────────────────────────────────────────┐
│ 1. LOAD ACTIVE THR PERIOD                                     │
│                                                               │
│    activeThr = loadActiveThrPeriode()                        │
│    → { year: 2026, month: 3 }                                │
└──────────────────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. CHECK IF CURRENT MONTH = THR MONTH                        │
│                                                               │
│    isThrMonth = (activeThr.month === currentMonth)          │
│                                                               │
│    For March 2026: isThrMonth = TRUE                         │
│    For other months: isThrMonth = FALSE                      │
└──────────────────────────────────────────────────────────────┘
  │
  ├──────────────────────┐
  │ isThrMonth = TRUE    │
  ▼                      │
┌──────────────────────────────────────────────────────────────┐
│ 3a. LOAD THR FROM DATABASE                                   │
│                                                               │
│    otherIncomes = OtherIncomesService.getIncomes(            │
│      year, month, 'THR'                                      │
│    )                                                         │
│                                                               │
│    Build map: nik → thr_amount                               │
└──────────────────────────────────────────────────────────────┘
  │
  ├──────────────────────┘
  │ isThrMonth = FALSE   │
  ▼                      │
┌──────────────────────────────────────────────────────────────┐
│ 3b. SKIP THR LOADING                                         │
│    thr_amount = 0                                            │
└──────────────────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. CALCULATE GROSS INCOME                                    │
│                                                               │
│    grossIncome =                                             │
│      upah_kotor (gaji pokok + tunjangan)                    │
│      + astek (0.84%)                                        │
│      + bpjs_kesehatan_majikan (4%)                          │
│      + other_taxable_incomes (THR if isThrMonth)            │
│                                                               │
│    IMPORTANT: THR hanya ditambahkan jika isThrMonth = TRUE  │
└──────────────────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. DETERMINE PTKP STATUS                                     │
│                                                               │
│    ptkpStatus = taxCalculationService.mapBerasRateToPTKP(   │
│      beras_rate                                             │
│    )                                                         │
│                                                               │
│    Example: beras_rate = 4650 → ptkpStatus = 'K/1'          │
└──────────────────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────────────────┐
│ 6. DETERMINE TER CATEGORY                                    │
│                                                               │
│    terCategory = taxCalculationService.mapPTKPToTER(        │
│      ptkpStatus                                             │
│    )                                                         │
│                                                               │
│    Mapping:                                                  │
│    - TK/0, TK/1, K/0 → TER A (5%)                           │
│    - TK/2, K/1, K/2  → TER B (15%)                          │
│    - K/3             → TER C (25%)                          │
└──────────────────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────────────────┐
│ 7. CALCULATE PPh21 TER                                        │
│                                                               │
│    taxRate = TER_RATES[terCategory]                          │
│    pph21 = grossIncome × taxRate                             │
│                                                               │
│    Example:                                                  │
│    - grossIncome = 5,000,000 (without THR)                  │
│    - terCategory = TER B (15%)                              │
│    - pph21 = 5,000,000 × 0.15 = 750,000                     │
│                                                               │
│    With THR (March):                                         │
│    - grossIncome = 5,000,000 + 2,500,000 = 7,500,000        │
│    - pph21 = 7,500,000 × 0.15 = 1,125,000                   │
│    - Tax increase: 375,000                                   │
└──────────────────────────────────────────────────────────────┘
  │
  ▼
END (PPh21 calculated with/without THR)
```

---

## 4. Alur Perhitungan Pajak Tahunan (Form 1721)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                FLOW: PERHITUNGAN PAJAK TAHUNAN (FORM 1721)              │
└─────────────────────────────────────────────────────────────────────────┘

START (Annual Tax Calculation)
  │
  ▼
┌──────────────────────────────────────────────────────────────┐
│ 1. ACCUMULATE MONTHLY INCOME (Jan-Dec)                       │
│                                                               │
│    gaji_pokok_setahun = Σ(gaji_pokok_month)                 │
│    masa_kerja_setahun = Σ(masa_kerja_month)                 │
│    premi_asuransi_setahun = Σ(bpjs + astek_majikan)         │
└──────────────────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. ADD THR AND BONUS                                         │
│                                                               │
│    thr = 0                                                   │
│    bonus = 0                                                 │
│                                                               │
│    // Get THR factors from March (month 3)                  │
│    if (activeThr && activeThr.month === 3) {                │
│      thrFactors = emp.monthly_thr_factors['3']              │
│      thr = (upah_dasar × 30) + (beras_rate × 30) +          │
│            masa_kerja_jumlah                                │
│    }                                                         │
│                                                               │
│    // Get Bonus from JSON/Database                          │
│    bonus = exgratiaMap.get(nik) || 0                        │
│                                                               │
│    thr_bonus_tantiem_setahun = thr + bonus                  │
└──────────────────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. CALCULATE TOTAL PENGHASILAN SETAHUN                       │
│                                                               │
│    total_penghasilan_setahun =                               │
│      gaji_pokok_setahun                                     │
│      + masa_kerja_setahun                                   │
│      + premi_asuransi_setahun                               │
│      + thr_bonus_tantiem_setahun                            │
│      + custom_income_year                                   │
│                                                               │
│    Example:                                                  │
│    - gaji_pokok_setahun = 97,500,000 (75k × 26 × 50 weeks)  │
│    - masa_kerja_setahun = 1,800,000                         │
│    - premi_asuransi = 5,850,000                             │
│    - thr = 2,539,500                                        │
│    - bonus = 1,000,000                                      │
│    ─────────────────────────────────────                    │
│    Total = 108,689,500                                      │
└──────────────────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. CALCULATE BIAYA JABATAN                                   │
│                                                               │
│    biaya_jabatan = MIN(total_penghasilan × 5%, 6,000,000)   │
│                                                               │
│    Example:                                                  │
│    - biaya_jabatan = MIN(108,689,500 × 5%, 6,000,000)       │
│    - biaya_jabatan = MIN(5,434,475, 6,000,000)              │
│    - biaya_jabatan = 5,434,475                               │
└──────────────────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. CALCULATE PENGHASILAN NETTO SETAHUN                       │
│                                                               │
│    penghasilan_netto_setahun =                               │
│      total_penghasilan_setahun                              │
│      - biaya_jabatan                                        │
│      - iuran_jht_jp_setahun                                 │
│                                                               │
│    Example:                                                  │
│    - penghasilan_netto = 108,689,500                        │
│      - 5,434,475                                            │
│      - 975,000                                              │
│    - penghasilan_netto = 102,280,025                        │
└──────────────────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────────────────┐
│ 6. APPLY PTKP                                                │
│                                                               │
│    ptkp_value = getPTKPAmount(ptkp_status, year)            │
│                                                               │
│    PTKP 2026:                                                │
│    - TK/0: 54,000,000                                       │
│    - K/1: 63,000,000                                        │
│    - K/3: 72,000,000                                        │
│                                                               │
│    Example: ptkp_status = 'K/1' → ptkp = 63,000,000         │
└──────────────────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────────────────┐
│ 7. CALCULATE PKP (PENGHASILAN KENA PAJAK)                    │
│                                                               │
│    pkp = MAX(0, penghasilan_netto - ptkp)                   │
│                                                               │
│    Example:                                                  │
│    - pkp = MAX(0, 102,280,025 - 63,000,000)                 │
│    - pkp = 39,280,025                                       │
│    - Round down to thousands: 39,280,000                    │
└──────────────────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────────────────┐
│ 8. CALCULATE PPH21 TERUTANG (PROGRESSIVE RATE)              │
│                                                               │
│    Progressive Brackets 2026:                                │
│    - 0 - 60M: 5%                                            │
│    - 60M - 250M: 15%                                        │
│    - 250M - 500M: 25%                                       │
│    - >500M: 35%                                             │
│                                                               │
│    Example (PKP = 39,280,000):                              │
│    - Tier 1: 39,280,000 × 5% = 1,964,000                    │
│    - pph21_setahun = 1,964,000                              │
└──────────────────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────────────────┐
│ 9. CALCULATE PPH21 DESEMBER                                  │
│                                                               │
│    pph21_desember =                                          │
│      pph21_setahun - pph21_jan_nov                          │
│                                                               │
│    Example:                                                  │
│    - pph21_jan_nov = 1,500,000 (accumulated Jan-Nov)        │
│    - pph21_desember = 1,964,000 - 1,500,000                 │
│    - pph21_desember = 464,000                               │
└──────────────────────────────────────────────────────────────┘
  │
  ▼
END (Form 1721 generated)
```

---

## 5. Timeline THR dan Pajak (2026)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    TIMELINE: THR DAN PAJAK 2026                         │
└─────────────────────────────────────────────────────────────────────────┘

JANUARY 2026              FEBRUARY 2026             MARCH 2026
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│                 │      │                 │      │                 │
│  Normal Tax     │      │  Normal Tax     │      │  Tax + THR      │
│                 │      │                 │      │                 │
│  - No THR       │      │  - No THR       │      │  - THR Paid     │
│  - Regular      │      │  - Regular      │      │  - Higher Tax   │
│    Calculation  │      │    Calculation  │      │    (due to THR) │
│                 │      │                 │      │                 │
│  Gross Income:  │      │  Gross Income:  │      │  Gross Income:  │
│  2,000,000      │      │  2,000,000      │      │  4,500,000      │
│                 │      │                 │      │  (+2.5M THR)    │
│  Tax (15%):     │      │  Tax (15%):     │      │  Tax (15%):     │
│  300,000        │      │  300,000        │      │  675,000        │
│                 │      │                 │      │                 │
└─────────────────┘      └─────────────────┘      └─────────────────┘
       ▲                        ▲                        ▲
       │                        │                        │
       └────────────────────────┴────────────────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │   ANNUAL TAX REPORT     │
                    │      (FORM 1721)        │
                    │                         │
                    │  Includes:              │
                    │  - 12 months salary     │
                    │  - THR (March)          │
                    │  - Bonus                │
                    │  - All allowances       │
                    └─────────────────────────┘

APRIL - DECEMBER 2026
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Normal Tax Calculation (No THR)                               │
│                                                                 │
│  - Regular monthly salary                                      │
│  - No additional THR                                           │
│  - Tax withholding continues                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DATA FLOW: THR CALCULATION                           │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐
│  HR_EMPLOYEE     │
│  - EmpCode       │
│  - NewICNo (NIK) │
│  - EmpName       │
│  - Religion      │
│  - Status        │
└────────┬─────────┘
         │
         │ JOIN
         ▼
┌──────────────────┐
│  HR_PAYROLL      │
│  - PayRate       │──────────┐
│  - RiceRation    │          │
└────────┬─────────┘          │
         │                    │
         │ JOIN               │
         ▼                    │
┌──────────────────┐          │
│  HR_HISTORY      │          │
│  - JoinDate      │          │
│  - MasaKerja     │          │
└────────┬─────────┘          │
         │                    │
         │ EXTRACT            │
         ▼                    │
┌──────────────────┐          │
│  OtherIncomes    │          │
│  Service         │          │
│                  │          │
│  Calculate THR:  │          │
│  (UPAH×30) +     │◀─────────┘
│  (BERAS×30) +    
│  MASA_KERJA      
└────────┬─────────┘
         │
         │ SAVE
         ▼
┌──────────────────┐
│ employee_other_  │
│ incomes          │
│                  │
│ - nik            │
│ - amount         │
│ - period_month=3 │
│ - is_taxable=1   │
│ - details_json   │
└────────┬─────────┘
         │
         │ LOAD
         ▼
┌──────────────────┐
│  TaxReport       │
│  Service         │
│                  │
│  Add to Gross    │
│  Income for Tax  │
│  Calculation     │
└────────┬─────────┘
         │
         │ OUTPUT
         ▼
┌──────────────────┐
│  Tax Report      │
│  (Form 1721)     │
│                  │
│  Includes THR    │
│  in PKP & PPh21  │
└──────────────────┘
```

---

## 7. Comparison: With vs Without THR

```
┌─────────────────────────────────────────────────────────────────────────┐
│            COMPARISON: TAX CALCULATION WITH vs WITHOUT THR              │
└─────────────────────────────────────────────────────────────────────────┘

WITHOUT THR (Jan, Feb, Apr-Dec)
┌────────────────────────────────────────────────────────────┐
│  Employee: John Doe                                        │
│  PTKP: K/1 (beras_rate = 4650)                            │
│  TER: B (15%)                                              │
│                                                            │
│  Monthly Income:                                           │
│  - Gaji Pokok: 1,950,000 (75k × 26 HK)                    │
│  - Masa Kerja: 150,000                                    │
│  - Premi Asuransi: 195,000 (4% + 0.84%)                   │
│  ─────────────────────────────────────                      │
│  Gross Income: 2,295,000                                   │
│                                                            │
│  PPh21 TER: 2,295,000 × 15% = 344,250                     │
└────────────────────────────────────────────────────────────┘

WITH THR (March Only)
┌────────────────────────────────────────────────────────────┐
│  Employee: John Doe                                        │
│  PTKP: K/1 (beras_rate = 4650)                            │
│  TER: B (15%)                                              │
│                                                            │
│  Monthly Income:                                           │
│  - Gaji Pokok: 1,950,000 (75k × 26 HK)                    │
│  - Masa Kerja: 150,000                                    │
│  - Premi Asuransi: 195,000 (4% + 0.84%)                   │
│  - THR: 2,539,500 ← ADDED IN MARCH                        │
│    [(75k×30) + (4650×30) + 150k]                          │
│  ─────────────────────────────────────                      │
│  Gross Income: 4,834,500                                   │
│                                                            │
│  PPh21 TER: 4,834,500 × 15% = 725,175                     │
│                                                            │
│  Tax Increase: 725,175 - 344,250 = 380,925                │
└────────────────────────────────────────────────────────────┘

IMPACT:
- March Gross Income: +110.7% (due to THR)
- March PPh21: +110.7% (higher tax withholding)
- Annual Tax: THR increases PKP and final tax liability
```

---

**Created**: 2026-03-24  
**Version**: 1.0  
**Purpose**: Visual documentation for THR and tax calculation flow
