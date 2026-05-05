import { describe, expect, it } from "bun:test";
import {
    filterRowsBySummaryDivisionType,
    isVirtualSummaryDivision,
    normalizeSummaryDivisionType
} from "./summaryReportScope";

describe("summaryReportScope", () => {
    it("identifies summary virtual divisions", () => {
        expect(isVirtualSummaryDivision("INF")).toBe(true);
        expect(isVirtualSummaryDivision("NRS")).toBe(true);
        expect(isVirtualSummaryDivision("WKS_PG")).toBe(true);
        expect(isVirtualSummaryDivision("WKS_AR")).toBe(true);
        expect(isVirtualSummaryDivision("WORKSHOP")).toBe(true);
        expect(isVirtualSummaryDivision("P1A")).toBe(false);
    });

    it("normalizes unsupported division type values to all", () => {
        expect(normalizeSummaryDivisionType("real")).toBe("real");
        expect(normalizeSummaryDivisionType("virtual")).toBe("virtual");
        expect(normalizeSummaryDivisionType("bad")).toBe("all");
        expect(normalizeSummaryDivisionType(undefined)).toBe("all");
    });

    it("filters rows by requested summary division type", () => {
        const rows = [
            { division_code: "P1A", total_upah_bersih: 100 },
            { division_code: "INF", total_upah_bersih: 20 },
            { division_code: "WKS_PG", total_upah_bersih: 30 }
        ];

        expect(filterRowsBySummaryDivisionType(rows, "all").map(row => row.division_code)).toEqual(["P1A", "INF", "WKS_PG"]);
        expect(filterRowsBySummaryDivisionType(rows, "real").map(row => row.division_code)).toEqual(["P1A"]);
        expect(filterRowsBySummaryDivisionType(rows, "virtual").map(row => row.division_code)).toEqual(["INF", "WKS_PG"]);
    });
});
