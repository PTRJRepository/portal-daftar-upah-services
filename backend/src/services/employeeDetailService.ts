import { Database } from "../db/client";
import { dataExtractorService } from "./dataExtractorService";
import { lemburCalculator, getDayTypeDisplayName } from "./lemburCalculator";

export interface AttendanceDay {
    date: string;
    status: string;
    is_present: boolean;
    is_rest_day: boolean;
    is_holiday: boolean;
    remarks: string;
    task_code?: string;
    hours?: number;
    has_data: boolean;
}

export interface OvertimeDay {
    date: string;
    has_overtime: boolean;
    hours: number;
    amount: number;
    amount_formula?: number;
    details: any[];
}

export interface EmployeeInfo {
    nik: string;
    nama: string;
    jenis_kelamin: string;
    loc_code: string;
    gang_code: string;
    upah_dasar: number;
}

export interface AttendanceSummary {
    total_hadir: number;
    total_tidak_hadir: number;
    cuti_tahunan: number;
    cuti_sakit: number;
    cuti_minggu: number;
    libur: number;
    alpa: number;
    no_data: number;
    total_hk: number;
    kehadiran_efektif: number;
}

export class EmployeeDetailService {
    private static instance: EmployeeDetailService;
    private db: Database;

    private constructor() {
        this.db = Database.getInstance();
    }

    public static getInstance(): EmployeeDetailService {
        if (!EmployeeDetailService.instance) {
            EmployeeDetailService.instance = new EmployeeDetailService();
        }
        return EmployeeDetailService.instance;
    }

    // --- Holiday Helper ---
    public async getHolidaysFromHrGph(month: number, year: number): Promise<Record<number, any>> {
        const daysInMonth = new Date(year, month, 0).getDate();
        const startDate = `${year}-${month.toString().padStart(2, "0")}-01`;
        const endDate = `${year}-${month.toString().padStart(2, "0")}-${daysInMonth}`;

        const holidays: Record<number, any> = {};
        try {
            const rows = await this.db.query<{
                day_of_month: number;
                HolidayDate: string;
                Description: string;
                IsRegionPH: number;
            }>(`
                SELECT 
                    DAY(HolidayDate) as day_of_month,
                    HolidayDate,
                    Description,
                    IsRegionPH
                FROM HR_GPH 
                WHERE HolidayDate >= ? AND HolidayDate <= ?
                  AND Status = 1
                ORDER BY HolidayDate
            `, [startDate, endDate]);

            for (const row of rows) {
                const day = row.day_of_month;
                const isReligious = row.IsRegionPH === 1;
                holidays[day] = {
                    date: row.HolidayDate,
                    description: row.Description?.trim() || "",
                    is_religious: isReligious,
                    holiday_type: isReligious ? "Libur Keagamaan" : "Libur Nasional"
                };
            }
        } catch (e) {
            console.error("[EmployeeDetailService] Failed to get holidays:", e);
        }
        return holidays;
    }

    // --- Employee Info ---
    public async getEmployeeInfo(empCode: string): Promise<EmployeeInfo | null> {
        try {
            const rows = await this.db.query<{
                EmpCode: string;
                EmpName: string;
                Gender: string | number;
                LocCode: string;
                GangCode: string;
                PayRate: number;
            }>(`
                SELECT DISTINCT
                    e.EmpCode,
                    e.EmpName,
                    e.Gender,
                    e.LocCode,
                    g.GangCode,
                    p.PayRate
                FROM HR_EMPLOYEE e
                LEFT JOIN HR_GANGLN g ON RTRIM(g.GangMember) = RTRIM(e.EmpCode)
                LEFT JOIN HR_PAYROLL p ON RTRIM(p.EmpCode) = RTRIM(e.EmpCode)
                WHERE RTRIM(e.EmpCode) = RTRIM(?)
            `, [empCode]);
            const row = rows[0];

            if (!row) return null;

            // Gender mapping: 1=L (Laki-laki), 2=P (Perempuan)
            let gender = "L";
            if (String(row.Gender) === "2" || String(row.Gender).toUpperCase() === "P") {
                gender = "P";
            }

            return {
                nik: row.EmpCode,
                nama: row.EmpName,
                jenis_kelamin: gender,
                loc_code: row.LocCode,
                gang_code: row.GangCode,
                upah_dasar: row.PayRate || 0
            };
        } catch (e) {
            console.error("[EmployeeDetailService] Failed to get employee info:", e);
            return null;
        }
    }

    // --- Daily Attendance ---
    public async getDailyAttendance(empCode: string, month: number, year: number): Promise<{
        matrix: Record<number, AttendanceDay>;
        summary: AttendanceSummary;
        holidays: any[];
    }> {
        const daysInMonth = new Date(year, month, 0).getDate();
        const startDate = `${year}-${month.toString().padStart(2, "0")}-01`;
        const endDate = `${year}-${month.toString().padStart(2, "0")}-${daysInMonth}`;

        const holidays = await this.getHolidaysFromHrGph(month, year);
        const holidayDays = new Set(Object.keys(holidays).map(Number));

        // Initialize matrix
        const matrix: Record<number, AttendanceDay> = {};
        const summary: AttendanceSummary = {
            total_hadir: 0,
            total_tidak_hadir: 0,
            cuti_tahunan: 0,
            cuti_sakit: 0,
            cuti_minggu: 0,
            libur: 0,
            alpa: 0,
            no_data: 0,
            total_hk: 0,
            kehadiran_efektif: 0
        };

        for (let day = 1; day <= daysInMonth; day++) {
            matrix[day] = {
                date: `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`,
                status: "no_data",
                is_present: false,
                is_rest_day: false,
                is_holiday: false,
                remarks: "",
                has_data: false
            };
        }

        try {
            // Query PR_TASKREGLN for attendance
            const rows = await this.db.query<{
                day_of_month: number;
                TrxDate: string;
                TaskCode: string;
                Hours: number;
            }>(`
                SELECT 
                    DAY(TrxDate) as day_of_month,
                    TrxDate,
                    TaskCode,
                    Hours
                FROM (
                    SELECT trl.TrxDate, trl.TaskCode, trl.Hours
                    FROM PR_TASKREGLN trl
                    JOIN PR_TASKREG tm ON trl.MasterID = tm.ID
                    WHERE RTRIM(trl.EmpCode) = RTRIM(?)
                      AND trl.TrxDate >= ?
                      AND trl.TrxDate <= ?
                      AND trl.OT = 0
                    
                    UNION ALL
                    
                    SELECT trl.TrxDate, trl.TaskCode, trl.Hours
                    FROM PR_TASKREGLN_ARC trl
                    JOIN PR_TASKREG_ARC tm ON trl.MasterID = tm.ID
                    WHERE RTRIM(trl.EmpCode) = RTRIM(?)
                      AND trl.TrxDate >= ?
                      AND trl.TrxDate <= ?
                      AND trl.OT = 0
                ) combined
                ORDER BY TrxDate
            `, [empCode, startDate, endDate, empCode, startDate, endDate]);

            const daysWithData = new Set<number>();
            let maxDataDay = 0;

            for (const row of rows) {
                const day = row.day_of_month;
                const taskCode = row.TaskCode || "";

                daysWithData.add(day);
                if (day > maxDataDay) maxDataDay = day;
                summary.total_hk++;

                // Parse date for day-of-week check
                const dateObj = new Date(row.TrxDate);
                const isSunday = dateObj.getDay() === 0;
                const isHoliday = holidayDays.has(day);

                // Determine status
                let status = "hadir";
                let remarks = "";

                if (taskCode.startsWith("GA9129")) {
                    status = "cuti_tahunan";
                    remarks = "Cuti Tahunan";
                    summary.cuti_tahunan++;
                    summary.total_tidak_hadir++;
                } else if (taskCode.startsWith("GA9126")) {
                    status = "sakit";
                    remarks = "Sakit";
                    summary.cuti_sakit++;
                    summary.total_tidak_hadir++;
                } else if (taskCode.startsWith("GA9127")) {
                    status = "cuti_minggu";
                    remarks = "Cuti Minggu";
                    summary.cuti_minggu++;
                } else if (taskCode.startsWith("GA9128")) {
                    status = "libur";
                    remarks = "Cuti Nasional";
                    summary.libur++;
                } else if (isSunday) {
                    status = "minggu";
                    remarks = "Hari Minggu";
                    summary.cuti_minggu++;
                } else if (isHoliday) {
                    const holidayInfo = holidays[day];
                    status = holidayInfo?.is_religious ? "libur_keagamaan" : "libur_nasional";
                    remarks = holidayInfo?.description || "Libur Nasional";
                    summary.libur++;
                } else {
                    summary.total_hadir++;
                    summary.kehadiran_efektif++;
                }

                matrix[day] = {
                    date: row.TrxDate?.substring(0, 10) || matrix[day].date,
                    status,
                    is_present: status === "hadir",
                    is_rest_day: isSunday,
                    is_holiday: isHoliday,
                    remarks,
                    task_code: taskCode,
                    hours: row.Hours,
                    has_data: true
                };
            }

            // Handle days without data
            for (let day = 1; day <= daysInMonth; day++) {
                if (!daysWithData.has(day)) {
                    const dateObj = new Date(year, month - 1, day);
                    const isSunday = dateObj.getDay() === 0;
                    const isHoliday = holidayDays.has(day);

                    if (maxDataDay > 0 && day < maxDataDay && !isSunday && !isHoliday) {
                        matrix[day].status = "alpa";
                        summary.alpa++;
                        summary.total_tidak_hadir++;
                    } else {
                        summary.no_data++;
                    }

                    matrix[day].is_rest_day = isSunday;
                    matrix[day].is_holiday = isHoliday;
                }
            }
        } catch (e) {
            console.error("[EmployeeDetailService] Failed to get daily attendance:", e);
        }

        const holidayList = Object.entries(holidays).map(([day, info]) => ({
            day: parseInt(day),
            ...info
        }));

        return { matrix, summary, holidays: holidayList };
    }

    // --- Daily Overtime ---
    public async getDailyOvertime(empCode: string, month: number, year: number): Promise<{
        matrix: Record<number, OvertimeDay>;
        list: any[];
        summary: { total_hours: number; total_amount: number; total_days: number };
    }> {
        const daysInMonth = new Date(year, month, 0).getDate();
        const startDate = `${year}-${month.toString().padStart(2, "0")}-01`;
        const endDate = `${year}-${month.toString().padStart(2, "0")}-${daysInMonth}`;

        // Initialize matrix
        const matrix: Record<number, OvertimeDay> = {};
        for (let day = 1; day <= daysInMonth; day++) {
            matrix[day] = {
                date: `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`,
                has_overtime: false,
                hours: 0,
                amount: 0,
                details: []
            };
        }

        let totalHours = 0;
        let totalAmount = 0;
        const overtimeList: any[] = [];

        try {
            // Use LemburCalculator for robust fetching (UNION ALL) and detailed breakdown
            const lemburResult = await lemburCalculator.calculate(empCode, month, year);

            for (const record of lemburResult.records) {
                const day = record.trx_date.getDate();
                const hours = record.hours;
                const dbAmount = record.raw_amount || 0;
                const formulaAmount = record.breakdown?.total_amount || 0;

                matrix[day].has_overtime = true;
                matrix[day].hours += hours;
                matrix[day].amount += dbAmount;
                matrix[day].amount_formula = (matrix[day].amount_formula || 0) + formulaAmount;

                const detailObj = {
                    hours,
                    amount: dbAmount,
                    rate: record.raw_rate || 0,
                    task_code: record.task_code || "",
                    day_type: record.day_type ? getDayTypeDisplayName(record.day_type) : "-",
                    formula_amount: formulaAmount,
                    shift_code: record.shift_code || ""
                };

                matrix[day].details.push(detailObj);

                overtimeList.push({
                    date: record.trx_date.toISOString().substring(0, 10),
                    day,
                    hours,
                    amount: dbAmount,
                    amount_server: dbAmount,
                    amount_formula: formulaAmount,
                    rate: record.raw_rate || 0,
                    task_code: record.task_code || "",
                    day_type: detailObj.day_type
                });

                totalHours += hours;
                totalAmount += dbAmount;
            }
        } catch (e) {
            console.error("[EmployeeDetailService] Failed to get daily overtime:", e);
        }

        const totalDays = Object.values(matrix).filter(d => d.has_overtime).length;

        return {
            matrix,
            list: overtimeList,
            summary: { total_hours: totalHours, total_amount: totalAmount, total_days: totalDays }
        };
    }

    // --- Complete Checkroll ---
    public async getEmployeeCheckroll(rawEmpCode: string, month: number, year: number): Promise<any> {
        const empCode = (rawEmpCode || '').trim().toUpperCase();
        console.log(`[EmployeeDetailService] getEmployeeCheckroll request for '${rawEmpCode}' -> Normalized: '${empCode}'`);

        const employeeInfo = await this.getEmployeeInfo(empCode);
        if (!employeeInfo) {
            return { emp_code: empCode, error: "Employee not found" };
        }

        const attendanceData = await this.getDailyAttendance(empCode, month, year);
        const overtimeData = await this.getDailyOvertime(empCode, month, year);

        // Fetch calculated payroll data
        let payrollData = null;
        let debugInfo: any = { error: "Not attempted" };

        try {
            // Pass empCode as specificEmpCode (5th argument) to use optimized single-employee fetch
            // Use SERVER_PROFILE_2 for payroll data
            const payrollResult = await dataExtractorService.extractPayrollData(month, year, "ALL", undefined, empCode);
            // Filter for this specific employee (handle whitespace)
            const targetNik = empCode.trim().toUpperCase();

            debugInfo = {
                target_nik: targetNik,
                rows_fetched: payrollResult?.data_rows?.length || 0,
                available_niks: payrollResult?.data_rows?.map(r => r.nik || 'N/A').slice(0, 5)
            };

            const empPayroll = payrollResult.data_rows.find(row =>
                (row.nik || '').trim().toUpperCase() === targetNik
            );
            if (empPayroll) {
                payrollData = empPayroll;
                console.log(`[EmployeeDetailService] Payroll Data Found for '${empCode}' (Rows: ${payrollResult.data_rows.length})`);
                debugInfo.found = true;
            } else {
                const availableNiks = payrollResult.data_rows.map(r => `'${r.nik}'`).join(", ");
                console.warn(`[EmployeeDetailService] Payroll row not found for ${empCode}. Target: '${targetNik}'. Available: [${availableNiks}]`);
                console.warn(`[EmployeeDetailService] ExtractPayrollData returned ${payrollResult.data_rows.length} rows.`);
                debugInfo.found = false;
            }
        } catch (e: any) {
            console.error("[EmployeeDetailService] Failed to extract payroll data:", e);
            debugInfo.error = e.message || String(e);
        }

        return {
            emp_code: empCode,
            month,
            year,
            employee: employeeInfo,
            attendance: attendanceData,
            overtime: overtimeData,
            payroll_data: payrollData,
            debug_info: debugInfo
        };
    }
}

export const employeeDetailService = EmployeeDetailService.getInstance();
