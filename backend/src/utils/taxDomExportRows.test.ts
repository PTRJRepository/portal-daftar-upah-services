import { describe, expect, test } from "bun:test";
import { prepareDomTaxExcelRows } from "./taxDomExportRows";

describe("prepareDomTaxExcelRows", () => {
    test("builds Excel-ready premium detail from DOM rows without database extraction", () => {
        const componentMetadata = {
            pph21: {
                task_code: "TX001",
                task_desc: "PPh21",
                dr_acct: "6000",
                cr_acct: "2000"
            }
        };

        const result = prepareDomTaxExcelRows(
            [
                {
                    emp_code: "A0001",
                    nama: "Siti",
                    gaji_pokok_ideal: 100000,
                    gaji_pokok_aktual: 80000,
                    pph21_ter: 7500,
                    pot_pph21: 4000,
                    premi: {
                        pruning: 30000,
                        brondol: 20000,
                        PPH21: 99999,
                        KOREKSI: 11111
                    },
                    premi_pruning: 30000,
                    premi_brondol: 20000
                }
            ],
            ["premi_pruning", "premi_brondol"],
            componentMetadata
        );

        expect(result.totalPph21).toBe(7500);
        expect(result.employees[0].component_metadata).toBe(componentMetadata);
        expect(result.employees[0].pot_alpa_cth).toBe(-20000);
        expect(result.employees[0].premi_detail).toEqual({
            premi_pruning: 30000,
            premi_brondol: 20000
        });
    });
});
