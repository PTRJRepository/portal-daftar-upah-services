import { describe, expect, it } from "bun:test";
import { PayrollSnapshotBatchService } from "./payrollSnapshotBatchService";

describe("PayrollSnapshotBatchService", () => {
    it("creates snapshot_version + 1 for the requested scope", async () => {
        const queryOneCalls: Array<{ sql: string; params?: any[] | Record<string, any> }> = [];
        const queryCalls: Array<{ sql: string; params?: any[] | Record<string, any> }> = [];
        const db = {
            async queryOne(sql: string, params?: any[] | Record<string, any>) {
                queryOneCalls.push({ sql, params });
                return { latest_version: 2 };
            },
            async query(sql: string, params?: any[] | Record<string, any>) {
                queryCalls.push({ sql, params });
                return [{ id: 71, snapshot_version: 3 }];
            }
        };

        const service = new PayrollSnapshotBatchService(db as any);
        const result = await service.createNextBatch({
            period_month: 4,
            period_year: 2026,
            division_code: "AB1",
            gang_code: "A1",
            created_by: "tester"
        });

        expect(result).toEqual({ id: 71, snapshot_version: 3 });
        expect(queryOneCalls).toHaveLength(1);
        const insertCall = queryCalls.find(call => call.sql.includes("INSERT INTO dbo.payroll_snapshot_batch"));
        expect(insertCall).toBeTruthy();
        expect(insertCall?.params).toEqual([
            4,
            2026,
            "AB1",
            "A1",
            3,
            "tester"
        ]);
    });
});
