import { describe, expect, it } from "bun:test";
import { resolveManualAdjustmentSourcePolicy } from "./dataExtractorService";

describe("resolveManualAdjustmentSourcePolicy", () => {
    it("keeps extend_db_ptrj metadata available in DB_PTRJ-only mode without applying manual amounts", () => {
        expect(resolveManualAdjustmentSourcePolicy("db_ptrj_only")).toEqual({
            applyAmounts: false,
            fetchRowsForMetadata: true
        });
    });

    it("applies and fetches manual adjustments in smart and manual-buffer modes", () => {
        expect(resolveManualAdjustmentSourcePolicy("smart")).toEqual({
            applyAmounts: true,
            fetchRowsForMetadata: true
        });
        expect(resolveManualAdjustmentSourcePolicy("manual_buffer_only")).toEqual({
            applyAmounts: true,
            fetchRowsForMetadata: true
        });
    });
});
