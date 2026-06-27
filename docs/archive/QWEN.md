# QWEN.md - Project Context Guide

## Project Overview

**Plantware Auto Report** is a full-stack payroll reporting system for **PT Rebinmas** (palm oil plantation company). The system processes employee payroll data from MSSQL databases and displays it through AG Grid with comprehensive reporting features.

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Bun + Elysia (TypeScript) |
| **Frontend** | React + Vite + AG Grid Enterprise |
| **Database** | MSSQL Server (via SQL Gateway API) |
| **Package Manager** | npm (root/frontend), Bun (backend) |

### Architecture Pattern

```
Frontend (React/Vite) → Backend (Bun/Elysia) → SQL Gateway API (Python) → MSSQL Databases
```

**Key Databases:**
- `db_ptrj` - Main payroll data (production)
- `extend_db_ptrj` - Aggregation history, analysis reports
- `VenusHR14` - Employee master data, FFB weights
- `db_ptrj_mill` - Mill PKS data (WM_TICKET)

---

## Quick Start

### Prerequisites
- Node.js 18+ (for frontend)
- Bun 1.0+ (for backend)
- Python 3.8+ (for SQL Gateway API - separate service)
- MSSQL Server access

### Installation

```bash
# Install all dependencies
npm run setup

# Or individually
npm run setup:backend    # cd backend && bun install
npm run setup:frontend   # cd frontend && npm install
```

### Development Mode

```bash
# Start both backend and frontend
npm run dev

# Or individually
npm run backend:dev      # Backend on port 8002
npm run frontend:lan     # Frontend on port 5175 (LAN mode)
```

### Production Mode

```bash
npm run prod
```

---

## Project Structure

```
refactor_production/
├── backend/                      # Bun + Elysia backend
│   ├── src/
│   │   ├── api/                  # Route handlers (auth, payroll, summary, etc.)
│   │   ├── services/             # Business logic (singleton pattern)
│   │   ├── db/                   # SQL Gateway client
│   │   ├── types/                # TypeScript type definitions
│   │   ├── utils/                # Utility functions
│   │   └── config.ts             # Environment configuration
│   ├── data/                     # Static data files
│   ├── query/                    # SQL query templates
│   └── logs/                     # Application logs
│
├── frontend/                     # React + Vite + AG Grid
│   ├── src/
│   │   ├── pages/                # Page components (36 pages)
│   │   ├── components/           # Reusable components
│   │   ├── services/             # API client (Axios)
│   │   ├── context/              # React contexts (Auth, Report, etc.)
│   │   ├── hooks/                # Custom React hooks
│   │   └── utils/                # Utility functions
│   └── public/                   # Static assets
│
├── _dev_utils/                   # Development utilities (NOT production)
│   ├── scripts/debugging/        # Debug/test scripts
│   ├── tests/                    # Integration tests
│   ├── planning/                 # Feature planning documents
│   └── prompts/                  # AI prompts
│
├── dokumentasi/                  # Indonesian documentation
│   ├── daftar_upah_services/     # Service documentation
│   ├── diagrams/                 # Architecture diagrams
│   └── *.md                      # Various documentation files
│
├── asknowledge/                  # Tax & THR documentation
│   ├── 01_PENDAPATAN_UPAH_LAINNYA_DAN_PAJAK.md
│   ├── 02_THR_2026_IMPLEMENTATION_CHECKLIST.md
│   └── 03_FLOW_DIAGRAM_OTHER_INCOME.md
│
└── system_documentation/         # System-level documentation
```

---

## Key Services (Backend)

### Core Services

| Service | Responsibility |
|---------|---------------|
| `divisionConfigService` | **Single Source of Truth** for division definitions |
| `gangService` | Fetch gangs/divisions |
| `dataExtractorService` | Extract payroll data from PR_TASKREGLN, PR_ADTRANS |
| `payrollService` | Calculate salary, BPJS, deductions |
| `summaryService` | Aggregate division/summary data |
| `headerService` | Generate dynamic AG Grid headers |
| `authService` | JWT token verification |

### Payroll Component Services

| Service | Responsibility |
|---------|---------------|
| `lemburCalculator` | Overtime calculation with tier-based rates |
| `pph21TerService` | PPh21 tax using TER method |
| `carumanService` | BPJS/Caruman calculations |
| `tunjanganService` | Allowance calculations |
| `payrollComponentRegistry` | Orchestrates all payroll calculations |

### Employee Services

| Service | Responsibility |
|---------|---------------|
| `employeeResolutionService` | Employee identity resolution |
| `employeeDetailService` | Employee details with daily overtime |
| `employeeEstateService` | Job title/estate management |
| `cutiService` | Leave (cuti) management |
| `employeeCareerHistoryService` | Career history tracking |

### Tax Services

| Service | Responsibility |
|---------|---------------|
| `TaxCalculationService` | Centralized tax calculations (PTKP & PPh21 TER) |
| `taxReportService` | Tax report generation (Form 1721) |
| `otherIncomesService` | THR, Bonus, Custom income handling |

### Configuration Services

| Service | Responsibility |
|---------|---------------|
| `DivisionConfigService` | Division definitions and alias resolution |
| `currentPeriodService` | Current payroll period |
| `cacheService` | Cache management |

---

## Division Definitions (PT Rebinmas)

### Real Divisions

| Code | Name | Gang Prefix |
|------|------|-------------|
| P1A | Parit Gunung 1A | A |
| P1B | Parit Gunung 1B | B |
| P2A | Parit Gunung 2A | C |
| P2B | Parit Gunung 2B | D |
| DME | KEBUN DME | E |
| ARA | KEBUN ARA | F |
| AB1 | Air Ruak B1 | G |
| AB2 | Air Ruak B2 | H |
| INF | INFRASTRUKTUR | I |
| ARC | Air Ruak RC | J |
| IJL | KEBUN IJL | L |
| NRS | NURSERY | - |
| MILL | MILL PKS | M |

### Virtual Divisions

| Code | Name | Source | Gang Pattern |
|------|------|--------|--------------|
| WKS_PG | WORKSHOP PARIT GUNUNG | P1A | `/^AMC$/i` |
| WKS_AR | WORKSHOP AIR RUAK | AB2 | `/^HMC$/i` |

### Aliases

- `INFRA` → `INF`
- `NURSERY` → `NRS`
- `PG1A` → `P1A`, `PG1A` → `P1A`
- `PG1B` → `P1B`, `PG1B` → `P1B`
- `PG2A` → `P2A`, `PG2A` → `P2A`
- `PG2B` → `P2B`, `PG2B` → `P2B`

---

## Database Connection Rules

### Database Profiles

| Profile | Database | Usage |
|---------|----------|-------|
| `SERVER_PROFILE_1` | `extend_db_ptrj` | Aggregation history, analysis |
| `SERVER_PROFILE_2` | `db_ptrj` | Main payroll data (production) |
| `SERVER_PROFILE_3` | `VenusHR14` | Employee master, FFB weight |

### Connection Methods

```typescript
// Default payroll database
const db = Database.getInstance();

// Extended database (aggregation)
const db = Database.getExtendedInstance();

// VenusHR14 for employee/mill data
const db = Database.getVenusInstance();

// Mill database for WM_TICKET
const db = Database.getMillInstance();
```

### SQL Query Rules

**ALWAYS use `?` placeholders:**

```typescript
// CORRECT
const result = await db.query(`
    SELECT * FROM table WHERE col1 = ? AND col2 = ?
`, [value1, value2]);

// WRONG - Don't use named params directly
const result = await db.query(`
    SELECT * FROM table WHERE col1 = @p0
`, [value1]);
```

The `prepareParams()` function auto-converts `?` → `@p0`, `@p1`, etc.

---

## Key API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `POST /auth/login` | POST | Authentication |
| `GET /payroll/divisions` | GET | List all divisions |
| `GET /payroll/gangs` | GET | Get gangs by division |
| `GET /payroll/headers` | GET | Dynamic AG Grid headers |
| `GET /payroll/report` | GET | Gang payroll data |
| `GET /summary/division` | GET | Division summary |
| `GET /summary/analysis-report` | GET | Analysis report |
| `POST /api/aggregation/seed` | POST | Trigger aggregation seeding |
| `GET /api/tax-report/1721` | GET | Tax report (Form 1721) |
| `GET /api/other-incomes` | GET | Other incomes (THR, Bonus) |

---

## Important Business Rules

### Employee Filtering Rules

**CRITICAL:** The correct filter logic:

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

### PTKP Status Mapping (Tax Classification)

| beras_rate | PTKP Status | TER Category | Tax Rate |
|------------|-------------|--------------|----------|
| 2250 | TK/0 | TER A | 5% |
| 3250 | TK/1 | TER A | 5% |
| 4200 | TK/2 | TER B | 15% |
| 3750 | K/0 | TER A | 5% |
| 4650 | K/1 | TER B | 15% |
| 5550 | K/2 | TER B | 15% |
| 6450 | K/3 | TER C | 25% |

### THR 2026 (Important Change)

⚠️ **THR 2026 is given in MARCH (month 3), NOT February**

```typescript
// backend/src/services/taxReportService.ts
function loadActiveThrPeriode(): ThrPeriode | null {
    return {
        year: 2026,
        month: 3,  // ← Changed from 2 to 3
        type: 'THR',
        name: 'THR 2026',
        is_active: true
    };
}
```

**THR Formula:**
```
THR = (UPAH_DASAR × 30) + (BERAS_RATE × 30) + MASA_KERJA_JUMLAH
```

**THR is taxable** - added to gross income for tax calculation.

### Lembur (Overtime) Calculation

**Source:** `PR_TASKREGLN` where `OT = 1` (pure overtime transactions only)

**Day Type Rates:**

| Day Type | Tier 1 | Tier 2 | Tier 3 | Tier 1 Boundary |
|----------|--------|--------|--------|-----------------|
| Mon-Thu, Sat | 1.5x | 2x | - | 1 hour |
| Friday | 1.5x | 2x | - | 1 hour |
| Sunday | 2x | 3x | 4x | 5/7 hours* |
| Holiday | 2x | 3x | 4x | 5/7 hours* |
| Religious Holiday | 3x | 4x | 4x | 5/7 hours* |

*Tier boundary depends on short day (Friday) or long day (other days)

---

## Development Conventions

### File Placement Rules

1. **Main Application Code**: `backend/src/`, `frontend/src/`
2. **Test Files**: `_dev_utils/tests/` or `_dev_utils/scripts/`
3. **Debug Scripts**: `_dev_utils/scripts/debugging/`
4. **Planning Docs**: `_dev_utils/planning/`
5. **NEVER** create loose test scripts in root directory

### Coding Style

- **TypeScript**: Strict mode, explicit types
- **Services**: Singleton pattern
- **Error Handling**: Try-catch with logging
- **Logging**: Use built-in logger with levels

### Testing Practices

```bash
# Backend tests
cd backend && bun run test

# Frontend tests
cd frontend && npm run test

# Integration tests
_dev_utils/tests/*.ts
```

---

## Common Commands

### Backend Development

```bash
cd backend
bun run dev          # Start dev server (port 8002, hot-reload)
bun run start        # Start production server
bun run test         # Run tests

# Run specific scripts
bun run src/scripts/test_division_mapping.ts
bun run src/scripts/test_thr_summary.ts
```

### Frontend Development

```bash
cd frontend
npm run dev          # Start dev server (port 5173)
npm run dev:lan      # LAN mode (port 5175, backend at 10.0.0.128)
npm run dev:proxy    # Proxy mode with /backend/upah prefix
npm run build        # Build for production
npm run test         # Run vitest tests
```

### Fixing Frontend Issues

If encountering "Outdated Optimize Dep" error:
```bash
cd frontend
rm -rf node_modules/.vite
npm install
# Then restart dev server
```

---

## Environment Variables

### Backend (.env)

```bash
# Server
PORT=8002
HOST=0.0.0.0
RUN_MODE=dev

# Database (SQL Gateway)
DB_API_URL=http://localhost:8001
DB_API_KEY=
DB_PROFILE=SERVER_PROFILE_1

# Auth
JWT_SECRET=your_secret
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Payroll Constants
UPAH_DASAR_2025=129220
UPAH_DASAR_2026=129220
BERAS_RATE_2025=35000
BERAS_RATE_2026=35000
```

### Frontend (.env.production)

```bash
VITE_BACKEND_HOST=localhost
VITE_BACKEND_PORT=8002
VITE_DEV_MODE=false
```

---

## Documentation References

### Internal Documentation

| Document | Location |
|----------|----------|
| Division Config Service | `dokumentasi/DivisionConfigService.md` |
| PPh21 TER Calculator | `dokumentasi/KALKULATOR_PPH21_TER.md` |
| THR 2026 Implementation | `asknowledge/02_THR_2026_IMPLEMENTATION_CHECKLIST.md` |
| API Documentation | `dokumentasi/API_Documentation.md` |
| Database Config | `dokumentasi/Database_Configuration.md` |

### Key Source Files

| File | Purpose |
|------|---------|
| `backend/src/services/config/DivisionConfigService.ts` | Division definitions |
| `backend/src/services/tax/TaxCalculationService.ts` | Tax calculations |
| `backend/src/services/taxReportService.ts` | THR period config |
| `backend/src/services/otherIncomesService.ts` | Other income handling |
| `backend/src/services/lemburCalculator.ts` | Overtime calculation |
| `backend/src/services/payrollComponentRegistry.ts` | Payroll orchestration |

---

## Troubleshooting

### Backend Issues

**Database Connection Failed:**
- Check SQL Gateway API is running on `DB_API_URL`
- Verify database profile configuration
- Check network connectivity to MSSQL server

**TypeScript Errors:**
```bash
cd backend
bun run --bun tsc --noEmit
```

### Frontend Issues

**Vite Cache Issues:**
```bash
cd frontend
rm -rf node_modules/.vite
npm install
```

**AG Grid License Warning:**
- Ensure enterprise license key is configured
- Check `frontend/src/utils/agGridLicense.ts`

---

## Additional Notes

### SQL Gateway Pattern

The backend does NOT connect directly to MSSQL. It queries a **Python SQL Gateway API**:

```
Backend (Bun) → POST {DB_API_URL}/v1/query → SQL Gateway (Python) → MSSQL
```

Request format:
```json
{
    "sql": "SELECT * FROM table WHERE id = ?",
    "params": [123],
    "server": "SERVER_PROFILE_2",
    "database": "db_ptrj"
}
```

### Proxy Mode

When running behind reverse proxy:
```bash
USE_PROXY=true
PROXY_STRIP_PREFIX=/backend/upah
```

This strips the prefix before routing.

### Cache Service

Cache is disabled in dev mode by default unless explicitly overridden.

---

## Contact & Support

For questions about this project:
1. Check `dokumentasi/` folder for detailed docs
2. Check `asknowledge/` for THR/Tax documentation
3. Review `CLAUDE.md` for additional context
4. Check `_dev_utils/planning/` for feature plans

## Qwen Added Memories
- IMPORTANT: Jabatan (role/position name) comes from extend_db_ptrj tables (employee_estate, history_gang_member), NOT from HR_GANGLN. When user says "jabatan" = role/position text (e.g. "Mandor", "Kerani"). When user says "tunjangan jabatan" = money amount from PR_ADTRANSLN.Amount where DocDesc LIKE '%JABATAN%'.
