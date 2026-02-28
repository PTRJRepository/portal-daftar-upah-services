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
import { generateMonthlyTaxExcel, generateDecemberTaxExcel } from "../services/taxReportExcelService";
import { ptkpTaxService } from "../services/ptkpTaxService";

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
    .get("/monthly", async ({ query, set, currentUser }) => {
        try {
            const year = parseInt(query.year as string);
            const month = parseInt(query.month as string);
            let division = query.division as string || undefined;
            const gang = query.gang as string || undefined;

            if (currentUser?.role?.toLowerCase() === 'kerani' && currentUser?.divisions?.length > 0) {
                division = currentUser.divisions[0];
            }

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
    .get("/monthly/excel", async ({ query, set, currentUser }) => {
        try {
            const year = parseInt(query.year as string);
            const month = parseInt(query.month as string);
            let division = query.division as string || undefined;
            const gang = query.gang as string || undefined;

            if (currentUser?.role?.toLowerCase() === 'kerani' && currentUser?.divisions?.length > 0) {
                division = currentUser.divisions[0];
            }

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
    .get("/annual", async ({ query, set, currentUser }) => {
        try {
            const year = parseInt(query.year as string);
            const monthStr = query.month as string | undefined;
            const month = monthStr ? parseInt(monthStr) : undefined;
            let division = query.division as string || undefined;
            const gang = query.gang as string || undefined;

            if (currentUser?.role?.toLowerCase() === 'kerani' && currentUser?.divisions?.length > 0) {
                division = currentUser.divisions[0];
            }

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
    .get("/astek-bpjs", async ({ query, set, currentUser }) => {
        try {
            const year = parseInt(query.year as string);
            const monthStr = query.month as string | undefined;
            const month = monthStr ? parseInt(monthStr) : undefined;
            let division = query.division as string || undefined;
            const gang = query.gang as string || undefined;

            if (currentUser?.role?.toLowerCase() === 'kerani' && currentUser?.divisions?.length > 0) {
                division = currentUser.divisions[0];
            }

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
    .get("/december", async ({ query, set, currentUser }) => {
        try {
            const year = parseInt(query.year as string);
            let division = query.division as string || undefined;
            const gang = query.gang as string || undefined;

            if (currentUser?.role?.toLowerCase() === 'kerani' && currentUser?.divisions?.length > 0) {
                division = currentUser.divisions[0];
            }

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
    })

    // ========================================================
    // GET /tax-report/december/excel
    // Download December tax report with monthly breakdown as Excel
    // ========================================================
    .get("/december/excel", async ({ query, set, currentUser }) => {
        try {
            const year = parseInt(query.year as string);
            let division = query.division as string || undefined;
            const gang = query.gang as string || undefined;

            if (currentUser?.role?.toLowerCase() === 'kerani' && currentUser?.divisions?.length > 0) {
                division = currentUser.divisions[0];
            }

            if (!year) {
                set.status = 400;
                return { error: "Invalid year parameter" };
            }

            // Fetch the base data
            const data = await taxReportService.getDecemberTaxReport(year, division, gang);

            if (!data || data.employees.length === 0) {
                set.status = 404;
                return { error: "No data available for the selected period" };
            }

            // Generate Excel Buffer
            const excelBuffer = await generateDecemberTaxExcel(data, year, division || 'ALL', gang || 'ALL');

            // Set headers for file download
            set.headers["Content-Type"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            set.headers["Content-Disposition"] = `attachment; filename="PAJAK_DESEMBER_${division || 'ALL'}_${gang || 'ALL'}_${year}.xlsx"`;

            return excelBuffer;
        } catch (error: any) {
            console.error("[TaxReport] Error generating December Excel report:", error);
            set.status = 500;
            return { error: error.message || "Failed to generate Excel report" };
        }
    })

    // ========================================================
    // PUT /tax-report/ptkp/:emp_code
    // Update PTKP status for a specific employee (portal edit)
    // ========================================================
    .put("/ptkp/:emp_code", async ({ params, body, set, currentUser }) => {
        try {
            const { year, ptkp_status } = body as { year: number; ptkp_status: string };
            const empCode = params.emp_code;

            if (!year || !ptkp_status) {
                set.status = 400;
                return { success: false, error: "year and ptkp_status are required" };
            }

            const validStatuses = ['TK/0', 'TK/1', 'TK/2', 'TK/3', 'K/0', 'K/1', 'K/2', 'K/3'];
            if (!validStatuses.includes(ptkp_status)) {
                set.status = 400;
                return { success: false, error: `Invalid PTKP status. Must be one of: ${validStatuses.join(', ')}` };
            }

            const username = currentUser?.username || 'system';
            const result = await ptkpTaxService.updatePtkpStatus(year, empCode, ptkp_status, username);

            return { success: true, updated: result, emp_code: empCode, year, ptkp_status };
        } catch (error: any) {
            console.error("[TaxReport] Error updating PTKP:", error);
            set.status = 500;
            return { success: false, error: error.message || "Failed to update PTKP status" };
        }
    }, {
        body: t.Object({
            year: t.Number(),
            ptkp_status: t.String()
        })
    });
