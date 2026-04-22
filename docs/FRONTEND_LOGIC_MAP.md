# Portal Daftar Upah - Frontend Logic & Tax Map

**Updated:** 2026-04-21

---

## 1. Frontend Architecture Overview

### Key Pages (Routes)
| Page | Route | Purpose |
|------|-------|---------|
| MainPage | `/payroll` | Main Daftar Upah display with AG Grid |
| PayrollAnalysisPage | `/comprehensive` | Payroll analysis with breakdown |
| TaxReportPage | `/tax-report` | PPH21 tax reports |
| AggregationSeederPage | `/admin/aggregation` | Aggregation management |
| SummaryReportPage | `/summary` | Division summary |
| EmployeeDetailPage | `/employee/:nik` | Individual employee detail |
| PayslipPrintPage | `/payslip-print` | Print payslip |

### Core Services
| Service | Purpose |
|---------|---------|
| `payrollService.js` | Fetch payroll data from API |
| `taxReportService.js` | Tax report fetching & export |
| `aggregationSeederService.js` | Aggregation seeding |
| `headerService.js` | Dynamic AG Grid headers |
| `aggregationEngine.js` | Client-side aggregation calculations |
| `historyService.js` | Payroll history management |

---

## 2. Daftar Upah Flow (MainPage)

### Data Fetching
```javascript
// Primary endpoint: /payroll/report
fetchReportRows(token, { month, year, gang_code, division, fields })

// Returns: { data: [...], gangs: [...], grand_total: {...}, meta: {...} }
```

### Key State
```javascript
const [division, setDivision] = useState('')      // Division filter
const [gang, setGang] = useState('')              // Gang filter
const [gangPrefix, setGangPrefix] = useState('1') // Asistensi group
const [month, setMonth] = useState(...)           // From useCurrentPeriod()
const [year, setYear] = useState(...)             // From useCurrentPeriod()
```

### Filter Logic
```javascript
// Division → Gangs mapping (fetchGangs)
// Gang prefix (Asistensi) → Filter gangs by extracted number
const getAsistensi = (gangCode) => {
  if (gangCode.startsWith('K2')) return '1';
  const match = gangCode.match(/\d+/);
  return match ? match[0] : null;
}
```

### Data Flow
```
User selects Division → fetchGangs(division) → populate gang dropdown
User selects Gang → fetchReportRows(gang) → populate grid
User changes Month/Year → useCurrentPeriod() → refresh data
```

---

## 3. AG Grid Headers (Dynamic)

### Header Fetching
```javascript
// fetchDynamicHeaders from headerService.js
fetchDynamicHeaders(token, month, year, gangCode)
// Returns: { columnDefs: [...], fieldMap: {...} }
```

### Caching Strategy
```javascript
// 15-minute cache TTL
// Dev mode: cache disabled
// In-flight request deduplication
const CACHE_TTL = 15 * 60 * 1000
```

### Dynamic Column Structure
```javascript
// Headers are generated from actual data
// Each column has: field, headerName, agg_func
// Example:
// { field: 'gaji_pokok', headerName: 'Gaji Pokok', agg_func: 'sum' }
```

---

## 4. Tax Report (TaxReportPage)

### Tax Report Types

| Tab | Endpoint | Description |
|-----|----------|-------------|
| Pajak Bulanan | `/tax-report/monthly` | Monthly PPH21 report |
| Pajak Tahunan | `/tax-report/annual` | Annual tax with PTKP/PKP |
| ASTEK & BPJS | `/tax-report/astek-bpjs` | Annual benefits |
| Pajak Desember | `/tax-report/december` | December tax adjustment |

### Monthly Tax Flow
```javascript
// fetchMonthlyTaxReport
const result = await fetchMonthlyTaxReport(token, year, month, division, gang, gangPrefix, useHistory)
// Returns: { employees: [...], data_source: '...' }
```

### Tax Data Fields
```javascript
// Per employee in tax report:
{
  emp_name: string,
  pot_pph21: number,        // PPh21 deducted (from Daftar Upah)
  pph21_ter: number,        // Calculated TER tax
  penghasilan_bruto: number, // Gross income for tax
  tarif_pajak_ter: number,   // TER percentage
  selisih: number            // Difference (pph21_ter - pot_pph21)
}
```

### Tax Export
```javascript
// Excel export
downloadMonthlyTaxReportExcel(token, year, month, division, gang, gangPrefix, useHistory)

// JSON export
exportPajakJson(token, year, month, gang, division, gangPrefix, useHistory)
```

---

## 5. Aggregation Seeder (AggregationSeederPage)

### Aggregation Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Check Connection                                         │
│    checkAggregationHealth() → extend_db_ptrj                │
│    checkHistoryHealth() → history database                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Seed Options                                             │
│    - seedAggregation() → daftar_upah_aggregation_history    │
│    - seedTonaseOnly() → FFB weight from db_ptrj_mill       │
│    - seedPayrollHistory() → history_gang_member, etc       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Seeded Data                                              │
│    - Division totals (total_employees, total_hk, etc)       │
│    - Gang-level aggregation                                  │
│    - Payroll history for period                              │
└─────────────────────────────────────────────────────────────┘
```

### Seeding Methods

```javascript
// Main aggregation seed
seedAggregation(token, month, year, division, force)

// Tonase (FFB) only
seedTonaseOnly(token, month, year)

// Payroll history (separate)
seedPayrollHistory(token, month, year, divisionCode, gangCode, force, seederMode)
```

### PTKP Update
```javascript
// Preview PTKP changes
previewPtkpTax(token, periodYear)

// Apply PTKP update
updatePtkpTax(token, periodYear)
```

### Spreadsheet Sync
```javascript
// Sync to Google Sheets
syncSpreadsheet(token, month, year, division, syncType)
// syncType: 'DAFTAR_UPAH' | 'ANALISIS_PAYROLL' | 'SUMMARY_WAGES'
```

---

## 6. Aggregation Engine (Client-Side)

### Purpose
Performs calculations on raw data using backend-provided rules.

### Rule Types

```javascript
// Column aggregations
{ column_id: 'gaji_pokok', aggregation_type: 'sum' }

// Row calculations
{ target_field: 'total_tunjangan', formula: 'beras + jabatan + masa_kerja + lembur' }

// Filter rules
{ field: 'jumlah_hk', operator: 'gt', value: 0 }
```

### Formula Evaluation
```javascript
// Safe evaluation with null coalescing
evaluateFormula("(field1 || 0) + (field2 || 0)", row)
// Supports: +, -, *, /, (), || operator
```

### Filter Operators
```javascript
'gt', 'gte', 'lt', 'lte', 'eq', 'ne', 'in', 'not_in'
```

---

## 7. Payroll Analysis Page (PayrollAnalysisPage)

### KPI Cards
- Total Karyawan
- Total HK
- Total Lembur
- Total Upah Bersih

### Tab Filters
| Tab | Filter Field | Description |
|-----|-------------|-------------|
| SEMUA | `upah_bersih` | All employees |
| LEMBUR | `lembur_jumlah` | OT employees (grouped by task) |
| PREMI | `total_premi` | Premium earners |
| TUNJANGAN | `total_tunjangan` | Allowance earners |
| POTONGAN | `total_potongan_bersih` | Deduction earners |

### Range Filters
```javascript
const [rangeFilters, setRangeFilters] = useState({
  semua: { min: 0, max: null },
  lembur: { min: 0, max: null },
  ...
})
```

### Lembur Display (Grouped by Task)
```
└─ PANEN MANUAL (5x) | 10 jam | Rp 380.000
└─ PUPUK (3x) | 6 jam | Rp 228.000
✓ Total (2 jenis, 8 transaksi) | 16 jam | Rp 608.000
```

---

## 8. Tax Calculation Flow (Backend)

### Monthly Tax Endpoint
```
GET /tax-report/monthly
  ↓
taxReportService.getMonthlyTaxReport(year, month, division, gang, gangPrefix, useHistory)
  ↓
dataExtractorService.extractPayrollData() // Same as Daftar Upah
  ↓
Returns tax-relevant fields
```

### Tax Data Source
- **Same as Daftar Upah** - uses `dataExtractorService`
- **Always uses current DB** - `useHistory=false` for tax reports
- Fields: `pot_pph21`, `pph21_ter`, `penghasilan_bruto`, `tarif_pajak_ter`

### PTKP Mapping (from PTKPMapper.ts)
```
beras_rate → PTKP Status → TER Category → TER Layer → Tax Rate
```

### TER Categories
- **TER A**: TK/0, TK/1, K/0 (PTKP ≤ 58,500,000)
- **TER B**: TK/2, TK/3, K/1, K/2 (PTKP 63-67.5M)
- **TER C**: K/3 (PTKP = 72,000,000)

---

## 9. History Seeder vs Aggregation Seeder

### History Seeder
```javascript
// Seeds: history_gang_member, employee_estate, dll
seedPayrollHistory(token, periodMonth, periodYear, divisionCode, gangCode, force, seederMode)
// Modes: 'PAYROLL', 'PTKP', 'EMPLOYEE_ESTATE'
```

### Aggregation Seeder
```javascript
// Seeds: daftar_upah_aggregation_history (division totals)
seedAggregation(token, month, year, division, force)
```

### Difference
| Aspect | History Seeder | Aggregation Seeder |
|--------|---------------|-------------------|
| Target | Employee-level history | Division totals |
| DB | extend_db_ptrj | extend_db_ptrj |
| Purpose | Audit trail, NIK tracking | Dashboard, summary reports |
| Mode | PAYROLL, PTKP, EMPLOYEE_ESTATE | DAFTAR_UPAH, ANALISIS |

---

## 10. Key Frontend Hooks

### useCurrentPeriod
```javascript
const { month, year, data } = useCurrentPeriod()
// Returns current payroll period from PR_TASKREGLN_ARC latest date
```

### usePayrollStream
```javascript
const stream = usePayrollStream({
    token, division, month, year, gangPrefix, gangCode,
    enabled: !!token && !!division && !!month && !!year
})
// Returns: { gangs, meta, progress, grandTotal, error, isComplete }
```

---

## 11. Key Business Rules

### Employee Filtering (Frontend)
```javascript
// Same as backend logic
const effective_work_hk = hk - (cuti_minggu + cuti_nasional)
const other_cuti = cuti_tahunan + cuti_sakit_haid
if (effective_work_hk <= 0 && other_cuti == 0) {
    // Exclude
}
```

### Currency Formatting
```javascript
formatNumber(val) // Intl.NumberFormat('id-ID')
formatPercent(val) // toFixed(2) + '%'
```

### Period Detection
```javascript
// Historical = past periods
const isHistorical = (year * 100 + month) < (currentYear * 100 + currentMonth)
```

---

## 12. Export Functions

### Payroll Export
```javascript
// CSV/Excel via CustomPayrollTable
exportHandler.export(type) // 'csv' | 'excel'
```

### Tax Export
```javascript
downloadMonthlyTaxReportExcel(...)  // Excel with formulas
exportPajakJson(...)               // JSON for reconciliation
```

### Spreadsheet Sync
```javascript
// Google Sheets via Apps Script
syncSpreadsheet(token, month, year, division, syncType)
```

---

## Service to File Mapping (Frontend)

| Service | File |
|---------|------|
| Payroll Data | `frontend/src/services/payrollService.js` |
| Tax Reports | `frontend/src/services/taxReportService.js` |
| Aggregation | `frontend/src/services/aggregationSeederService.js` |
| Headers | `frontend/src/services/headerService.js` |
| Aggregation Engine | `frontend/src/services/aggregationEngine.js` |
| History | `frontend/src/services/historyService.js` |

## Pages to File Mapping (Frontend)

| Page | File |
|------|------|
| MainPage | `frontend/src/pages/MainPage.jsx` |
| PayrollAnalysisPage | `frontend/src/pages/PayrollAnalysisPage.jsx` |
| TaxReportPage | `frontend/src/pages/TaxReportPage.jsx` |
| AggregationSeederPage | `frontend/src/pages/AggregationSeederPage.jsx` |
| SummaryReportPage | `frontend/src/pages/SummaryReportPage.jsx` |
