# Seeder Stuck - Problem & Solution

## Problem
Payroll history seeder gets stuck/not responding during seeding process.

## Root Cause (from diagnostic)
- **Stuck at**: "Menyimpan data transaksi..." (Saving transaction data)
- **Division**: AB1
- **Period**: March 2026
- **Symptom**: `is_running: true` but `gangs_done: 6/6` and `employees_processed: 0`
- **Likely cause**: Transaction seeding (seedTransactionData) is hanging during SQL query execution

## Immediate Solution

### Step 1: Reset the Stuck Seeder
```bash
cd backend
bun run reset_seeder.ts
```

OR via curl:
```bash
curl -X POST http://localhost:8002/payroll/history/seed/reset \
  -H "Authorization: Bearer system" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Manual reset - seeder stuck"}'
```

### Step 2: Diagnose Before Re-seeding
```bash
cd backend
bun run diagnose_seeder.ts
```

### Step 3: Re-seed Single Division (Recommended)
```bash
cd backend
bun run reset_and_reseed.ts AB1 3 2026
```

This will:
1. Reset the stuck seeder
2. Wait 2 seconds
3. Trigger fresh seeder for AB1 only
4. Monitor progress in real-time

## Why It Gets Stuck

The seeder has 3 main phases:
1. ✅ **Fetch payroll data** - Completes quickly
2. ✅ **Save payroll master & detail** - Completes quickly  
3. ❌ **Save transaction data** (Taskreg & ADTrans) - **CAN HANG**

### Transaction Seeding Issues:
- **Large IN clauses**: Querying 100+ employee codes at once
- **UNION ALL queries**: Combining regular + ARC tables
- **Missing indexes**: On EmpCode, TrxDate, DocDate columns
- **Gateway timeout**: SQL Gateway (Python) times out on complex queries

## Prevention Strategies

### 1. Seed One Division at a Time
```bash
# Instead of ALL divisions, do one by one:
bun run reset_and_reseed.ts P1A 3 2026
bun run reset_and_reseed.ts P1B 3 2026
bun run reset_and_reseed.ts AB1 3 2026
# ... etc
```

### 2. Skip Transaction Seeding (if not needed)
If you only need summary data, use `seederMode: 'PAYROLL'` which skips transaction tables:

```typescript
// Via API
{
  periodMonth: 3,
  periodYear: 2026,
  divisionCode: 'AB1',
  seederMode: 'PAYROLL',  // ← Skip transactions
  createdBy: 'system',
  force: true
}
```

### 3. Increase Timeouts (if needed)
Add to backend `.env`:
```bash
DB_SEEDER_TIMEOUT=300  # 5 minutes instead of 3
```

### 4. Monitor Progress
```bash
# Check progress every 3 seconds
watch -n 3 "curl -s http://localhost:8002/payroll/history/seed/progress -H 'Authorization: Bearer system' | jq"
```

## Files Created

| File | Purpose |
|------|---------|
| `backend/diagnose_seeder.ts` | Diagnose stuck seeder status |
| `backend/reset_seeder.ts` | Force reset stuck seeder |
| `backend/reset_and_reseed.ts` | Reset + reseed with monitoring |

## Alternative: Manual SQL Approach

If API-based seeder continues to fail, you can manually seed via SQL:

```sql
-- In extend_db_ptrj
INSERT INTO daftar_upah_aggregation_history
SELECT * FROM db_ptrj.payroll_summary
WHERE period_month = 3 AND period_year = 2026;
```

## Next Steps

1. **Immediate**: Run `reset_seeder.ts` to unblock
2. **Short-term**: Use `reset_and_reseed.ts` for single divisions
3. **Long-term**: Investigate transaction query performance (add indexes, optimize queries)

## Monitoring Commands

```bash
# Check seeder logs
tail -f backend/logs/error.log

# Check backend console
# (Look for [HistorySeeder] or [SeederProgress] logs)

# Query seeded data directly
cd backend
bun run -e "
const db = require('./src/db/client').Database.getExtendedInstance();
db.query('SELECT division_code, gang_code, total_employees FROM daftar_upah_aggregation_history WHERE period_month=3 AND period_year=2026').then(r => console.log(r));
"
```
