# 🔍 PREMI INCONSISTENCY ANALYSIS
## Analisis Perbedaan Perhitungan Premi antara Daftar Upah dan Summary Report

**Document Version:** 1.0  
**Created:** 2026-03-08  
**Issue:** Perbedaan total premi untuk divisi 1B (PG1B) dan 2A (PG2A) periode 02/2026  

---

## 📊 PROBLEM SUMMARY

### Symptoms

**Daftar Upah** dan **Summary Report** menunjukkan total premi yang berbeda untuk:
- **Divisi PG1B (Plasma 1 Blok)** - Periode 02/2026
- **Divisi PG2A (Plasma 2 Afdeling)** - Periode 02/2026

**Root Cause:** Ada **2 sumber input brondol** yang seharusnya dijumlahkan:
1. **PR_LOOSEFRUIT** (Loose Fruit table)
2. **PR_ADTRANS** (Additional Transaction table dengan DocDesc seperti "PREMI BRONDOL")

---

## 🔬 ROOT CAUSE ANALYSIS

### Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    BRONDOL SOURCES                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Source 1: PR_LOOSEFRUIT                                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ PR_LOOSEFRUIT (Header)                                │   │
│  │ ├── ID                                                 │   │
│  │ ├── DocDate                                            │   │
│  │ └── ...                                                │   │
│  │                                                         │   │
│  │ PR_LOOSEFRUITLN (Detail)                               │   │
│  │ ├── MasterID → PR_LOOSEFRUIT.ID                        │   │
│  │ ├── EmpCode                                            │   │
│  │ └── Amount ← BRONDOL AMOUNT                            │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Source 2: PR_ADTRANS (Premi Brondol entries)               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ PR_ADTRANS (Header)                                   │   │
│  │ ├── ID                                                 │   │
│  │ ├── DocDate                                            │   │
│  │ ├── DocDesc (e.g., "PREMI BRONDOL")                    │   │
│  │ └── ...                                                │   │
│  │                                                         │   │
│  │ PR_ADTRANSLN (Detail)                                  │   │
│  │ ├── MasterID → PR_ADTRANS.ID                           │   │
│  │ ├── EmpCode                                            │   │
│  │ └── Amount ← BRONDOL AMOUNT                            │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📍 WHERE THE BUG OCCURS

### 1. **DataExtractorService** ✅ CORRECT

**Location:** `backend/src/services/dataExtractorService.ts`

```typescript
// ✅ CORRECT: getBrondol() fetches from PR_LOOSEFRUIT only
private async getBrondol(empCodes: string[], startDate: string, endDate: string): Promise<Record<string, number>> {
    let rows = await db.query(`
        SELECT RTRIM(EmpCode) as emp_code, SUM(Amount) as total
        FROM (
            SELECT LFLN.EmpCode, LFLN.Amount
            FROM PR_LOOSEFRUIT LF
            JOIN PR_LOOSEFRUITLN LFLN ON LF.ID = LFLN.MasterID
            WHERE RTRIM(LFLN.EmpCode) IN (?) AND LF.DocDate >= ? AND LF.DocDate < ?
            
            UNION ALL
            
            SELECT LFLN.EmpCode, LFLN.Amount
            FROM PR_LOOSEFRUIT_ARC LF
            JOIN PR_LOOSEFRUITLN_ARC LFLN ON LF.ID = LFLN.MasterID
            WHERE RTRIM(LFLN.EmpCode) IN (?) AND LF.DocDate >= ? AND LF.DocDate < ?
        ) combined
        GROUP BY RTRIM(EmpCode)
    `);
    
    return result; // Returns ONLY from PR_LOOSEFRUIT
}
```

**Problem:** ❌ **TIDAK mengambil dari PR_ADTRANS!**

---

### 2. **DataExtractorService - getPremi()** ✅ CORRECT

**Location:** `backend/src/services/dataExtractorService.ts:1440`

```typescript
// ✅ CORRECT: getPremi() fetches from PR_ADTRANS with DocDesc LIKE '%PREMI%'
private async getPremi(empCodes: string[], startDate: string, endDate: string): Promise<{ amounts, titleMap, details }> {
    let rows = await db.query(`
        SELECT RTRIM(t.EmpCode) as emp_code, t.DocDesc as doc_desc, SUM(ln.Amount) as amount
        FROM (
            SELECT EmpCode, ID, DocDesc FROM PR_ADTRANS
            WHERE DocDate >= ? AND DocDate < ?
            UNION ALL
            SELECT EmpCode, ID, DocDesc FROM PR_ADTRANS_ARC
            WHERE DocDate >= ? AND DocDate < ?
        ) t
        JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
        WHERE UPPER(t.DocDesc) LIKE '%PREMI%' 
          AND UPPER(t.DocDesc) NOT LIKE '%PPH%'
          AND UPPER(t.DocDesc) NOT LIKE '%JABATAN%'
          AND UPPER(t.DocDesc) NOT LIKE '%BERAS%'
          AND UPPER(t.DocDesc) NOT LIKE '%MASA%'
          AND UPPER(t.DocDesc) NOT LIKE '%LEMBUR%'
        GROUP BY RTRIM(t.EmpCode), t.DocDesc
    `);
    
    return { amounts, titleMap, details }; // Returns PREMI from PR_ADTRANS
}
```

**Problem:** ✅ **SUDAH BENAR** - Mengambil premi dari PR_ADTRANS (termasuk "PREMI BRONDOL")

---

### 3. **Payroll Row Assembly** ✅ CORRECT

**Location:** `backend/src/services/dataExtractorService.ts:590-610`

```typescript
// ✅ CORRECT: Brondol ditambahkan ke empPremi
const empBrondol = brondol[emp.emp_code] || 0; // From PR_LOOSEFRUIT

// Add Brondol to empPremi first
if (empBrondol > 0) {
    empPremi["brondol"] = (empPremi["brondol"] || 0) + empBrondol;
    premiTitleMap["brondol"] = "PREMI BRONDOL";
}

// Then sum all premi (including brondol + premi from ADTRANS)
let total_premi = 0;
for (const [key, val] of Object.entries(empPremi)) {
    if (key !== "koreksi") {
        total_premi += amount;
    }
}
```

**Problem:** ✅ **SUDAH BENAR** - Brondol dari PR_LOOSEFRUIT ditambahkan ke empPremi

---

### 4. **SummaryService Aggregation** ❌ POTENTIAL ISSUE

**Location:** `backend/src/services/summaryService.ts:220-240`

```typescript
// Query from daftar_upah_aggregation_history
const query = `
    SELECT
        gang_code,
        division_code,
        ISNULL(total_premi, 0) as total_premi,
        ISNULL(total_premi_brondol, 0) as total_premi_brondol,
        ISNULL(total_premi_prunning, 0) as total_premi_prunning,
        ISNULL(total_premi_insentif, 0) as total_premi_insentif,
        ISNULL(total_premi_kinerja, 0) as total_premi_kinerja,
        ...
    FROM dbo.daftar_upah_aggregation_history
    WHERE period_month = ? AND period_year = ?
`;
```

**Problem:** ⚠️ **Depends on what was saved in aggregation_history**

---

### 5. **HistorySeederService** ❌ ROOT CAUSE

**Location:** `backend/src/services/historySeederService.ts:313-343`

```typescript
// When seeding aggregation history
const totals = {
    total_premi_brondol: 0,  // ← Initialized to 0
    total_premi_prunning: 0,
    total_premi_insentif: 0,
    total_premi_kinerja: 0,
    total_premi: 0
};

// Sum from payroll rows
for (const emp of data) {
    totals.total_premi_brondol += emp.premi_brondol || 0;  // ← Only from emp.premi_brondol
    totals.total_premi += emp.total_premi || 0;            // ← Includes brondol + all premi
}
```

**Problem:** ❌ **emp.premi_brondol MIGHT NOT include brondol from PR_ADTRANS!**

---

## 🔍 DATA FLOW ANALYSIS

### Correct Flow (Daftar Upah)

```
┌─────────────────────────────────────────────────────────────┐
│            DAFTAR UPAH - CORRECT FLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. getBrondol() → PR_LOOSEFRUIT                             │
│     Result: empBrondol = 100,000                             │
│                                                              │
│  2. getPremi() → PR_ADTRANS (DocDesc LIKE '%PREMI%')        │
│     Result: empPremi = {                                     │
│       "brondol": 50,000,    ← From ADTRANS "PREMI BRONDOL"  │
│       "panen": 200,000,                                      │
│       "kinerja": 150,000                                     │
│     }                                                        │
│                                                              │
│  3. Assembly:                                                │
│     empPremi["brondol"] = 100,000 + 50,000 = 150,000        │
│     total_premi = 150,000 + 200,000 + 150,000 = 500,000     │
│                                                              │
│  ✅ RESULT: total_premi = 500,000 (CORRECT)                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Potentially Incorrect Flow (Summary Report)

```
┌─────────────────────────────────────────────────────────────┐
│         SUMMARY REPORT - POTENTIAL ISSUE                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Query daftar_upah_aggregation_history                   │
│     SELECT total_premi, total_premi_brondol, ...            │
│                                                              │
│  2. If history was seeded with INCORRECT data:              │
│     total_premi_brondol = 100,000  ← Only from PR_LOOSEFRUIT│
│     total_premi = 500,000         ← Correct (includes all)  │
│                                                              │
│  3. User compares:                                           │
│     Daftar Upah: total_premi = 500,000 ✅                   │
│     Summary Report: total_premi = 500,000 ✅                │
│                                                              │
│     BUT: total_premi_brondol shows 100,000 ❌               │
│     Should be: 150,000 (100k + 50k)                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 IDENTIFIED ISSUES

### Issue 1: **Brondol Double-Counting Risk** ⚠️

**Scenario:**
- Brondol dari `PR_LOOSEFRUIT` = 100,000
- Brondol dari `PR_ADTRANS` (DocDesc "PREMI BRONDOL") = 50,000
- **Expected Total:** 150,000

**Current Behavior:**
```typescript
// In dataExtractorService.ts
const empBrondol = brondol[emp.emp_code] || 0; // 100,000 from PR_LOOSEFRUIT

// Add to empPremi
empPremi["brondol"] = (empPremi["brondol"] || 0) + empBrondol;
// empPremi["brondol"] = 0 + 100,000 = 100,000

// Then getPremi() returns:
empPremi = {
    "brondol": 50,000  // From PR_ADTRANS
}

// Assembly:
empPremi["brondol"] = 100,000 + 50,000 = 150,000 ✅ CORRECT
```

**Status:** ✅ **CURRENTLY CORRECT** - Brondol from both sources ARE being summed.

---

### Issue 2: **History Seeding Inconsistency** ❌

**Location:** `historySeederService.ts`

**Problem:**
```typescript
// When saving to aggregation_history
totals.total_premi_brondol += emp.premi_brondol || 0;
```

**Question:** Does `emp.premi_brondol` include brondol from BOTH sources?

**If NO:** Then `total_premi_brondol` in history table is INCORRECT.

---

### Issue 3: **Summary Report Backfill Logic** ⚠️

**Location:** `summaryService.ts:587-620`

```typescript
// getBackfillData() - Fallback to informasi_tambahan
if (Array.isArray(dynamicPremi)) {
    for (const item of dynamicPremi) {
        const header = (item.header || "").toUpperCase();
        const val = parseFloat(item.total || 0);
        
        if ((header.includes("PRUN") || header.includes("PRUNING")) 
            && !header.includes("BRONDOL")) {
            result[div].pruning += val;
        }
        // ❌ NO HANDLING FOR BRONDOL!
    }
}
```

**Problem:** Brondol is NOT extracted in backfill logic!

---

## 🧪 TEST SCENARIOS

### Test Case 1: Verify Brondol Sources

```sql
-- Test for employee H0033 in period 02/2026
DECLARE @EmpCode VARCHAR(50) = 'H0033';
DECLARE @StartDate DATE = '2026-02-01';
DECLARE @EndDate DATE = '2026-03-01';

-- Source 1: PR_LOOSEFRUIT
SELECT 'PR_LOOSEFRUIT' as source, SUM(LFLN.Amount) as amount
FROM PR_LOOSEFRUIT_ARC LF
JOIN PR_LOOSEFRUITLN_ARC LFLN ON LF.ID = LFLN.MasterID
WHERE LFLN.EmpCode = @EmpCode
  AND LF.DocDate >= @StartDate AND LF.DocDate < @EndDate;

-- Source 2: PR_ADTRANS (PREMI BRONDOL)
SELECT 'PR_ADTRANS' as source, SUM(ln.Amount) as amount
FROM (
    SELECT EmpCode, ID, DocDesc FROM PR_ADTRANS_ARC
    WHERE DocDate >= @StartDate AND DocDate < @EndDate
) t
JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
WHERE t.EmpCode = @EmpCode
  AND UPPER(t.DocDesc) LIKE '%PREMI%BRONDOL%';
```

**Expected Result:**
- PR_LOOSEFRUIT: 100,000
- PR_ADTRANS: 50,000
- **Total:** 150,000

---

### Test Case 2: Check Aggregation History

```sql
-- Check what's stored in aggregation_history for PG1B period 02/2026
SELECT 
    gang_code,
    total_premi,
    total_premi_brondol,
    total_premi_prunning,
    dynamic_premi_data
FROM daftar_upah_aggregation_history
WHERE division_code = 'P1B'
  AND period_month = 2 AND period_year = 2026;
```

**Check:**
- Does `total_premi_brondol` match the SUM from both sources?
- Does `dynamic_premi_data` include brondol entries?

---

## 🔧 RECOMMENDED FIXES

### Fix 1: **Clarify Brondol Naming** 🟡

**Problem:** Confusion between "brondol" from different sources.

**Solution:**
```typescript
// In dataExtractorService.ts
interface PayrollRow {
    premi_brondol_loosefruit: number;  // From PR_LOOSEFRUIT
    premi_brondol_adtrans: number;     // From PR_ADTRANS
    premi_brondol_total: number;       // Sum of both
}
```

---

### Fix 2: **Update History Seeder** 🟡

**Location:** `historySeederService.ts`

```typescript
// FIX: Ensure brondol from both sources is saved
for (const emp of data) {
    // emp.total_premi already includes brondol from both sources ✅
    totals.total_premi += emp.total_premi || 0;
    
    // emp.premi_brondol should be the TOTAL (loosefruit + adtrans)
    totals.total_premi_brondol += emp.premi_brondol || 0;
    
    // ADD: Save breakdown for transparency
    totals.premi_breakdown = {
        brondol_loosefruit: emp.premi_brondol_loosefruit || 0,
        brondol_adtrans: emp.premi_brondol_adtrans || 0,
        brondol_total: emp.premi_brondol || 0
    };
}
```

---

### Fix 3: **Add Validation** 🟢

**Location:** `dataExtractorService.ts`

```typescript
// VALIDATION: Ensure brondol is not double-counted
public async extractPayrollData(...): Promise<PayrollDataResult> {
    // ... existing logic
    
    for (const emp of employees) {
        const empBrondol = brondol[emp.emp_code] || 0;
        const empPremiFromAdtrans = premi[emp.emp_code] || {};
        
        // Check if brondol exists in both sources
        const brondolFromAdtrans = empPremiFromAdtrans["brondol"] || 0;
        
        if (empBrondol > 0 && brondolFromAdtrans > 0) {
            loggingService.warn(
                'DataExtractorService',
                'brondol_dual_source',
                `Employee ${emp.emp_code} has brondol from both sources`,
                {
                    loosefruit: empBrondol,
                    adtrans: brondolFromAdtrans,
                    total: empBrondol + brondolFromAdtrans
                }
            );
        }
    }
}
```

---

### Fix 4: **Update Summary Service Backfill** 🟡

**Location:** `summaryService.ts:getBackfillData()`

```typescript
if (Array.isArray(dynamicPremi)) {
    for (const item of dynamicPremi) {
        const header = (item.header || "").toUpperCase();
        const val = parseFloat(item.total || 0);
        
        // ADD BRONDOL HANDLING
        if (header.includes("BRONDOL")) {
            result[div].brondol += val;
        }
        else if ((header.includes("PRUN") || header.includes("PRUNING")) 
                 && !header.includes("BRONDOL")) {
            result[div].pruning += val;
        }
        if ((header.includes("INSENTIF") && header.includes("PANEN"))) {
            result[div].insentif += val;
        }
        if (header.includes("KINERJA")) {
            result[div].kinerja += val;
        }
        if (header.includes("LEMBUR") || header.includes("OVERTIME")) {
            result[div].lembur += val;
        }
    }
}
```

---

## 📋 ACTION PLAN

### Phase 1: Investigation (Immediate) 🔴

| Task | Priority | ETA |
|------|----------|-----|
| Run Test Case 1 SQL query | P0 | 30 min |
| Verify brondol amounts from both sources | P0 | 1 hour |
| Check aggregation_history for PG1B/PG2A | P0 | 1 hour |
| Compare Daftar Upah vs Summary Report | P0 | 1 hour |

---

### Phase 2: Fixes (Week 1) 🟡

| Task | Priority | ETA |
|------|----------|-----|
| Update `historySeederService.ts` to save brondol breakdown | P1 | 2 hours |
| Update `summaryService.ts:getBackfillData()` to handle brondol | P1 | 1 hour |
| Add validation logging for dual-source brondol | P2 | 1 hour |
| Re-seed aggregation_history for affected periods | P1 | 2 hours |

---

### Phase 3: Prevention (Week 2) 🟢

| Task | Priority | ETA |
|------|----------|-----|
| Add unit tests for brondol calculation | P1 | 2 hours |
| Add integration tests for end-to-end brondol flow | P1 | 3 hours |
| Document brondol sources in code comments | P2 | 1 hour |
| Add data quality checks for premi consistency | P2 | 2 hours |

---

## 🎯 SUCCESS CRITERIA

After fixes:

- [ ] **Daftar Upah total_premi** = **Summary Report total_premi** (±0)
- [ ] **total_premi_brondol** includes BOTH sources (loosefruit + adtrans)
- [ ] **dynamic_premi_data** includes brondol breakdown
- [ ] **Backfill logic** correctly handles brondol
- [ ] **Unit tests** pass for brondol calculation
- [ ] **Integration tests** pass for end-to-end flow

---

## 📚 RELATED DOCUMENTATION

- `CLEAN_CODE_AUDIT_REPORT.md` - Clean code violations
- `INCONSISTENCIES_OOP_RECOMMENDATIONS.md` - OOP service recommendations
- `REFACTORING_IMPLEMENTATION_PLAN.md` - Main refactoring plan
- `DOCDESC_MAPPING_GUIDE.md` - DocDesc to payroll component mapping

---

*Created: 2026-03-08*
