---
tags: [AI-Context, Daftar-Upah, Payroll-System, Project-Analysis, Production-System]
created: 2025-11-26
---

# AI Context: Comprehensive Daftar Upah Payroll System Analysis

## Project Overview

This is a production-ready payroll reporting system ("Daftar Upah Reporting") for PT Rebinmas with a modern full-stack architecture. The system has been refactored for production use and features dynamic header generation, threaded data processing, and real-time reporting capabilities.

## Architecture Summary

### Backend (FastAPI)
- **Framework**: FastAPI with uvicorn server
- **Database**: Microsoft SQL Server with connection pooling
- **Authentication**: JWT-based with role-based access control (ADMIN, USER, MANAGER)
- **Architecture**: Layered pattern with API, Services, Repositories, and Models

### Frontend (React + Vite)
- **Framework**: React 18 with Vite build tool
- **UI Grid**: AG-Grid Enterprise for data display and manipulation
- **State Management**: React Context for authentication and headers data
- **Development Mode**: Auto-login and mock data support

## Key Technical Components

### Dynamic Header Generation System
The system uses a sophisticated JSON-based header configuration in `backend/struktur/struktur_header_report.json`:

- **Three-level hierarchy**: Main categories → Sub-categories → Unit columns
- **Field mapping**: Converts JSON structure IDs to database field names
- **Data path extraction**: Critical distinction between `hierarchy` and `generated_headers` paths
- **Auto-hide functionality**: Dynamically hides empty columns

### Critical Architecture Patterns

#### Headers vs Columns API Pattern
- `/payroll/headers`: Generates dynamic header structures from database queries
- `/payroll/columns`: Converts headers into AG-Grid column definitions
- Headers endpoint provides raw data structure with performance metrics
- Columns endpoint provides grid-ready configuration with field mapping

#### Attendance/Absensi Structure
The ABSENSI group follows a specific hierarchy:
```
Level 1: ABSENSI (colspan: 3)
  └── Level 2: KEHADIRAN → hari_kerja
  └── Level 2: KETIDAKHADIRAN (colspan: 7) → cuti_tahunan, cuti_sakit_haid, cuti_minggu, cuti_nasional, cth, alpa, total_ketidakhadiran
  └── Level 2: TOTAL HK → jumlah_hk
```

### Database Layer
- **Connection Pooling**: Singleton pattern with configurable pool sizes
- **Query Organization**: JSON-based queries with parameterized statements
- **Transaction Support**: Context managers for atomic operations
- **Multi-environment Support**: Separate configs for dev/prod

### Authentication Flow
- JWT tokens managed via `js-cookie`
- React Context for authentication state
- Division-based data access restrictions
- Development mode auto-login (admin/admin)

## Development Commands

### Backend Operations
```bash
cd backend
pip install -r requirements.txt
python main.py  # Default port 8002

# With custom configuration
python main.py --mode dev
python main.py --mode prod
python main.py --custom-ip 192.168.1.100

# Testing
pytest
pytest --cov=app tests/
```

### Frontend Operations
```bash
cd frontend
npm install
npm run dev:test  # Development mode on port 5175
npm run build
npm run test

# Network access options
npm run dev:network
npm run dev:lan
npm run dev:custom-backend
```

### Database Testing
```bash
# Test connection
python -c "from database.services.database import Database; print('Connection healthy' if Database.instance().test_connection() else 'Connection failed')"

# Initialize with pooling
python -c "from database.services.database import Database; db = Database.instance(pool_size=5); print('Database initialized')"
```

## Environment Configuration

### Key Environment Variables
- `DEV_MODE` - Enable development mode with auto-login
- `VITE_DEV_MODE` - Frontend development mode flag
- `TEST_MODE` - Enable test mode with hardcoded defaults
- `DEFAULT_GANG` - Default gang code (H1H)
- `DEFAULT_MONTH` - Default month (5)
- `DEFAULT_YEAR` - Default year (2025)

### Multi-Computer Setup Support
The system supports flexible IP configuration for development across multiple machines:
- **Development mode**: localhost + 10.0.0.128
- **Production mode**: 10.0.0.110
- **Custom IP**: Override via CLI arguments

## API Endpoints Structure

### Core Payroll Endpoints
- `GET /payroll/report` - Generate payroll report with pagination
- `GET /payroll/headers` - Get dynamic column headers
- `GET /payroll/columns` - Get AG-Grid column definitions
- `GET /payroll/gangs` - List available gang codes
- `GET /payroll/health` - System health check

### Performance & Debugging
- `GET /payroll/performance/compare` - Benchmark threaded vs sequential
- `GET /payroll/debug/employee_query` - Debug employee queries
- `GET /payroll/export_html` - Export HTML report

## Threaded Processing System

The system implements multi-threaded data processing:
- `ThreadedHeaderService` - Parallel header generation
- `ThreadedDataExtractor` - Parallel payroll data extraction
- Connection pooling for concurrent database access
- Performance improvements of 2-3x for large datasets

## Frontend Grid Configuration

AG-Grid Enterprise is optimized for:
- Dynamic column definitions from backend
- Infinite scrolling (200-row blocks)
- Pinned bottom rows for summaries
- Auto-sizing based on content
- Export capabilities

## Common Development Patterns

### Header Field Mapping
When modifying attendance/absensi fields:
1. Update JSON structure in `struktur_header_report.json`
2. Add field mappings in `header_service.py` `_map_to_data_field()`
3. Test headers API (`/payroll/headers`)
4. Test columns API (`/payroll/columns`)
5. Ensure `get_column_definitions()` uses `hierarchy` not `generated_headers`

### Debugging Common Issues

#### Authentication Problems
- Check JWT token expiration
- Verify browser cookies for `access_token`
- Ensure CORS allows credentials
- Development mode should auto-login

#### Database Connection Issues
- Verify SQL Server Authentication Mode
- Test with different DB profiles
- Check ODBC Driver installation
- Use connection testing scripts

#### Performance Monitoring
- Use `/payroll/performance/compare` for benchmarks
- Monitor memory usage with `monitor=true`
- Enable threading for large datasets

## Key File Locations

### Backend Core Files
- `backend/main.py` - Application entry point with CLI args
- `backend/app/api/payroll.py` - Core payroll endpoints
- `backend/app/services/header_service.py` - Dynamic header generation
- `backend/database/services/database.py` - Connection pooling
- `backend/struktur/struktur_header_report.json` - Header structure config

### Frontend Core Files
- `frontend/src/pages/Report.jsx` - Main payroll report interface
- `frontend/src/components/common/AgGridWrapper.jsx` - AG-Grid configuration
- `frontend/src/context/AuthContext.jsx` - Authentication state management
- `frontend/vite.config.test.js` - Development configuration

## Performance Considerations

- Threaded processing provides 2-3x improvement for large datasets
- Memory monitoring available for data extraction operations
- Pagination recommended for reports with >1000 rows
- Connection pooling prevents database connection exhaustion
- AG-Grid infinite scrolling for responsive UI with large data

## Testing Strategy

- Development mode auto-configures with test data (H1H gang, May 2025)
- Frontend supports mock authentication in development mode
- Database connection pooling handles concurrent requests efficiently
- Performance endpoints available for benchmarking

This system represents a mature, production-ready payroll reporting solution with comprehensive error handling, performance optimization, and multi-environment support.