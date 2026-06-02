# Planning Context: Premium Excel Seeder Feature

## Source Evidence
- `exploration-patterns.json` - Existing premiumImportService.ts with hardcoded ALLOWED_JENIS (PRUNING, RAKING) and positional 5-column layout. premiumDefinitionService.ts defines input_type enum driving metadata shapes. ExcelJS already installed.
- `exploration-integration-points.json` - Primary modify target: premiumImportService.ts L30-L141. Persistence: ManualAdjustmentService.saveAdjustment() L2161-L2283. Route: POST /payroll/premium-import-excel at payroll.ts L3487-L3536. 22 premium types in definitions JSON.
- `premiumImportService.ts:L21` - `ALLOWED_JENIS = ['PREMI PRUNING', 'PREMI RAKING']` -- core limitation to lift.
- `premiumImportService.ts:L48-L74` - Hardcoded positional columns (values[1]=empcode, values[2]=gangCode, values[3]=subblok, values[4]=jumlah, values[5]=jenis). Must generalize to header-name-based.
- `premiumImportService.ts:L96-L113` - metadata_json always hardcoded as `input_type: 'blok'`. Must vary by actual input_type.
- `premiumDefinitionService.ts:L21` - `PremiumInputType = 'amount' | 'blok' | 'exp' | 'kendaraan' | 'blok,exp'` -- 5 variants.
- `premium_definitions.json` - 22 entries: 9 blok types, 1 amount, 1 exp, 9 kendaraan. Phase 1 targets 7 blok types.
- `manualAdjustmentService.ts:L2161-L2283` - saveAdjustment() with UPSERT: checks existing by period+emp_code+adjustment_name, updates if found, inserts if new.
- `manualAdjustmentNaming.ts:L15-L20` - normalizeStoredAdjustmentName: trim + collapse whitespace + uppercase. adjustment_name must survive this.
- `historySeederService.ts:L29-L72` - SeederResult, SeederProgress patterns for progress tracking.
- `ptkpExcelDryRunService.ts` - Dry-run pattern: parse, validate, classify actions, return preview.

## Understanding
- **Current State**: premiumImportService.ts imports only PREMI PRUNING and PREMI RAKING using hardcoded positional columns (cols 1-5). Each row is one employee+subblok+amount+jenis pair. Groups by empcode+jenis, builds MetadataBlok, calls saveAdjustment. No dry-run, no progress tracking, no upsert awareness (but saveAdjustment itself does UPSERT internally).
- **Problem**: Need to extend to all premium types from premium_definitions.json. Different input_types need different Excel columns (blok needs subblok, kendaraan needs nomor_kendaraan, exp needs expense_code). Current positional approach too brittle. No preview -- user sees errors only after commit.
- **Approach**: Phase 1 targets blok input_type only (7 active types: PRUNING, RAKING, KINERJA, INSENTIF PANEN, TBS, JAGA, BANTU BRONDOL). Build header-name-based column mapping engine first. Add dry-run preview pipeline. Then generalize import function. Extend API routes. Build frontend seeder UI.

## Key Decisions
- Decision: Header-name-based column mapping | Rationale: More flexible than positional, supports varying column sets per premium type, survives column reordering | Evidence: exploration-patterns.json clarification_needs[0] recommended
- Decision: Both template generation AND free-form upload | Rationale: Templates for field operators, free-form for power users. Best UX | Evidence: clarification_needs[2] recommended
- Decision: Dry-run preview required before commit | Rationale: Reduces risk of bad data; follows ptkpExcelDryRunService precedent | Evidence: clarification_needs[3] recommended
- Decision: Upsert by unique key (period + emp_code + adjustment_name) | Rationale: Prevents duplicate counting on re-import; saveAdjustment already implements this | Evidence: manualAdjustmentService.ts L2191-L2237
- Decision: Phase 1 = blok input_type premiums only (7 types) | Rationale: Most common types, reduces scope, establishes pattern for other input_types | Evidence: clarification_needs[5] recommended
- Decision: Per-sheet premium type designation (sheet name = premium definition name) | Rationale: Clean separation, one workbook can carry multiple premium types | Evidence: exploration-integration-points.json clarification_needs[1] recommended

## Dependencies
- Depends on: premiumDefinitionService (defines valid types and input_type), ManualAdjustmentService.saveAdjustment (write target), ExcelJS (already installed)
- Provides for: Non-blok input_type seeder phases (exp, kendaraan, blok+exp, amount), template generation for all premium types
