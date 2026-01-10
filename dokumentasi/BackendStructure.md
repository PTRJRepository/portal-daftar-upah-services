# Backend Architecture Documentation

## Project Structure

```
backend/
├── app/                          # Main application package
│   ├── api/                      # API endpoints and routing
│   │   ├── __init__.py          # API router configuration
│   │   ├── auth.py              # Authentication endpoints (login, token refresh)
│   │   ├── config.py            # Configuration endpoints
│   │   ├── employees.py         # Employee management endpoints
│   │   ├── payroll.py           # Payroll processing endpoints (main module)
│   │   └── reports.py           # Report generation endpoints
│   ├── core/                     # Core application functionality
│   │   ├── __init__.py          # Package initialization
│   │   ├── config.py            # Application configuration, environment variables
│   │   └── security.py          # Security utilities, authentication helpers
│   ├── models/                   # Data models (Pydantic)
│   │   ├── __init__.py          # Model exports
│   │   ├── aggregated_response.py # Aggregated response models
│   │   ├── aggregation_rules.py # Aggregation rules models
│   │   ├── employee.py          # Employee data models
│   │   ├── payroll.py           # Payroll row models (PayrollRow)
│   │   ├── payroll_backup.py    # Backup payroll models
│   │   └── user.py              # User authentication models
│   ├── repositories/             # Data access layer (database queries)
│   │   ├── __init__.py          # Repository exports
│   │   ├── employee_repository.py      # Base employee repository
│   │   ├── employee_repository_db.py   # Database implementation of employee repository
│   │   ├── gang_repository.py          # Base gang repository
│   │   └── gang_repository_db.py       # Database implementation of gang repository
│   ├── services/                 # Business logic and processing services
│   │   ├── __init__.py          # Service exports
│   │   ├── aggregation_rules_service.py # Rules for data aggregation
│   │   ├── aggregation_service.py       # Data aggregation logic
│   │   ├── auth_service.py              # Authentication business logic
│   │   ├── cache_service.py             # Caching implementation
│   │   ├── database_service.py          # Database interaction services
│   │   ├── employee_service.py          # Employee business logic
│   │   ├── gang_service.py              # Gang management services
│   │   ├── header_service.py            # Dynamic header generation
│   │   ├── mssql_service.py             # MSSQL-specific database operations
│   │   ├── payroll_service.py           # Payroll calculation and generation logic
│   │   ├── report_service.py            # Report generation services
│   │   ├── threaded_data_extractor.py   # Threaded data extraction for performance
│   │   ├── threaded_header_service.py   # Threaded header generation
│   │   └── simplified_method.py         # Optimized header/column generation (new)
│   └── utils/                    # Utility functions
│       ├── __init__.py          # Utility exports
│       ├── database.py          # Database utility functions
│       └── helpers.py           # General helper functions
├── config/                       # Configuration files and settings
│   └── config.json              # Database connection settings and constants
├── database/                     # Database-specific modules
│   ├── __init__.py              # Database package initialization
│   ├── config/                  # Database configuration
│   ├── models/                  # Database models
│   ├── queries/                 # SQL query definitions
│   └── services/                # Database service implementations
├── data/                         # Data files and static data
├── query/                        # SQL query files
├── struktur/                     # Structural files (if any)
├── tests/                        # Test files for the backend application
├── Dockerfile                    # Docker containerization configuration
├── main.py                       # FastAPI application entry point
├── requirements.txt              # Python dependencies (FastAPI, uvicorn, etc.)
└── simplified_method.py          # Standalone optimized header generation
```

## Architecture Overview

The backend is built using **FastAPI** and follows the **MVC (Model-View-Controller)** pattern with separation of concerns:

- **API Layer**: Handles HTTP requests/responses, authentication, and routing
- **Service Layer**: Implements business logic and data processing
- **Repository Layer**: Manages database interactions and queries
- **Model Layer**: Defines data structures and validation schemas
- **Utils/Config**: Provides utility functions and configuration

## Key Components

### 1. Main Application (`main.py`)
- FastAPI instance with CORS middleware
- Custom CORS handling for development/production environments
- Command-line argument parsing for different run modes
- Request logging with sensitive data sanitization
- Supports development and production modes with different IP configurations

### 2. API Endpoints (`app/api/`)
- **Payroll API** (`payroll.py`): Main module with comprehensive payroll endpoints
  - `/payroll/report` - Generate payroll reports with pagination
  - `/payroll/headers` - Dynamic header generation for AG Grid
  - `/payroll/columns` - Column definitions for grid rendering
  - `/payroll/gangs` - Gang management and filtering
  - `/payroll/divisions` - Division management
  - `/payroll/health` - Health check with database connectivity
  - `/payroll/performance/compare` - Performance comparison between sequential/threaded processing
- **Authentication API** (`auth.py`): Token-based authentication
- **Employee API** (`employees.py`): Employee data endpoints
- **Report API** (`reports.py`): Report generation endpoints

### 3. Data Models (`app/models/`)
- **PayrollRow**: Defines the structure for payroll data returned to frontend
- **User**: Authentication user model
- **Aggregated Response Models**: Models for aggregated data responses

### 4. Repositories (`app/repositories/`)
- **Employee Repository**: Database access for employee data
  - Employee repository with database implementation
  - Supports filtering by gang code, division, and location
- **Gang Repository**: Database access for gang data
  - Gang code lookup and management
  - Division-based filtering

### 5. Services (`app/services/`)
- **Payroll Service**: Core payroll calculation logic
  - Implements correct formulas from reference code
  - Handles hari kerja, gaji pokok, tunjangan, and premi calculations
  - BPJS component calculations based on explicit requirements
- **Header Service**: Dynamic header generation for AG Grid
- **Threaded Services**: Performance-optimized threaded processing
- **Cache Service**: Caching implementation to improve performance
- **Gang Service**: Gang and division management

### 6. Database Configuration
- **MSSQL Database**: Using pyodbc for database connectivity
- **Multiple Profiles**: Supports local, remote, and custom database profiles
- **Connection Pooling**: Configurable database connection pooling
- **Environment-based Configuration**: Supports environment variables override

## Performance Optimizations

### Threading Implementation
- Threaded header generation for faster response times
- Parallel data extraction with ThreadedDataExtractor
- Performance comparison endpoints to measure improvements

### Caching
- CacheService implementation with configurable TTL
- Caching for payroll data, headers, and aggregated results
- Cache keys based on request parameters

### Query Optimization
- Parameterized queries to prevent SQL injection
- Efficient database queries with proper indexing
- Lazy loading where appropriate

## Security Features

### Authentication
- JWT-based token authentication
- Role-based access control (RBAC)
- Token validation middleware

### Request Security
- CORS middleware with origin validation
- Request logging with sensitive data sanitization
- Rate limiting considerations (via FastAPI)

### Data Security
- Environment-based configuration for sensitive data
- Database connection string protection
- Input validation through Pydantic models

## Configuration Management

### Environment Variables
- `RUN_MODE`: Set to 'dev' or 'prod' for different environments
- `DB_PROFILE`: Database profile selection (local, remote, etc.)
- `BACKEND_PORT`: Port for the backend server
- `REQUEST_TIMEOUT_SEC`: Request timeout configuration
- `CACHE_TTL_SECONDS`: Cache time-to-live configuration

### Database Profiles
- Pre-configured profiles for different environments
- Local and remote database configurations
- Support for environment variable overrides
