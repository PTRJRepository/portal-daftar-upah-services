import { Elysia, t } from "elysia";
import { AuthService } from "../services/authService";
import { Config } from "../config";
import { UserRole } from "../types/user";

export const authRoutes = new Elysia({ prefix: "/auth" })
    .decorate("authService", AuthService.getInstance())
    .post("/login", async ({ body, authService, set }) => {
        const { username, password } = body;
        const user = await authService.authenticate(username, password);

        if (!user) {
            set.status = 401;
            return { message: "Invalid credentials" };
        }

        const token = await authService.createToken(user);

        return {
            access_token: token,
            token_type: "bearer",
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                full_name: user.full_name,
                divisions: user.divisions
            }
        };
    }, {
        body: t.Object({
            username: t.String(),
            password: t.String()
        })
    })
    .derive(async ({ headers, authService }) => {
        // Check X-API-Key header for bypass
        const apiKey = headers["x-api-key"];
        if (apiKey && Config.API_KEY_BYPASS && apiKey === Config.API_KEY_BYPASS) {
            console.log("[Auth] API Key bypass used. Granting ADMIN access.");
            return {
                user: {
                    id: 0,
                    username: "api_key_admin",
                    email: "apikey@admin.com",
                    full_name: "API Key Admin (Bypass)",
                    role: UserRole.ADMIN,
                    divisions: AuthService.ALL_DIVISIONS,
                    is_active: true,
                    created_at: new Date(),
                    updated_at: new Date()
                }
            };
        }

        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return { user: null };
        }
        const token = authHeader.split(" ")[1];
        const user = await authService.verifyToken(token);
        return { user };
    })
    .get("/me", ({ user, set }) => {
        if (!user) {
            set.status = 401;
            return { message: "Unauthorized" };
        }
        return user;
    })
    .get("/accessible-divisions", ({ user, authService, set }) => {
        if (!user) {
            set.status = 401;
            return { message: "Unauthorized" };
        }
        return authService.getAccessibleDivisions(user);
    });
