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

**Example:**

```bash
curl -X GET "http://localhost:8002/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&gang_code=H1H" \
  -H "X-API-Key: 88217c42101662147aee16779663caa22ff1e896b57568a6576ed56f2f3d124a"
```

**Response:**

```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": 1,
      "emp_code": "C0001",
      "gang_code": "H1H",
      "division_code": "AB1",
      "period_month": 4,
      "period_year": 2026,
      "adjustment_type": "PREMI",
      "adjustment_name": "BONUS LEBARAN",
      "amount": 500000,
      "remarks": "Bonus hari raya",
      "created_by": "api_key_bypass",
      "created_at": "2026-04-25T10:00:00Z"
    }
  ]
}
```

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
| `adjustment_type` | string | ✅ | `PREMI`, `POTONGAN_KOTOR`, `POTONGAN_BERSIH`, `PENDAPATAN_LAINNYA` |
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
