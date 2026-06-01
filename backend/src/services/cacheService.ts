import { Config } from "../config";

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

/**
 * CacheService (ENABLED for historical payroll data)
 *
 * [OPTIMIZATION] Cache di-enable untuk historical periods (bulan lalu).
 * Data payroll untuk periode lalu tidak berubah, jadi caching memberikan speedup signifikan.
 *
 * Current period (bulan berjalan) TIDAK di-cache agar data selalu fresh dari DB.
 *
 * Strategy:
 * - Key: `payroll:{gangCode}:{month}:{year}:{divisionCode || 'ALL'}`
 * - TTL: 1 hour for historical data
 * - Only cache when NOT current period
 */
export class CacheService {
    private static instance: CacheService;
    private cache: Map<string, CacheEntry<any>> = new Map();
    // Track cache hits/misses for debugging
    private hits = 0;
    private misses = 0;

    private constructor() { }

    public static getInstance(): CacheService {
        if (!CacheService.instance) {
            CacheService.instance = new CacheService();
        }
        return CacheService.instance;
    }

    public get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) {
            this.misses++;
            return null;
        }
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            this.misses++;
            return null;
        }
        this.hits++;
        return entry.value as T;
    }

    public set<T>(key: string, value: T, ttlSeconds: number = 3600): void {
        // Enforce maximum TTL of 2 hours to prevent memory bloat
        const actualTtl = Math.min(ttlSeconds, 7200);
        this.cache.set(key, {
            value,
            expiresAt: Date.now() + (actualTtl * 1000)
        });
    }

    public delete(key: string): boolean {
        return this.cache.delete(key);
    }

    public clear(): void {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
    }

    public clearByPattern(pattern: string): void {
        // Clear all keys matching the pattern (e.g., ":3:2025" clears all March 2025 data)
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * [OPTIMIZATION] Check if caching should be used for a given period.
     * - Historical periods: cache with long TTL (1 hour)
     * - Current period: cache with short TTL (60 seconds) to balance freshness and speed
     */
    public shouldCache(month: number, year: number, currentMonth: number, currentYear: number): boolean {
        // Always return true - caching is now enabled for all periods
        // TTL is determined by the caller based on historical vs current
        return true;
    }

    /**
     * Get appropriate TTL based on whether period is historical
     */
    public getPayrollCacheTtl(month: number, year: number, currentMonth: number, currentYear: number): number {
        const isHistorical = (year < currentYear) || (year === currentYear && month < currentMonth);
        // Historical: 1 hour TTL, Current: 60 second TTL
        return isHistorical ? 3600 : 60;
    }

    /**
     * Build cache key for payroll data
     */
    public buildPayrollKey(
        gangCode: string,
        month: number,
        year: number,
        divisionCode?: string,
        useHistoryDb: boolean | null = false,
        snapshotVersion?: number | null
    ): string {
        const historySuffix = useHistoryDb ? ':H' : ':L';
        const snapshotSuffix = useHistoryDb && snapshotVersion != null ? `:V${snapshotVersion}` : '';
        return `payroll:${gangCode || 'ALL'}:${month}:${year}:${divisionCode || 'ALL'}${historySuffix}${snapshotSuffix}`;
    }

    /**
     * [OPTIMIZATION] Invalidate cache spesifik untuk (gang, division, month, year).
     * Lebih efisien dari clearByPattern(":month:year") yang menghapus SEMUA gang/division.
     * Gunakan ini setelah save manual-edit / override supaya user lain tidak kehilangan cache.
     */
    public invalidatePayroll(opts: {
        month: number;
        year: number;
        divisionCode?: string | null;
        gangCode?: string | null;
    }): number {
        const monthYearSuffix = `:${opts.month}:${opts.year}:`;
        let count = 0;
        for (const key of this.cache.keys()) {
            if (!key.startsWith('payroll:')) continue;
            if (!key.includes(monthYearSuffix)) continue;
            // Format: payroll:{gang}:{month}:{year}:{division}:{H|L}{:Vn?}
            if (opts.gangCode) {
                const gangPrefix = `payroll:${opts.gangCode}:`;
                const allPrefix = 'payroll:ALL:';
                if (!key.startsWith(gangPrefix) && !key.startsWith(allPrefix)) continue;
            }
            if (opts.divisionCode) {
                // division ada setelah year: payroll:GANG:M:Y:DIV:...
                const afterYear = key.substring(key.indexOf(monthYearSuffix) + monthYearSuffix.length);
                const divFromKey = afterYear.split(':')[0];
                if (divFromKey !== opts.divisionCode && divFromKey !== 'ALL') continue;
            }
            this.cache.delete(key);
            count++;
        }
        return count;
    }

    /**
     * Get cache statistics for monitoring
     */
    public getStats(): { size: number; hits: number; misses: number; hitRate: string } {
        const total = this.hits + this.misses;
        return {
            size: this.cache.size,
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? `${((this.hits / total) * 100).toFixed(1)}%` : '0%'
        };
    }
}

export const cacheService = CacheService.getInstance();
