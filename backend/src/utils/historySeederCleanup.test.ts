import { describe, expect, test } from "bun:test";
import { resolveHistorySeederCleanupPolicy } from "./historySeederCleanup";

describe("resolveHistorySeederCleanupPolicy", () => {
    test("skips cleanup when force is false", () => {
        const result = resolveHistorySeederCleanupPolicy({
            periodMonth: 3,
            periodYear: 2026,
            divisionCode: "PG1A",
            force: false
        });

        expect(result.shouldDeleteAggregationHistory).toBe(false);
        expect(result.shouldDeletePayrollHistory).toBe(false);
    });

    test("allows scoped cleanup when force is true and division is specific", () => {
        const result = resolveHistorySeederCleanupPolicy({
            periodMonth: 3,
            periodYear: 2026,
            divisionCode: "PG1A",
            gangCode: "A1H",
            force: true
        });

        expect(result.shouldDeleteAggregationHistory).toBe(true);
        expect(result.shouldDeletePayrollHistory).toBe(true);
    });

    test("blocks broad cleanup when division is not specific", () => {
        const result = resolveHistorySeederCleanupPolicy({
            periodMonth: 3,
            periodYear: 2026,
            divisionCode: "ALL",
            force: true
        });

        expect(result.shouldDeleteAggregationHistory).toBe(false);
        expect(result.shouldDeletePayrollHistory).toBe(false);
    });
});
