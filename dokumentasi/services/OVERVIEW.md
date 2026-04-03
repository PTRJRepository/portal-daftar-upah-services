# Backend Services Overview

> **65 services** di `backend/src/services/` | Updated April 2026

---

## Critical Services

### Payroll Formulas (MODULAR - Apr 2026)
| Service | Path | Purpose |
|---------|------|---------|
| `PayrollCalculator` | `payroll/components/` | Single source of truth |
| `PTKPMapper` | `payroll/formulas/` | PTKP → TER mapping |
| `PayrollFormulas` | `payroll/formulas/` | Pure formula functions |

### God Classes (Pending Split)
| Service | Size | Status |
|---------|------|--------|
| `dataExtractorService` | 149KB | Will be split |
| `otherIncomesService` | 141KB | Will be split |
| `taxReportService` | 78KB | Pending |
| `historyDatabaseService` | 82KB | Pending |

---

## Service Categories

### Payroll Components
`LemburService`, `PremiService`, `TunjanganService`, `PotonganService`, `Pph21TerService`, `GajiPokokService`

### Tax
`taxReportService` (78KB), `taxReportExcelService` (54KB), `ptkpTaxService`, `TaxCalculationService`

### Employee
`employeeDetailService` (31KB), `DuplicateNikMitigationService` (49KB), `employeeRepository`, `employeeEstateService`

### Division
`DivisionConfigService` (SINGLE SOURCE), `divisionDefinition`, `virtualDivisionRegistry`

### Aggregation
`aggregationService`, `historyDatabaseService` (82KB), `historySeederService`, `summaryService`

---

## Pending Refactors

### CRITICAL
1. **Split `dataExtractorService`** → `extractors/` module (6 submodules)
2. **Split `otherIncomesService`** → `otherIncomes/` module (4 submodules)

### HIGH
3. **Consolidate division services** → 3 → 1
4. **Consolidate NIK resolution** → 2 → 1

---

## Patterns

### Singleton
```typescript
class MyService {
    private static instance: MyService;
    static getInstance() { ... }
}
export const myService = MyService.getInstance();
```
