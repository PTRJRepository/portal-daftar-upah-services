# API Documentation

## Base URL
The API is served at the backend server (default port 8002) with the following endpoints available under the `/` root path.

## Authentication
Most endpoints require authentication using JWT tokens. The token should be included in the `Authorization` header as a Bearer token:
```
Authorization: Bearer <token>
```

The token can be obtained by calling the `/auth/login` endpoint.

## API Endpoints

### Authentication Endpoints (`/auth`)

#### POST `/auth/login`
Authenticate user and return JWT token.

#### GET `/auth/me`
Get current user information (requires valid token).

### User Management (`/users`)

#### GET `/users/me`
Get current user details (requires valid token).

### Employee Management (`/employees`)

#### GET `/employees/list`
Get list of employees with optional filtering.

### Payroll Endpoints (`/payroll`)

#### GET `/payroll/report`
Get payroll report data with pagination and filtering.

**Parameters:**
- `gang_code` (optional): Filter by gang code (e.g., H1H)
- `month` (optional): Month for report (1-12)
- `year` (optional): Year for report
- `skip` (optional): Number of records to skip (default: 0)
- `limit` (optional): Number of records to return (1-2000, default: 500)
- `fields` (optional): Comma-separated list of fields to return
- `benchmark` (optional): Include performance metrics in response
- `monitor` (optional): Include memory usage monitoring
- `use_threading` (optional): Use threaded data extraction for better performance

**Response:** List of `PayrollRow` objects with employee payroll data.

#### GET `/payroll/report/real`
Get real payroll data with caching.

**Parameters:**
- `gang_code` (optional): Filter by gang code
- `division` (optional): Filter by division
- `month` (optional): Month for report
- `year` (optional): Year for report
- `skip` (optional): Number of records to skip
- `limit` (optional): Number of records to return

#### GET `/payroll/report/simple`
Get simplified payroll data with caching.

**Parameters:**
- `gang_code` (optional): Filter by gang code
- `division` (optional): Filter by division
- `month` (optional): Month for report
- `year` (optional): Year for report
- `skip` (optional): Number of records to skip
- `limit` (optional): Number of records to return (1-50)

#### GET `/payroll/report/division-optimized`
Fetch payroll rows for all gangs in a division concurrently with parallel processing.

**Parameters:**
- `division` (required): Division code
- `month` (required): Month for report
- `year` (required): Year for report

#### GET `/payroll/report/count`
Get count of employees in specified gang or division.

**Parameters:**
- `gang_code` (optional): Filter by gang code
- `division` (optional): Filter by division
- `month` (optional): Month for report
- `year` (optional): Year for report

#### GET `/payroll/aggregate`
Get aggregated payroll data across all employees in specified criteria.

**Parameters:**
- `gang_code` (optional): Filter by gang code
- `division` (optional): Filter by division
- `month` (optional): Month for report
- `year` (optional): Year for report

#### GET `/payroll/headers`
Generate dynamic headers for the AG Grid based on real data.

**Parameters:**
- `month` (optional): Month for report (1-12)
- `year` (optional): Year for report
- `gang_code` (optional): Gang code filter
- `use_threading` (optional): Use threaded processing (default: true)

**Response:** Dynamic header structure for AG Grid.

#### GET `/payroll/columns`
Get column definitions for the AG Grid with aggregation specifications.

**Parameters:**
- `month` (optional): Month for report (1-12)
- `year` (optional): Year for report
- `gang_code` (optional): Gang code filter
- `fallback` (optional): Force fallback column definitions

**Response:** List of column definitions with aggregation rules.

#### POST `/payroll/calculate`
Calculate payroll based on input parameters.

**Request Body:**
```json
{
  "upah_dasar": 3876600,
  "hk_count": 22,
  "allowances": {
    "beras": 100000,
    "jabatan": 200000
  },
  "deductions": {
    "bpjs": 200000
  }
}
```

#### GET `/payroll/report/row/{nik}`
Get payroll data for a specific employee by NIK.

**Parameters:**
- `nik` (path): Employee NIK
- `month` (optional): Month for report
- `year` (optional): Year for report
- `fields` (optional): Comma-separated list of fields to return

#### GET `/payroll/report/column/{field}`
Get values for a specific field across all employees.

**Parameters:**
- `field` (path): Field name to retrieve
- `gang_code` (optional): Filter by gang code
- `month` (optional): Month for report
- `year` (optional): Year for report
- `skip` (optional): Number of records to skip
- `limit` (optional): Number of records to return

### Gang Management (`/payroll`)

#### GET `/payroll/gangs`
Get available gang codes with optional filtering.

**Parameters:**
- `division` (optional): Filter by division
- `search` (optional): Search gangs with LIKE operator
- `force` (optional): Force refresh from database

#### GET `/payroll/gangs/by-loc`
Get gang codes by location code.

**Parameters:**
- `loc_code` (required): Exact LocCode to filter gangs (e.g., AB2)
- `force` (optional): Force refresh from database

#### GET `/payroll/gangs/codes`
Get all available gang codes.

**Parameters:**
- `force` (optional): Force refresh from database

#### GET `/payroll/gangs/{gang_code}/info`
Get detailed information about a specific gang.

**Parameters:**
- `gang_code` (path): Gang code to get information for

#### GET `/payroll/divisions`
Get all available divisions.

### Report Generation (`/payroll`)

#### GET `/payroll/export_html`
Export payroll data as HTML report.

**Parameters:**
- `gang_code` (optional): Gang code for report
- `month` (optional): Month for report
- `year` (optional): Year for report

#### GET `/payroll/reference_html`
Get reference HTML file.

**Parameters:**
- `file_path` (required): Full path to reference HTML file

#### GET `/payroll/validate_html`
Validate generated HTML report against reference.

**Parameters:**
- `file_path` (required): Full path to reference HTML file
- `gang_code` (optional): Gang code for validation
- `month` (optional): Month for validation
- `year` (optional): Year for validation

### Configuration Endpoints (`/config`)

#### GET `/config/info`
Get system configuration information.

### Utility Endpoints

#### GET `/dev-mode`
Get development mode information.

**Response:** Information about run mode, IP addresses, and test mode status.

#### GET `/payroll/health`
Health check endpoint for database and system status.

**Response:** Health status including database connectivity and service availability.

#### GET `/payroll/performance/compare`
Compare performance between sequential and threaded processing.

**Parameters:**
- `gang_code` (optional): Gang code for testing
- `month` (optional): Month for testing
- `year` (optional): Year for testing

### Debug Endpoints (`/payroll`)

#### GET `/payroll/debug/employee_query`
Debug endpoint to test employee query system.

**Parameters:**
- `gang_code` (optional): Gang code to test (default: H1H)

#### GET `/payroll/debug/employees`
Debug endpoint to check employee data and database structure.

**Parameters:**
- `gang_code` (optional): Gang code to debug (default: H1H)

#### GET `/payroll/debug/db-connection`
Debug database connection.

**Parameters:**
- `profile` (optional): Database profile name (e.g., 'remote' or 'local')

## Data Models

### PayrollRow
The main data model for payroll information, containing:

- Employee information (NIK, name, gang code, etc.)
- Payroll components (upah dasar, hari kerja, gaji pokok)
- Allowances (beras, jabatan, masa kerja, lembur)
- Premiums (premi_brondol, premi_pruning, premi_1-7)
- Deductions (BPJS, SPSI, PPH21, corrections)
- Calculations (total_tunjangan, total_premi, jumlah_upah_kotor, upah_bersih)

### Authentication Response
- `access_token`: JWT token for authentication
- `token_type`: Token type (usually "bearer")

## Error Handling

The API returns standard HTTP status codes:

- `200`: Success
- `400`: Bad Request (invalid parameters)
- `401`: Unauthorized (missing or invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found (requested resource not found)
- `422`: Unprocessable Entity (validation error)
- `500`: Internal Server Error
- `503`: Service Unavailable (health check failure)
- `504`: Gateway Timeout (request timeout)

## Performance Considerations

- Use `use_threading=true` parameter for better performance when available
- Implement caching for frequently accessed data
- Use pagination (`skip`, `limit`) for large datasets
- Monitor response times using the `benchmark` parameter
- Consider using the `/payroll/performance/compare` endpoint to optimize performance

## Testing Mode

The system supports a test mode that can be enabled through the `TEST_MODE` environment variable. When in test mode:
- Default values are used for missing parameters
- Additional debug information is included in responses
- Test data may be used instead of real data