import { Elysia } from "elysia";
import { Config } from "../config";

/**
 * Development mode info endpoint
 * Matches Python's /dev-mode endpoint
 */
export const devConfigRoutes = new Elysia()
    .get("/dev-mode", () => ({
        dev_mode: Config.isDev,
        run_mode: Config.RUN_MODE,
        auth_mode: Config.AUTH_MODE,
        use_proxy: Config.USE_PROXY,
        test_mode: Config.TEST_MODE,
        default_gang: Config.DEFAULT_GANG,
        default_month: Config.DEFAULT_MONTH,
        default_year: Config.DEFAULT_YEAR,
        environment_vars: {
            TEST_MODE: Config.TEST_MODE,
            DEV_MODE: Config.isDev,
            DB_PROFILE: Config.DB_PROFILE,
            DB_DATABASE: Config.DEFAULT_DATABASE,
            DB_API_URL: Config.DB_API_URL,
            LOG_LEVEL: Config.LOG_LEVEL
        },
        constants: {
            upah_minimum_dasar: Config.UPAH_MINIMUM_DASAR,
            bpjs_gaji_pokok_min: Config.BPJS_GAJI_POKOK_MIN,
            iuran_spsi: Config.IURAN_SPSI
        }
    }))
    .get("/config", () => ({
        success: true,
        config: {
            run_mode: Config.RUN_MODE,
            auth_mode: Config.AUTH_MODE,
            use_proxy: Config.USE_PROXY,
            port: Config.PORT,
            host: Config.HOST
        }
    }));
