import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { Config } from "./config";
import { authRoutes } from "./api/auth";
import { summaryRoutes } from "./api/summary";
import { usersRoutes } from "./api/users";
import { payrollRoutes } from "./api/payroll";
import { employeeRoutes } from "./api/employee";
import { reportsRoutes } from "./api/reports";
import { devConfigRoutes } from "./api/devConfig";
import { Database } from "./db/client";

// Initialize Database access
Database.getInstance();

const app = new Elysia()
    // CORS Configuration
    .use(cors({
        origin: true, // Allow all origins (reflects request origin)
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "x-api-key"],
        exposeHeaders: ["X-Total-Count", "X-Execution-Time-Ms"],
        credentials: true
    }))
    // Request Logging Middleware
    .onBeforeHandle(({ request, set }) => {
        const startTime = performance.now();
        // Store start time for later use
        (request as any).__startTime = startTime;
    })
    .onAfterHandle(({ request, set }) => {
        const startTime = (request as any).__startTime || performance.now();
        const duration = Math.round(performance.now() - startTime);
        const method = request.method;
        const url = new URL(request.url);

        // Only log non-health endpoints
        if (!url.pathname.includes("/health")) {
            console.log(`${method} ${url.pathname} ${duration}ms`);
        }
    })
    // Proxy Prefix Stripping (if running behind reverse proxy)
    .onBeforeHandle(({ request, set }) => {
        if (Config.USE_PROXY && Config.PROXY_STRIP_PREFIX) {
            const url = new URL(request.url);
            if (url.pathname.startsWith(Config.PROXY_STRIP_PREFIX)) {
                const newPath = url.pathname.slice(Config.PROXY_STRIP_PREFIX.length) || "/";
                // Note: Elysia doesn't support path rewriting in middleware directly
                // This is logged for debugging; actual routing handles this via prefix
                console.log(`🔀 Proxy prefix detected: ${url.pathname} -> ${newPath}`);
            }
        }
    })
    // Root endpoints
    .get("/", () => ({
        message: "Payroll Backend (Bun/Elysia) is running",
        version: "2.0.0",
        mode: Config.RUN_MODE
    }))
    .get("/health", () => ({
        status: "ok",
        timestamp: new Date().toISOString(),
        database: Config.DEFAULT_DATABASE,
        profile: Config.DB_PROFILE
    }))
    // Development config routes (no prefix)
    .use(devConfigRoutes)
    // Auth routes: /auth/login, /auth/me
    .use(authRoutes)
    // User management: /users/...
    .use(usersRoutes)
    // Reports: /reports/...
    .use(reportsRoutes)
    // Payroll: /payroll/divisions, /payroll/gangs, /payroll/report, etc.
    .use(payrollRoutes)
    // Employee details: /payroll/employee/...
    .use(employeeRoutes)
    // Summary routes already have /payroll/summary prefix in their definition
    .use(summaryRoutes)
    // Start server
    .listen({
        port: Config.PORT,
        hostname: Config.HOST
    });

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
console.log(`Run Mode: ${Config.RUN_MODE}`);
console.log(`Auth Mode: ${Config.AUTH_MODE}`);
console.log(`Database: ${Config.DEFAULT_DATABASE} @ ${Config.DB_PROFILE}`);
