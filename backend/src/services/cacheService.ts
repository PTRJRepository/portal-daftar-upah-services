import { Config } from "../config";

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

/**
 * CacheService (DISABLED)
 * 
 * Sesuai permintaan user, cache dimatikan total agar data live dari DB langsung terbaca.
 * Logic cache tetap ada strukturnya agar tidak merusak import, tapi fungsionalitasnya bypass.
 */
export class CacheService {
    private static instance: CacheService;
    // Map dikosongkan untuk hemat memory karena tidak digunakan
    private cache: Map<string, CacheEntry<any>> = new Map();

    private constructor() { }

    public static getInstance(): CacheService {
        if (!CacheService.instance) {
            CacheService.instance = new CacheService();
        }
        return CacheService.instance;
    }

    public get<T>(key: string): T | null {
        // ALWAYS RETURN NULL - DISABLE CACHE
        return null;
    }

    public set<T>(key: string, value: T, ttlSeconds?: number): void {
        // DO NOTHING - DISABLE CACHE
        return;
    }

    public delete(key: string): boolean {
        return false;
    }

    public clear(): void {
        // No-op
    }

    public clearByPattern(pattern: string): void {
        // No-op
    }
}

export const cacheService = CacheService.getInstance();
