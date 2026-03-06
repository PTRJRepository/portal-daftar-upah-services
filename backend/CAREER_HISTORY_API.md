# Employee Career History API Documentation

## Overview

The Employee Career History API provides comprehensive tracking of employee career progression, including gang changes (perpindahan gang), division transfers, and employment history. The system uses NIK (Nomor Induk Karyawan / KTP) or employee name to track history across multiple EmpCode assignments.

## Base URL

```
/payroll/employee
```

## Authentication

All endpoints require Bearer token authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_token>
```

---

## Endpoints

### 1. Get Career Summary

Get a complete career summary for an employee by NIK or EmpCode.

**Endpoint:** `GET /career/:identifier`

**Parameters:**
- `identifier` (path): Employee NIK (10+ digits) or EmpCode

**Response:**
```json
{
  "nik": "198204152010012001",
  "emp_name": "JAMILA",
  "current_emp_code": "J0843",
  "current_gang_code": "J1P",
  "current_division_code": "ARC",
  "total_divisions": 2,
  "total_gangs": 3,
  "first_join_date": "2020-01-15",
  "total_service_years": 6,
  "career_timeline": [...],
  "gang_changes": [...]
}
```

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/payroll/employee/career/198204152010012001
```

---

### 2. Get Career Timeline

Get detailed career timeline with all positions held by the employee.

**Endpoint:** `GET /career/:identifier/timeline`

**Parameters:**
- `identifier` (path): Employee NIK or EmpCode
- `from_year` (query, optional): Filter from year
- `to_year` (query, optional): Filter to year
- `include_current` (query, optional): Include current position (default: true)

**Response:**
```json
{
  "count": 24,
  "data": [
    {
      "period_month": 3,
      "period_year": 2026,
      "emp_code": "J0843",
      "nik": "198204152010012001",
      "emp_name": "JAMILA",
      "gang_code": "J1P",
      "division_code": "ARC",
      "loc_code": "ARC",
      "position": "Worker",
      "status": "1",
      "source_table": "HR_EMPLOYEE",
      "is_current": true
    },
    ...
  ]
}
```

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/payroll/employee/career/J0843/timeline?from_year=2024&include_current=true"
```

---

### 3. Get Gang Changes (Perpindahan Gang)

Get all gang changes for an employee throughout their career.

**Endpoint:** `GET /career/:identifier/gang-changes`

**Parameters:**
- `identifier` (path): Employee NIK or EmpCode

**Response:**
```json
{
  "count": 2,
  "data": [
    {
      "from_gang_code": "A123",
      "from_division_code": "PG1A",
      "to_gang_code": "J1P",
      "to_division_code": "ARC",
      "change_month": 2,
      "change_year": 2025,
      "emp_code": "J0843",
      "nik": "198204152010012001",
      "emp_name": "JAMILA"
    }
  ]
}
```

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/payroll/employee/career/198204152010012001/gang-changes
```

---

### 4. Search Career History by Name

Search for employees by name and return their career summaries.

**Endpoint:** `GET /career/search`

**Parameters:**
- `name` (query, required): Employee name (minimum 2 characters)
- `limit` (query, optional): Maximum results (default: 20)

**Response:**
```json
{
  "count": 3,
  "data": [
    {
      "nik": "198204152010012001",
      "emp_name": "JAMILA",
      "current_emp_code": "J0843",
      "current_gang_code": "J1P",
      ...
    }
  ]
}
```

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/payroll/employee/career/search?name=JAMILA&limit=10"
```

---

### 5. Get Gang Transfers by Period

Get all employees who changed gangs in a specific period.

**Endpoint:** `GET /career/transfers/:month/:year`

**Parameters:**
- `month` (path): Month (1-12)
- `year` (path): Year (e.g., 2026)

**Response:**
```json
{
  "count": 15,
  "data": [
    {
      "from_gang_code": "A123",
      "from_division_code": "PG1A",
      "to_gang_code": "B456",
      "to_division_code": "PG1B",
      "change_month": 1,
      "change_year": 2026,
      "emp_code": "A1234",
      "nik": "198204152010012001",
      "emp_name": "JOHN DOE"
    }
  ]
}
```

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/payroll/employee/career/transfers/1/2026
```

---

## Data Sources

The service uses multiple data sources:

1. **Live Data (HR_EMPLOYEE, HR_GANGLN)**: Current employee information
2. **History Data (history_hr_employee, history_gang_member)**: Historical records from extend_db_ptrj

## Key Features

### NIK-Based Tracking
- Uses NIK (NewICNo) as the primary identifier to track employees across multiple EmpCode assignments
- Automatically resolves NIK to current and historical EmpCodes

### Gang Change Detection
- Automatically detects when an employee changes gangs between periods
- Tracks both gang_code and division_code changes

### Career Timeline
- Provides month-by-month career progression
- Includes position, division, gang, and employment status

### Search Capabilities
- Search by NIK (exact match)
- Search by EmpCode (exact match)
- Search by name (partial match)

---

## Error Responses

### 404 Not Found
```json
{
  "error": "Employee not found"
}
```

### 400 Bad Request
```json
{
  "error": "Name must be at least 2 characters"
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to fetch career summary"
}
```

---

## Usage Examples

### Track Employee Career Progression
```javascript
// Get complete career summary
const summary = await fetch('/payroll/employee/career/198204152010012001', {
  headers: { 'Authorization': 'Bearer <token>' }
});
const data = await summary.json();
console.log(`${data.emp_name} has worked in ${data.total_divisions} divisions`);
```

### Find All Gang Changes
```javascript
// Get all gang changes for an employee
const changes = await fetch('/payroll/employee/career/J0843/gang-changes', {
  headers: { 'Authorization': 'Bearer <token>' }
});
const data = await changes.json();
data.data.forEach(change => {
  console.log(`${change.change_month}/${change.change_year}: ${change.from_gang_code} -> ${change.to_gang_code}`);
});
```

### Find Recent Transfers
```javascript
// Get all transfers in January 2026
const transfers = await fetch('/payroll/employee/career/transfers/1/2026', {
  headers: { 'Authorization': 'Bearer <token>' }
});
const data = await transfers.json();
console.log(`${data.count} employees transferred in January 2026`);
```

---

## Testing

Run the test script to verify the service:

```bash
bun run test_career_history.ts
```

---

## Related Files

- Service: `backend/src/services/employeeCareerHistoryService.ts`
- API Routes: `backend/src/api/employee.ts`
- Test Script: `backend/test_career_history.ts`
