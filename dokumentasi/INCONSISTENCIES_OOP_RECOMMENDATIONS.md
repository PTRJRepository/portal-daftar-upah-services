# 🔍 INCONSISTENCIES & OOP REFACTORING RECOMMENDATIONS
## Analisis Codebase dan Rekomendasi OOP Services

**Document Version:** 1.0  
**Created:** 2026-03-08  
**Author:** Software Architecture Team  

---

## 📊 EXECUTIVE SUMMARY

Berdasarkan analisis mendalam codebase, ditemukan **7 area kritis** yang masih belum konsisten dan memerlukan refactoring ke OOP services/class objects.

### Impact Matrix

| Area | Impact | Effort | Priority | Status |
|------|--------|--------|----------|--------|
| Tax/PTKP Calculation | 🔴 HIGH | 🟡 MEDIUM | 🔴 P0 | ❌ Inconsistent |
| Caruman/BPJS Logic | 🟡 MEDIUM | 🟢 LOW | 🟡 P1 | ⚠️ Partial OOP |
| Cuti/Leave Management | 🟡 MEDIUM | 🟢 LOW | 🟡 P1 | ❌ Scattered |
| Employee Data Resolution | 🔴 HIGH | 🟡 MEDIUM | 🔴 P0 | ❌ Duplicated |
| Premi/Potongan Normalization | 🟡 MEDIUM | 🟢 LOW | 🟡 P1 | ❌ Inconsistent |
| Cache Strategy | 🟡 MEDIUM | 🟡 MEDIUM | 🟡 P1 | ⚠️ Partial |
| Error Handling & Logging | 🟡 MEDIUM | 🟡 MEDIUM | 🟡 P1 | ❌ Inconsistent |

---

## 🔴 PRIORITY 0: CRITICAL INCONSISTENCIES

### 1. **Tax Calculation Service (PTKP & PPh21 TER)** ❌

**Current State:**
- `ptkpTaxService.ts` - Service class ✅
- `pph21TerService.ts` - Service class ✅
- `mapBerasRateToPTKP()` - Standalone function ❌
- `mapPTKPToTER()` - Standalone function ❌
- Tax calculation logic scattered in `dataExtractorService.ts` ❌

**Problems:**
```typescript
// ❌ INCONSISTENT: Standalone functions in ptkpTaxService.ts
export function mapBerasRateToPTKP(berasRate: number): string {
    return BERAS_RATE_TO_PTKP[berasRate] || 'TK/0';
}

export function mapPTKPToTER(ptkpStatus: string): string {
    if (['TK/0', 'TK/1', 'K/0'].includes(ptkpStatus)) return 'TER A';
    if (ptkpStatus === 'K/3') return 'TER C';
    return 'TER B';
}

// ❌ INCONSISTENT: Direct usage in dataExtractorService.ts
const statusPtkp = dbPtkpMap.get(rawEmpCode) || mapBerasRateToPTKP(berasRate);
const kategoriTer = mapPTKPToTER(statusPtkp);
```

**Recommended Solution:**

```typescript
// backend/src/services/tax/TaxCalculationService.ts

export interface TaxCalculationInput {
    empCode: string;
    berasRate: number;
    grossIncome: number;
    periodYear: number;
}

export interface TaxCalculationResult {
    ptkpStatus: string;
    terCategory: string;
    ptkpAmount: number;
    taxRate: number;
    taxAmount: number;
    netTax: number;
}

export class TaxCalculationService {
    private static instance: TaxCalculationService;
    
    // Constants - Single Source of Truth
    private static readonly BERAS_RATE_TO_PTKP: Record<number, string> = {
        2250: 'TK/0', 3250: 'TK/1', 4200: 'TK/2', 3700: 'K/0',
        4650: 'K/1', 5500: 'K/2', 6450: 'K/3',
        3150: 'TK/1', 4050: 'TK/2', 4950: 'TK/3',
        3600: 'K/0', 4500: 'K/1', 5400: 'K/2', 6300: 'K/3'
    };

    private constructor() {}
    
    public static getInstance(): TaxCalculationService {
        if (!TaxCalculationService.instance) {
            TaxCalculationService.instance = new TaxCalculationService();
        }
        return TaxCalculationService.instance;
    }

    /**
     * Calculate complete tax for an employee
     */
    public calculate(input: TaxCalculationInput): TaxCalculationResult {
        const ptkpStatus = this.mapBerasRateToPTKP(input.berasRate);
        const terCategory = this.mapPTKPToTER(ptkpStatus);
        const ptkpAmount = this.getPTKPAmount(ptkpStatus, input.periodYear);
        const taxRate = this.getTaxRate(terCategory, ptkpStatus);
        const taxAmount = this.calculateTax(input.grossIncome, ptkpAmount, taxRate);
        
        return {
            ptkpStatus,
            terCategory,
            ptkpAmount,
            taxRate,
            taxAmount,
            netTax: taxAmount
        };
    }

    /**
     * Map Beras Rate to PTKP Status
     */
    public mapBerasRateToPTKP(berasRate: number): string {
        // Handle monthly bulk values (e.g. 135000 = 4500 * 30)
        const normalizedRate = berasRate >= 10000 ? berasRate / 30 : berasRate;
        return TaxCalculationService.BERAS_RATE_TO_PTKP[normalizedRate] || 'TK/0';
    }

    /**
     * Map PTKP Status to TER Category
     */
    public mapPTKPToTER(ptkpStatus: string): string {
        if (!ptkpStatus || ptkpStatus === '-') return '-';
        if (['TK/0', 'TK/1', 'K/0'].includes(ptkpStatus)) return 'TER A';
        if (ptkpStatus === 'K/3') return 'TER C';
        return 'TER B';
    }

    /**
     * Get PTKP Amount based on status and year
     */
    public getPTKPAmount(ptkpStatus: string, year: number): number {
        // Load from database or config based on year
        // Example 2025 rates:
        const ptkpRates: Record<string, number> = {
            'TK/0': 54000000,
            'TK/1': 58500000,
            'TK/2': 63000000,
            'TK/3': 67500000,
            'K/0': 58500000,
            'K/1': 63000000,
            'K/2': 67500000,
            'K/3': 72000000
        };
        return ptkpRates[ptkpStatus] || 54000000;
    }

    /**
     * Get tax rate based on TER category
     */
    public getTaxRate(terCategory: string, ptkpStatus: string): number {
        // Load from rule_TER_pajak.json
        // Return decimal rate (e.g. 0.05 for 5%)
        return 0.05; // Simplified
    }

    /**
     * Calculate tax amount
     */
    public calculateTax(grossIncome: number, ptkpAmount: number, taxRate: number): number {
        const taxableIncome = Math.max(0, grossIncome - ptkpAmount);
        return Math.round(taxableIncome * taxRate);
    }
}

export const taxCalculationService = TaxCalculationService.getInstance();
```

**Migration Steps:**
1. ✅ Create `TaxCalculationService.ts`
2. ⏳ Migrate all `mapBerasRateToPTKP()` calls
3. ⏳ Migrate all `mapPTKPToTER()` calls
4. ⏳ Update `dataExtractorService.ts` to use service
5. ⏳ Deprecate standalone functions

---

### 2. **Employee Data Resolution Service** ❌

**Current State:**
- Employee resolution logic scattered across multiple services
- `dataExtractorService.ts` has inline resolution ❌
- `employeeGangHistoryService.ts` exists but not consistently used ❌
- Multiple implementations of "latest employee" logic ❌

**Problems:**
```typescript
// ❌ INCONSISTENT: Inline resolution in dataExtractorService.ts
const niksToResolve = employees.map(e => e.actual_nik).filter(Boolean);
const latestEmpCodeMap = await employeeGangHistoryService.resolveLatestEmpCodes(
    niksToResolve, 
    prefGangMap
);

// ❌ INCONSISTENT: Different resolution logic in other services
```

**Recommended Solution:**

```typescript
// backend/src/services/employee/EmployeeResolutionService.ts

export interface EmployeeResolutionInput {
    nik: string;
    preferredGangCode?: string;
    periodMonth?: number;
    periodYear?: number;
}

export interface EmployeeResolutionResult {
    originalNik: string;
    latestEmpCode: string;
    empName: string;
    currentGangCode: string;
    currentDivisionCode: string;
    effectiveDate: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export class EmployeeResolutionService {
    private static instance: EmployeeResolutionService;
    
    private constructor() {}
    
    public static getInstance(): EmployeeResolutionService {
        if (!EmployeeResolutionService.instance) {
            EmployeeResolutionService.instance = new EmployeeResolutionService();
        }
        return EmployeeResolutionService.instance;
    }

    /**
     * Resolve NIK to latest EmpCode with gang preference
     */
    public async resolve(input: EmployeeResolutionInput): Promise<EmployeeResolutionResult> {
        // Implementation using employeeGangHistoryService
        // with consistent logic across all services
    }

    /**
     * Batch resolve multiple NIKs
     */
    public async resolveBatch(
        niks: string[], 
        preferredGangMap?: Map<string, string>
    ): Promise<Map<string, string>> {
        // Batch resolution for performance
    }
}

export const employeeResolutionService = EmployeeResolutionService.getInstance();
```

---

## 🟡 PRIORITY 1: MODERATE INCONSISTENCIES

### 3. **Caruman/BPJS Service** ⚠️

**Current State:**
- `carumanDefinitions.ts` - Functions only (no class) ⚠️
- `calculateAllCaruman()` - Standalone function ⚠️
- `getCarumanBase()` - Standalone function ⚠️
- Used consistently ✅

**Problems:**
```typescript
// ❌ NOT OOP: Pure functional approach
export function calculateAllCaruman(upahDasar: number, masaKerjaJumlah: number): CarumanResult {
    const gajiStandar = upahDasar * 30;
    const base = gajiStandar + masaKerjaJumlah;
    
    const astek_pekerja_jht = Math.round(base * 0.02);
    // ... more calculations
    
    return { base, gajiStandar, astek_pekerja_jht, ... };
}
```

**Recommended Solution:**

```typescript
// backend/src/services/payroll/CarumanService.ts

export class CarumanService {
    private static instance: CarumanService;
    
    // Keep rates from carumanDefinitions
    private readonly RATES = CARUMAN_RATES;
    
    private constructor() {}
    
    public static getInstance(): CarumanService {
        if (!CarumanService.instance) {
            CarumanService.instance = new CarumanService();
        }
        return CarumanService.instance;
    }

    /**
     * Calculate all caruman components
     */
    public calculateAllCaruman(upahDasar: number, masaKerjaJumlah: number): CarumanResult {
        const gajiStandar = this.getGajiStandar(upahDasar);
        const base = this.getCarumanBase(gajiStandar, masaKerjaJumlah);
        
        return {
            base,
            gajiStandar,
            astek_pekerja_jht: this.round(base * this.RATES.ASTEK_PEKERJA_JHT),
            astek_majikan_jkk_jkm: this.round(base * this.RATES.ASTEK_MAJIKAN_JKK_JKM),
            astek_majikan_jht: this.round(base * this.RATES.ASTEK_MAJIKAN_JHT),
            astek_majikan_total: this.round(base * this.RATES.ASTEK_MAJIKAN_TOTAL),
            bpjs_kes_pekerja: this.round(base * this.RATES.BPJS_KES_PEKERJA),
            bpjs_kes_majikan: this.round(base * this.RATES.BPJS_KES_MAJIKAN),
            bpjs_pensiun_pekerja: this.round(base * this.RATES.BPJS_PENSIUN_PEKERJA),
            bpjs_pensiun_majikan: this.round(base * this.RATES.BPJS_PENSIUN_MAJIKAN),
            total_pekerja: this.calculateTotalPekerja(base),
            total_majikan: this.calculateTotalMajikan(base),
            grand_total: this.calculateGrandTotal(base)
        };
    }

    /**
     * Get BPJS base amount
     */
    public getCarumanBase(gajiStandar: number, masaKerjaJumlah: number): number {
        return gajiStandar + masaKerjaJumlah;
    }

    /**
     * Get standard salary (Upah Dasar × 30)
     */
    public getGajiStandar(upahDasar: number): number {
        return upahDasar * 30;
    }

    /**
     * Get only components for PPh21 calculation
     */
    public getForPph21(upahDasar: number, masaKerjaJumlah: number): {
        base: number;
        astek_majikan_084: number;
        bpjs_kes_majikan_4: number;
    } {
        const base = this.getCarumanBase(this.getGajiStandar(upahDasar), masaKerjaJumlah);
        return {
            base,
            astek_majikan_084: this.round(base * this.RATES.ASTEK_MAJIKAN_JKK_JKM),
            bpjs_kes_majikan_4: this.round(base * this.RATES.BPJS_KES_MAJIKAN)
        };
    }

    private round(value: number): number {
        return Math.round(value);
    }

    private calculateTotalPekerja(base: number): number {
        return this.round(base * (
            this.RATES.ASTEK_PEKERJA_JHT +
            this.RATES.BPJS_KES_PEKERJA +
            this.RATES.BPJS_PENSIUN_PEKERJA
        ));
    }

    private calculateTotalMajikan(base: number): number {
        return this.round(base * (
            this.RATES.ASTEK_MAJIKAN_TOTAL +
            this.RATES.BPJS_KES_MAJIKAN +
            this.RATES.BPJS_PENSIUN_MAJIKAN
        ));
    }

    private calculateGrandTotal(base: number): number {
        return this.calculateTotalPekerja(base) + this.calculateTotalMajikan(base);
    }
}

export const carumanService = CarumanService.getInstance();
```

---

### 4. **Cuti/Leave Management Service** ❌

**Current State:**
- Cuti logic scattered in `dataExtractorService.ts` ❌
- No centralized cuti calculation ❌
- Inconsistent cuti type handling ❌

**Problems:**
```typescript
// ❌ INCONSISTENT: Inline cuti logic
interface CutiData {
    cuti_tahunan: number;
    cuti_sakit_haid: number;
    cuti_minggu: number;
    cuti_nasional: number;
}

// Calculation scattered
const totalCuti = cutiTahunan + cutiSakit + hkMinggu + hkNasional;
const hariKerja = Math.max(0, hkCount - totalCuti);
```

**Recommended Solution:**

```typescript
// backend/src/services/employee/CutiService.ts

export enum CutiType {
    TAHUNAN = 'TAHUNAN',
    SAKIT = 'SAKIT',
    HAID = 'HAID',
    MINGGU = 'MINGGU',
    NASIONAL = 'NASIONAL',
    MELAHIRKAN = 'MELAHIRKAN',
    KHUSUS = 'KHUSUS'
}

export interface CutiRecord {
    empCode: string;
    cutiType: CutiType;
    days: number;
    startDate: string;
    endDate: string;
    status: 'APPROVED' | 'PENDING' | 'REJECTED';
}

export interface CutiBalance {
    empCode: string;
    periodYear: number;
    cutiTahunan: {
        total: number;
        used: number;
        remaining: number;
    };
    cutiSakit: {
        total: number;
        used: number;
    };
    cutiHaid: {
        total: number;
        used: number;
    };
}

export interface CutiCalculationResult {
    totalCutiDays: number;
    cutiTahunanDays: number;
    cutiSakitDays: number;
    cutiMingguDays: number;
    cutiNasionalDays: number;
    workingDays: number;
}

export class CutiService {
    private static instance: CutiService;
    
    private constructor() {}
    
    public static getInstance(): CutiService {
        if (!CutiService.instance) {
            CutiService.instance = new CutiService();
        }
        return CutiService.instance;
    }

    /**
     * Calculate working days after deducting all leave
     */
    public calculateWorkingDays(
        totalHk: number,
        cutiData: {
            cutiTahunan: number;
            cutiSakit: number;
            cutiMinggu: number;
            cutiNasional: number;
        }
    ): number {
        const totalCuti = cutiData.cutiTahunan + cutiData.cutiSakit + 
                         cutiData.cutiMinggu + cutiData.cutiNasional;
        return Math.max(0, totalHk - totalCuti);
    }

    /**
     * Get cuti balance for employee
     */
    public async getBalance(empCode: string, year: number): Promise<CutiBalance> {
        // Query from database
    }

    /**
     * Record cuti usage
     */
    public async recordCuti(cutiRecord: CutiRecord): Promise<void> {
        // Insert to database
    }

    /**
     * Validate cuti request
     */
    public validateCutiRequest(cutiRecord: CutiRecord): {
        valid: boolean;
        errors: string[];
    } {
        // Validation logic
    }
}

export const cutiService = CutiService.getInstance();
```

---

### 5. **Premi & Potongan Normalization Service** ❌

**Current State:**
- `normalizePremiName()` - Method in `dataExtractorService.ts` ❌
- `normalizePotonganName()` - Method in `dataExtractorService.ts` ❌
- Inconsistent normalization across services ❌

**Problems:**
```typescript
// ❌ INCONSISTENT: Private methods in wrong service
private normalizePremiName(docDesc: string): string {
    let name = docDesc.trim().toUpperCase();
    const prefixes = ['TUNJANGAN PREMI', 'TUNJANGAN', 'PREMI'];
    // ... logic
}

private normalizePotonganName(docDesc: string, taskDesc: string | null, taskCode: string | null): { key: string; title: string } {
    // ... logic
}
```

**Recommended Solution:**

```typescript
// backend/src/services/payroll/PayrollNormalizationService.ts

export interface NormalizedPremi {
    originalDocDesc: string;
    normalizedKey: string;
    displayName: string;
    category: 'PREMI_PANEN' | 'PREMI_KINERJA' | 'PREMI_BRONDOL' | 'PREMI_INSENTIF' | 'PREMI_LAIN';
}

export interface NormalizedPotongan {
    originalDocDesc: string;
    normalizedKey: string;
    displayName: string;
    category: 'PPH21' | 'BPJS_KESEHATAN' | 'BPJS_PENSIUN' | 'SPSI' | 'KOREKSI' | 'PINJAMAN' | 'LAIN';
}

export class PayrollNormalizationService {
    private static instance: PayrollNormalizationService;
    
    private constructor() {}
    
    public static getInstance(): PayrollNormalizationService {
        if (!PayrollNormalizationService.instance) {
            PayrollNormalizationService.instance = new PayrollNormalizationService();
        }
        return PayrollNormalizationService.instance;
    }

    /**
     * Normalize premi DocDesc to standard key
     */
    public normalizePremi(docDesc: string): NormalizedPremi {
        const original = docDesc.trim();
        const upper = original.toUpperCase();
        
        // Determine category
        let category: NormalizedPremi['category'] = 'PREMI_LAIN';
        if (upper.includes('PANEN') || upper.includes('AL')) category = 'PREMI_PANEN';
        else if (upper.includes('KINERJA')) category = 'PREMI_KINERJA';
        else if (upper.includes('BRONDOL')) category = 'PREMI_BRONDOL';
        else if (upper.includes('INSENTIF')) category = 'PREMI_INSENTIF';
        
        // Remove prefixes
        let name = upper;
        const prefixes = ['TUNJANGAN PREMI', 'TUNJANGAN', 'PREMI'];
        for (const prefix of prefixes) {
            if (name.startsWith(prefix)) {
                name = name.slice(prefix.length).trim();
                break;
            }
        }
        
        // Convert to snake_case
        const normalizedKey = `premi_${name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_')}`;
        const displayName = this.extractDisplayName(original);
        
        return {
            originalDocDesc: original,
            normalizedKey,
            displayName,
            category
        };
    }

    /**
     * Normalize potongan DocDesc to standard key
     */
    public normalizePotongan(docDesc: string, taskDesc?: string | null, taskCode?: string | null): NormalizedPotongan {
        const original = docDesc.trim();
        const upper = original.toUpperCase();
        
        // Determine category
        let category: NormalizedPotongan['category'];
        if (upper.includes('PPH') && !upper.includes('PREMI')) category = 'PPH21';
        else if (upper.includes('BPJS') && upper.includes('KESEHATAN')) category = 'BPJS_KESEHATAN';
        else if (upper.includes('BPJS') && upper.includes('PENSIUN')) category = 'BPJS_PENSIUN';
        else if (upper.includes('SPSI')) category = 'SPSI';
        else if (upper.includes('KOREKSI')) category = 'KOREKSI';
        else if (upper.includes('PINJAM')) category = 'PINJAMAN';
        else category = 'LAIN';
        
        const normalizedKey = `potongan_${category.toLowerCase()}`;
        const displayName = taskDesc || taskCode || original;
        
        return {
            originalDocDesc: original,
            normalizedKey,
            displayName,
            category
        };
    }

    /**
     * Batch normalize premi descriptions
     */
    public normalizePremiBatch(docDescs: string[]): NormalizedPremi[] {
        return docDescs.map(docDesc => this.normalizePremi(docDesc));
    }

    /**
     * Batch normalize potongan descriptions
     */
    public normalizePotonganBatch(items: Array<{
        docDesc: string;
        taskDesc?: string | null;
        taskCode?: string | null;
    }>): NormalizedPotongan[] {
        return items.map(item => this.normalizePotongan(item.docDesc, item.taskDesc, item.taskCode));
    }

    private extractDisplayName(original: string): string {
        // Extract clean display name
        return original.replace(/^(TUNJANGAN|PREMI)\s*/i, '').trim();
    }
}

export const payrollNormalizationService = PayrollNormalizationService.getInstance();
```

---

### 6. **Cache Strategy Service** ⚠️

**Current State:**
- `cacheService.ts` exists ✅
- But cache keys are inconsistent ❌
- No TTL standardization ❌
- No cache invalidation strategy ❌

**Problems:**
```typescript
// ❌ INCONSISTENT: Cache key patterns
const cacheKey1 = `payrates:${serverProfile}:${empCodes.sort().join(",")}`;
const cacheKey2 = `payroll:gang:${gangCode}:${month}:${year}`;
const cacheKey3 = `loosefruit:${startDate}:${endDate}:${empCodes.sort().join(",")}`;

// ❌ INCONSISTENT: TTL values (300, 600, etc scattered)
cacheService.set(cacheKey, map, 300);
cacheService.set(cacheKey, data, 600);
```

**Recommended Solution:**

```typescript
// backend/src/services/cache/CacheStrategyService.ts

export enum CacheNamespace {
    PAYROLL = 'payroll',
    DIVISION = 'division',
    EMPLOYEE = 'employee',
    TAX = 'tax',
    PREMI = 'premi',
    POTONGAN = 'potongan',
    CUTI = 'cuti',
    ABSENSI = 'absensi'
}

export enum CacheTTL {
    SHORT = 60,      // 1 minute - volatile data
    MEDIUM = 300,    // 5 minutes - standard data
    LONG = 3600,     // 1 hour - static data
    VERY_LONG = 86400 // 24 hours - reference data
}

export interface CacheKeyOptions {
    namespace: CacheNamespace;
    ttl: CacheTTL;
    tags?: string[];
}

export class CacheStrategyService {
    private static instance: CacheStrategyService;
    
    private constructor() {}
    
    public static getInstance(): CacheStrategyService {
        if (!CacheStrategyService.instance) {
            CacheStrategyService.instance = new CacheStrategyService();
        }
        return CacheStrategyService.instance;
    }

    /**
     * Build consistent cache key
     */
    public buildKey(namespace: CacheNamespace, ...parts: (string | number)[]): string {
        const normalizedParts = parts.map(p => String(p).replace(/:/g, '_'));
        return `${namespace}:${normalizedParts.join(':')}`;
    }

    /**
     * Get recommended TTL for data type
     */
    public getTTL(dataType: string): CacheTTL {
        switch (dataType) {
            case 'payrates':
            case 'division_mapping':
                return CacheTTL.VERY_LONG;
            case 'premi':
            case 'potongan':
            case 'absensi':
                return CacheTTL.MEDIUM;
            case 'cuti_balance':
                return CacheTTL.LONG;
            default:
                return CacheTTL.MEDIUM;
        }
    }

    /**
     * Invalidate cache by tag
     */
    public async invalidateByTag(tag: string): Promise<void> {
        // Implementation
    }

    /**
     * Invalidate cache by namespace
     */
    public async invalidateNamespace(namespace: CacheNamespace): Promise<void> {
        // Implementation
    }

    /**
     * Warm up cache for period
     */
    public async warmUp(month: number, year: number): Promise<void> {
        // Pre-fetch and cache common queries
    }
}

export const cacheStrategyService = CacheStrategyService.getInstance();
```

---

### 7. **Error Handling & Logging Service** ❌

**Current State:**
- Inconsistent error handling ❌
- `console.log` and `console.error` scattered ❌
- No structured logging ❌
- No error codes ❌

**Problems:**
```typescript
// ❌ INCONSISTENT: Error handling patterns
console.error("[Service] Error:", e);
console.log("[DEBUG] Data:", data);
throw new Error("Failed");
throw e;
```

**Recommended Solution:**

```typescript
// backend/src/services/logging/LoggingService.ts

export enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
    FATAL = 'FATAL'
}

export enum ErrorCode {
    // Payroll Errors (1000-1999)
    PAYROLL_CALCULATION_ERROR = 1001,
    PAYROLL_DATA_NOT_FOUND = 1002,
    PAYROLL_INVALID_INPUT = 1003,
    
    // Division Errors (2000-2999)
    DIVISION_NOT_FOUND = 2001,
    DIVISION_INVALID_CODE = 2002,
    
    // Employee Errors (3000-3999)
    EMPLOYEE_NOT_FOUND = 3001,
    EMPLOYEE_INVALID_NIK = 3002,
    
    // Tax Errors (4000-4999)
    TAX_CALCULATION_ERROR = 4001,
    TAX_INVALID_PTKP = 4002,
    
    // Database Errors (5000-5999)
    DB_CONNECTION_ERROR = 5001,
    DB_QUERY_ERROR = 5002,
    
    // Cache Errors (6000-6999)
    CACHE_MISS = 6001,
    CACHE_WRITE_ERROR = 6002
}

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    service: string;
    action: string;
    message: string;
    errorCode?: ErrorCode;
    details?: Record<string, any>;
    duration?: number;
}

export class LoggingService {
    private static instance: LoggingService;
    
    private constructor() {}
    
    public static getInstance(): LoggingService {
        if (!LoggingService.instance) {
            LoggingService.instance = new LoggingService();
        }
        return LoggingService.instance;
    }

    /**
     * Log debug message
     */
    public debug(service: string, action: string, message: string, details?: any): void {
        this.log(LogLevel.DEBUG, service, action, message, undefined, details);
    }

    /**
     * Log info message
     */
    public info(service: string, action: string, message: string, details?: any): void {
        this.log(LogLevel.INFO, service, action, message, undefined, details);
    }

    /**
     * Log warning message
     */
    public warn(service: string, action: string, message: string, details?: any): void {
        this.log(LogLevel.WARN, service, action, message, undefined, details);
    }

    /**
     * Log error message
     */
    public error(
        service: string, 
        action: string, 
        message: string, 
        errorCode?: ErrorCode,
        error?: Error,
        details?: any
    ): void {
        this.log(LogLevel.ERROR, service, action, message, errorCode, details, error);
    }

    /**
     * Create and throw standardized error
     */
    public createError(
        errorCode: ErrorCode,
        message: string,
        service: string,
        details?: any
    ): Error {
        const error = new Error(`[${ErrorCode[errorCode]}] ${message}`);
        this.error(service, 'error_handler', message, errorCode, error, details);
        return error;
    }

    /**
     * Measure execution time
     */
    public measure<T>(
        service: string,
        action: string,
        fn: () => Promise<T>
    ): Promise<T> {
        const startTime = performance.now();
        return fn()
            .then(result => {
                const duration = performance.now() - startTime;
                this.info(service, action, `Completed in ${duration.toFixed(2)}ms`, { duration });
                return result;
            })
            .catch(error => {
                const duration = performance.now() - startTime;
                this.error(service, action, `Failed after ${duration.toFixed(2)}ms`, undefined, error);
                throw error;
            });
    }

    private log(
        level: LogLevel,
        service: string,
        action: string,
        message: string,
        errorCode?: ErrorCode,
        details?: any,
        error?: Error
    ): void {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            service,
            action,
            message,
            errorCode,
            details,
            duration: details?.duration
        };

        // Structured logging
        const logOutput = {
            ...entry,
            stack: error?.stack
        };

        // Write to appropriate output
        switch (level) {
            case LogLevel.DEBUG:
            case LogLevel.INFO:
                console.log(JSON.stringify(logOutput));
                break;
            case LogLevel.WARN:
            case LogLevel.ERROR:
            case LogLevel.FATAL:
                console.error(JSON.stringify(logOutput));
                break;
        }
    }
}

export const loggingService = LoggingService.getInstance();
```

---

## 📋 IMPLEMENTATION ROADMAP

### Phase 2.1: Critical Services (Week 3-4) 🔴

| Task | Service | Priority | Effort | Status |
|------|---------|----------|--------|--------|
| Tax Calculation Service | `TaxCalculationService.ts` | P0 | Medium | ⏳ Pending |
| Employee Resolution Service | `EmployeeResolutionService.ts` | P0 | Medium | ⏳ Pending |
| Cuti Service | `CutiService.ts` | P1 | Low | ⏳ Pending |

### Phase 2.2: Supporting Services (Week 5-6) 🟡

| Task | Service | Priority | Effort | Status |
|------|---------|----------|--------|--------|
| Caruman Service | `CarumanService.ts` | P1 | Low | ⏳ Pending |
| Normalization Service | `PayrollNormalizationService.ts` | P1 | Low | ⏳ Pending |
| Cache Strategy Service | `CacheStrategyService.ts` | P1 | Medium | ⏳ Pending |
| Logging Service | `LoggingService.ts` | P1 | Medium | ⏳ Pending |

---

## 🎯 SUCCESS CRITERIA

### After All Services Implemented:

- [ ] **Zero standalone functions** for business logic
- [ ] **100% OOP services** with singleton pattern
- [ ] **Consistent error handling** with error codes
- [ ] **Structured logging** across all services
- [ ] **Unified cache strategy** with namespaces
- [ ] **All services testable** with unit tests
- [ ] **Clear service boundaries** documented

---

## 📚 RELATED DOCUMENTATION

- `REFACTORING_IMPLEMENTATION_PLAN.md` - Main refactoring plan
- `DivisionConfigService.md` - Division service docs
- `DOCDESC_MAPPING_GUIDE.md` - DocDesc normalization

---

*Created: 2026-03-08*
