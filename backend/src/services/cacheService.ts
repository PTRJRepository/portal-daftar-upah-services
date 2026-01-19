import { Config } from "../config";

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

export class CacheService {
    private static instance: CacheService;
    private cache: Map<string, CacheEntry<any>> = new Map();
    private defaultTtl: number = 300; // 5 minutes

    private constructor() { }

    public static getInstance(): CacheService {
        if (!CacheService.instance) {
            CacheService.instance = new CacheService();
        }
        return CacheService.instance;
    }

    public get<T>(key: string): T | null {
        // Check disable flags from env (Config doesn't have them all mapped but we can use generic env)
        if (process.env.DISABLE_CACHE === 'true') return null;

        const isProd = Config.isProd; // or check ENABLE_PRODUCTION_CACHE
        if (!isProd && process.env.ENABLE_PRODUCTION_CACHE !== 'true') {
            // In Python it logic was: if NOT production_override AND (dev_mode or test_mode) -> return None
            // We'll simplify: if we are in DEV and no override, maybe disable?
            // Actually Python logic disabled cache in DEV unless overridden.
            if (Config.RUN_MODE === 'dev' && process.env.ENABLE_PRODUCTION_CACHE !== 'true') {
                return null;
            }
        }

        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return entry.value as T;
    }

    public set<T>(key: string, value: T, ttlSeconds?: number): void {
        if (process.env.DISABLE_CACHE === 'true') return;

        if (Config.RUN_MODE === 'dev' && process.env.ENABLE_PRODUCTION_CACHE !== 'true') {
            return;
        }

        const effectiveTtl = ttlSeconds || this.defaultTtl;
        this.cache.set(key, {
            value,
            expiresAt: Date.now() + (effectiveTtl * 1000)
        });
    }

    public delete(key: string): boolean {
        return this.cache.delete(key);
    }

    public clear(): void {
        this.cache.clear();
    }
}

export const cacheService = CacheService.getInstance();
