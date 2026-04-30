import { describe, expect, it } from "bun:test";
import {
    attachManualAdjustmentMetadata,
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
            adjustment_name: "KOREKSI PANEN",
            amount: 100000,
            detail_total: 90000,
            detail_matches_amount: false
        });
        expect(row.manual_adjustment_metadata_mismatch.koreksi_panen).toEqual({
            amount: 100000,
            detail_total: 90000,
            diff: -10000
        });
    });

    it("registers dynamic premium and koreksi headers from metadata rows even when amounts are not applied", () => {
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
                    metadata_json: JSON.stringify({ input_type: "blok", total_amount: 50000, items: [] })
                }
            ],
            dynamicPremiSet,
            dynamicPotonganSet,
            premiTitleMap,
            potonganTitleMap
        );

        expect(Array.from(dynamicPremiSet)).toEqual(["premi_pruning"]);
        expect(Array.from(dynamicPotonganSet)).toEqual(["koreksi_panen"]);
        expect(premiTitleMap).toEqual({ premi_pruning: "PREMI PRUNING" });
        expect(potonganTitleMap).toEqual({ koreksi_panen: "KOREKSI PANEN" });
    });
});
