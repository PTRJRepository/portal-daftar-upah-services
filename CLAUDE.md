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
│       └── config.ts             # Environment configuration
├── frontend/                     # React + Vite + AG Grid Enterprise
│   └── src/
│       ├── pages/                # Page components
│       ├── services/             # API client with Axios
│       └── components/           # Reusable components (AgGridWrapper, etc.)
└── dokumentasi/                  # Indonesian documentation
```

### SQL Gateway Pattern

The backend does NOT connect directly to MSSQL. Instead, it queries a **Python SQL Gateway API** that handles database connections:

```
Backend (Bun) → SQL Gateway API (Python) → MSSQL (db_ptrj, extend_db_ptrj, VenusHR14)
```

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
npm run build        # Build for production
```

### Fixing Frontend Issues
If you encounter "Outdated Optimize Dep" error:
```bash
cd frontend
rm -rf node_modules/.vite
npm install
# Then restart dev server
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
// Default payroll database (db_ptrj with SERVER_PROFILE_2 in prod)
const db = Database.getInstance();

// Extended database (extend_db_ptrj with SERVER_PROFILE_1)
const db = Database.getExtendedInstance();

// VenusHR14 for employee/mill data (VenusHR14 with SERVER_PROFILE_3)
const db = Database.getVenusInstance();

// Mill database for WM_TICKET (db_ptrj_mill with SERVER_PROFILE_3)
const db = Database.getMillInstance();
```

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
| `dataExtractorService` | Extract payroll data from PR_TASKREGLN, PR_ADTRANS, etc. |
| `payrollService` | Calculate salary, BPJS, deductions |
| `summaryService` | Aggregate division/summary data |
| `aggregationService` | Seed aggregation history |
| `gangService` | Fetch gangs/divisions from HR_GANG |
| `headerService` | Generate dynamic AG Grid headers |
| `authService` | JWT token verification |

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
4. Calculate: gaji_pokok, tunjangan, premi, potongan, upah_bersih
5. Filter: Exclude employees where hari_kerja (kehadiran) <= 0
6. Return: PayrollRow[] with dynamic premi/potongan fields
```

## Filter Rules

### Employee Filtering

Employees are **excluded** from reports when:
- `hari_kerja <= 0` (no actual work days after subtracting leave)

Applied in: `dataExtractorService.ts` line ~303

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

# Extended Database (Aggregation)
DB_EXTEND_DATABASE=extend_db_ptrj
DB_EXTEND_PROFILE=SERVER_PROFILE_1

# VenusHR14 (Employee/Mill)
DB_VENUS_DATABASE=VenusHR14
DB_VENUS_PROFILE=SERVER_PROFILE_3

# Auth
JWT_SECRET=...
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Constants
CONSTANTS_UPAH_MINIMUM_DASAR=3876600
CONSTANTS_POTONGAN_BPJS_GAJI_POKOK_MIN=3876600
CONSTANTS_POTONGAN_BPJS_IURAN_SPSI=4000

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
- **Tunjangan**: beras_jumlah, jabatan_jumlah, masa_kerja_jumlah, lembur_jumlah
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

## Aggregation Seeder

Triggers seeding of aggregation data from raw payroll to `extend_db_ptrj`.

**UI Access:**
- Analysis Report page: Yellow "SEED AGGREGATION" button
- Summary Report page: Yellow "Seed Aggregation" button

**Component:** `AggregationSeederModal`
