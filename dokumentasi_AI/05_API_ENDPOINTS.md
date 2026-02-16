# API Endpoints Documentation

## Overview

Backend menggunakan Elysia.js dengan TypeScript. Semua endpoint memerlukan autentikasi JWT kecuali endpoint yang ditandai sebagai "Public".

**Base URL:** `http://localhost:8002` (development) atau via proxy `/backend/upah`

**Authentication:** Bearer Token di header `Authorization`

---

## Authentication Endpoints

### POST /auth/login

Login dan mendapatkan JWT token.

**Request:**
```json
{
    "username": "admin",
    "password": "password123"
}
```

**Response:**
```json
{
    "success": true,
    "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
        "id": 1,
        "username": "admin",
        "role": "ADMIN",
        "divisions": ["ALL"]
    }
}
```

### GET /auth/me

Mendapatkan info user yang sedang login.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
    "id": 1,
    "username": "admin",
    "role": "ADMIN",
    "divisions": ["ALL"]
}
```

---

## Division & Gang Endpoints

### GET /payroll/divisions

Mendapatkan daftar semua divisi.

**Response:**
```json
[
    { "code": "AB1", "name": "AB1 - Divisi 1" },
    { "code": "AB2", "name": "AB2 - Divisi 2" }
]
```

### GET /payroll/subdivisions

Mendapatkan daftar sub-divisi.

**Response:**
```json
[
    { "code": "AB1-A", "name": "AB1 - Sub Divisi A" }
]
```

### GET /payroll/gangs

Mendapatkan daftar gang berdasarkan divisi.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| division | string | No | Kode divisi (default: ALL) |
| search | string | No | Pencarian nama gang |

**Response:**
```json
[
    {
        "gang_code": "H1H",
        "description": "Harvester 1H",
        "loc_code": "AB1",
        "employee_count": 25
    }
]
```

### GET /payroll/gang/:gang_code/info

Mendapatkan info detail gang.

**Response:**
```json
{
    "gang_code": "H1H",
    "description": "Harvester 1H",
    "loc_code": "AB1",
    "employee_count": 25,
    "total_upah": 150000000
}
```

---

## Payroll Data Endpoints

### GET /payroll/headers

Mendapatkan definisi kolom untuk AG Grid.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| month | string | No | Bulan (1-12) |
| year | string | No | Tahun |
| gang_code | string | No | Kode gang |

**Response:**
```json
{
    "columnDefs": [
        {
            "headerName": "INFORMASI KARYAWAN",
            "children": [
                { "field": "nik", "headerName": "NIK" },
                { "field": "nama", "headerName": "NAMA" }
            ]
        }
    ]
}
```

### GET /payroll/columns

Mendapatkan definisi kolom lengkap dengan formatting.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| month | string | No | Bulan (1-12) |
| year | string | No | Tahun |
| gang_code | string | No | Kode gang |
| fallback | string | No | Fallback gang jika data kosong |

**Response:**
```json
{
    "columns": [
        {
            "field": "nik",
            "headerName": "NIK",
            "width": 100,
            "pinned": "left"
        }
    ]
}
```

### GET /payroll/report

Mendapatkan data payroll per gang.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| gang_code | string | Yes | Kode gang |
| month | string | Yes | Bulan (1-12) |
| year | string | Yes | Tahun |

**Response:**
```json
{
    "gang_code": "H1H",
    "month": 12,
    "year": 2025,
    "employees": [
        {
            "nik": "001",
            "nama": "John Doe",
            "jumlah_hk": 25,
            "gaji_pokok": 5000000,
            "upah_bersih": 4500000
        }
    ],
    "totals": {
        "employee_count": 25,
        "total_upah": 150000000
    }
}
```

### GET /payroll/report/division-raw-tree

Mendapatkan data payroll lengkap per divisi dengan struktur tree.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| division_code | string | Yes | Kode divisi |
| month | string | Yes | Bulan (1-12) |
| year | string | Yes | Tahun |

**Response:**
```json
{
    "division": "AB1",
    "month": 12,
    "year": 2025,
    "gangs": [
        {
            "gang_code": "H1H",
            "employees": [...],
            "gang_totals": {
                "employee_count": 25,
                "total_upah": 150000000
            }
        }
    ],
    "grand_total": {
        "employee_count": 100,
        "total_upah": 600000000
    },
    "dynamic_premi_headers": ["PREMI_A", "PREMI_B"],
    "dynamic_potongan_headers": ["POTONGAN_X"]
}
```

---

## Employee Endpoints

### GET /payroll/employee/:emp_code

Mendapatkan detail karyawan.

**Response:**
```json
{
    "emp_code": "001",
    "emp_name": "John Doe",
    "gender": "L",
    "gang_code": "H1H",
    "pay_rate": 200000,
    "join_date": "2020-01-15"
}
```

### GET /payroll/employee/:emp_code/detail

Mendapatkan detail payroll karyawan untuk periode tertentu.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| month | string | Yes | Bulan (1-12) |
| year | string | Yes | Tahun |

**Response:**
```json
{
    "employee": {
        "nik": "001",
        "nama": "John Doe"
    },
    "payroll": {
        "jumlah_hk": 25,
        "gaji_pokok": 5000000,
        "lembur_records": [
            {
                "trx_date": "2025-12-05",
                "task_desc": "PANEN MANUAL",
                "hours": 3,
                "amount": 150000
            }
        ]
    }
}
```

---

## Summary & Analysis Endpoints

### GET /summary/division

Mendapatkan summary per divisi.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| month | string | Yes | Bulan (1-12) |
| year | string | Yes | Tahun |
| division | string | No | Kode divisi (default: ALL) |

**Response:**
```json
{
    "month": 12,
    "year": 2025,
    "divisions": [
        {
            "code": "AB1",
            "employee_count": 100,
            "total_hk": 2500,
            "total_upah": 500000000
        }
    ]
}
```

### GET /summary/analysis-report

Mendapatkan laporan analisis.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| month | string | Yes | Bulan (1-12) |
| year | string | Yes | Tahun |
| division | string | No | Kode divisi |

**Response:**
```json
{
    "period": { "month": 12, "year": 2025 },
    "analysis": {
        "total_employees": 500,
        "total_upah": 2500000000,
        "avg_upah_per_employee": 5000000,
        "lembur_breakdown": [...],
        "premi_breakdown": [...]
    }
}
```

---

## Aggregation Endpoints

### POST /api/aggregation/seed

Trigger seeding data agregasi.

**Request:**
```json
{
    "division": "AB1",
    "month": 12,
    "year": 2025
}
```

**Response:**
```json
{
    "success": true,
    "message": "Aggregation seeded successfully",
    "records_processed": 150
}
```

### GET /api/aggregation/status

Mendapatkan status agregasi.

**Response:**
```json
{
    "status": "completed",
    "last_run": "2025-12-15T10:30:00Z",
    "records_processed": 1500
}
```

### GET /api/aggregation/history

Mendapatkan riwayat agregasi.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| division | string | No | Kode divisi |
| month | string | No | Bulan |
| year | string | No | Tahun |

**Response:**
```json
{
    "history": [
        {
            "id": 1,
            "division": "AB1",
            "month": 12,
            "year": 2025,
            "total_upah": 500000000,
            "created_at": "2025-12-15T10:30:00Z"
        }
    ]
}
```

---

## Dashboard Endpoints

### GET /dashboard/kpi

Mendapatkan KPI untuk dashboard.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| month | string | No | Bulan (default: current) |
| year | string | No | Tahun (default: current) |

**Response:**
```json
{
    "total_employees": 500,
    "total_hk": 12500,
    "total_upah": 2500000000,
    "avg_upah_per_hk": 200000
}
```

### GET /dashboard/gang-comparison

Mendapatkan data perbandingan antar gang.

**Response:**
```json
{
    "gangs": [
        {
            "gang_code": "H1H",
            "employee_count": 25,
            "total_upah": 150000000,
            "avg_upah": 6000000
        }
    ]
}
```

---

## Spreadsheet Sync Endpoints

### POST /spreadsheet/sync

Sinkronisasi data ke Google Spreadsheet.

**Request:**
```json
{
    "division": "AB1",
    "month": 12,
    "year": 2025,
    "sync_type": "DAFTAR_UPAH"
}
```

**Response:**
```json
{
    "success": true,
    "spreadsheet_url": "https://docs.google.com/spreadsheets/d/...",
    "sheets_created": ["AB1", "AB1 - ANALISIS"]
}
```

---

## History Endpoints

### GET /history/periods

Mendapatkan daftar periode yang tersedia.

**Response:**
```json
{
    "periods": [
        { "month": 12, "year": 2025, "division_count": 5 },
        { "month": 11, "year": 2025, "division_count": 5 }
    ]
}
```

### GET /history/comparison

Mendapatkan data perbandingan antar periode.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| month1 | string | Yes | Bulan periode 1 |
| year1 | string | Yes | Tahun periode 1 |
| month2 | string | Yes | Bulan periode 2 |
| year2 | string | Yes | Tahun periode 2 |
| division | string | No | Kode divisi |

**Response:**
```json
{
    "period1": {
        "total_upah": 500000000,
        "employee_count": 100
    },
    "period2": {
        "total_upah": 520000000,
        "employee_count": 102
    },
    "changes": {
        "upah_change": 4.0,
        "employee_change": 2.0
    }
}
```

---

## Calculation Endpoints

### POST /payroll/calculate

Kalkulasi payroll manual.

**Request:**
```json
{
    "upah_dasar": 5000000,
    "hk_count": 25,
    "allowances": {
        "beras": 500000,
        "jabatan": 300000
    },
    "deductions": {
        "bpjs": 200000,
        "pph21": 150000
    }
}
```

**Response:**
```json
{
    "upah_kotor": 6300000,
    "total_deductions": 350000,
    "upah_bersih": 5950000
}
```

### GET /payroll/bpjs-calculate

Kalkulasi komponen BPJS.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| masa_kerja_jumlah | string | No | Tunjangan masa kerja |

**Response:**
```json
{
    "bpjs_kesehatan_pekerja": 50000,
    "bpjs_kesehatan_majikan": 25000,
    "bpjs_pensiun_pekerja": 30000,
    "bpjs_pensiun_majikan": 15000,
    "total_bpjs_pekerja": 80000
}
```

---

## Utility Endpoints

### GET /health

Health check endpoint (Public).

**Response:**
```json
{
    "status": "ok",
    "timestamp": "2025-12-15T10:30:00Z",
    "database": "db_ptrj",
    "profile": "SERVER_PROFILE_2"
}
```

### GET /api-info

Informasi API (Public).

**Response:**
```json
{
    "message": "Payroll Backend (Bun/Elysia) is running",
    "version": "2.0.0",
    "mode": "prod"
}
```

### GET /payroll/current-period

Mendapatkan periode payroll saat ini.

**Response:**
```json
{
    "month": 12,
    "year": 2025,
    "period_name": "Desember 2025"
}
```

---

## Error Responses

### 400 Bad Request
```json
{
    "error": "division_code, month, and year are required"
}
```

### 401 Unauthorized
```json
{
    "message": "Unauthorized"
}
```

### 403 Forbidden
```json
{
    "message": "Division not accessible"
}
```

### 404 Not Found
```json
{
    "message": "No gangs found for locCode AB1"
}
```

### 500 Internal Server Error
```json
{
    "message": "Failed to fetch gangs: Connection timeout"
}
```

---

## Rate Limiting

Tidak ada rate limiting yang diimplementasikan secara eksplisit, namun database query timeout diatur melalui environment variable:
- `DB_CONN_TIMEOUT=60` (detik)
- `DB_QUERY_TIMEOUT=30` (detik)

---

## CORS Configuration

```javascript
{
    origin: true,  // Reflects request origin
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "x-api-key"],
    exposeHeaders: ["X-Total-Count", "X-Execution-Time-Ms"],
    credentials: true
}
```

---

## Request/Response Headers

### Request Headers
| Header | Required | Description |
|--------|----------|-------------|
| Authorization | Yes* | Bearer token untuk autentikasi |
| Content-Type | Yes** | application/json untuk POST/PUT |
| x-api-key | No | API key untuk SQL Gateway |

* Kecuali endpoint public
** Untuk request body

### Response Headers
| Header | Description |
|--------|-------------|
| Content-Type | application/json |
| X-Total-Count | Total records untuk pagination |
| X-Execution-Time-Ms | Waktu eksekusi request |

---

*Dokumentasi ini dibuat secara otomatis berdasarkan analisis kode API*