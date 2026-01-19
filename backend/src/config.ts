import { env } from "bun";

export type RunMode = "dev" | "prod";

export class Config {
    // New: Proxy Mode Flag (default false)
    public static readonly USE_PROXY: boolean = (env.USE_PROXY === "true");

    public static readonly RUN_MODE: RunMode = (env.RUN_MODE as RunMode) || "dev";

    // Auth Mode logic mimicking Python's main.py:
    // If proxy is true, default to 'external'. Else 'internal'.
    // Can still be overridden by explicit AUTH_MODE env var.
    public static readonly AUTH_MODE: "internal" | "external" =
        (env.AUTH_MODE as "internal" | "external") || 
        (Config.USE_PROXY ? "external" : "internal");

    public static readonly PORT: number = parseInt(env.PORT || "8002");
    
    public static readonly DB_PROFILE: string =
        env.DB_PROFILE || (Config.RUN_MODE === "prod" ? "SERVER_PROFILE_2" : "SERVER_PROFILE_1");

    public static readonly DB_API_URL: string = env.DB_API_URL || "http://localhost:3001";
    public static readonly DB_API_KEY: string = env.DB_API_KEY || "";

    public static readonly DB_CONN_TIMEOUT: number = parseInt(env.DB_CONN_TIMEOUT || "60");
    public static readonly DB_QUERY_TIMEOUT: number = parseInt(env.DB_QUERY_TIMEOUT || "30");
    public static readonly DB_QUERY_RETRIES: number = parseInt(env.DB_QUERY_RETRIES || "2");

    public static readonly DEFAULT_DATABASE: string = env.DB_DATABASE || "db_ptrj";

    // Auth Configuration
    public static readonly JWT_SECRET: string = env.JWT_SECRET || "default_debug_secret";
    
    // Paths for external auth keys (if needed)
    public static readonly PUBLIC_KEY_PATH: string = "keys/public_key.pem";
    public static readonly PRIVATE_KEY_PATH: string = "keys/private_key.pem";

    public static get isDev(): boolean {
        return this.RUN_MODE === "dev";
    }

    public static get isProd(): boolean {
        return this.RUN_MODE === "prod";
    }
}