import { describe, expect, it } from "bun:test";
import { PayrollOverlayService } from "./payrollOverlayService";

describe("PayrollOverlayService", () => {
    it("normalizes profile payload for append-only write", async () => {
        const queryOneCalls: Array<{ sql: string; params?: any[] | Record<string, any> }> = [];
        const queryCalls: Array<{ sql: string; params?: any[] | Record<string, any> }> = [];
        const db = {
            async queryOne(sql: string, params?: any[] | Record<string, any>) {
                queryOneCalls.push({ sql, params });
                return { next_index: 5 };
            },
            async query(sql: string, params?: any[] | Record<string, any>) {
                queryCalls.push({ sql, params });
                return [{ id: 99 }];
            }
        };

        const service = new PayrollOverlayService(db as any);
        const id = await service.saveProfileOverride({
            emp_code: "B0001",
            nik: "3171",
            is_spsi_member: true,
            effective_start_date: " 2024-01-10 ",
            changed_by: "tester",
            change_source: "DAFTAR_UPAH_UI"
        });

        expect(id).toBe(99);
        expect(queryOneCalls).toHaveLength(1);
        expect(queryCalls).toHaveLength(1);
        expect(queryCalls[0].params).toEqual([
            "B0001",
            "3171",
            1,
            "2024-01-10",
            null,
            5,
            "DAFTAR_UPAH_UI",
            null,
            "tester"
        ]);
    });

    it("resolves latest profile overrides from history rows", async () => {
        const db = {
            async queryOne() {
                return null;
            },
            async query() {
                return [
                    { emp_code: "B0001", update_index: 1, is_spsi_member: false },
                    { emp_code: "B0001", update_index: 3, is_spsi_member: true },
                    { emp_code: "B0002", update_index: 2, is_spsi_member: false }
                ];
            }
        };

        const service = new PayrollOverlayService(db as any);
        const latest = await service.getLatestProfileOverrides(["B0001", "B0002"]);

        expect(latest.get("B0001")?.is_spsi_member).toBe(true);
        expect(latest.get("B0002")?.update_index).toBe(2);
    });

    it("resolves latest value overrides inside requested period scope", async () => {
        const db = {
            async queryOne() {
                return null;
            },
            async query() {
                return [
                    {
                        period_year: 2026,
                        period_month: 4,
                        division_code: "AB1",
                        gang_code: "A1",
                        emp_code: "B0001",
                        field_name: "premi_dynamic",
                        numeric_value: 2000,
                        update_index: 1
                    },
                    {
                        period_year: 2026,
                        period_month: 4,
                        division_code: "AB1",
                        gang_code: "A1",
                        emp_code: "B0001",
                        field_name: "premi_dynamic",
                        numeric_value: 6000,
                        update_index: 4
                    }
                ];
            }
        };

        const service = new PayrollOverlayService(db as any);
        const latest = await service.getLatestValueOverrides({
            month: 4,
            year: 2026,
            divisionCode: "AB1",
            gangCode: "ALL"
        });

        expect(latest.get("2026:4:AB1:A1:B0001:premi_dynamic")?.numeric_value).toBe(6000);
    });
});
