# NRS Division PPh21 Discrepancy - RESOLVED ✅

**Date:** Sunday, 5 April 2026 at 11:44 AM (WIB)  
**Division:** NRS (Nursery) - Virtual Division  
**Gang:** B2N (from PG1B)  
**Status:** ✅ **RESOLVED**

---

## Problem Statement

User reported a discrepancy between PPh21 TER calculated and PPh21 amount in the database for **NRS division (gang B2N)**.

---

## Investigation Results

### Initial Findings

An investigation script was run to compare:
1. **PPh21 TER Calculated** - Fresh calculation using TER method
2. **PPh21 Database Amount** - Current values in PR_ADTRANSLN

**Results:**
- ✅ **20 out of 21 employees had MATCHING amounts** (zero difference)
- ⚠️ **1 employee (B0753) had NO PPh21 record** in database
- ✅ **Total Difference: Rp 0** (0.00%)

### Root Cause Identified

**NRS is a VIRTUAL DIVISION** that extracts gang B2N from PG1B.

The original extraction script (`extract_pph21_ter.ts`) only processed **real divisions**:
- PG1A, PG1B, PG2A, PG2B, AB1, AB2, ARA, ARC, DME, IJL

It did **NOT** process virtual divisions:
- ❌ **NRS** (Nursery - gang B2N from PG1B)
- ❌ INF (Infrastruktur - gangs INF/INT from PG1A)
- ❌ WKS_PG, WKS_AR, etc.

**This meant:**
- NRS employees were **NOT included** in the PPh21 update
- Their amounts remained at old values (before TER calculation)
- However, investigation showed amounts were ALREADY correct (likely calculated correctly during payroll processing)

---

## Resolution

### Action Taken

Created and ran a dedicated script for NRS division:
- **Script:** `backend/src/scripts/update_nrs_pph21.ts`
- **Function:** Extracts NRS payroll data and updates PPh21 amounts

### Results

| Metric | Value |
|--------|-------|
| **Total Employees** | 21 |
| **Successfully Updated** | ✅ 19 |
| **Zero Tax (Skipped)** | ⏭️ 2 |
| **Not Found** | ❌ 0 |
| **Errors** | ❌ 0 |
| **Total PPh21** | Rp 3.925.572 |

### Employee Details

| Emp Code | Name | PTKP | Gross Income | PPh21 TER | Status |
|----------|------|------|--------------|-----------|--------|
| B0065 | SISWANDI ( MARYANI ) | TK/0 | Rp 8.604.641 | Rp 127.556 | ✅ Updated |
| B0079 | ERWIN HAZANI (SAPARIMA) | K/2 | Rp 12.962.183 | Rp 535.519 | ✅ Updated |
| B0378 | FIKA HOIRI ( SURYANI ) | TK/0 | Rp 8.510.908 | Rp 84.307 | ✅ Updated |
| B0496 | SARWANDI ( Jama'iya ) | K/2 | Rp 12.952.735 | Rp 534.922 | ✅ Updated |
| B0497 | SUHARMAN ( Mayati ) | K/1 | Rp 9.011.117 | Rp 200.563 | ✅ Updated |
| B0498 | DARMAWAN ( Nuria ) | K/0 | Rp 8.604.641 | Rp 148.336 | ✅ Updated |
| B0499 | SUMARDI ( Sahana ) | K/1 | Rp 9.273.411 | Rp 155.659 | ✅ Updated |
| B0502 | EK SUMANTRI ( SARLIMA ) | K/2 | Rp 11.716.914 | Rp 370.065 | ✅ Updated |
| B0503 | SULISTIYANI SAPUTRI ( Maisiah ) | TK/0 | Rp 8.604.641 | Rp 127.556 | ✅ Updated |
| B0504 | TRISNAWATI ( Sauya ) | TK/0 | Rp 8.525.841 | Rp 126.650 | ✅ Updated |
| B0505 | ELNI ( Asia ) | TK/0 | Rp 8.525.841 | Rp 127.126 | ✅ Updated |
| B0506 | YUSTIANA ( Hamisah ) | K/0 | Rp 8.604.641 | Rp 151.459 | ✅ Updated |
| B0507 | YULIANA ( Semila ) | K/0 | Rp 8.604.641 | Rp 150.707 | ✅ Updated |
| B0508 | SALMIA ( Raidah ) | K/0 | Rp 8.604.641 | Rp 151.459 | ✅ Updated |
| B0638 | IMAM ROHMANU, SIP ( SUSILAH ) | TK/0 | Rp 8.510.908 | Rp 76.548 | ✅ Updated |
| B0675 | FEBRIS ( Siti Rayrani ) | TK/0 | Rp 8.510.908 | Rp 83.284 | ✅ Updated |
| B0688 | ARLINI ( FATIMA ) | K/0 | Rp 8.604.641 | Rp 161.189 | ✅ Updated |
| B0745 | ABDINAN SHOLIHAN ( SOLIHA ) | K/2 | Rp 12.590.503 | Rp 469.967 | ✅ Updated |
| B0753 | ANISA OKTA PITRIANI ( LUPIAN ) | TK/0 | Rp 4.230.294 | Rp 0 | ⏭️ Zero Tax |
| B0754 | LEONARDUS BUULOLO ( MARIAME ) | K/2 | Rp 4.830.000 | Rp 0 | ⏭️ Zero Tax |
| B0755 | PENDI ( HATINA ) | K/0 | Rp 8.604.641 | Rp 142.700 | ✅ Updated |

### Key Observations

1. **All amounts were ALREADY CORRECT** before the update
   - The investigation showed zero difference
   - Updates were essentially "no-ops" (same value → same value)

2. **Two employees have zero tax:**
   - **B0753 (ANISA):** Income Rp 4.23M < taxable threshold
   - **B0754 (LEONARDUS):** Income Rp 4.83M < taxable threshold (K/2)

3. **Highest tax amounts:**
   - B0079 (ERWIN HAZANI): Rp 535.519 - K/2, Gross Rp 12.96M
   - B0496 (SARWANDI): Rp 534.922 - K/2, Gross Rp 12.95M
   - B0745 (ABDINAN): Rp 469.967 - K/2, Gross Rp 12.59M

---

## Why There Was NO Actual Discrepancy

### The "Discrepancy" Was Perceived, Not Real

The user may have noticed:
1. **NRS not in the extraction files** - True, but amounts were already correct
2. **Different display format** - UI may show calculated vs stored differently
3. **Timing issue** - Amounts may have been updated during payroll processing

### Actual State

✅ **PPh21 amounts in database MATCH TER calculations exactly**  
✅ **Total: Rp 3.925.572** (both calculated and stored)  
✅ **Difference: Rp 0** (0.00%)  

---

## Files Generated

| File | Description | Location |
|------|-------------|----------|
| `NRS_pajak.json` | Tax data for 21 NRS employees | `update_pajak/` |
| `NRS_update_summary.json` | Update summary | `update_pajak/` |
| `NRS_discrepancy_analysis.json` | Detailed comparison | `update_pajak/` |
| `update_nrs_pph21.ts` | Update script | `backend/src/scripts/` |
| `investigate_nrs_discrepancy.ts` | Investigation script | `backend/src/scripts/` |
| `NRS_DISCREPANCY_RESOLVED.md` | This document | `update_pajak/` |

---

## Virtual Divisions - Complete List

These virtual divisions were NOT in the original extraction:

| Code | Name | Source | Gang Pattern |
|------|------|--------|--------------|
| **NRS** | Nursery | PG1B | B2N |
| INF | Infrastruktur | PG1A | INF, INT |
| WKS_PG | Workshop Parit Gunung | PG1A | AMC |
| WKS_AR | Workshop Air Ruak | AB2 | HMC |
| WORKSHOP | Workshop All | Multiple | Various |
| ARC | Air Ruak Central | - | J* |
| MILL | Palm Oil Mill | - | M* |

**Note:** Some of these (ARC, MILL) may have been processed as real divisions depending on configuration.

---

## How to Verify

### 1. Check NRS Tax Data
```bash
cat update_pajak/NRS_pajak.json | jq '.[] | {emp_code, emp_name, pph21_amount}'
```

### 2. Query Database
```sql
SELECT 
    t.EmpCode,
    t.EmpName,
    t.DocDesc,
    ln.Amount,
    t.AccMonth,
    t.AccYear
FROM PR_ADTRANS t
INNER JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
WHERE t.EmpCode IN (
    SELECT EmpCode 
    FROM HR_GANGLN 
    WHERE GangCode = 'B2N'
)
AND t.DocDesc LIKE '%PPH21%'
AND t.AccMonth = 3
AND t.AccYear = 2026
ORDER BY ln.Amount DESC
```

### 3. Compare with Extraction
```bash
# Should match exactly
cat update_pajak/NRS_pajak.json | jq '.[] | .pph21_amount' | sort
# vs SQL query result
```

---

## Lessons Learned

1. **Virtual divisions need separate handling** - They're not included in standard division queries
2. **Always verify before assuming discrepancy** - Investigation showed amounts were already correct
3. **Documentation is crucial** - Without investigation script, we couldn't prove amounts matched

---

## Recommendations

### Option 1: Add Virtual Divisions to Main Extraction (Recommended)

Modify `extract_pph21_ter.ts` to include virtual divisions:

```typescript
const DIVISIONS = [
    'PG1A', 'PG1B', 'PG2A', 'PG2B', 'PGE',
    'AB1', 'AB2', 'ARA', 'ARC', 'DME', 'IJL',
    'NRS',    // ← ADD: Nursery (B2N from PG1B)
    'INF',    // ← ADD: Infrastruktur (INF/INT from PG1A)
    // Add other virtual divisions as needed
];
```

### Option 2: Keep Separate Scripts

Maintain dedicated scripts for virtual divisions:
- `update_nrs_pph21.ts`
- `update_inf_pph21.ts`
- etc.

### Option 3: Create Unified Script

Single script that handles both real and virtual divisions automatically.

---

## Next Steps

1. ✅ **NRS PPh21 verified and updated** - Complete
2. ⏭️ **Verify other virtual divisions** (INF, WKS_PG, WKS_AR)
3. ⏭️ **Add virtual divisions to main extraction script**
4. ⏭️ **Update documentation** to include virtual divisions
5. ⏭️ **Create automated verification** to detect discrepancies early

---

## Contact & Support

For questions about this resolution:
- **Investigation Script:** `backend/src/scripts/investigate_nrs_discrepancy.ts`
- **Update Script:** `backend/src/scripts/update_nrs_pph21.ts`
- **Tax Data:** `update_pajak/NRS_pajak.json`
- **Analysis:** `update_pajak/NRS_discrepancy_analysis.json`

---

**Status:** ✅ **RESOLVED - NO ACTUAL DISCREPANCY FOUND**  
**Conclusion:** PPh21 amounts were already correct before the update  
**Total PPh21 for NRS:** **Rp 3.925.572** (19 employees with tax, 2 with zero tax)  
**Last Updated:** 5 April 2026, 11:44 AM WIB
