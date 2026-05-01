import { describe, expect, it } from "bun:test";
import {
    attachManualAdjustmentValueSourceComparison,
    normalizePayrollValuePriorityMode,
    resolveManualAdjustmentDbPtrjCompareAmount,
    resolveManualAdjustmentSourcePolicy
} from "./dataExtractorService";

describe("resolveManualAdjustmentSourcePolicy", () => {
    it("normalizes old smart/manual-buffer inputs into the single non-DB_PTRJ mode", () => {
        expect(normalizePayrollValuePriorityMode()).toBe("non_db_ptrj");
        expect(normalizePayrollValuePriorityMode("smart")).toBe("non_db_ptrj");
        expect(normalizePayrollValuePriorityMode("manual_buffer_only")).toBe("non_db_ptrj");
        expect(normalizePayrollValuePriorityMode("non_db_ptrj")).toBe("non_db_ptrj");
        expect(normalizePayrollValuePriorityMode("db_ptrj_only")).toBe("db_ptrj_only");
    });

    it("keeps extend_db_ptrj metadata available in DB_PTRJ-only mode without applying manual amounts", () => {
        expect(resolveManualAdjustmentSourcePolicy("db_ptrj_only")).toEqual({
            applyAmounts: false,
            fetchRowsForMetadata: true,
            manualBufferOnly: false
        });
    });

    it("uses auto-buffer/manual-adjustment sources in non-DB_PTRJ mode", () => {
        expect(resolveManualAdjustmentSourcePolicy("non_db_ptrj")).toEqual({
            applyAmounts: true,
            fetchRowsForMetadata: true,
            manualBufferOnly: true
        });
    });

    it("adds manual adjustment compare entries for koreksi and potongan bersih fields", () => {
        const frame: Record<string, "red" | "green"> = {};
        const compare: Record<string, { db_ptrj: number; active: number }> = {};

        attachManualAdjustmentValueSourceComparison(frame, compare, {
            fieldName: "koreksi_denda_panen",
            adjustmentType: "POTONGAN_KOTOR",
            adjustmentName: "KOREKSI DENDA PANEN",
            previousAmount: 7000,
            finalAmount: 10000,
            hadDbValue: true
        });
        attachManualAdjustmentValueSourceComparison(frame, compare, {
            fieldName: "potongan_lainnya_kasbon",
            adjustmentType: "POTONGAN_BERSIH",
            adjustmentName: "POTONGAN LAINNYA KASBON",
            previousAmount: 2000,
            finalAmount: 5000,
            hadDbValue: true
        });

        expect(frame.koreksi_denda_panen).toBe("red");
        expect(frame.potongan_lainnya_kasbon).toBe("red");
        expect(compare.koreksi_denda_panen).toEqual({ db_ptrj: 7000, active: 10000 });
        expect(compare.potongan_lainnya_kasbon).toEqual({ db_ptrj: 2000, active: 5000 });
    });

    it("uses summed DB_PTRJ premium amount for manual adjustment compare color", () => {
        const syncMeta = {
            fieldName: "premi_jaga",
            adjustmentType: "PREMI" as const,
            adjustmentName: "PREMI JAGA",
            previousAmount: 0,
            finalAmount: 350000,
            hadDbValue: false
        };
        const dbPtrjAmount = resolveManualAdjustmentDbPtrjCompareAmount(
            syncMeta,
            { premi_jaga: 200000, JAGA: 150000 },
            {}
        );
        const frame: Record<string, "red" | "green"> = {};
        const compare: Record<string, { db_ptrj: number; active: number }> = {};

        attachManualAdjustmentValueSourceComparison(frame, compare, syncMeta, dbPtrjAmount);

        expect(dbPtrjAmount).toBe(350000);
        expect(frame.premi_jaga).toBe("green");
        expect(compare.premi_jaga).toEqual({ db_ptrj: 350000, active: 350000 });
    });
});
