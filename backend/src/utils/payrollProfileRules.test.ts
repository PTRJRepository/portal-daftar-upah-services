import { describe, expect, it } from "bun:test";
import {
    calculateMasaKerjaDisplay,
    deriveInitialSpsiMember,
    normalizeEffectiveStartDate,
    resolveThrCompatibleEffectiveStartDate
} from "./payrollProfileRules";

describe("payrollProfileRules", () => {
    it("seeds SPSI member from March potongan", () => {
        expect(deriveInitialSpsiMember(1500)).toBe(true);
        expect(deriveInitialSpsiMember(0)).toBe(false);
    });

    it("normalizes editable effective start date", () => {
        expect(normalizeEffectiveStartDate(" 2026-03-15 ")).toBe("2026-03-15");
        expect(normalizeEffectiveStartDate("2024-01-15 00:00:00.000")).toBe("2024-01-15");
        expect(normalizeEffectiveStartDate(new Date(2024, 0, 15))).toBe("2024-01-15");
        expect(normalizeEffectiveStartDate("")).toBeNull();
    });

    it("calculates masa kerja against selected period", () => {
        expect(calculateMasaKerjaDisplay("2025-02-10", 4, 2026)).toEqual({
            years: 1,
            months: 2,
            label: "1 thn 2 bln"
        });
        expect(calculateMasaKerjaDisplay(new Date(2024, 0, 10), 4, 2026)).toEqual({
            years: 2,
            months: 3,
            label: "2 thn 3 bln"
        });
        expect(calculateMasaKerjaDisplay("2024-01-15 00:00:00.000", 4, 2026)).toEqual({
            years: 2,
            months: 3,
            label: "2 thn 3 bln"
        });
    });

    it("reuses THR-compatible latest join date semantics", () => {
        expect(
            resolveThrCompatibleEffectiveStartDate("2024-01-10", "2025-03-01")
        ).toBe("2025-03-01");
        expect(
            resolveThrCompatibleEffectiveStartDate(null, null, " 2023-07-12 ")
        ).toBe("2023-07-12");
    });
});
