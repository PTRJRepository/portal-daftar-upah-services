import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import {
    buildAb1PruningSeedPayloads,
    buildPruningSeedPayloads,
    buildRakingSeedPayloads,
    parseEstateJsonBlocks,
    PRUNING_AD_CODE,
    RAKING_AD_CODE,
    TARGET_DIVISION_CODE,
    TARGET_ESTATE
} from "./pruning_seed_payloads";

describe("AB1 pruning seed payload builder", () => {
    it("parses concatenated estate JSON blocks", () => {
        const raw = JSON.stringify([{ Estate: "ARA", Gangs: [] }])
            + "\n"
            + JSON.stringify([{ Estate: "AB1", Gangs: [] }]);

        const estates = parseEstateJsonBlocks(raw);

        expect(estates.map((estate) => estate.Estate)).toEqual(["ARA", "AB1"]);
    });

    it("builds only AB1 payloads and keeps division_code as AB1", () => {
        const estates = parseEstateJsonBlocks(JSON.stringify([
            {
                Estate: "ARA",
                Gangs: [{
                    Gang: "OLD",
                    Details: [{ Empcode: "OLD1", Employee: "OLD EMP", SubBlok: "OLD", Amount: 999 }]
                }]
            },
            {
                Estate: TARGET_ESTATE,
                Gangs: [{
                    Gang: "G1H",
                    Details: [
                        { Empcode: "G0030", Employee: "AHMAD DARYONO", SubBlok: "P08/06", Amount: 110000 },
                        { Empcode: "G0030", Employee: "AHMAD DARYONO", SubBlok: "P08/07", Amount: 111100 },
                        { Empcode: "G0008", Employee: "MOHAMMAD SAID", SubBlok: "P08/06", Amount: null },
                        { Empcode: "G0008", Employee: "MOHAMMAD SAID", SubBlok: "P08/07", Amount: 167200 }
                    ]
                }]
            }
        ]));

        const payloads = buildAb1PruningSeedPayloads(estates);

        expect(payloads).toHaveLength(2);
        expect(payloads.every((payload) => payload.division_code === TARGET_DIVISION_CODE)).toBe(true);
        expect(payloads.map((payload) => payload.emp_code)).toEqual(["G0030", "G0008"]);
        expect(payloads[0]).toMatchObject({
            emp_code: "G0030",
            emp_name: "AHMAD DARYONO",
            gang_code: "G1H",
            division_code: "AB1",
            adjustment_name: "PREMI PRUNING",
            amount: 221100
        });
        expect(payloads[0].remarks).toContain(`${PRUNING_AD_CODE} - (AL) TUNJANGAN PREMI ((PM) PRUNING)`);
        expect(JSON.parse(payloads[0].metadata_json)).toEqual({
            input_type: "blok",
            items: [
                { subblok: "P08/06", gang_code: "G1H", jumlah: 110000 },
                { subblok: "P08/07", gang_code: "G1H", jumlah: 111100 }
            ],
            total_amount: 221100
        });
    });

    it("builds the expected AB1 summary from the real pruning JSON file", () => {
        const filePath = join(import.meta.dir, "../../backend/data/pruning_sub_block_detail.json");
        const estates = parseEstateJsonBlocks(readFileSync(filePath, "utf-8"));

        const payloads = buildAb1PruningSeedPayloads(estates);
        const totalAmount = payloads.reduce((sum, payload) => sum + payload.amount, 0);

        expect(payloads).toHaveLength(58);
        expect(totalAmount).toBe(28937150);
        expect(payloads.every((payload) => payload.division_code === "AB1")).toBe(true);
        expect(payloads.every((payload) => !payload.division_code.includes("ARB1"))).toBe(true);
    });

    it("builds only P2A and P1B payloads from the real pruning sub-block file", () => {
        const filePath = join(import.meta.dir, "../../backend/data/pruning_sub_block_detail.json");
        const estates = parseEstateJsonBlocks(readFileSync(filePath, "utf-8"));

        const payloads = buildPruningSeedPayloads(estates, {
            targetEstates: ["P2A", "P1B"],
            importTag: "SEED_IMPORT_P2A_P1B"
        });
        const byDivision = payloads.reduce<Record<string, { employees: number; totalAmount: number; detailItems: number }>>((acc, payload) => {
            const metadata = JSON.parse(payload.metadata_json);
            acc[payload.division_code] ||= { employees: 0, totalAmount: 0, detailItems: 0 };
            acc[payload.division_code].employees += 1;
            acc[payload.division_code].totalAmount += payload.amount;
            acc[payload.division_code].detailItems += metadata.items.length;
            return acc;
        }, {});

        expect(Object.keys(byDivision).sort()).toEqual(["P1B", "P2A"]);
        expect(byDivision.P2A).toEqual({ employees: 44, totalAmount: 17619150, detailItems: 102 });
        expect(byDivision.P1B).toEqual({ employees: 13, totalAmount: 2154750, detailItems: 13 });
        expect(payloads.every((payload) => payload.remarks.includes("SEED_IMPORT_P2A_P1B"))).toBe(true);
        expect(payloads.every((payload) => !["PG2A", "PG1B"].includes(payload.division_code))).toBe(true);
    });

    it("builds raking payloads and normalizes 2A to P2A with C3H gang when gang is empty", () => {
        const estates = parseEstateJsonBlocks(JSON.stringify([
            {
                Estate: "2A",
                Gangs: [{
                    Gang: null,
                    Details: [
                        { Empcode: "C0162", Employee: "MULYADI", SubBlok: "P97/20", Amount: 3650000 },
                        { Empcode: "C0162", Employee: "MULYADI", SubBlok: "P97/21", Amount: 0 }
                    ]
                }]
            }
        ]));

        const payloads = buildRakingSeedPayloads(estates, {
            targetEstates: ["P2A"],
            importTag: "SEED_IMPORT_RAKING"
        });

        expect(payloads).toHaveLength(1);
        expect(payloads[0]).toMatchObject({
            emp_code: "C0162",
            emp_name: "MULYADI",
            gang_code: "C3H",
            division_code: "P2A",
            adjustment_name: "PREMI RAKING",
            amount: 3650000
        });
        expect(payloads[0].remarks).toContain(`${RAKING_AD_CODE} - (AL) TUNJANGAN PREMI ((PM) WEEDING - CIRCLE RAKING)`);
        expect(JSON.parse(payloads[0].metadata_json)).toEqual({
            input_type: "blok",
            items: [
                { subblok: "P97/20", gang_code: "C3H", jumlah: 3650000 }
            ],
            total_amount: 3650000
        });
    });

    it("builds all raking payloads from the real raking sub-block file", () => {
        const filePath = join(import.meta.dir, "../../backend/data/raking_sub_block_detail.json");
        const estates = parseEstateJsonBlocks(readFileSync(filePath, "utf-8"));

        const payloads = buildRakingSeedPayloads(estates, {
            targetEstates: ["AB1", "P2A", "P2B"],
            importTag: "SEED_IMPORT_RAKING"
        });
        const byDivision = payloads.reduce<Record<string, { employees: number; totalAmount: number; detailItems: number }>>((acc, payload) => {
            const metadata = JSON.parse(payload.metadata_json);
            acc[payload.division_code] ||= { employees: 0, totalAmount: 0, detailItems: 0 };
            acc[payload.division_code].employees += 1;
            acc[payload.division_code].totalAmount += payload.amount;
            acc[payload.division_code].detailItems += metadata.items.length;
            return acc;
        }, {});

        expect(Object.keys(byDivision).sort()).toEqual(["AB1", "P2A", "P2B"]);
        expect(byDivision.AB1).toEqual({ employees: 9, totalAmount: 8262000, detailItems: 27 });
        expect(byDivision.P2A).toEqual({ employees: 2, totalAmount: 7288000, detailItems: 2 });
        expect(byDivision.P2B).toEqual({ employees: 55, totalAmount: 41730000, detailItems: 145 });
        expect(payloads.every((payload) => payload.adjustment_name === "PREMI RAKING")).toBe(true);
        expect(payloads.every((payload) => payload.remarks.includes("SEED_IMPORT_RAKING"))).toBe(true);
        expect(payloads.every((payload) => payload.division_code !== "2A")).toBe(true);
        expect(payloads.filter((payload) => payload.division_code === "P2A").every((payload) => payload.gang_code === "C3H")).toBe(true);
    });
});
