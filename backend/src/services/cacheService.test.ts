import { describe, expect, test } from "bun:test";
import { CacheService } from "./cacheService";

describe("CacheService.buildPayrollKey", () => {
    test("includes snapshot version in the key when provided", () => {
        const cacheService = CacheService.getInstance();

        const latestKey = cacheService.buildPayrollKey("C1H", 3, 2026, "PG2A", true);
        const versionedKey = cacheService.buildPayrollKey("C1H", 3, 2026, "PG2A", true, 4);

        expect(latestKey).toBe("payroll:C1H:3:2026:PG2A:H");
        expect(versionedKey).toBe("payroll:C1H:3:2026:PG2A:H:V4");
        expect(versionedKey).not.toBe(latestKey);
    });
});
