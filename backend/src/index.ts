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
import { aggregationSeederRoutes } from "./api/aggregationSeederRoutes";
import { spreadsheetRoutes } from "./api/spreadsheetRoutes";
import { dashboardRoutes } from "./api/dashboardRoutes";
import { historyRoutes } from "./api/historyRoutes";
import { wagesRoutes } from "./api/wagesRoutes";
import { logsRoutes } from "./api/logsRoutes";
import { taxReportRoutes } from "./api/taxReportRoutes";
import { employeeHrDataRoutes } from "./api/employeeHrDataRoutes";
import { employeeGangHistoryRoutes } from "./api/employeeGangHistoryRoutes";
import { employeeComparisonRoutes } from "./api/employeeComparisonRoutes";
import { otherIncomesRoutes } from "./api/otherIncomesRoutes";
import { millProductionRoutes } from "./api/millProductionRoutes";
import { Database } from "./db/client";
import { employeeHrDataService } from "./services/employeeHrDataService";
import { OtherIncomesService } from "./services/otherIncomesService";
import { historyDatabaseService } from "./services/historyDatabaseService";
import { staticPlugin } from "@elysiajs/static";
import { debug, info, warn, error } from "./utils/logger";

// Initialize Database access
Database.getInstance();

// Background initialization
setTimeout(() => {
    employeeHrDataService.ensureTablesExist().catch(err => error("Init", "Failed to ensure HR tables", err));
    OtherIncomesService.initTable().catch(err => error("Init", "Failed to init OtherIncomes table", err));
    // Migration: add new_nik column for NIK change tracking (append-only pattern)
    historyDatabaseService.migrateNewNikColumn().catch(err => error("Init", "Failed to migrate new_nik column", err));
}, 1000);

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
        const url = new URL(request.url);

        // Skip logging for health, static assets, and favicon
        if (url.pathname.includes("/health") ||
            url.pathname.includes("/assets/") ||
            url.pathname.includes("/images/") ||
            url.pathname.includes("/vite.svg") ||
            url.pathname.includes("favicon")) {
            return;
        }

        // Log slow requests (> 1s) with warning, normal requests with info
        const method = request.method;
        if (duration > 1000) {
            warn("HTTP", `SLOW ${method} ${url.pathname} ${duration}ms`);
        } else {
            // Only log non-GET requests at INFO level
            // GET requests are logged at DEBUG level to reduce terminal noise.
            if (method !== "GET") {
                info("HTTP", `${method} ${url.pathname} ${duration}ms`);
            } else {
                debug("HTTP", `${method} ${url.pathname} ${duration}ms`);
            }
        }
    })
    // Proxy Prefix Stripping (if running behind reverse proxy)
    .onBeforeHandle(({ request, set }) => {
        if (Config.USE_PROXY && Config.PROXY_STRIP_PREFIX) {
            const url = new URL(request.url);
            if (url.pathname.startsWith(Config.PROXY_STRIP_PREFIX)) {
                const newPath = url.pathname.slice(Config.PROXY_STRIP_PREFIX.length) || "/";
                // Note: Elysia doesn't support path rewriting in middleware directly
                // Actual routing handles this via prefix grouping below
            }
        }
    })
    // Root endpoints
    // Serve Frontend Static Files
    .get("/", () => Bun.file("../frontend/dist/index.html"))
    .get("/index.html", () => Bun.file("../frontend/dist/index.html"))
    .get("/vite.svg", () => Bun.file("../frontend/dist/vite.svg"))

    // Serve all static files from dist root (handles /assets, /images, etc. naturally)
    .use(staticPlugin({
        assets: "../frontend/dist",
        prefix: "/"
    }))

    // Explicit fallback for /assets in case static plugin doesn't work
    .get("/assets/*", async ({ params, set }) => {
        const filePath = `../frontend/dist/assets/${params["*"]}`;
        const file = Bun.file(filePath);
        if (await file.exists()) {
            return file;
        }
        set.status = 404;
        return "Asset not found";
    })

    // Explicit fallback for /images in case static plugin doesn't work
    .get("/images/*", async ({ params, set }) => {
        const filePath = `../frontend/dist/images/${params["*"]}`;
        const file = Bun.file(filePath);
        if (await file.exists()) {
            return file;
        }
        set.status = 404;
        return "Image not found";
    })

    // ========================
    // PROXY MODE STATIC FILES
    // When frontend is built with base: '/upah/', assets are requested at /upah/assets/...
    // ========================
    .get("/upah", () => Bun.file("../frontend/dist/index.html"))
    .get("/upah/", () => Bun.file("../frontend/dist/index.html"))
    .get("/upah/index.html", () => Bun.file("../frontend/dist/index.html"))

    // Serve /upah/assets/* - main chunk files, CSS, JS
    .get("/upah/assets/*", async ({ params, set }) => {
        const p = params["*"];
        const filePath = `../frontend/dist/assets/${p}`;
        const file = Bun.file(filePath);
        const exists = await file.exists();

        if (exists) {
            // Set correct content-type based on extension
            const ext = filePath.split('.').pop()?.toLowerCase();
            if (ext === 'js') {
                set.headers['Content-Type'] = 'application/javascript';
            } else if (ext === 'css') {
                set.headers['Content-Type'] = 'text/css';
            }
            return file;
        }
        set.status = 404;
        return "Asset not found";
    })

    // Serve /upah/images/*
    .get("/upah/images/*", async ({ params, set }) => {
        const filePath = `../frontend/dist/images/${params["*"]}`;
        const file = Bun.file(filePath);
        if (await file.exists()) {
            return file;
        }
        set.status = 404;
        return "Image not found";
    })

    // Serve any other /upah/* static files (like fonts, etc)
    .get("/upah/*", async ({ params, set, request }) => {
        const pathname = params["*"];

        // If it's a SPA route (no extension), serve index.html
        if (!pathname.includes('.')) {
            return Bun.file("../frontend/dist/index.html");
        }

        // Otherwise try to serve the static file
        const filePath = `../frontend/dist/${pathname}`;
        const file = Bun.file(filePath);
        if (await file.exists()) {
            return file;
        }
        set.status = 404;
        return "File not found";
    })

    .get("/api-info", () => ({
        message: "Payroll Backend (Bun/Elysia) is running",
        version: "2.0.0",
        mode: Config.RUN_MODE
    }))
    // [OPTIMIZATION] Cache statistics endpoint
    .get("/api/cache/stats", () => {
        const { cacheService } = require("./services/cacheService");
        const { lemburCalculator } = require("./services/lemburCalculator");
        return {
            payroll_cache: cacheService.getStats(),
            lembur_holiday_years_cached: Array.from(lemburCalculator.holidayCache?.keys() || []),
            note: "Cache enabled for historical payroll periods only. Current period data is always fresh."
        };
    })
    // [OPTIMIZATION] Clear cache endpoint (admin use)
    .post("/api/cache/clear", () => {
        const { cacheService } = require("./services/cacheService");
        const before = cacheService.getStats().size;
        cacheService.clear();
        return { cleared: true, entries_removed: before };
    })
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
    // Aggregation seeding routes
    .use(aggregationSeederRoutes)
    // Spreadsheet Sync
    .use(spreadsheetRoutes)
    // Summary routes already have /payroll/summary prefix in their definition
    .use(summaryRoutes)
    .use(dashboardRoutes)
    // History routes
    .use(historyRoutes)
    // Wages comparison routes
    .use(wagesRoutes)
    // Logs routes (dev only)
    .use(logsRoutes)
    // Tax Report routes
    .use(taxReportRoutes)
    // Employee HR Data (NIK override, etc)
    .use(employeeHrDataRoutes)
    .use(employeeGangHistoryRoutes)
    .use(employeeComparisonRoutes)
    // Other Incomes (THR, Bonus, Custom)
    .use(otherIncomesRoutes)
    // Mill Production Report
    .group("/api/mill-production", app => app.use(millProductionRoutes))

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
        .use(aggregationSeederRoutes)
        .use(spreadsheetRoutes)
        .use(spreadsheetRoutes)
        .use(summaryRoutes)
        .use(dashboardRoutes)
        .use(historyRoutes)
        .use(wagesRoutes)
        .use(logsRoutes)
        .use(devConfigRoutes)
        .use(taxReportRoutes)
        .use(employeeHrDataRoutes)
        .use(employeeGangHistoryRoutes)
        .use(employeeComparisonRoutes)
        .use(otherIncomesRoutes)
        .group("/api/mill-production", nestedApp => nestedApp.use(millProductionRoutes))
    )

    // Test route - must be before wildcard
    .get("/api/employee-compare/test", () => ({
        test: "working"
    }))
    // SPA Fallback: Serve index.html for any unknown routes (excluding API and files with extensions)
    .get("*", async ({ request, set }) => {
        const url = new URL(request.url);
        const pathname = url.pathname;

        // If it looks like an API call, return 404
        const isApi = pathname.startsWith("/api") || pathname.includes("/payroll/");
        if (isApi) {
            set.status = 404;
            return { error: "Route not found", path: pathname };
        }

        // If it looks like a static file (has extension), return 404 - static plugin should have handled it
        const hasExtension = pathname.includes(".");
        if (hasExtension) {
            set.status = 404;
            return "File not found";
        }

        // Otherwise, serve index.html for SPA routing
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
