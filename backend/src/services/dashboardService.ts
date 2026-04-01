import { Database } from "../db/client";
import { DataExtractorService, dataExtractorService } from "./dataExtractorService";
import { Config } from "../config";
import { gangService } from "./gangService";
import { divisionDefinition } from "./divisionDefinition";

/**
 * IMPORTANT: Data Append-Only Pattern (Immutable History)
 *
 * Semua query ke daftar_upah_aggregation_history HARUS menggunakan subquery
 * untuk mendapatkan data VERSI TERBARU saja (version_index tertinggi).
 *
 * Pattern: WHERE h.version_index = (SELECT MAX(h2.version_index) FROM ... h2 WHERE h2.gang_code = h.gang_code ...)
 *
 * Lihat helper method `getLatestVersionCte()` untuk penggunaan yang lebih bersih.
 */

export class DashboardService {
    private static instance: DashboardService;
    private db: Database;
    private extendDb: Database;

    private constructor() {
        this.db = Database.getInstance(undefined, Config.DB_PROFILE);
        this.extendDb = Database.getInstance("extend_db_ptrj", Config.DB_EXTEND_PROFILE);
    }

    public static getInstance(): DashboardService {
        if (!DashboardService.instance) {
            DashboardService.instance = new DashboardService();
        }
        return DashboardService.instance;
    }

    /**
     * Helper: Returns a CTE prefix for selecting only LATEST version records
     * from daftar_upah_aggregation_history.
     *
     * IMPORTANT: Always use this to get the latest seeding data.
     * Without this, queries will SUM/COUNT all versions, producing incorrect results.
     *
     * Usage: Append this CTE before your FROM clause.
     * The alias for the main table should be `h`.
     *
     * Example:
     *   WITH latest AS (${this.getLatestVersionCte()})
     *   SELECT ... FROM latest l JOIN dbo.daftar_upah_aggregation_history h ON ...
     *   WHERE l.gang_code = h.gang_code AND l.period_month = h.period_month ...
     */
    private getLatestVersionCte(): string {
        return `
            SELECT gang_code, period_month, period_year, MAX(version_index) as max_ver
            FROM dbo.daftar_upah_aggregation_history
            GROUP BY gang_code, period_month, period_year
        `;
    }

    /**
     * Helper: Returns the WHERE clause fragment for LATEST VERSION filtering.
     * Use this when you can't use a CTE (e.g., simple queries).
     *
     * Usage in WHERE:
     *   AND h.version_index = (
     *       SELECT MAX(h2.version_index)
     *       FROM dbo.daftar_upah_aggregation_history h2
     *       WHERE h2.gang_code = h.gang_code
     *         AND h2.period_month = h.period_month
     *         AND h2.period_year = h.period_year
     *   )
     *
     * Prerequisite: The table alias must be `h`.
     */
    private getLatestVersionWhere(): string {
        return `
            AND h.version_index = (
                SELECT MAX(h2.version_index)
                FROM dbo.daftar_upah_aggregation_history h2
                WHERE h2.gang_code = h.gang_code
                  AND h2.period_month = h.period_month
                  AND h2.period_year = h.period_year
            )
        `;
    }

    /**
     * Get 12-month trend for Wages, OT, Premi
     */
    public async getPayrollTrend(endMonth: number, endYear: number): Promise<any[]> {
        // Calculate start period (12 months ago)
        let startMonth = endMonth + 1;
        let startYear = endYear - 1;
        if (startMonth > 12) {
            startMonth = 1;
            startYear = endYear;
        }

        // Use CTE to get latest version per gang-period, then aggregate
        const query = `
            WITH latest AS (
                SELECT gang_code, period_month, period_year, MAX(version_index) as max_ver
                FROM dbo.daftar_upah_aggregation_history
                GROUP BY gang_code, period_month, period_year
            )
            SELECT
                h.period_year,
                h.period_month,
                SUM(ISNULL(h.total_upah_bersih, 0)) as total_wage,
                SUM(ISNULL(h.total_lembur, 0)) as total_ot,
                SUM(ISNULL(h.total_premi, 0)) as total_premi,
                SUM(ISNULL(h.total_employees, 0)) as total_headcount,
                SUM(ISNULL(h.total_hk, 0)) as total_hk
            FROM latest l
            JOIN dbo.daftar_upah_aggregation_history h
                ON l.gang_code = h.gang_code
                AND l.period_month = h.period_month
                AND l.period_year = h.period_year
                AND l.max_ver = h.version_index
            WHERE
                (h.period_year > ? OR (h.period_year = ? AND h.period_month >= ?))
                AND (h.period_year < ? OR (h.period_year = ? AND h.period_month <= ?))
            GROUP BY h.period_year, h.period_month
            ORDER BY h.period_year, h.period_month
        `;

        // Logic check:
        // If end is 2025-05. Start is 2024-06.
        // WHERE (year > 2024 OR (year = 2024 AND month >= 6)) ...

        try {
            const rows = await this.extendDb.query<any>(query, [
                startYear, startYear, startMonth,
                endYear, endYear, endMonth
            ]);

            // Map keys to be friendly
            return rows.map(r => ({
                period: `${this.getMonthName(r.period_month)} ${r.period_year}`,
                month: r.period_month,
                year: r.period_year,
                total_wage: r.total_wage,
                total_ot: r.total_ot,
                total_premi: r.total_premi,
                total_headcount: r.total_headcount,
                total_hk: r.total_hk
            }));
        } catch (e) {
            console.error("[DashboardService] Error getting trend:", e);
            throw e;
        }
    }

    /**
     * Get current month division breakdown
     */
    public async getDivisionBreakdown(month: number, year: number): Promise<any[]> {
        // LATEST VERSION ONLY via CTE
        const query = `
            WITH latest AS (
                SELECT gang_code, period_month, period_year, MAX(version_index) as max_ver
                FROM dbo.daftar_upah_aggregation_history
                GROUP BY gang_code, period_month, period_year
            )
            SELECT
                h.division_code,
                SUM(ISNULL(h.total_upah_bersih, 0)) as total_wage,
                SUM(ISNULL(h.total_lembur, 0)) as total_ot,
                SUM(ISNULL(h.total_premi, 0)) as total_premi,
                SUM(ISNULL(h.total_employees, 0)) as headcount
            FROM latest l
            JOIN dbo.daftar_upah_aggregation_history h
                ON l.gang_code = h.gang_code
                AND l.period_month = h.period_month
                AND l.period_year = h.period_year
                AND l.max_ver = h.version_index
            WHERE h.period_month = ? AND h.period_year = ?
            GROUP BY h.division_code
            ORDER BY total_wage DESC
        `;
        const rows = await this.extendDb.query<any>(query, [month, year]);
        return rows;
    }

    /**
     * Get Top Gangs by Cost
     */
    public async getGangBreakdown(month: number, year: number, limit: number = 15): Promise<any[]> {
        // LATEST VERSION ONLY via CTE
        const query = `
            WITH latest AS (
                SELECT gang_code, period_month, period_year, MAX(version_index) as max_ver
                FROM dbo.daftar_upah_aggregation_history
                GROUP BY gang_code, period_month, period_year
            )
            SELECT TOP ${limit}
                h.gang_code,
                SUM(ISNULL(h.total_upah_bersih, 0)) as total_wage,
                SUM(ISNULL(h.total_lembur, 0)) as total_ot,
                SUM(ISNULL(h.total_employees, 0)) as headcount
            FROM latest l
            JOIN dbo.daftar_upah_aggregation_history h
                ON l.gang_code = h.gang_code
                AND l.period_month = h.period_month
                AND l.period_year = h.period_year
                AND l.max_ver = h.version_index
            WHERE h.period_month = ? AND h.period_year = ?
            GROUP BY h.gang_code
            ORDER BY total_wage DESC
        `;
        return await this.extendDb.query<any>(query, [month, year]);
    }

    /**
     * Get Division Efficiency (Cost vs Headcount/WorkDays)
     */
    public async getDivisionEfficiency(month: number, year: number): Promise<any[]> {
        // LATEST VERSION ONLY via CTE
        const query = `
            WITH latest AS (
                SELECT gang_code, period_month, period_year, MAX(version_index) as max_ver
                FROM dbo.daftar_upah_aggregation_history
                GROUP BY gang_code, period_month, period_year
            )
            SELECT
                h.division_code,
                SUM(ISNULL(h.total_upah_bersih, 0)) as total_cost,
                SUM(ISNULL(h.total_employees, 0)) as headcount,
                SUM(ISNULL(h.total_hk, 0)) as total_man_days
            FROM latest l
            JOIN dbo.daftar_upah_aggregation_history h
                ON l.gang_code = h.gang_code
                AND l.period_month = h.period_month
                AND l.period_year = h.period_year
                AND l.max_ver = h.version_index
            WHERE h.period_month = ? AND h.period_year = ?
            GROUP BY h.division_code
            HAVING SUM(ISNULL(h.total_employees, 0)) > 0
            ORDER BY total_cost DESC
        `;
        return await this.extendDb.query<any>(query, [month, year]);
    }

    /**
     * Get 12-Month/Period Productivity Trend (Cost per HK)
     */
    public async getProductivityTrend(endMonth: number, endYear: number): Promise<any[]> {
        const { startMonth, startYear } = this.getStartPeriod(endMonth, endYear);
        // LATEST VERSION ONLY via CTE
        const query = `
            WITH latest AS (
                SELECT gang_code, period_month, period_year, MAX(version_index) as max_ver
                FROM dbo.daftar_upah_aggregation_history
                GROUP BY gang_code, period_month, period_year
            )
            SELECT
                h.period_month,
                h.period_year,
                SUM(ISNULL(h.total_upah_bersih, 0)) as total_wage,
                SUM(ISNULL(h.total_hk, 0)) as total_hk
            FROM latest l
            JOIN dbo.daftar_upah_aggregation_history h
                ON l.gang_code = h.gang_code
                AND l.period_month = h.period_month
                AND l.period_year = h.period_year
                AND l.max_ver = h.version_index
            WHERE
                (h.period_year > ? OR (h.period_year = ? AND h.period_month >= ?))
                AND (h.period_year < ? OR (h.period_year = ? AND h.period_month <= ?))
            GROUP BY h.period_year, h.period_month
            ORDER BY h.period_year, h.period_month
        `;

        const rows = await this.extendDb.query<any>(query, [startYear, startYear, startMonth, endYear, endYear, endMonth]);

        return rows.map(r => ({
            period: `${this.getMonthName(r.period_month)} ${r.period_year}`,
            costPerHk: r.total_hk > 0 ? r.total_wage / r.total_hk : 0,
            totalHk: r.total_hk
        }));
    }

    /**
     * Get Gang Wage Spikes (Anomaly Detection)
     * Compares Current Month vs Previous Month for Top 5 Gangs with highest Cost/HK increase
     */
    public async getWageSpikes(month: number, year: number): Promise<any[]> {
        // LATEST VERSION ONLY via CTE
        const query = `
            WITH latest AS (
                SELECT gang_code, period_month, period_year, MAX(version_index) as max_ver
                FROM dbo.daftar_upah_aggregation_history
                GROUP BY gang_code, period_month, period_year
            )
            SELECT
                h.gang_code,
                SUM(ISNULL(h.total_upah_bersih, 0)) as total_wage,
                SUM(ISNULL(h.total_hk, 0)) as total_hk
            FROM latest l
            JOIN dbo.daftar_upah_aggregation_history h
                ON l.gang_code = h.gang_code
                AND l.period_month = h.period_month
                AND l.period_year = h.period_year
                AND l.max_ver = h.version_index
            WHERE h.period_month = ? AND h.period_year = ?
            GROUP BY h.gang_code
        `;

        let prevMonth = month - 1;
        let prevYear = year;
        if (prevMonth === 0) {
            prevMonth = 12;
            prevYear = year - 1;
        }

        const [currentRows, prevRows] = await Promise.all([
            this.extendDb.query<any>(query, [month, year]),
            this.extendDb.query<any>(query, [prevMonth, prevYear])
        ]);

        const prevMap = new Map<string, { wage: number, hk: number }>();
        prevRows.forEach(r => {
            prevMap.set(r.gang_code, { wage: r.total_wage, hk: r.total_hk });
        });

        const anomalies: any[] = [];

        currentRows.forEach(curr => {
            if (curr.total_hk > 0) {
                const currCostPerHk = curr.total_wage / curr.total_hk;
                const prev = prevMap.get(curr.gang_code);

                if (prev && prev.hk > 0) {
                    const prevCostPerHk = prev.wage / prev.hk;

                    if (prevCostPerHk > 10000) { // Ignore artifacts with tiny cost
                        const diff = currCostPerHk - prevCostPerHk;
                        const pct = (diff / prevCostPerHk) * 100;

                        // Threshold: > 15% increase and significant absolute diff
                        if (pct > 15 && diff > 5000) {
                            anomalies.push({
                                id: curr.gang_code,
                                name: curr.gang_code, // Gang name might be same as code or we fetch description if needed. For now Code is fine.
                                currentWage: currCostPerHk, // Showing Cost/HK
                                previousWage: prevCostPerHk,
                                percentage: pct,
                                difference: diff,
                                gang: 'Cost/HK Spike'
                            });
                        }
                    }
                }
            }
        });

        // Sort by Percentage Descending
        return anomalies.sort((a, b) => b.percentage - a.percentage).slice(0, 5);
    }

    private getMonthName(m: number): string {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return months[m - 1] || "";
    }

    private getStartPeriod(endMonth: number, endYear: number): { startMonth: number, startYear: number } {
        let startMonth = endMonth - 11;
        let startYear = endYear;

        if (startMonth <= 0) {
            startMonth += 12;
            startYear -= 1;
        }

        return { startMonth, startYear };
    }

    /**
     * Classify gang by last letter
     * H = Harvesting (Panen)
     * T = Transport
     * M = Maintenance
     * 
     * Update: IJL gangs start with 'L'. 
     * If starts with 'L', we might classify it differently or just mark it as is_ijl.
     */
    private classifyGangType(gangCode: string): string {
        if (!gangCode || gangCode.length === 0) return 'uncategorized';

        const lastLetter = gangCode.slice(-1).toUpperCase();

        switch (lastLetter) {
            case 'H':
                return 'harvesting';
            case 'T':
                return 'transport';
            case 'M':
                return 'maintenance';
            default:
                // If starts with 'L', it might be harvesting/maintenance but uncategorized by suffix.
                // For now, return 'uncategorized' unless we have more rules.
                return 'uncategorized';
        }
    }

    /**
     * Check if gang is IJL (Starts with 'L')
     */
    private isIJL(gangCode: string): boolean {
        return gangCode?.toUpperCase().startsWith('L') || false;
    }

    /**
     * Get Cost per HK Comparison Report
     * Groups data by gang type (Harvesting/Transport/Maintenance)
     * Supports division filter (IJL/non-IJL)
     */
    public async getCostHKComparison(
        month: number,
        year: number,
        divisionFilter: string = 'ALL',
        gangCodes?: string[],
        gangTypeFilter?: string
    ): Promise<any> {
        try {
            // Build query with filters
            let whereConditions = ['period_month = ?', 'period_year = ?'];
            const params: any[] = [month, year];

            // Division filter - IJL gangs start with 'L'
            if (divisionFilter === 'IJL') {
                whereConditions.push("gang_code LIKE 'L%'");
            } else if (divisionFilter === 'NON_IJL') {
                whereConditions.push("gang_code NOT LIKE 'L%'");
            }

            // Gang Update: "Gang Panen" filter (requested as 'L' prefix or 'H' suffix?)
            // If gangTypeFilter is 'harvesting', we usually check suffix 'H'.
            // If user wants specific "Panen (L)" filter, we can handle it here or in frontend.
            // For now, let's strictly follow the suffix for Type, and Prefix for IJL/Div.

            // Gang Codes Filter
            if (gangCodes && gangCodes.length > 0) {
                const gangPlaceholders = gangCodes.map(() => '?').join(',');
                whereConditions.push(`gang_code IN (${gangPlaceholders})`);
                params.push(...gangCodes);
            }

            const whereClause = whereConditions.join(' AND ');

            // Query for gang-level data with description from HR_GANG
            // LATEST VERSION ONLY: Join with CTE to get only the latest version per gang-period
            const query = `
                WITH latest AS (
                    SELECT gang_code, period_month, period_year, MAX(version_index) as max_ver
                    FROM dbo.daftar_upah_aggregation_history
                    GROUP BY gang_code, period_month, period_year
                )
                SELECT
                    agg.gang_code,
                    agg.division_code,
                    g.Description as gang_description,
                    SUM(ISNULL(agg.total_upah_bersih, 0)) as total_cost,
                    SUM(ISNULL(agg.total_hk, 0)) as total_hk,
                    SUM(ISNULL(agg.total_employees, 0)) as headcount
                FROM latest l
                JOIN dbo.daftar_upah_aggregation_history agg
                    ON l.gang_code = agg.gang_code
                    AND l.period_month = agg.period_month
                    AND l.period_year = agg.period_year
                    AND l.max_ver = agg.version_index
                LEFT JOIN db_ptrj.dbo.HR_GANG g ON RTRIM(agg.gang_code) = RTRIM(g.GangCode)
                WHERE ${whereClause}
                GROUP BY agg.gang_code, agg.division_code, g.Description
                ORDER BY agg.division_code, agg.gang_code
            `;

            const rows = await this.extendDb.query<any>(query, params);

            // Classify gangs and calculate Cost/HK
            let gangDetails = rows.map(row => {
                const costPerHK = row.total_hk > 0 ? row.total_cost / row.total_hk : 0;
                return {
                    gang_code: row.gang_code,
                    division_code: row.division_code,
                    gang_description: row.gang_description || '-',
                    gang_type: this.classifyGangType(row.gang_code),
                    is_ijl: this.isIJL(row.gang_code),
                    total_cost: row.total_cost,
                    total_hk: row.total_hk,
                    cost_per_hk: Math.round(costPerHK),
                    headcount: row.headcount
                };
            });

            // Filter by gang type if specified
            if (gangTypeFilter && gangTypeFilter !== 'ALL') {
                gangDetails = gangDetails.filter(g => g.gang_type === gangTypeFilter);
            }

            // Group by gang type for summary
            const summaryByType: Record<string, any> = {
                harvesting: { total_cost: 0, total_hk: 0, count: 0 },
                transport: { total_cost: 0, total_hk: 0, count: 0 },
                maintenance: { total_cost: 0, total_hk: 0, count: 0 },
                uncategorized: { total_cost: 0, total_hk: 0, count: 0 }
            };

            let grandTotalCost = 0;
            let grandTotalHK = 0;

            gangDetails.forEach(gang => {
                if (summaryByType[gang.gang_type]) {
                    summaryByType[gang.gang_type].total_cost += gang.total_cost;
                    summaryByType[gang.gang_type].total_hk += gang.total_hk;
                    summaryByType[gang.gang_type].count += 1;
                }
                grandTotalCost += gang.total_cost;
                grandTotalHK += gang.total_hk;
            });

            // Calculate cost per HK for each type
            const summary: Record<string, any> = {};
            Object.keys(summaryByType).forEach(type => {
                const data = summaryByType[type];
                summary[type] = {
                    ...data,
                    cost_per_hk: data.total_hk > 0 ? Math.round(data.total_cost / data.total_hk) : 0
                };
            });

            return {
                success: true,
                period: `${this.getMonthName(month)} ${year}`,
                division_filter: divisionFilter,
                summary,
                gang_details: gangDetails.sort((a, b) => a.gang_code.localeCompare(b.gang_code)), // Sort alphabetically by code
                grand_total: {
                    total_cost: grandTotalCost,
                    total_hk: grandTotalHK,
                    cost_per_hk: grandTotalHK > 0 ? Math.round(grandTotalCost / grandTotalHK) : 0
                }
            };
        } catch (e: any) {
            console.error("[DashboardService] Error getting cost/HK comparison:", e);
            throw e;
        }
    }

    /**
     * Get available gangs for filter dropdown
     */
    public async getAvailableGangs(month: number, year: number): Promise<any[]> {
        try {
            // LATEST VERSION ONLY: Only show gangs from the latest seeding version
            const query = `
                WITH latest AS (
                    SELECT gang_code, period_month, period_year, MAX(version_index) as max_ver
                    FROM dbo.daftar_upah_aggregation_history
                    GROUP BY gang_code, period_month, period_year
                )
                SELECT DISTINCT
                    agg.gang_code,
                    agg.division_code,
                    g.Description as gang_description
                FROM latest l
                JOIN dbo.daftar_upah_aggregation_history agg
                    ON l.gang_code = agg.gang_code
                    AND l.period_month = agg.period_month
                    AND l.period_year = agg.period_year
                    AND l.max_ver = agg.version_index
                LEFT JOIN db_ptrj.dbo.HR_GANG g ON RTRIM(agg.gang_code) = RTRIM(g.GangCode)
                WHERE agg.period_month = ? AND agg.period_year = ?
                AND agg.gang_code IS NOT NULL
                AND agg.gang_code != ''
                ORDER BY agg.gang_code
            `;

            const rows = await this.extendDb.query<any>(query, [month, year]);

            return rows.map(row => ({
                gang_code: row.gang_code,
                division_code: row.division_code,
                gang_description: row.gang_description || '-',
                gang_type: this.classifyGangType(row.gang_code),
                is_ijl: this.isIJL(row.gang_code)
            }));
        } catch (e: any) {
            console.error("[DashboardService] Error getting available gangs:", e);
            throw e;
        }
    }

    /**
     * Get Latest Available Data Period
     */
    public async getLatestPeriod(): Promise<{ month: number, year: number }> {
        const query = `
            SELECT TOP 1 period_month, period_year 
            FROM dbo.daftar_upah_aggregation_history 
            ORDER BY period_year DESC, period_month DESC
        `;
        const result = await this.extendDb.query<any>(query);
        if (result.length > 0) {
            return { month: result[0].period_month, year: result[0].period_year };
        }
        return { month: new Date().getMonth() + 1, year: new Date().getFullYear() };
    }

    /**
     * Get All Available Data Periods
     */
    public async getAvailablePeriods(): Promise<{ month: number, year: number }[]> {
        const query = `
            SELECT DISTINCT period_month, period_year 
            FROM dbo.daftar_upah_aggregation_history 
            ORDER BY period_year DESC, period_month DESC
        `;
        const result = await this.extendDb.query<any>(query);
        return result.map(r => ({ month: r.period_month, year: r.period_year }));
    }

    /**
     * Get Filter Options (Divisions and Gangs)
     */
    public async getFilterOptions(month: number, year: number): Promise<{ divisions: string[], gangs: string[] }> {
        // LATEST VERSION ONLY
        const divQuery = `
            WITH latest AS (
                SELECT gang_code, period_month, period_year, MAX(version_index) as max_ver
                FROM dbo.daftar_upah_aggregation_history
                GROUP BY gang_code, period_month, period_year
            )
            SELECT DISTINCT h.division_code
            FROM latest l
            JOIN dbo.daftar_upah_aggregation_history h
                ON l.gang_code = h.gang_code
                AND l.period_month = h.period_month
                AND l.period_year = h.period_year
                AND l.max_ver = h.version_index
            WHERE h.period_month = ? AND h.period_year = ?
            ORDER BY h.division_code
        `;

        const gangQuery = `
            WITH latest AS (
                SELECT gang_code, period_month, period_year, MAX(version_index) as max_ver
                FROM dbo.daftar_upah_aggregation_history
                GROUP BY gang_code, period_month, period_year
            )
            SELECT DISTINCT h.gang_code
            FROM latest l
            JOIN dbo.daftar_upah_aggregation_history h
                ON l.gang_code = h.gang_code
                AND l.period_month = h.period_month
                AND l.period_year = h.period_year
                AND l.max_ver = h.version_index
            WHERE h.period_month = ? AND h.period_year = ?
            ORDER BY h.gang_code
        `;

        const [divs, gangs] = await Promise.all([
            this.extendDb.query<any>(divQuery, [month, year]),
            this.extendDb.query<any>(gangQuery, [month, year])
        ]);

        return {
            divisions: divs.map(d => d.division_code),
            gangs: gangs.map(g => g.gang_code)
        };
    }

    /**
     * Get Comparison Data for selected entities
     */
    public async getComparisonData(type: 'division' | 'gang', codes: string[], month: number, year: number): Promise<any[]> {
        if (!codes || codes.length === 0) return [];

        const column = type === 'division' ? 'division_code' : 'gang_code';

        // Dynamic IN clause placeholder using ?
        const placeholders = codes.map(() => '?').join(',');

        // LATEST VERSION ONLY
        const query = `
            WITH latest AS (
                SELECT gang_code, period_month, period_year, MAX(version_index) as max_ver
                FROM dbo.daftar_upah_aggregation_history
                GROUP BY gang_code, period_month, period_year
            )
            SELECT
                h.${column} as name,
                SUM(ISNULL(h.total_upah_bersih, 0)) as total_wage,
                SUM(ISNULL(h.total_lembur, 0)) as total_ot,
                SUM(ISNULL(h.total_hk, 0)) as total_hk,
                SUM(ISNULL(h.total_employees, 0)) as headcount
            FROM latest l
            JOIN dbo.daftar_upah_aggregation_history h
                ON l.gang_code = h.gang_code
                AND l.period_month = h.period_month
                AND l.period_year = h.period_year
                AND l.max_ver = h.version_index
            WHERE h.period_month = ?
              AND h.period_year = ?
              AND h.${column} IN (${placeholders})
            GROUP BY h.${column}
        `;

        const params = [month, year, ...codes];
        const rows = await this.extendDb.query<any>(query, params);

        return rows.map(r => ({
            name: r.name,
            total_wage: r.total_wage,
            total_ot: r.total_ot,
            total_hk: r.total_hk,
            cost_per_hk: r.total_hk > 0 ? r.total_wage / r.total_hk : 0,
            headcount: r.headcount
        }));
    }

    /**
     * Get Aggregated Gang Data for Comprehensive Analysis
     * Used for KPI cards to ensure consistency with Executive Dashboard
     */
    public async getAggregatedGangData(divisionCode: string, month: number, year: number): Promise<any[]> {
        // LATEST VERSION ONLY
        const query = `
            WITH latest AS (
                SELECT gang_code, period_month, period_year, MAX(version_index) as max_ver
                FROM dbo.daftar_upah_aggregation_history
                GROUP BY gang_code, period_month, period_year
            )
            SELECT
                agg.gang_code,
                RTRIM(g.Description) as gang_description,
                SUM(ISNULL(agg.total_upah_bersih, 0)) as total_wage,
                SUM(ISNULL(agg.total_lembur, 0)) as total_ot,
                SUM(ISNULL(agg.total_premi, 0)) as total_premi,
                SUM(ISNULL(agg.total_hk, 0)) as total_hk,
                SUM(ISNULL(agg.total_employees, 0)) as headcount
            FROM latest l
            JOIN dbo.daftar_upah_aggregation_history agg
                ON l.gang_code = agg.gang_code
                AND l.period_month = agg.period_month
                AND l.period_year = agg.period_year
                AND l.max_ver = agg.version_index
            LEFT JOIN db_ptrj.dbo.HR_GANG g ON RTRIM(agg.gang_code) = RTRIM(g.GangCode)
            WHERE agg.period_month = ? AND agg.period_year = ?
            ${divisionCode && divisionCode !== 'ALL' ? `AND agg.division_code IN (${gangService.getAllDivisionAliases(divisionCode).map(() => '?').join(',')})` : ''}
            GROUP BY agg.gang_code, g.Description
            ORDER BY agg.gang_code
        `;

        const params: (string | number)[] = [month, year];
        if (divisionCode && divisionCode !== 'ALL') {
            params.push(...gangService.getAllDivisionAliases(divisionCode));
        }

        const rows = await this.extendDb.query<any>(query, params);
        return rows.map(r => ({
            gang_code: r.gang_code,
            description: r.gang_description || r.gang_code,
            total_wage: r.total_wage,
            total_ot: r.total_ot,
            total_premi: r.total_premi,
            total_hk: r.total_hk,
            total_employees: r.headcount
        }));
    }

    /**
     * Get Premi Analysis (Breakdown by Type) - Including Dynamic Premi from JSON
     */
    public async getPremiAnalysis(month: number, year: number, divisionCode?: string): Promise<any[]> {
        // LATEST VERSION ONLY
        const query = `
            WITH latest AS (
                SELECT gang_code, period_month, period_year, MAX(version_index) as max_ver
                FROM dbo.daftar_upah_aggregation_history
                GROUP BY gang_code, period_month, period_year
            )
            SELECT
                SUM(ISNULL(h.total_premi_brondol, 0)) as brondol,
                SUM(ISNULL(h.total_premi_prunning, 0)) as pruning,
                SUM(ISNULL(h.total_premi_insentif, 0)) as insentif,
                SUM(ISNULL(h.total_premi_kinerja, 0)) as kinerja,
                SUM(ISNULL(h.total_premi, 0)) as total,
                h.dynamic_premi_data
            FROM latest l
            JOIN dbo.daftar_upah_aggregation_history h
                ON l.gang_code = h.gang_code
                AND l.period_month = h.period_month
                AND l.period_year = h.period_year
                AND l.max_ver = h.version_index
            WHERE h.period_month = ? AND h.period_year = ?
            ${divisionCode && divisionCode !== 'ALL' ? `AND h.division_code IN (${gangService.getAllDivisionAliases(divisionCode).map(() => '?').join(',')})` : ''}
            GROUP BY h.dynamic_premi_data
        `;

        const params: (string | number)[] = [month, year];
        if (divisionCode && divisionCode !== 'ALL') {
            params.push(...gangService.getAllDivisionAliases(divisionCode));
        }

        const rows = await this.extendDb.query<any>(query, params);

        if (rows.length === 0) return [];

        // Aggregate all rows (multiple gangs may have different dynamic_premi_data structures)
        let totalBrondol = 0, totalPruning = 0, totalInsentif = 0, totalKinerja = 0, grandTotal = 0;
        const dynamicPremiTotals: Record<string, number> = {};

        for (const row of rows) {
            totalBrondol += row.brondol || 0;
            totalPruning += row.pruning || 0;
            totalInsentif += row.insentif || 0;
            totalKinerja += row.kinerja || 0;
            grandTotal += row.total || 0;

            // Parse dynamic_premi_data JSON
            // Structure from payrollDataService: [{header: string, total: number}]
            if (row.dynamic_premi_data) {
                try {
                    const dynamicData = typeof row.dynamic_premi_data === 'string'
                        ? JSON.parse(row.dynamic_premi_data)
                        : row.dynamic_premi_data;

                    if (Array.isArray(dynamicData)) {
                        for (const item of dynamicData) {
                            // payrollDataService uses {header, total} structure
                            const key = item.header || item.name || item.key || 'Unknown';
                            const value = item.total || item.value || item.amount || 0;
                            if (value > 0) {
                                dynamicPremiTotals[key] = (dynamicPremiTotals[key] || 0) + value;
                            }
                        }
                    } else if (typeof dynamicData === 'object') {
                        for (const [key, value] of Object.entries(dynamicData)) {
                            if (typeof value === 'number' && value > 0) {
                                dynamicPremiTotals[key] = (dynamicPremiTotals[key] || 0) + value;
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[DashboardService] Failed to parse dynamic_premi_data:', e);
                }
            }
        }

        // Build result array
        const result: { name: string; value: number }[] = [
            { name: 'Brondol', value: totalBrondol },
            { name: 'Pruning', value: totalPruning },
            { name: 'Insentif', value: totalInsentif },
            { name: 'Kinerja', value: totalKinerja }
        ];

        // Add dynamic premi types
        for (const [key, value] of Object.entries(dynamicPremiTotals)) {
            // Avoid duplicating known premi types
            const normalizedKey = key.toLowerCase().replace(/[_\s]/g, '');
            if (!['brondol', 'pruning', 'insentif', 'kinerja'].includes(normalizedKey)) {
                result.push({ name: key.replace(/_/g, ' ').toUpperCase(), value });
            }
        }

        // Calculate "Other" premi (Total - all known components)
        const sumKnown = result.reduce((sum, item) => sum + item.value, 0);
        const other = grandTotal - sumKnown;
        if (other > 0) {
            result.push({ name: 'Lainnya', value: other });
        }

        // Sort by value descending and filter out zeros
        return result.filter(item => item.value > 0).sort((a, b) => b.value - a.value);
    }

    /**
     * Get Premi Comparison by Division
     */
    public async getPremiByDivision(month: number, year: number): Promise<any[]> {
        // LATEST VERSION ONLY
        const query = `
            WITH latest AS (
                SELECT gang_code, period_month, period_year, MAX(version_index) as max_ver
                FROM dbo.daftar_upah_aggregation_history
                GROUP BY gang_code, period_month, period_year
            )
            SELECT
                h.division_code,
                SUM(ISNULL(h.total_premi_brondol, 0)) as brondol,
                SUM(ISNULL(h.total_premi_prunning, 0)) as pruning,
                SUM(ISNULL(h.total_premi_insentif, 0)) as insentif,
                SUM(ISNULL(h.total_premi_kinerja, 0)) as kinerja,
                SUM(ISNULL(h.total_premi, 0)) as total
            FROM latest l
            JOIN dbo.daftar_upah_aggregation_history h
                ON l.gang_code = h.gang_code
                AND l.period_month = h.period_month
                AND l.period_year = h.period_year
                AND l.max_ver = h.version_index
            WHERE h.period_month = ? AND h.period_year = ?
            GROUP BY h.division_code
            ORDER BY total DESC
        `;

        const rows = await this.extendDb.query<any>(query, [month, year]);

        return rows.map(r => ({
            division: r.division_code,
            brondol: r.brondol,
            pruning: r.pruning,
            insentif: r.insentif,
            kinerja: r.kinerja,
            total: r.total
        }));
    }

    /**
     * Get Overtime Analysis (Breakdown by Task Type)
     */
    public async getOvertimeAnalysis(month: number, year: number, divisionCode?: string): Promise<any[]> {
        // LATEST VERSION ONLY
        const query = `
            WITH latest AS (
                SELECT gang_code, period_month, period_year, MAX(version_index) as max_ver
                FROM dbo.daftar_upah_aggregation_history
                GROUP BY gang_code, period_month, period_year
            )
            SELECT
                h.division_code,
                SUM(ISNULL(h.total_lembur, 0)) as total_lembur
            FROM latest l
            JOIN dbo.daftar_upah_aggregation_history h
                ON l.gang_code = h.gang_code
                AND l.period_month = h.period_month
                AND l.period_year = h.period_year
                AND l.max_ver = h.version_index
            WHERE h.period_month = ? AND h.period_year = ?
            ${divisionCode && divisionCode !== 'ALL' ? `AND h.division_code IN (${gangService.getAllDivisionAliases(divisionCode).map(() => '?').join(',')})` : ''}
            GROUP BY h.division_code
            ORDER BY total_lembur DESC
        `;

        const params: (string | number)[] = [month, year];
        if (divisionCode && divisionCode !== 'ALL') {
            params.push(...gangService.getAllDivisionAliases(divisionCode));
        }

        const rows = await this.extendDb.query<any>(query, params);

        if (rows.length === 0) return [];

        // If single division, return total overtime
        if (divisionCode && divisionCode !== 'ALL') {
            return [{
                name: 'Total Lembur',
                value: rows[0]?.total_lembur || 0
            }];
        }

        // Return breakdown by division
        return rows.map(r => ({
            name: r.division_code,
            value: r.total_lembur || 0
        })).filter(item => item.value > 0);
    }

    /**
     * Get Detailed Division Data (Employee List + Breakdown)
     */
    public async getDivisionDetailData(month: number, year: number, divisionCode: string): Promise<any> {
        // 1. Fetch raw employee data using DataExtractorService
        // This reuses the logic used for spreadsheet generation to ensure consistency
        // Use the imported singleton instance
        // Construct SQL condition for GangCode based on Division Code prefix
        // Assumption: GangCode starts with Division Code (e.g. A1 -> A101, A102)
        // Ensure no SQL injection by simple sanitation (though internal use is safer)
        const safeDivCode = divisionCode.replace(/[^a-zA-Z0-9]/g, '');
        const gangCondition = `g.GangCode LIKE '${safeDivCode}%'`;

        const employees = await dataExtractorService.getEmployees(gangCondition, month, year, undefined, false);

        if (!employees || employees.length === 0) {
            return {
                employees: [],
                overtimeBreakdown: []
            };
        }

        // 2. Process Employee List for Frontend
        // Map to a simplified structure for the grid
        const employeeList = employees.map((emp: any) => ({
            nik: emp.nik,
            name: emp.nama,
            gang: emp.gang_code,
            role: emp.jabatan_estate || 'N/A',
            // Financials
            hk: emp.jumlah_hk || 0,
            gaji_pokok: emp.gaji_pokok || 0,
            tunjangan: emp.total_tunjangan || 0, // Using total_tunjangan from payroll calculation
            premi: emp.total_premi || 0,
            lembur: emp.lembur_jumlah || 0,
            potongan: emp.total_potongan_bersih || 0, // Using clean deduction total
            upah_bersih: emp.upah_bersih || 0,
            // Overtime hours for filter
            lembur_jam: emp.lembur_jam || 0
        }));

        // 3. Aggregate Overtime by Task Type
        // We iterate through lembur_records of all employees
        const otMap = new Map<string, { hours: number, amount: number, count: number }>();

        employees.forEach((emp: any) => {
            if (emp.lembur_records && Array.isArray(emp.lembur_records)) {
                emp.lembur_records.forEach((rec: any) => {
                    const taskDesc = rec.task_desc || rec.task_code || 'LAINNYA';
                    const current = otMap.get(taskDesc) || { hours: 0, amount: 0, count: 0 };

                    current.hours += (rec.hours || 0);
                    current.amount += (rec.amount || 0);
                    current.count += 1;

                    otMap.set(taskDesc, current);
                });
            }
        });

        const overtimeBreakdown = Array.from(otMap.entries())
            .map(([name, data]) => ({
                name,
                value: data.amount,
                hours: data.hours,
                count: data.count
            }))
            .sort((a, b) => b.value - a.value);

        return {
            employees: employeeList,
            overtimeBreakdown
        };
    }

    /**
     * Get Gang Comparison Data for Charts
     */
    // ... existing code ...

    /**
     * Get Gang Comparison Data with Production from Mill
     */
    /**
     * Get Gang Comparison Data with Production from Mill
     */
    public async getGangComparison(
        month: number,
        year: number,
        divisionCode?: string
    ) {
        // 1. Fetch Aggregation Data (Cost & Headcount) - LATEST VERSION ONLY
        let sql = `
            WITH latest AS (
                SELECT gang_code, period_month, period_year, MAX(version_index) as max_ver
                FROM dbo.daftar_upah_aggregation_history
                GROUP BY gang_code, period_month, period_year
            )
            SELECT
                agg.gang_code,
                RTRIM(g.Description) as gang_description,
                SUM(ISNULL(agg.total_upah_bersih, 0)) as total_wage,
                SUM(ISNULL(agg.total_hk, 0)) as total_hk,
                SUM(ISNULL(agg.total_employees, 0)) as headcount,
                SUM(ISNULL(agg.total_lembur, 0)) as total_ot,
                SUM(ISNULL(agg.total_premi, 0)) as total_premi,
                SUM(ISNULL(agg.total_ffb_weight, 0)) as total_production_db
            FROM latest l
            JOIN dbo.daftar_upah_aggregation_history agg
                ON l.gang_code = agg.gang_code
                AND l.period_month = agg.period_month
                AND l.period_year = agg.period_year
                AND l.max_ver = agg.version_index
            LEFT JOIN db_ptrj.dbo.HR_GANG g ON RTRIM(agg.gang_code) = RTRIM(g.GangCode)
            WHERE agg.period_month = ? AND agg.period_year = ?
        `;

        const params: any[] = [month, year];

        if (divisionCode && divisionCode !== 'ALL') {
            if (divisionCode === 'IJL') {
                sql += " AND agg.division_code LIKE 'L%'";
            } else if (divisionCode === 'NON_IJL') {
                sql += " AND agg.division_code NOT LIKE 'L%'";
            } else {
                // Use unified division mapping for regular divisions
                const aliases = gangService.getAllDivisionAliases(divisionCode);
                sql += ` AND agg.division_code IN (${aliases.map(() => '?').join(',')})`;
                params.push(...aliases);
            }
        }

        sql += `
            GROUP BY agg.gang_code, g.Description
            HAVING SUM(ISNULL(agg.total_employees, 0)) >= 0
            ORDER BY total_wage DESC
        `;

        // Use extendDb which is likely initialized in constructor
        const aggData = await this.extendDb.query<any>(sql, params);

        // 2. Fetch Real Production Data from Mill (WM_TICKET) -> Driver -> Gang
        const productionMap = await this.getGangProduction(month, year);

        // 3. Fetch Harvester FFB Bunches Data
        const bunchesMap = await this.getHarvesterBunches(month, year);

        // 4. Merge Data
        const mergedData = aggData.map(row => {
            const cleanGangCode = row.gang_code.trim();
            const realProductionKg = productionMap.get(cleanGangCode) || 0;
            const totalProduction = row.total_production_db > 0 ? row.total_production_db : realProductionKg;

            // Get FFB bunches data for harvesting gangs
            const bunchesData = bunchesMap.get(cleanGangCode);
            const totalBunches = bunchesData?.totalBunches || 0;
            const harvesterCount = bunchesData?.employeeCount || 0;

            const costPerHk = row.total_hk > 0 ? row.total_wage / row.total_hk : 0;
            const totalTon = totalProduction / 1000;
            const costPerTon = totalTon > 0 ? row.total_wage / totalTon : 0;

            return {
                gang_code: cleanGangCode,
                gang_description: row.gang_description,
                gang_type: 'uncategorized', // Default for now as column missing in DB
                total_wage: row.total_wage,
                total_hk: row.total_hk,
                headcount: row.headcount,
                total_ot: row.total_ot,
                total_premi: row.total_premi,
                total_production: totalProduction,
                total_ffb_bunches: totalBunches,
                harvester_count: harvesterCount,
                cost_per_hk: costPerHk,
                cost_per_ton: costPerTon
            };
        });

        return mergedData.sort((a, b) => b.cost_per_hk - a.cost_per_hk);
    }

    /**
     * Fetch Production Data (NetWeight) from WM_TICKET 
     * aggregated by Transport Gang (via Driver)
     */
    private async getGangProduction(month: number, year: number): Promise<Map<string, number>> {
        const gangProduction = new Map<string, number>();
        const dbMill = Database.getMillInstance();
        const dbPayroll = Database.getInstance();

        try {
            const ticketQuery = `
                SELECT 
                    DriverCode, 
                    SUM(CAST(NetWeight AS BIGINT)) as TotalWeight
                FROM [dbo].[WM_TICKET]
                WHERE MONTH(DateReceived) = ? AND YEAR(DateReceived) = ?
                  AND DriverCode IS NOT NULL AND DriverCode <> ''
                GROUP BY DriverCode
            `;

            const driverWeights = await dbMill.query<{ DriverCode: string, TotalWeight: number }>(ticketQuery, [month, year]);

            if (driverWeights.length === 0) return gangProduction;

            const driverCodes = [...new Set(driverWeights.map(d => d.DriverCode))];

            const driverGangMap = new Map<string, string>();

            if (driverCodes.length > 0) {
                // Formatting for IN clause
                const codeList = driverCodes.map(c => `'${c.replace("'", "''")}'`).join(",");
                const gangQuery = `
                    SELECT TRIM(GangMember) as EmpCode, TRIM(GangCode) as GangCode
                    FROM HR_GANGLN 
                    WHERE GangMember IN (${codeList})
                `;

                const mappings = await dbPayroll.query<{ EmpCode: string, GangCode: string }>(gangQuery);
                mappings.forEach(m => {
                    driverGangMap.set(m.EmpCode, m.GangCode);
                });
            }

            for (const dw of driverWeights) {
                const gangCode = driverGangMap.get(dw.DriverCode.trim());
                if (gangCode) {
                    const current = gangProduction.get(gangCode) || 0;
                    // Ensure TotalWeight is treated as number (it might come as string from BigInt)
                    const weight = Number(dw.TotalWeight) || 0;
                    gangProduction.set(gangCode, current + weight);
                }
            }


        } catch (error) {
            console.error("[DashboardService] Error fetching gang production:", error);
        }

        return gangProduction;
    }

    /**
     * Get Harvester FFB Bunches Data
     * Fetches TotalBunches from PR_HARVESTERLN_ARC joined with PR_HARVESTER_ARC
     * Returns Map<GangCode, { totalBunches, employeeCount }>
     */
    private async getHarvesterBunches(month: number, year: number): Promise<Map<string, { totalBunches: number; employeeCount: number }>> {
        const gangBunches = new Map<string, { totalBunches: number; employeeCount: number }>();

        // Use default database profile for harvester data
        const dbHarvester = Database.getInstance();

        try {
            const query = `
                SELECT
                    h.GangCode,
                    COUNT(DISTINCT hl.EmpCode) as EmpCount,
                    SUM(ISNULL(hl.TotalBunches, 0)) as TotalBunches
                FROM PR_HARVESTERLN_ARC hl
                JOIN PR_HARVESTER_ARC h ON hl.MasterID = h.ID
                WHERE h.AccYear = ? AND h.AccMonth = ?
                GROUP BY h.GangCode
            `;

            const rows = await dbHarvester.query<{ GangCode: string; EmpCount: number; TotalBunches: number }>(query, [year.toString(), month.toString()]);

            for (const row of rows) {
                const gangCode = row.GangCode?.trim() || "";
                if (gangCode) {
                    gangBunches.set(gangCode, {
                        totalBunches: row.TotalBunches || 0,
                        employeeCount: row.EmpCount || 0
                    });
                }
            }
        } catch (error) {
            console.error("[DashboardService] Error fetching harvester bunches:", error);
        }

        return gangBunches;
    }

    /**
     * Get Top and Bottom Performing Gangs
     */
    public async getTopBottomGangs(month: number, year: number, divisionCode?: string): Promise<{ top: any[], bottom: any[] }> {
        const allGangs = await this.getGangComparison(month, year, divisionCode);
        const validGangs = allGangs.filter(g => g.cost_per_hk > 0);
        const sortedAsc = [...validGangs].sort((a, b) => a.cost_per_hk - b.cost_per_hk);

        return {
            top: sortedAsc.slice(0, 5),
            bottom: sortedAsc.slice(-5).reverse()
        };
    }

    /**
     * Get Gang History (Last 6 Months)
     */
    public async getGangHistory(gangCode: string, endMonth: number, endYear: number): Promise<any[]> {
        const query = `
            SELECT TOP 6
            h.period_month as month,
            h.period_year as year,
            SUM(h.total_upah_bersih) as total_wage,
            SUM(h.total_lembur) as total_ot,
            SUM(h.total_premi) as total_premi,
            SUM(h.total_hk) as total_hk,
            MAX(h.total_employees) as headcount,
            CAST(SUM(h.total_upah_bersih) AS FLOAT) / NULLIF(SUM(h.total_hk), 0) as cost_per_hk
            FROM daftar_upah_aggregation_history h
            WHERE h.gang_code = ?
            AND (h.period_year * 100 + h.period_month) <= (? * 100 + ?)
            GROUP BY h.period_month, h.period_year
            ORDER BY h.period_year DESC, h.period_month DESC
            `;

        const rows = await this.extendDb.query<any>(query, [gangCode, endYear, endMonth]);
        return rows.reverse(); // Return in chronological order
    }

    /**
     * Get All Gangs Trend (Last 6 Months)
     * For multi-gang comparison chart
     */
    public async getAllGangsTrend(endMonth: number, endYear: number, divisionCode?: string): Promise<any[]> {
        let startYear = endYear;
        let startMonth = endMonth - 5;
        if (startMonth <= 0) {
            startYear -= 1;
            startMonth += 12;
        }

        let divisionFilter = '';
        // Note: parameters are positional in extendDb usually?
        // Based on previous usage, it accepts array.
        // We will pass [startYear, startMonth, endYear, endMonth, divisionCode]

        // Query has 6 placeholders for date logic:
        // (year > ? OR (year = ? AND month >= ?)) AND (year < ? OR (year = ? AND month <= ?))
        // Params order: startYear, startYear, startMonth, endYear, endYear, endMonth
        const params: any[] = [startYear, startYear, startMonth, endYear, endYear, endMonth];

        if (divisionCode && divisionCode !== 'ALL') {
            divisionFilter = `
                AND h.gang_code IN(
                SELECT code FROM HR_GANG WHERE division_code = ?
                )
            `;
            params.push(divisionCode);
        }

        const query = `
        SELECT
            h.gang_code,
            h.period_month as month,
            h.period_year as year,
            SUM(h.total_upah_bersih) as total_wage,
            SUM(h.total_lembur) as total_ot,
            SUM(h.total_premi) as total_premi,
            MAX(h.total_employees) as headcount,
            CAST(SUM(h.total_upah_bersih) AS FLOAT) / NULLIF(SUM(h.total_hk), 0) as cost_per_hk
            FROM daftar_upah_aggregation_history h
        WHERE
            (h.period_year > ? OR (h.period_year = ? AND h.period_month >= ?)) AND
            (h.period_year < ? OR (h.period_year = ? AND h.period_month <= ?))
            ${divisionFilter}
            GROUP BY h.gang_code, h.period_month, h.period_year
            ORDER BY h.gang_code, h.period_year, h.period_month
            `;

        return await this.extendDb.query<any>(query, params);
    }
}

export const dashboardService = DashboardService.getInstance();
