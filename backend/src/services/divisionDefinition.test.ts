import { describe, expect, test } from "bun:test";
import { divisionDefinition } from "./divisionDefinition";
import { divisionConfigService } from "./config/DivisionConfigService";

describe("DivisionDefinitionWrapper virtual division compatibility", () => {
    test("returns canonical INF code for infrastructure pattern fallback", () => {
        expect(divisionDefinition.getVirtualDivisionByPatternOnly("IN01", "INFRASTRUKTUR")).toBe("INF");
    });

    test("uses canonical virtual division order", () => {
        expect(divisionDefinition.VIRTUAL_DIVISION_ORDER).toContain("INF");
        expect(divisionDefinition.VIRTUAL_DIVISION_ORDER).not.toContain("INFRA");
    });

    test("exposes workshop source divisions consistently", async () => {
        expect(await divisionDefinition.getSourceDivisionsForAggregation("WORKSHOP")).toEqual(["PG1A", "AB2"]);
        expect(await divisionDefinition.getSourceDivisionsForAggregation("WKS_AR")).toEqual(["AB2"]);
        expect(await divisionDefinition.getSourceDivisionsForAggregation("PG2A")).toEqual(["PG2A"]);
        expect(divisionConfigService.resolveCode("INFRA")).toBe("INF");
    });
});
