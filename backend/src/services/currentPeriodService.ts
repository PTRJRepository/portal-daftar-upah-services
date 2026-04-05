import { Database } from "../db/client";

export interface CurrentPeriodResponse {
    month: number;
    year: number;
    latest_trx_date: string | null;
    latest_acc_month: number | null;
    latest_acc_year: number | null;
    is_cached: boolean;
}

/**
 * Current Period Service
 *
 * Determines the current payroll period by:
 * 1. Querying PR_TASKREGLN_ARC for the latest TrxDate
 * 2. Converting the accounting month/year to calendar month/year
 * 3. Current period = latest month + 1
 *
 * Accounting Month vs Calendar Month:
 * - AccMonth 1-9 = Calendar Month (previous year): Oct(10)-Dec(12) -> 1-3
 * - AccMonth 10-12 = Calendar Month (current year): Jan(1)-Mar(3) -> 10-12
 *
 * Calendar to AccMonth conversion:
 * - Calendar Oct(10)-Dec(12) -> AccMonth 1-3 (next year)
 * - Calendar Jan(1)-Sep(9) -> AccMonth 10-12 (current year)
 */
export class CurrentPeriodService {
    private static instance: CurrentPeriodService;
    private db: Database;
    private cache: CurrentPeriodResponse | null = null;
    private cacheExpiry: number = 0;
    private readonly CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

    private constructor() {
        this.db = Database.getExtendedInstance();
    }

    public static getInstance(): CurrentPeriodService {
        if (!CurrentPeriodService.instance) {
            CurrentPeriodService.instance = new CurrentPeriodService();
        }
        return CurrentPeriodService.instance;
    }

    /**
     * Get the current payroll period (month and year)
     * This is calculated as: latest period from PR_TASKREGLN_ARC + 1 month
     */
    public async getCurrentPeriod(): Promise<CurrentPeriodResponse> {
        const now = Date.now();

        // Return cached result if still valid
        if (this.cache && now < this.cacheExpiry) {
            return { ...this.cache, is_cached: true };
        }

        try {
            // ALWAYS use extend_db_ptrj (SERVER_PROFILE_1) for fast access
            // Query daftar_upah_aggregation_history for latest period
            const rows = await this.db.query<{
                period_month: number;
                period_year: number;
            }>(`
                SELECT TOP 1
                    period_month,
                    period_year
                FROM dbo.daftar_upah_aggregation_history
                ORDER BY period_year DESC, period_month DESC
            `);

            if (!rows || rows.length === 0) {
                // No data in extend_db_ptrj, use config defaults
                const { Config } = await import("../config");
                const result: CurrentPeriodResponse = {
                    month: Config.DEFAULT_MONTH,
                    year: Config.DEFAULT_YEAR,
                    latest_trx_date: null,
                    latest_acc_month: null,
                    latest_acc_year: null,
                    is_cached: false
                };

                this.cache = result;
                this.cacheExpiry = now + this.CACHE_DURATION_MS;
                return result;
            }

            const latest = rows[0];
            
            // Use period_month and period_year directly from aggregation history
            const currentMonth = latest.period_month;
            const currentYear = latest.period_year;

            const result: CurrentPeriodResponse = {
                month: currentMonth,
                year: currentYear,
                latest_trx_date: null,
                latest_acc_month: null,
                latest_acc_year: null,
                is_cached: false
            };

            this.cache = result;
            this.cacheExpiry = now + this.CACHE_DURATION_MS;
            return result;

        } catch (error) {
            // ANY error (timeout, connection, etc) -> IMMEDIATE fallback to SERVER_PROFILE_1 defaults
            console.error("[CurrentPeriodService] Error (using extend_db_ptrj fallback):", error.message);

            const { Config } = await import("../config");
            const result: CurrentPeriodResponse = {
                month: Config.DEFAULT_MONTH,
                year: Config.DEFAULT_YEAR,
                latest_trx_date: null,
                latest_acc_month: null,
                latest_acc_year: null,
                is_cached: false
            };

            // Cache the fallback to prevent repeated failed attempts
            this.cache = result;
            this.cacheExpiry = now + this.CACHE_DURATION_MS;

            return result;
        }
    }

    /**
     * Convert calendar month/year to AccMonth/AccYear
     * This is needed for querying PR_GANGLN_ARC for historical data
     *
     * Calendar Month -> AccMonth:
     * - Oct(10)-Dec(12) -> AccMonth 1-3 (next year)
     * - Jan(1)-Sep(9) -> AccMonth 10-12 (current year)
     */
    public calendarToAccMonth(calendarMonth: number, calendarYear: number): { accMonth: number; accYear: number } {
        if (calendarMonth >= 4) {
            // Apr(4)-Dec(12) -> AccMonth 1-9, year is next year
            return {
                accMonth: calendarMonth - 3,
                accYear: calendarYear + 1
            };
        } else {
            // Jan(1)-Mar(3) -> AccMonth 10-12, year is current
            return {
                accMonth: calendarMonth + 9,
                accYear: calendarYear
            };
        }
    }

    /**
     * Convert AccMonth/AccYear to calendar month/year
     */
    public accToCalendarMonth(accMonth: number, accYear: number): { calendarMonth: number; calendarYear: number } {
        if (accMonth <= 9) {
            // AccMonth 1-9 -> Calendar 4-11 (previous year)
            return {
                calendarMonth: accMonth + 3,
                calendarYear: accYear - 1
            };
        } else {
            // AccMonth 10-12 -> Calendar 1-3 (current year)
            return {
                calendarMonth: accMonth - 9,
                calendarYear: accYear
            };
        }
    }

    /**
     * Clear the cache (useful for testing or after data updates)
     */
    public clearCache(): void {
        this.cache = null;
        this.cacheExpiry = 0;
    }
}

export const currentPeriodService = CurrentPeriodService.getInstance();
