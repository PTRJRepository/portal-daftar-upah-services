import { env } from "bun";
import { config } from "dotenv";
import { join } from "path";

// Load .env file FIRST before any other code
// Use explicit path to ensure .env is found
const envPath = join(import.meta.dir, "../.env");
console.log("[Config] Loading .env from:", envPath);

// Try loading dotenv
const dotenvResult = config({ path: envPath });
console.log("[Config] dotenv result:", dotenvResult.error ? dotenvResult.error.message : "Success");

// Debug: Verify env loading BEFORE any Config class access
console.log("[Config] === ENV DEBUG ===");
console.log("[Config] env.DB_PROFILE =", env.DB_PROFILE);
console.log("[Config] env.RUN_MODE =", env.RUN_MODE);
console.log("[Config] =================");

export type RunMode = "dev" | "prod";

export class Config {
    // Server Configuration
    public static readonly PORT: number = parseInt(env.PORT || "8002", 10);
    public static readonly HOST: string = env.HOST || "0.0.0.0";
    public static readonly RUN_MODE: RunMode = (env.RUN_MODE as RunMode) || "dev";

    // Proxy Configuration
    public static readonly USE_PROXY: boolean = (env.USE_PROXY === "true");
    public static readonly PROXY_STRIP_PREFIX: string = env.PROXY_STRIP_PREFIX || "/backend/upah";

    // Auth Mode: If proxy is true, default to 'external'. Else 'internal'.
    public static readonly AUTH_MODE: "internal" | "external" =
        (env.AUTH_MODE as "internal" | "external") ||
        (Config.USE_PROXY ? "external" : "internal");

    // Database Configuration (SQL Gateway)
    public static readonly DB_API_URL: string = env.DB_API_URL || "http://localhost:8001";
    public static readonly DB_API_KEY: string = env.DB_API_KEY || "";
    public static readonly DB_PROFILE: string =
        env.DB_PROFILE || (Config.RUN_MODE === "prod" ? "SERVER_PROFILE_2" : "SERVER_PROFILE_1");
    public static readonly DEFAULT_DATABASE: string = env.DB_DATABASE || "db_ptrj";

    // Database Timeouts
    public static readonly DB_CONN_TIMEOUT: number = parseInt(env.DB_CONN_TIMEOUT || "60");
    public static readonly DB_QUERY_TIMEOUT: number = parseInt(env.DB_QUERY_TIMEOUT || "30");
    public static readonly DB_QUERY_RETRIES: number = parseInt(env.DB_QUERY_RETRIES || "3");

    // Extended Database (for aggregation history)
    public static readonly DB_EXTEND_DATABASE: string = env.DB_EXTEND_DATABASE || "extend_db_ptrj";
    public static readonly DB_EXTEND_PROFILE: string = env.DB_EXTEND_PROFILE || "SERVER_PROFILE_1";


    // VenusHR14 Database (for Mill PKS data)
    public static readonly DB_VENUS_PROFILE: string = env.DB_VENUS_PROFILE || "SERVER_PROFILE_3";
    public static readonly DB_VENUS_DATABASE: string = env.DB_VENUS_DATABASE || "VenusHR14";

    // Mill Database (for WM_TICKET / FFB weight data)
    public static readonly DB_MILL_PROFILE: string = env.DB_MILL_PROFILE || "SERVER_PROFILE_3";
    public static readonly DB_MILL_DATABASE: string = env.DB_MILL_DATABASE || "db_ptrj_mill";

    // Authentication Configuration
    public static readonly JWT_SECRET: string = env.JWT_SECRET || "default_debug_secret";
    public static readonly ACCESS_TOKEN_EXPIRE_MINUTES: number = parseInt(env.ACCESS_TOKEN_EXPIRE_MINUTES || "60");

    // External Auth Keys (if needed)
    public static readonly PUBLIC_KEY_PATH: string = "keys/public.pem";
    public static readonly PRIVATE_KEY_PATH: string = "keys/private.pem";

    // Payroll Constants
    public static readonly UPAH_MINIMUM_DASAR: number = parseFloat(env.CONSTANTS_UPAH_MINIMUM_DASAR || "3876600");
    public static readonly BPJS_GAJI_POKOK_MIN: number = parseFloat(env.CONSTANTS_POTONGAN_BPJS_GAJI_POKOK_MIN || "3876600");
    public static readonly IURAN_SPSI: number = parseFloat(env.CONSTANTS_POTONGAN_BPJS_IURAN_SPSI || "4000");

    // Test Mode Configuration
    public static readonly TEST_MODE: boolean = (env.TEST_MODE === "true");
    public static readonly DEFAULT_GANG: string = env.DEFAULT_GANG || "H1H";
    public static readonly DEFAULT_MONTH: number = parseInt(env.DEFAULT_MONTH || "12");
    public static readonly DEFAULT_YEAR: number = parseInt(env.DEFAULT_YEAR || "2025");

    // Logging
    public static readonly LOG_LEVEL: string = env.LOG_LEVEL || "info";

    // Helper Methods
    public static get isDev(): boolean {
        return this.RUN_MODE === "dev";
    }

    public static get isProd(): boolean {
        return this.RUN_MODE === "prod";
    }

    public static get isTestMode(): boolean {
        return this.TEST_MODE || this.isDev;
    }
}