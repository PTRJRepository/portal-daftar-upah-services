import { afterEach, describe, expect, it } from "bun:test";
import { deductionAdjustmentService } from "./deductionAdjustmentService";

describe("DeductionAdjustmentService", () => {
    const originalGetAdjustmentData = deductionAdjustmentService.getAdjustmentData;

    afterEach(() => {
        (deductionAdjustmentService as any).getAdjustmentData = originalGetAdjustmentData;
    });

    it("does not change seeded PPH21 totals when applying manual deduction adjustments", async () => {
        (deductionAdjustmentService as any).getAdjustmentData = async () => ({
            P1A: { pph21: 50, spsi: 5 }
        });

        const [row] = await deductionAdjustmentService.applyAdjustmentsToDivisionData(4, 2026, [
            {
                division_code: "P1A",
                total_pph21: 100,
                total_spsi: 10
            }
        ]);

        expect(row.total_pph21).toBe(100);
        expect(row.original_pph21).toBe(100);
        expect(row.pph21_adjustment).toBe(50);
        expect(row.total_spsi).toBe(15);
    });
});
