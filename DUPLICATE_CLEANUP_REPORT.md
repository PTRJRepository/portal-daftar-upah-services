# Duplicate Payroll & HR Data Cleanup Report

**Date:** 8 April 2026  
**Database:** extend_db_ptrj (History database)

---

## Summary

Successfully removed duplicate data from payroll history and HR tables to prevent double counting in tax reports.

### Tables Cleaned

| Table | Before | After | Duplicates Removed |
|-------|--------|-------|-------------------|
| `history_hr_employee` | 9,106 | 5,911 | **3,195** ✅ |
| `payroll_history_detail` | 27,989 | 27,615 | **374** ✅ |
| `history_gang_member` | 27,277 | 27,277 | 0 (already clean) |
| `payroll_history_header` | 1,325 | 1,325 | 0 (already clean) |

### Total Duplicates Removed: **3,569 records**

---

## Root Cause

Duplicates occurred because:
1. **HR Employee data** was seeded multiple times without DISTINCT filter
2. Same employee (`emp_code`) appeared multiple times in `history_hr_employee`
3. Payroll detail records were duplicated during seeding process

---

## Cleanup Logic Applied

### 1. history_hr_employee
- **Rule:** Keep only 1 record per `emp_code` (latest by `created_at DESC, id DESC`)
- **Action:** Deleted 3,195 older duplicate records
- **Result:** 5,911 unique employee records

### 2. payroll_history_detail
- **Rule:** Keep only 1 record per employee per period per gang (highest `id`)
- **Action:** Deleted 374 duplicate detail records
- **Result:** 27,615 unique detail records

### 3. history_gang_member
- **Status:** Already clean, no duplicates found
- **Note:** 2 employees legitimately appear in 2 different gangs (F0440, B0720)

---

## Remaining Issues (Informational)

### Employees in Multiple Gangs (May Be Legitimate)
- **F0440 - YUDIARTA**: In gangs F2H and F2M (period 2/2026)
- **B0720 - RIYANDI PRATAMA**: In gangs B3B and B3H (period 2/2026)

These may represent legitimate gang transfers and are NOT duplicates.

---

## Prevention Recommendations

To prevent future duplicates:

### 1. Add UNIQUE Constraints
```sql
-- Prevent duplicate emp_code in history_hr_employee
CREATE UNIQUE INDEX UX_history_hr_employee_emp_code 
ON dbo.history_hr_employee(emp_code)
WITH (IGNORE_DUP_KEY = ON);

-- Prevent duplicate detail records
CREATE UNIQUE INDEX UX_payroll_history_detail_unique
ON dbo.payroll_history_detail(emp_code, master_id)
WITH (IGNORE_DUP_KEY = ON);
```

### 2. Use DISTINCT in Seeder Queries
When seeding HR data, use:
```typescript
// In historySeederService.ts or gangService.ts
SELECT DISTINCT emp_code, ...
```

### 3. Add Pre-Seeding Cleanup
Before seeding, delete existing data for the same period:
```typescript
await db.query(`
    DELETE FROM dbo.history_hr_employee
    WHERE emp_code IN (SELECT emp_code FROM new_data)
`, []);
```

---

## Verification

Run this to verify no duplicates remain:
```bash
bun run verify_duplicates_removed.ts
```

Expected output:
- ✅ history_hr_employee: No duplicates
- ✅ payroll_history_detail: No duplicates  
- ✅ history_gang_member: No duplicates

---

## Impact on Tax Reports

After cleanup:
- Tax reports will no longer show duplicate employees
- PPh21 calculations will be accurate (no double counting)
- Employee counts per period will be correct

---

**Status:** ✅ **CLEANUP COMPLETE**
