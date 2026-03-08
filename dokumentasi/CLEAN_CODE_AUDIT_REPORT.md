# 🧹 CLEAN CODE AUDIT REPORT
## Analisis Pelanggaran Clean Code Principles

**Document Version:** 1.0  
**Created:** 2026-03-08  
**Audit Scope:** `backend/src/services/`  

---

## 📊 EXECUTIVE SUMMARY

Berdasarkan analisis mendalam terhadap codebase, ditemukan **86 clean code violations** yang perlu diperbaiki.

### Violation Summary

| Category | Count | Severity | Priority |
|----------|-------|----------|----------|
| **Single Responsibility Principle** | 12 | 🔴 HIGH | P0 |
| **Type Safety (any usage)** | 47 | 🔴 HIGH | P0 |
| **Magic Numbers/Strings** | 15 | 🟡 MEDIUM | P1 |
| **Debug Code in Production** | 8 | 🟡 MEDIUM | P1 |
| **Inconsistent Error Handling** | 4 | 🟡 MEDIUM | P1 |
| **Long Methods** | 3 | 🟡 MEDIUM | P1 |
| **Duplicate Logic** | 5 | 🟡 MEDIUM | P1 |
| **Poor Naming** | 7 | 🟢 LOW | P2 |

---

## 🔴 PRIORITY 0: CRITICAL VIOLATIONS

### 1. **Single Responsibility Principle - God Classes** ❌

#### **dataExtractorService.ts** - 2341 lines! 🔴

**Problems:**
```typescript
// ❌ VIOLATION: Service ini melakukan TERLALU BANYAK hal:
export class DataExtractorService {
    // 1. Fetch employees
    // 2. Fetch attendance  
    // 3. Fetch cuti
    // 4. Fetch premi
    // 5. Fetch potongan
    // 6. Fetch lembur
    // 7. Fetch brondol
    // 8. Fetch jabatan
    // 9. Fetch masa kerja
    // 10. Calculate gaji pokok
    // 11. Calculate tax
    // 12. Resolve employee codes
    // 13. Build payroll rows
    // ... DAN MASIH BANYAK LAGI
}
```

**Impact:**
- 2341 lines = sangat sulit di-maintain
- Sulit di-test (terlalu banyak dependencies)
- High coupling dengan banyak services
- Violates SRP secara parah

**Solution:**
```typescript
// ✅ REFACTOR: Break into smaller services

// 1. EmployeeDataService - Fetch employee master data
export class EmployeeDataService {
    async getEmployees(gangCode: string, month: number, year: number): Promise<Employee[]> {}
}

// 2. AttendanceService - Fetch and calculate attendance
export class AttendanceService {
    async getAttendance(empCodes: string[], month: number, year: number): Promise<AttendanceMap> {}
    async calculateWorkingDays(attendance: Attendance, cuti: Cuti): Promise<number> {}
}

// 3. AllowancesService - Fetch all allowances
export class AllowancesService {
    async getPremi(empCodes: string[], month: number, year: number): Promise<PremiMap> {}
    async getPotongan(empCodes: string[], month: number, year: number): Promise<PotonganMap> {}
    async getJabatan(empCodes: string[]): Promise<JabatanMap> {}
    async getMasaKerja(empCodes: string[]): Promise<MasaKerjaMap> {}
}

// 4. DeductionsService - Fetch and calculate deductions
export class DeductionsService {
    async calculateBPJS(upahDasar: number, masaKerja: number): Promise<BPJSResult> {}
    async calculatePPh21(grossIncome: number, ptkpStatus: string): Promise<TaxResult> {}
}

// 5. PayrollBuilderService - Assemble final payroll
export class PayrollBuilderService {
    buildPayrollRow(components: PayrollComponents): PayrollRow {}
}
```

**Migration Plan:**
1. Extract `getPremi()` → `AllowancesService.getPremi()`
2. Extract `getPotongan()` → `AllowancesService.getPotongan()`
3. Extract `getAttendance()` → `AttendanceService`
4. Extract employee fetching → `EmployeeDataService`
5. Keep `DataExtractorService` as orchestrator only

---

#### **summaryService.ts** - 1517 lines 🔴

**Problems:**
```typescript
// ❌ VIOLATION: Service melakukan aggregation + reporting + caching + DB queries
export class SummaryService {
    // Aggregation logic
    // Report generation
    // Cache management
    // DB queries
    // JSON file loading
    // Thumbprint integration
    // Division mapping
    // Gang mapping
}
```

**Solution:**
```typescript
// ✅ REFACTOR: Split responsibilities

export class SummaryAggregationService {
    aggregateByDivision(data: PayrollRow[], month: number, year: number): Promise<DivisionSummary[]> {}
}

export class SummaryReportService {
    generateReport(summary: DivisionSummary[]): Promise<Report> {}
    exportToExcel(summary: DivisionSummary[]): Promise<Buffer> {}
}

export class SummaryCacheService {
    cacheSummary(summary: DivisionSummary[], key: string): Promise<void> {}
    getCached(key: string): Promise<DivisionSummary[]> {}
}
```

---

### 2. **Type Safety - Excessive `any` Usage** ❌

**Count:** 47 instances of `any`

#### **Worst Offenders:**

**authService.ts:**
```typescript
// ❌ VIOLATION: Multiple any usage
const row = this.db.query("SELECT * FROM users WHERE username = ?").get(username) as any;

// ❌ VIOLATION: Casting payload
const username = payload.sub || (payload as any).preferred_username || (payload as any).username;

// ❌ VIOLATION: Accessing properties dynamically
let roleStr = (payload as any).role || "user";

// ❌ VIOLATION: Multiple fallback property access
let rawDivs = (payload as any).divisions ||
              (payload as any).division ||
              (payload as any).divisi ||
              (payload as any).div ||
              (payload as any).DIV ||
              (payload as any).unit ||
              (payload as any).kode_lokasi ||
              (payload as any).loc_code;
```

**Solution:**
```typescript
// ✅ FIX: Define proper interfaces
interface JWTPayload {
    sub?: string;
    preferred_username?: string;
    username?: string;
    email?: string;
    role?: string | string[];
    divisions?: string[];
    division?: string;
    divisi?: string;
    div?: string;
    unit?: string;
    kode_lokasi?: string;
    loc_code?: string;
}

interface UserRow {
    id: number;
    username: string;
    password_hash: string;
    role: string;
    divisions: string;
    created_at: string;
}

// Use typed queries
const row = this.db.query<UserRow>("SELECT * FROM users WHERE username = ?").get(username);

// Safe property access with type guard
function extractUsername(payload: JWTPayload): string {
    return payload.sub || 
           payload.preferred_username || 
           payload.username || 
           payload.email || 
           'unknown';
}

function extractDivisions(payload: JWTPayload): string[] {
    const divisionFields: (keyof JWTPayload)[] = [
        'divisions', 'division', 'divisi', 'div', 
        'unit', 'kode_lokasi', 'loc_code'
    ];
    
    for (const field of divisionFields) {
        const value = payload[field];
        if (value) {
            return Array.isArray(value) ? value : [String(value)];
        }
    }
    return [];
}
```

---

**dataExtractorService.ts:**
```typescript
// ❌ VIOLATION: Manual adjustments cast to any
const manualAdjustments = (manualAdjustmentsRaw || []) as any[];

// ❌ VIOLATION: Generic any for employee data
const emp: any = employees[i];
```

**Solution:**
```typescript
// ✅ FIX: Define proper types
interface ManualAdjustment {
    emp_code: string;
    adjustment_type: 'PREMI' | 'POTONGAN' | 'GAJI_POKOK';
    adjustment_name: string;
    amount: number;
    notes?: string;
}

const manualAdjustments: ManualAdjustment[] = manualAdjustmentsRaw || [];
```

---

**upahBersihDetailService.ts:**
```typescript
// ❌ VIOLATION: SQL params as any[]
const headerParams: any[] = [periodMonth, periodYear];
```

**Solution:**
```typescript
// ✅ FIX: Use union type or specific array type
const headerParams: (number | string)[] = [periodMonth, periodYear];

// Or better: use parameterized query builder
const query = sql`
    SELECT * FROM payroll_history_header
    WHERE period_month = ${periodMonth} 
    AND period_year = ${periodYear}
`;
```

---

### 3. **Magic Numbers and Strings** ❌

**Count:** 15 instances

#### **Examples:**

**dataExtractorService.ts:**
```typescript
// ❌ VIOLATION: Magic number
const daysInMonth = new Date(year, month, 0).getDate(); // Why 0?

// ❌ VIOLATION: Magic number for beras bulk check
if (berasRate && berasRate >= 10000) {  // Why 10000?
    berasRate = berasRate / 30;  // Why 30?
}

// ❌ VIOLATION: Magic numbers in date calculation
masaKerjaLama = Math.floor((now.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 365));
```

**Solution:**
```typescript
// ✅ FIX: Use constants with meaningful names
const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_YEAR = 365;

const MS_PER_YEAR = MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY * DAYS_PER_YEAR;

const BERAS_MONTHLY_THRESHOLD = 10000; // Threshold for monthly bulk beras rate
const DAYS_IN_MONTH_CALCULATION = 0; // Day 0 of next month = last day of current month

// Usage
if (berasRate >= BERAS_MONTHLY_THRESHOLD) {
    berasRate = berasRate / DAYS_IN_MONTH_CALCULATION;
}

masaKerjaLama = Math.floor((now.getTime() - joinDate.getTime()) / MS_PER_YEAR);
```

---

**payrollService.ts:**
```typescript
// ❌ VIOLATION: Magic number for cache TTL
cacheService.set(cacheKey, map, 300); // Why 300?

// ❌ VIOLATION: Magic number for chunk size
const chunks = this.chunk(empCodes, 200); // Why 200?
```

**Solution:**
```typescript
// ✅ FIX: Named constants
const CACHE_TTL = {
    PAYRATES: 300,      // 5 minutes
    LOOSEFRUIT: 300,    // 5 minutes
    PREMI: 300,         // 5 minutes
};

const BATCH_SIZE = {
    EMPLOYEE_CODES: 200,  // Optimal for SQL IN clause
};

// Usage
cacheService.set(cacheKey, map, CACHE_TTL.PAYRATES);
const chunks = this.chunk(empCodes, BATCH_SIZE.EMPLOYEE_CODES);
```

---

### 4. **Debug Code in Production** ❌

**Count:** 8 instances

#### **Examples:**

**dataExtractorService.ts:**
```typescript
// ❌ VIOLATION: Debug logging in production code
if (emp.emp_code.includes('474')) {
    console.log(`[DEBUG] F0474 Filter Check:
        HK: ${hk}
        Cuti Minggu: ${empCuti.cuti_minggu}
        Cuti Nasional: ${empCuti.cuti_nasional}
        Effective HK: ${effective_hk}
        Total Earnings: ${total_earnings}
        Action: ${effective_hk <= 0 && total_earnings <= 0 ? 'SKIP' : 'KEEP'}
    `);
}

// ❌ VIOLATION: Debug logging
console.log(`[DEBUG_PPH] Emp: ${emp} | Doc: "${r.doc_desc}" | Task: "${r.task_desc}" | Key: "${key}" | Amt: ${r.amount}`);
```

**summaryService.ts:**
```typescript
// ❌ VIOLATION: Debug logging
console.log(`[DEBUG] getHistoricalPayrollDataAsExtractorFormat params: M:${periodMonth} Y:${periodYear}`);
```

**Solution:**
```typescript
// ✅ FIX: Use proper logging service with log levels
import { loggingService } from './logging/LoggingService';

// Conditional debug logging (only in dev mode)
if (Config.IS_DEV_MODE && emp.emp_code.includes('474')) {
    loggingService.debug(
        'DataExtractorService',
        'employee_filter',
        'F0474 Filter Check',
        {
            emp_code: emp.emp_code,
            hk,
            cuti_minggu: empCuti.cuti_minggu,
            cuti_nasional: empCuti.cuti_nasional,
            effective_hk,
            total_earnings
        }
    );
}

// Or remove debug code entirely before merge to production
```

---

### 5. **Inconsistent Error Handling** ❌

**Count:** 4 patterns

#### **Problem Patterns:**

**Pattern 1: Silent failures**
```typescript
// ❌ VIOLATION: Error caught but not handled properly
try {
    const data = await someOperation();
    return data;
} catch (e) {
    console.error("[Service] Error:", e);
    // ❌ Returns undefined implicitly
}
```

**Pattern 2: Re-throw without context**
```typescript
// ❌ VIOLATION: Re-throw loses stack trace
try {
    await operation();
} catch (e) {
    console.error("Failed:", e);
    throw e; // ❌ Loses original error context
}
```

**Pattern 3: Inconsistent error types**
```typescript
// ❌ VIOLATION: Mix of error handling
throw new Error("Failed");  // Sometimes
throw e;                    // Sometimes
return null;                // Sometimes
return { success: false };  // Sometimes
```

**Solution:**
```typescript
// ✅ FIX: Consistent error handling pattern
import { loggingService, ErrorCode } from './logging/LoggingService';

export class PayrollError extends Error {
    constructor(
        public code: ErrorCode,
        message: string,
        public details?: Record<string, any>
    ) {
        super(`[${ErrorCode[code]}] ${message}`);
        this.name = 'PayrollError';
    }
}

// Usage
async function calculatePayroll(empCode: string): Promise<PayrollResult> {
    try {
        const result = await payrollService.calculate(empCode);
        
        if (!result) {
            throw new PayrollError(
                ErrorCode.PAYROLL_CALCULATION_ERROR,
                `Failed to calculate payroll for ${empCode}`,
                { empCode }
            );
        }
        
        return result;
    } catch (error) {
        loggingService.error(
            'PayrollService',
            'calculate',
            `Payroll calculation failed for ${empCode}`,
            ErrorCode.PAYROLL_CALCULATION_ERROR,
            error instanceof Error ? error : undefined,
            { empCode }
        );
        
        // Re-throw with context
        if (error instanceof PayrollError) {
            throw error;
        }
        throw new PayrollError(
            ErrorCode.PAYROLL_CALCULATION_ERROR,
            `Unexpected error calculating payroll for ${empCode}`,
            { empCode, originalError: error }
        );
    }
}
```

---

### 6. **Long Methods** ❌

**Count:** 3 methods > 100 lines

#### **Worst Offender:**

**dataExtractorService.ts - extractPayrollData():** ~600 lines!

```typescript
// ❌ VIOLATION: Method terlalu panjang
public async extractPayrollData(
    month: number,
    year: number,
    gangCode: string | null,
    divisionCode: string | null,
    authToken: string | null,
    serverProfile?: string,
    skipHarvest: boolean = false
): Promise<PayrollDataResult> {
    // Line 1-50: Get current period
    // Line 51-100: Fetch employees
    // Line 101-150: Fetch attendance
    // Line 151-200: Fetch cuti
    // Line 201-250: Fetch premi
    // Line 251-300: Fetch potongan
    // ... (continues for 600 lines)
    
    // ❌ Problem: Terlalu banyak logic dalam satu method
    // ❌ Problem: Sulit di-test
    // ❌ Problem: Cognitive complexity terlalu tinggi
}
```

**Solution:**
```typescript
// ✅ FIX: Break into smaller methods
public async extractPayrollData(...): Promise<PayrollDataResult> {
    const period = await this.getCurrentPeriod(month, year);
    const employees = await this.fetchEmployees(gangCode, divisionCode, period);
    
    if (employees.length === 0) {
        return this.createEmptyResult();
    }
    
    const payrollComponents = await this.fetchAllPayrollComponents(employees, period);
    const payrollRows = this.buildPayrollRows(employees, payrollComponents);
    
    return this.formatResult(payrollRows, period);
}

private async fetchAllPayrollComponents(
    employees: Employee[], 
    period: Period
): Promise<PayrollComponents> {
    const empCodes = employees.map(e => e.emp_code);
    
    const [
        attendance,
        cuti,
        premi,
        potongan,
        lembur,
        brondol,
        jabatan,
        masaKerja
    ] = await Promise.all([
        this.attendanceService.get(empCodes, period),
        this.cutiService.get(empCodes, period),
        this.allowancesService.getPremi(empCodes, period),
        this.deductionsService.get(empCodes, period),
        this.overtimeService.get(empCodes, period),
        this.loosefruitService.get(empCodes, period),
        this.jabatanService.get(empCodes),
        this.masaKerjaService.get(empCodes)
    ]);
    
    return { attendance, cuti, premi, potongan, lembur, brondol, jabatan, masaKerja };
}

private buildPayrollRows(
    employees: Employee[],
    components: PayrollComponents
): PayrollRow[] {
    return employees.map(emp => 
        this.payrollBuilder.buildRow(emp, components)
    );
}
```

---

### 7. **Duplicate Logic** ❌

**Count:** 5 instances

#### **Example 1: Date Range Calculation**

```typescript
// ❌ DUPLICATE: Found in multiple services
// payrollService.ts
const start = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-01`;
const end = month === 12
    ? `${(year + 1).toString().padStart(4, "0")}-01-01`
    : `${year.toString().padStart(4, "0")}-${(month + 1).toString().padStart(2, "0")}-01`;

// summaryService.ts (similar logic)
const startDate = new Date(year, month - 1, 1);
const endDate = new Date(year, month, 1);
```

**Solution:**
```typescript
// ✅ FIX: Centralize in utility service
export class DateUtils {
    /**
     * Get date range for payroll period
     */
    static getPayrollPeriodRange(month: number, year: number): { start: string; end: string } {
        const start = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-01`;
        const end = month === 12
            ? `${(year + 1).toString().padStart(4, "0")}-01-01`
            : `${year.toString().padStart(4, "0")}-${(month + 1).toString().padStart(2, "0")}-01`;
        return { start, end };
    }
    
    /**
     * Get days in month
     */
    static getDaysInMonth(month: number, year: number): number {
        return new Date(year, month, 0).getDate();
    }
}
```

---

#### **Example 2: Chunk Array Logic**

```typescript
// ❌ DUPLICATE: Found in multiple services
// payrollService.ts
private chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}

// dataExtractorService.ts (similar logic)
```

**Solution:**
```typescript
// ✅ FIX: Centralize in utility service
export class ArrayUtils {
    /**
     * Split array into chunks of specified size
     */
    static chunk<T>(arr: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
        }
        return chunks;
    }
}
```

---

### 8. **Poor Naming** ❌

**Count:** 7 instances

#### **Examples:**

```typescript
// ❌ VIOLATION: Unclear variable name
const attData = attendanceMap[emp.emp_code] || { hk: 0, ... };
// ✅ BETTER: const attendanceData = ...

// ❌ VIOLATION: Unclear abbreviation
const gpResult = gajiPokokBatchResult.results.get(emp.emp_code);
// ✅ BETTER: const gajiPokokResult = ...

// ❌ VIOLATION: Generic name
const rawData = await fetchSomeData();
// ✅ BETTER: const payrollHeaderData = ...

// ❌ VIOLATION: Unclear boolean
const isHistorical = month !== currentMonth;
// ✅ BETTER: const isPreviousPeriod = ...

// ❌ VIOLATION: Magic string
if (key !== "koreksi") {
    total_premi += amount;
}
// ✅ BETTER: const EXCLUDE_FROM_PREMI = ['koreksi'] as const;
```

---

## 🟡 PRIORITY 1: MODERATE VIOLATIONS

### 9. **Commented-Out Code** ❌

**Count:** 12 instances

```typescript
// ❌ VIOLATION: Commented code (payrollService.ts)
// console.log(`[DataExtractor] Sample lembur DocDesc: `, rows.slice(0, 3));

// ❌ VIOLATION: Commented code
// [OPTIMIZATION] Skip bunches fetch if requested
```

**Solution:**
```typescript
// ✅ FIX: Remove commented code entirely
// Use git history if you need to reference old code
```

---

### 10. **Inconsistent Caching Strategy** ⚠️

**Problems:**
```typescript
// ❌ VIOLATION: Inconsistent cache key patterns
const cacheKey1 = `payrates:${serverProfile}:${empCodes.sort().join(",")}`;
const cacheKey2 = `payroll:gang:${gangCode}:${month}:${year}`;
const cacheKey3 = `loosefruit:${startDate}:${endDate}:${empCodes.sort().join(",")}`;

// ❌ VIOLATION: Inconsistent TTL values
cacheService.set(cacheKey, map, 300);   // 5 minutes
cacheService.set(cacheKey, data, 600);  // 10 minutes
```

**Solution:**
```typescript
// ✅ FIX: Use CacheStrategyService (recommended earlier)
const cacheKey = cacheStrategyService.buildKey(
    CacheNamespace.PAYROLL,
    'payrates',
    serverProfile || 'default',
    empCodes.length
);

const ttl = cacheStrategyService.getTTL('payrates');
cacheService.set(cacheKey, map, ttl);
```

---

## 📋 ACTION PLAN

### Phase 1: Critical Fixes (Week 1-2) 🔴

| Task | File | Effort | Impact |
|------|------|--------|--------|
| Remove debug console.log | All files | 🟢 Low | 🟢 High |
| Fix `any` types | authService.ts | 🟢 Low | 🟢 High |
| Fix `any` types | dataExtractorService.ts | 🟡 Medium | 🟢 High |
| Extract magic numbers | All files | 🟢 Low | 🟡 Medium |
| Add error handling consistency | All files | 🟡 Medium | 🟢 High |

### Phase 2: Structural Refactoring (Week 3-6) 🟡

| Task | File | Effort | Impact |
|------|------|--------|--------|
| Split DataExtractorService | dataExtractorService.ts | 🔴 High | 🟢 High |
| Split SummaryService | summaryService.ts | 🔴 High | 🟢 High |
| Create utility services | New files | 🟡 Medium | 🟡 Medium |
| Remove duplicate logic | Multiple | 🟡 Medium | 🟡 Medium |

### Phase 3: Polish (Week 7-8) 🟢

| Task | Effort | Impact |
|------|--------|--------|
| Fix naming inconsistencies | 🟢 Low | 🟡 Medium |
| Remove commented code | 🟢 Low | 🟢 Low |
| Standardize caching | 🟡 Medium | 🟡 Medium |
| Add comprehensive tests | 🔴 High | 🟢 High |

---

## 🎯 SUCCESS METRICS

After all fixes:

- [ ] **0 instances** of debug `console.log` in production
- [ ] **< 10 instances** of `any` type
- [ ] **0 methods** > 200 lines
- [ ] **100% services** follow SRP
- [ ] **100% errors** handled consistently
- [ ] **0 magic numbers** without named constants
- [ ] **90%+ test coverage**

---

## 📚 RELATED DOCUMENTATION

- `INCONSISTENCIES_OOP_RECOMMENDATIONS.md` - OOP services recommendations
- `REFACTORING_IMPLEMENTATION_PLAN.md` - Main refactoring plan

---

*Created: 2026-03-08*
