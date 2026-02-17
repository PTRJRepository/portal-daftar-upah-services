# Flow Data - Payroll Daftar Upah

## Overview

Dokumen ini menjelaskan aliran data dari database hingga ditampilkan di frontend. Memahami flow data sangat penting untuk debugging dan pengembangan fitur baru.

---

## 1. Flow Data Utama

### Diagram Aliran Data

```
+-------------+     +-------------+     +-------------+     +-------------+
|  MSSQL      |---->| SQL Gateway |---->|   Backend   |---->|  Frontend   |
|  Database   |     |   (Python)  |     |   (Bun)     |     |  (React)    |
+-------------+     +-------------+     +-------------+     +-------------+
      |                   |                   |                   |
      v                   v                   v                   v
   Tables            API Query           Services            Components
   - HR_EMP          - /v1/query         - dataExtractor     - Pages
   - PR_TASKREGLN                        - payrollService    - AG Grid
   - PR_ADTRANS                           - lemburCalculator  - Charts
```

---

## 2. Flow Data Payroll Report

### Sequence Diagram

```
User                Frontend             Backend              SQL Gateway         Database
  |                     |                    |                     |                  |
  |-- Select Division ->|                    |                     |                  |
  |-- Select Period --->|                    |                     |                  |
  |-- Click Load ------>|                    |                     |                  |
  |                     |-- GET /payroll/ --->|                     |                  |
  |                     |   report/division-  |                     |                  |
  |                     |   raw-tree          |                     |                  |
  |                     |                    |-- POST /v1/query --->|                  |
  |                     |                    |   {sql, params}      |-- Execute SQL -->|
  |                     |                    |                     |<-- Result Set ----|
  |                     |                    |<-- JSON Response ----|                  |
  |                     |                    |                     |                  |
  |                     |                    |-- Process Data       |                  |
  |                     |                    |-- Calculate Totals  |                  |
  |                     |<-- JSON Response --|                     |                  |
  |                     |                    |                     |                  |
  |<-- Display Table ---|                    |                     |                  |
  |                     |                    |                     |                  |
```

### Step-by-Step

1. **User Action**: User memilih divisi, bulan, tahun, dan klik "Load"
2. **API Call**: Frontend memanggil `GET /payroll/report/division-raw-tree`
3. **Backend Processing**:
   - Validasi token
   - Panggil `dataExtractorService.extractPayrollData()`
   - Query database untuk data karyawan
   - Query database untuk absensi
   - Query database untuk tunjangan/potongan
   - Kalkulasi lembur
   - Kalkulasi PPH21
   - Hitung total
4. **Response**: Return JSON dengan struktur gangs[], employees[], totals
5. **Frontend Display**: Render data di AG Grid

---

## 3. Flow Data Extraction (dataExtractorService)

### Proses Ekstraksi Data

```typescript
async extractPayrollData(month, year, gangCode, divisionCode) {
    // Step 1: Get Employees
    const employees = await this.getEmployees(divisionCode);
    
    // Step 2: Get Attendance (HK)
    const attendance = await this.getAttendance(month, year);
    
    // Step 3: Get Leave Types (Cuti)
    const cuti = await this.getCuti(month, year);
    
    // Step 4: Get Allowances (Tunjangan)
    const tunjangan = await this.getTunjangan(month, year);
    
    // Step 5: Get Overtime (Lembur)
    const lembur = await lemburCalculator.calculateBatch(empCodes, month, year);
    
    // Step 6: Get Premiums (Premi)
    const premi = await this.getPremi(month, year);
    
    // Step 7: Get Deductions (Potongan)
    const potongan = await this.getPotongan(month, year);
    
    // Step 8: Calculate PPH21
    const pph21 = pph21TerService.calculate(emp);
    
    // Step 9: Calculate Totals
    const payroll = this.calculatePayroll(employee, attendance, tunjangan, premi, potongan);
    
    // Step 10: Filter & Return
    return this.filterAndFormat(payroll);
}
```

### Data Sources per Field

| Field | Source Table | Query/Calculation |
|-------|--------------|-------------------|
| nik | HR_EMPLOYEE | EmpCode |
| nama | HR_EMPLOYEE | EmpName |
| gang_code | HR_GANGLN | GangCode |
| jumlah_hk | PR_TASKREGLN | COUNT(DISTINCT TrxDate) WHERE OT=0 |
| gaji_pokok | HR_PAYROLL | pay_rate × jumlah_hk |
| lembur_jumlah | PR_TASKREGLN | lemburCalculator.calculate() |
| premi_* | PR_ADTRANS | SUM(Amount) WHERE DocDesc LIKE 'PREMI%' |
| potongan_* | PR_ADTRANS | SUM(Amount) WHERE DocDesc LIKE 'POT%' |
| pph21 | Calculated | TER rate × Penghasilan Bruto |
| upah_bersih | Calculated | gaji_pokok + tunjangan + premi + lembur - potongan |

---

## 4. Flow Kalkulasi Lembur

### Proses Kalkulasi

```
1. Get Overtime Transactions
   PR_TASKREGLN WHERE OT = 1
   
2. Classify Day Type
   - WORKDAY_LONG (Senin-Kamis, Sabtu)
   - WORKDAY_SHORT (Jumat)
   - SUNDAY (Minggu)
   - HOLIDAY_REGULAR (Libur Umum)
   - HOLIDAY_RELIGIOUS (Libur Keagamaan)
   
3. Calculate UPJ
   UPJ = (pay_rate × 30) / 173
   atau dari env LEMBUR_UPJ
   
4. Calculate Tier Amounts
   Tier 1: hours × UPJ × tier1_rate
   Tier 2: hours × UPJ × tier2_rate
   Tier 3: hours × UPJ × tier3_rate
   
5. Sum Total
   total = tier1_amount + tier2_amount + tier3_amount
```

### Tier Rates

| Day Type | Tier 1 | Tier 2 | Tier 3 | Boundary |
|----------|--------|--------|--------|----------|
| WORKDAY_LONG | 1.5x | 2x | - | 1 hour |
| WORKDAY_SHORT | 1.5x | 2x | - | 1 hour |
| SUNDAY | 2x | 3x | 4x | 5/7 hours |
| HOLIDAY_REGULAR | 2x | 3x | 4x | 5/7 hours |
| HOLIDAY_RELIGIOUS | 3x | 4x | 4x | 5/7 hours |

---

## 5. Flow Kalkulasi PPH21

### Proses Kalkulasi

```
1. Determine PTKP Status
   dari RiceRation di HR_PAYROLL
   
2. Map to TER Category
   - TER A (5%): TK/0, TK/1, K/0
   - TER B (15%): TK/2, K/1, K/2
   - TER C (25%): K/3
   
3. Calculate Penghasilan Bruto
   bruto = gaji_pokok + tunjangan + premi + lembur
   
4. Calculate PPH21
   pph21 = bruto × TER_rate
```

### PTKP Mapping

| RiceRation | PTKP | TER Category | Rate |
|------------|------|--------------|------|
| 2250 | TK/0 | A | 5% |
| 3250 | TK/1 | A | 5% |
| 4200 | TK/2 | B | 15% |
| 3750 | K/0 | A | 5% |
| 4650 | K/1 | B | 15% |
| 5550 | K/2 | B | 15% |
| 6450 | K/3 | C | 25% |

---

## 6. Flow Data Frontend

### Data Flow di Frontend

```
1. User Action (Component)
   |
   v
2. Service Call (payrollService.js)
   |
   v
3. API Request (axios)
   |
   v
4. Response Processing
   |
   v
5. State Update (useState/useContext)
   |
   v
6. Re-render Component
   |
   v
7. Display Data (AG Grid)
```

### Contoh: PayrollAnalysisPage

```jsx
function PayrollAnalysisPage() {
  const [data, setData] = useState(null);
  const { division, month, year } = useReport();
  
  // Step 1: Fetch data when params change
  useEffect(() => {
    async function fetchData() {
      // Step 2: Call service
      const result = await payrollService.getDivisionRawTree(division, month, year);
      // Step 3: Update state
      setData(result);
    }
    fetchData();
  }, [division, month, year]);
  
  // Step 4: Process data for display
  const employees = useMemo(() => {
    if (!data) return [];
    return data.gangs.flatMap(g => g.employees);
  }, [data]);
  
  // Step 5: Render
  return (
    <div>
      <CustomPayrollTable data={employees} />
    </div>
  );
}
```

---

## 7. Flow Export Data

### Export ke Excel

```
1. User Click "Export Excel"
   |
   v
2. Get Data from AG Grid API
   gridApi.getDataAsExcel()
   |
   v
3. Process with ExcelJS
   - Create workbook
   - Add headers
   - Add data rows
   - Apply formatting
   |
   v
4. Generate Blob
   workbook.xlsx.writeBuffer()
   |
   v
5. Download File
   saveAs(blob, 'payroll.xlsx')
```

### Export ke Google Spreadsheet

```
1. User Click "Sync to Spreadsheet"
   |
   v
2. Frontend Call Backend
   POST /spreadsheet/sync
   |
   v
3. Backend Prepare Data
   - Format sheet data
   - Build headers
   - Calculate totals
   |
   v
4. Backend Call Apps Script
   POST to Google Apps Script Web App
   |
   v
5. Apps Script Create Sheet
   - Create new sheet
   - Add data
   - Add charts
   - Set permissions
   |
   v
6. Return Spreadsheet URL
   |
   v
7. Frontend Display Link
```

---

## 8. Flow Authentication

### Login Flow

```
1. User Enter Credentials
   |
   v
2. Frontend POST /auth/login
   |
   v
3. Backend Verify Credentials
   - Query user table
   - Compare password hash
   |
   v
4. Generate JWT Token
   - Sign with RS256
   - Set expiration
   |
   v
5. Return Token + User Info
   |
   v
6. Frontend Store Token
   - Save to Cookie
   - Set AuthContext
   |
   v
7. Redirect to Dashboard
```

### Request with Token

```
1. Component Make API Call
   |
   v
2. Axios Interceptor Add Token
   headers.Authorization = 'Bearer ' + token
   |
   v
3. Backend Verify Token
   - Extract user from token
   - Check expiration
   - Validate role
   |
   v
4. Process Request
   |
   v
5. Return Response
```

---

## 9. Flow Caching

### Cache Strategy

```
Request
   |
   v
+-------------+
| Check Cache |
+-------------+
   |       |
   | Hit   | Miss
   v       v
+-----+  +-------------+
|Return|  | Fetch from |
|Cache |  | Database   |
+-----+  +-------------+
              |
              v
         +-------------+
         | Store Cache |
         +-------------+
              |
              v
         +-------------+
         | Return Data |
         +-------------+
```

### Cache Key Pattern

```typescript
const cacheKey = `payroll_${division}_${month}_${year}`;
```

### Cache Invalidation

- Manual: `cacheService.clear()`
- TTL-based: Expire after 5 minutes
- On data change: Clear related keys

---

## 10. Flow Error Handling

### Error Propagation

```
Database Error
   |
   v
SQL Gateway Returns Error
   |
   v
Backend Service Catches Error
   |
   v
Log Error
   |
   v
Return HTTP Error Response
   |
   v
Frontend Service Catches Error
   |
   v
Display Error Message
```

### Error Response Format

```json
{
  "message": "Failed to fetch data: Connection timeout",
  "error": "ConnectionError"
}
```

### Frontend Error Handling

```jsx
try {
  const data = await payrollService.getData();
  setData(data);
} catch (error) {
  console.error('[Page] Error:', error);
  setError(error.message);
  // Show error toast/alert
}
```

---

## 11. Data Transformation Pipeline

### Raw Data to PayrollRow

```
Raw Data from DB:
{
  EmpCode: "001",
  EmpName: "John",
  Hours: 8,
  Amount: 100000
}

   |
   v

Transform:
- Map column names
- Calculate derived fields
- Format values
- Add metadata

   |
   v

PayrollRow:
{
  nik: "001",
  nama: "John",
  jumlah_hk: 25,
  gaji_pokok: 5000000,
  lembur_jumlah: 500000,
  upah_bersih: 4500000
}
```

---

## 12. Real-time Data Flow (Future)

### WebSocket Flow (Planned)

```
Database Change
   |
   v
SQL Gateway Detects Change
   |
   v
WebSocket Message to Backend
   |
   v
Backend Push to Frontend
   |
   v
Frontend Update UI
```

---

## 13. Debugging Data Flow

### Cara Debug

1. **Backend Logging**
   ```typescript
   console.log('[Service] Processing:', params);
   console.log('[DEBUG] Result:', JSON.stringify(result, null, 2));
   ```

2. **SQL Query Logging**
   - Check SQL Gateway logs
   - Verify query execution

3. **Frontend Logging**
   ```javascript
   console.log('[Component] Data:', data);
   console.log('[Service] Response:', response);
   ```

4. **Network Tab**
   - Check request/response in browser DevTools
   - Verify payload and status codes

---

**Selanjutnya:** Baca [08_CARA_ANALISIS.md](./08_CARA_ANALISIS.md) untuk mempelajari cara menganalisis kode.