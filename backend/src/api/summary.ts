import { Elysia, t } from "elysia";
import { summaryService } from "../services/summaryService";
import { AuthService } from "../services/authService";
import { UserRole } from "../types/user";

const authService = AuthService.getInstance();

export const summaryRoutes = new Elysia({ prefix: "/summary" })
    .derive(async ({ headers }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return { user: null };
        }
        const token = authHeader.split(" ")[1];
        const user = await authService.verifyToken(token);
        return { user };
    })
    .onBeforeHandle(({ user, set }) => {
        if (!user) {
            set.status = 401;
            return { message: "Unauthorized" };
        }
    })
    // --- Access Check (New) ---
    .get("/access-check", async ({ user }) => {
        // Simple access check - if user is authenticated (handled by onBeforeHandle), they have access.
        // We can add more specific logic here if needed (e.g. role check).
        
        return {
            has_access: true,
            user_role: user?.role || "user",
            division_access: user?.role === UserRole.ADMIN ? "ALL" : user?.divisions || []
        };
    })
    .get("/all-divisions", async ({ query }) => {
        const month = parseInt(query.month || "0");
        const year = parseInt(query.year || "0");

        if (!month || !year) {
            throw new Error("Month and Year are required");
        }

        const data = await summaryService.getAllDivisionsPremiTotals(month, year);

        const totalPremi = data.reduce((sum, d) => sum + d.total_premi, 0);
        const totalUpah = data.reduce((sum, d) => sum + d.total_upah_bersih, 0);

        return {
            success: true,
            month,
            year,
            count: data.length,
            data,
            grand_total: {
                description: "GRAND TOTAL",
                total_premi: totalPremi,
                total_upah_bersih: totalUpah,
                is_grand_total: true
            }
        };
    }, {
        query: t.Object({
            month: t.String(),
            year: t.String()
        })
    })
    .get("/division", async ({ query }) => {
        const { division } = query;
        const month = parseInt(query.month || "0");
        const year = parseInt(query.year || "0");

        if (!division) throw new Error("Division is required");

        const data = await summaryService.getDivisionSummary(division, month || undefined, year || undefined);
        return {
            success: true,
            count: data.length,
            data
        };
    }, {
        query: t.Object({
            division: t.String(),
            month: t.Optional(t.String()),
            year: t.Optional(t.String())
        })
    });