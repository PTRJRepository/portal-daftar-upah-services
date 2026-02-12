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
import { Database } from "./db/client";
import { staticPlugin } from "@elysiajs/static";


// Initialize Database access
console.log("\n\n=== BACKEND CONFIGURATION VERIFICATION ===");
console.log(`RUN_MODE: ${Config.RUN_MODE}`);
console.log(`DB_PROFILE: ${Config.DB_PROFILE}`);
console.log(`DEFAULT_DATABASE: ${Config.DEFAULT_DATABASE}`);
console.log(`DB_EXTEND_PROFILE: ${Config.DB_EXTEND_PROFILE}`);
console.log(`DB_EXTEND_DATABASE: ${Config.DB_EXTEND_DATABASE}`);
console.log(`DB_EXTEND_TRANS_DATABASE: ${process.env.DB_EXTEND_TRANS_DATABASE || "extend_db_ptrj_transaksi"}`);
console.log(`DB_VENUS_PROFILE: ${Config.DB_VENUS_PROFILE}`);
console.log(`DB_VENUS_DATABASE: ${Config.DB_VENUS_DATABASE}`);
console.log(`DB_API_URL: ${Config.DB_API_URL}`);
console.log("==========================================\n\n");

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
        console.log(`[ASSETS] File not found: ${filePath}`);
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
        console.log(`[IMAGES] File not found: ${filePath}`);
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
        console.log(`[UPAH/ASSETS] Request: ${p}, Resolving: ${filePath}`);

        const file = Bun.file(filePath);
        const exists = await file.exists();
        console.log(`[UPAH/ASSETS] Exists: ${exists}`);

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
        console.log(`[UPAH/ASSETS] 404 Not found`);
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
        console.log(`[UPAH/IMAGES] File not found: ${filePath}`);
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
        console.log(`[UPAH/*] File not found: ${filePath}`);
        set.status = 404;
        return "File not found";
    })

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
    // Aggregation seeding routes
    .use(aggregationSeederRoutes)
    // Spreadsheet Sync
    .use(spreadsheetRoutes)
    // Summary routes already have /payroll/summary prefix in their definition
    .use(summaryRoutes)
    .use(dashboardRoutes)
    // History routes
    .use(historyRoutes)

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
        .use(devConfigRoutes)
    )

    // SPA Fallback: Serve index.html for any unknown routes (excluding API and files with extensions)
    .get("*", async ({ request, set }) => {
        const url = new URL(request.url);
        const pathname = url.pathname;
        console.log(`!!! CATCH-ALL HIT for ${pathname} !!!`);

        // If it looks like an API call, return 404
        const isApi = pathname.startsWith("/backend") || pathname.startsWith("/api") || pathname.includes("/payroll/");
        if (isApi) {
            console.log(`-> Returning 404 for API: ${pathname}`);
            set.status = 404;
            return { error: "Route not found", path: pathname };
        }

        // If it looks like a static file (has extension), return 404 - static plugin should have handled it
        const hasExtension = pathname.includes(".");
        if (hasExtension) {
            console.log(`-> Returning 404 for missing static file: ${pathname}`);
            set.status = 404;
            return "File not found";
        }

        // Otherwise, serve index.html for SPA routing
        console.log("-> Serving index.html for SPA route...");
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
