import { afterEach, describe, expect, it } from "bun:test";
import { Database } from "../../db/client";
import { divisionConfigService } from "./DivisionConfigService";

describe("DivisionConfigService gang exclusions", () => {
    const originalGetInstance = Database.getInstance;

    afterEach(() => {
        (Database as any).getInstance = originalGetInstance;
    });

    it("excludes F1BHL from ARA gang listings without removing other ARA gangs", async () => {
        (Database as any).getInstance = () => ({
            query: async () => [
                { gang_code: "F1BHL", description: "F1BHL", loc_code: "ARA" },
                { gang_code: "F1H", description: "F1H", loc_code: "ARA" },
                { gang_code: "F1M", description: "F1M", loc_code: "ARA" },
                { gang_code: "F2H", description: "F2H", loc_code: "ARA" },
                { gang_code: "F2M", description: "F2M", loc_code: "ARA" },
                { gang_code: "F3H", description: "F3H", loc_code: "ARA" }
            ]
        });

        const gangs = await divisionConfigService.getGangsForDivision("ARA");
        const gangCodes = gangs.map((gang) => gang.gang_code);

        expect(gangCodes).not.toContain("F1BHL");
        expect(gangCodes).toEqual(["F1H", "F1M", "F2H", "F2M", "F3H"]);
    });
});
