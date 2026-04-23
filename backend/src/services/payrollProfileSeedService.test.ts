import { describe, expect, it } from "bun:test";
import { PayrollProfileSeedService } from "./payrollProfileSeedService";

describe("PayrollProfileSeedService", () => {
    it("builds March seed rows from SPSI deduction and THR-compatible start date", async () => {
        const service = new PayrollProfileSeedService();

        const seed = await service.buildSeedRowFromMarch({
            emp_code: "B0001",
            nik: "3171",
            pot_spsi: 1500,
            app_join_date: "2023-01-01",
            app_join_grp_date: "2025-03-01"
        });

        expect(seed).toEqual({
            emp_code: "B0001",
            nik: "3171",
            is_spsi_member: true,
            effective_start_date: "2025-03-01"
        });
    });
});
