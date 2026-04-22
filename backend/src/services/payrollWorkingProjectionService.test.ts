import { describe, expect, it } from "bun:test";
import { PayrollWorkingProjectionService } from "./payrollWorkingProjectionService";

describe("PayrollWorkingProjectionService", () => {
    it("applies latest SPSI and effective start override", () => {
        const service = new PayrollWorkingProjectionService();
        const rows = service.applyOverrides({
            month: 4,
            year: 2026,
            rows: [{
                emp_code: "B0001",
                nik: "3171",
                gang_code: "A1",
                division_code: "AB1",
                pot_spsi: 0,
                join_date: "2024-01-01"
            }],
            profileOverrides: new Map([["B0001", {
                emp_code: "B0001",
                is_spsi_member: true,
                effective_start_date: "2025-03-01",
                update_index: 2
            } as any]]),
            valueOverrides: new Map()
        });

        expect(rows[0].is_spsi_member).toBe(true);
        expect(rows[0].effective_start_date).toBe("2025-03-01");
        expect(rows[0].masa_kerja_label).toBe("1 thn 1 bln");
    });

    it("applies period value overrides to premi, koreksi, and potongan lain", () => {
        const service = new PayrollWorkingProjectionService();
        const rows = service.applyOverrides({
            month: 4,
            year: 2026,
            rows: [{
                emp_code: "B0001",
                nik: "3171",
                gang_code: "A1",
                division_code: "AB1",
                premi_dynamic: 1000,
                pot_koreksi: -200,
                pot_lainnya: 50
            }],
            profileOverrides: new Map(),
            valueOverrides: new Map([
                ["2026:4:AB1:A1:B0001:premi_dynamic", { numeric_value: 7000 } as any],
                ["2026:4:AB1:A1:B0001:pot_koreksi", { numeric_value: -1000 } as any]
            ])
        });

        expect(rows[0].premi_dynamic).toBe(7000);
        expect(rows[0].pot_koreksi).toBe(-1000);
    });
});
