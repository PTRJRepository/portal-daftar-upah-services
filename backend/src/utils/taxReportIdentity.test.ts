import { describe, expect, test } from "bun:test";
import { collectNikLookupKeys, resolveReportIdentity } from "./taxReportIdentity";

describe("resolveReportIdentity", () => {
    test("prefers adjusted new_nik and tax identity from history_hr_employee", () => {
        const result = resolveReportIdentity(
            {
                nik: "OLD-NIK",
                actual_nik: "LIVE-NIK",
                npwp: "OLD-NPWP",
                alamat: "OLD ADDRESS"
            },
            {
                nik: "HISTORY-OLD-NIK",
                new_nik: "UPDATED-NIK",
                pajak_npwp: "UPDATED-NPWP",
                res_address: "UPDATED ADDRESS"
            }
        );

        expect(result.nik).toBe("UPDATED-NIK");
        expect(result.new_nik).toBe("UPDATED-NIK");
        expect(result.actual_nik).toBe("LIVE-NIK");
        expect(result.npwp).toBe("UPDATED-NPWP");
        expect(result.alamat).toBe("UPDATED ADDRESS");
    });

    test("falls back to existing row fields when there is no adjusted identity", () => {
        const result = resolveReportIdentity({
            nik: "ORIGINAL-NIK",
            new_nik: "",
            pajak_npwp: "ROW-NPWP",
            res_address: "ROW ADDRESS"
        });

        expect(result.nik).toBe("ORIGINAL-NIK");
        expect(result.new_nik).toBe("");
        expect(result.npwp).toBe("ROW-NPWP");
        expect(result.alamat).toBe("ROW ADDRESS");
    });

    test("builds unique lookup keys from old and adjusted NIK values", () => {
        expect(collectNikLookupKeys({
            nik: "OLD-NIK",
            new_nik: "UPDATED-NIK",
            actual_nik: "OLD-NIK"
        })).toEqual(["UPDATED-NIK", "OLD-NIK"]);
    });
});
