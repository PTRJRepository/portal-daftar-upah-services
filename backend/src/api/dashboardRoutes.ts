import { Elysia, t } from "elysia";
import { dashboardService } from "../services/dashboardService";

export const dashboardRoutes = new Elysia({ prefix: "/payroll/dashboard" })
    .get("/executive-summary", async ({ query, set }) => {
        try {
            const month = query.month ? parseInt(query.month) : new Date().getMonth() + 1;
            const year = query.year ? parseInt(query.year) : new Date().getFullYear();

            const trends = await dashboardService.getPayrollTrend(month, year);
            const breakdown = await dashboardService.getDivisionBreakdown(month, year);
            const gangBreakdown = await dashboardService.getGangBreakdown(month, year);
            const efficiency = await dashboardService.getDivisionEfficiency(month, year);

            const productivityTrend = await dashboardService.getProductivityTrend(month, year);
            const wageSpikes = await dashboardService.getWageSpikes(month, year);

            // KPI calculation (Current vs Previous Month in the trend series)
            const current = trends[trends.length - 1] || {};
            const prev = trends[trends.length - 2] || {};

            const kpi = {
                curr_wage: current.total_wage || 0,
                prev_wage: prev.total_wage || 0,
                curr_ot: current.total_ot || 0,
                prev_ot: prev.total_ot || 0,
                curr_headcount: current.total_headcount || 0,
                prev_headcount: prev.total_headcount || 0
            };

            return {
                success: true,
                data: {
                    trends,
                    breakdown,
                    gangBreakdown,
                    efficiency,
                    productivityTrend,
                    wageSpikes,
                    kpi
                }
            };
        } catch (e: any) {
            set.status = 500;
            return {
                success: false,
                error: e.message
            };
        }
    }, {
        query: t.Object({
            month: t.String(),
            year: t.String()
        })
    })
    .get('/latest-period', async ({ set }) => {
        try {
            const period = await dashboardService.getLatestPeriod();
            return { success: true, data: period };
        } catch (e: any) {
            set.status = 500;
            return { success: false, error: e.message };
        }
    })
    .get('/filter-options', async ({ query, set }) => {
        try {
            const month = parseInt(query.month);
            const year = parseInt(query.year);
            const options = await dashboardService.getFilterOptions(month, year);
            return { success: true, data: options };
        } catch (e: any) {
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        query: t.Object({
            month: t.String(),
            year: t.String()
        })
    })
    .post('/comparison', async ({ body, set }) => {
        try {
            const { type, codes, month, year } = body;
            const data = await dashboardService.getComparisonData(type, codes, month, year);
            return { success: true, data };
        } catch (e: any) {
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        body: t.Object({
            type: t.Union([t.Literal('division'), t.Literal('gang')]),
            codes: t.Array(t.String()),
            month: t.Numeric(),
            year: t.Numeric()
        })
    })
    .get('/aggregation/gang-data', async ({ query, set }) => {
        try {
            const division = query.division_code;
            const month = parseInt(query.month);
            const year = parseInt(query.year);
            const data = await dashboardService.getAggregatedGangData(division, month, year);
            return { success: true, data };
        } catch (e: any) {
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        query: t.Object({
            division_code: t.String(),
            month: t.String(),
            year: t.String()
        })
    })
    .get('/premi-analysis', async ({ query, set }) => {
        try {
            const month = parseInt(query.month);
            const year = parseInt(query.year);
            const division = query.division_code;
            const data = await dashboardService.getPremiAnalysis(month, year, division);
            return { success: true, data };
        } catch (e: any) {
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        query: t.Object({
            month: t.String(),
            year: t.String(),
            division_code: t.Optional(t.String())
        })
    });
