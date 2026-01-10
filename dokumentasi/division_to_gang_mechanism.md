# Division to Gang Mechanism Documentation

## Overview
This document explains the hierarchical relationship between divisions and gangs in the payroll system, including the mechanism for retrieving gang lists based on divisions, and how the system maps employee data from division level down to gang level.

## Division-Gang Hierarchy

### Division Mapping
The system organizes gangs under divisions using a prefix-based mapping system:

| Division Code | Gang Code Prefix | Description |
|---------------|------------------|-------------|
| PG1A | A | Plantation Group 1A |
| PG1B | B | Plantation Group 1B |
| PG2A | C | Plantation Group 2A |
| PG2B | D | Plantation Group 2B |
| DME | E | Estate Maintenance |
| ARA | F | Ara Estate |
| ARB1 | G | Arbei Estate 1 |
| ARB2 | H | Arbei Estate 2 |
| INFRA | I | Infrastructure |
| AREC | J | Area Civil |
| IJL | L | IJL Division |
| STF-OFFICE | O | Office Staff |
| SECURITY | SEC | Security Division |

### Gang Code Structure
- Gang codes typically follow a pattern where the first character (or first few characters for SECURITY) indicates the division
- Examples:
  - A1H, A2H → PG1A Division
  - B1H, B2H → PG1B Division
  - H1H, H1M → ARB2 Division
  - SEC001, SEC002 → SECURITY Division

## Mechanism for Getting Gang Lists from Division

### 1. API Endpoints
The system provides several endpoints to retrieve gang information:

#### `/payroll/gangs` - Get Gangs by Division
- **Method**: GET
- **Parameters**:
  - `division` (optional): Filter gangs by specific division
  - `search` (optional): Search term for fuzzy matching of gang codes or descriptions
- **Returns**: List of gang objects with gang code and description
- **Authorization**: Requires token that includes user division access rights

#### `/payroll/divisions` - Get Available Divisions
- **Method**: GET
- **Returns**: List of all available division codes
- **Authorization**: Requires valid token

#### `/payroll/gangs/by-loc` - Get Gangs by Location Code
- **Method**: GET
- **Parameters**:
  - `loc_code`: Exact location code to filter gangs
- **Returns**: List of gang codes associated with specific location

### 2. Backend Logic

#### GangService Class
The `GangService` class in `backend/app/services/gang_service.py` manages the division-gang mapping:

```python
class GangService:
    # Division to Gang Code Prefix Mapping
    DIVISION_MAPPING = {
        "PG1A": ["A"],
        "PG1B": ["B"],
        "PG2A": ["C"],
        "PG2B": ["D"],
        "DME": ["E"],
        "ARA": ["F"],
        "ARB1": ["G"],
        "ARB2": ["H"],
        "INFRA": ["I"],
        "AREC": ["J"],
        "IJL": ["L"],
        "STF-OFFICE": ["O"],
        "SECURITY": ["SEC"]
    }
```

#### Key Methods
- `get_all_divisions()`: Returns all available division codes
- `get_gang_prefixes_for_division(division)`: Gets the gang code prefixes for a specific division
- `filter_gangs_by_division(gangs, division)`: Filters a gang list to only include gangs from a specific division
- `fetch_gangs_from_database(division, search)`: Retrieves gangs from the database with optional division filtering

### 3. Database Queries and Relations

#### HR_GANG Table
- Contains gang code and description
- Used as the master list of all available gangs

#### HR_GANGLN Table
- Links employees (EmpCode) to gangs (GangCode)
- Provides the connection between employee data and gang assignments

#### Data Flow for Gang Retrieval
1. Request comes in with division parameter
2. GangService maps division to gang code prefixes
3. Query HR_GANG table filtering by prefixes
4. Return filtered gang list with codes and descriptions

## How Gang Lists are Retrieved

### For a Specific Division
1. When requesting gangs for a specific division (e.g., PG1A):
   - System checks the division mapping to identify prefixes (A for PG1A)
   - Queries database for gangs starting with the prefix
   - Returns list of gangs that match the division's prefix pattern

### For All Available Gangs
1. If no division is specified:
   - System retrieves all gangs from HR_GANG table
   - May be filtered by authorization (user access rights)

### With Search Functionality
1. Optional search parameter allows partial matching:
   - Search term applied to both gang codes and descriptions
   - Case-insensitive LIKE operation

## Implementation in Payroll Processing

### Using PR_TASKREGLN for Attendance Counting
The system counts attendance days (HK) using the PR_TASKREGLN table:
```sql
SELECT 
    tr.EmpCode,
    COUNT(DISTINCT tr.TrxDate) as hk_count
FROM PR_TASKREGLN_ARC tr
JOIN HR_GANGLN g ON g.GangMember = tr.EmpCode
WHERE tr.TrxDate >= ? 
  AND tr.TrxDate < ?
  AND tr.OT = 0
  AND {condition_sql}
GROUP BY tr.EmpCode
```

### Gang-Level Payroll Data Extraction
The `ThreadedDataExtractor` class uses gang codes to:
1. Filter employee data by gang/division
2. Extract payroll information for specific gangs
3. Calculate attendance, premi, cuti, and other metrics at gang level

## Authentication and Authorization

### Access Control by Division
- User tokens contain division information
- API endpoints filter gang lists based on user's authorized divisions
- Non-admin users can only access gangs within their assigned divisions

### Locked Divisions
- Some divisions may be "locked" for historical data access
- `/payroll/locked/gangs` endpoint provides access to locked division gangs

## Examples

### Getting Gangs for PG1A Division
```bash
GET /payroll/gangs?division=PG1A
```
Returns gangs like: A1H, A2H, A1M, A1T, etc.

### Getting All Available Divisions
```bash
GET /payroll/divisions
```
Returns: ["PG1A", "PG1B", "PG2A", "PG2B", "ARA", "ARB1", "ARB2", "DME", "INFRA", "AREC", "IJL", "STF-OFFICE", "SECURITY"]

### Searching Gangs
```bash
GET /payroll/gangs?search=H1
```
Returns gangs that match "H1" in code or description.

## Security Considerations

1. **Data Isolation**: Users can only access gangs in their authorized divisions
2. **Prefix Validation**: Gang codes are validated against known division prefixes
3. **Database Access**: All queries go through secure database connections with proper parameterization
4. **Token Validation**: All requests require valid authentication tokens with appropriate permissions

## Column Structure and Method Details

### Method Called for Column Structure
The method responsible for generating the column structure when accessing payroll data is:

**Method**: `get_column_definitions()` in `backend/app/services/header_service.py`

### Location and Path
- **File**: `backend/app/services/header_service.py`
- **API Endpoint**: `/payroll/columns` (defined in `backend/app/api/payroll.py`)
- **Method**: `get_column_definitions()` starting at line 431

### Column Structure Definition
The method generates a hierarchical column structure with the following main sections:

1. **IDENTITAS**
   - NO (no)
   - L/P (jenis_kelamin)
   - NAMA (nama)
   - NIK (nik)

2. **ABSENSI** (3-level structure)
   - KEHADIRAN → Hari (hari_kerja)
   - KETIDAKHADIRAN → CUTI TAHUNAN, SAKIT + HAID, MINGGU, NASIONAL
   - JUMLAH HK → Jumlah (jumlah_hk)

3. **UPAH DASAR**
   - UPAH DASAR (upah_dasar)
   - UPAH POKOK (upah_pokok)
   - GAJI POKOK (gaji_pokok)

4. **TUNJANGAN**
   - BERAS (RATE & JUMLAH)
   - JABATAN (RATE & JUMLAH)
   - MASA KERJA (LAMA & JUMLAH)
   - LEMBUR (JAM & JUMLAH)
   - TOTAL TUNJANGAN

5. **PREMI** (Dynamic Section)
   - BRONDOL (static)
   - Dynamic premium columns (from database transactions)
   - TOTAL PREMI (calculated sum)
   - POTONGAN UPAH KOTOR (with KOREKSI and dynamic deductions)
   - UPAH KOTOR

6. **POTONGAN** (Deductions)
   - CARUMAN ASTEK
   - POTONGAN BPJS (KESEHATAN & PENSIUN)
   - IURAN SPSI
   - PPH21
   - Optional deductions (PINJAM, KONTAN, TIKET, ALAT, THR)
   - TOTAL POTONGAN

7. **RINGKASAN**
   - JUMLAH UPAH KOTOR
   - UPAH BERSIH

### How the Method Works
1. **Input Parameters**: month, year, gang_code
2. **Dynamic Header Generation**: Queries the database to get dynamic PREMI and POTONGAN headers
3. **Column Structure Assembly**: Combines static columns with dynamically generated ones
4. **Return**: List of dictionaries representing the column structure for the AG-Grid frontend component

### API Endpoint for Columns
```bash
GET /payroll/columns?month=5&year=2025&gang_code=C1H
```

The endpoint calls `header_service.get_column_definitions()` with the specified parameters and returns the hierarchical column structure suitable for AG-Grid.