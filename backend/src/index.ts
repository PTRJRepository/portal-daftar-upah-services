import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { Config } from "./config";
import { authRoutes } from "./api/auth";
import { summaryRoutes } from "./api/summary";
import { usersRoutes } from "./api/users";
import { payrollRoutes } from "./api/payroll";
import { employeeRoutes } from "./api/employee";
import { reportsRoutes } from "./api/reports";
import { employeeEstateRoutes } from "./api/employeeEstate";
import { tunjanganRoutes } from "./api/tunjangan";
import { devConfigRoutes } from "./api/devConfig";
import { Database } from "./db/client";
import { staticPlugin } from "@elysiajs/static";


// Initialize Database access
Database.getInstance();

console.log("\n\n!!! BACKEND STARTUP - DEBUG VERSION A0374 (Step 830) !!!\n\n");
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
    // Serve Frontend Static Files
    // Serve Frontend Static Files explicitly
    .get("/", () => {
        console.log("!!! ROOT HANDLER HIT !!! Serving index.html...");
        return Bun.file("../frontend/dist/index.html");
    })
    .get("/index.html", () => Bun.file("../frontend/dist/index.html"))
    .get("/vite.svg", () => Bun.file("../frontend/dist/vite.svg"))

    // Serve assets (JS/CSS) - Handle /upah prefix from Vite production build
    .use(staticPlugin({
        assets: "../frontend/dist",
        prefix: "/upah"
    }))
    // Also serve at root /assets just in case
    .use(staticPlugin({
        assets: "../frontend/dist/assets",
        prefix: "/assets"
    }))
    .get("/api-info", () => ({
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
    // Job Title / Estate Management
    .use(employeeEstateRoutes)
    .use(tunjanganRoutes)
    // Summary routes already have /payroll/summary prefix in their definition
    .use(summaryRoutes)

    // --- PROXY SUPPORT: Mount API routes under /backend/upah as well ---
    // --- PROXY SUPPORT: Mount API routes under /backend/upah as well ---
    // Explicitly using the string literal to ensure matching
    .group("/backend/upah", app => app
        .use(authRoutes)
        .use(usersRoutes)
        .use(reportsRoutes)
        .use(payrollRoutes)
        .use(employeeRoutes)
        .use(employeeEstateRoutes)
        .use(tunjanganRoutes)
        .use(summaryRoutes)
        .use(devConfigRoutes)
    )

    // SPA Fallback: Serve index.html for any unknown routes (excluding API)
    .get("*", async ({ request, set }) => {
        const url = new URL(request.url);
        const pathname = url.pathname;
        console.log(`!!! CATCH-ALL HIT for ${pathname} !!!`);

        // Critical Fix: Do NOT serve HTML for API request failures.
        // If it looks like an API call (starts with /backend, /api, or common API segments), return JSON 404.
        if (pathname.startsWith("/backend") || pathname.startsWith("/api") || pathname.includes("/payroll/")) {
            console.log("-> Returning 404 JSON for likely API path (preventing HTML injection)");
            set.status = 404;
            return { error: "Route not found", path: pathname, hint: "Check proxy routing or URL prefix" };
        }

        console.log("-> Serving index.html...");
        return Bun.file("../frontend/dist/index.html");
    })
    // Start server
    .listen({
        port: Config.PORT,
        hostname: Config.HOST
    });

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
console.log(`Run Mode: ${Config.RUN_MODE}`);
console.log(`Auth Mode: ${Config.AUTH_MODE}`);
console.log(`Database: ${Config.DEFAULT_DATABASE} @ ${Config.DB_PROFILE}`);
