# Backend Services Overview

> **72 services** di `backend/src/services/` | Updated April 2026

---

## Critical Services

### Payroll Formulas (MODULAR - Apr 2026)
| Service | Path | Purpose |
|---------|------|---------|
| `PayrollCalculator` | `payroll/components/` | Single source of truth |
| `PTKPMapper` | `payroll/formulas/` | PTKP → TER mapping |
| `PayrollFormulas` | `payroll/formulas/` | Pure formula functions |

### Payroll Extractors (NEW - Apr 2026)
| Extractor | Path | Purpose |
|-----------|------|---------|
| `EmployeeExtractor` | `payroll/extractors/` | Employee master data from HR_EMPLOYEE |
| `AttendanceExtractor` | `payroll/extractors/` | Work days (HK), shortage/excess |
| `LeaveExtractor` | `payroll/extractors/` | Cuti (tahunan, sakit, minggu, nasional) |
| `OvertimeExtractor` | `payroll/extractors/` | Lembur OT=1 with task breakdown |
| `PremiumExtractor` | `payroll/extractors/` | Premi from PR_ADTRANS |
| `DeductionExtractor` | `payroll/extractors/` | Potongan from PR_ADTRANS |
| `HarvestExtractor` | `payroll/extractors/` | FFB harvesting data |

### God Classes (In Progress)
| Service | Size | Status |
|---------|------|--------|
| `dataExtractorService` | 149KB | Using extractors (integration pending) |
| `otherIncomesService` | 141KB | Will be split |
| `taxReportService` | 78KB | Pending |
| `historyDatabaseService` | 82KB | Pending |

---

## Service Categories

### Payroll Components
`LemburService`, `PremiService`, `TunjanganService`, `PotonganService`, `Pph21TerService`, `GajiPokokService`

### Payroll Extractors
All extractors use singleton pattern with `getXxxExtractor()` factory:
```typescript
import { getEmployeeExtractor, getAttendanceExtractor } from './payroll/extractors';
const employees = await getEmployeeExtractor().extract(gangCondition, month, year);
const attendance = await getAttendanceExtractor().extract(empCodes, startDate, endDate);
```

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
1. **Integrate extractors into `dataExtractorService`** → Replace inline methods
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
