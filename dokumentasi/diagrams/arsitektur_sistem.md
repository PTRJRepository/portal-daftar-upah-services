# Arsitektur Sistem Report Plantware Daftar Upah

## Stack Teknologi

### Backend
- **Bun + Elysia**: REST API server (port 8002)
- **Python SQL Gateway API**: Middleware untuk koneksi ke MSSQL databases
- **Database**: MSSQL (`db_ptrj`, `extend_db_ptrj`, `VenusHR14`, `db_ptrj_mill`)

### Frontend
- **React + Vite**: UI framework dengan build tool
- **AG Grid Enterprise**: Tabel interaktif dengan hierarchical headers
- **Axios**: HTTP client untuk API calls
- **Custom Payroll Table**: Tabel kustom (bukan AG Grid native) dengan CSS-based rendering

## Alur Data

```
Frontend (React)
    ↓ HTTP/Axios
Backend (Bun + Elysia)
    ↓ SQL Gateway API
Python SQL Gateway (localhost:8001)
    ↓ ODBC
MSSQL Databases (db_ptrj, extend_db_ptrj, VenusHR14)
```

## Routing

Backend mount routes di dua prefix:
- `/payroll/*`, `/summary/*`, `/auth/*` — akses langsung
- `/backend/upah/*` — proxy mode (strip prefix via middleware)

## Struktur Backend

```
backend/src/
├── api/              # Route handlers (Elysia routes)
├── services/          # Business logic (singleton pattern)
│   ├── config/        # DivisionConfigService (single source of truth)
│   ├── employee/      # Employee-related services
│   ├── payroll/       # Payroll component services
│   └── tax/          # Tax calculation services
├── db/               # SQL Gateway client
└── config.ts         # Environment variables
```

## Struktur Frontend

```
frontend/src/
├── pages/             # Page components (.jsx)
├── components/        # Reusable components
│   ├── common/        # Shared components
│   └── CustomPayrollTable.jsx  # Custom table renderer
├── services/          # API client (Axios)
├── context/           # React contexts
├── hooks/             # Custom hooks (usePayrollStream, useCurrentPeriod)
└── utils/             # Utilities (PayrollAggregator, exportExcel)
```

## API Endpoints Utama

| Method | Endpoint | Fungsi |
|--------|----------|--------|
| GET | `/payroll/report/division-raw-tree` | Data payroll per gang |
| GET | `/payroll/report/division-raw-tree/stream` | SSE streaming (progressive) |
| GET | `/payroll/headers` | Dynamic column headers |
| GET | `/payroll/gangs` | Daftar gang per divisi |
| POST | `/auth/login` | Login JWT |
| POST | `/api/aggregation/seed` | Trigger aggregation |

## Progressive Streaming

Endpoint `/payroll/report/division-raw-tree/stream` menggunakan Server-Sent Events (SSE) untuk streaming data progressive. Gang pertama tampil setelah query selesai, sisanya stream bertahap.
