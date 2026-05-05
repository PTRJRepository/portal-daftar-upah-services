import { describe, expect, it } from "bun:test";
import {
    buildAdtransDocDescSqlCondition,
    buildAdtransDocDescSqlPatterns,
    isDynamicPotonganDocDesc,
    isDynamicPremiDocDesc,
    mapAdtransPremiField,
    matchesAdtransDocDescFilter,
    normalizeAdtransFilter,
    normalizeAdtransPotonganField
} from "./adtransDocDescMapping";

describe("ADTRANS DocDesc mapping rules", () => {
    it("treats premi keywords as dynamic premi except brondol", () => {
        for (const docDesc of ["INSENTIF PANEN", "PANEN LEBIH", "KINERJA HARIAN", "RAWAT JALAN", "PRUNING", "PREMI LAIN"]) {
            expect(isDynamicPremiDocDesc(docDesc)).toBe(true);
            expect(mapAdtransPremiField(docDesc)).toStartWith("premi_");
        }

        expect(isDynamicPremiDocDesc("PREMI BRONDOL")).toBe(false);
        expect(mapAdtransPremiField("PREMI BRONDOL")).toBe("brondol");
    });

    it("keeps premi bantu brondol as a separate dynamic premium", () => {
        expect(isDynamicPremiDocDesc("PREMI BANTU BRONDOL")).toBe(true);
        expect(mapAdtransPremiField("PREMI BANTU BRONDOL")).toBe("premi_bantu_brondol");
    });

    it("treats koreksi as dynamic potongan upah kotor", () => {
        expect(isDynamicPotonganDocDesc("KOREKSI PANEN")).toBe(true);
        expect(normalizeAdtransPotonganField("KOREKSI PANEN")).toEqual({ key: "koreksi_panen", title: "KOREKSI PANEN" });
    });

    it("normalizes koreksi brondol variants to the manual adjustment field name", () => {
        expect(normalizeAdtransPotonganField("KOREKSI BRONDOL")).toEqual({ key: "koreksi_brondol", title: "KOREKSI BRONDOL" });
        expect(normalizeAdtransPotonganField("KOREKSI BERONDOL")).toEqual({ key: "koreksi_brondol", title: "KOREKSI BERONDOL" });
    });

    it("normalizes premi jaga variants to the manual adjustment field name", () => {
        expect(mapAdtransPremiField("PREMI JAGA")).toBe("premi_jaga");
        expect(mapAdtransPremiField("PREMI JAGA GENSET")).toBe("premi_jaga");
        expect(mapAdtransPremiField("Premi Jaga Cuci Unit")).toBe("premi_jaga");
        expect(mapAdtransPremiField("Premi Jaga Tanggung Jawab")).toBe("premi_jaga_tanggung_jawab");
    });

    it("keeps static potongan names out of generic dynamic potongan", () => {
        expect(isDynamicPotonganDocDesc("POTONGAN ALAT")).toBe(true);
        expect(isDynamicPotonganDocDesc("POTONGAN SPSI")).toBe(false);
        expect(isDynamicPotonganDocDesc("POTONGAN PPH21")).toBe(false);
    });

    it("builds shared SQL patterns for category filters", () => {
        expect(buildAdtransDocDescSqlPatterns("premi")).toEqual(["%PREMI%", "%INSENTIF%", "%PANEN%", "%KINERJA%", "%RAWAT%", "%PRUN%"]);
        expect(buildAdtransDocDescSqlPatterns("brondol")).toEqual(["%BRONDOL%"]);
        expect(buildAdtransDocDescSqlPatterns("koreksi")).toEqual(["%KOREKSI%"]);
        expect(buildAdtransDocDescSqlCondition("t.DocDesc", "premi")).toContain("UPPER(t.DocDesc) LIKE '%INSENTIF%'");
    });

    it("does not include koreksi in the generic potongan category filter", async () => {
        const { matchesAdtransDocDescFilter } = await import("./adtransDocDescMapping");

        expect(matchesAdtransDocDescFilter("KOREKSI PANEN", "koreksi")).toBe(true);
        expect(matchesAdtransDocDescFilter("KOREKSI PANEN", "potongan")).toBe(false);
    });

    it("maps PPh filters to employee tax deductions and excludes premi PPh", () => {
        expect(normalizeAdtransFilter("POTONGAN PPH21")).toBe("pph");
        expect(buildAdtransDocDescSqlPatterns("pph")).toEqual(["%PPH%", "%PAJAK%"]);
        expect(buildAdtransDocDescSqlCondition("t.DocDesc", "pph")).toContain("NOT LIKE '%PREMI%'");
        expect(matchesAdtransDocDescFilter("POTONGAN PPH21", "pph")).toBe(true);
        expect(matchesAdtransDocDescFilter("PAJAK PPH21", "pph")).toBe(true);
        expect(matchesAdtransDocDescFilter("PREMI PPH", "pph")).toBe(false);
    });
});
