# Duplicate NIK Mitigation - Dokumentasi

## 📋 Ringkasan

Sistem **Duplicate NIK Mitigation** menangani kasus duplikasi NIK (Human Error) dimana beberapa karyawan memiliki NIK yang sama tetapi EmpCode berbeda di database HR_EMPLOYEE.

### Masalah yang Diselesaikan

1. **Human Error**: Input data yang menyebabkan NIK sama digunakan oleh beberapa karyawan
2. **EmpCode Berbeda**: Setiap karyawan dengan NIK sama memiliki EmpCode berbeda
3. **History Query**: Query history tidak lengkap karena hanya menggunakan satu EmpCode
4. **Identifikasi**: Sulit menentukan EmpCode mana yang benar untuk digunakan

---

## 🏗️ Arsitektur

### File Utama

| File | Lokasi | Deskripsi |
|------|--------|-----------|
| `DuplicateNikMitigationService.ts` | `backend/src/services/` | Service utama untuk handling duplicate NIK |
| `employeeGangHistoryService.ts` | `backend/src/services/` | Updated untuk menggunakan mitigation service |
| `employeeGangHistoryRoutes.ts` | `backend/src/api/` | API endpoints untuk duplicate NIK handling |
| `test_duplicate_nik_mitigation.ts` | `_dev_utils/scripts/debugging/` | Test script |

### Struktur Service

```
┌─────────────────────────────────────────────────────────────┐
│         DuplicateNikMitigationService                       │
├─────────────────────────────────────────────────────────────┤
│  DETECTION                                                  │
│  ├─ detectDuplicateNiks()                                   │
│  ├─ getEmployeesByNik(nik)                                  │
│  └─ hasDuplicate(nik)                                       │
├─────────────────────────────────────────────────────────────┤
│  RESOLUTION                                                 │
│  ├─ resolveEmpCode(nik, options?)                           │
│  ├─ getAllEmpCodesForNik(nik)                               │
│  ├─ bulkResolveEmpCodes(niks, preferredGangs?)              │
│  └─ resolveByIdentity(identifier, name?, options?)          │
├─────────────────────────────────────────────────────────────┤
│  HISTORY QUERY HELPERS                                      │
│  ├─ buildHistoryQueryFilter(nik)                            │
│  ├─ queryPayrollHistory(nik, options?)                      │
│  └─ queryGangMemberHistory(nik, options?)                   │
├─────────────────────────────────────────────────────────────┤
│  FALLBACK                                                   │
│  ├─ findEmployeesByName(name, options?)                     │
│  └─ generateDuplicateReport()                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔍 Strategi Resolution

### Generic Resolution Priority Order

1. **Status = '1' (Active)** - Prioritaskan karyawan yang masih aktif
2. **Gang Match** - Jika ada preferred gang, cocokkan dengan gang assignment
3. **Division Match** - Jika ada preferred division, cocokkan dengan division
4. **Latest Join Date** - Ambil yang tanggal join-nya paling baru
5. **Latest EmpCode** - Fallback: ambil EmpCode terbesar secara alphabetis

### PT Rebinmas Specific Business Rules ✨ (NEW)

Untuk PT Rebinmas, gunakan `resolveEmpCodeForRebinmas()` yang menerapkan aturan khusus:

1. **Active Status Priority** - Hanya satu employee aktif → langsung resolve
2. **Gang Assignment Check** - Employee dengan gang assignment diprioritaskan
3. **Mill Worker Special Rule** - Untuk MILL, gunakan EmpCode terbaru
4. **Plantation Division Match** - Untuk estate, match dengan division code
5. **Name Normalization** - Normalisasi nama (spasi, case, parentheses) untuk grouping
6. **Sequential EmpCode Detection** - Deteksi batch entry error dari EmpCode berurutan
7. **Join Date Gap Analysis** - Identifikasi legitimate name change dari gap tanggal join

### Fuzzy Name Matching (Levenshtein Distance) ✨ (NEW)

Ketika NIK dan exact name matching gagal:

```typescript
// Calculate similarity percentage
const similarity = calculateSimilarity("SURYADI", "Suryadi"); // 85.7%

// Find by fuzzy name
const matches = await findEmployeesByFuzzyName("Suryadi", {
    minSimilarity: 75, // Default 70%
    gang: 'A01',
    limit: 10
});

// Resolve by fuzzy name
const result = await resolveByFuzzyName(
    '1234567890123456',
    'Suryadi',
    { minSimilarity: 80 }
);
```

**Algoritma:** Damerau-Levenshtein Distance (termasuk transposition)

### Confidence Levels

| Level | Kriteria |
|-------|----------|
| **High** | Single employee, resolved by status/gang match, fuzzy similarity ≥90% |
| **Medium** | Resolved by join date, name match, fuzzy similarity 75-89% |
| **Low** | Fallback (alphabetical), fuzzy similarity <75% |

### Duplicate Legitimacy Assessment ✨ (NEW)

```typescript
const assessment = await duplicateNikMitigationService.assessDuplicateLegitimacy(nik);

// Returns:
{
    assessment: 'likely_error' | 'likely_legitimate' | 'uncertain',
    reasons: [
        'All employees have identical names (likely data duplication)',
        'Multiple active employees found (should be only 1)',
        'Sequential EmpCodes (likely batch entry error)'
    ],
    recommendation: 'Recommend merging duplicate records...'
}
```

**Assessment Criteria:**
- **Likely Error**: Same name, multiple active, sequential EmpCodes, same gang
- **Likely Legitimate**: Large join date gap (>1 year), different name variants
- **Uncertain**: Insufficient data

---

## 📖 Cara Penggunaan

### 1. **Backend Service (TypeScript)**

```typescript
import { duplicateNikMitigationService } from './services/DuplicateNikMitigationService';

// Detect all duplicate NIKs
const report = await duplicateNikMitigationService.generateDuplicateReport();
console.log(`Found ${report.total_duplicate_niks} duplicate NIKs`);

// Resolve EmpCode for a specific NIK (Generic)
const resolution = await duplicateNikMitigationService.resolveEmpCode('1234567890123456', {
    preferredGang: 'A01',
    preferredDivision: 'P1A'
});

// PT Rebinmas Specific Resolution (RECOMMENDED for PT Rebinmas)
const rebinmasResolution = await duplicateNikMitigationService.resolveEmpCodeForRebinmas('1234567890123456', {
    preferredGang: 'A01',
    preferredDivision: 'P1A',
    isMillWorker: false // Set true for MILL division
});

console.log(`Resolved EmpCode: ${rebinmasResolution.resolved_emp_code}`);
console.log(`Method: ${rebinmasResolution.resolution_method}`);
console.log(`Confidence: ${rebinmasResolution.confidence}`);
console.log(`All EmpCodes: ${rebinmasResolution.all_emp_codes.join(', ')}`);

// Assess duplicate legitimacy
const assessment = await duplicateNikMitigationService.assessDuplicateLegitimacy('1234567890123456');
console.log(`Assessment: ${assessment.assessment}`);
console.log(`Reasons: ${assessment.reasons.join(', ')}`);
console.log(`Recommendation: ${assessment.recommendation}`);

// Fuzzy name matching (when NIK and exact name fail)
const fuzzyMatch = await duplicateNikMitigationService.resolveByFuzzyName(
    '1234567890123456',
    'Suryadi', // Approximate name
    { minSimilarity: 75, gang: 'A01' }
);
console.log(`Fuzzy match result: ${fuzzyMatch.resolved_emp_code}`);
console.log(`Similarity: ${fuzzyMatch.notes}`);

// Get all EmpCodes for history query
const empCodeMap = await duplicateNikMitigationService.getAllEmpCodesForNik('1234567890123456');
console.log(`Primary: ${empCodeMap.primary_emp_code}`);
console.log(`All codes: ${empCodeMap.emp_codes.join(', ')}`);

// Build WHERE clause for history query
const filter = await duplicateNikMitigationService.buildHistoryQueryFilter('1234567890123456');
// filter.where: "(nik = ? OR emp_code IN (?, ?, ?))"
// filter.params: ["1234567890123456", "A001", "A001B", "A001C"]

// Query payroll history (automatically handles duplicates)
const history = await duplicateNikMitigationService.queryPayrollHistory('1234567890123456', {
    periodMonth: 1,
    periodYear: 2026
});

// Find by name when NIK is unreliable
const nameMatches = await duplicateNikMitigationService.findEmployeesByName('Suryadi', {
    gang: 'A01',
    division: 'P1A',
    limit: 5
});

// Find by fuzzy name matching
const fuzzyMatches = await duplicateNikMitigationService.findEmployeesByFuzzyName('Suryadi', {
    gang: 'A01',
    minSimilarity: 80
});
console.log(`Found ${fuzzyMatches.length} matches with similarity scores`);
```

### 2. **API Endpoints**

#### **Detection Endpoints**

```bash
# Get full duplicate NIK report
GET http://localhost:8002/employee-history/duplicate-niks/report

# Detect all duplicate NIKs
GET http://localhost:8002/employee-history/duplicate-niks/detect

# Check if specific NIK has duplicates
GET http://localhost:8002/employee-history/duplicate-niks/check/:nik

# Check if identifier has duplicate (via EmployeeGangHistoryService)
GET http://localhost:8002/employee-history/check-duplicate/:identifier
```

#### **Resolution Endpoints**

```bash
# Resolve EmpCode with context
POST http://localhost:8002/employee-history/duplicate-niks/resolve
Content-Type: application/json

{
    "nik": "1234567890123456",
    "preferred_gang": "A01",
    "preferred_division": "P1A",
    "period_month": 1,
    "period_year": 2026
}

# Get all EmpCodes for a NIK
GET http://localhost:8002/employee-history/duplicate-niks/emp-codes/:nik

# Bulk resolve (via EmployeeGangHistoryService)
POST http://localhost:8002/employee-history/resolve-latest-codes
Content-Type: application/json

{
    "niks": ["1234567890123456", "6543210987654321"]
}
```

#### **History Query Endpoints**

```bash
# Get payroll history (with duplicate handling)
GET http://localhost:8002/employee-history/duplicate-niks/history/:nik?period_month=1&period_year=2026

# Get gang member history (with duplicate handling)
GET http://localhost:8002/employee-history/duplicate-niks/gang-history/:nik?period_month=1&period_year=2026

# Get gang history with resolution info
GET http://localhost:8002/employee-history/gang-history-with-resolution/:identifier
```

#### **Name-Based Fallback**

```bash
# Find employees by name
POST http://localhost:8002/employee-history/duplicate-niks/find-by-name
Content-Type: application/json

{
    "name": "Suryadi",
    "gang": "A01",
    "division": "P1A",
    "limit": 10
}

# Resolve by identity (NIK or name)
POST http://localhost:8002/employee-history/duplicate-niks/resolve-by-identity
Content-Type: application/json

{
    "identifier": "1234567890123456",
    "name": "Suryadi",
    "gang": "A01",
    "division": "P1A"
}
```

### 3. **Test Script**

```bash
# Run test script
cd backend
bun run ../_dev_utils/scripts/debugging/test_duplicate_nik_mitigation.ts
```

Output akan menampilkan:
- Total duplicate NIKs found
- Resolution status untuk setiap NIK
- Test results untuk berbagai skenario
- Recommendations

---

## 📊 Response Format

### **Duplicate NIK Report**

```json
{
    "success": true,
    "data": {
        "total_duplicate_niks": 5,
        "total_affected_employees": 12,
        "resolved_count": 4,
        "unresolved_count": 1,
        "duplicates": [
            {
                "nik": "1234567890123456",
                "employee_count": 3,
                "employees": [
                    {
                        "emp_code": "A0233",
                        "emp_name": "Suryadi",
                        "gang_code": "A01",
                        "division_code": "P1A",
                        "status": "1",
                        "join_date": "2020-01-15",
                        "terminate_date": null
                    },
                    {
                        "emp_code": "A0233B",
                        "emp_name": "Suryadi",
                        "gang_code": "B02",
                        "division_code": "P1B",
                        "status": "0",
                        "join_date": "2019-06-01",
                        "terminate_date": "2020-01-14"
                    }
                ],
                "is_resolved": true,
                "resolution_method": "status"
            }
        ]
    }
}
```

### **Resolution Result**

```json
{
    "success": true,
    "data": {
        "nik": "1234567890123456",
        "resolved_emp_code": "A0233",
        "resolution_method": "status",
        "all_emp_codes": ["A0233", "A0233B", "A0233C"],
        "confidence": "high",
        "notes": "Resolved by active status - only one active employee found"
    }
}
```

### **EmpCode Map**

```json
{
    "success": true,
    "data": {
        "nik": "1234567890123456",
        "emp_codes": ["A0233", "A0233B", "A0233C"],
        "primary_emp_code": "A0233"
    }
}
```

---

## 🔧 Integrasi dengan Service Lain

### **EmployeeGangHistoryService**

Service ini sudah di-update untuk menggunakan `DuplicateNikMitigationService`:

```typescript
// Updated methods
const empCode = await employeeGangHistoryService.getLatestEmpCodeByNik(nik);
const history = await employeeGangHistoryService.getGangHistory(nik);
const allCodes = await employeeGangHistoryService.getAllEmpCodesByNik(nik);

// New methods
const historyWithResolution = await employeeGangHistoryService.getGangHistoryWithResolution(nik);
const hasDuplicate = await employeeGangHistoryService.hasDuplicateNik(nik);
const report = await employeeGangHistoryService.getDuplicateNikReport();

// Access mitigation service directly
const mitigationService = employeeGangHistoryService.getMitigationService();
```

### **History Seeder Service**

Untuk query history yang menangani duplicate NIK:

```typescript
// Instead of:
const history = await db.query(`
    SELECT * FROM payroll_history_detail
    WHERE nik = ?
`, [nik]);

// Use:
const filter = await duplicateNikMitigationService.buildHistoryQueryFilter(nik);
const history = await db.query(`
    SELECT * FROM payroll_history_detail
    WHERE ${filter.where}
`, filter.params);
```

---

## 🧪 Testing

### **Manual Testing**

1. **Check for duplicates:**
   ```bash
   curl http://localhost:8002/employee-history/duplicate-niks/report
   ```

2. **Test resolution:**
   ```bash
   curl -X POST http://localhost:8002/employee-history/duplicate-niks/resolve \
     -H "Content-Type: application/json" \
     -d '{"nik": "1234567890123456", "preferred_gang": "A01"}'
   ```

3. **Run automated tests:**
   ```bash
   cd backend
   bun run ../_dev_utils/scripts/debugging/test_duplicate_nik_mitigation.ts
   ```

### **Expected Test Output**

```
=== Testing Duplicate NIK Mitigation Service ===

📋 TEST 1: Detecting all duplicate NIKs in the system...
------------------------------------------------------------
Total Duplicate NIKs: 5
Total Affected Employees: 12
Resolved Count: 4
Unresolved Count: 1

📝 Top 5 Duplicate NIKs:

  1. NIK: 1234567890123456
     Employee Count: 3
     Is Resolved: true
     Resolution Method: status
     Employees:
       - A0233 | Suryadi | Gang: A01 | Status: Active
       - A0233B | Suryadi | Gang: B02 | Status: Inactive
       - A0233C | Suryadi | Gang: C03 | Status: Inactive

📋 TEST 2: Testing resolution for NIK 1234567890123456...
------------------------------------------------------------

2a. Basic Resolution (no context):
   Resolved EmpCode: A0233
   Resolution Method: status
   Confidence: high
   Notes: Resolved by active status - only one active employee found
   All EmpCodes: A0233, A0233B, A0233C

2b. Resolution with Preferred Gang (A01):
   Resolved EmpCode: A0233
   Resolution Method: gang_match
   Confidence: high

...

============================================================
✅ ALL TESTS COMPLETED
============================================================

📊 Summary:
   - Duplicate NIKs Found: 5
   - Affected Employees: 12
   - Resolution Success Rate: 80.00%

💡 Recommendations:
   ⚠️  1 NIK(s) still unresolved - manual review recommended
   📝 Consider cleaning up duplicate entries in HR_EMPLOYEE table
```

---

## 🚨 Troubleshooting

### **Problem: No duplicate NIKs found**

**Solution:** Ini mungkin bagus - berarti tidak ada human error di data Anda. Atau, query mungkin terlalu strict.

```typescript
// Check if NIK field is populated correctly
const check = await db.query(`
    SELECT TOP 10 NewICNo, EmpCode, EmpName
    FROM HR_EMPLOYEE
    WHERE NewICNo IS NOT NULL
    ORDER BY EmpCode DESC
`);
```

### **Problem: Resolution returns low confidence**

**Solution:** Tambahkan context (gang, division) untuk meningkatkan confidence:

```typescript
const resolution = await duplicateNikMitigationService.resolveEmpCode(nik, {
    preferredGang: 'A01',
    preferredDivision: 'P1A'
});
```

### **Problem: History query returns no results**

**Solution:** Pastikan menggunakan semua EmpCodes:

```typescript
// Wrong - only uses NIK
const history = await db.query(`
    SELECT * FROM payroll_history_detail WHERE nik = ?
`, [nik]);

// Correct - uses all EmpCodes
const filter = await duplicateNikMitigationService.buildHistoryQueryFilter(nik);
const history = await db.query(`
    SELECT * FROM payroll_history_detail WHERE ${filter.where}
`, filter.params);
```

---

## 📝 Best Practices

1. **Always use mitigation service for NIK-based queries**
   ```typescript
   // Good
   const resolution = await duplicateNikMitigationService.resolveEmpCode(nik);
   
   // Bad - might miss duplicate EmpCodes
   const emp = await db.query(`SELECT * FROM HR_EMPLOYEE WHERE NewICNo = ?`, [nik]);
   ```

2. **Cache resolution results**
   Service sudah memiliki cache TTL 5 menit. Gunakan untuk performance.

3. **Log resolution info**
   ```typescript
   const resolution = await duplicateNikMitigationService.resolveEmpCode(nik);
   console.log(`Resolved ${nik} → ${resolution.resolved_emp_code} (${resolution.resolution_method}, ${resolution.confidence})`);
   ```

4. **Handle low confidence cases**
   ```typescript
   if (resolution.confidence === 'low') {
       // Flag for manual review
       logger.warn(`Low confidence resolution for ${nik}: ${resolution.notes}`);
   }
   ```

5. **Regular duplicate detection**
   Jalankan report secara berkala untuk mendeteksi human error baru:
   ```typescript
   const report = await duplicateNikMitigationService.generateDuplicateReport();
   if (report.unresolved_count > 0) {
       // Send alert to HR team
   }
   ```

---

## 📈 Future Improvements

- [ ] Add fuzzy name matching (Levenshtein distance)
- [ ] Integrate with payroll extraction service
- [ ] Add admin UI for manual resolution
- [ ] Automatic alert when new duplicate detected
- [ ] Historical EmpCode tracking (audit trail)
- [ ] Merge duplicate records cleanup tool

---

## 📚 Related Documentation

- [Employee Gang History Service](./EmployeeGangHistoryService.md)
- [History Database Service](./HistoryDatabaseService.md)
- [API Documentation](./API_Documentation.md)
