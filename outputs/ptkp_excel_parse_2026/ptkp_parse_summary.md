# Parsed PTKP Excel Context

Generated at: `2026-05-02T16:15:34`
Source folder: `C:\Users\nbgmf\Downloads\FW__PPH_21_WORKSHOP_ARE_2026,_PAJAK_NURSERY_2026,_PERHITIUNGAN_PPH_21_2026_PGE_1A,_PERHITUNGAN_PPH_21__2026_PGE_2B,_PERHITUNGAN_PPH_21_2026_ARE_C,_P`

## Scope

- Workbooks scanned: 13
- Sheets scanned: 157
- Employee PTKP sheets: 38
- All valid employee PTKP rows: 1808
- Current 2026 candidate rows: 1610
- Current 2026 unique NIK: 1596
- Current 2026 missing/invalid NIK rows: 2

## PTKP Distribution - Current 2026 Candidates

- `K/0`: 144
- `K/1`: 400
- `K/2`: 357
- `K/3`: 47
- `TK/0`: 628
- `TK/1`: 25
- `TK/2`: 9

## Conflict By NIK - Current 2026

- `1902014705720002` / FEROSA DALINA: K/0, TK/0 (2 rows)
  - PERHITUNGAN PPH 21 2026 PGE 1B.xlsx :: PADANG TEMBALUN!37 = `K/0`
  - PPH 21 JANUARI 2026 ARE B2.xlsx :: AIR BANGEK!101 = `TK/0`
- `1906041212900001` / SUTRISNO: K/0, K/2 (2 rows)
  - PERHITUNGAN PPH 21 2026 PGE 1B.xlsx :: PADANG TEMBALUN!87 = `K/0`
  - PERHITUNGAN PPH 21 2026 PGE 1B.xlsx :: GUNUNG RUM!31 = `K/2`

## Rows Needing Name Fallback

- PERHITUNGAN PPH 21 2026 ARE C.xlsx :: BUKIT PASAK!61 `JULI MARWANDI` = `K/0`
- PERHITUNGAN PPH 21 2026 ARE C.xlsx :: BUKIT PASAK!75 `MARLAN HERTANTO` = `K/0`

## Explicit Old Sheets Skipped From Current 2026 Candidate Set

- PERHITUNGAN PPH 21 2026 ARE C.xlsx :: Maret'24 (84 rows)
- PERHITUNGAN PPH 21 2026 ARE C.xlsx :: April'24 (84 rows)
- PPH 21 WORKSHOP ARE 2026.xlsx :: PPH 21 THR' 24. (2) (5 rows)
- PPH 21 WORKSHOP ARE 2026.xlsx :: PPH 21 APRIL + EXGRATIA'2024 (5 rows)
- PPH 21 WORKSHOP ARE 2026.xlsx :: PPH JANUARI 2025 (5 rows)
- PPH 21 WORKSHOP ARE 2026.xlsx :: PPH FEBUARI 2025  (5 rows)
- PPH 21 WORKSHOP ARE 2026.xlsx :: PPH 21 THR + GAJI MARET'25 (5 rows)
- PPH 21 WORKSHOP ARE 2026.xlsx :: PPH 21 APRIL 25 (5 rows)

## Output Files

- `ptkp_parse_context.json`: semua workbook/sheet/sel non-kosong, formula, format angka, merged ranges, header mapping, dan records.
- `ptkp_employee_records_all.csv`: semua row karyawan dengan PTKP valid dari semua sheet.
- `ptkp_employee_records_current_2026.csv`: row kandidat update 2026 setelah sheet lama disaring.
- `ptkp_sheet_index.csv`: index workbook/sheet dan klasifikasi hasil parsing.
- `ptkp_update_candidates_current_2026.csv`: grouping per NIK/nama dengan status konflik untuk tahap update berikutnya.
