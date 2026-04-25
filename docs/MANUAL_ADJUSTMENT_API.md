# Manual Adjustment API

Dokumentasi API untuk mengelola manual adjustment (koreksi) daftar upah melalui API key bypass.

## Authentication

Semua endpoint manual adjustment memerlukan header `X-API-Key`.

```bash
# API Key yang dikonfigurasi di backend/.env
X-API-Key: 88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a
```

Jika API key valid, request akan mendapat akses **ADMIN** dengan semua divisions.

---

## Endpoints

### 1. GET `/payroll/manual-adjustment/by-api-key`

Ambil data manual adjustment berdasarkan periode.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `period_month` | string | ✅ | Bulan (1-12) |
| `period_year` | string | ✅ | Tahun (e.g. "2026") |
| `gang_code` | string | ❌ | Filter per gang |
| `emp_code` | string | ❌ | Filter per employee code |
| `division_code` | string | ❌ | Filter per division |
| `adjustment_type` | string | ❌ | Filter per type: `PREMI`, `POTONGAN_KOTOR`, `POTONGAN_BERSIH`, `PENDAPATAN_LAINNYA`, `AUTO_BUFFER` |
| `adjustment_name` | string | ❌ | Filter per nama (partial match) |

**Example:**

```bash
curl -X GET "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&gang_code=H1H" \
  -H "X-API-Key: 88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"
```

**Filter Examples:**

```bash
# Filter by division only (get all adjustment types)
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=AB1" \
  -H "X-API-Key: 88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"

# Filter by adjustment_type = AUTO_BUFFER only
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=AB1&adjustment_type=AUTO_BUFFER" \
  -H "X-API-Key: 88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"

# Filter by adjustment_name (partial match - contains "SPSI")
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=AB1&adjustment_name=SPSI" \
  -H "X-API-Key: 88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"

# Filter by adjustment_name (contains "MASA")
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=AB1&adjustment_name=MASA" \
  -H "X-API-Key: 88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"

# Combined filters: division + type
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=AB1&adjustment_type=PREMI" \
  -H "X-API-Key: 88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"

# Via proxy
curl -s "http://localhost/backend/upah/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=AB1&adjustment_name=SPSI" \
  -H "X-API-Key: 88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"

# Filter by specific AUTO_BUFFER names
# AUTO SPSI only
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=AB1&adjustment_name=AUTO%20SPSI" \
  -H "X-API-Key: 88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"

# AUTO MASA KERJA only
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=AB1&adjustment_name=MASA%20KERJA" \
  -H "X-API-Key: 88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"

# AUTO TUNJANGAN JABATAN only
curl -s "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=AB1&adjustment_name=TUNJANGAN%20JABATAN" \
  -H "X-API-Key: 88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"
```

**Response:**

```json
{
  "success": true,
  "count": 411,
  "data": [
    {
      "id": 10730,
      "period_month": 4,
      "period_year": 2026,
      "emp_code": "G0007",
      "gang_code": "G1H",
      "division_code": "AB1",
      "adjustment_type": "AUTO_BUFFER",
      "adjustment_name": "AUTO TUNJANGAN JABATAN",
      "amount": 0,
      "remarks": "AUTO TUNJANGAN JABATAN | tunjangan jabatan | 0",
      "created_by": "api_key_admin",
      "created_at": "2026-04-25T13:41:38.107Z"
    },
    {
      "id": 10731,
      "period_month": 4,
      "period_year": 2026,
      "emp_code": "G0007",
      "gang_code": "G1H",
      "division_code": "AB1",
      "adjustment_type": "AUTO_BUFFER",
      "adjustment_name": "AUTO MASA KERJA",
      "amount": 27000,
      "remarks": "AUTO MASA KERJA | masa kerja | 27000",
      "created_by": "api_key_admin",
      "created_at": "2026-04-25T13:41:38.160Z"
    },
    {
      "id": 10732,
      "period_month": 4,
      "period_year": 2026,
      "emp_code": "G0007",
      "gang_code": "G1H",
      "division_code": "AB1",
      "adjustment_type": "AUTO_BUFFER",
      "adjustment_name": "AUTO SPSI",
      "amount": 4000,
      "remarks": "AUTO SPSI | potongan spsi | 4000",
      "created_by": "api_key_admin",
      "created_at": "2026-04-25T13:41:38.187Z"
    }
  ]
}
```

**Note:** GET endpoint mengembalikan semua adjustment_type termasuk `AUTO_BUFFER` dari seeder.

---

### 2. POST `/payroll/manual-adjustment/by-api-key`

Simpan manual adjustment baru atau update yang sudah ada (upsert berdasarkan unique key).

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `period_month` | number | ✅ | Bulan (1-12) |
| `period_year` | number | ✅ | Tahun |
| `nik` | string | ❌ | NIK (KTP) - untuk PENDAPATAN_LAINNYA |
| `emp_code` | string | ✅ | Employee code |
| `gang_code` | string | ✅ | Gang code |
| `division_code` | string | ❌ | Division code |
| `adjustment_type` | string | ✅ | `PREMI`, `POTONGAN_KOTOR`, `POTONGAN_BERSIH`, `PENDAPATAN_LAINNYA`, `AUTO_BUFFER` |
| `adjustment_name` | string | ✅ | Nama adjustment |
| `amount` | number | ✅ | Jumlah nominal |
| `remarks` | string | ❌ | Catatan |

**Adjustment Types:**

| Type | Description |
|------|-------------|
| `PREMI` | Tunjangan bonus/premi tambahan |
| `POTONGAN_KOTOR` | Potongan dari upah kotor (koreksi) |
| `POTONGAN_BERSIH` | Potongan dari upah bersih |
| `PENDAPATAN_LAINNYA` | Pendapatan lain (THR, bonus, dll) |
| `AUTO_BUFFER` | Auto-generated Jabatan/Masa Kerja/SPSI (dari seeder) |

**Example:**

```bash
curl -X POST "http://localhost:8002/payroll/manual-adjustment/by-api-key" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: 88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a" \
  -d '{
    "period_month": 4,
    "period_year": 2026,
    "emp_code": "C0001",
    "gang_code": "H1H",
    "division_code": "AB1",
    "adjustment_type": "PREMI",
    "adjustment_name": "BONUS LEBARAN",
    "amount": 500000,
    "remarks": "Bonus hari raya 2026"
  }'
```

**Response:**

```json
{
  "success": true,
  "id": 42,
  "message": "Manual adjustment saved successfully."
}
```

---

## Upsert Behavior

Manual adjustment menggunakan **upsert** — jika kombinasi berikut sudah ada, nilainya di-update:

- `period_month` + `period_year` + `emp_code` + `adjustment_name`

Jika belum ada, akan dibuat record baru.

---

## Cache

Setiap save/delete operation secara otomatis membersihkan cache payroll:

```
Pattern: :{period_month}:{period_year}
```

Ini memastikan data terbaru langsung dipakai pada request berikutnya.

---

## Error Responses

| Status | Message | Description |
|--------|---------|-------------|
| 400 | `period_month harus 1-12` | Bulan tidak valid |
| 400 | `period_year tidak valid` | Tahun tidak valid |
| 401 | `Unauthorized: invalid x-api-key` | API key tidak valid |
| 500 | `{error message}` | Error server |

---

## System Token Alternative

Jika `SYSTEM_TOKEN` dikonfigurasi di `.env`, bisa juga dipakai sebagai Bearer fallback:

```bash
# Menggunakan system token
curl -H "Authorization: Bearer system-internal-secret-token" \
     http://localhost:8002/payroll/divisions
```

---

## Auto Buffer Seeder

Seeder untuk generate otomatis adjustment tipe `AUTO_BUFFER`. Digunakan untuk mengisi `AUTO TUNJANGAN JABATAN`, `AUTO MASA KERJA`, dan `AUTO SPSI` secara otomatis dari data payroll.

### Endpoint

```
POST /payroll/manual-adjustment/seed-auto-buffer
```

atau via proxy:

```
POST /backend/upah/payroll/manual-adjustment/seed-auto-buffer
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `period_month` | number | ✅ | Bulan (1-12) |
| `period_year` | number | ✅ | Tahun |
| `division_code` | string | ✅ | Kode divisi (e.g. `AB1`, `PG1A`) |
| `gang_code` | string | ❌ | Kode gang (default: `ALL`) |
| `replace_existing` | boolean | ❌ | Hapus existing auto buffer sebelum seed (default: `true`) |
| `use_history_db` | boolean | ❌ | Pakai history DB (default: `false`) |
| `snapshot_version` | number | ❌ | Snapshot version |
| `created_by` | string | ❌ | User creator (default: `system`) |

### Response

```json
{
  "period_month": 4,
  "period_year": 2026,
  "division_code": "AB1",
  "gang_code": "ALL",
  "source_rows": 25,
  "seeded_entries": 75,
  "inserted": 70,
  "updated": 5,
  "deleted_existing": 0,
  "replace_existing": true,
  "value_priority_mode_source": "db_ptrj_only"
}
```

---

## Remarks Format for Auto Buffer

Setiap auto buffer entry memiliki remarks dengan format konsisten:

```
AUTO TUNJANGAN JABATAN | tunjangan jabatan | {amount}
AUTO MASA KERJA | masa kerja | {amount}
AUTO SPSI | potongan spsi | {amount}
```

Format: `{adjustment_name} | {adcode} | {amount}`

### Adcode Mapping

| Adjustment Name | Adcode | Description |
|-----------------|--------|-------------|
| `AUTO TUNJANGAN JABATAN` | `tunjangan jabatan` | Jabatan allowance |
| `AUTO MASA KERJA` | `masa kerja` | Masa kerja allowance |
| `AUTO SPSI` | `potongan spsi` | SPSI deduction |

### Example

```
AUTO TUNJANGAN JABATAN | tunjangan jabatan | 200000
AUTO MASA KERJA | masa kerja | 150000
AUTO SPSI | potongan spsi | 4000
```

---

## Proxy / Base URL Configuration

Backend bisa diakses via direct atau proxy path tergantung deployment:

### Direct Access (localhost / LAN IP)

```
http://localhost:8002
http://10.0.0.128:8002
```

### Via Reverse Proxy

```
http://{proxy_host}/backend/upah
```

Proxy prefix `/backend/upah` akan di-strip oleh middleware (aktifkan `USE_PROXY=true` di `.env`).

### Contoh Complete dengan Semua Base URL

```bash
API_KEY="88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"

# ===== DIRECT ACCESS =====
# Localhost
curl -X POST "http://localhost:8002/payroll/manual-adjustment/seed-auto-buffer" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"period_month":4,"period_year":2026,"division_code":"AB1"}'

# LAN IP
curl -X POST "http://10.0.0.128:8002/payroll/manual-adjustment/seed-auto-buffer" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"period_month":4,"period_year":2026,"division_code":"AB1"}'

# ===== VIA PROXY =====
# Local proxy
curl -X POST "http://localhost/backend/upah/payroll/manual-adjustment/seed-auto-buffer" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"period_month":4,"period_year":2026,"division_code":"AB1"}'

# Remote proxy
curl -X POST "http://10.0.0.128/backend/upah/payroll/manual-adjustment/seed-auto-buffer" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"period_month":4,"period_year":2026,"division_code":"AB1"}'

# ===== GET DATA =====
# Ambil data adjustment via proxy
curl -s "http://localhost/backend/upah/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=AB1" \
  -H "X-API-Key: ${API_KEY}"
```

### Endpoint dengan Proxy Path

| Direct Path | Proxy Path |
|-------------|------------|
| `/payroll/manual-adjustment/by-api-key` | `/backend/upah/payroll/manual-adjustment/by-api-key` |
| `/payroll/manual-adjustment/seed-auto-buffer` | `/backend/upah/payroll/manual-adjustment/seed-auto-buffer` |

---

## CLI Helper Script

Untuk testing cepat dari command line, bisa pakai script `curl_test.ts` yang ada di `_dev_utils`:

```bash
cd backend
bun run src/scripts/curl_test.ts
```

Atau buat script bash sederhana:

```bash
#!/bin/bash
API_KEY="88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"
BASE_URL="http://localhost:8002"

# Get adjustments
curl -s -X GET "${BASE_URL}/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&gang_code=H1H" \
  -H "X-API-Key: ${API_KEY}" | jq .

# Save adjustment
curl -s -X POST "${BASE_URL}/payroll/manual-adjustment/by-api-key" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"period_month":4,"period_year":2026,"emp_code":"C0001","gang_code":"H1H","adjustment_type":"PREMI","adjustment_name":"BONUS LEBARAN","amount":500000}' | jq .
```
