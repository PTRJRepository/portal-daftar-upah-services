import { describe, expect, test } from "bun:test";
import {
    resolvePayrollDivisionCodeForScope,
    resolvePayrollGangPrefixForDivision
} from "./payrollGangScope";

describe("payroll gang scope helpers", () => {
    test("normalizes INFRA aliases to INF", () => {
        expect(resolvePayrollDivisionCodeForScope("INFRA")).toBe("INF");
        expect(resolvePayrollDivisionCodeForScope("INFRASTRUKTUR")).toBe("INF");
        expect(resolvePayrollDivisionCodeForScope("INF")).toBe("INF");
    });

    test("drops numeric gang prefix for INFRA so INF and INT are included", () => {
        expect(resolvePayrollGangPrefixForDivision("INFRA", "1")).toBeUndefined();
        expect(resolvePayrollGangPrefixForDivision("INF", "1")).toBeUndefined();
    });

    test("keeps gang prefix for normal divisions", () => {
        expect(resolvePayrollGangPrefixForDivision("PG2B", "1")).toBe("1");
    });
});
