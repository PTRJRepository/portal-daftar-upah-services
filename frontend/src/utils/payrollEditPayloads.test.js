import { describe, expect, it } from "bun:test";
import { splitPayrollEdits } from "./payrollEditPayloads";

describe("splitPayrollEdits", () => {
    it("separates profile edits from period value edits", () => {
        const result = splitPayrollEdits({
            month: 4,
            year: 2026,
            division: "AB1",
            edits: [
                { emp_code: "B0001", nik: "3171", field: "is_spsi_member", value: true, gang_code: "A1" },
                { emp_code: "B0001", nik: "3171", field: "effective_start_date", value: "2025-03-01", gang_code: "A1" },
                { emp_code: "B0001", nik: "3171", field: "premi_dynamic", value: 9000, gang_code: "A1" }
            ]
        });

        expect(result.profileItems).toHaveLength(1);
        expect(result.valueItems).toHaveLength(1);
        expect(result.profileItems[0].is_spsi_member).toBe(true);
        expect(result.valueItems[0].field_name).toBe("premi_dynamic");
    });
});
