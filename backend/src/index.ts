import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { Config } from "./config";
import { authRoutes } from "./api/auth";
import { summaryRoutes } from "./api/summary";
import { usersRoutes } from "./api/users";
import { payrollRoutes } from "./api/payroll";
import { employeeRoutes } from "./api/employee";
import { reportsRoutes } from "./api/reports";
import { Database } from "./db/client";

// Initialize Database access
Database.getInstance();

const app = new Elysia()
    .use(cors({
        origin: "*", // Allow all for dev/local
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "x-api-key"]
    }))
    .get("/", () => ({ message: "Payroll Backend (Bun/Elysia) is running" }))
    .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))
    // All routes at root level - matching frontend expectations
    .use(authRoutes)           // /auth/login, /auth/me
    .use(usersRoutes)          // /users/...
    .use(reportsRoutes)        // /reports/...
    .use(payrollRoutes)        // /payroll/divisions, /payroll/gangs
    .use(employeeRoutes)       // /payroll/employee/...
    .group("/payroll", app => app
        .use(summaryRoutes)    // /payroll/summary/...
    )
    .listen(Config.PORT);

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
console.log(`Run Mode: ${Config.RUN_MODE}`);


