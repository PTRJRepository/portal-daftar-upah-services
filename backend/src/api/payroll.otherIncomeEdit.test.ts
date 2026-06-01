import { afterAll, beforeEach, describe, expect, it } from "bun:test";

process.env.LOG_TO_FILE = "false";

const { Config } = await import("../config");
const { Database } = await import("../db/client");
const { cacheService } = await import("../services/cacheService");

const originalGetExtendedInstance = Database.getExtendedInstance;
const originalClearByPattern = cacheService.clearByPattern;

type QueryCall = { sql: string; params?: unknown[] };

function createMockDb(results: unknown[][]) {
    const calls: QueryCall[] = [];
    return {
        calls,
        db: {
            query: async (sql: string, params?: unknown[]) => {
                calls.push({ sql, params });
                return results.shift() || [];
            }
        }
    };
}

async function postOtherIncomeEdit(body: Record<string, unknown>) {
    const { payrollRoutes } = await import("./payroll");
    return payrollRoutes.handle(new Request("http://localhost/payroll/locked/pendapatan-lainnya-edit", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${Config.SYSTEM_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            nik: "1902050504860001",
            emp_code: "b0065",
            emp_name: "BUDI TEST",
            period_month: 5,
            period_year: 2026,
            amount: 1250000,
            gang_code: "A1H",
            division_code: "AB1",
            income_type: "BONUS",
            income_name: "BONUS",
            ...body
        })
    }));
}

describe("locked pendapatan lainnya edit route", () => {
    beforeEach(() => {
        cacheService.clearByPattern = () => undefined;
    });

    afterAll(() => {
        (Database as any).getExtendedInstance = originalGetExtendedInstance;
        cacheService.clearByPattern = originalClearByPattern;
    });

    it("updates existing exgratia bonus rows by emp_code and preserves stored income name", async () => {
        const { db, calls } = createMockDb([[{ id: 88, income_name: "EXGRATIA 2025" }], []]);
        (Database as any).getExtendedInstance = () => db;

        const response = await postOtherIncomeEdit({ amount: 1750000 });
        const json = await response.json() as any;

        expect(response.status).toBe(200);
        expect(json).toMatchObject({ success: true, action: "updated", id: 88 });
        expect(json.message).toContain("EXGRATIA 2025");
        expect(calls[0].sql).toContain("emp_code");
        expect(calls[0].params).toEqual(["B0065", 2026, 5, "BONUS"]);
        expect(calls[1].sql).toContain("UPDATE employee_other_incomes");
        expect(calls[1].params).toEqual([
            "1902050504860001",
            "B0065",
            1750000,
            "BUDI TEST",
            "A1H",
            "AB1",
            "EXGRATIA 2025",
            1,
            88
        ]);
    });

    it("inserts new bonus rows with emp_code and taxable flag", async () => {
        const { db, calls } = createMockDb([[], [], []]);
        (Database as any).getExtendedInstance = () => db;

        const response = await postOtherIncomeEdit({ emp_code: "C0012", income_name: "BONUS PANEN", amount: 500000 });
        const json = await response.json() as any;

        expect(response.status).toBe(200);
        expect(json).toMatchObject({ success: true, action: "inserted" });
        expect(calls[2].sql).toContain("INSERT INTO employee_other_incomes");
        expect(calls[2].params).toEqual([
            "1902050504860001",
            "C0012",
            "BUDI TEST",
            "AB1",
            "A1H",
            2026,
            5,
            "BONUS",
            "BONUS PANEN",
            500000,
            1
        ]);
    });

    it("deletes existing bonus rows when edited amount is zero", async () => {
        const { db, calls } = createMockDb([[{ id: 99, income_name: "EXGRATIA 2025" }], []]);
        (Database as any).getExtendedInstance = () => db;

        const response = await postOtherIncomeEdit({ amount: 0 });
        const json = await response.json() as any;

        expect(response.status).toBe(200);
        expect(json).toMatchObject({ success: true, action: "deleted" });
        expect(calls[1].sql).toContain("DELETE FROM employee_other_incomes WHERE id = ?");
        expect(calls[1].params).toEqual([99]);
    });
});
