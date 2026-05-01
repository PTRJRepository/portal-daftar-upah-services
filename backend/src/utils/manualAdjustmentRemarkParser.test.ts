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

    it("infers alphanumeric ADCode variants from remarks", () => {
        expect(inferManualAdjustmentAdCodeFromRemarks("PREMI PRUNING | AL3PM0601P1A - PRUNING MANUAL | 125000")).toEqual({
            adCode: "AL3PM0601P1A",
            adCodeDesc: "PRUNING MANUAL"
        });
    });

    it("infers TaskDesc display values from pipe-formatted remarks without raw ADCode", () => {
        const taskDesc = "(AL) TUNJANGAN PREMI ((PM) HARVESTING LABOUR - HARVESTING)";

        expect(inferManualAdjustmentAdCodeFromRemarks(`PREMI TBS | ${taskDesc} - ${taskDesc} | 423363 | sync:MANUAL | match:MANUAL`)).toEqual({
            adCode: taskDesc,
            adCodeDesc: taskDesc
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

    it("parses alphanumeric ADCode variants", () => {
        const result = parsePipeDelimitedRemarks("PREMI PRUNING | AL3PM0601P1A - PRUNING MANUAL | 125000");
        expect(result.adCode).toBe("AL3PM0601P1A");
        expect(result.adCodeDesc).toBe("PRUNING MANUAL");
    });

    it("parses TaskDesc display values that contain internal hyphens", () => {
        const taskDesc = "(AL) TUNJANGAN PREMI ((PM) HARVESTING LABOUR - HARVESTING)";
        const result = parsePipeDelimitedRemarks(`PREMI TBS | ${taskDesc} - ${taskDesc} | 423363 | sync:MANUAL | match:MANUAL`);

        expect(result.adCode).toBe(taskDesc);
        expect(result.adCodeDesc).toBe(taskDesc);
        expect(result.amount).toBe(423363);
        expect(result.syncStatus).toBe("MANUAL");
        expect(result.matchStatus).toBe("MANUAL");
    });
});
