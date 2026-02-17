# 06. API Endpoints - Payroll Daftar Upah

## 🎯 Tujuan Dokumentasi Ini

Memberikan daftar lengkap semua API endpoints yang tersedia di sistem Payroll Daftar Upah.

---

## 🌐 Base URL

### Development
```
http://localhost:8002
```

### Production
```
https://api.rebinmas.com
```

### Proxy Mode (with reverse proxy)
```
https://rebinmas.com/backend/upah
```

---

## 🔐 Authentication

### Headers
```json
{
    "Authorization": "Bearer {JWT_TOKEN}",
    "Content-Type": "application/json"
}
```

### JWT Token Structure
```json
{
    "sub": 1,
    "username": "admin",
    "role": "ADMIN",
    "divisions": ["AB1", "AB2", "IJL"],
    "iat": 1234567890,
    "exp": 1234570490
}
```

---

## 📋 API Endpoints List

### Auth Endpoints

#### `POST /auth/login`
Login ke sistem.

**Request Body:**
```json
{
    "username": "admin",
    "password": "password"
}
```

**Response (200):**
```json
{
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "token_type": "bearer",
    "user": {
        "id": 1,
        "username": "admin",
        "role": "ADMIN",
        "divisions": ["AB1", "AB2", "IJL"]
    }
}
```

**Error (401):**
```json
{
    "error": "Invalid credentials"
}
```

---

### Payroll Endpoints

#### `GET /payroll/divisions`
Get semua divisi yang tersedia.

**Authentication:** Required

**Response (200):**
```json
{
    "divisions": [
        { "code": "AB1", "name": "ABANG SIRAH", "company": "REBINMAS" },
        { "code": "AB2", "name": "ABANG SIRAH 2", "company": "REBINMAS" },
        { "code": "IJL", "name": "IJL", "company": "IJL" }
    ]
}
```

---

#### `GET /payroll/gangs?division={divisionCode}`
Get daftar gang berdasarkan divisi.

**Authentication:** Required

**Query Parameters:**
- `division` (string) - Kode divisi

**Response (200):**
```json
{
    "gangs": [
        { "code": "H1H", "name": "H1H", "division": "AB1" },
        { "code": "H1I", "name": "H1I", "division": "AB1" }
    ]
}
```

---

#### `GET /payroll/headers?month={month}&year={year}&gang_code={gangCode}`
Get column definitions untuk AG Grid.

**Authentication:** Required

**Query Parameters:**
- `month` (number) - Bulan (1-12)
- `year` (number) - Tahun
- `gang_code` (string, optional) - Kode gang

**Response (200):**
```json
{
    "columnDefs": [
        {
            "field": "nik",
            "headerName": "NIK",
            "pinned": "left",
            "width": 120
        },
        {
            "field": "nama",
            "headerName": "Nama",
            "pinned": "left",
            "width": 200
        }
        // ... more columns
    ]
}
```

---

#### `GET /payroll/report?month={month}&year={year}&gang_code={gangCode}`
Get data payroll untuk gang tertentu.

**Authentication:** Required

**Query Parameters:**
- `month` (number) - Bulan (1-12)
- `year` (number) - Tahun
- `gang_code` (string) - Kode gang

**Response (200):**
```json
{
    "success": true,
    "data": [
        {
            "nik": "1234567890",
            "nama": "EMPLOYEE NAME",
            "jabatan": "MANDOR",
            "gang_code": "H1H",
            "jumlah_hk": 26,
            "hari_kerja": 26,
            "gaji_pokok": 5000000,
            "beras_jumlah": 150000,
            "jabatan_jumlah": 500000,
            "lembur_jam": 10,
            "lembur_jumlah": 500000,
            "lembur_records": [...],
            "premi_brondol": 0,
            "premi_pruning": 0,
            "astek_jumlah": 100000,
            "bpjs_jumlah": 50000,
            "spsi_jumlah": 10000,
            "pph21_jumlah": 200000,
            "jumlah_upah_kotor": 6150000,
            "upah_bersih": 5790000
        }
        // ... more rows
    ],
    "summary": {
        "total_rows": 100,
        "total_upah_bersih": 579000000,
        "total_hk": 2600
    },
    "dynamic_premi_columns": ["PREMI_PANEN", "PREMI_PUPUK"],
    "dynamic_potongan_columns": ["POTONGAN_KOPERASI"]
}
```

---

#### `GET /payroll/report/division-raw-tree?month={month}&year={year}&division={division}`
Get data payroll untuk seluruh divisi dengan struktur tree.

**Authentication:** Required

**Query Parameters:**
- `month` (number) - Bulan (1-12)
- `year` (number) - Tahun
- `division` (string, optional) - Kode divisi (kosong untuk semua)

**Response (200):**
```json
{
    "success": true,
    "data": {
        "division_code": "AB1",
        "division_name": "ABANG SIRAH",
        "month": 12,
        "year": 2025,
        "gangs": [
            {
                "gang_code": "H1H",
                "gang_name": "H1H",
                "total_employees": 50,
                "total_hk": 1300,
                "total_upah_bersih": 289500000,
                "employees": [...]
            }
        ],
        "totals": {
            "total_employees": 150,
            "total_hk": 3900,
            "total_upah_bersih": 868500000
        }
    }
}
```

---

#### `GET /payroll/locked/report/raw-tree?month={month}&year={year}&division={division}`
Sama seperti di atas tapi dengan permission lebih longgar (public view).

**Authentication:** Optional (relaxed)

---

### Summary Endpoints

#### `GET /summary/division?month={month}&year={year}`
Get summary report per divisi.

**Authentication:** Required

**Response (200):**
```json
{
    "success": true,
    "data": [
        {
            "division_code": "AB1",
            "division_name": "ABANG SIRAH",
            "total_employees": 150,
            "total_hk": 3900,
            "total_lembur_jam": 500,
            "total_lembur_jumlah": 25000000,
            "total_gaji_pokok": 750000000,
            "total_tunjangan": 150000000,
            "total_premi": 50000000,
            "total_potongan": 100000000,
            "total_upah_bersih": 750000000,
            "cost_per_hk": 192307,
            "comparison": {
                "upah_bersih_change": 5.2,
                "hk_change": -2.1
            }
        }
    ]
}
```

---

#### `GET /summary/analysis-report?month={month}&year={year}`
Get analysis report detail.

**Authentication:** Required

**Response (200):**
```json
{
    "success": true,
    "data": {
        "divisions": [...],
        "comparisons": {
            "previous_month": {...},
            "previous_year": {...}
        },
        "breakdown": {
            "by_gang": [...],
            "by_job_title": [...]
        }
    }
}
```

---

### Employee Endpoints

#### `GET /employee/:nik`
Get detail karyawan lengkap.

**Authentication:** Required

**Path Parameters:**
- `nik` (string) - Nomor induk karyawan

**Query Parameters:**
- `month` (number) - Bulan
- `year` (number) - Tahun

**Response (200):**
```json
{
    "success": true,
    "data": {
        "nik": "1234567890",
        "nama": "EMPLOYEE NAME",
        "jabatan": "MANDOR",
        "gang_code": "H1H",
        "join_date": "2020-01-15",
        "employment": {
            "jenis_kelamin": "L",
            "status": "AKTIF"
        },
        "attendance": {
            "jumlah_hk": 26,
            "hari_kerja": 26,
            "cuti": {...}
        },
        "salary": {
            "gaji_pokok": 5000000,
            "tunjangan": {...},
            "premi": {...},
            "potongan": {...},
            "upah_bersih": 5790000
        },
        "lembur": {
            "total_jam": 10,
            "total_jumlah": 500000,
            "records": [...]
        },
        "daily_overtime": [...]
    }
}
```

---

#### `GET /employee/:nik/components`
Get breakdown komponen payroll dengan metadata.

**Authentication:** Required

**Response (200):**
```json
{
    "success": true,
    "data": {
        "gaji_pokok": {
            "value": 5000000,
            "meta": {
                "source": "CALCULATION",
                "description": "Gaji pokok berdasarkan HK × pay rate",
                "calculation_basis": "26 HK × Rp 192.308",
                "confidence_level": "high"
            }
        },
        "lembur_jumlah": {
            "value": 500000,
            "meta": {
                "source": "CALCULATION",
                "description": "Lembur berdasarkan transaksi OT=1",
                "calculation_basis": "10 jam × rate 1.5/2/3x",
                "confidence_level": "high"
            }
        }
        // ... more components
    }
}
```

---

### Dashboard Endpoints

#### `GET /dashboard/kpi?month={month}&year={year}&division={division}`
Get KPI cards untuk dashboard.

**Authentication:** Required

**Response (200):**
```json
{
    "success": true,
    "data": {
        "total_employees": {
            "value": 150,
            "label": "Total Karyawan",
            "change": 5.2,
            "trend": "up"
        },
        "total_hk": {
            "value": 3900,
            "label": "Total HK",
            "change": -2.1,
            "trend": "down"
        },
        "total_lembur": {
            "value": 500,
            "label": "Total Lembur (Jam)",
            "change": 10.5,
            "trend": "up"
        },
        "total_upah_bersih": {
            "value": 750000000,
            "label": "Total Upah Bersih",
            "format": "currency",
            "change": 3.8,
            "trend": "up"
        }
    },
    "comparison": {
        "previous_month": {...},
        "previous_year": {...}
    }
}
```

---

#### `GET /dashboard/cost-per-hkp?month={month}&year={year}`
Get cost per HKp data.

**Authentication:** Required

**Response (200):**
```json
{
    "success": true,
    "data": [
        {
            "division": "AB1",
            "gang": "H1H",
            "total_hkp": 1300,
            "total_upah_bersih": 289500000,
            "cost_per_hkp": 222692
        }
    ]
}
```

---

#### `GET /dashboard/gang-comparison?division={division}&month={month}&year={year}`
Get comparison data antar gang dalam satu divisi.

**Authentication:** Required

**Response (200):**
```json
{
    "success": true,
    "data": {
        "division": "AB1",
        "gangs": [
            {
                "gang_code": "H1H",
                "gang_name": "H1H",
                "total_employees": 50,
                "total_hk": 1300,
                "total_upah_bersih": 289500000,
                "cost_per_hk": 222692,
                "lembur_jam": 150,
                "lembur_jumlah": 7500000
            }
        ]
    }
}
```

---

### Aggregation Endpoints

#### `POST /api/aggregation/seed`
Trigger aggregation seeding untuk periode tertentu.

**Authentication:** Required (Admin only)

**Request Body:**
```json
{
    "month": 12,
    "year": 2025,
    "divisions": ["AB1", "AB2"],
    "force": false
}
```

**Response (200):**
```json
{
    "success": true,
    "message": "Aggregation seeding completed",
    "data": {
        "total_processed": 500,
        "total_divisions": 2,
        "duration_ms": 5234,
        "results": [
            {
                "division": "AB1",
                "status": "success",
                "employees": 250
            }
        ]
    }
}
```

---

#### `GET /api/aggregation/status?month={month}&year={year}`
Get status aggregation untuk periode tertentu.

**Authentication:** Required

**Response (200):**
```json
{
    "success": true,
    "data": {
        "month": 12,
        "year": 2025,
        "is_seeded": true,
        "seeded_at": "2025-12-15T10:30:00Z",
        "divisions": [
            {
                "division_code": "AB1",
                "is_seeded": true,
                "total_employees": 150
            }
        ]
    }
}
```

---

#### `GET /api/aggregation/history?month={month}&year={year}`
Get history aggregation.

**Authentication:** Required

**Response (200):**
```json
{
    "success": true,
    "data": [
        {
            "id": 1,
            "month": 12,
            "year": 2025,
            "division_code": "AB1",
            "total_employees": 150,
            "total_hk": 3900,
            "total_upah_bersih": 750000000,
            "seeded_at": "2025-12-15T10:30:00Z",
            "seeded_by": "admin"
        }
    ]
}
```

---

### History Endpoints

#### `GET /history/payroll?month={month}&year={year}&division={division}`
Get data payroll historis.

**Authentication:** Required

**Response (200):**
```json
{
    "success": true,
    "data": [...]
}
```

---

#### `GET /history/summary?month={month}&year={year}`
Get summary historis.

**Authentication:** Required

**Response (200):**
```json
{
    "success": true,
    "data": [...]
}
```

---

### Spreadsheet Endpoints

#### `POST /spreadsheet/sync`
Sync data ke Google Spreadsheet.

**Authentication:** Required (Admin only)

**Request Body:**
```json
{
    "division": "AB1",
    "month": 12,
    "year": 2025,
    "sync_type": "DAFTAR_UPAH"
}
```

**Response (200):**
```json
{
    "success": true,
    "message": "Data synced to spreadsheet",
    "data": {
        "spreadsheet_url": "https://docs.google.com/spreadsheets/d/...",
        "sheets_created": 2,
        "rows_processed": 150
    }
}
```

---

### Tunjangan Endpoints

#### `GET /tunjangan/:nik?month={month}&year={year}`
Get detail tunjangan karyawan.

**Authentication:** Required

**Response (200):**
```json
{
    "success": true,
    "data": {
        "beras": {
            "tarif": 4250,
            "jumlah": 150000,
            "satuan": "kg"
        },
        "jabatan": {
            "tarif": 500000,
            "jumlah": 500000
        },
        "masa_kerja": {
            "tarif": 10000,
            "jumlah": 260000,
            "satuan": "tahun"
        }
    }
}
```

---

### User Endpoints

#### `GET /users`
Get daftar users (admin only).

**Authentication:** Required (Admin only)

**Response (200):**
```json
{
    "success": true,
    "data": [
        {
            "id": 1,
            "username": "admin",
            "role": "ADMIN",
            "divisions": ["AB1", "AB2", "IJL"]
        }
    ]
}
```

---

## 🚨 Error Responses

### Standard Error Format

```json
{
    "error": "Error message",
    "code": "ERROR_CODE",
    "details": {}
}
```

### Common HTTP Status Codes

| Status | Description | Example |
|--------|-------------|---------|
| 200 | Success | Data retrieved successfully |
| 201 | Created | Resource created |
| 400 | Bad Request | Invalid input parameters |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 500 | Internal Server Error | Server error |

---

## 🔄 Rate Limiting

Tidak ada rate limiting yang diterapkan saat ini, tapi disarankan untuk:
- Maksimal 100 request per menit per user
- Maksimal 1000 request per menit per IP

---

## 📝 Notes

1. **Token Expiry:** JWT token expire dalam 60 menit
2. **Date Format:** Semua tanggal dalam format `YYYY-MM-DD`
3. **Number Format:** Semua angka tanpa pemisah ribuan
4. **Currency:** Semua nilai dalam Rupiah (integer)

---

*Lanjutkan ke `07_FLOW_DATA.md` untuk memahami flow data.*
