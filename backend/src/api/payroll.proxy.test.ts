import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";

process.env.LOG_TO_FILE = "false";

const { Config } = await import("../config");
const { payrollRoutes } = await import("./payroll");

const buildProxyContractApp = () => new Elysia()
    .get("/backend/upah/health", () => ({ status: "ok" }))
    .group("/backend/upah", app => app.use(payrollRoutes));

describe("proxy payroll route contract", () => {
    it("exposes proxy health under /backend/upah", async () => {
        const app = buildProxyContractApp();
        const response = await app.handle(new Request("http://localhost/backend/upah/health"));
        const json = await response.json() as any;

        expect(response.status).toBe(200);
        expect(json.status).toBe("ok");
    });

    it("mounts payroll routes under /backend/upah/payroll", async () => {
        const app = buildProxyContractApp();
        const response = await app.handle(new Request("http://localhost/backend/upah/payroll/premium-definitions", {
            headers: { Authorization: `Bearer ${Config.SYSTEM_TOKEN}` }
        }));
        const json = await response.json() as any;

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
        expect(Array.isArray(json.data)).toBe(true);
    });

    it("exposes locked token verification under proxy prefix", async () => {
        const app = buildProxyContractApp();
        const response = await app.handle(new Request("http://localhost/backend/upah/payroll/locked/verify", {
            headers: { Authorization: `Bearer ${Config.SYSTEM_TOKEN}` }
        }));
        const json = await response.json() as any;

        expect(response.status).toBe(200);
        expect(json.valid).toBe(true);
        expect(json.username).toBe("system");
        expect(Array.isArray(json.divisions)).toBe(true);
    });

    it("keeps stream route reachable under proxy prefix before auth", async () => {
        const app = buildProxyContractApp();
        const response = await app.handle(new Request("http://localhost/backend/upah/payroll/report/division-raw-tree/stream?division_code=PG1A&month=5&year=2026"));
        const json = await response.json() as any;

        expect(response.status).toBe(401);
        expect(json.error || json.message).toBeTruthy();
    });
});