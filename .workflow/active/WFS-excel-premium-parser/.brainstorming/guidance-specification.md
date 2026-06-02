---
name: guidance-specification-excel-premium-parser
description: Excel Premium Parser & Seeder — framework spec
type: reference
---

# Guidance Specification: Excel Premium Parser & Seeder

## 1. Concepts & Terminology

### Core Domain Terms

| Term | Definition | Aliases | Category |
|------|-----------|---------|----------|
| PREMI | Pendapatan tambahan di luar gaji pokok/tunjangan tetap | bonus, insentif | income |
| input_type::amount | Premi satu nilai numerik per karyawan, tanpa breakdown lokasi | - | premi-input |
| input_type::blok | Premi multi-baris: subblok + gang_code + jumlah | block-type | premi-input |
| input_type::exp | Single expense entry: expense_code + jumlah | expense-type | premi-input |
| input_type::kendaraan | Premi kendaraan multi-baris: nomor_kendaraan + expense_code + jumlah | vehicle-type | premi-input |
| input_type::blok,exp | Combo: blok_items[] + single expense_code entry | combo-type | premi-input |
| dynamic_premi_data | JSON array dari header premi dinamis + total per kategori | dynamic-premi-json | data-structure |
| manual_adjustment | Entry premium/koreksi dari Excel upload ke tabel adjustment | seeder-entry | process |
| ADTRANS | Tabel Plantware PR_ADTRANS — source dynamic premi | PR_ADTRANS | database |
| KOREKSI | Potongan langsung mengurangi upah_kotor (bukan pot_bersih) | koreksi-hk | deduction |

### Premium Input Type Detail

```
amount     → { jumlah: number }
blok       → { items: [{ subblok: string, gang_code: string, jumlah: number }] }
exp        → { expense_code: string, jumlah: number }
kendaraan  → { items: [{ nomor_kendaraan: string, expense_code: string, jumlah: number }] }
blok,exp   → { blok_items: [...], expense_code: string, expense_jumlah: number }
```

### Active Premium Definitions (from premium_definitions.json)

| adjustment_name | input_type | ad_code pattern |
|-----------------|------------|-----------------|
| PREMI JAGA | blok | (AL) TUNJANGAN JAGA GENSET |
| PREMI JAGA TANGGUNG JAWAB | exp | (AL3GA9050P1A) JAGA TANGGUNG JAWAB |
| PREMI KINERJA | blok | (AL3PM2207P2A) PREMI KINERJA |
| PREMI TIKET | amount | (AL) HARVESTING LABOUR |
| PREMI PRUNING | blok | (AL3PM0601P1A) PRUNING |
| PREMI RAKING | blok | (AL) WEEDING - CIRCLE RAKING |
| PREMI RITASE | kendaraan | (AL3PT2305P1A) DRIVER ANGKUT MATERIAL |
| PREMI TBS | blok | (AL) HARVESTING LABOUR - HARVESTING |
| PREMI BANTU BRONDOL | blok | (AL) HARVESTING LABOUR |
| PREMI INSENTIF PANEN | blok | (AL) HARVESTING LABOUR |
| PREMI ANGKUT PUPUK | kendaraan | (AL) DRIVER - ANGKUT PUPUK |
| PREMI ANGKUT TBS | kendaraan | (AL) DRIVER - ANGKUT TBS |
| PREMI ANGKUT KARYAWAN | kendaraan | (AL) DRIVER - ANGKUT PUPUK |
| PREMI ANGKUT PC | kendaraan | (AL) DRIVER - ANGKUT PUPUK |
| PREMI ANGKUT BIBIT | kendaraan | (AL) DRIVER - ANGKUT BIBIT |
| PREMI ANGKUT TBK | kendaraan | (AL) DRIVER - ANGKUT BIBIT |
| PREMI PERBAIKAN JALAN | kendaraan | (AL) DRIVER - ANGKUT BIBIT |
| PREMI CUCI MOBIL | kendaraan | (AL) TUNJANGAN TRANSPORT |
| POTONGAN_KOTOR::KOREKSI X | blok | - |
| POTONGAN_BERSIH::POTONGAN BPJS | amount | - |

## 2. Non-Goals (Explicit Scope Boundaries)

- NO new UI/Frontend pages — CLI and API only
- NO modification to existing payroll logic — seeder writes only to adjustment tables
- NO bulk import from external HR systems — manual Excel upload focus only
- NO real-time sync — batch/process-based seeder

## 3. Data Model

### Input: Excel File

**Generic structure** (sheet-based by premium type):

| Col | Field | Type | Notes |
|-----|-------|------|-------|
| A | empcode | string | Employee code — REQUIRED for all |
| B | adjustment_name | string | e.g. "PREMI PRUNING" |
| C+ | type-specific columns | varies | See below |

**Type-specific column mappings:**

```
amount:
  D → jumlah (number)

blok:
  C → subblok
  D → gang_code
  E → jumlah
  (multiple rows per empcode, grouped)

exp:
  C → expense_code
  D → jumlah

kendaraan:
  C → nomor_kendaraan
  D → expense_code
  E → jumlah
  (multiple rows per empcode, grouped)

blok,exp:
  C → subblok (organgang)
  D → gang_code
  E → jumlah (blok component)
  F → expense_code
  G → expense_jumlah
```

### Internal: Metadata JSON (stored in adjustment.metadata_json)

```ts
type PremiMetadata = 
  | { type: 'amount'; jumlah: number }
  | { type: 'blok'; items: Array<{ subblok: string; gang_code: string; jumlah: number }> }
  | { type: 'exp'; expense_code: string; jumlah: number }
  | { type: 'kendaraan'; items: Array<{ nomor_kendaraan: string; expense_code: string; jumlah: number }> }
  | { type: 'blok,exp'; blok_items: Array<{ subblok: string; gang_code: string; jumlah: number }>; expense_code: string; expense_jumlah: number }
```

### Output: Database Writes

- `manual_adjustments` table: adjustment_type, adjustment_name, emp_code, period, ad_code, task_desc, metadata_json, amount
- Aggregated into `daftar_upah_aggregation_history` via existing aggregation pipeline

## 4. State Machine

```
[Excel File] → [ExcelParser: detect format/columns] → [ColumnMapper: map to premium type]
    → [Validator: validate each row] → [Transformer: build metadata JSON]
    → [AdjustmentWriter: upsert to DB] → [Result: summary report]
```

Error states: invalid_empcode, unknown_adjustment_name, invalid_column_mapping, parse_error

## 5. RFC 2119 Constraints

- Parser MUST auto-detect column layout from header row
- Parser MUST validate empcode exists in HR master before writing
- Parser MUST reject unknown adjustment_name not in premium_definitions.json
- Mapper MUST support both header-based and position-based column mapping
- Writer MUST use upsert (insert or update on duplicate period+empcode+adjustment_name)
- Writer MUST group multiple blok/kendaraan rows into single metadata_json per empcode

## 6. Quality Gates

- Each input_type MUST have unit test with sample Excel
- Column mapping MUST be configurable via JSON config (no hardcode)
- Error row report MUST list failed rows with reason + row number
- Summary report MUST show: total_rows, success_count, error_count, total_amount_per_adjustment_name