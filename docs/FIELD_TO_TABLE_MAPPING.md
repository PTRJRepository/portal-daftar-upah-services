# Daftar Upah - Complete Field-to-Table Mapping

**Updated:** 2026-04-22  
**Source:** `dataExtractorService.ts`, `PayrollCalculator.ts`, `carumanDefinitions.ts`

---

## DAFTAR UPAH - TABLE-TO-FIELD MAPPING

### EMPLOYEE IDENTITY

| Field | Source Table | Source Column | Calculation |
|-------|-------------|---------------|------------|
| `nik` | HR_EMPLOYEE | NewICNo | Direct from DB |
| `emp_code` | HR_EMPLOYEE | EmpCode | Plantware internal ID |
| `nama` | HR_EMPLOYEE | EmpName | Direct from DB |
| `jenis_kelamin` | HR_EMPLOYEE | Gender | 'L' or 'P' |
| `alamat` | HR_EMPLOYEE | Address | Direct from DB |
| `gang_code` | HR_GANGLN | GangCode | Join HR_GANGLN → HR_GANG |
| `loc_code` | HR_GANG | LocCode | Division location code |
| `jabatan` | employee_estate / history_gang_member | job_title | Fallback: HR_GANGLN.Jabatan |

---

### ATTENDANCE (HK)

| Field | Source Table | Source Column | Calculation |
|-------|-------------|---------------|------------|
| `jumlah_hk` | PR_TASKREGLN | SUM(HK) | Total HK per employee per period |
| `hari_kerja` | Calculated | - | `jumlah_hk - cuti_tahunan - cuti_sakit_haid - cuti_minggu - cuti_nasional` |
| `total_jam_kerja` | PR_TASKREGLN | SUM(Hours) | Total work hours |

**Leave Breakdown:**
| Field | Source Table | Condition |
|-------|-------------|-----------|
| `cuti_tahunan` | PR_TASKREGLN | TaskCode = 'TAHUNAN' |
| `cuti_sakit_haid` | PR_TASKREGLN | TaskCode IN ('SAKIT', 'HAID') |
| `cuti_minggu` | PR_TASKREGLN | TaskCode = 'MINGGU' |
| `cuti_nasional` | PR_TASKREGLN | TaskCode = 'NASIONAL' |

---

### GAJI POKOK

| Field | Source Table | Source Column | Calculation |
|-------|-------------|---------------|------------|
| `upah_dasar` | HR_PAYROLL | PayRate | Daily wage rate |
| `gaji_pokok_aktual` | Calculated | - | `hari_kerja × pay_rate` |
| `gaji_pokok_ideal` | Calculated | - | `jumlah_hk × pay_rate` |
| `gaji_pokok` | Calculated | - | Same as gaji_pokok_aktual |
| `gaji_pokok_bulanan` | Calculated | - | `pay_rate × 30` (for ASTEK/BPJS) |

---

### TUNJANGAN

| Field | Source Table | Source Column | Calculation |
|-------|-------------|---------------|------------|
| `beras_rate` | HR_PAYROLL | BerasRate | Rice ration rate |
| `beras_jumlah` | Calculated | - | `beras_rate × jumlah_hk` |
| `jabatan_rate` | PR_ADTRANSLN | Amount | From DocDesc LIKE '%JABATAN%' |
| `jabatan_jumlah` | PR_ADTRANSLN | Amount | Total from DB |
| `masa_kerja_tahun` | Calculated | - | From join_date: `(now - join_date) / 365 days` |
| `masa_kerja_rate` | PR_ADTRANSLN | Amount | From DocDesc LIKE '%MASA KERJA%' |
| `masa_kerja_jumlah` | PR_ADTRANSLN | Amount | Total from DB |
| `total_tunjangan` | Calculated | - | `beras_jumlah + jabatan_jumlah + masa_kerja_jumlah + lembur_jumlah` |

---

### LEMBUR (OVERTIME)

| Field | Source Table | Source Column | Calculation |
|-------|-------------|---------------|------------|
| `lembur_jam` | PR_TASKREGLN | SUM(Hours) | WHERE OT = 1 |
| `lembur_jumlah` | Calculated | - | Tier-based calculation (see below) |
| `lembur_rate` | Calculated | - | Weighted average of tier rates |
| `lembur_records` | PR_TASKREGLN | - | Array of individual OT transactions |

**Lembur Calculation:**
```typescript
UPJ = payRate > 0 ? (payRate × 30) / 173 : env.LEMBUR_UPJ (default: 17257)

For each OT record:
  1. Classify day type (WORKDAY/SUNDAY/HOLIDAY)
  2. Apply tier rates:
     - WORKDAY: 1.5x (1hr), 2x (rest)
     - SUNDAY: 2x (7hrs), 3x (next), 4x (rest)
     - HOLIDAY: 2x (7hrs), 3x (next), 4x (rest)
     - HOLIDAY_RELIGIOUS: 3x (7hrs), 4x (rest)
  3. Sum: total = tier1 + tier2 + tier3
```

---

### PREMI

| Field | Source Table | Source Column | Calculation |
|-------|-------------|---------------|------------|
| `premi_brondol` | PR_LOOSEFRUIT + PR_ADTRANS | SUM(Amount) | BRONDOL from both sources |
| `premi` | PR_ADTRANS | DocDesc, Amount | Dynamic: DocDesc LIKE '%PREMI%' (excludes PPH, LEMBUR, BRONDOL, PRUN, KOREKSI) |
| `total_premi` | Calculated | - | `premi_brondol + SUM(other dynamic premi)` |

**Premi Excluded Patterns:**
- PPH, PPH21, LEMBUR
- BRONDOL (separate column)
- PRUN, PRUNING
- KOREKSI, KOREKSI PANEN
- SPSI, TUNJANGAN JABATAN, TUNJANGAN MASA KERJA

---

### CARUMAN (BPJS/ASTEK)

| Field | Source | Calculation |
|-------|--------|-------------|
| `pot_astek_pekerja` | Calculated | `round(base × 0.02)` |
| `pot_astek_majikan` | Calculated | `round(base × 0.0454)` |
| `pot_astek_jumlah` | Calculated | `astek_pekerja + astek_majikan` |
| `pot_bpjs_kesehatan_pekerja` | Calculated | `round(base × 0.01)` |
| `pot_bpjs_kesehatan_majikan` | Calculated | `round(base × 0.04)` |
| `pot_bpjs_kesehatan_jumlah` | Calculated | `pekerja + majikan` |
| `pot_bpjs_pensiun_pekerja` | Calculated | `round(base × 0.01)` |
| `pot_bpjs_pensiun_majikan` | Calculated | `round(base × 0.02)` |
| `pot_bpjs_pensiun_jumlah` | Calculated | `pekerja + majikan` |
| `pot_bpjs_pekerja_total` | Calculated | `astek + bpjs_kes + bpjs_pensiun` |

**Caruman Base:**
```typescript
BASE = (upah_dasar × 30) + masa_kerja_jumlah
```

---

### TAX (PPH21 TER)

| Field | Source | Calculation |
|-------|--------|-------------|
| `status_ptkp` | Calculated | Map from beras_rate → PTKP status |
| `kategori_ter` | Calculated | Map from PTKP → TER category (A/B/C) |
| `pot_pph21` | PR_ADTRANS | TaskDesc = 'PPH21' (deducted in payroll) |
| `pph21_ter` | Calculated | `penghasilan_bruto × TER_rate` |
| `tarif_pajak_ter` | rule_TER_pajak.json | Layered rate based on gross + PTKP |
| `penghasilan_bruto` | Calculated | `jumlah_upah_kotor + astek_majikan + bpjs_majikan` |

**PTKP Mapping:**
| beras_rate | PTKP | TER |
|-----------|------|-----|
| 2250 | TK/0 | A |
| 3250 | TK/1 | A |
| 3700 | K/0 | A |
| 4200 | TK/2 | B |
| 4650 | K/1 | B |
| 5500 | K/2 | B |
| 6450 | K/3 | C |

---

### 3-LEVEL UPAH

| Level | Field | Formula |
|-------|-------|---------|
| 1 | `upah_kotor` | `gaji_pokok_aktual + total_tunjangan + total_premi` |
| 2 | `jumlah_upah_kotor` | `upah_kotor - pot_koreksi + pendapatan_lainnya` |
| 3 | `penghasilan_bruto` | `jumlah_upah_kotor + astek_majikan + bpjs_majikan` |

---

### POTONGAN

| Field | Source | Formula |
|-------|--------|---------|
| `pot_koreksi` | PR_ADTRANS | TaskDesc LIKE 'KOREKSI%' |
| `pot_spsi` | PR_ADTRANS | TaskDesc = 'SPSI' |
| `pot_pph21` | PR_ADTRANS | TaskDesc = 'PPH21' |
| `other_potongan` | PR_ADTRANS | Dynamic: exclude KOREKSI, SPSI, PPH21 |
| `pot_premi_pph` | PR_ADTRANS | TaskDesc = 'PREMI_PPH' (ADDITION to upah_bersih) |

**Total Potongan Formula:**
```typescript
total_potongan =
    astek_pekerja +
    bpjs_kes_pekerja +
    bpjs_pensiun_pekerja +
    spsi +
    pph21 +
    other_potongan +
    pendapatan_lainnya
// NOTE: pot_koreksi NOT included (already in jumlah_upah_kotor)
```

---

### UPAH BERSIH

| Field | Formula |
|-------|---------|
| `upah_bersih` | `jumlah_upah_kotor - total_potongan + premi_pph` |

---

### PENDAPATAN LAINNYA

| Field | Source | Note |
|-------|--------|------|
| `pendapatan_lainnya` | employee_other_incomes | THR, Bonus, Custom, KONTAN |
| `taxable_pendapatan_thr` | employee_other_incomes | is_taxable = true |
| `taxable_pendapatan_bonus` | employee_other_incomes | is_taxable = true |
| `taxable_pendapatan_custom` | employee_other_incomes | is_taxable = true |

**Pendapatan Lainnya Flow:**
```typescript
// 1. Add to jumlah_upah_kotor (+)
jumlah_upah_kotor += pendapatan_lainnya

// 2. Subtract from total_potongan (-)
total_potongan += pendapatan_lainnya  // to offset

// Net effect on upah_bersih = 0 (but required for slip display)
```

---

### BUNCHES (HARVEST GANGS)

| Field | Source Table | Calculation |
|-------|-------------|-------------|
| `bunches_total` | PR_LOOSEFRUIT | SUM(Bunches) |
| `bunches_ripe` | PR_LOOSEFRUIT | Ripeness = 'RIPE' |
| `bunches_unripe` | PR_LOOSEFRUIT | Ripeness = 'UNRIPE' |
| `bunches_overripe` | PR_LOOSEFRUIT | Ripeness = 'OVERRIPE' |
| `bunches_rotten` | PR_LOOSEFRUIT | Ripeness = 'ROTTEN' |
| `bunches_abnormal` | PR_LOOSEFRUIT | Ripeness = 'ABNORMAL' |
| `loose_fruit` | PR_LOOSEFRUIT | Loose fruit weight |

---

### KEY FILTER RULES

**Employee Filtering (dataExtractorService.ts ~line 898):**
```typescript
// effective_hk = HK - Minggu - Nasional
const effective_hk = hk - (empCuti.cuti_minggu + empCuti.cuti_nasional);

// IF effective_hk <= 0 → EXCLUDE
if (effective_hk <= 0) continue;
```

**Premi Exclusion (dataExtractorService.ts ~line 951):**
```typescript
if (key !== "koreksi") {
    total_premi += amount;
}
// koreksi is NOT included in total_premi
```

---

### DATABASE PROFILES

| Profile | Database | Tables Used |
|---------|----------|------------|
| SERVER_PROFILE_2 (prod) | db_ptrj | PR_TASKREGLN, PR_ADTRANS, HR_EMPLOYEE |
| SERVER_PROFILE_1 (dev) | extend_db_ptrj | Aggregation tables |
| SERVER_PROFILE_3 | VenusHR14 | HR_EMPLOYEE, HR_GANG |
| SERVER_PROFILE_3 | db_ptrj_mill | WM_TICKET (FFB weight) |

---

### SERVICE LOCATION

| Service | File |
|---------|------|
| DataExtractor | `services/dataExtractorService.ts` |
| GajiPokokService | `services/payroll/components/GajiPokokService.ts` |
| LemburCalculator | `services/lemburCalculator.ts` |
| CarumanDefinitions | `services/carumanDefinitions.ts` |
| PTKPMapper | `services/payroll/formulas/PTKPMapper.ts` |
| Pph21TerService | `services/pph21TerService.ts` |
| PayrollCalculator | `services/payroll/components/PayrollCalculator.ts` |
