# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Daftar Upah (Payroll) Reporting System** for PT Rebinmas - a full-stack application that processes employee payroll data from MSSQL databases and displays it through AG Grid. The backend uses **Bun + Elysia** with a **SQL Gateway** pattern for database access.

## Architecture

```
refactor_production/
├── backend/                      # Bun + Elysia backend
│   └── src/
│       ├── api/                  # Route handlers (payroll, summary, auth, etc.)
│       ├── services/             # Business logic (singleton pattern)
│       ├── db/                   # SQL Gateway client (not direct DB connection)
│       ├── config.ts             # Environment configuration
│       └── scripts/              # Core test/verification scripts ONLY
├── frontend/                     # React + Vite + AG Grid Enterprise
│   └── src/
│       ├── pages/                # Page components (.jsx files)
│       ├── services/             # API client with Axios
│       ├── components/           # Reusable components (AgGridWrapper, etc.)
│       ├── context/              # React contexts (Auth, Header, GangFilter)
│       ├── hooks/                # Custom React hooks
│       └── utils/                # Utility functions
├── backend/data/                 # Data files (thumbprint_data.json)
├── _dev_utils/                  # Development utilities (NOT part of production)
│   ├── scripts/debugging/        # Debug/test scripts (run as needed)
│   ├── tests/                    # Integration tests
│   ├── planning/                 # Feature planning documents
│   └── prompts/                  # AI prompts and notes
└── dokumentasi/                  # Indonesian documentation
```

### SQL Gateway Pattern

The backend does NOT connect directly to MSSQL. Instead, it queries a **Python SQL Gateway API** that handles database connections:

```
Backend (Bun) → SQL Gateway API (Python) → MSSQL (db_ptrj, extend_db_ptrj, VenusHR14)
```

**Gateway Endpoint:** `POST {DB_API_URL}/v1/query` with body `{ sql, params, server, database }`

**Why this matters:** All queries must use the format expected by the gateway, with proper parameter conversion.

## Development Commands

### Backend (Bun)
```bash
cd backend
bun run dev          # Start dev server with hot-reload (port 8002)
bun run start        # Start production server
bun run test         # Run tests
```

### Frontend (Vite)
```bash
cd frontend
npm run dev          # Start dev server (port 5173)
npm run dev:network  # Expose on network (0.0.0.0:5175)
npm run dev:proxy    # Enable proxy mode with /backend/upah prefix
npm run dev:lan      # LAN mode with custom backend host
npm run build        # Build for production
npm run test         # Run vitest tests
```

### Fixing Frontend Issues
If you encounter "Outdated Optimize Dep" error:
```bash
cd frontend
rm -rf node_modules/.vite
npm install
# Then restart dev server
```

### Additional Frontend Dev Commands
```bash
npm run dev:test              # Test mode with VITE_DEV_MODE=true
npm run dev:5175              # Run on port 5175
npm run dev:custom-backend    # Network mode with custom backend
npm run dev:external          # External backend mode
npm run dev:lan               # LAN mode with backend at 10.0.0.128
npm run preview               # Preview production build
```

### Development Scripts Organization

#### Core Test Scripts (Keep in `backend/src/scripts/`)
These are essential verification scripts that should remain in the codebase:
```bash
cd backend
bun run src/scripts/test_division_mapping.ts  # Test unified division mapping
bun run src/scripts/test_thr_summary.ts        # Test THR summary report
bun run src/scripts/check_thr_data.ts          # Check THR saved data
```

#### Debugging/Development Scripts (Use `_dev_utils/`)
All exploratory, debugging, and one-off test scripts MUST be placed in `_dev_utils/`:

```
_dev_utils/
├── scripts/
│   └── debugging/          # All debugging/test scripts go here
│       ├── test_api_*.ts
│       ├── check_*.ts
│       └── debug_*.ts
├── tests/
│   └── *.ts              # Integration tests
├── planning/              # Feature planning documents
└── prompts/               # AI prompts and notes
```

**Rules:**
1. DO NOT add debugging scripts to `backend/src/scripts/` - use `_dev_utils/scripts/debugging/` instead
2. DO NOT add debugging scripts to `backend/scripts/` - this folder should not exist
3. Only keep essential verification scripts in `backend/src/scripts/`
4. All temporary/test scripts for investigation go in `_dev_utils/`

#### Running Core Scripts
```bash
# Test division mapping
cd backend && bun run src/scripts/test_division_mapping.ts

# Test THR summary
cd backend && bun run src/scripts/test_thr_summary.ts

# Check THR data
cd backend && bun run src/scripts/check_thr_data.ts
```

## Database Connection Rules (CRITICAL)

### Database Profiles

| Profile | Database | Usage |
|---------|----------|-------|
| `SERVER_PROFILE_1` | `extend_db_ptrj` | Aggregation history, analysis reports |
| `SERVER_PROFILE_2` | `db_ptrj` | Main payroll data (production) |
| `SERVER_PROFILE_3` | `VenusHR14` | Employee master, FFB weight (`db_ptrj_mill`) |

### Connection Methods

```typescript
// Default payroll database (db_ptrj with SERVER_PROFILE_2 in prod, SERVER_PROFILE_1 in dev)
const db = Database.getInstance();

// Extended database (extend_db_ptrj with SERVER_PROFILE_1)
const db = Database.getExtendedInstance();

// VenusHR14 for employee/mill data (VenusHR14 with SERVER_PROFILE_3)
const db = Database.getVenusInstance();

// Mill database for WM_TICKET (db_ptrj_mill with SERVER_PROFILE_3)
const db = Database.getMillInstance();
```

**Note:** `RUN_MODE=prod` automatically uses `SERVER_PROFILE_2` for main database; `RUN_MODE=dev` uses `SERVER_PROFILE_1`.

### SQL Query Rules

**ALWAYS use `?` placeholders with array params:**

```typescript
// CORRECT - Auto-converts to @p0, @p1
const result = await db.query(`
    SELECT * FROM table WHERE col1 = ? AND col2 = ?
`, [value1, value2]);

// WRONG - Don't use named params directly
const result = await db.query(`
    SELECT * FROM table WHERE col1 = @p0 AND col2 = @p1
`, [value1, value2]);
```

The `prepareParams()` function auto-converts `?` → `@p0`, `@p1`, etc.

### Database Client Features

- **Auto-retry**: Failed queries retry up to `DB_QUERY_RETRIES` (default: 3) times
- **Transaction support**: `db.transaction([{ sql, params }, ...])` for batch operations
- **Query helpers**: `queryOne<T>()`, `count()` for common patterns
- **Instance caching**: Multiple database profiles cached in singleton Map

## API Routing Structure

### Route Prefixes

The system supports dual routing:
- **Direct**: `/payroll/*`, `/summary/*`, `/auth/*`
- **Proxy**: `/backend/upah/payroll/*` (stripped by middleware when `USE_PROXY=true`)

### Key Endpoints

| Endpoint | Description | Database |
|----------|-------------|----------|
| `POST /auth/login` | Authentication | - |
| `GET /payroll/divisions` | List all divisions | VenusHR14 |
| `GET /payroll/gangs` | Get gangs by division | VenusHR14 |
| `GET /payroll/headers` | Dynamic AG Grid headers | db_ptrj |
| `GET /payroll/report` | Gang payroll data | db_ptrj (SERVER_PROFILE_2) |
| `GET /payroll/report/division-raw-tree` | Division tree with totals | db_ptrj (SERVER_PROFILE_2) |
| `GET /payroll/locked/report/raw-tree` | Locked data (relaxed auth) | db_ptrj (SERVER_PROFILE_2) |
| `GET /summary/division` | Division summary | extend_db_ptrj |
| `GET /summary/analysis-report` | Analysis report | extend_db_ptrj |
| `POST /api/aggregation/seed` | Trigger aggregation seeding | extend_db_ptrj |
| `GET /api/aggregation/status` | Get aggregation status | extend_db_ptrj |
| `GET /api/aggregation/history` | Get aggregation history | extend_db_ptrj |

### Authentication & Permissions

- **JWT token-based** with `Bearer` header
- **Role system**: `ADMIN` vs regular users
- **Division-based access**: Users have allowed divisions in their token
- **Locked endpoints**: Relaxed permissions for compatibility with Python backend

## Service Layer Architecture

### Singleton Pattern

All services use singleton pattern:

```typescript
// services/dataExtractorService.ts
export class DataExtractorService {
    private static instance: DataExtractorService;
    private constructor() { /* ... */ }
    public static getInstance(): DataExtractorService {
        if (!DataExtractorService.instance) {
            DataExtractorService.instance = new DataExtractorService();
        }
        return DataExtractorService.instance;
    }
}

export const dataExtractorService = DataExtractorService.getInstance();
```

### Key Services

| Service | Responsibility |
|---------|---------------|
| `divisionConfigService` | **Single Source of Truth** for all division definitions |
| `gangService` | Fetch gangs/divisions, uses divisionConfigService |
| `dataExtractorService` | Extract payroll data from PR_TASKREGLN, PR_ADTRANS, etc. |
| `payrollService` | Calculate salary, BPJS, deductions |
| `summaryService` | Aggregate division/summary data |
| `aggregationService` | Seed aggregation history |
| `headerService` | Generate dynamic AG Grid headers |
| `authService` | JWT token verification |
| `lemburCalculator` | Calculate overtime (lembur) amounts with tier-based rates |
| `pph21TerService` | Calculate PPH21 tax using TER method |
| `employeeDetailService` | Fetch employee detail information with daily overtime |
| `employeeEstateService` | Manage job title/estate data |
| `tunjanganService` | Handle allowance calculations |
| `thumbprintService` | Manage thumbprint data storage/retrieval |
| `cacheService` | Cache management (disabled in dev unless override) |
| `currentPeriodService` | Get current payroll period |
| `deductionAdjustmentService` | Handle deduction adjustments |
| `luasAreaService` | Calculate area-based values |
| `divisionDefinition` | Define division hierarchies (uses divisionConfigService) |
| `employeeRepository` | Employee data repository pattern |

## New OOP Services (Mar 2026)

The following services follow the OOP singleton pattern and provide centralized business logic:

### TaxCalculationService
**Location:** `backend/src/services/tax/TaxCalculationService.ts`

Centralized tax calculations (PTKP & PPh21 TER):

```typescript
import { taxCalculationService } from './services/tax/TaxCalculationService';

// Map beras rate to PTKP status
const ptkpStatus = taxCalculationService.mapBerasRateToPTKP(4650); // → 'K/1'

// Map PTKP to TER category
const terCategory = taxCalculationService.mapPTKPToTER('K/3'); // → 'TER C'

// Get PTKP amount
const amount = taxCalculationService.getPTKPAmount('K/1', 2025); // → 63000000

// Full tax calculation
const result = taxCalculationService.calculate({
    empCode: 'EMP001',
    berasRate: 4650,
    grossIncome: 5000000,
    periodYear: 2025
});
```

### EmployeeResolutionService
**Location:** `backend/src/services/employee/EmployeeResolutionService.ts`

Employee identity resolution:

```typescript
import { employeeResolutionService } from './services/employee/EmployeeResolutionService';

// Single resolution
const result = await employeeResolutionService.resolve({
    nik: '1234567890',
    preferredGangCode: 'G1H'
});

// Batch resolution
const map = await employeeResolutionService.resolveBatch(
    ['NIK1', 'NIK2', 'NIK3'],
    preferredGangsMap
);

// Check if employee exists
const exists = await employeeResolutionService.employeeExists('EMP001');
```

### CarumanService
**Location:** `backend/src/services/payroll/CarumanService.ts`

BPJS/Caruman calculations:

```typescript
import { carumanService } from './services/payroll/CarumanService';

// Calculate all caruman components
const result = carumanService.calculateAllCaruman(upahDasar, masaKerjaJumlah);
// Returns: { base, gajiStandar, astek_*, bpjs_*, totals }

// Get only PPh21-relevant components
const pph21Components = carumanService.getForPph21(upahDasar, masaKerjaJumlah);
```

### CutiService
**Location:** `backend/src/services/employee/CutiService.ts`

Employee leave (cuti) management:

```typescript
import { cutiService } from './services/employee/CutiService';

// Calculate working days after leave
const result = cutiService.calculateWorkingDays({
    totalHk: 25,
    cutiTahunan: 0,
    cutiSakit: 2,
    cutiMinggu: 0,
    cutiNasional: 0
});

// Check if should be excluded from payroll (CRITICAL FILTER LOGIC)
const shouldExclude = cutiService.shouldExcludeFromPayroll(empCutiData);

// Get leave data for period
const cuti = await cutiService.getCutiData('EMP001', 2, 2026);
```

### PayrollNormalizationService
**Location:** `backend/src/services/payroll/PayrollNormalizationService.ts`

Normalize payroll component names:

```typescript
import { payrollNormalizationService } from './services/payroll/PayrollNormalizationService';

// Normalize premi
const premi = payrollNormalizationService.normalizePremi('PREMI PANEN AL');
// → { normalizedKey: 'premi_panen_al', category: 'PREMI_PANEN' }

// Normalize potongan
const pot = payrollNormalizationService.normalizePotongan('PPH21', 'PPh 21', 'TAX001');
// → { normalizedKey: 'potongan_pph21', category: 'PPH21' }

// Check exclusions
const isExcluded = payrollNormalizationService.isExcludedFromPremi('PPH21');
```

### PayrollComponentRegistry
**Location:** `backend/src/services/payroll/`

Orchestrates all payroll component calculations:

```typescript
import { payrollComponentRegistry } from './services/payroll';

// Get registry status
const status = payrollComponentRegistry.getHealthStatus();
// → { registered_count: 6, components: ['lembur', 'premi', 'tunjangan', ...] }

// Calculate all components for single employee
const results = await payrollComponentRegistry.calculateAll(input);

// Calculate for batch employees
const batchResults = await payrollComponentRegistry.calculateAllBatch(inputs);
```

Registered components: `lembur`, `premi`, `tunjangan`, `potongan`, `pph21_ter`, `gaji_pokok`

## DivisionConfigService - Single Source of Truth

### Overview

`DivisionConfigService` (`backend/src/services/config/DivisionConfigService.ts`) is the **single source of truth** for all division-related logic. All services should use this service instead of duplicating mapping logic.

### Supported Divisions

**Real Divisions:**
| Code | Name | Aliases |
|------|------|---------|
| PG1A | Plasma 1 Afdeling | P1A, PG1A |
| PG1B | Plasma 1 Blok | P1B, PG1B |
| PG2A | Plasma 2 Afdeling | P2A, PG2A |
| PG2B | Plasma 2 Blok | P2B, PG2B |
| AB1 | Afdeling 1 | AB1, ARB1 |
| AB2 | Afdeling 2 | AB2, ARB2 |
| ARA | Area | ARA |
| ARC | Air Ruak Central | ARC, AREC |
| DME | Dempo | DME |
| IJL | Ijuk | IJL, L |

**Virtual Divisions:**
| Code | Name | Source | Gang Pattern |
|------|------|--------|--------------|
| INF | Infrastruktur | PG1A | /^IN\d*$/i |
| NRS | Nursery | PG1B | /^B2N$/i |
| WKS_AR | Workshop Air Ruak | AB2 | /^HMC$/i |
| WKS_PG | Workshop Parit Gunung | PG1A | /^AMC$/i |
| WORKSHOP | Workshop All | - | /^(HMC|AMC)$/i |
| MILL | Palm Oil Mill | - | /^M\d*$/i |

### Usage

```typescript
import { divisionConfigService } from './services/config/DivisionConfigService';

// Resolve alias to canonical
const canonical = divisionConfigService.resolveCode('HMC');  // → 'WKS_AR'
const canonical = divisionConfigService.resolveCode('ARB1');  // → 'AB1'

// Check if virtual
const isVirtual = divisionConfigService.isVirtualDivision('INF');  // → true

// Get all aliases
const aliases = divisionConfigService.getAliases('AB1');  // → ['AB1', 'AB-1', 'ARB1', ...]

// Build SQL WHERE clause
const { sql, params } = divisionConfigService.buildDivisionWhereClause('AB1', 'division_code');
// sql: ' AND division_code IN (?,?,?,?)', params: ['AB1', 'AB-1', ...]

// Get gangs for division (handles virtual)
const gangs = await divisionConfigService.getGangsForDivision('WKS_AR');
```

### gangService Integration

`gangService` delegates to `divisionConfigService`:

```typescript
// These are equivalent:
gangService.normalizeDivisionCode('HMC')
divisionConfigService.resolveCode('HMC')

// Both return 'WKS_AR'
```

### Documentation

See `dokumentasi/DivisionConfigService.md` for full documentation.

## Data Flow Example: Payroll Report

```
1. Frontend: GET /payroll/report?gang_code=H1H&month=12&year=2025
2. Route handler: dataExtractorService.extractPayrollData(month, year, gangCode)
3. Service:
   - getEmployees() from HR_EMPLOYEE, HR_GANGLN, HR_PAYROLL
   - getAttendance() from PR_TASKREGLN (ARC tables for archived data)
   - getCuti() for leave types (tahunan, sakit_haid, minggu, nasional)
   - getPremi() from PR_ADTRANS (DocDesc contains 'PREMI')
   - getPotongan() from PR_ADTRANS (DocDesc contains 'PPH', 'POT', etc.)
   - getLemburDetailsFromCalculator() for overtime totals
   - getLemburDetailsWithTaskBreakdown() for overtime detail records
4. Calculate: gaji_pokok, tunjangan, premi, potongan, upah_bersih
5. Filter: Exclude employees where effective_work_hk <= 0 AND other_cuti == 0
6. Return: PayrollRow[] with dynamic premi/potongan fields + lembur_records
```

## Lembur (Overtime) Calculation

### Overview

Lembur calculation uses **`lemburCalculator`** service with tier-based rate system:
- **Source:** `PR_TASKREGLN` where `OT = 1` (pure overtime transactions only)
- **UPJ Calculation:** `(pay_rate * 30) / 173` or fallback to `LEMBUR_UPJ` env var (default: 17257)
- **Consistency:** Detail Page and Daftar Upah use the same calculation logic

### Day Type Classification

| Day Type | Description | Tier 1 Rate | Tier 2 Rate | Tier 3 Rate | Tier 1 Boundary |
|----------|-------------|-------------|-------------|-------------|-----------------|
| `WORKDAY_LONG` | Mon-Thu, Sat | 1.5x | 2x | - | 1 hour |
| `WORKDAY_SHORT` | Friday | 1.5x | 2x | - | 1 hour |
| `SUNDAY` | Sunday | 2x | 3x | 4x | 5/7 hours* |
| `HOLIDAY_REGULAR` | Non-religious holiday | 2x | 3x | 4x | 5/7 hours* |
| `HOLIDAY_RELIGIOUS` | Religious holiday | 3x | 4x | 4x | 5/7 hours* |

*Tier boundary depends on whether it's a short day (Friday) or long day (other days)

### Overtime Breakdown Structure

```typescript
interface OvertimeBreakdown {
    tier_1_rate: number;      // Rate for first tier
    tier_1_hours: number;     // Hours in tier 1
    tier_1_amount: number;    // Amount for tier 1
    tier_1_boundary: number;  // Hours before tier 2 starts
    tier_2_rate: number;      // Rate for second tier
    tier_2_hours: number;     // Hours in tier 2
    tier_2_amount: number;    // Amount for tier 2
    tier_3_rate: number;      // Rate for third tier
    tier_3_hours: number;     // Hours in tier 3
    tier_3_amount: number;    // Amount for tier 3
    total_amount: number;     // Sum of all tiers
}
```

### Lembur Records Structure

```typescript
interface LemburRecord {
    trx_date: string;      // Transaction date (YYYY-MM-DD)
    task_code: string;     // Task code from PR_TASKCODE
    task_desc: string;     // Task description from PR_TASKCODE
    day_type: string;      // "Hari Kerja", "Jumat", "Minggu", "Libur Umum", "Libur Keagamaan"
    hours: number;         // Overtime hours for this transaction
    rate: number;          // Total rate (weighted average of tiers)
    amount: number;        // Calculated amount (hours × UPJ × tier rates)
}
```

### Service Methods

| Method | Purpose | Returns |
|--------|---------|---------|
| `calculate(empCode, month, year, upj?)` | Single employee overtime with full breakdown | `LemburResult` with records[] |
| `calculateBatchData(empCodes, month, year)` | Multiple employees - totals only | `{ total_hours, total_payment }` |
| `calculateBatchDataWithTaskBreakdown(empCodes, month, year)` | Multiple employees with detail records | `{ total_hours, total_payment, task_breakdown[], records[] }` |

### UPJ Value Initialization

**CRITICAL:** UPJ must be initialized from environment variable, not 0:

```typescript
private upjValue: number;

private constructor() {
    this.db = Database.getInstance();
    // UPJ default value from environment or fallback to 17257
    this.upjValue = parseFloat(process.env.LEMBUR_UPJ || "17257");
}
```

### Data Source

**Pure Overtime (OT=1) only:**
```sql
-- Active Table
SELECT l.EmpCode, l.TrxDate, l.Hours, l.TaskCode, l.Amount, l.Rate
FROM PR_TASKREGLN l
JOIN PR_TASKREG m ON l.MasterID = m.ID
WHERE l.EmpCode = ? AND l.TrxDate >= ? AND l.TrxDate <= ? AND l.OT = 1

UNION ALL

-- Archive Table
SELECT l.EmpCode, l.TrxDate, l.Hours, l.TaskCode, l.Amount, l.Rate
FROM PR_TASKREGLN_ARC l
JOIN PR_TASKREG_ARC m ON l.MasterID = m.ID
WHERE l.EmpCode = ? AND l.TrxDate >= ? AND l.TrxDate <= ? AND l.OT = 1
```

### Display in Frontend

**Employee Detail Page (`/employee/:nik`):**
- Shows daily overtime matrix (calendar view)
- Lists **individual transactions** with date, day name, day type, hours, rate, amount
- Groups transactions by day
- Each transaction shown separately (e.g., same day with different task_desc = 2 rows)

**Laporan Analisis Payroll (`/comprehensive`):**
- Shows **grouped-by-task** breakdown when Lembur tab is active
- Groups multiple transactions by task_desc
- Format: `└─ PANEN MANUAL (5x) | 10 jam | Rp 380.000`
- Summary row validates: Total Detail = Total Lembur

### Important Notes

1. **Total Lembur = Sum of Detail Records** - No double counting
2. **Lembur displayed excludes DocDesc 'LEMBUR'** - Only OT=1 transactions from PR_TASKREGLN
3. **Multiple transactions per day**:
   - Employee Detail Page: All displayed individually
   - Laporan Analisis Payroll: Grouped by task_desc with count
4. **Consistent calculation** - All pages use same `lemburCalculator`



## Filter Rules

### Employee Filtering (CRITICAL - See Business Rules below)

**IMPORTANT:** The employee filtering logic is a critical business rule. See "Employee Filtering Rules" in the Important Business Rules section for the complete specification.

### HK > 0 Filtering

For totals calculation, only employees with `jumlah_hk > 0` are included.

## Unimplemented Features

The following fields are currently **NULL** - not yet implemented:

| Field | Source | Notes |
|-------|--------|-------|
| `total_ffb_weight` | WM_TICKET (db_ptrj_mill) | Need getMillInstance() |
| `premi_prunning` | Dynamic Premi | Not populated |
| `premi_insentif` | Dynamic Premi (Insentif Panen) | Not populated |
| `premi_kinerja` | Dynamic Premi (Kinerja) | Not populated |
| `total_koreksi` | Correction Table | Not populated |

## Important Business Rules

### Data Append-Only Pattern (Immutable History)

**CRITICAL:** Sistem TIDAK menimpa atau mengedit data existing. Selalu tambahkan record baru. Data lama tetap tersimpan untuk history tracking karyawan.

#### Rules:

1. **NIK tidak bisa di-update** - Jika NIK sudah ada di database, **JANGAN update** meskipun nilainya berubah di Plantware/db_ptrj. Gunakan data yang sudah ada.
2. **Jika NIK belum ada** → baru ambil/insert dari db_ptrj.
3. **Di aggregation/history** - Kecuali untuk NIK, hindari UPDATE. Selalu INSERT record baru.
4. **Mengambil data terbaru** - Gunakan `version_index` atau `ORDER BY ... DESC LIMIT 1` untuk mendapatkan record terkini.

#### Contoh Kode:

```typescript
// ❌ SALAH - Jangan update jika NIK/empcode sudah ada
if (existingEmployee) {
    await db.query(`UPDATE table SET nik = ? WHERE emp_code = ?`, [nik, empCode]);
}

// ✅ BENAR - Cek existing dulu, jika belum ada baru insert
const existing = await db.queryOne(`SELECT * FROM table WHERE nik = ?`, [nik]);
if (!existing) {
    await db.query(`INSERT INTO table (...) VALUES (...)`, [...]);
}
// Jika existing ada → skip, jangan update

// ✅ BENAR - Untuk aggregation, append-only dengan version_index
await db.query(`
    INSERT INTO aggregation_history (month, year, nik, ..., version_index)
    SELECT ?, ?, ?, ..., ISNULL(MAX(version_index), 0) + 1
    FROM aggregation_history
    WHERE nik = ?
`, [month, year, nik, ..., nik]);
```

#### Files yang Perlu Diperhatikan:

| File | Method | Pattern |
|------|--------|---------|
| `historyDatabaseService.ts` | `savePayrollHistoryDetail()` | UPDATE-or-INSERT (perlu改为 append-only) |
| `historyDatabaseService.ts` | `savePayrollHistoryHeader()` | UPDATE-or-INSERT |
| `employeeHrDataService.ts` | `updateField()` | UPSERT with history tracking |
| `employeeEstateService.ts` | `upsert()` | UPSERT by empcode |

#### Kenapa Penting:

- Tracking history lengkap seorang karyawan dari waktu ke waktu
- Audit trail untuk semua perubahan data
- Data lama tidak hilang (untuk keperluan referensi/histori)
- Konsistensi data antar periode payroll
- NIK adalah identifier utama yang TIDAK boleh berubah

### PTKP Status Mapping (Tax Classification)

PTKP (Penghasilan Tidak Kena Pajak) status is derived from `beras_rate` (RiceRation) in HR_PAYROLL:

| beras_rate | PTKP Status | TER Category |
|------------|-------------|--------------|
| 2250 | TK/0 | TER A |
| 3250 | TK/1 | TER A |
| 4200 | TK/2 | TER B |
| 3750 | K/0 | TER A |
| 4650 | K/1 | TER B |
| 5550 | K/2 | TER B |
| 6450 | K/3 | TER C |

**TER Categories:**
- **TER A**: TK/0, TK/1, K/0 (5% rate)
- **TER B**: TK/2, K/1, K/2 (15% rate)
- **TER C**: K/3 (25% rate)

### Premium (Premi) Filtering Rules

For dynamic premium header generation, items are **excluded** if DocDesc contains:
- `PPH`, `PPH21`, `PPH 21`
- `LEMBUR` (overtime)
- `PRUN`, `PRUNING` (aggregated to static `premi_pruning` column)
- `KOREKSI`, `KOREKSI PANEN`, `POTONGAN KOREKSI`
- `SPSI`
- `TUNJANGAN JABATAN`, `TUNJANGAN MASA KERJA`
- `TUNJANGAN BERAS`
- `BRONDOL` (aggregated to static `premi_brondol` column)

**Static Premium Columns:**
- `premi_brondol`: Aggregates all BRONDOL-related items
- `premi_pruning`: Aggregates all PRUN-related items (PRUNING, TUNJANGAN PRUNING, etc.)

### Deduction (Potongan) Filtering Rules

For dynamic deduction header generation, items are **excluded** if DocDesc contains:
- Patterns starting with `POT%`
- `SPSI`
- `BERAS`
- `JABATAN`
- `MASA`
- `LEMBUR`
- `PPH%` (broader than just PPH21)

### Employee Filtering Rules

**CRITICAL:** The correct filter logic (as per MEMORY.md and fix from Feb 2025):

```typescript
// Effective Work HK = HK - (Minggu + Libur Nasional)
const effective_work_hk = hk - (empCuti.cuti_minggu + empCuti.cuti_nasional);

// Cuti lain (tahunan, sakit/haid)
const other_cuti = empCuti.cuti_tahunan + empCuti.cuti_sakit_haid;

// FILTER LOGIC:
// - effective_work_hk <= 0 AND other_cuti == 0 → FILTERED OUT
// - effective_work_hk <= 0 BUT other_cuti > 0 → KEPT
// - effective_work_hk > 0 → Always KEPT
if (effective_work_hk <= 0 && other_cuti == 0) continue;
```

**Rules:**
1. Only HK Minggu/Libur Nasional (0 work days) → **Not displayed**
2. 0 HK but HAS other leave (tahunan, sakit/haid) → **MUST be displayed**
3. HK work > 0 → **Always displayed**

**WRONG - Do NOT use:**
```typescript
// JANGAN gunakan filter tambahan ini!
if (hari_kerja <= 0) continue;
```

Applied in: `dataExtractorService.ts` line ~301-317

For totals calculation, only employees with `jumlah_hk > 0` are included.

## Configuration

### Environment Variables

```bash
# Server
PORT=8002
RUN_MODE=dev|prod
HOST=0.0.0.0

# Proxy
USE_PROXY=false
PROXY_STRIP_PREFIX=/backend/upah
AUTH_MODE=internal|external

# SQL Gateway
DB_API_URL=http://localhost:8001
DB_API_KEY=
DB_PROFILE=SERVER_PROFILE_2
DB_DATABASE=db_ptrj
DB_CONN_TIMEOUT=60
DB_QUERY_TIMEOUT=30
DB_QUERY_RETRIES=3

# Extended Database (Aggregation)
DB_EXTEND_DATABASE=extend_db_ptrj
DB_EXTEND_PROFILE=SERVER_PROFILE_1

# VenusHR14 (Employee/Mill)
DB_VENUS_DATABASE=VenusHR14
DB_VENUS_PROFILE=SERVER_PROFILE_3

# Mill Database (FFB Weight)
DB_MILL_DATABASE=db_ptrj_mill
DB_MILL_PROFILE=SERVER_PROFILE_3

# Auth
JWT_SECRET=...
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Constants
CONSTANTS_UPAH_MINIMUM_DASAR=3876600
CONSTANTS_POTONGAN_BPJS_GAJI_POKOK_MIN=3876600
CONSTANTS_POTONGAN_BPJS_IURAN_SPSI=4000

# Lembur (Overtime)
LEMBUR_UPJ=17257  # Default UPJ value used when pay_rate is not available

# Test Mode
TEST_MODE=false
DEFAULT_GANG=H1H
DEFAULT_MONTH=12
DEFAULT_YEAR=2025
```

### Mode-Specific Behavior

- **RUN_MODE=prod**: Uses `SERVER_PROFILE_2` for payroll
- **RUN_MODE=dev**: Uses `SERVER_PROFILE_1` for development
- **USE_PROXY=true**: Strips `/backend/upah` prefix, sets `AUTH_MODE=external`
- **TEST_MODE=true**: Enables test mode with default values for gang/month/year
- **Cache**: Disabled in dev mode unless `ENABLE_PRODUCTION_CACHE=true`
- **DISABLE_CACHE=true**: Force disable cache globally

### Thumbprint Data

The system stores thumbprint data in `backend/data/thumbprint_data.json`. This file contains division-specific thumbprint values indexed by period (YYYY-MM format). The `ThumbprintService` handles reading/writing this data.

## Frontend: AG Grid Integration

### Dynamic Headers

Headers are generated server-side based on actual data:

```typescript
// Frontend fetches headers first
const response = await fetch(`/payroll/headers?month=12&year=2025&gang_code=H1H`);
const { columnDefs } = await response.json();

// Then passes to AG Grid
<AgGridReact columnDefs={columnDefs} rowData={rowData} />
```

### Column Structure

Columns are organized into groups:
- **Informasi Karyawan**: nik, nama, jabatan, lokasi
- **Absensi**: jumlah_hk, hari_kerja, kehadiran
- **Gaji Pokok**: gaji_pokok, gaji_pokok_ideal, gaji_pokok_aktual
- **Tunjangan**: beras_jumlah, jabatan_jumlah, masa_kerja_jumlah, **lembur_jumlah**
- **Lembur Details**: **lembur_records[]** (individual transactions with trx_date, task_desc, day_type, hours, rate, amount)
- **Premi**: premi_brondol + dynamic premi fields
- **Potongan Upah Kotor**: koreksi fields
- **Potongan Upah Bersih**: astek, bpjs, spsi, pph21 + dynamic potongan
- **Total**: jumlah_upah_kotor, upah_bersih

## Backend: Summary Report Data Sources

The Summary Report uses **aggregation tables** from `extend_db_ptrj`:

```sql
-- Main table
SELECT * FROM daftar_upah_aggregation_history
WHERE month = ? AND year = ? AND division_code = ?
```

**Always use `SERVER_PROFILE_1` for summary/analysis queries.**

## Recent Fixes & Improvements

### Lembur Calculation Fixes (Feb 2025)

**Issue:** Overtime calculations were inconsistent between Detail Page and Daftar Upah, with incorrect amounts displayed.

**Root Causes:**
1. `upjValue` was initialized to 0 instead of from environment variable
2. Batch methods used `payRate || 0` causing UPJ = 0 when payRate not found
3. Frontend grouped records by task_desc instead of showing individual transactions

**Solutions Applied:**

1. **Backend (`lemburCalculator.ts`):**
   ```typescript
   // Fixed UPJ initialization
   private upjValue: number;
   private constructor() {
       this.upjValue = parseFloat(process.env.LEMBUR_UPJ || "17257");
   }

   // Fixed UPJ calculation in batch methods
   const payRate = payRates[empKey] || 0;
   const upj = payRate > 0 ? (payRate * 30) / 173 : this.upjValue;
   ```

2. **Backend (`dataExtractorService.ts`):**
   ```typescript
   // Use pure overtime (OT=1) values for display
   const empLemburJumlahPure = empLemburDetails.jumlah || empLembur.jumlah;
   const empLemburJamPure = empLemburDetails.jam || empLembur.jam;

   lembur_jam: empLemburJamPure,
   lembur_jumlah: empLemburJumlahPure,
   lembur_records: (empLemburDetails.records || []).map((r) => ({
       ...r,
       trx_date: r.date || r.trx_date || "",
   })),
   ```

3. **Frontend (`ComprehensivePerformancePage.jsx`):**
   - Changed from grouped-by-task display to individual transaction records
   - Format: `└─ DD/MM/YYYY (Hari Kerja) | PANEN MANUAL | X jam | Rp XXX`
   - Added summary row validating: Total Detail = Total Lembur

**Result:**
- ✅ Detail Page = Daftar Upah calculations
- ✅ Total Lembur = Sum of all individual detail records
- ✅ Multiple transactions per day displayed individually
- ✅ Pure overtime (OT=1) only, excluding DocDesc 'LEMBUR' from PR_ADTRANS

### Page Rename & Gang Filter Fix (Feb 2026)

**Changes:**
1. **Page Rename:** `ComprehensivePerformancePage` → `PayrollAnalysisPage`
   - New display name: "Laporan Analisis Payroll"
   - Route remains `/comprehensive` for backward compatibility
   - File renamed to `PayrollAnalysisPage.jsx`

2. **Gang Filter Fix:**
   - **Issue:** Gang filter was not working - changing gang selection didn't filter displayed data
   - **Root Cause:** Data flattening logic included ALL employees from ALL gangs regardless of selected gang
   - **Solution:** Added gang filtering when flattening API response:
     ```typescript
     // BEFORE (Wrong):
     result.gangs.forEach(gangData => {
       allEmployees = allEmployees.concat(gangData.employees);  // All employees!
     });

     // AFTER (Correct):
     result.gangs.forEach(gangData => {
       const shouldInclude = !gang || gang === 'ALL' || gangData.gang_code === gang;
       if (shouldInclude && gangData.employees) {
         allEmployees = allEmployees.concat(gangData.employees);
       }
     });
     ```

**Result:**
- ✅ Gang filter now properly filters displayed data
- ✅ Division filter triggers gang list refresh
- ✅ useEffect dependencies include gang for auto-refresh

## Git Commit References

Important commits for reference:
- **f620897** - Commit that successfully stored 693 juta (correct employee filtering)
- Reference issue: Filter `hari_kerja <= 0` caused 1 employee to be missing (~3.8M difference)

## Frontend: React Context System

The frontend uses React Context for state management:

| Context | Purpose |
|---------|---------|
| `AuthContext` | Authentication state, user info, login/logout |
| `HeaderContext` | AG Grid column definitions |
| `GangFilterContext` | Gang selection filter state |

## Frontend: Page Structure

| Page | Route | Purpose |
|------|-------|---------|
| `LoginPage` | `/login` | Authentication |
| `DashboardHome` | `/` | Dashboard landing |
| `MainPage` | `/payroll` | Main payroll report with AG Grid |
| `LockedMainPage` | `/locked` | Public payroll view (relaxed auth) |
| `SummaryReportPage` | `/summary` | Summary by division |
| `AnalysisReportPage` | `/analysis` | Analysis report |
| `PayrollAnalysisPage` | `/comprehensive` | **Payroll analysis with breakdown by component** |
| `EmployeeDetailPage` | `/employee/:nik` | Individual employee details |
| `WagesSummaryRebinmasPage` | `/wages-summary-rebinmas` | Rebinmas wage summary |
| `WagesSummaryIJLPage` | `/wages-summary-ijl` | IJL wage summary |
| `ImpactReportPage` | `/impact` | Impact analysis |
| `onlyIJLReportPages` | `/ijl-reports` | IJL-specific reports |
| `AggregationSeederPage` | `/admin/aggregation` | Aggregation management |

## Frontend: Laporan Analisis Payroll

**Page:** `PayrollAnalysisPage` (formerly `ComprehensivePerformancePage`)
**Route:** `/comprehensive`
**File:** `frontend/src/pages/PayrollAnalysisPage.jsx`

### Overview

Comprehensive payroll analysis page with breakdown detail per component. Shows KPI cards, filtered tabs, and print-ready custom HTML table.

### Features

#### 1. Filter Controls
- **Month/Year Selector**: Select payroll period
- **Division Filter**: "SEMUA DIVISI" or specific division
- **Gang Filter**: "SEMUA GANG" or specific gang (disabled when division = "ALL")
- **Refresh Button**: Manual data refresh

#### 2. KPI Cards (Top Section)
- Total Karyawan
- Total HK
- Total Lembur
- Total Upah Bersih

#### 3. Tab Filters (with Range Filtering)
| Tab | Filter Value | Description |
|-----|--------------|-------------|
| SEMUA | `upah_bersih` | Shows all employees with full component breakdown |
| LEMBUR | `lembur_jumlah` | Shows employees with overtime, grouped by task_desc |
| PREMI | `total_premi` | Shows employees with premiums |
| TUNJANGAN | `total_tunjangan` | Shows employees with allowances |
| POTONGAN | `total_potongan_bersih` | Shows employees with deductions |

Each tab has Min/Max range filter to filter by the respective value.

#### 4. Lembur Display (Grouped by Task)

**IMPORTANT:** Unlike Employee Detail Page which shows individual transactions, this page groups overtime by `task_desc`:

```
└─ PANEN MANUAL (5x) | 10 jam | Rp 380.000
└─ PUPUK (3x) | 6 jam | Rp 228.000
✓ Total (2 jenis pekerjaan, 8 transaksi) | 16 jam | Rp 608.000
```

This provides:
- **Per-task breakdown**: See which job types have the most overtime
- **Transaction count**: Number of transactions per task
- **Summary validation**: Total detail = Total lembur

#### 5. Table Columns (Dynamic by Tab)

| Column Group | SEMUA | LEMBUR | PREMI | TUNJANGAN | POTONGAN |
|--------------|-------|--------|-------|-----------|----------|
| Karyawan (NIK, NAMA, GANG, TASK) | ✅ | ✅ | ✅ | ✅ | ✅ |
| ABSENSI (HK) | ✅ | ✅ | ✅ | ✅ | ✅ |
| TUNJANGAN (Beras, Jabatan, Masa Kerja, Total) | ✅ | - | - | ✅ | - |
| PREMI (Brondol, Pruning, Dynamic, Total) | ✅ | - | ✅ | - | - |
| LEMBUR (Jam, Rupiah) | ✅ | ✅ | - | - | - |
| TOTAL (Kotor) | ✅ | - | - | - | - |
| POTONGAN | - | - | - | - | ✅ |
| UPAH BERSIH | ✅ | ✅ | ✅ | ✅ | ✅ |

#### 6. Export Features
- **PRINT/PDF**: Browser print dialog with print-optimized CSS
- **EXPORT CSV**: Downloads data with all columns including dynamic premi headers

### Data Fetching

**API Endpoint:** `GET /payroll/report/division-raw-tree`

**Filtering Logic (Client-side after fetch):**
```typescript
// When gang is selected, filter by gang_code when flattening
const shouldInclude = !gang || gang === 'ALL' || gangData.gang_code === gang;
if (shouldInclude && gangData.employees && Array.isArray(gangData.employees)) {
  allEmployees = allEmployees.concat(gangData.employees);
}
```

**useEffect Dependencies:**
```typescript
useEffect(() => {
  fetchData();
}, [token, division, gang, month, year, allDivisions]);
```

### Important Notes

1. **Gang/Division Filter Sync**: Changing division or gang triggers automatic data refresh via useEffect
2. **Tab Filtering**: Filtered data is computed via `useMemo` based on active tab and range filters
3. **Lembur Records**: Only displayed when LEMBUR tab is active and employee has `lembur_records`
4. **Dynamic Premi Headers**: Premi columns are generated dynamically from actual data
5. **Print Optimization**: Uses `printOptimizer` for clean printed output

### Access Points

- **Dashboard Home**: "Laporan Analisis Payroll" card
- **Navigation Sidebar**: "Laporan Analisis Payroll" link
- **Main Page**: "LAPORAN ANALISIS PAYROLL" sidebar link

## Common Components

| Component | Purpose |
|-----------|---------|
| `AgGridWrapper` | AG Grid Enterprise wrapper with themes |
| `GangFilter` | Gang selection dropdown |
| `MonthPicker` | Month/year selection |
| `DivisionTabs` | Division-based navigation tabs |
| `SelectionStatusBar` | Show selected rows count |
| `SummaryKPICards` | KPI cards for summary page |
| `AggregationSeederModal` | Modal for triggering aggregation seed |
| `TestModePanel` | Test mode controls |
| `CustomPayrollTable` | Custom table rendering for payroll data |

## Aggregation Seeder

Triggers seeding of aggregation data from raw payroll to `extend_db_ptrj`.

**UI Access:**
- Analysis Report page: Yellow "SEED AGGREGATION" button
- Summary Report page: Yellow "Seed Aggregation" button

**Component:** `AggregationSeederModal`

## Server Architecture Details

### Dual Routing Support

The backend mounts routes under two prefixes for compatibility:

```
/payroll/*        → Direct access (internal)
/backend/upah/*   → Proxy access (external/reverse proxy)
```

This allows the same backend to work:
1. **Directly** in development (frontend talks to backend on port 8002)
2. **Behind reverse proxy** in production (proxy strips `/backend/upah` prefix)

### Static File Serving

The backend serves the frontend build in production:
- `/` → `../frontend/dist/index.html`
- `/assets/*` → `../frontend/dist/assets/*`
- `/images/*` → `../frontend/dist/images/*`

### SPA Fallback

Unknown routes (non-API) return `index.html` for client-side routing:
- API paths (`/backend/*`, `/api/*`, `/payroll/*`) return JSON 404
- All other paths serve `index.html`

### CORS Configuration

- Origin: `true` (reflects request origin)
- Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD
- Credentials: enabled
- Exposed Headers: `X-Total-Count`, `X-Execution-Time-Ms`

### Request Logging

All requests (except `/health`) are logged with method, path, and duration:
```
GET /payroll/divisions 123ms
POST /auth/login 45ms
```

## Google Spreadsheet Sync

### Overview

The system can sync payroll data to Google Spreadsheet via Google Apps Script Web App, providing:
- **2-Sheet Format**: Main Daftar Upah + Analysis sheet with multi-section breakdown
- **Charts**: Visual charts for Lembur, Premi, and Upah Bersih analysis
- **Filter Feature**: Create filtered sheets (accessible to ALL users including viewers)

### Setup Instructions

1. **Open Google Spreadsheet** > Extensions > Apps Script
2. **Copy code** from `integrasi/spreadsheet/Code.js` to `Code.gs`
3. **Project Settings** > Script Properties:
   - Add property: `API_SECRET` = your-secure-secret
4. **Deploy** > New deployment > Web app:
   - Execute as: Me
   - Who has access: Anyone
5. **Copy Web app URL** to backend `.env` as `GOOGLE_SCRIPT_URL`

### Environment Variables

```bash
# Google Apps Script
GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/.../exec
GOOGLE_SCRIPT_SECRET=your-secure-secret
```

### Sync Types

| Sync Type | Description | Sheets Created |
|-----------|-------------|----------------|
| `DAFTAR_UPAH` | Main payroll with multi-level headers | `AB1` (main), `AB1 - ANALISIS` (multi-section) |
| `ANALISIS_PAYROLL` | Payroll + Lembur + Premi breakdown | Same as above |
| `SUMMARY_WAGES` | Wages summary dashboard | `DASHBOARD` (summary) |

### Sheet Structure

#### Sheet 1: "AB1" - Main Daftar Upah

Full payroll data with:
- Multi-level headers (4 levels)
- Gang headers, Gang totals, Grand total
- All columns: Identitas, Absensi, Gaji Pokok, Tunjangan, Premi, Potongan, Total
- Dynamic premi/potongan columns based on actual data

#### Sheet 2: "AB1 - ANALISIS" - Multi-Section Breakdown

**Section 1: 📊 ANALISIS LEMBUR**
| Columns | Description |
|---------|-------------|
| NO, NIK, NAMA, GANG | Employee info |
| TASK | Task name + transaction count |
| JAM | Total hours per task |
| RUPIAH | Total amount per task |

**Section 2: 📊 ANALISIS PREMI**
| Columns | Description |
|---------|-------------|
| NO, NIK, NAMA, GANG | Employee info |
| BRONDOL, PRUNING | Static premi columns |
| [DYNAMIC] | Dynamic premi columns per jenis |
| TOTAL PREMI | Total all premi |

**Section 3: 📊 ANALISIS UPAH BERSIH**
| Columns | Description |
|---------|-------------|
| NO, NIK, NAMA, GANG | Employee info |
| HK | Jumlah hari kerja |
| GAJI POKOK | Base salary |
| TUNJANGAN | Total allowances |
| PREMI | Total premiums |
| POTONGAN | Total deductions |
| UPAH BERSIH | Take home pay |

### Charts

Each section includes visual charts:

**Lembur Section:**
- Bar Chart: Jam lembur per karyawan-task
- Pie Chart: Distribusi rupiah lembur

**Premi Section:**
- Stacked Column Chart: Premi per karyawan (Brondol, Pruning, Dynamic)

**Upah Bersih Section:**
- Pie Chart: Komposisi komponen upah (Gaji, Tunjangan, Premi, Potongan, Bersih)
- Bar Chart: Perbandingan nilai komponen

### Filter Feature - ALL USERS CAN USE!

**How It Works:**
- Filter creates a **NEW SHEET** with filtered results
- Original data is **NEVER DELETED** - safe for all users
- ALL users (including view-only) can see filtered results

**Payroll Tools Menu:**
```
📊 Payroll Tools
├── 🔍 Filter Data (New Sheet)  - Open filter sidebar
├── 🗑️ Clear Filtered Sheets     - Delete all filtered sheets
├── 📈 Refresh Charts            - Rebuild charts
└── ❓ Help                       - Show help dialog
```

**Filter Parameters:**
- **Search NIK/Nama**: Partial match search
- **Range HK**: Min/Max hari kerja
- **Range Gaji Pokok**: Min/Max gaji pokok
- **Range Upah Bersih**: Min/Max take home pay
- **Range Lembur Jam**: Min/Max overtime hours
- **Range Lembur Rupiah**: Min/Max overtime amount
- **Range Premi**: Min/Max total premium

**Section-Specific Filtering (Analysis Sheet):**
- Section Lembur: Filter by Jam & Rupiah
- Section Premi: Filter by Total Premi
- Section Upah Bersih: Filter by HK & Upah Bersih

**Usage:**
1. Click **Payroll Tools > Filter Data (New Sheet)**
2. Fill filter parameters in sidebar
3. Click **Apply**
4. New sheet "AB1 - Filtered" is created
5. Results visible to ALL users

### Access from Portal

**SpreadsheetSyncPage (`/spreadsheet-sync`):**
- Select Division (or ALL)
- Select Month/Year
- Select Sync Type
- Click "Sync Now" button

**PayrollAnalysisPage:**
- "SYNC TO SPREADSHEET" button to sync current filtered view

### Backend Service

**File:** `backend/src/services/appsScriptService.ts`

**Key Methods:**
```typescript
// Main sync entry point - creates 2 sheets
AppsScriptService.syncDivisionToSpreadsheet(division, month, year, records)

// Build main sheet (simple format)
buildMainSheetData(division, sortedGangs, gangsMap, dynamicColumns)

// Build analysis sheet (multi-section)
buildAnalysisSheetData(division, sortedGangs, gangsMap, dynamicColumns)

// Section builders
buildLemburAnalysisSection(sortedGangs, gangsMap)
buildPremiAnalysisSection(sortedGangs, gangsMap, dynamicColumns)
buildUpahBersihAnalysisSection(sortedGangs, gangsMap)
```

### Google Apps Script Functions

**File:** `integrasi/spreadsheet/Code.js`

**Key Functions:**
```javascript
// Sync handlers
syncDaftarUpah(payload)           // Main sync function
processSingleSheet(ss, sheetData) // Process individual sheet
processSheetData(sheet, sheetData) // Process main sheet
processAnalysisSheet(sheet, sheetData) // Process analysis sheet

// Analysis sheet functions
applyAnalysisFormatting(sheet, startRow, rows)
addAnalysisCharts(sheet, rows, startRow)
addLemburChart(sheet, dataStart, dataEnd, chartCol, allRows)
addPremiChart(sheet, dataStart, dataEnd, chartCol, allRows)
addUpahBersihChart(sheet, dataStart, dataEnd, chartCol, allRows)

// Filter functions
applyFilter(filterParams)           // Create new filtered sheet
applyFilterToAnalysisSheet()         // Filter for multi-section
passesFilters(row, params, colIndex) // Check if row passes filter
clearFilteredSheets()                // Delete all filtered sheets
refreshCharts()                      // Rebuild charts

// UI functions
onOpen()                            // Create menu on spreadsheet open
openFilterSidebar()                 // Open filter sidebar
showFilterHelp()                    // Show help dialog
getFilterSidebarHtml()              // Generate sidebar HTML
```

### User Permissions

| Role | Can View | Can Filter | Can Edit |
|------|----------|------------|----------|
| **Owner** | ✅ All sheets | ✅ Sidebar filter | ✅ All |
| **Editor** | ✅ All sheets | ✅ Sidebar filter | ✅ All |
| **Viewer** | ✅ All sheets | ✅ Filtered sheets (read-only) | ❌ None |

**Important:** Filter creates NEW sheets that ALL users can view. Users with edit access can create new filtered sheets via sidebar.

### Troubleshooting

**Issue:** "TypeError: sheet.getRange(...).setColumnWidth is not a function"
- **Cause:** Using Range method instead of Sheet method
- **Fix:** Deploy updated Code.js with correct syntax:
  ```javascript
  // WRONG
  sheet.getRange(1, i, 1, 1).setColumnWidth(100);
  // CORRECT
  sheet.setColumnWidth(i, 100);
  ```

**Issue:** "Data ini memiliki X kolom, tetapi rentang memiliki Y kolom"
- **Cause:** Column count mismatch between headers and data
- **Fix:** Check backend uses `headers[0].length` for column count

**Issue:** Charts not displaying
- **Cause:** Chart data range is empty or invalid
- **Fix:** Click "Payroll Tools > Refresh Charts" to rebuild

**Issue:** Filter not working for viewers
- **Cause:** Old filter method tried to modify original sheet
- **Fix:** Updated version creates new sheet - redeploy Code.js
