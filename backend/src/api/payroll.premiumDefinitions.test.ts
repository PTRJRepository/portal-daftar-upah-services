import { describe, expect, it } from "bun:test";

describe("payroll premium definitions route", () => {
    it("returns active manual adjustment templates as well as premium definitions", async () => {
        process.env.LOG_TO_FILE = "false";
        const { Config } = await import("../config");
        const { payrollRoutes } = await import("./payroll");

        const response = await payrollRoutes.handle(new Request("http://localhost/payroll/premium-definitions", {
            headers: {
                Authorization: `Bearer ${Config.SYSTEM_TOKEN}`
            }
        }));
        const body = await response.json() as any;

        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.data).toContainEqual(expect.objectContaining({
            adjustment_type: "POTONGAN_KOTOR",
            adjustment_name: "KOREKSI X",
            task_desc: "(DE) POTONGAN PREMI"
        }));
    });
});
