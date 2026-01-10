# Database Configuration Documentation

## Overview
The system uses Microsoft SQL Server (MSSQL) as the primary database with a robust configuration system that supports multiple environments and profiles. The database layer is built using pyodbc for connectivity with configuration management through JSON files and environment variables.

## Database Structure

### Connection Architecture
- **Database Type**: Microsoft SQL Server
- **Driver**: ODBC Driver 17 for SQL Server (configurable)
- **Connection Method**: pyodbc with parameterized queries
- **Security**: Username/password or trusted connection (configurable)

### Configuration Sources
The database configuration is managed through three layers in order of precedence:

1. **Environment Variables** (highest priority)
2. **Profile-specific settings** (medium priority) 
3. **Default settings** (lowest priority)

## Configuration File Structure

### `config.json`
The main configuration file contains both default database settings and profiles for different environments.

```json
{
  "database": {
    "driver": "ODBC Driver 17 for SQL Server",
    "server": "10.0.0.110",
    "port": 1433,
    "username": "sa",
    "password": "ptrj@123",
    "database_name": "db_ptrj",
    "trusted_connection": false,
    "encrypt": false
  },
  "database_profiles": {
    "local": {
      "driver": "ODBC Driver 17 for SQL Server",
      "server": "localhost",
      "port": 1433,
      "username": "sa",
      "password": "windows0819",
      "database_name": "db_ptrj",
      "trusted_connection": false,
      "encrypt": false
    },
    "local-server-2": {
      "driver": "ODBC Driver 17 for SQL Server",
      "server": "localhost",
      "port": 1433,
      "username": "sa",
      "password": "",
      "database_name": "db_ptrj",
      "trusted_connection": false,
      "encrypt": false
    },
    "remote": {
      "driver": "ODBC Driver 17 for SQL Server",
      "server": "10.0.0.110",
      "port": 1433,
      "username": "sa",
      "password": "ptrj@123",
      "database_name": "db_ptrj",
      "trusted_connection": false,
      "encrypt": false
    }
  },
  "constants": {
    "Caruman_Astek": {
      "Pekerja": 77532,
      "Majikan": 175998
    },
    "potongan_bpjs": {
      "gaji_pokok_min": 3876600,
      "iuran_spsi": 4000
    },
    "upah_minimum": {
      "dasar": 3876600
    }
  }
}
```

## Configuration Management

### Environment Variables
The following environment variables can override database configuration:

- `DB_DRIVER`: ODBC driver to use
- `DB_SERVER`: Database server address
- `DB_PORT`: Database port (default: 1433)
- `DB_NAME`: Database name
- `DB_USER`: Database username
- `DB_PASS`: Database password
- `DB_PROFILE`: Profile to use (local, remote, etc.)

### Profile Selection
Database profiles can be selected in multiple ways:

1. **Command Line**: Using `--db-profile` parameter in main.py
2. **Environment Variable**: Setting `DB_PROFILE`
3. **Runtime**: Passing `profile` parameter to services

### Connection String Generation
The connection string is automatically generated based on the selected configuration:

```
DRIVER={driver};SERVER={server},{port};DATABASE={database_name};UID={username};PWD={password};Encrypt={yes/no};
```

For trusted connection, the format is:
```
DRIVER={driver};SERVER={server},{port};DATABASE={database_name};Trusted_Connection=yes;Encrypt={yes/no};
```

## Database Services Architecture

### Database Service (`database/services/database.py`)
- Singleton pattern implementation
- Connection pooling support
- Query execution with parameterization
- Error handling and logging
- Transaction support

### Repository Layer (`app/repositories/`)
- **Employee Repository**: Handles employee data access
  - `EmployeeRepository` (base interface)
  - `EmployeeRepositoryDB` (database implementation)
- **Gang Repository**: Handles gang and division data
  - `GangRepository` (base interface)
  - `GangRepositoryDB` (database implementation)

### Key Database Tables
Based on the query patterns in the codebase, the system interacts with these main tables:

- `HR_EMPLOYEE`: Employee master data (EmpCode, Name, LocCode, Status, etc.)
- `HR_GANGLN`: Gang-employee relationships (GangCode, GangMember)
- `HR_GANG`: Gang master data with location codes

## Security Features

### SQL Injection Prevention
- All queries use parameterized statements with `?` placeholders
- The `_paramify` method in payroll service ensures proper parameter substitution
- Input validation through Pydantic models

### Connection Security
- Password protection through configuration files
- Environment variable support for sensitive data
- Trusted connection option for Windows environments
- Encrypt option (currently disabled in configs)

### Access Control
- Role-based access control in the application layer
- Database user permissions managed separately
- Connection pooling limits prevent resource exhaustion

## Performance Optimizations

### Connection Pooling
- Configurable connection pool size
- Reuse of database connections
- Timeout handling for idle connections

### Query Optimization
- Parameterized queries for efficiency
- Index usage for frequently queried fields
- Batch operations where appropriate

### Caching Integration
- Database query results cached at the service layer
- TTL-based cache expiration
- Cache invalidation strategies

## Database Constants

The system includes important business constants in the configuration:

### BPJS Components
- `Caruman_Astek.Pekerja`: 77,532 (Worker contribution)
- `Caruman_Astek.Majikan`: 175,998 (Employer contribution)
- `potongan_bpjs.gaji_pokok_min`: 3,876,600 (Minimum basic salary)
- `potongan_bpjs.iuran_spsi`: 4,000 (SPSI contribution)

### Payroll Constants
- `upah_minimum.dasar`: 3,876,600 (Minimum basic wage)

## Connection Testing

### Health Checks
- Database connectivity verified through health endpoint
- Basic query execution test (`SELECT 1`)
- Performance monitoring for connection times

### Debugging Tools
- `/payroll/debug/db-connection` endpoint for profile testing
- Connection string visibility for debugging
- Connection pool status monitoring

## Environment-Specific Configurations

### Development Environment
- Local database connection (localhost)
- Development credentials
- Lower security restrictions for development

### Production Environment
- Remote database server (10.0.0.110)
- Production credentials
- Enhanced security measures
- Connection monitoring and error handling

### Testing Environment
- Configurable test database
- Isolated test data
- Mock data support for testing