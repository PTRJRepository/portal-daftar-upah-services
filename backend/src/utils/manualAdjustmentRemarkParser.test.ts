import { describe, expect, it } from "bun:test";
import {
    inferManualAdjustmentAdCodeFromRemarks,
    normalizeManualAdjustmentPresetName,
    parsePipeDelimitedRemarks
} from "./manualAdjustmentRemarkParser";

describe("manualAdjustmentRemarkParser", () => {
    it("infers ADCode and description from pipe-formatted remarks", () => {
        expect(inferManualAdjustmentAdCodeFromRemarks("PREMI PANEN | AL0001 - PANEN MANUAL | 0 | sync:MISS")).toEqual({
            adCode: "AL0001",
            adCodeDesc: "PANEN MANUAL"
        });
    });

    it("infers ADCode and description from AD CODE remarks", () => {
        expect(inferManualAdjustmentAdCodeFromRemarks("AD CODE: DE0004 - (DE) POTONGAN PREMI")).toEqual({
            adCode: "DE0004",
            adCodeDesc: "(DE) POTONGAN PREMI"
        });
    });

    it("accepts lowercase labels and extra spaces", () => {
        expect(inferManualAdjustmentAdCodeFromRemarks("  ad code :  al0020   -   premi pruning  ")).toEqual({
            adCode: "AL0020",
            adCodeDesc: "premi pruning"
        });
    });

    it("returns null values when remarks do not contain an ADCode", () => {
        expect(inferManualAdjustmentAdCodeFromRemarks("manual note without code")).toEqual({
            adCode: null,
            adCodeDesc: null
        });
    });

    it("normalizes adjustment name before the first pipe", () => {
        expect(normalizeManualAdjustmentPresetName("  premi   panen  | AL0001 - PANEN MANUAL | 0")).toBe("PREMI PANEN");
    });
});

describe("parsePipeDelimitedRemarks", () => {
    it("parses complete pipe-delimited preset remarks", () => {
        const result = parsePipeDelimitedRemarks("PREMI PANEN | AL0001 - PANEN MANUAL | 0 | sync:MISS | match:MISMATCH");
        expect(result.adjustmentName).toBe("PREMI PANEN");
        expect(result.adCode).toBe("AL0001");
        expect(result.adCodeDesc).toBe("PANEN MANUAL");
        expect(result.amount).toBe(0);
        expect(result.syncStatus).toBe("MISS");
        expect(result.matchStatus).toBe("MISMATCH");
    });

    it("parses koreksi preset remarks", () => {
        const result = parsePipeDelimitedRemarks("KOREKSI BRONDOL | DE0004 - (DE) POTONGAN PREMI | 0 | sync:MISS | match:MISMATCH");
        expect(result.adjustmentName).toBe("KOREKSI BRONDOL");
        expect(result.adCode).toBe("DE0004");
        expect(result.adCodeDesc).toBe("(DE) POTONGAN PREMI");
    });

    it("returns nulls for non-pipe remarks", () => {
        const result = parsePipeDelimitedRemarks("AD CODE: DE0004 - (DE) POTONGAN PREMI");
        expect(result.adjustmentName).toBeNull();
        expect(result.adCode).toBeNull();
    });

    it("handles empty string", () => {
        const result = parsePipeDelimitedRemarks("");
        expect(result.adjustmentName).toBeNull();
        expect(result.amount).toBeNull();
    });

    it("handles partial pipe format", () => {
        const result = parsePipeDelimitedRemarks("PREMI COBA | AL0001");
        expect(result.adjustmentName).toBe("PREMI COBA");
        expect(result.adCode).toBe("AL0001");
        expect(result.amount).toBeNull();
        expect(result.syncStatus).toBeNull();
    });
});
