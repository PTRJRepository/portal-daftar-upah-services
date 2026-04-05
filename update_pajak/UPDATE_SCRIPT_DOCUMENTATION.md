# PPh21 Update Script - Documentation

## Overview

Script ini mengupdate jumlah PPh21 di database (PR_ADTRANS + PR_ADTRANSLN) agar sama dengan hasil perhitungan PPh21 TER.

## Database Structure

### Tables Relationship

```
PR_ADTRANS (Header)
    ↓ ID = MasterID
PR_ADTRANSLN (Detail - contains Amount)
```

- **PR_ADTRANS**: Header transaction (DocID, DocDate, DocDesc, EmpCode, etc.)
- **PR_ADTRANSLN**: Detail transaction (Amount, TaskCode, ChargeTo, etc.)
- **Relasi**: `PR_ADTRANS.ID` = `PR_ADTRANSLN.MasterID`

## How It Works

### Step 1: Generate Tax Mapping
```bash
# From project root
cd refactor_production/backend
bun run src/scripts/generate_tax_mapping.ts
```

This creates JSON files in `update_pajak/`:
- `{DIVISION}_pajak.json` - Employee tax data

### Step 2: Update PPh21 to Database
```bash
# From backend directory
bun run src/scripts/update_pph21_to_adtrans.ts
```

### What It Does

1. Reads JSON files from `update_pajak/{DIVISION}_pajak.json`
2. For each employee (emp_code):
   - Searches PR_ADTRANS + PR_ADTRANSLN where:
     - `EmpCode` = employee code from JSON
     - `DocDesc` LIKE '%PPH%' (various patterns)
   - Updates `PR_ADTRANSLN.Amount` = `pph21_amount` from JSON
3. Generates `_update_summary.json` with results

### PPH21 DocDesc Patterns

Script matches these patterns in DocDesc:
- `%Potongan Pph21%`
- `%Potongan PPH 21%`
- `%PPH 21%`
- `%PPH21%`
- `%POTONGAN PPH%`

## Configuration

### Database Connection (Server 2)

```typescript
const DB_CONFIG = {
    driver: "ODBC Driver 17 for SQL Server",
    server: "10.0.0.2",
    port: 1888,
    user: "sa",
    password: "supp0rt@",
    database: "db_ptrj",
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    }
};
```

## Output

### Console Output

```
[Division PG1A] Processing: A0153 - HARIYADI
  PPh21 TER: Rp 90,694
  ✓ Found 1 PPH21 record(s)
    ✓ Updated ID 123456: Rp 85,000 → Rp 90,694
  ✅ Successfully updated 1 record(s)
```

### Summary File (`_update_summary.json`)

```json
{
  "timestamp": "2026-04-05T...",
  "grand_total": {
    "employees": 1661,
    "updated": 1500,
    "not_found": 100,
    "errors": 61
  },
  "divisions": [
    {
      "division_code": "PG1A",
      "total_employees": 227,
      "total_updated": 220,
      "total_not_found": 5,
      "total_errors": 2
    }
  ]
}
```

## Troubleshooting

### "No PPH21 records found"

Employee tidak punya record PPH21 di PR_ADTRANS. Kemungkinan:
1. Employee baru belum dibuatkan transaksi PPh21
2. DocDesc tidak match pattern (bukan "PPH" variations)
3. Employee tidak kena pajak (income di bawah threshold)

**Solution**: Buat record PPH21 manual atau biarkan saja jika memang tidak kena pajak.

### "Error updating record"

Kemungkinan masalah permission atau koneksi. Check:
1. Database connection masih aktif
2. User `sa` punya permission UPDATE
3. Network stabil

### Script terlalu lama

Normal untuk 1661 employees. Bisa memakan waktu 5-15 menit tergantung:
- Kecepatan koneksi ke server
- Jumlah record per employee
- Server load

## Verification

After script completes, verify with:

```sql
SELECT 
    t.EmpCode,
    t.DocDesc,
    ln.Amount,
    t.UpdatedBy,
    t.UpdatedDate
FROM PR_ADTRANS t
INNER JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
WHERE t.EmpCode = 'A0153'
AND t.DocDesc LIKE '%PPH%'
ORDER BY t.DocDate DESC;
```

Amount should match what's in the JSON file.

## Files

| File | Location | Purpose |
|------|----------|---------|
| `update_pph21_to_adtrans.ts` | `backend/src/scripts/` | Main update script |
| `{DIVISION}_pajak.json` | `update_pajak/` | Tax calculation data |
| `_update_summary.json` | `update_pajak/` | Update results summary |
| `debug_pr_adtrans.ts` | `backend/src/scripts/` | Debug script |
| `check_pr_adtrans_structure.ts` | `backend/src/scripts/` | Check table structure |

## Important Notes

1. **Backup First**: Selalu backup database sebelum run update script
2. **Test di Dev**: Test di development environment dulu
3. **Run During Off-Peak**: Jalankan saat jam sepi untuk avoid lock conflicts
4. **Monitor Progress**: Script akan print progress per employee

## Status

✅ Script sudah diperbaiki untuk menggunakan relasi yang benar:
- PR_ADTRANS.ID = PR_ADTRANSLN.MasterID
- Update PR_ADTRANSLN.Amount (bukan PR_ADTRANS.Amount)

🔄 Script sedang berjalan untuk update semua 11 divisions (1661 employees)
