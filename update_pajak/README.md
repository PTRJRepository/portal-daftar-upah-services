# Tax Mapping Generator - Documentation

## Overview

This tool generates tax mapping JSON files for each division, mapping employees (by emp_code) to their PPh21 TER tax calculations.

## Output Files

Generated in `update_pajak/` directory:

### Per Division Files

1. **`{DIVISION}_pajak.json`** - Tax calculation results
   ```json
   {
     "emp_code": "A0026",
     "emp_name": "HENDRIYADI ( TINA )",
     "nik": "1902051710890001",
     "ptkp_status": "K/2",
     "ter_category": "TER B",
     "gross_income": 6552220.57,
     "pph21_amount": 32761,
     "tax_rate": 0.005
   }
   ```

2. **`{DIVISION}_pph_input.json`** - Input data for verification
   ```json
   {
     "emp_code": "A0026",
     "hk": 26,
     "upah_dasar": 129220,
     "gaji_pokok_aktual": 3359720,
     "tunjangan_beras": 1050000,
     "tunjangan_jabatan": 0,
     "tunjangan_masa_kerja": 0,
     "tunjangan_lembur": 0,
     "total_premi": 0,
     "astek_majikan": 1086,
     "bpjs_kes_majikan": 5168,
     "pot_koreksi": 0,
     "penghasilan_bruto": 6552220.57
   }
   ```

### Summary File

**`_summary.json`** - Overview of all divisions
```json
{
  "periode": {
    "bulan": 3,
    "tahun": 2026
  },
  "generated_at": "2026-04-04T11:42:47.273Z",
  "divisions": {
    "PG1A": {
      "employee_count": 227,
      "total_pph21_ter": 4796100,
      "total_pph21_input": 1294567890,
      "total_selisih": 4796100,
      "file_ter": "PG1A_pajak.json",
      "file_input": "PG1A_pph_input.json",
      "data_source": "success"
    }
  }
}
```

## How to Run

```bash
# From project root directory
bun run generate_tax_mapping.ts
```

The script will:
1. Get the current active period from the database
2. Fetch payroll data for each division
3. Calculate PPh21 TER for each employee
4. Generate JSON files in `update_pajak/`

## Tax Calculation Logic

### Penghasilan Bruto Formula

```
Penghasilan Bruto = 
  Gaji Pokok Aktual +
  Tunjangan Beras +
  Tunjangan Jabatan +
  Tunjangan Masa Kerja +
  Tunjangan Lembur +
  Total Premi +
  ASTEK Majikan (0.84%) +
  BPJS Kesehatan Majikan (4%) -
  Pot Koreksi
```

### PPh21 TER Formula

```
PPh21 = Penghasilan Bruto × Tarif TER
```

Where tarif TER is determined by:
1. PTKP status (from beras_rate) → TER category (A, B, or C)
2. Gross income → Specific tier/rate within that category

### PTKP → TER Mapping

| PTKP | TER Category |
|------|--------------|
| TK/0 | TER A |
| TK/1 | TER A |
| K/0  | TER A |
| TK/2 | TER B |
| TK/3 | TER B |
| K/1  | TER B |
| K/2  | TER B |
| K/3  | TER C |

### Example Tax Brackets (TER A)

| Min Bruto | Max Bruto | Rate |
|-----------|-----------|------|
| 0 | 5,400,000 | 0.00% |
| 5,400,001 | 5,650,000 | 0.25% |
| 5,650,001 | 5,950,000 | 0.50% |
| 5,950,001 | 6,300,000 | 0.75% |
| ... | ... | ... |

## Divisions Processed

- PG1A (Plasma 1A)
- PG1B (Plasma 1B)
- PG2A (Plasma 2A)
- PG2B (Plasma 2B)
- PGE (Plasma Energi)
- AB1 (Air Ruak 1)
- AB2 (Air Ruak 2)
- ARA (Area)
- ARC (Air Ruak Central)
- DME (Dempo)
- IJL (Ijuk)

## Notes

1. **Period**: Uses current active period from database (latest TrxDate + 1 month)
2. **Data Source**: Live payroll data from PR_TASKREGLN and PR_ADTRANS
3. **Performance**: Script takes ~2-5 minutes depending on data size
4. **Employees Filtered**: Only active employees with valid payroll data

## Troubleshooting

### Script is slow
- This is normal - it's fetching data from the database for each division
- Let it run to completion (can take 3-5 minutes for all 11 divisions)

### Tax rate is 0
- This is correct for employees with income below the taxable threshold
- Example: TER A employees with income < 5,400,000 have 0% tax

### No data for a division
- The division may have no active employees for that period
- Check if gang codes are correctly mapped

## File Locations

- **Script**: `refactor_production/generate_tax_mapping.ts`
- **Output**: `refactor_production/update_pajak/`
- **Tax Rules**: `Additional_services/hitung_pajak/rule_TER_pajak.json`
- **PTKP Rules**: `Additional_services/hitung_pajak/rule_PTKP_Tahunan.json`
