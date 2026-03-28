# THR Report - Data Retrieval Issue

## Problem
Laporan THR tidak bisa menarik data dari database `extend_db_ptrj`.

## Root Cause Analysis (FIXED)

**Previous Issue:** The report was filtering by `division_code` and `gang_code` directly in the `employee_other_incomes` table, which didn't account for gang membership history.

**Solution Implemented:** The system now:
1. Looks at the selected gang
2. Queries `history_gang_member` table to get list of members (emp_code)
3. Uses emp_code to filter `employee_other_incomes` for THR data
4. If THR data exists in database, it displays the saved data

## How It Works Now

### Data Flow

```
User selects Gang → Query history_gang_member → Get emp_code list → 
Query employee_other_incomes WHERE emp_code IN (...) → Return THR data
```

### Code Location

The fix is in `backend/src/services/otherIncomesService.ts` - `getRawIncomes()` method:

```typescript
// When gangCode is specified, first get gang members from history_gang_member
if (gangCode && gangCode !== 'ALL') {
    // Get gang members from history
    const gangMembers = await db.query(`
        SELECT DISTINCT emp_code 
        FROM history_gang_member 
        WHERE gang_code = ? AND period_month = ? AND period_year = ?
    `, [gangCode, month, year]);
    
    // Use emp_codes to filter THR data
    const empCodes = gangMembers.map((r) => r.emp_code);
    sql += ` AND emp_code IN (${placeholders})`;
}
```

### Fallback Strategy

If `history_gang_member` has no data for the period:
1. System falls back to current `HR_GANGLN` table
2. Gets current gang members
3. Uses those emp_codes to find THR data

## Solution Steps

### 1. Calculate THR Data First

Before viewing the THR report, you must calculate and save the THR data:

1. Navigate to **Pendapatan Tidak Tetap** page (Other Incomes)
2. Select the correct period (e.g., February 2026 for THR March 2026)
3. Select the division
4. Click **"Hitung THR"** or **"Calculate THR"** button
5. Wait for the calculation to complete
6. Click **"Simpan"** or **"Save"** to persist the data to database

### 2. Verify Data Exists

Run the diagnostic script to check if THR data exists:

```bash
cd "D:\Gawean Rebinmas\PORTAL_ESTATE\Plantware_Auto_Report\Daftar_Upah_baru\payroll_daftar_upah\refactor_production"
npx tsx _dev_utils/tests/diagnose_thr_report.ts
```

This will show:
- Whether the `employee_other_incomes` table exists
- How many THR records are stored
- Breakdown by division and gang
- Sample records with their details

### 3. Check Report Filters

When viewing the THR report:
- Ensure the **period is correct** (THR for March is stored in period 2/2026)
- Check the **division filter** - try "Semua Divisi" first
- Verify the **month/year** selection

### 4. Review Backend Logs

With the new logging added, check the backend console for messages like:

```
[getThrSummary] Fetching THR data for 2/2026, divisionCode: ALL
[getRawIncomes] Fetching for 2/2026, divisionCode: ALL, gangCode: ALL
[getRawIncomes] SQL: SELECT * FROM employee_other_incomes WHERE period_year = ? AND period_month = ?
[getRawIncomes] Database returned 150 rows
[getThrSummary] THR records after filtering: 150
```

If you see:
```
[getThrSummary] No THR data found for 2/2026, division: ALL
[getThrSummary] HINT: Run THR calculation first from Other Incomes page
```

This means the THR calculation hasn't been run yet.

## Database Schema

The THR data is stored in:
- **Database**: `extend_db_ptrj`
- **Table**: `employee_other_incomes`
- **Key columns**:
  - `nik` - Employee ID
  - `emp_name` - Employee name
  - `division_code` - Division code (e.g., PG1A, AB1, INF)
  - `gang_code` - Gang code (e.g., A01, B02)
  - `period_year` - Year (e.g., 2026)
  - `period_month` - Month (e.g., 2 for February)
  - `income_type` - Always 'THR' for THR data
  - `amount` - THR amount
  - `details_json` - JSON containing calculation details (beras_rate, masa_kerja, etc.)

## Important Notes

### THR Period Convention
- **THR for March 2026** is stored in **period 2/2026** (February)
- This is because THR is calculated in the month before it's paid
- The report display will show "PERIODE THR: MARET 2026" even though the data is stored in period 2

### Division Mapping
The system uses unified division mapping:
- `AB1` = `ARB1` (Air Ruak B1)
- `AB2` = `ARB2` (Air Ruak B2)
- `INF` = `INFRA` (Infrastruktur)
- `PG1A` = `P1A` (Parit Gunung 1A)
- etc.

See `QWEN.md` for complete division mappings.

## Troubleshooting

### Issue: "No data available" in report

**Check:**
1. Has THR been calculated? → Go to Other Incomes page and calculate
2. Is the period correct? → THR March = Period 2 (February)
3. Is division filter set correctly? → Try "Semua Divisi"
4. **NEW:** Check if gang members exist in history for the selected period

### Test Gang History Integration

Run the test script to verify the gang history integration:

```bash
cd "D:\Gawean Rebinmas\PORTAL_ESTATE\Plantware_Auto_Report\Daftar_Upah_baru\payroll_daftar_upah\refactor_production"
npx tsx _dev_utils/tests/test_thr_with_gang_history.ts
```

This will:
1. Query `history_gang_member` for the test gang
2. Get emp_codes from history
3. Find THR data for those emp_codes
4. Test the `getRawIncomes` method directly

### Issue: Data shows for some gangs but not others

**Check:**
1. Gang membership history exists for that period:
   ```sql
   SELECT COUNT(*) FROM history_gang_member 
   WHERE gang_code = 'A01' AND period_month = 2 AND period_year = 2026
   ```
2. If history is empty, check current HR_GANGLN:
   ```sql
   SELECT COUNT(*) FROM HR_GANGLN WHERE GangCode = 'A01'
   ```
3. Check if THR data exists for gang members:
   ```sql
   SELECT o.* FROM employee_other_incomes o
   INNER JOIN history_gang_member h ON o.emp_code = h.emp_code
   WHERE h.gang_code = 'A01' 
   AND h.period_month = 2 AND h.period_year = 2026
   AND o.income_type = 'THR'
   ```

### Issue: Details not showing (beras, masa_kerja)

**Check:**
1. `details_json` column should contain calculation variables
2. If NULL, the system falls back to history data from payroll
3. Re-calculate THR with updated formula if needed

## API Endpoints

For debugging, you can directly call:

```bash
# Get THR summary
GET /other-incomes/summary?year=2026&month=2&divisionCode=ALL

# Get raw THR data
GET /other-incomes?year=2026&month=2&divisionCode=PG1A&incomeType=THR

# Export THR Excel
GET /other-incomes/export-thr?year=2026&month=2&divisionCode=ALL
```

## Files Involved

- **Backend Service**: `backend/src/services/otherIncomesService.ts`
- **API Routes**: `backend/src/api/otherIncomesRoutes.ts`
- **Frontend Service**: `frontend/src/services/otherIncomesService.js`
- **Summary Report Page**: `frontend/src/pages/SummaryReportPage.jsx`
- **Other Incomes Page**: `frontend/src/pages/OtherIncomesPage.jsx`
- **Wages Summary Page**: `frontend/src/pages/WagesSummaryRebinmasPage.jsx`

## Recent Changes

Added comprehensive logging to:
- `getThrSummary()` - Logs data fetching and filtering
- `getRawIncomes()` - Logs SQL query, parameters, and results

This helps identify where the data retrieval is failing.
