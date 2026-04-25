import { describe, expect, test } from "bun:test";
import { Config } from "../config";
import { User, UserRole } from "../types/user";
import {
    buildApiKeyBypassUser,
    getForwardAuthorizationHeader,
    hasValidApiKeyBypass,
    isBearerOrApiKeyAuthorized,
    resolveUserFromHeaders,
    TokenVerifier
} from "./authBypass";

const ORIGINAL_API_KEY_BYPASS = Config.API_KEY_BYPASS;
const ORIGINAL_DEV_BYPASS_TOKEN = Config.DEV_BYPASS_TOKEN;

function setBypassConfig(apiKey: string, devBypassToken: string = "dev-token"): void {
    (Config as any).API_KEY_BYPASS = apiKey;
    (Config as any).DEV_BYPASS_TOKEN = devBypassToken;
}

function restoreBypassConfig(): void {
    (Config as any).API_KEY_BYPASS = ORIGINAL_API_KEY_BYPASS;
    (Config as any).DEV_BYPASS_TOKEN = ORIGINAL_DEV_BYPASS_TOKEN;
}

describe("authBypass", () => {
    test("hasValidApiKeyBypass validates x-api-key against config", () => {
        setBypassConfig("test-api-key");

        expect(hasValidApiKeyBypass({ "x-api-key": "test-api-key" })).toBe(true);
        expect(hasValidApiKeyBypass({ "x-api-key": "wrong-key" })).toBe(false);
        expect(hasValidApiKeyBypass({})).toBe(false);

        restoreBypassConfig();
    });

    test("isBearerOrApiKeyAuthorized accepts bearer or valid api key", () => {
        setBypassConfig("test-api-key");

        expect(isBearerOrApiKeyAuthorized({ authorization: "Bearer abc" })).toBe(true);
        expect(isBearerOrApiKeyAuthorized({ "x-api-key": "test-api-key" })).toBe(true);
        expect(isBearerOrApiKeyAuthorized({ "x-api-key": "bad-key" })).toBe(false);

        restoreBypassConfig();
    });

    test("getForwardAuthorizationHeader returns bearer directly when present", () => {
        setBypassConfig("test-api-key");
        expect(getForwardAuthorizationHeader({ authorization: "Bearer jwt-token" })).toBe("Bearer jwt-token");
        restoreBypassConfig();
    });

    test("getForwardAuthorizationHeader synthesizes bearer from api key bypass", () => {
        setBypassConfig("test-api-key", "dev-bypass");
        expect(getForwardAuthorizationHeader({ "x-api-key": "test-api-key" })).toBe("Bearer dev-bypass");
        restoreBypassConfig();
    });

    test("resolveUserFromHeaders returns bypass admin user for valid api key", async () => {
        setBypassConfig("test-api-key");

        const verifier: TokenVerifier = {
            verifyToken: async () => null
        };

        const user = await resolveUserFromHeaders({ "x-api-key": "test-api-key" }, verifier);
        expect(user).not.toBeNull();
        expect(user?.role).toBe(UserRole.ADMIN);
        expect(user?.username).toBe("api_key_admin");

        restoreBypassConfig();
    });

    test("resolveUserFromHeaders delegates bearer token verification", async () => {
        setBypassConfig("test-api-key");

        const expectedUser: User = {
            id: 99,
            username: "verified-user",
            email: "verified@example.com",
            full_name: "Verified User",
            role: UserRole.USER,
            divisions: ["P1A"],
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
        };

        const verifier: TokenVerifier = {
            verifyToken: async (token: string) => {
                expect(token).toBe("jwt-token");
                return expectedUser;
            }
        };

        const user = await resolveUserFromHeaders({ authorization: "Bearer jwt-token" }, verifier);
        expect(user?.username).toBe("verified-user");

        restoreBypassConfig();
    });

    test("buildApiKeyBypassUser creates admin user shape", () => {
        const user = buildApiKeyBypassUser();
        expect(user.role).toBe(UserRole.ADMIN);
        expect(user.divisions.length).toBeGreaterThan(0);
    });
});
