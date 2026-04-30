import { describe, expect, it } from "bun:test";
import {
    attachManualAdjustmentMetadata,
    buildManualAdjustmentIdentityIndex,
    getManualAdjustmentsForEmployee,
    registerManualAdjustmentMetadataDynamicHeaders
} from "./dataExtractorService";

describe("manual adjustment metadata extraction", () => {
    it("attaches koreksi block metadata and mismatch information", () => {
        const row: any = {};

        attachManualAdjustmentMetadata(row, [{
            adjustment_type: "POTONGAN_KOTOR",
            adjustment_name: "KOREKSI PANEN",
            amount: 100000,
            metadata_json: JSON.stringify({
                input_type: "blok",
                items: [{ subblok: "P09/15", gang_code: "D1H", jumlah: 90000 }],
                total_amount: 90000
            })
        }]);

        expect(row.manual_adjustment_metadata.koreksi_panen).toMatchObject({
            input_type: "blok",
            adjustment_type: "POTONGAN_KOTOR",
            adjustment_name: "KOREKSI PANEN",
            amount: 100000,
            detail_total: 90000,
            detail_matches_amount: false
        });
        expect(row.manual_adjustment_metadata.premi_koreksi_panen).toBeUndefined();
        expect(row.manual_adjustment_metadata_mismatch.koreksi_panen).toEqual({
            amount: 100000,
            detail_total: 90000,
            diff: -10000
        });
    });

    it("registers dynamic premium and koreksi headers from stored rows even when amounts are not applied", () => {
        const dynamicPremiSet = new Set<string>();
        const dynamicPotonganSet = new Set<string>();
        const premiTitleMap: Record<string, string> = {};
        const potonganTitleMap: Record<string, string> = {};

        registerManualAdjustmentMetadataDynamicHeaders(
            [
                {
                    adjustment_type: "PREMI",
                    adjustment_name: "PREMI PRUNING",
                    amount: 0,
                    metadata_json: JSON.stringify({ input_type: "blok", total_amount: 650000, items: [] })
                },
                {
                    adjustment_type: "POTONGAN_KOTOR",
                    adjustment_name: "KOREKSI PANEN",
                    amount: 0,
                    metadata_json: null
                },
                {
                    adjustment_type: "POTONGAN_BERSIH",
                    adjustment_name: "POTONGAN LAINNYA KASBON",
                    amount: 0,
                    metadata_json: null
                }
            ],
            dynamicPremiSet,
            dynamicPotonganSet,
            premiTitleMap,
            potonganTitleMap
        );

        expect(Array.from(dynamicPremiSet)).toEqual(["premi_pruning"]);
        expect(Array.from(dynamicPotonganSet)).toEqual(["koreksi_panen", "potongan_lainnya_kasbon"]);
        expect(premiTitleMap).toEqual({ premi_pruning: "PREMI PRUNING" });
        expect(potonganTitleMap).toEqual({
            koreksi_panen: "KOREKSI PANEN",
            potongan_lainnya_kasbon: "POTONGAN LAINNYA KASBON"
        });
    });

    it("matches manual adjustment rows by PTRJ EmpCode and legacy numeric NIK identifiers", () => {
        const adjustments = [
            { id: 1, emp_code: "B0001", nik: "3171000000000001", adjustment_name: "PREMI PRUNING" },
            { id: 2, emp_code: "3171000000000002", nik: null, adjustment_name: "PREMI RAKING" },
            { id: 3, emp_code: "B0003", nik: "3171000000000003", adjustment_name: "PREMI TBS" }
        ];
        const index = buildManualAdjustmentIdentityIndex(adjustments);

        expect(getManualAdjustmentsForEmployee(index, {
            emp_code: "B0001",
            actual_nik: "3171000000000001"
        }).map((row) => row.id)).toEqual([1]);

        expect(getManualAdjustmentsForEmployee(index, {
            emp_code: "B0002",
            actual_nik: "3171000000000002"
        }).map((row) => row.id)).toEqual([2]);
    });
});
