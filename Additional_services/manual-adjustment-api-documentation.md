# Manual Adjustment API Documentation

## Overview
Manual Adjustment API digunakan untuk mengelola penyesuaian payroll secara manual, termasuk premi, potongan, dan pendapatan lainnya.

## Base URL
`/api/payroll`

## Authentication
Semua endpoint memerlukan header `Authorization: Bearer <token>`.

---

## Endpoints

### 1. List Adjustment Name Options
```http
GET /api/payroll/manual-adjustment/adjustment-name-options/by-api-key
```
Query parameters:
- `adjustment_type` (optional): PREMI, POTONGAN_KOTOR, POTONGAN_BERSIH

### 2. TaskCode Options
```http
GET /api/payroll/manual-adjustment/taskcode-options
```

### 3. Automation Options
```http
GET /api/payroll/manual-adjustment/automation-options/by-api-key
```

### 4. Save Manual Adjustment (Locked)
```http
POST /api/payroll/locked/manual-edit
```
Body:
```json
{
  "emp_code": "string",
  "nik": "string",
  "gang_code": "string",
  "division": "string",
  "month": "string",
  "year": "string",
  "adjustment_type": "PREMI | POTONGAN_KOTOR | POTONGAN_BERSIH | PENDAPATAN_LAINNYA",
  "adjustment_name": "string",
  "amount": "number",
  "task_code": "string (optional)",
  "ad_code": "string (optional)",
  "remarks": "string (optional)"
}
```

### 5. Delete Adjustment Column
```http
DELETE /api/payroll/locked/manual-adjustment/column
```
Query: `adjustment_type`, `adjustment_name`

### 6. Seed Auto Buffer
```http
POST /api/payroll/manual-adjustment/seed-auto-buffer
```

### 7. Auto Buffer Validate
```http
POST /api/payroll/locked/manual-adjustment/auto-buffer-validate
```

### 8. Premium Import Excel
```http
POST /api/payroll/premium-import-excel
```

### 9. Premium Definitions
```http
POST /api/payroll/premium-definitions
GET /api/payroll/premium-definitions
```

---

## Adjustment Types
- **PREMI**: Premi kerja (brondol, prunning, dll)
- **POTONGAN_KOTOR**: Potongan terhadap upah kotor
- **POTONGAN_BERSIH**: Potongan terhadap upah bersih
- **PENDAPATAN_LAINNYA**: THR, Bonus, dll

## Auto Buffer Adjustments
- TUNJANGAN JABATAN
- TUNJANGAN MASA KERJA
- SPSI
- POTONGAN PPH

---

## Testing
Gunakan file `manual-adjustment-api-tester.html` untuk testing manual adjustment API.
