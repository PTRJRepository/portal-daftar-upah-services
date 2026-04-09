# Laporan Operasional - Diagram Dokumentasi

## Overview

**Laporan Operasional** adalah halaman utama di Plantware Daftar Upah PT Rebinmas untuk melihat data upah karyawan per gang dalam format tabel interaktif (AG Grid).

## Diagram Files

| File | Tipe | Deskripsi |
|------|------|-----------|
| `operasional_flow.excalidraw` | Flow Chart | Visualisasi alur data vertikal |
| `operasional_sequence.excalidraw` | Sequence Diagram | Urutan interaksi detail antar komponen |

---

## Alur Sequence (Detail)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  👤 PENGGUNA                                                                   │
│                                                                                │
│  Step 1: Pilih divisi dari dropdown (PG1A, AB1, ARA, dll)                      │
│  Step 2: Pilih gang dari dropdown (H1H, H2H, dll)                             │
│  Step 3: Klik tombol "TAMPILKAN DATA UPAH"                                    │
└─────────────────────────────────────────┬──────────────────────────────────────┘
                                          │ Klik Button
                                          ▼
┌─────────────────────────────────────────┴──────────────────────────────────────┐
│  🎨 FRONTEND (React + Vite)                                                      │
│                                                                                 │
│  Step 3: handleGenerate() → setLoading(true)                                    │
│  Step 4: Fetch GET /payroll/headers?month=X&year=Y&gang_code=G                  │
│          → Response: { columnDefs: [...] }                                      │
│  Step 5: Fetch GET /payroll/report?month=X&year=Y&gang_code=G                 │
│          → Response: { gangs: [...], headers: [...], meta: {...} }            │
│  Step 6: Configure AG Grid columns + rowData                                   │
│  Step 7: AG Grid render ke DOM                                                  │
└─────────────────────────────────────────┬──────────────────────────────────────┘
                                          │ HTTP Request
                                          ▼
┌─────────────────────────────────────────┴──────────────────────────────────────┐
│  📡 API SERVICE (Axios)                                                         │
│                                                                                 │
│  Step 8: request headers + report data                                          │
│  Step 9: return formatted response ke Frontend                                  │
└─────────────────────────────────────────┬──────────────────────────────────────┘
                                          │ REST API Call
                                          ▼
┌─────────────────────────────────────────┴──────────────────────────────────────┐
│  ⚙️ BACKEND (Bun + Elysia)                                                      │
│                                                                                 │
│  Route: /payroll/headers                                                        │
│  Route: /payroll/report                                                         │
│                                                                                 │
│  Step 10: payrollRoutes.get('/report', ...)                                    │
│  Step 11: dataExtractorService.extractPayrollData(month, year, gangCode)       │
│  Step 12: Extract: employees, attendance, premi, potongan, lembur             │
└─────────────────────────────────────────┬──────────────────────────────────────┘
                                          │ SQL Query
                                          ▼
┌─────────────────────────────────────────┴──────────────────────────────────────┐
│  📦 DATAEXTRACTORSERVICE                                                          │
│                                                                                 │
│  Methods:                                                                        │
│  - getEmployees(): Fetch dari HR_EMPLOYEE, HR_GANGLN, HR_PAYROLL              │
│  - getAttendance(): Fetch dari PR_TASKREGLN (hk, hari_kerja)                   │
│  - getPremi(): Fetch dari PR_ADTRANS WHERE DocDesc LIKE '%PREMI%'             │
│  - getPotongan(): Fetch dari PR_ADTRANS WHERE DocDesc LIKE '%POT%'            │
│  - getLemburDetailsFromCalculator(): Fetch dari PR_TASKREGLN WHERE OT = 1     │
│  - getCuti(): Fetch dari Cuti records                                           │
│                                                                                 │
│  Step 13: Calculate: gaji_pokok, tunjangan, total_premi, total_potongan       │
│  Step 14: Apply filter: skip if effective_work_hk <= 0 AND other_cuti == 0     │
│  Step 15: Return PayrollRow[] dengan dynamic columns                          │
└─────────────────────────────────────────┬──────────────────────────────────────┘
                                          │ POST /v1/query
                                          ▼
┌─────────────────────────────────────────┴──────────────────────────────────────┐
│  🔌 SQL GATEWAY API (Python - localhost:8001)                                    │
│                                                                                 │
│  Request Body:                                                                  │
│  {                                                                              │
│    "sql": "SELECT ... FROM PR_TASKREGLN WHERE ...",                            │
│    "params": [month, year, gangCode],                                          │
│    "server": "SERVER_PROFILE_2",                                               │
│    "database": "db_ptrj"                                                       │
│  }                                                                              │
│                                                                                 │
│  Step 16: ODBC Connection → MSSQL Server                                        │
│  Step 17: Execute parameterized SQL                                             │
│  Step 18: Return JSON rows                                                     │
└─────────────────────────────────────────┬──────────────────────────────────────┘
                                          │ ODBC Query
                                          ▼
┌─────────────────────────────────────────┴──────────────────────────────────────┐
│  💾 MSSQL DATABASES                                                              │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │ 💾 db_ptrj (SERVER_PROFILE_2)                                            │   │
│  │ Tables: PR_TASKREGLN, PR_ADTRANS, PR_TASKCODE, HR_PAYROLL              │   │
│  │ Purpose: Payroll transactions, attendance, premi/potongan             │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │ 💾 VenusHR14 (SERVER_PROFILE_3)                                         │   │
│  │ Tables: HR_EMPLOYEE, HR_GANGLN, HR_PAYROLL                              │   │
│  │ Purpose: Employee master data, gang assignment                          │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │ 💾 extend_db_ptrj (SERVER_PROFILE_1)                                     │   │
│  │ Tables: daftar_upah_aggregation_history                                 │   │
│  │ Purpose: Aggregation history for summary reports                       │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Detail

| Step | Komponen | Aksi | Endpoint/Method |
|------|---------|------|-----------------|
| 1 | Pengguna | Pilih divisi dari dropdown | UI Action |
| 2 | Pengguna | Pilih gang dari dropdown | UI Action |
| 3 | Frontend | Klik "TAMPILKAN DATA UPAH" | handleGenerate() |
| 4 | Frontend | Fetch dynamic headers | GET /payroll/headers |
| 5 | Frontend | Fetch payroll report data | GET /payroll/report |
| 6 | Frontend | Configure AG Grid columns | setColumnDefs() |
| 7 | Frontend | Render AG Grid | React render |
| 8 | Backend | Route handler | /payroll/report |
| 9 | Backend | Call DataExtractorService | extractPayrollData() |
| 10 | DataExtractor | Query employees | getEmployees() |
| 11 | DataExtractor | Query attendance | getAttendance() |
| 12 | DataExtractor | Query premi | getPremi() |
| 13 | DataExtractor | Query potongan | getPotongan() |
| 14 | DataExtractor | Query lembur | getLemburDetailsFromCalculator() |
| 15 | DataExtractor | Calculate payroll components | PayrollCalculator |
| 16 | DataExtractor | Apply filter (HK > 0) | Filter logic |
| 17 | Backend | Return to Frontend | JSON response |

---

## Data Sources (Query Details)

### 1. Employee Data (VenusHR14)
```sql
SELECT e.EmpCode, e.NIK, e.Name, e.Position,
       g.GangCode, g.Description as GangName,
       p.BerasRate, p.PayRate, p.MasaKerja
FROM HR_EMPLOYEE e
JOIN HR_GANGLN g ON e.EmpCode = g.EmpCode
LEFT JOIN HR_PAYROLL p ON e.EmpCode = p.EmpCode
WHERE g.GangCode = ? AND p.Month = ? AND p.Year = ?
```

### 2. Attendance Data (db_ptrj)
```sql
SELECT EmpCode, TrxDate, SUM(Hours) as TotalHours,
       COUNT(DISTINCT TrxDate) as Days
FROM PR_TASKREGLN
WHERE TrxDate >= ? AND TrxDate <= ?
GROUP BY EmpCode
```

### 3. Premi Data (db_ptrj)
```sql
SELECT EmpCode, DocDesc, SUM(Amount) as Total
FROM PR_ADTRANS
WHERE DocDesc LIKE '%PREMI%'
  AND TrxDate >= ? AND TrxDate <= ?
GROUP BY EmpCode, DocDesc
```

### 4. Potongan Data (db_ptrj)
```sql
SELECT EmpCode, DocDesc, SUM(Amount) as Total
FROM PR_ADTRANS
WHERE DocDesc NOT LIKE '%PREMI%'
  AND TrxDate >= ? AND TrxDate <= ?
GROUP BY EmpCode, DocDesc
```

### 5. Lembur Data (db_ptrj - OT=1 only)
```sql
SELECT l.EmpCode, l.TrxDate, l.Hours, l.Rate, l.Amount,
       t.TaskCode, t.Description as TaskDesc
FROM PR_TASKREGLN l
JOIN PR_TASKCODE t ON l.TaskCode = t.TaskCode
WHERE l.OT = 1
  AND l.TrxDate >= ? AND l.TrxDate <= ?
```

---

## Filter Logic (CRITICAL)

```typescript
// Effective Work HK = HK - (Minggu + Libur Nasional)
const effective_work_hk = hk - (empCuti.cuti_minggu + empCuti.cuti_nasional);

// Cuti lain (tahunan, sakit/haid)
const other_cuti = empCuti.cuti_tahunan + empCuti.cuti_sakit_haid;

// FILTER LOGIC:
// - effective_work_hk <= 0 AND other_cuti == 0 → EXCLUDED
// - effective_work_hk <= 0 BUT other_cuti > 0 → INCLUDED
// - effective_work_hk > 0 → Always INCLUDED
if (effective_work_hk <= 0 && other_cuti == 0) {
  continue; // Skip this employee
}
```

---

## Dynamic Headers

Headers di-generate berdasarkan data actual:

```typescript
// Frontend fetch headers first
const response = await fetch(`/payroll/headers?month=12&year=2025&gang_code=H1H`);
const { columnDefs } = await response.json();

// columnDefs structure:
[
  { headerName: 'Informasi Karyawan', children: [...] },
  { headerName: 'Absensi', children: [...] },
  { headerName: 'Gaji Pokok', children: [...] },
  { headerName: 'Tunjangan', children: [...] },
  { headerName: 'Premi', children: [...] },  // Dynamic dari data actual
  { headerName: 'Potongan', children: [...] }, // Dynamic dari data actual
  { headerName: 'Total', children: [...] }
]
```

---

## Response Structure

```typescript
// GET /payroll/report?month=12&year=2025&gang_code=H1H

interface PayrollReportResponse {
  gangs: [
    {
      gang_code: "H1H",
      gang_name: "Harvest Group 1",
      employees: [
        {
          no: 1,
          nik: "1234567890",
          nama: "BUDI SANTOSO",
          jabatan: "Karyawan",
          jumlah_hk: 25,
          hari_kerja: 25,
          gaji_pokok: 3500000,
          tunjangan: {
            beras: 150000,
            jabatan: 500000,
            masa_kerja: 200000
          },
          premi: {
            premi_brondol: 500000,
            premi_panen_al: 300000
          },
          potongan: {
            astek: 35000,
            bpjs: 55000,
            spsi: 4000
          },
          upah_bersih: 4250000,
          lembur_records: [
            { trx_date: "2025-12-05", task_desc: "PANEN MANUAL", hours: 4, amount: 120000 }
          ]
        }
      ],
      totals: {
        jumlah_karyawan: 25,
        total_hk: 625,
        total_upah_bersih: 106250000
      }
    }
  ],
  headers: [...], // Dynamic column definitions
  meta: {
    month: 12,
    year: 2025,
    division: "PG1A",
    generated_at: "2025-12-15T10:30:00Z"
  }
}
```

---

## Database Connection Rules

| Profile | Database | Usage |
|---------|----------|-------|
| `SERVER_PROFILE_1` | `extend_db_ptrj` | Aggregation history, analysis reports |
| `SERVER_PROFILE_2` | `db_ptrj` | Main payroll data (default for queries) |
| `SERVER_PROFILE_3` | `VenusHR14` | Employee master data |

**Note:** Laporan Operasional menggunakan `SERVER_PROFILE_2` (db_ptrj) untuk main payroll queries.

---

## Cara Membuka di Excalidraw

1. Buka https://excalidraw.com
2. Klik **"Import"** atau drag file `.excalidraw` ke browser
3. Diagram akan terbuka dan bisa di-edit

---

## Tags

- `payroll`
- `operasional`
- `daftar-upah`
- `sequence-diagram`
- `flow-chart`
