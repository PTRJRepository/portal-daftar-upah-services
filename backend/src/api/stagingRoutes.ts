import { Elysia, t } from "elysia";
import { StagingExplorerService } from "../services/additional_service/explore_staging/stagingExplorerService";
import { StagingComparisonService, LoosefruitCompareRow } from "../services/additional_service/explore_staging/stagingComparisonService";
import { error as logError } from "../utils/logger";

let _explorer: StagingExplorerService | null = null;
let _comparator: StagingComparisonService | null = null;

function getExplorer(): StagingExplorerService {
    if (!_explorer) _explorer = StagingExplorerService.getInstance();
    return _explorer;
}
function getComparator(): StagingComparisonService {
    if (!_comparator) _comparator = StagingComparisonService.getInstance();
    return _comparator;
}

const PERIODE_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

function resolvePeriode(query: Record<string, unknown>): { month: number; year: number } {
    const now = new Date();
    const fallbackMonth = now.getMonth() + 1;
    const fallbackYear = now.getFullYear();
    const periode = typeof query.periode === "string" ? query.periode.trim() : "";
    if (periode) {
        const m = PERIODE_RE.exec(periode);
        if (!m) throw new Error(`Invalid periode '${periode}', expected YYYY-MM`);
        return { month: Number(m[2]), year: Number(m[1]) };
    }
    const month = parseInt(String(query.month ?? fallbackMonth));
    const year = parseInt(String(query.year ?? fallbackYear));
    if (!Number.isFinite(month) || month < 1 || month > 12) throw new Error(`Invalid month '${query.month}'`);
    if (!Number.isFinite(year) || year < 2000 || year > 2100) throw new Error(`Invalid year '${query.year}'`);
    return { month, year };
}

export const stagingRoutes = new Elysia({ prefix: "/api/staging" })

    // ============================================================
    // Routes exposed at /api/staging/* (mounted under /backend/upah/api/staging in proxy)
    // ============================================================

    .get("/explore/tables", async ({ set }) => {
        try {
            const discovery = await getExplorer().discoverAll();
            return { success: true, data: discovery };
        } catch (e: any) {
            logError("StagingAPI", "Failed to discover tables", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    })

    .get("/explore/table/:name", async ({ params, query, set }) => {
        try {
            const name = params.name;
            const columns = await getExplorer().getColumns(name);
            const sampleLimit = parseInt(query.sample as string || "10");
            const sample = await getExplorer().sampleRows(name, sampleLimit);
            const count = await getExplorer().prodCount(name); // attempt prod count

            const prodCheck = await getExplorer().probeProdTable(name);

            return {
                success: true,
                data: {
                    table_name: name,
                    columns,
                    sample,
                    staging_rows: sample.length,
                    prod_candidates: [prodCheck],
                },
            };
        } catch (e: any) {
            logError("StagingAPI", `Failed to explore table ${params.name}`, e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        params: t.Object({ name: t.String() }),
        query: t.Object({ sample: t.Optional(t.String()) }),
    })

    // ============================================================
    // COMPARE: ATTENDANCE (Gwscannerdata vs PR_TASKREGLN)
    // ============================================================

    .get("/compare/attendance", async ({ query, set }) => {
        try {
            const date = (query.date as string) || "2026-05-28";
            const limit = parseInt(query.limit as string || "50");
            const gang = query.gang as string | undefined;
            const division = query.division as string | undefined;
            const result = await getComparator().compareAttendance(date, limit, gang, division);
            return { success: true, data: result };
        } catch (e: any) {
            logError("StagingAPI", "Attendance compare failed", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        query: t.Object({
            date: t.Optional(t.String()),
            limit: t.Optional(t.String()),
            gang: t.Optional(t.String()),
            division: t.Optional(t.String()),
        }),
    })

    // ============================================================
    // COMPARE: OVERTIME (Overtime vs PR_TASKREGLN OT=true)
    // ============================================================

    .get("/compare/overtime", async ({ query, set }) => {
        try {
            const date = (query.date as string) || "2026-05-28";
            const limit = parseInt(query.limit as string || "50");
            const gang = query.gang as string | undefined;
            const division = query.division as string | undefined;
            const result = await getComparator().compareOvertime(date, limit, gang, division);
            return { success: true, data: result };
        } catch (e: any) {
            logError("StagingAPI", "Overtime compare failed", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        query: t.Object({
            date: t.Optional(t.String()),
            limit: t.Optional(t.String()),
            gang: t.Optional(t.String()),
            division: t.Optional(t.String()),
        }),
    })

    // ============================================================
    // BRONDOL DISCREPANCY: Items in staging but not in plantware (staging > prod)
    // ============================================================

    .get("/compare/brondol-missing", async ({ query, set }) => {
        try {
            const date = (query.date as string) || "2026-05-28";
            const limit = parseInt(query.limit as string || "50");
            const gang = query.gang as string | undefined;
            const division = query.division as string | undefined;

            const result = await getComparator().compareLoosefruit(date, limit, gang, division);

            // Filter to missing only (staging_only where prod_not found)
            const missingOnly = result.rows.filter((r: LoosefruitCompareRow) => !r.prod_found);

            const enriched = missingOnly.slice(0, limit).map((r: LoosefruitCompareRow) => ({
                nama: r.emp_name || r.emp_code,
                divisi: r.gang_code?.substring(0, 2) || "",  // First 2 chars (e.g., "A1")
                blok: r.from_oc || "",
                estate: r.division || "",
                jumlah_selisih: r.staging_lf_bunches,
                emp_code: r.emp_code,
                trans_date: r.trans_date,
            }));

            return { success: true, count: enriched.length, data: enriched };
        } catch (e: any) {
            logError("StagingAPI", "Brondol missing compare failed", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        query: t.Object({
            date: t.Optional(t.String()),
            limit: t.Optional(t.String()),
            gang: t.Optional(t.String()),
            division: t.Optional(t.String()),
        }),
    })

    // ============================================================
    // COMPARE: LOOSEFRUIT (Ffbscannerdata vs PR_LOOSEFRUITLN)
    // ============================================================

    .get("/compare/loosefruit", async ({ query, set }) => {
        try {
            const date = (query.date as string) || "2026-05-28";
            const limit = parseInt(query.limit as string || "50");
            const gang = query.gang as string | undefined;
            const division = query.division as string | undefined;
            const missingOnly = query.missing_only === "true";

            const result = await getComparator().compareLoosefruit(date, limit, gang, division);

            let rows = result.rows;
            if (missingOnly) {
                rows = rows.filter((r: LoosefruitCompareRow) => !r.prod_found);
            }

            return { success: true, data: { rows, summary: result.summary } };
        } catch (e: any) {
            logError("StagingAPI", "Loosefruit compare failed", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        query: t.Object({
            date: t.Optional(t.String()),
            limit: t.Optional(t.String()),
            gang: t.Optional(t.String()),
            division: t.Optional(t.String()),
            missing_only: t.Optional(t.String()),
        }),
    })

    // ============================================================
    // DAILY SUMMARY: Attendance per day for a month
    // ============================================================

    .get("/compare/daily-attendance", async ({ query, set }) => {
        try {
            const month = parseInt(query.month as string || "5");
            const year = parseInt(query.year as string || "2026");
            const topN = parseInt(query.top as string || "15");
            const days = await getComparator().dailyAttendanceSummary(month, year, topN);
            return { success: true, data: days };
        } catch (e: any) {
            logError("StagingAPI", "Daily attendance summary failed", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        query: t.Object({
            month: t.Optional(t.String()),
            year: t.Optional(t.String()),
            top: t.Optional(t.String()),
        }),
    })

    // ============================================================
    // DAILY SUMMARY: Overtime per day for a month
    // ============================================================

    .get("/compare/daily-overtime", async ({ query, set }) => {
        try {
            const month = parseInt(query.month as string || "5");
            const year = parseInt(query.year as string || "2026");
            const topN = parseInt(query.top as string || "15");
            const days = await getComparator().dailyOvertimeSummary(month, year, topN);
            return { success: true, data: days };
        } catch (e: any) {
            logError("StagingAPI", "Daily overtime summary failed", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        query: t.Object({
            month: t.Optional(t.String()),
            year: t.Optional(t.String()),
            top: t.Optional(t.String()),
        }),
    })

    // ============================================================
    // DAILY SUMMARY: Loosefruit per day for a month
    // ============================================================

    .get("/compare/daily-loosefruit", async ({ query, set }) => {
        try {
            const month = parseInt(query.month as string || "5");
            const year = parseInt(query.year as string || "2026");
            const topN = parseInt(query.top as string || "15");
            const days = await getComparator().dailyLoosefruitSummary(month, year, topN);
            return { success: true, data: days };
        } catch (e: any) {
            logError("StagingAPI", "Daily loosefruit summary failed", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        query: t.Object({
            month: t.Optional(t.String()),
            year: t.Optional(t.String()),
            top: t.Optional(t.String()),
        }),
    })

    // ============================================================
    // LOOSEFRUIT ANOMALIES: DocDate contains '_' (e.g. LF90439471_01)
    // ============================================================

    .get("/compare/loosefruit-anomaly", async ({ query, set }) => {
        try {
            const limit = parseInt(query.limit as string || "100");
            const result = await getComparator().loosefruitAnomalies(limit);
            return { success: true, data: result };
        } catch (e: any) {
            logError("StagingAPI", "Loosefruit anomaly fetch failed", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        query: t.Object({
            limit: t.Optional(t.String()),
        }),
    })

    // ============================================================
    // MONTHLY MATRIX: per-employee aggregate for a full month
    // ============================================================

    .get("/compare/monthly-attendance", async ({ query, set }) => {
        try {
            const month = parseInt(query.month as string || "5");
            const year = parseInt(query.year as string || "2026");
            const gang = query.gang as string | undefined;
            const division = query.division as string | undefined;
            return { success: true, data: await getComparator().monthlyAttendance(month, year, gang, division) };
        } catch (e: any) { set.status = 500; return { success: false, error: e.message }; }
    }, { query: t.Object({ month: t.Optional(t.String()), year: t.Optional(t.String()), gang: t.Optional(t.String()), division: t.Optional(t.String()) }) })

    .get("/compare/monthly-overtime", async ({ query, set }) => {
        try {
            const month = parseInt(query.month as string || "5");
            const year = parseInt(query.year as string || "2026");
            const gang = query.gang as string | undefined;
            const division = query.division as string | undefined;
            return { success: true, data: await getComparator().monthlyOvertime(month, year, gang, division) };
        } catch (e: any) { set.status = 500; return { success: false, error: e.message }; }
    }, { query: t.Object({ month: t.Optional(t.String()), year: t.Optional(t.String()), gang: t.Optional(t.String()), division: t.Optional(t.String()) }) })

    .get("/compare/monthly-loosefruit", async ({ query, set }) => {
        try {
            const month = parseInt(query.month as string || "5");
            const year = parseInt(query.year as string || "2026");
            const gang = query.gang as string | undefined;
            const division = query.division as string | undefined;
            return { success: true, data: await getComparator().monthlyLoosefruit(month, year, gang, division) };
        } catch (e: any) { set.status = 500; return { success: false, error: e.message }; }
    }, { query: t.Object({ month: t.Optional(t.String()), year: t.Optional(t.String()), gang: t.Optional(t.String()), division: t.Optional(t.String()) }) })

    .get("/compare/pivot-attendance", async ({ query, set }) => {
        try {
            const month = parseInt(query.month as string || "5");
            const year = parseInt(query.year as string || "2026");
            return { success: true, data: await getComparator().pivotAttendance(month, year, query.gang as string | undefined, query.division as string | undefined) };
        } catch (e: any) { set.status = 500; return { success: false, error: e.message }; }
    }, { query: t.Object({ month: t.Optional(t.String()), year: t.Optional(t.String()), gang: t.Optional(t.String()), division: t.Optional(t.String()) }) })

    .get("/compare/pivot-overtime", async ({ query, set }) => {
        try {
            const month = parseInt(query.month as string || "5");
            const year = parseInt(query.year as string || "2026");
            return { success: true, data: await getComparator().pivotOvertime(month, year, query.gang as string | undefined, query.division as string | undefined) };
        } catch (e: any) { set.status = 500; return { success: false, error: e.message }; }
    }, { query: t.Object({ month: t.Optional(t.String()), year: t.Optional(t.String()), gang: t.Optional(t.String()), division: t.Optional(t.String()) }) })

    .get("/compare/pivot-loosefruit", async ({ query, set }) => {
        try {
            const month = parseInt(query.month as string || "5");
            const year = parseInt(query.year as string || "2026");
            return { success: true, data: await getComparator().pivotLoosefruit(month, year, query.gang as string | undefined, query.division as string | undefined) };
        } catch (e: any) { set.status = 500; return { success: false, error: e.message }; }
    }, { query: t.Object({ month: t.Optional(t.String()), year: t.Optional(t.String()), gang: t.Optional(t.String()), division: t.Optional(t.String()) }) })

    .get("/compare/summary-all", async ({ query, set }) => {
        try {
            const month = parseInt(query.month as string || "5");
            const year = parseInt(query.year as string || "2026");
            return { success: true, data: await getComparator().summaryAll(month, year, query.gang as string | undefined, query.division as string | undefined) };
        } catch (e: any) { set.status = 500; return { success: false, error: e.message }; }
    }, { query: t.Object({ month: t.Optional(t.String()), year: t.Optional(t.String()), gang: t.Optional(t.String()), division: t.Optional(t.String()) }) })

    .get("/compare/employee-detail", async ({ query, set }) => {
        try {
            const empCode = query.emp_code as string;
            const month = parseInt(query.month as string || "5");
            const year = parseInt(query.year as string || "2026");
            if (!empCode) { set.status = 400; return { success: false, error: "emp_code required" }; }
            return { success: true, data: await getComparator().employeeDetail(empCode, month, year) };
        } catch (e: any) { set.status = 500; return { success: false, error: e.message }; }
    }, { query: t.Object({ emp_code: t.Optional(t.String()), month: t.Optional(t.String()), year: t.Optional(t.String()) }) })

    .get("/compare/cell-detail", async ({ query, set }) => {
        try {
            const module = query.module as string;
            const empCode = query.emp_code as string;
            const date = query.date as string;
            if (!module || !empCode || !date) {
                set.status = 400;
                return { success: false, error: "module, emp_code, date required" };
            }
            return { success: true, data: await getComparator().cellDetail(module, empCode, date) };
        } catch (e: any) { set.status = 500; return { success: false, error: e.message }; }
    }, { query: t.Object({ module: t.Optional(t.String()), emp_code: t.Optional(t.String()), date: t.Optional(t.String()) }) })

    // ============================================================
    // COMPARE: MONTHLY BRONDOL (Staging Ffbscannerdata.LOOSEFRUIT vs Plantware PR_LOOSEFRUITLN)
    //   Returns employee identity (emp_code, emp_name, gang, division) + selisih per month
    // ============================================================

    .get("/compare/brondol-monthly", async ({ query, set }) => {
        try {
            const month = parseInt(query.month as string || String(new Date().getMonth() + 1));
            const year = parseInt(query.year as string || String(new Date().getFullYear()));
            const gang = query.gang as string | undefined;
            const division = query.division as string | undefined;
            const result = await getComparator().monthlyBrondolComparison(month, year, gang, division);
            return { success: true, data: result };
        } catch (e: any) {
            logError("StagingAPI", "Brondol monthly compare failed", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        query: t.Object({
            month: t.Optional(t.String()),
            year: t.Optional(t.String()),
            gang: t.Optional(t.String()),
            division: t.Optional(t.String()),
        }),
    })

    // Alias requested by frontend: /api/staging-comparison
    // Same payload as /compare/brondol-monthly (rows = identity + staging/plantware/selisih, summary = match count).
    // Query: periode=YYYY-MM (preferred) OR month+year. Optional gang / division filters.
    .get("/staging-comparison", async ({ query, set }) => {
        try {
            const { month, year } = resolvePeriode(query);
            const gang = (query.gang as string | undefined)?.trim() || undefined;
            const division = (query.division as string | undefined)?.trim() || undefined;
            const result = await getComparator().monthlyBrondolComparison(month, year, gang, division);
            return { success: true, data: result };
        } catch (e: any) {
            logError("StagingAPI", "Staging comparison failed", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        query: t.Object({
            periode: t.Optional(t.String()),
            month: t.Optional(t.String()),
            year: t.Optional(t.String()),
            gang: t.Optional(t.String()),
            division: t.Optional(t.String()),
        }),
    });
