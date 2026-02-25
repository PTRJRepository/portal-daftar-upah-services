/**
 * Tax Report Routes
 * 
 * API endpoints for tax report data:
 * - GET /tax-report/monthly — Monthly PPH21 tax report
 * - GET /tax-report/annual — Annual tax report with PTKP & PKP calculations
 * - GET /tax-report/astek-bpjs — Annual ASTEK & BPJS report
 */

import { Elysia, t } from "elysia";
import { AuthService } from "../services/authService";
import { User } from "../types/user";
import { taxReportService } from "../services/taxReportService";
import { generateMonthlyTaxExcel } from "../services/taxReportExcelService";

const authService = AuthService.getInstance();

async function getUserFromHeader(headers: Record<string, string | undefined>): Promise<User | null> {
    const authHeader = headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    const token = authHeader.split(" ")[1];
    return authService.verifyToken(token);
}

export const taxReportRoutes = new Elysia({ prefix: "/tax-report" })
    .derive(async ({ headers }) => {
        const user = await getUserFromHeader(headers);
        return { currentUser: user };
    })
    .onBeforeHandle(({ currentUser, set }) => {
        if (!currentUser) {
            set.status = 401;
            return { message: "Unauthorized" };
        }
    })

    // ========================================================
    // GET /tax-report/monthly
    // Monthly PPH21 tax report for a specific period
    // ========================================================
    .get("/monthly", async ({ query, set }) => {
        try {
            const year = parseInt(query.year as string);
            const month = parseInt(query.month as string);
            const division = query.division as string || undefined;
            const gang = query.gang as string || undefined;

            if (!year || !month || month < 1 || month > 12) {
                set.status = 400;
                return { error: "Invalid year or month parameter" };
            }

            const result = await taxReportService.getMonthlyTaxReport(year, month, division, gang);
            return result;
        } catch (error: any) {
            console.error("[TaxReport] Error fetching monthly tax report:", error);
            set.status = 500;
            return { error: error.message || "Failed to fetch monthly tax report" };
        }
    })

    // ========================================================
    // GET /tax-report/monthly/excel
    // Download Monthly PPH21 tax report as Excel with formulas
    // ========================================================
    .get("/monthly/excel", async ({ query, set }) => {
        try {
            const year = parseInt(query.year as string);
            const month = parseInt(query.month as string);
            const division = query.division as string || undefined;
            const gang = query.gang as string || undefined;

            if (!year || !month || month < 1 || month > 12) {
                set.status = 400;
                return { error: "Invalid year or month parameter" };
            }

            // Fetch the base data
            const data = await taxReportService.getMonthlyTaxReport(year, month, division, gang);

            if (!data || data.employees.length === 0) {
                set.status = 404;
                return { error: "No data available for the selected period" };
            }

            // Generate Excel Buffer
            const excelBuffer = await generateMonthlyTaxExcel(data, year, month, division || 'ALL', gang || 'ALL');

            // Set headers for file download
            set.headers["Content-Type"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            set.headers["Content-Disposition"] = `attachment; filename="PPH21_${division || 'ALL'}_${gang || 'ALL'}_${month}_${year}.xlsx"`;

            return excelBuffer;
        } catch (error: any) {
            console.error("[TaxReport] Error generating Excel report:", error);
            set.status = 500;
            return { error: error.message || "Failed to generate Excel report" };
        }
    })

    // ========================================================
    // GET /tax-report/annual
    // Annual tax report with PTKP, Biaya Jabatan, PKP
    // ========================================================
    .get("/annual", async ({ query, set }) => {
        try {
            const year = parseInt(query.year as string);
            const monthStr = query.month as string | undefined;
            const month = monthStr ? parseInt(monthStr) : undefined;
            const division = query.division as string || undefined;
            const gang = query.gang as string || undefined;

            if (!year) {
                set.status = 400;
                return { error: "Invalid year parameter" };
            }

            const result = await taxReportService.getAnnualTaxReport(year, month, division, gang);
            return result;
        } catch (error: any) {
            console.error("[TaxReport] Error fetching annual tax report:", error);
            set.status = 500;
            return { error: error.message || "Failed to fetch annual tax report" };
        }
    })

    // ========================================================
    // GET /tax-report/astek-bpjs
    // Annual ASTEK & BPJS per-month report
    // ========================================================
    .get("/astek-bpjs", async ({ query, set }) => {
        try {
            const year = parseInt(query.year as string);
            const monthStr = query.month as string | undefined;
            const month = monthStr ? parseInt(monthStr) : undefined;
            const division = query.division as string || undefined;
            const gang = query.gang as string || undefined;

            if (!year) {
                set.status = 400;
                return { error: "Invalid year parameter" };
            }

            const result = await taxReportService.getAnnualAstekBpjsReport(year, month, division, gang);
            return result;
        } catch (error: any) {
            console.error("[TaxReport] Error fetching ASTEK/BPJS report:", error);
            set.status = 500;
            return { error: error.message || "Failed to fetch ASTEK/BPJS report" };
        }
    })

    // ========================================================
    // GET /tax-report/december
    // Dedicated December Tax Report with annualized aggregation
    // ========================================================
    .get("/december", async ({ query, set }) => {
        try {
            const year = parseInt(query.year as string);
            const division = query.division as string || undefined;
            const gang = query.gang as string || undefined;

            if (!year) {
                set.status = 400;
                return { error: "Invalid year parameter" };
            }

            const result = await taxReportService.getDecemberTaxReport(year, division, gang);
            return result;
        } catch (error: any) {
            console.error("[TaxReport] Error fetching December tax report:", error);
            set.status = 500;
            return { error: error.message || "Failed to fetch December tax report" };
        }
    });
