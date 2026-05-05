# Validated NIK PTKP Update 2026

Generated at: `2026-05-02T11:29:37.674Z`
Mode: `EXECUTE`
Target: `extend_db_ptrj / SERVER_PROFILE_1`

## Scope

- Strict NIK candidates from risk report: 1344
- Profile-validated update candidates: 106
- Already same in database: 1116
- Skipped by profile validation: 122
- Executed updates: 106
- Verified updated rows: 106

## Validation Status

- `PROFILE_MATCHED`: 1222
- `PROFILE_MISMATCH_NAME`: 103
- `PROFILE_MISMATCH_NIK`: 9
- `PROFILE_NOT_FOUND`: 10

## Safety Rules

- Source row must be `READY_UPDATE_PTKP` and `can_update=YES` from the prior dry-run.
- Match status must be exactly `MATCH_NIK`.
- Empcode must be single, PTKP must be single, and NIK must be valid 16 digits.
- Target `history_ptkp_pajak` row must exist for period 2026.
- Target `Empcode`, `NIK`, and normalized name must match before update.
- Ambiguous, unmatched, name-only, and PTKP conflict rows are not updated.
