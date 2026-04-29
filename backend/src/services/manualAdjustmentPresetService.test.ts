import { describe, expect, it } from "bun:test";
import { ManualAdjustmentPresetService } from "./manualAdjustmentPresetService";

function createFakeDb(rows: any[] = []) {
    const calls: { sql: string; params: any[] }[] = [];
    return {
        calls,
        db: {
            query: async (sql: string, params: any[] = []) => {
                calls.push({ sql, params });
                return rows;
            },
            queryOne: async (sql: string, params: any[] = []) => {
                calls.push({ sql, params });
                return rows[0] || null;
            }
        } as any
    };
}

describe("ManualAdjustmentPresetService", () => {
    it("creates the preset table if it does not exist", async () => {
        const { db, calls } = createFakeDb();
        const service = new ManualAdjustmentPresetService(db);

        await service.ensureTable();

        expect(calls[0].sql).toContain("CREATE TABLE dbo.payroll_manual_adjustment_presets");
        expect(calls[0].params).toEqual([]);
    });

    it("lists active presets with type, search, and division filters", async () => {
        const { db, calls } = createFakeDb([{ id: 1, adjustment_name: "PREMI PANEN", ad_code: "AL0001" }]);
        const service = new ManualAdjustmentPresetService(db);

        const rows = await service.listPresets({ adjustmentType: "PREMI", search: "panen", divisionCode: "AB1" });

        expect(rows).toHaveLength(1);
        const listCall = calls[calls.length - 1];
        expect(listCall.sql).toContain("is_active = 1");
        expect(listCall.sql).toContain("adjustment_type = ?");
        expect(listCall.sql).toContain("adjustment_name LIKE ?");
        expect(listCall.sql).toContain("(division_code = ? OR division_code IS NULL OR division_code = '')");
        expect(listCall.params).toEqual(["PREMI", "%PANEN%", "AB1"]);
    });

    it("normalizes name and ADCode when creating presets", async () => {
        const { db, calls } = createFakeDb([{ id: 7 }]);
        const service = new ManualAdjustmentPresetService(db);

        const id = await service.createPreset({
            adjustment_type: "PREMI",
            adjustment_name: "  premi   panen  ",
            ad_code: "al0001",
            task_desc: "Panen Manual",
            remarks_template: "PREMI PANEN | AL0001 - Panen Manual | 0 | sync:MISS | match:MISMATCH"
        }, "tester");

        expect(id).toBe(7);
        const insertCall = calls[calls.length - 1];
        expect(insertCall.sql).toContain("INSERT INTO dbo.payroll_manual_adjustment_presets");
        expect(insertCall.params[0]).toBe("PREMI");
        expect(insertCall.params[1]).toBe("PREMI PANEN");
        expect(insertCall.params[2]).toBe("AL0001");
        expect(insertCall.params[7]).toBe("PREMI PANEN | AL0001 - Panen Manual | 0 | sync:MISS | match:MISMATCH");
        expect(insertCall.params[9]).toBe("tester");
    });

    it("allows null remarks_template", async () => {
        const { db, calls } = createFakeDb([{ id: 8 }]);
        const service = new ManualAdjustmentPresetService(db);

        await service.createPreset({
            adjustment_type: "PREMI",
            adjustment_name: "PREMI RAKING",
            ad_code: "AL3PM0106"
        }, "tester");

        const insertCall = calls[calls.length - 1];
        expect(insertCall.params[7]).toBeNull();
    });

    it("soft deletes presets", async () => {
        const { db, calls } = createFakeDb();
        const service = new ManualAdjustmentPresetService(db);

        await service.deletePreset(12, "tester");

        const deleteCall = calls[calls.length - 1];
        expect(deleteCall.sql).toContain("SET is_active = 0");
        expect(deleteCall.params).toEqual(["tester", 12]);
    });

    it("upserts existing preset (reactivates + updates) instead of duplicate", async () => {
        const { db, calls } = createFakeDb([{ id: 42 }]);
        const service = new ManualAdjustmentPresetService(db);

        const id = await service.upsertPreset({
            adjustment_type: "PREMI",
            adjustment_name: "PREMI PANEN",
            ad_code: "AL0001",
            task_desc: "Updated Desc",
            remarks_template: "PREMI PANEN | AL0001 | 0 | sync:MISS | match:MISMATCH"
        }, "tester");

        expect(id).toBe(42);
        const upsertCall = calls[calls.length - 1];
        expect(upsertCall.sql).toContain("UPDATE dbo.payroll_manual_adjustment_presets");
        expect(upsertCall.sql).toContain("SET is_active = 1");
        expect(upsertCall.params).toContain("Updated Desc");
    });

    it("upsert inserts new preset when not exists", async () => {
        // First call (queryOne SELECT) returns null (no existing)
        // Subsequent calls use fresh empty rows, then insert returns id
        let callCount = 0;
        const calls: { sql: string; params: any[] }[] = [];
        const db: any = {
            query: async (sql: string, params: any[] = []) => {
                calls.push({ sql, params });
                // INSERT OUTPUT INSERTED.id returns [{ id: 99 }]
                if (sql.includes("OUTPUT INSERTED.id")) return [{ id: 99 }];
                return [];
            },
            queryOne: async (sql: string, params: any[] = []) => {
                calls.push({ sql, params });
                callCount++;
                // First call is SELECT for existing — return null (no existing)
                return null;
            }
        };
        const service = new ManualAdjustmentPresetService(db);

        const id = await service.upsertPreset({
            adjustment_type: "PREMI",
            adjustment_name: "PREMI COBA",
            ad_code: "AL9999",
            remarks_template: "PREMI COBA | AL9999 | 0 | sync:MISS | match:MISMATCH"
        }, "tester");

        expect(id).toBe(99);
        const createCall = calls.find((c) => c.sql.includes("OUTPUT INSERTED.id"));
        expect(createCall).toBeDefined();
        expect(createCall!.params[1]).toBe("PREMI COBA");
    });
});
