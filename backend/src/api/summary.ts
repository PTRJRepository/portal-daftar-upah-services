import { Elysia, t } from "elysia";
import { summaryService } from "../services/summaryService";
import { divisionDefinition } from "../services/divisionDefinition";
import { AuthService } from "../services/authService";
import { UserRole } from "../types/user";
import { Config } from "../config";
import { deductionAdjustmentService } from "../services/deductionAdjustmentService";
import { luasAreaService } from "../services/luasAreaService";
import { thumbprintService } from "../services/thumbprintService";

const authService = AuthService.getInstance();

export const summaryRoutes = new Elysia({ prefix: "/payroll/summary" })
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
    // --- Access Check ---
    .get("/access-check", async ({ user }) => {
        return {
            success: true,
            can_access_reports: true,
            is_proxy_mode: Config.USE_PROXY,
            is_admin: user?.role === UserRole.ADMIN,
            auth_mode: Config.AUTH_MODE
        };
    })
    // --- Periods ---
    .get("/periods", async ({ query }) => {
        const periods = await summaryService.getAvailablePeriods(query.division);
        const defaultPeriod = await summaryService.getLatestBaseDataPeriod();
        return { success: true, count: periods.length, periods, default_period: defaultPeriod };
    }, {
        query: t.Object({
            division: t.Optional(t.String())
        })
    })
    // --- Divisions ---
    .get("/divisions", async () => {
        const divisions = await summaryService.getDivisionsFromHrGang();
        return { success: true, count: divisions.length, divisions };
    })
    // --- Gangs by LocCode ---
    .get("/gangs/:loc_code", async ({ params }) => {
        const gangs = await divisionDefinition.getGangsForDivision(params.loc_code);
        return { success: true, loc_code: params.loc_code, count: gangs.length, gangs };
    })
    // --- Health ---
    .get("/health", () => ({
        success: true,
        database: "extend_db_ptrj",
        message: "Connection OK"
    }))
    // --- All Divisions Summary ---
    .get("/all-divisions", async ({ query }) => {
        const month = parseInt(query.month);
        const year = parseInt(query.year);
        const data = await summaryService.getAllDivisionsPremiTotals(month, year);

        // Calculate Grand Total
        const gt = data.reduce((acc, curr) => ({
            total_premi: acc.total_premi + curr.total_premi,
            total_employees: acc.total_employees + curr.total_employees,
            total_hk: acc.total_hk + curr.total_hk,
            total_upah_bersih: acc.total_upah_bersih + curr.total_upah_bersih,
            total_pph21: acc.total_pph21 + curr.total_pph21,
            total_spsi: acc.total_spsi + curr.total_spsi,
            total_lembur: acc.total_lembur + curr.total_lembur,
            total_gangs: acc.total_gangs + curr.total_gangs,
            thumb_print: acc.thumb_print + (curr.thumb_print || 0),
            total_manual: acc.total_manual + curr.total_manual,
            selisih: acc.selisih + curr.selisih
        }), {
            total_premi: 0, total_employees: 0, total_hk: 0, total_upah_bersih: 0,
            total_pph21: 0, total_spsi: 0, total_lembur: 0, total_gangs: 0,
            thumb_print: 0, total_manual: 0, selisih: 0
        });

        return {
            success: true,
            month, year,
            count: data.length,
            data,
            grand_total: {
                description: "GRAND TOTAL",
                ...gt,
                is_grand_total: true
            }
        };
    }, {
        query: t.Object({
            month: t.String(),
            year: t.String()
        })
    })
    // --- Division Detail Summary ---
    .get("/division", async ({ query }) => {
        const { division, month, year } = query;
        // Allow empty division for "ALL" - remove the requirement
        const result = await summaryService.getDivisionSummary(
            division || undefined,
            month ? parseInt(month) : undefined,
            year ? parseInt(year) : undefined
        );
        return {
            success: true,
            count: result.data.length,
            data: result.data,
            grand_total: result.grand_total,
            filtered_headers: result.filtered_headers
        };
    }, {
        query: t.Object({
            division: t.Optional(t.String()),
            month: t.Optional(t.String()),
            year: t.Optional(t.String())
        })
    })
    // --- Comparison Report ---
    .get("/comparison", async ({ query }) => {
        const month = parseInt(query.month);
        const year = parseInt(query.year);
        const result = await summaryService.getAllDivisionsComparison(month, year);
        return { success: true, ...result };
    }, {
        query: t.Object({
            month: t.String(),
            year: t.String()
        })
    })
    // --- Impact Report ---
    .get("/impact-report", async ({ query }) => {
        const month = parseInt(query.month);
        const year = parseInt(query.year);
        const result = await summaryService.getImpactReportData(month, year);
        return result;
    }, {
        query: t.Object({
            month: t.String(),
            year: t.String()
        })
    })
    // --- Analysis Report ---
    .get("/analysis-report", async ({ query }) => {
        const month = parseInt(query.month);
        const year = parseInt(query.year);
        const result = await summaryService.getAnalysisReportData(month, year, query.type);
        return result;
    }, {
        query: t.Object({
            month: t.String(),
            year: t.String(),
            type: t.Optional(t.String())
        })
    })
    // --- Mill PKS Totals ---
    .get("/mill-totals", async ({ query }) => {
        const month = parseInt(query.month);
        const year = parseInt(query.year);
        const result = await summaryService.getMillTotals(month, year);
        return result;
    }, {
        query: t.Object({
            month: t.String(),
            year: t.String()
        })
    })
    // --- Division Descriptions ---
    .get("/division-descriptions", async () => {
        const descriptions = await summaryService.getDivisionDescriptionsMap();
        return { success: true, descriptions };
    })
    // --- Gang Descriptions (Real-time from HR_GANG + Divisi_Description) ---
    .get("/gang-descriptions", async () => {
        const descriptions = await summaryService.getAllGangDescriptions();
        return { success: true, descriptions };
    })
    // --- Premi Headers for Division ---
    .get("/premi-headers/:loc_code", async ({ params, query }) => {
        const month = parseInt(query.month);
        const year = parseInt(query.year);
        const headers = await summaryService.getPremiHeadersForDivision(params.loc_code, month, year);
        return {
            success: true,
            loc_code: params.loc_code,
            month,
            year,
            count: headers.length,
            headers
        };
    }, {
        query: t.Object({
            month: t.String(),
            year: t.String()
        })
    })
    // --- Update Thumbprint Data ---
    .post("/thumbprint", async ({ body }) => {
        const { month, year, division_code, value } = body;

        // Ensure thumbprintService is available (imported from service, ideally should be exported via summaryService or used directly)
        // Since we didn't export it in summaryService, we'll import it here.
        // Assuming we add the import at the top of this file.
        const success = await summaryService.updateThumbprint(month, year, division_code, value);
        return { success };
    }, {
        body: t.Object({
            month: t.Number(),
            year: t.Number(),
            division_code: t.String(),
            value: t.Number()
        })
    })
    // --- Get Available Thumbprint Months ---
    .get("/thumbprint-months", async () => {
        const months = await thumbprintService.getAvailableMonths();
        return { success: true, months };
    })
    // --- Get Thumbprint Comparison ---
    .get("/thumbprint-comparison", async ({ query }) => {
        const month = parseInt(query.month);
        const year = parseInt(query.year);
        const comparison = await thumbprintService.getThumbprintComparison(month, year);
        return { success: true, ...comparison };
    }, {
        query: t.Object({
            month: t.String(),
            year: t.String()
        })
    })
    // --- Update PPH21 Adjustment ---
    .post("/update-pph21", async ({ body }) => {
        const { month, year, division_code, value } = body;
        const success = await deductionAdjustmentService.updatePPH21(month, year, division_code, value);
        return { success };
    }, {
        body: t.Object({
            month: t.Number(),
            year: t.Number(),
            division_code: t.String(),
            value: t.Number()
        })
    })
    // --- Update SPSI Adjustment ---
    .post("/update-spsi", async ({ body }) => {
        const { month, year, division_code, value } = body;
        const success = await deductionAdjustmentService.updateSPSI(month, year, division_code, value);
        return { success };
    }, {
        body: t.Object({
            month: t.Number(),
            year: t.Number(),
            division_code: t.String(),
            value: t.Number()
        })
    })
    // --- Update Both Deductions at Once ---
    .post("/update-deductions", async ({ body }) => {
        const { month, year, division_code, pph21, spsi } = body;
        const success = await deductionAdjustmentService.updateDeductions(month, year, division_code, pph21, spsi);
        return { success };
    }, {
        body: t.Object({
            month: t.Number(),
            year: t.Number(),
            division_code: t.String(),
            pph21: t.Number(),
            spsi: t.Number()
        })
    })
    // --- Get Deduction Adjustments for Period ---
    .get("/deduction-adjustments", async ({ query }) => {
        const month = parseInt(query.month);
        const year = parseInt(query.year);
        const adjustments = await deductionAdjustmentService.getAdjustmentData(month, year);
        return { success: true, adjustments };
    }, {
        query: t.Object({
            month: t.String(),
            year: t.String()
        })
    })
    // --- Update Luas Area Adjustment ---
    .post("/update-luas-area", async ({ body }) => {
        const { month, year, division_code, value } = body;
        const success = await luasAreaService.updateLuasArea(month, year, division_code, value);
        return { success };
    }, {
        body: t.Object({
            month: t.Number(),
            year: t.Number(),
            division_code: t.String(),
            value: t.Number()
        })
    })
    // --- Get Luas Area Adjustments for Period ---
    .get("/luas-area-adjustments", async ({ query }) => {
        const month = parseInt(query.month);
        const year = parseInt(query.year);
        const adjustments = await luasAreaService.getLuasAreaData(month, year);
        return { success: true, adjustments };
    }, {
        query: t.Object({
            month: t.String(),
            year: t.String()
        })
    })
    // --- Detailed Gang Analysis ---
    .get("/gang-analysis-detail", async ({ query }) => {
        const month = parseInt(query.month);
        const year = parseInt(query.year);
        const gangCode = query.gang_code;

        if (!gangCode) {
            return { success: false, error: "gang_code is required" };
        }

        const result = await summaryService.getGangDetailedAnalysis(gangCode, month, year);
        return result;
    }, {
        query: t.Object({
            gang_code: t.String(),
            month: t.String(),
            year: t.String()
        })
    });
