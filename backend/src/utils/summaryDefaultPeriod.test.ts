import { describe, expect, it } from "bun:test";
import { chooseSummaryDefaultPeriod } from "./summaryDefaultPeriod";

describe("chooseSummaryDefaultPeriod", () => {
    it("falls back to the latest aggregation period when current period is not available", () => {
        const result = chooseSummaryDefaultPeriod(
            [
                { period_year: 2026, period_month: 3 },
                { period_year: 2026, period_month: 2 }
            ],
            { year: 2026, month: 4 }
        );

        expect(result).toEqual({ year: 2026, month: 3 });
    });

    it("keeps the current period when aggregation data exists for it", () => {
        const result = chooseSummaryDefaultPeriod(
            [
                { period_year: 2026, period_month: 4 },
                { period_year: 2026, period_month: 3 }
            ],
            { year: 2026, month: 4 }
        );

        expect(result).toEqual({ year: 2026, month: 4 });
    });

    it("keeps the current period when no aggregation periods exist", () => {
        const result = chooseSummaryDefaultPeriod([], { year: 2026, month: 4 });

        expect(result).toEqual({ year: 2026, month: 4 });
    });
});
