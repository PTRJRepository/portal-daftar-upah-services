import { Database } from "../db/client";
import { divisionDefinition } from "./divisionDefinition";
import { join } from "path";
import { file } from "bun";
import { Config } from "../config";
import { thumbprintService } from "./thumbprintService";
import { deductionAdjustmentService } from "./deductionAdjustmentService";
import { luasAreaService } from "./luasAreaService";

export interface DivisionSummary {
    division_code: string;
    description: string;
    total_premi: number;
    total_premi_excluding_special: number;  // Total premi excluding insentif, kinerja, prunning
    total_employees: number;
    total_hk: number;
    total_upah_bersih: number;
    total_pph21: number;
    total_spsi: number;
    total_lembur: number;
    total_gangs: number;
    total_premi_brondol: number;
    total_premi_prunning: number;
    total_premi_insentif: number;  // Insentif Panen from dynamic_premi
    total_premi_kinerja: number;   // Kinerja from dynamic_premi
    total_koreksi: number;         // Koreksi from dynamic_premi
    total_ffb_weight: number;
    total_weight_tbs: number;      // TBS weight from database
    informasi_tambahan: string;    // Additional info from database
    thumb_print: number;
    total_manual: number;
    selisih: number;
    is_subtotal: boolean;
    is_grand_total: boolean;
    group: string;
    [key: string]: any;
}

export class SummaryService {
    private static instance: SummaryService;
    private db: Database;
    private extendDb: Database;

    private constructor() {
        // Enforce SERVER_PROFILE_1 for summary reports
        this.db = Database.getInstance(undefined, "SERVER_PROFILE_1");
        this.extendDb = Database.getInstance("extend_db_ptrj", "SERVER_PROFILE_1");
    }

    public static getInstance(): SummaryService {
        if (!SummaryService.instance) {
            SummaryService.instance = new SummaryService();
        }
        return SummaryService.instance;
    }

    private async loadJsonData(filename: string): Promise<any> {
        try {
            const path = join(process.cwd(), "data", filename);
            const f = file(path);
            if (await f.exists()) {
                return await f.json();
            }
            return null;
        } catch (e) {
            console.error(`[SummaryService] Failed to load JSON ${filename}:`, e);
            return null;
        }
    }



    private async loadThumbprintData(month: number, year: number): Promise<Record<string, number>> {
        return await thumbprintService.getThumbprintData(month, year);
    }

    private async getDivisionDescriptions(): Promise<Record<string, string>> {
        try {
            const rows = await this.extendDb.query<{ Divisi: string, Description: string }>(`
                SELECT [Divisi], [Description] FROM [dbo].[Divisi_Description] 
                WHERE [Divisi] IS NOT NULL ORDER BY [Divisi]
            `);
            const map: Record<string, string> = {};
            for (const row of rows) {
                if (row.Divisi) {
                    map[row.Divisi.trim()] = row.Description ? row.Description.trim() : row.Divisi.trim();
                }
            }
            return map;
        } catch (e) {
            console.error("[SummaryService] Error getting descriptions:", e);
            return {};
        }
    }

    public async getAllDivisionsPremiTotals(month: number, year: number): Promise<DivisionSummary[]> {
        const descriptions = await this.getDivisionDescriptions();

        const query = `
            SELECT
                division_code,
                SUM(ISNULL(total_premi, 0)) as total_premi,
                SUM(ISNULL(total_employees, 0)) as total_employees,
                SUM(ISNULL(total_hk, 0)) as total_hk,
                SUM(ISNULL(total_upah_bersih, 0)) as total_upah_bersih,
                SUM(ISNULL(total_pph21, 0)) as total_pph21,
                SUM(ISNULL(total_spsi, 0)) as total_spsi,
                SUM(ISNULL(total_lembur, 0)) as total_lembur,
                COUNT(DISTINCT gang_code) as total_gangs,
                SUM(ISNULL(total_premi_brondol, 0)) as total_premi_brondol,
                SUM(ISNULL(total_premi_prunning, 0)) as total_premi_prunning,
                SUM(ISNULL(total_premi_insentif, 0)) as total_premi_insentif,
                SUM(ISNULL(total_premi_kinerja, 0)) as total_premi_kinerja,
                SUM(ISNULL(total_koreksi, 0)) as total_koreksi,
                MAX(ISNULL(total_ffb_weight, 0)) as total_ffb_weight,
                MAX(ISNULL(total_weight_tbs, 0)) as total_weight_tbs
            FROM dbo.daftar_upah_aggregation_history
            WHERE period_month = ? AND period_year = ? AND division_code IS NOT NULL
            GROUP BY division_code ORDER BY division_code
        `;

        const rows = await this.extendDb.query<any>(query, [month, year]);
        const thumbprintData = await this.loadThumbprintData(month, year);

        const results: DivisionSummary[] = [];

        for (const row of rows) {
            const div = row.division_code ? row.division_code.trim() : "";
            if (!div) continue;

            const totalPremi = parseFloat(row.total_premi || 0);
            const totalPremiKinerja = parseFloat(row.total_premi_kinerja || 0);
            let totalPremiPrunning = parseFloat(row.total_premi_prunning || 0);
            let totalPremiInsentif = parseFloat(row.total_premi_insentif || 0);
            let totalLembur = parseFloat(row.total_lembur || 0);

            // Backfill logic if columns are 0 (likely due to schema mismatch or aggregation issue in old data)
            if (row.dynamic_premi_data && (totalPremiPrunning === 0 || totalLembur === 0 || totalPremiInsentif === 0)) {
                try {
                    const dynamicData = typeof row.dynamic_premi_data === 'string'
                        ? JSON.parse(row.dynamic_premi_data)
                        : row.dynamic_premi_data;

                    if (Array.isArray(dynamicData)) {
                        for (const item of dynamicData) {
                            const header = (item.header || "").toUpperCase();
                            const val = parseFloat(item.total || 0);

                            // Backfill Pruning
                            if (totalPremiPrunning === 0 && (header.includes("PRUN") || header.includes("PRUNING")) && !header.includes("BRONDOL")) {
                                totalPremiPrunning += val;
                            }

                            // Backfill Lembur
                            if (totalLembur === 0 && (header.includes("LEMBUR") || header.includes("OVERTIME") || header.includes("OT "))) {
                                totalLembur += val;
                            }

                            // Backfill Insentif
                            if (totalPremiInsentif === 0 && (header.includes("INSENTIF") && header.includes("PANEN"))) {
                                totalPremiInsentif += val;
                            }
                        }
                    }
                } catch (e) {
                    // ignore JSON parse error
                }
            }

            // Calculate total_premi_excluding_special (exclude insentif, kinerja, prunning)
            const totalPremiExcludingSpecial = totalPremi - totalPremiInsentif - totalPremiKinerja - totalPremiPrunning;

            const upah = parseFloat(row.total_upah_bersih || 0);
            const thumbValue = thumbprintData[div] || 0;
            const selisih = thumbValue > 0 ? (upah - thumbValue) : 0;

            results.push({
                division_code: div,
                description: descriptions[div] || div,
                total_premi: totalPremi,
                total_premi_excluding_special: totalPremiExcludingSpecial,
                total_employees: parseInt(row.total_employees || 0),
                total_hk: parseFloat(row.total_hk || 0),
                total_upah_bersih: upah,
                total_pph21: parseFloat(row.total_pph21 || 0),
                total_spsi: parseFloat(row.total_spsi || 0),
                total_lembur: totalLembur,
                total_gangs: parseInt(row.total_gangs || 0),
                total_premi_brondol: parseFloat(row.total_premi_brondol || 0),
                total_premi_prunning: totalPremiPrunning,
                total_premi_insentif: totalPremiInsentif,
                total_premi_kinerja: parseFloat(row.total_premi_kinerja || 0),
                total_koreksi: parseFloat(row.total_koreksi || 0),
                total_ffb_weight: parseFloat(row.total_ffb_weight || 0),
                total_weight_tbs: parseFloat(row.total_weight_tbs || 0),
                informasi_tambahan: row.informasi_tambahan || '',
                thumb_print: thumbValue,
                total_manual: upah,
                selisih: selisih,
                is_subtotal: false,
                is_grand_total: false,
                group: div.charAt(0)
            });
        }

        // Apply PPH21 and SPSI adjustments
        const adjustedResults = await deductionAdjustmentService.applyAdjustmentsToDivisionData(month, year, results);

        return adjustedResults;
    }



    public async getAvailablePeriods(divisionCode?: string): Promise<any[]> {
        let query = "SELECT DISTINCT period_year, period_month FROM dbo.daftar_upah_aggregation_history WHERE 1=1";
        const params: any[] = [];
        if (divisionCode) {
            query += " AND division_code = ?";
            params.push(divisionCode);
        }
        query += " ORDER BY period_year DESC, period_month DESC";
        const rows = await this.extendDb.query<any>(query, params);
        return rows.map(r => ({ period_year: r.period_year, period_month: r.period_month }));
    }

    /**
     * Get the latest period available in the base PR_TASKREGLN table (ignoring ARC)
     * This defines the default period for the report.
     */
    public async getLatestBaseDataPeriod(): Promise<{ month: number, year: number } | null> {
        try {
            // Check PR_TASKREGLN for the latest TrxDate
            const rows = await this.db.query<any>(`
                SELECT TOP 1 TrxDate
                FROM PR_TASKREGLN
                ORDER BY TrxDate DESC
            `);

            if (rows && rows.length > 0 && rows[0].TrxDate) {
                const date = new Date(rows[0].TrxDate);
                // Ensure date is valid
                if (!isNaN(date.getTime())) {
                    return {
                        month: date.getMonth() + 1, // getMonth is 0-indexed
                        year: date.getFullYear()
                    };
                }
            }
            return null;
        } catch (e) {
            console.error("[SummaryService] Failed to get latest base data period:", e);
            return null;
        }
    }

    public async getDivisionsFromHrGang(): Promise<string[]> {
        return divisionDefinition.getAllDivisions();
    }

    // --- Comparison Logic ---

    private async loadNovember2025OverrideData(): Promise<any[]> {
        const data = await this.loadJsonData("november_summary_report.json");
        return data || [];
    }

    public async getAllDivisionsComparison(month: number, year: number): Promise<any> {
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;

        const currentData = await this.getAllDivisionsPremiTotals(month, year);
        let previousData: any[] = [];

        if (prevMonth === 11 && prevYear === 2025) {
            const override = await this.loadNovember2025OverrideData();
            if (override.length > 0) {
                // Map override JSON to Summary structure
                // Simplified mapping for now, assuming JSON matches what Python expected
                // In Python code: estate_division_code -> division_code
                previousData = override.map(item => ({
                    division_code: item.estate_division_code,
                    total_employees: item.workers || 0,
                    total_upah_bersih: item.total_upah_bersih || 0,
                    total_ffb_weight: 0, // Would need fetching from DB if critical, simplified to 0
                    total_premi: item.total_premi || 0,
                    total_lembur: item.total_lembur || 0,
                    total_premi_prunning: item.pruning || 0
                }));
            } else {
                previousData = await this.getAllDivisionsPremiTotals(prevMonth, prevYear);
            }
        } else {
            previousData = await this.getAllDivisionsPremiTotals(prevMonth, prevYear);
        }

        const prevLookup = new Map(previousData.map(d => [d.division_code, d]));
        const comparisonRows = [];

        for (const curr of currentData) {
            const divCode = curr.division_code;
            const prev = prevLookup.get(divCode) || {};

            const currGaji = curr.total_upah_bersih;
            const prevGaji = prev.total_upah_bersih || 0;
            const selisih = currGaji - prevGaji;
            const trend = selisih > 0 ? "NAIK" : (selisih < 0 ? "TURUN" : "TETAP");

            comparisonRows.push({
                division_code: divCode,
                description: curr.description,
                workers_previous: prev.total_employees || 0,
                workers_current: curr.total_employees,
                total_pph21_current: curr.total_pph21,
                total_spsi_current: curr.total_spsi,
                total_premi_current: curr.total_premi,
                total_prunning_current: curr.total_premi_prunning,
                total_lembur_current: curr.total_lembur,
                previous_month: {
                    gaji: prevGaji,
                    tbs_weight: prev.total_ffb_weight || 0
                },
                current_month: {
                    gaji: currGaji,
                    tbs_weight: curr.total_ffb_weight,
                    thumb_print: curr.thumb_print
                },
                selisih,
                trend
            });
        }

        // Totals
        const sumField = (rows: any[], fieldPath: string[]) => rows.reduce((acc, row) => {
            let val = row;
            for (const key of fieldPath) val = val?.[key];
            return acc + (val || 0);
        }, 0);

        const kpiSummary = {
            estate_gaji: {
                current: sumField(comparisonRows.filter(r => r.division_code !== 'MILL'), ['current_month', 'gaji']),
                previous: sumField(comparisonRows.filter(r => r.division_code !== 'MILL'), ['previous_month', 'gaji'])
            },
            mill_gaji: {
                current: sumField(comparisonRows.filter(r => r.division_code === 'MILL'), ['current_month', 'gaji']),
                previous: sumField(comparisonRows.filter(r => r.division_code === 'MILL'), ['previous_month', 'gaji'])
            },
            tbs_weight: {
                current: sumField(comparisonRows, ['current_month', 'tbs_weight']),
                previous: sumField(comparisonRows, ['previous_month', 'tbs_weight'])
            }
        };

        return {
            current_period: { month, year },
            previous_period: { month: prevMonth, year: prevYear },
            kpi_summary: kpiSummary,
            divisions: comparisonRows
        };
    }

    // --- Impact Report ---

    private async getDivisionLuasHektar(): Promise<Record<string, number>> {
        try {
            // Read from area_produktif.json file
            const areaFile = file(join(process.cwd(), "data", "area_produktif.json"));
            if (await areaFile.exists()) {
                const areaData = await areaFile.json<any[]>();
                const map: Record<string, number> = {};
                for (const item of areaData) {
                    const div = (item.divisi || '').trim();
                    if (div) {
                        map[div] = parseFloat(item.luas_hektar) || 0;
                    }
                }
                return map;
            }
        } catch (e) {
            console.error("[SummaryService] Failed to load area_produktif.json, falling back to database:", e);
        }

        // Fallback to database if file doesn't exist
        const rows = await this.extendDb.query<any>("SELECT [Divisi], [Luas_Hektar] FROM [dbo].[Divisi_Description] WHERE [Divisi] IS NOT NULL");
        const map: Record<string, number> = {};
        for (const r of rows) map[r.Divisi.trim()] = r.Luas_Hektar ? parseFloat(r.Luas_Hektar) : 0;
        return map;
    }

    private async getDynamicPremiInsentifPanen(month: number, year: number): Promise<Record<string, { insentif_panen: number }>> {
        const rows = await this.extendDb.query<any>(`
            SELECT division_code, dynamic_premi_data
            FROM dbo.daftar_upah_aggregation_history
            WHERE period_month = ? AND period_year = ? AND division_code IS NOT NULL
        `, [month, year]);

        const result: Record<string, any> = {};
        for (const row of rows) {
            const div = row.division_code?.trim();
            if (!div) continue;
            try {
                const data = typeof row.dynamic_premi_data === 'string' ? JSON.parse(row.dynamic_premi_data) : row.dynamic_premi_data;
                let total = 0;
                if (Array.isArray(data)) {
                    for (const item of data) {
                        const h = (item.header || "").toUpperCase();
                        if (h.includes('INSENTIF') && h.includes('PANEN')) total += parseFloat(item.total || 0);
                    }
                }
                if (!result[div]) result[div] = { insentif_panen: 0 };
                result[div].insentif_panen += total;
            } catch (e) { }
        }
        return result;
    }

    public async getImpactReportData(month: number, year: number): Promise<any> {
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        const upahDasar = 129220; // Default

        const currentData = await this.getAllDivisionsPremiTotals(month, year);
        // Simplified: skipping Nov 2025 JSON override logic for now to keep code concise, falling back to DB
        // Ideally should implement full logic if Nov 2025 accuracy is critical
        const previousData = await this.getAllDivisionsPremiTotals(prevMonth, prevYear);

        const luasHektar = await this.getDivisionLuasHektar();
        const curInsentif = await this.getDynamicPremiInsentifPanen(month, year);
        const prevInsentif = await this.getDynamicPremiInsentifPanen(prevMonth, prevYear);

        const prevLookup = new Map(previousData.map(d => [d.division_code, d]));
        const mainRows = [];
        const pruningRows = [];

        for (const curr of currentData) {
            const div = curr.division_code;
            const prev = prevLookup.get(div) || {} as Partial<DivisionSummary>;

            // Insentif: try from helper first (which looks deeply into dynamic), then fallback to main aggregation
            // Actually main aggregation now backfills it too, so curr.total_premi_insentif should be good.
            // But let's use the maximum to be safe.
            const dynamicInsCurr = curInsentif[div]?.insentif_panen || 0;
            const insCurr = Math.max(dynamicInsCurr, curr.total_premi_insentif || 0);

            // Previous Insentif
            const dynamicInsPrev = prevInsentif[div]?.insentif_panen || 0;
            const insPrev = Math.max(dynamicInsPrev, prev.total_premi_insentif || 0);

            mainRows.push({
                estate: curr.description,
                division_code: div,
                luas_ha: luasHektar[div] || 0,
                workers_prev: prev.total_employees || 0,
                workers_curr: curr.total_employees,
                workers_diff: curr.total_employees - (prev.total_employees || 0),
                hk_prev: prev.total_hk || 0,
                hk_curr: curr.total_hk,
                premi_prev: prev.total_premi_excluding_special || 0,
                premi_curr: curr.total_premi_excluding_special,
                lembur_prev: prev.total_lembur || 0,
                lembur_curr: curr.total_lembur,
                prunning_prev: prev.total_premi_prunning || 0,
                prunning_curr: curr.total_premi_prunning,
                insentif_prev: insPrev,
                insentif_curr: insCurr,
                gaji_prev: prev.total_upah_bersih || 0,
                gaji_curr: curr.total_upah_bersih,
                gaji_diff: curr.total_upah_bersih - (prev.total_upah_bersih || 0),
                tbs_prev: prev.total_ffb_weight || 0,
                tbs_curr: curr.total_ffb_weight,
                tbs_diff: curr.total_ffb_weight - (prev.total_ffb_weight || 0),
                pct_gaji_naik_turun: (prev.total_upah_bersih || 0) !== 0
                    ? ((curr.total_upah_bersih - (prev.total_upah_bersih || 0)) / (prev.total_upah_bersih || 0)) * 100
                    : 0,
            });

            // Populate Pruning Rows (Current Month Only)
            pruningRows.push({
                estate: curr.description,
                division_code: div,
                premi_this_month: curr.total_premi_prunning || 0,
                total: curr.total_premi_prunning || 0 // Assuming Total = Premi for now as discussed
            });
        }

        // Calculate Pruning Totals
        const pruningTotals = {
            estate: "TOTAL PRUNING",
            premi_this_month: pruningRows.reduce((a, b) => a + b.premi_this_month, 0),
            total: pruningRows.reduce((a, b) => a + b.total, 0)
        };

        // Apply Luas Area adjustments to main_table
        const adjustedMainRows = await luasAreaService.applyLuasAreaAdjustments(month, year, mainRows);

        return {
            success: true,
            current_period: { month, year },
            previous_period: { month: prevMonth, year: prevYear },
            upah_dasar: upahDasar,
            main_table: adjustedMainRows,
            pruning_table: pruningRows,
            pruning_totals: pruningTotals,
            // hk_analysis and summary_analysis are calculated in frontend (ImpactReportPage.jsx)
            // But we pass empty objects just in case
            hk_analysis: {},
            summary_analysis: {}
        };
    }

    public async getAnalysisReportData(month: number, year: number, filterType: string = 'all'): Promise<any> {
        // Get previous period
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;

        const currentData = await this.getAllDivisionsPremiTotals(month, year);
        const previousData = await this.getAllDivisionsPremiTotals(prevMonth, prevYear);

        const prevLookup = new Map(previousData.map(d => [d.division_code, d]));

        // Build premi & OT analysis table
        const premiOtRows = [];
        for (const curr of currentData) {
            const prev = prevLookup.get(curr.division_code) || {} as Partial<DivisionSummary>;

            // Apply filter
            if (filterType === 'ijl' && curr.division_code !== 'IJL') continue;
            if (filterType === 'non_ijl' && curr.division_code === 'IJL') continue;

            premiOtRows.push({
                division_code: curr.division_code,
                description: curr.description,
                prev_premi: prev.total_premi_excluding_special || 0,
                curr_premi: curr.total_premi_excluding_special,
                diff_premi: curr.total_premi_excluding_special - (prev.total_premi_excluding_special || 0),
                prev_lembur: prev.total_lembur || 0,
                curr_lembur: curr.total_lembur,
                diff_lembur: curr.total_lembur - (prev.total_lembur || 0)
            });
        }

        // Build pruning table
        const pruningRows = [];
        for (const curr of currentData) {
            const prev = prevLookup.get(curr.division_code) || {} as Partial<DivisionSummary>;
            if (filterType === 'ijl' && curr.division_code !== 'IJL') continue;
            if (filterType === 'non_ijl' && curr.division_code === 'IJL') continue;

            pruningRows.push({
                division_code: curr.division_code,
                description: curr.description,
                prev_prunning: prev.total_premi_prunning || 0,
                curr_prunning: curr.total_premi_prunning,
                diff_prunning: curr.total_premi_prunning - (prev.total_premi_prunning || 0)
            });
        }

        // Calculate totals
        const sum = (arr: any[], field: string) => arr.reduce((a, b) => a + (b[field] || 0), 0);

        return {
            success: true,
            current_period: { month, year },
            previous_period: { month: prevMonth, year: prevYear },
            filter_type: filterType,
            premi_ot_table: premiOtRows,
            pruning_table: pruningRows,
            totals: {
                total_curr_premi: sum(premiOtRows, 'curr_premi'),
                total_prev_premi: sum(premiOtRows, 'prev_premi'),
                total_curr_lembur: sum(premiOtRows, 'curr_lembur'),
                total_prev_lembur: sum(premiOtRows, 'prev_lembur'),
                total_curr_prunning: sum(pruningRows, 'curr_prunning'),
                total_prev_prunning: sum(pruningRows, 'prev_prunning')
            }
        };
    }

    /**
     * Get Mill PKS totals from VenusHR14 database
     * Used by aggregation seeder to populate history table
     */
    public async getMillTotals(month: number, year: number): Promise<any> {
        try {
            const venusDb = Database.getVenusInstance();

            const startDate = `${year}-${month.toString().padStart(2, "0")}-01`;
            const endDate = month === 12
                ? `${year + 1}-01-01`
                : `${year}-${(month + 1).toString().padStart(2, "0")}-01`;

            // Query Mill PKS data from VenusHR14
            const rows = await venusDb.query<any>(`
                SELECT
                    COUNT(DISTINCT e.EmpCode) as total_employees,
                    SUM(ISNULL(p.PayRate, 0)) as total_upah_dasar,
                    SUM(ISNULL(trl.Hours, 0)) as total_hk
                FROM HR_EMPLOYEE e
                LEFT JOIN HR_PAYROLL p ON p.EmpCode = e.EmpCode
                LEFT JOIN PR_TASKREGLN trl ON trl.EmpCode = e.EmpCode
                    AND trl.TrxDate >= ? AND trl.TrxDate < ?
                    AND trl.OT = 0
                WHERE e.LocCode = 'MILL' OR e.LocCode = 'PKS'
            `, [startDate, endDate]);

            const row = rows[0] || {};

            return {
                success: true,
                month,
                year,
                division_code: 'MILL',
                total_employees: row.total_employees || 0,
                total_upah_dasar: row.total_upah_dasar || 0,
                total_hk: row.total_hk || 0,
                source: 'VenusHR14'
            };
        } catch (e: any) {
            console.error("[SummaryService] Failed to get Mill totals:", e);
            return {
                success: false,
                error: e.message,
                month,
                year,
                division_code: 'MILL'
            };
        }
    }

    /**
     * Get division descriptions as a map (API access)
     */
    public async getDivisionDescriptionsMap(): Promise<Record<string, string>> {
        return this.getDivisionDescriptions();
    }

    /**
     * Get premi headers for a specific division (LocCode)
     */
    public async getPremiHeadersForDivision(locCode: string, month: number, year: number): Promise<string[]> {
        const startDate = `${year}-${month.toString().padStart(2, "0")}-01`;
        const endDate = month === 12
            ? `${year + 1}-01-01`
            : `${year}-${(month + 1).toString().padStart(2, "0")}-01`;

        try {
            const rows = await this.db.query<{ DocDesc: string }>(`
                SELECT DISTINCT t.DocDesc
                FROM PR_ADTRANS_ARC t
                JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
                JOIN HR_GANGLN g ON t.EmpCode = g.GangMember
                JOIN HR_GANG hg ON hg.GangCode = g.GangCode
                WHERE hg.LocCode = ?
                  AND t.DocDate >= ? AND t.DocDate < ?
                  AND UPPER(t.DocDesc) LIKE '%PREMI%'
                  AND ln.Amount > 0
                ORDER BY t.DocDesc
            `, [locCode, startDate, endDate]);

            return rows.map(r => r.DocDesc?.trim()).filter(Boolean);
        } catch (e) {
            console.error("[SummaryService] Failed to get premi headers for division:", e);
            return [];
        }
    }

    public async getDivisionSummary(divisionCode?: string, month?: number, year?: number) {
        let query = `
            SELECT
                id, period_month, period_year, division_code, gang_code,
                gang_description, total_employees, total_hk, total_hari_kerja,
                total_cuti_tahunan, total_cuti_sakit, total_cuti_minggu,
                total_cuti_nasional, total_upah_dasar, total_upah_pokok,
                total_gaji_pokok, total_beras, total_jabatan, total_masa_kerja,
                total_lembur, total_tunjangan, total_premi_brondol,
                total_premi_prunning, total_premi_insentif, total_premi_kinerja,
                total_premi, dynamic_premi_data, informasi_tambahan,
                total_koreksi, total_potongan, total_pph21,
                total_bpjs_pekerja, total_bpjs_majikan, total_spsi,
                total_upah_kotor, total_upah_bersih, total_ffb_weight, total_weight_tbs,
                created_at, updated_at, source_endpoint
            FROM dbo.daftar_upah_aggregation_history
            WHERE 1=1
        `;

        const params: any[] = [];

        if (divisionCode) {
            const gangs = await divisionDefinition.getGangsForDivision(divisionCode);
            // Simplified logic: filter by division_code
            query += ` AND division_code = ?`;
            params.push(divisionCode);
        }

        if (month) {
            query += ` AND period_month = ?`;
            params.push(month);
        }

        if (year) {
            query += ` AND period_year = ?`;
            params.push(year);
        }

        query += " ORDER BY division_code, gang_code";

        const rows = await this.extendDb.query<any>(query, params);

        // Patterns to EXCLUDE from dynamic premi headers display
        const excludePatterns = ['prun', 'pruning', 'prunning', 'insentif_panen', 'insentif panen', 'tiket', 'koreksi', 'panen', 'kinerja', 'insentif'];

        // Helper function to check if header should be excluded
        const shouldExcludeHeader = (header: string): boolean => {
            const headerLower = header.toLowerCase();
            return excludePatterns.some(pattern => headerLower.includes(pattern));
        };

        // Helper function to get dynamic premi value from a row
        const getDynamicPremiValue = (row: any, headerName: string): number => {
            if (!row._dynamic_premi_list || !Array.isArray(row._dynamic_premi_list)) return 0;
            const item = row._dynamic_premi_list.find(
                (p: any) => p.header && p.header.toLowerCase() === headerName.toLowerCase()
            );
            return item ? parseFloat(item.total || 0) : 0;
        };

        const results = rows.map(row => {
            let dynamicPremi: any[] = [];
            let backfill = {
                insentif: 0,
                kinerja: 0,
                prunning: 0,
                koreksi: 0
            };

            try {
                if (row.dynamic_premi_data) {
                    dynamicPremi = typeof row.dynamic_premi_data === 'string'
                        ? JSON.parse(row.dynamic_premi_data)
                        : row.dynamic_premi_data;

                    // Backfill logic for old data
                    if (Array.isArray(dynamicPremi)) {
                        for (const item of dynamicPremi) {
                            const val = parseFloat(item.total || 0);
                            const header = (item.header || "").toUpperCase().replace(/ /g, '_');

                            if (header.includes("INSENTIF") || header.includes("PANEN")) backfill.insentif += val;
                            if (header.includes("KINERJA")) backfill.kinerja += val;
                            if ((header.includes("PRUN") || header.includes("PRUNING")) && !header.includes("BRONDOL")) backfill.prunning += val;
                            if (header.includes("KOREKSI") && !header.includes("KOREKSI_HK")) backfill.koreksi += val;
                        }
                    }
                }
            } catch (e) { }

            // Use DB value if present (new data), else use backfilled (old data)
            // Actually, for consistency, if DB is 0 and backfill > 0, use backfill.
            const t_insentif = parseFloat(row.total_premi_insentif || 0) || backfill.insentif;
            const t_kinerja = parseFloat(row.total_premi_kinerja || 0) || backfill.kinerja;
            const t_prunning = parseFloat(row.total_premi_prunning || 0) || backfill.prunning;
            const t_koreksi = parseFloat(row.total_koreksi || 0) || backfill.koreksi;

            const rowTotalPremi = parseFloat(row.total_premi || 0);
            const totalPremiExcludingSpecial = rowTotalPremi - t_insentif - t_kinerja - t_prunning;

            return {
                ...row,
                total_premi: rowTotalPremi,
                total_premi_excluding_special: totalPremiExcludingSpecial,
                total_premi_insentif: t_insentif,
                total_premi_kinerja: t_kinerja,
                total_premi_prunning: t_prunning,
                total_koreksi: t_koreksi,
                _dynamic_premi_list: dynamicPremi
            };
        });

        // Collect all unique headers for frontend (excluding the ones we separated)
        const allHeaders = new Set<string>();
        const filteredHeaders = new Set<string>();

        results.forEach(row => {
            if (Array.isArray(row._dynamic_premi_list)) {
                row._dynamic_premi_list.forEach((item: any) => {
                    const header = item.header;
                    if (header) {
                        allHeaders.add(header);
                        // Only add to filtered headers if not excluded
                        if (!shouldExcludeHeader(header)) {
                            filteredHeaders.add(header);
                        }
                    }
                });
            }
        });

        const headerList = Array.from(allHeaders).sort();
        const filteredHeaderList = Array.from(filteredHeaders).sort();

        // Attach headers to first row (convention used by frontend)
        if (results.length > 0) {
            results[0]._premi_headers = headerList;
            results[0]._premi_headers_filtered = filteredHeaderList;
        }

        // Calculate Grand Total
        const grandTotal = results.reduce((acc, row) => {
            const rowTotalPremi = Number(row.total_premi) || 0;
            const rowTotalPremiInsentif = Number(row.total_premi_insentif) || 0;
            const rowTotalPremiKinerja = Number(row.total_premi_kinerja) || 0;
            const rowTotalPremiPrunning = Number(row.total_premi_prunning) || 0;
            const rowTotalPremiExcludingSpecial = rowTotalPremi - rowTotalPremiInsentif - rowTotalPremiKinerja - rowTotalPremiPrunning;

            return {
                total_employees: acc.total_employees + (Number(row.total_employees) || 0),
                total_hk: acc.total_hk + (Number(row.total_hk) || 0),
                total_lembur: acc.total_lembur + (Number(row.total_lembur) || 0),
                total_pph21: acc.total_pph21 + (Number(row.total_pph21) || 0),
                total_spsi: acc.total_spsi + (Number(row.total_spsi) || 0),
                total_upah_bersih: acc.total_upah_bersih + (Number(row.total_upah_bersih) || 0),
                total_premi: acc.total_premi + rowTotalPremi,
                total_premi_excluding_special: acc.total_premi_excluding_special + rowTotalPremiExcludingSpecial,
                total_premi_insentif: acc.total_premi_insentif + rowTotalPremiInsentif,
                total_premi_kinerja: acc.total_premi_kinerja + rowTotalPremiKinerja,
                total_premi_prunning: acc.total_premi_prunning + rowTotalPremiPrunning,
                total_koreksi: acc.total_koreksi + (Number(row.total_koreksi) || 0),
                // Calculate totals for each filtered dynamic premi header
                dynamic_premi_totals: filteredHeaderList.reduce((dynAcc, header) => {
                    dynAcc[header] = (dynAcc[header] || 0) + getDynamicPremiValue(row, header);
                    return dynAcc;
                }, {} as Record<string, number>)
            };
        }, {
            total_employees: 0,
            total_hk: 0,
            total_lembur: 0,
            total_pph21: 0,
            total_spsi: 0,
            total_upah_bersih: 0,
            total_premi: 0,
            total_premi_excluding_special: 0,
            total_premi_insentif: 0,
            total_premi_kinerja: 0,
            total_premi_prunning: 0,
            total_koreksi: 0,
            dynamic_premi_totals: {} as Record<string, number>
        });

        return {
            data: results,
            grand_total: grandTotal,
            filtered_headers: filteredHeaderList
        };
    }

    /**
     * Get all gang descriptions (real-time from HR_GANG in db_ptrj)
     * Returns a map: gang_code -> description
     */
    public async getAllGangDescriptions(): Promise<Record<string, string>> {
        try {
            // Fetch from HR_GANG in db_ptrj (main database)
            const gangRows = await this.db.query<{ GangCode: string; Description: string | null }>(`
                SELECT RTRIM(GangCode) as GangCode, Description
                FROM dbo.HR_GANG
                WHERE GangCode IS NOT NULL
            `);

            // Build result map: gang_code -> description
            const result: Record<string, string> = {};
            for (const row of gangRows) {
                const gangCode = row.GangCode?.trim() || "";
                const gangDesc = row.Description?.trim() || "";

                // Use description if available, otherwise use gang code as fallback
                result[gangCode] = gangDesc || gangCode;
            }

            return result;
        } catch (error: any) {
            console.error("[SummaryService] Failed to get gang descriptions:", error);
            return {};
        }
    }


    public async updateThumbprint(month: number, year: number, divisionCode: string, value: number): Promise<boolean> {
        return await thumbprintService.updateThumbprintValue(month, year, divisionCode, value);
    }
}

export const summaryService = SummaryService.getInstance();