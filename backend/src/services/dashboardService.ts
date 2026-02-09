import { Database } from "../db/client";
import { DataExtractorService } from "./dataExtractorService";

export class DashboardService {
    private static instance: DashboardService;
    private db: Database;
    private extendDb: Database;

    private constructor() {
        this.db = Database.getInstance(undefined, "SERVER_PROFILE_1");
        this.extendDb = Database.getInstance("extend_db_ptrj", "SERVER_PROFILE_1");
    }

    public static getInstance(): DashboardService {
        if (!DashboardService.instance) {
            DashboardService.instance = new DashboardService();
        }
        return DashboardService.instance;
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

        const query = `
            SELECT 
                period_year, 
                period_month,
                SUM(ISNULL(total_upah_bersih, 0)) as total_wage,
                SUM(ISNULL(total_lembur, 0)) as total_ot,
                SUM(ISNULL(total_premi, 0)) as total_premi,
                SUM(ISNULL(total_employees, 0)) as total_headcount,
                SUM(ISNULL(total_hk, 0)) as total_hk
            FROM dbo.daftar_upah_aggregation_history
            WHERE 
                (period_year > ? OR (period_year = ? AND period_month >= ?))
                AND (period_year < ? OR (period_year = ? AND period_month <= ?))
                AND division_code NOT IN ('MILL', 'PKS') -- Usually we separate Mill for plantation analysis, but can be included if needed
            GROUP BY period_year, period_month
            ORDER BY period_year, period_month
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
        const query = `
            SELECT 
                division_code,
                SUM(ISNULL(total_upah_bersih, 0)) as total_wage,
                SUM(ISNULL(total_lembur, 0)) as total_ot,
                SUM(ISNULL(total_premi, 0)) as total_premi,
                SUM(ISNULL(total_employees, 0)) as headcount
            FROM dbo.daftar_upah_aggregation_history
            WHERE period_month = ? AND period_year = ?
            GROUP BY division_code
            ORDER BY total_wage DESC
        `;

        const rows = await this.extendDb.query<any>(query, [month, year]);
        return rows;
    }

    /**
     * Get Top Gangs by Cost
     */
    public async getGangBreakdown(month: number, year: number, limit: number = 15): Promise<any[]> {
        const query = `
            SELECT TOP ${limit}
                gang_code,
                SUM(ISNULL(total_upah_bersih, 0)) as total_wage,
                SUM(ISNULL(total_lembur, 0)) as total_ot,
                SUM(ISNULL(total_employees, 0)) as headcount
            FROM dbo.daftar_upah_aggregation_history
            WHERE period_month = ? AND period_year = ?
            GROUP BY gang_code
            ORDER BY total_wage DESC
        `;
        return await this.extendDb.query<any>(query, [month, year]);
    }

    /**
     * Get Division Efficiency (Cost vs Headcount/WorkDays)
     */
    public async getDivisionEfficiency(month: number, year: number): Promise<any[]> {
        const query = `
            SELECT 
                division_code,
                SUM(ISNULL(total_upah_bersih, 0)) as total_cost,
                SUM(ISNULL(total_employees, 0)) as headcount,
                SUM(ISNULL(total_hk, 0)) as total_man_days
            FROM dbo.daftar_upah_aggregation_history
            WHERE period_month = ? AND period_year = ?
            GROUP BY division_code
            HAVING SUM(ISNULL(total_employees, 0)) > 0
            ORDER BY total_cost DESC
        `;
        return await this.extendDb.query<any>(query, [month, year]);
    }

    /**
     * Get 12-Month/Period Productivity Trend (Cost per HK)
     */
    public async getProductivityTrend(endMonth: number, endYear: number): Promise<any[]> {
        const { startMonth, startYear } = this.getStartPeriod(endMonth, endYear);
        const query = `
            SELECT 
                period_month, 
                period_year,
                SUM(ISNULL(total_upah_bersih, 0)) as total_wage,
                SUM(ISNULL(total_hk, 0)) as total_hk
            FROM dbo.daftar_upah_aggregation_history
            WHERE 
                (period_year > ? OR (period_year = ? AND period_month >= ?))
                AND (period_year < ? OR (period_year = ? AND period_month <= ?))
            GROUP BY period_year, period_month
            ORDER BY period_year, period_month
        `;

        const rows = await this.extendDb.query<any>(query, [startYear, startYear, startMonth, endYear, endYear, endMonth]);

        return rows.map(r => ({
            period: `${this.getMonthName(r.period_month)} ${r.period_year}`,
            costPerHk: r.total_hk > 0 ? r.total_wage / r.total_hk : 0,
            totalHk: r.total_hk
        }));
    }

    /**
     * Get Wage Spikes (Anomaly Detection)
     * Compares Current Month vs Previous Month for Top 5 Spikes > 20%
     */
    /**
     * Get Gang Wage Spikes (Anomaly Detection)
     * Compares Current Month vs Previous Month for Top 5 Gangs with highest Cost/HK increase
     */
    public async getWageSpikes(month: number, year: number): Promise<any[]> {
        const query = `
            SELECT 
                gang_code,
                SUM(ISNULL(total_upah_bersih, 0)) as total_wage,
                SUM(ISNULL(total_hk, 0)) as total_hk
            FROM dbo.daftar_upah_aggregation_history
            WHERE period_month = ? AND period_year = ?
            GROUP BY gang_code
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
     * Get Filter Options (Divisions and Gangs)
     */
    public async getFilterOptions(month: number, year: number): Promise<{ divisions: string[], gangs: string[] }> {
        const divQuery = `
            SELECT DISTINCT division_code 
            FROM dbo.daftar_upah_aggregation_history 
            WHERE period_month = ? AND period_year = ?
            ORDER BY division_code
        `;

        const gangQuery = `
            SELECT DISTINCT gang_code 
            FROM dbo.daftar_upah_aggregation_history 
            WHERE period_month = ? AND period_year = ?
            ORDER BY gang_code
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

        // Dynamic IN clause placeholder
        const placeholders = codes.map((_, i) => `@p${i + 2}`).join(','); // +2 because month/year are 0,1

        const query = `
            SELECT 
                ${column} as name,
                SUM(ISNULL(total_upah_bersih, 0)) as total_wage,
                SUM(ISNULL(total_lembur, 0)) as total_ot,
                SUM(ISNULL(total_hk, 0)) as total_hk,
                SUM(ISNULL(total_employees, 0)) as headcount
            FROM dbo.daftar_upah_aggregation_history
            WHERE period_month = @p0 
              AND period_year = @p1
              AND ${column} IN (${placeholders})
            GROUP BY ${column}
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
}

export const dashboardService = DashboardService.getInstance();
