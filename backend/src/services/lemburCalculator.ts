import { Database } from "../db/client";
import { cacheService } from "./cacheService";
import { payrollService } from "./payrollService";

// Day Type Classification
export enum DayType {
    WORKDAY_LONG = "WORKDAY_LONG",       // Mon, Tue, Wed, Thu, Sat (7+ hours before OT)
    WORKDAY_SHORT = "WORKDAY_SHORT",     // Friday (5+ hours before OT)
    SUNDAY = "SUNDAY",                   // Sunday (OT from first hour)
    HOLIDAY_REGULAR = "HOLIDAY_REGULAR", // Non-religious public holiday
    HOLIDAY_RELIGIOUS = "HOLIDAY_RELIGIOUS"  // Religious public holiday
}

export function getDayTypeDisplayName(dayType: DayType): string {
    const names: Record<DayType, string> = {
        [DayType.WORKDAY_LONG]: "Hari Kerja",
        [DayType.WORKDAY_SHORT]: "Jumat",
        [DayType.SUNDAY]: "Minggu",
        [DayType.HOLIDAY_REGULAR]: "Libur Umum",
        [DayType.HOLIDAY_RELIGIOUS]: "Libur Keagamaan"
    };
    return names[dayType] || dayType;
}

// Overtime Rate Configuration
const OVERTIME_RATES: Record<string, { tier_1_rate: number; tier_2_rate: number; tier_3_rate: number; tier_1_boundary?: number; tier_1_boundary_short?: number; tier_1_boundary_long?: number }> = {
    // Workdays: 2-tier (1.5x first hour, 2x after)
    WORKDAY_LONG: { tier_1_rate: 1.5, tier_2_rate: 2.0, tier_3_rate: 2.0, tier_1_boundary: 1 },
    WORKDAY_SHORT: { tier_1_rate: 1.5, tier_2_rate: 2.0, tier_3_rate: 2.0, tier_1_boundary: 1 },

    // Sunday: 3-tier (2x, 3x, 4x)
    SUNDAY: { tier_1_rate: 2.0, tier_2_rate: 3.0, tier_3_rate: 4.0, tier_1_boundary_short: 5, tier_1_boundary_long: 7 },

    // Regular Holiday: 3-tier (2x, 3x, 4x)
    HOLIDAY_REGULAR: { tier_1_rate: 2.0, tier_2_rate: 3.0, tier_3_rate: 4.0, tier_1_boundary_short: 5, tier_1_boundary_long: 7 },

    // Religious Holiday: 3-tier (3x, 4x, 4x)
    HOLIDAY_RELIGIOUS: { tier_1_rate: 3.0, tier_2_rate: 4.0, tier_3_rate: 4.0, tier_1_boundary_short: 5, tier_1_boundary_long: 7 }
};

export interface OvertimeBreakdown {
    tier_1_rate: number;
    tier_1_hours: number;
    tier_1_amount: number;
    tier_1_boundary: number;
    tier_2_rate: number;
    tier_2_hours: number;
    tier_2_amount: number;
    tier_3_rate: number;
    tier_3_hours: number;
    tier_3_amount: number;
    total_rate: number;
    total_amount: number;
}

export interface OvertimeRecord {
    id: number;
    emp_code: string;
    emp_name: string;
    trx_date: Date;
    hours: number;
    day_type?: DayType;
    breakdown?: OvertimeBreakdown;
    task_code?: string;
    shift_code?: string;
    raw_amount?: number;
    raw_rate?: number;
}

export interface LemburResult {
    emp_code: string;
    emp_name: string;
    month: number;
    year: number;
    upj: number;
    records: OvertimeRecord[];
    total_hours: number;
    total_payment: number;
    record_count: number;
}

export class LemburCalculator {
    private static instance: LemburCalculator;
    private db: Database;
    private upjValue: number;

    private constructor() {
        this.db = Database.getInstance();
        // UPJ default value (can be loaded from config)
        this.upjValue = parseFloat(process.env.LEMBUR_UPJ || "17257");
    }

    public static getInstance(): LemburCalculator {
        if (!LemburCalculator.instance) {
            LemburCalculator.instance = new LemburCalculator();
        }
        return LemburCalculator.instance;
    }

    // --- Day Classification ---
    public async classifyDay(date: Date, year: number): Promise<DayType> {
        const dayOfWeek = date.getDay(); // 0 = Sunday, 5 = Friday

        // Check if Sunday
        if (dayOfWeek === 0) {
            return DayType.SUNDAY;
        }

        // Check holidays
        const holidays = await this.getHolidays(year);
        const dateKey = date.toISOString().substring(0, 10);
        const holiday = holidays[dateKey];

        if (holiday) {
            return holiday.is_religious ? DayType.HOLIDAY_RELIGIOUS : DayType.HOLIDAY_REGULAR;
        }

        // Regular workday
        return dayOfWeek === 5 ? DayType.WORKDAY_SHORT : DayType.WORKDAY_LONG;
    }

    // --- Get Holidays ---
    public async getHolidays(year: number): Promise<Record<string, { description: string; is_religious: boolean }>> {
        const cacheKey = `holidays:${year}`;
        const cached = cacheService.get<Record<string, any>>(cacheKey);
        if (cached) return cached;

        const holidays: Record<string, any> = {};
        try {
            const rows = await this.db.query<{
                HolidayDate: string;
                Description: string;
                IsRegionPH: number;
            }>(`
                SELECT HolidayDate, Description, IsRegionPH 
                FROM HR_GPH 
                WHERE YEAR(HolidayDate) = ? AND Status = 1
            `, [year]);

            for (const row of rows) {
                const dateKey = new Date(row.HolidayDate).toISOString().substring(0, 10);
                holidays[dateKey] = {
                    description: row.Description?.trim() || "",
                    is_religious: row.IsRegionPH === 1
                };
            }
        } catch (e) {
            console.error("[LemburCalculator] Failed to get holidays:", e);
        }

        cacheService.set(cacheKey, holidays, 3600); // 1 hour cache
        return holidays;
    }

    // --- Calculate Overtime Payment ---
    public calculateOvertimePayment(
        hours: number,
        dayType: DayType,
        upj: number,
        isShortDay: boolean = false
    ): OvertimeBreakdown {
        const rates = OVERTIME_RATES[dayType] || OVERTIME_RATES.WORKDAY_LONG;

        const tier1Rate = rates.tier_1_rate;
        const tier2Rate = rates.tier_2_rate;
        const tier3Rate = rates.tier_3_rate;

        let tier1Boundary: number;
        let tier2Boundary: number;

        // Determine tier boundaries
        if (dayType === DayType.WORKDAY_LONG || dayType === DayType.WORKDAY_SHORT) {
            tier1Boundary = rates.tier_1_boundary || 1;
            tier2Boundary = 999; // Effectively infinite for workdays
        } else {
            tier1Boundary = isShortDay
                ? (rates.tier_1_boundary_short || 5)
                : (rates.tier_1_boundary_long || 7);
            tier2Boundary = tier1Boundary + 1;
        }

        // Calculate hours in each tier
        if (hours <= 0) {
            return {
                tier_1_rate: tier1Rate, tier_1_hours: 0, tier_1_amount: 0, tier_1_boundary: tier1Boundary,
                tier_2_rate: tier2Rate, tier_2_hours: 0, tier_2_amount: 0,
                tier_3_rate: tier3Rate, tier_3_hours: 0, tier_3_amount: 0,
                total_rate: 0, total_amount: 0
            };
        }

        // Tier 1
        const tier1Hours = Math.min(hours, tier1Boundary);
        const tier1Amount = upj * tier1Rate * tier1Hours;

        // Tier 2
        const remainingAfterT1 = Math.max(0, hours - tier1Boundary);
        let tier2Hours: number;
        let tier3Hours: number;

        if (dayType === DayType.WORKDAY_LONG || dayType === DayType.WORKDAY_SHORT) {
            tier2Hours = remainingAfterT1;
            tier3Hours = 0;
        } else {
            tier2Hours = Math.min(remainingAfterT1, 1);
            tier3Hours = Math.max(0, remainingAfterT1 - 1);
        }

        const tier2Amount = upj * tier2Rate * tier2Hours;
        const tier3Amount = upj * tier3Rate * tier3Hours;

        const totalRate = (tier1Rate * tier1Hours) + (tier2Rate * tier2Hours) + (tier3Rate * tier3Hours);
        const totalAmount = tier1Amount + tier2Amount + tier3Amount;

        return {
            tier_1_rate: tier1Rate,
            tier_1_hours: tier1Hours,
            tier_1_amount: Math.round(tier1Amount * 100) / 100,
            tier_1_boundary: tier1Boundary,
            tier_2_rate: tier2Rate,
            tier_2_hours: tier2Hours,
            tier_2_amount: Math.round(tier2Amount * 100) / 100,
            tier_3_rate: tier3Rate,
            tier_3_hours: tier3Hours,
            tier_3_amount: Math.round(tier3Amount * 100) / 100,
            total_rate: Math.round(totalRate * 100) / 100,
            total_amount: Math.round(totalAmount * 100) / 100
        };
    }

    // --- Calculate for Employee ---
    public async calculate(empCode: string, month: number, year: number, manualUpj?: number): Promise<LemburResult> {
        const daysInMonth = new Date(year, month, 0).getDate();
        const startDate = `${year}-${month.toString().padStart(2, "0")}-01`;
        const endDate = `${year}-${month.toString().padStart(2, "0")}-${daysInMonth}`;

        // Deterined UPJ: manual > employee basic wage / 173 > default
        let upj = manualUpj;
        if (upj === undefined) {
            try {
                const payRates = await payrollService.getPayratesMap([empCode]);
                const payRate = payRates[empCode] || 0;
                if (payRate > 0) {
                    upj = payRate / 173;
                } else {
                    upj = this.upjValue; // Fallback to default
                }
            } catch (e) {
                console.error("[LemburCalculator] Failed to fetch payrate, using fallback:", e);
                upj = this.upjValue;
            }
        }

        const records: OvertimeRecord[] = [];
        let empName = empCode;

        try {
            const rows = await this.db.query<{
                ID: number;
                EmpCode: string;
                EmpName: string;
                TrxDate: string;
                Hours: number;

                TaskCode: string;
                ShiftCode: string;
                Amount: number;
                Rate: number;
            }>(`

                SELECT 
                    trl.ID,
                    trl.EmpCode,
                    e.EmpName,
                    trl.TrxDate,
                    trl.Hours,
                    trl.TaskCode,
                    trl.ShiftCode,
                    trl.Amount,
                    trl.Rate
                FROM (
                    -- Active Table
                    SELECT l.ID, l.EmpCode, l.TrxDate, l.Hours, l.TaskCode, l.ShiftCode, l.Amount, l.Rate
                    FROM PR_TASKREGLN l
                    JOIN PR_TASKREG m ON l.MasterID = m.ID
                    WHERE l.EmpCode = ? AND l.TrxDate >= ? AND l.TrxDate <= ? AND l.OT = 1
                    
                    UNION ALL
                    
                    -- Archive Table
                    SELECT l.ID, l.EmpCode, l.TrxDate, l.Hours, l.TaskCode, l.ShiftCode, l.Amount, l.Rate
                    FROM PR_TASKREGLN_ARC l
                    JOIN PR_TASKREG_ARC m ON l.MasterID = m.ID
                    WHERE l.EmpCode = ? AND l.TrxDate >= ? AND l.TrxDate <= ? AND l.OT = 1
                ) trl
                LEFT JOIN HR_EMPLOYEE e ON e.EmpCode = trl.EmpCode
                ORDER BY trl.TrxDate
            `, [empCode, startDate, endDate, empCode, startDate, endDate]);

            for (const row of rows) {
                empName = row.EmpName || empCode;
                const trxDate = new Date(row.TrxDate);
                const isFriday = trxDate.getDay() === 5;

                // Classify day
                const dayType = await this.classifyDay(trxDate, year);

                // Calculate breakdown
                const breakdown = this.calculateOvertimePayment(row.Hours, dayType, upj || this.upjValue, isFriday);

                records.push({
                    id: row.ID,
                    emp_code: row.EmpCode,
                    emp_name: row.EmpName || empCode,
                    trx_date: trxDate,
                    hours: row.Hours,
                    day_type: dayType,
                    breakdown,
                    task_code: row.TaskCode,
                    shift_code: row.ShiftCode,
                    raw_amount: row.Amount || 0,
                    raw_rate: row.Rate || 0
                });
            }
        } catch (e) {
            console.error("[LemburCalculator] Calculation failed:", e);
        }

        const totalHours = records.reduce((sum, r) => sum + r.hours, 0);
        const totalPayment = records.reduce((sum, r) => sum + (r.breakdown?.total_amount || 0), 0);

        return {
            emp_code: empCode,
            emp_name: empName,
            month,
            year,
            upj: upj || this.upjValue,
            records,
            total_hours: totalHours,
            total_payment: totalPayment,
            record_count: records.length
        };
    }

    // --- Quick Calculate (no database) ---
    public quickCalculate(hours: number, dayTypeStr: string = "WORKDAY_LONG", isShortDay: boolean = false): OvertimeBreakdown {
        const dayType = (DayType as any)[dayTypeStr] || DayType.WORKDAY_LONG;
        return this.calculateOvertimePayment(hours, dayType, this.upjValue, isShortDay);
    }

    // --- Batch Amounts (for payroll integration) ---
    public async calculateBatchAmounts(empCodes: string[], month: number, year: number): Promise<Record<string, number>> {
        const result: Record<string, number> = {};

        // Batch fetch payratess
        let payRates: Record<string, number> = {};
        try {
            payRates = await payrollService.getPayratesMap(empCodes);
        } catch (e) {
            console.error("[LemburCalculator] Failed to batch fetch payrates:", e);
        }

        for (const empCode of empCodes) {
            try {
                const payRate = payRates[empCode] || 0;
                // Calculate UPJ: Basic Wage / 173
                const upj = payRate > 0 ? payRate / 173 : this.upjValue;

                const lemburResult = await this.calculate(empCode, month, year, upj);
                result[empCode] = lemburResult.total_payment;
            } catch (e) {
                result[empCode] = 0;
            }
        }

        return result;
    }
}

export const lemburCalculator = LemburCalculator.getInstance();
