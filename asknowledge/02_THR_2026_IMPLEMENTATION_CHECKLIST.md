# Implementation Guide: THR 2026 (Bulan 3)

## Ringkasan Perubahan

Untuk tahun 2026, **THR diberikan pada bulan Maret (bulan 3)**, bukan bulan Februari (bulan 2).

### Perubahan pada Maret 2026

1. **Month THR**: February 2026 → **Maret 2026**
2. **Refactor THR Calculation**: Menggunakan `history_gang_member` sebagai sumber member list dengan basis EmpCode

```diff
- sebelumnya: Member list dari payroll_history_detail (basis NIK)
+ sekarang:  Member list dari history_gang_member (basis EmpCode)
```

### Alur Baru THR (EmpCode Basis - Maret 2026)

```
1. Query history_gang_member (extend_db_ptrj) → daftar anggota gang per bulan
   - WHERE gang_code IN (...) AND period_month = ? AND period_year = ? AND is_active = 1
2. Resolve NIK dari HR_EMPLOYEE oleh EmpCode (batch)
3. Resolve rekening bank dari HR_PAYROLL oleh EmpCode (batch)
4. Fetch data payroll (upah_dasar, beras_rate, masa_kerja_jumlah) dari payroll_history_detail
5. Hitung THR dengan formula
6. Apply blacklist (oleh NIK)
7. Simpan dengan kolom baru: emp_code, religion, join_date, bank_acc_no, bank_code, sex
```

---

## Checklist Implementasi

### ✅ Step 1: Verifikasi Konfigurasi THR Periode

**File**: `backend/src/services/taxReportService.ts` (Line 179-186)

```typescript
function loadActiveThrPeriode(): ThrPeriode | null {
    return {
        year: 2026,
        month: 3,  // ✅ Pastikan month = 3
        type: 'THR',
        name: 'THR 2026',
        description: 'Fixed THR Period (March)',
        is_active: true
    };
}
```

**Status**: ✅ Sudah di-hardcode ke month = 3

---

### ✅ Step 2: Hitung dan Simpan THR untuk Bulan 3

**API Endpoint**: `POST /api/other-incomes/calculate-and-save`

**Request**:
```json
{
    "year": 2026,
    "month": 3,
    "divisionCode": "ALL",
    "gangCode": "ALL"
}
```

**Test Script**:
```typescript
// backend/src/scripts/check_thr_data.ts
await OtherIncomesService.calculateAndSaveTHR(2026, 3, 'ALL');
```

**Verifikasi Database**:
```sql
-- Cek THR untuk Maret 2026
SELECT 
    period_year, 
    period_month, 
    income_type, 
    COUNT(*) as count,
    SUM(amount) as total
FROM employee_other_incomes
WHERE period_year = 2026 AND period_month = 3 AND income_type = 'THR'
GROUP BY period_year, period_month, income_type;
```

**Expected Result**:
```
period_year | period_month | income_type | count  | total
------------|--------------|-------------|--------|-------------
2026        | 3            | THR         | 1500   | 3500000000
```

---

### ✅ Step 3: Verifikasi Perhitungan Pajak Include THR

**Test**: Cek di TaxReportService

```typescript
// Di TaxReportService - Line 484-491
const activeThr = loadActiveThrPeriode();
const isThrMonth = activeThr && 
                   activeThr.month === 3 &&    // ✅ Cek month = 3
                   activeThr.year === 2026;

// isThrMonth harus TRUE untuk bulan Maret
```

**Verifikasi**:
1. Buka `http://localhost:3000/api/tax-report/1721?year=2026&month=3`
2. Cek response, pastikan ada field `thr` dan `thr_bonus_tantiem_setahun`
3. Verifikasi `total_penghasilan_setahun` include THR

---

### ✅ Step 4: Cleanup Data Lama (Jika Ada)

**Hapus THR Februari 2026** (jika ada):
```sql
DELETE FROM employee_other_incomes 
WHERE period_year = 2026 
  AND period_month = 2 
  AND income_type = 'THR';
```

**Hapus Blacklist Lama**:
```sql
DELETE FROM employee_other_incomes_blacklist 
WHERE period_year = 2026 
  AND income_type = 'THR';
```

---

## Testing Checklist

### Test 1: THR Calculation (EmpCode Basis)

- [ ] Run `calculateAndSaveTHR(2026, 3, 'ALL')`
- [ ] Verify data exists in `employee_other_incomes` with `period_month = 3`
- [ ] Check `details_json` contains `upah_dasar`, `beras_rate`, `masa_kerja`
- [ ] Verify `emp_code` column is populated (EmpCode basis)
- [ ] Verify `bank_acc_no` resolved by EmpCode (not by NIK)
- [ ] Verify `religion` populated from HR_EMPLOYEE
- [ ] Verify amount formula: `(upah × 30) + (beras × 30) + masa_kerja`

### Test 2: Tax Calculation for March 2026

- [ ] Generate tax report for month 3: `GET /api/tax-report/1721?year=2026&month=3`
- [ ] Check employee with THR has higher `gross_income`
- [ ] Verify `thr` field is populated in response
- [ ] Verify `pph21_setahun` includes THR impact

### Test 3: Tax Calculation for Other Months

- [ ] Generate tax report for month 2: `GET /api/tax-report/1721?year=2026&month=2`
- [ ] Verify `thr` field is 0 or null
- [ ] Verify no THR in `total_penghasilan_setahun`

### Test 4: Annual Tax Report (Form 1721)

- [ ] Generate annual report: `GET /api/tax-report/annual?year=2026`
- [ ] Verify `thr_bonus_tantiem_setahun` includes THR amount
- [ ] Verify `pkp` calculation includes THR
- [ ] Verify `pph21_setahun` is correct with progressive rate

---

## Code References

### Key Files to Check

| File | Line Numbers | Description |
|------|--------------|-------------|
| `taxReportService.ts` | 179-186 | `loadActiveThrPeriode()` |
| `taxReportService.ts` | 484-550 | Load THR for tax calculation |
| `taxReportService.ts` | 1113-1167 | Calculate total income with THR |
| `taxReportService.ts` | 1586-1587 | Save THR factors |
| `taxReportService.ts` | 1686-1714 | Annual report THR calculation |
| `otherIncomesService.ts` | ~1210 | `calculateAndSaveTHR()` |
| `otherIncomesService.ts` | 799-1202 | **`calculateTHRData()` - REFACTORED (EmpCode + history_gang_member)** |
| `otherIncomesService.ts` | 90-145 | `initTable()` - Added new columns |
| `otherIncomesService.ts` | 1236-1253 | `bulkSaveIncomes()` - Saves new columns |

### Important Functions

```typescript
// 1. Load THR Periode
function loadActiveThrPeriode(): ThrPeriode | null {
    return { year: 2026, month: 3, type: 'THR', is_active: true };
}

// 2. Calculate and Save THR
static async calculateAndSaveTHR(
    year: number,    // 2026
    month: number,   // 3 (Maret)
    divisionCode?: string,
    gangCode?: string
): Promise<{ success: boolean; count: number }>

// 3. Tax Calculation with THR
const isThrMonth = activeThr && 
                   activeThr.month === month && 
                   activeThr.year === year;

if (isThrMonth) {
    // Include THR in gross income
    taxableIncomes += thrAmount;
}
```

---

## Common Issues & Solutions

### Issue 1: THR Muncul di Bulan Februari

**Symptom**: Data THR ada di `period_month = 2`

**Solution**:
```sql
-- Delete wrong data
DELETE FROM employee_other_incomes 
WHERE period_year = 2026 AND period_month = 2 AND income_type = 'THR';

-- Re-calculate for March
await OtherIncomesService.calculateAndSaveTHR(2026, 3, 'ALL');
```

---

### Issue 2: Pajak Tidak Include THR

**Symptom**: PPh21 tidak berubah di bulan Maret

**Check**:
1. Verify `is_taxable = 1` in `employee_other_incomes`
2. Verify `loadActiveThrPeriode()` returns `month = 3`
3. Check TaxReportService line 504: `if (inc.is_taxable)`

**Fix**:
```sql
-- Update is_taxable if needed
UPDATE employee_other_incomes 
SET is_taxable = 1 
WHERE period_year = 2026 AND period_month = 3 AND income_type = 'THR';
```

---

### Issue 3: THR Amount Salah

**Symptom**: THR amount tidak sesuai dengan formula

**Check**:
1. Verify `details_json` contains correct variables
2. Check formula in `employee_other_incomes_formulas`
3. Verify employee data (upah, beras, masa_kerja)

**Debug Script**:
```typescript
const thrData = await OtherIncomesService.calculateTHRData(2026, 3, 'DME');
console.log(thrData[0]);
// Expected:
// {
//   amount: 2539500,
//   details: {
//     upah_dasar: 75000,
//     beras_rate: 4650,
//     masa_kerja: 150000
//   }
// }
```

---

## API Endpoints Reference

### Calculate THR

```bash
POST http://localhost:3000/api/other-incomes/calculate-and-save
Content-Type: application/json

{
    "year": 2026,
    "month": 3,
    "divisionCode": "ALL",
    "gangCode": "ALL"
}
```

### Get THR Data

```bash
GET http://localhost:3000/api/other-incomes?year=2026&month=3&type=THR&divisionCode=DME
```

### Export THR Excel

```bash
GET http://localhost:3000/api/other-incomes/export/thr-excel?year=2026&month=3&divisionCode=ALL
```

### Get Tax Report (Include THR)

```bash
GET http://localhost:3000/api/tax-report/1721?year=2026&month=3
```

### Get Annual Tax Report (Form 1721)

```bash
GET http://localhost:3000/api/tax-report/annual?year=2026
```

---

## Verification Queries

### Check THR Data

```sql
-- Summary by division
SELECT 
    division_code,
    COUNT(*) as employee_count,
    SUM(amount) as total_thr
FROM employee_other_incomes
WHERE period_year = 2026 AND period_month = 3 AND income_type = 'THR'
GROUP BY division_code
ORDER BY total_thr DESC;

-- Check details_json
SELECT TOP 10 
    nik,
    emp_name,
    amount,
    details_json
FROM employee_other_incomes
WHERE period_year = 2026 AND period_month = 3 AND income_type = 'THR'
ORDER BY amount DESC;
```

### Check Tax Impact

```sql
-- This query shows THR impact on tax calculation
-- (Requires tax report to be generated first)
SELECT 
    emp_name,
    monthly_income,
    thr_amount,
    gross_income_with_thr,
    pph21_before,
    pph21_after,
    (pph21_after - pph21_before) as tax_increase
FROM tax_report_march_2026
WHERE thr_amount > 0
ORDER BY tax_increase DESC;
```

---

## Migration from 2025 to 2026

### 2025 Configuration

```json
{
    "year": 2025,
    "month": 2,
    "type": "THR",
    "name": "THR 2025",
    "is_active": false  // ← Deactivate 2025
}
```

### 2026 Configuration

```typescript
// Hardcoded in taxReportService.ts
{
    "year": 2026,
    "month": 3,  // ← Changed from 2 to 3
    "type": "THR",
    "name": "THR 2026",
    "is_active": true
}
```

---

## Next Steps

1. ✅ Verify `loadActiveThrPeriode()` returns `month = 3`
2. ✅ Run `calculateAndSaveTHR(2026, 3, 'ALL')`
3. ✅ Verify data in database (`period_month = 3`)
4. ✅ Test tax calculation for March 2026
5. ✅ Test annual tax report (Form 1721)
6. ✅ Document any issues and solutions

---

**Created**: 2026-03-24  
**Version**: 1.0  
**Status**: Ready for Implementation
