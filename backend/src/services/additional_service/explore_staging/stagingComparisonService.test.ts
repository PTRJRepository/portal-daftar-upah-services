import { describe, it, expect } from "bun:test";
import { StagingComparisonService } from "./stagingComparisonService";

const svc = StagingComparisonService.getInstance();

describe("StagingComparisonService", () => {
    it("dailyLoosefruitSummary — no error (regression: ORDER BY trx_count)", async () => {
        const result = await svc.dailyLoosefruitSummary(5, 2026, 3);
        expect(Array.isArray(result)).toBe(true);
        if (result.length > 0) {
            expect(result[0]).toHaveProperty("date");
            expect(result[0]).toHaveProperty("staging_workers");
            expect(result[0]).toHaveProperty("prod_workers");
        }
    });

    it("loosefruitAnomalies — returns valid shape", async () => {
        const result = await svc.loosefruitAnomalies(10);
        expect(result).toHaveProperty("rows");
        expect(result).toHaveProperty("summary");
        expect(Array.isArray(result.rows)).toBe(true);
        expect(typeof result.summary.total_anomaly_headers).toBe("number");
        expect(typeof result.summary.total_amount_excluded).toBe("number");
    });

    it("compareLoosefruit — returns rows + summary", async () => {
        const result = await svc.compareLoosefruit("2026-05-28", 5);
        expect(result).toHaveProperty("rows");
        expect(result).toHaveProperty("summary");
        expect(result.summary.pct_match).toBeDefined();
    });

    it("compareAttendance — returns rows + summary", async () => {
        const result = await svc.compareAttendance("2026-05-28", 5);
        expect(result).toHaveProperty("rows");
        expect(result.rows.length).toBeGreaterThan(0);
    });

    it("monthlyBrondolComparison — returns per-employee rows with identity + selisih", async () => {
        const result = await svc.monthlyBrondolComparison(5, 2026);
        expect(result).toHaveProperty("rows");
        expect(result).toHaveProperty("totals");
        expect(result).toHaveProperty("periode", "2026-05");
        expect(Array.isArray(result.rows)).toBe(true);
        expect(result.totals).toHaveProperty("staging_brondol");
        expect(result.totals).toHaveProperty("plantware_brondol");
        expect(result.totals).toHaveProperty("selisih");
        if (result.rows.length > 0) {
            const r0 = result.rows[0];
            expect(r0).toHaveProperty("emp_code");
            expect(r0).toHaveProperty("staging_brondol");
            expect(r0).toHaveProperty("plantware_brondol");
            expect(r0).toHaveProperty("selisih");
        }
    });

    it("monthlyBrondolComparison — invalid month throws", async () => {
        await expect(svc.monthlyBrondolComparison(13, 2026)).rejects.toThrow("Invalid month");
        await expect(svc.monthlyBrondolComparison(0, 2026)).rejects.toThrow("Invalid month");
    });
});
