import { describe, expect, test } from "bun:test";
import { resolveMonthlyTaxQuery } from "./taxReportQuery";

describe("resolveMonthlyTaxQuery", () => {
    test("parses period and source flags", () => {
        const result = resolveMonthlyTaxQuery({
            year: "2026",
            month: "3",
            division: "PG1A",
            gang: "A1H",
            gangPrefix: "A1",
            use_history: "true",
            snapshot_version: "4"
        });

        expect(result.year).toBe(2026);
        expect(result.month).toBe(3);
        expect(result.division).toBe("PG1A");
        expect(result.gang).toBe("A1H");
        expect(result.gangPrefix).toBe("A1");
        expect(result.useHistoryDb).toBe(true);
        expect(result.snapshotVersion).toBe(4);
        expect(result.hasValidPeriod).toBe(true);
    });

    test("forces kerani division scope", () => {
        const result = resolveMonthlyTaxQuery(
            {
                year: "2026",
                month: "4",
                division: "SHOULD_BE_OVERRIDDEN"
            },
            {
                role: "kerani",
                divisions: ["AB2"]
            }
        );

        expect(result.division).toBe("AB2");
    });

    test("marks invalid periods and defaults useHistoryDb to false", () => {
        const result = resolveMonthlyTaxQuery({
            year: "2026",
            month: "13",
            use_history: "unexpected"
        });

        expect(result.useHistoryDb).toBe(false);
        expect(result.hasValidPeriod).toBe(false);
    });
});
