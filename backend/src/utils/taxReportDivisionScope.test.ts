import { describe, expect, test } from "bun:test";
import { filterTaxReportRows, resolveTaxReportDivisionScope } from "./taxReportDivisionScope";

describe("resolveTaxReportDivisionScope", () => {
    test("normalizes trimmed lowercase inputs", () => {
        const scope = resolveTaxReportDivisionScope({
            divisionCode: " inf ",
            gangPrefix: " in "
        });

        expect(scope.fetchDivisionCode).toBe("INF");
        expect(scope.requestedDivisionCode).toBe("INF");
        expect(scope.gangPrefix).toBe("IN");
        expect(scope.isVirtualDivision).toBe(true);
    });

    test("keeps virtual divisions on their own fetch scope", () => {
        const scope = resolveTaxReportDivisionScope({
            divisionCode: "INF"
        });

        expect(scope.fetchDivisionCode).toBe("INF");
        expect(scope.isVirtualDivision).toBe(true);
        expect(scope.gangPrefix).toBeUndefined();
    });

    test("preserves explicit gang prefix for real divisions", () => {
        const scope = resolveTaxReportDivisionScope({
            divisionCode: "PG1A",
            gangPrefix: "A1"
        });

        expect(scope.fetchDivisionCode).toBe("PG1A");
        expect(scope.isVirtualDivision).toBe(false);
        expect(scope.gangPrefix).toBe("A1");
    });
});

describe("filterTaxReportRows", () => {
    test("filters virtual division rows with exact virtual matching logic", () => {
        const scope = resolveTaxReportDivisionScope({
            divisionCode: "INF"
        });

        const rows = [
            { gang_code: "INF", gang_description: "INFRASTRUKTUR" },
            { gang_code: "INT", gang_description: "INTERNAL ROAD" },
            { gang_code: "A1H", gang_description: "PANEN" }
        ];

        const filtered = filterTaxReportRows(rows, scope);

        expect(filtered.map((row) => row.gang_code)).toEqual(["INF", "INT"]);
    });

    test("ignores explicit gang prefix when virtual division matcher is active", () => {
        const scope = resolveTaxReportDivisionScope({
            divisionCode: "INF",
            gangPrefix: "A1"
        });

        const rows = [
            { gang_code: "INF", gang_description: "INFRASTRUKTUR" },
            { gang_code: "INT", gang_description: "INTERNAL ROAD" },
            { gang_code: "A1H", gang_description: "PANEN" }
        ];

        const filtered = filterTaxReportRows(rows, scope);

        expect(filtered.map((row) => row.gang_code)).toEqual(["INF", "INT"]);
    });

    test("filters real division rows by explicit gang prefix", () => {
        const scope = resolveTaxReportDivisionScope({
            divisionCode: "PG1A",
            gangPrefix: "A1"
        });

        const rows = [
            { gang_code: "A1H", gang_description: "PANEN" },
            { gang_code: "A1M", gang_description: "RAWAT" },
            { gang_code: "B2N", gang_description: "NURSERY" }
        ];

        const filtered = filterTaxReportRows(rows, scope);

        expect(filtered.map((row) => row.gang_code)).toEqual(["A1H", "A1M"]);
    });
});
