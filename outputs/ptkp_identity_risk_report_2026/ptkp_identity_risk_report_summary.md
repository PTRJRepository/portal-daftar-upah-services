# PTKP Identity Risk Report 2026

Generated at: `2026-05-02T11:18:06.099Z`

## Scope

- Parsed row-level records: 1610
- Parsed unique identities: 1597
- Dry-run rows: 1597
- Review queue rows: 253
- Ready update rows: 1344
- Blocked rows: 245

## Focus Issues

- Unmatched / no Empcode: 216
- Ambiguous Empcode: 29
- PTKP conflict: 1
- Name-only match risk: 7

## Dry Run Action

- `BLOCKED_AMBIGUOUS_EMPCODE`: 29
- `BLOCKED_UNMATCHED`: 216
- `READY_UPDATE_PTKP`: 1344
- `REVIEW_NAME_MATCH`: 7
- `REVIEW_PTKP_CONFLICT`: 1

## Risk Level

- `HIGH`: 246
- `LOW`: 1344
- `MEDIUM`: 7

## Match Status From Parsing

- `AMBIGUOUS_NIK`: 29
- `MATCH_NAME`: 8
- `MATCH_NIK`: 1356
- `UNMATCHED`: 217

## Report Files

- `01_parsing_rows_current_2026.csv`: hasil parsing row-level lengkap.
- `02_parsing_unique_current_2026.csv`: hasil parsing dedupe per identity.
- `03_dry_run_update_plan_all.csv`: simulasi action update semua unique identity.
- `04_review_queue_all.csv`: semua data yang perlu review sebelum update.
- `05_unmatched.csv`: data tidak punya Empcode.
- `06_ambiguous_empcode.csv`: data dengan kandidat Empcode lebih dari satu.
- `07_ptkp_conflict.csv`: data dengan PTKP berbeda antar source.
- `08_name_match_risk.csv`: data yang match via nama, bukan NIK.
- `ptkp_identity_risk_report.xlsx`: workbook report dengan sheet terpisah.

No database update was performed. This is a parsing and dry-run report only.
