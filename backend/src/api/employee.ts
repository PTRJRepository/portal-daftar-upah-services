import { Elysia, t } from "elysia";
import { AuthService } from "../services/authService";
import { employeeDetailService } from "../services/employeeDetailService";
import { lemburCalculator } from "../services/lemburCalculator";
import { employeeRepository } from "../services/employeeRepository";
import { dataExtractorService } from "../services/dataExtractorService";
import { User } from "../types/user";

const authService = AuthService.getInstance();

// Helper to get user from header
async function getUserFromHeader(headers: Record<string, string | undefined>): Promise<User | null> {
    const authHeader = headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    const token = authHeader.split(" ")[1];
    return authService.verifyToken(token);
}

export const employeeRoutes = new Elysia({ prefix: "/payroll/employee" })
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
    // ========================
    // STATIC ROUTES FIRST (before parameterized routes)
    // ========================

    // --- List Employees by Gang ---
    .get("/list", async ({ query }) => {
        const employees = await employeeRepository.list({
            gangCode: query.gang_code || undefined,
            division: query.division || undefined,
            skip: parseInt(query.skip || "0"),
            limit: parseInt(query.limit || "100")
        });
        return { count: employees.length, data: employees };
    }, {
        query: t.Object({
            gang_code: t.Optional(t.String()),
            division: t.Optional(t.String()),
            skip: t.Optional(t.String()),
            limit: t.Optional(t.String())
        })
    })
    // --- Search Employees ---
    .get("/search", async ({ query }) => {
        const employees = await employeeRepository.search(
            query.q || "",
            parseInt(query.limit || "50")
        );
        return { count: employees.length, data: employees };
    }, {
        query: t.Object({
            q: t.String(),
            limit: t.Optional(t.String())
        })
    })
    // --- Get Available Gangs ---
    .get("/available-gangs", async () => {
        const gangs = await employeeRepository.getAvailableGangs();
        return { count: gangs.length, gangs };
    })
    // --- Batch Checkroll (Multiple Employees) - MUST BE BEFORE /:emp_code routes ---
    // OPTIMIZED: Fetch all payroll data once, then filter for requested employees
    // This prevents SQL Gateway timeout from too many parallel queries
    .get("/batch-checkroll", async ({ query, set }) => {
        try {
            const empCodes = (query.emp_codes || "").split(",").filter((code: string) => code.trim() !== "");
            const month = parseInt(query.month);
            const year = parseInt(query.year);

            if (empCodes.length === 0) {
                set.status = 400;
                return { error: "No employee codes provided" };
            }

            if (isNaN(month) || isNaN(year)) {
                set.status = 400;
                return { error: "Invalid month or year" };
            }

            const startTime = Date.now();
            const results = [];
            const errors = [];
            const notFound = [];

            // OPTIMIZATION: Get division from first employee's gang code
            // Then fetch ALL payroll data for that division in ONE call
            let allPayrollData: any[] = [];
            let division = "ALL"; // Default to ALL if not specified

            try {
                // First, get employee info to determine division
                const empInfoResults = await Promise.all(
                    empCodes.map(code => employeeDetailService.getEmployeeInfo(code.trim()))
                );

                // Get unique divisions from employees
                const divisions = new Set<string>();
                empInfoResults.forEach(info => {
                    if (info) {
                        // Extract division from gang code (e.g., "H1H1" -> "H1")
                        const gangCode = info.gang_code || "";
                        const div = gangCode.substring(0, 2) || "ALL";
                        divisions.add(div);
                    }
                });

                // Fetch payroll data for each division needed
                for (const div of divisions) {
                    const payrollResult = await dataExtractorService.extractPayrollData(
                        month, year, div, undefined, undefined, "SERVER_PROFILE_2"
                    );
                    if (payrollResult?.data_rows) {
                        allPayrollData = allPayrollData.concat(payrollResult.data_rows);
                    }
                }

                console.log(`[Batch Checkroll] Fetched ${allPayrollData.length} payroll rows for divisions: [${Array.from(divisions).join(", ")}]`);
            } catch (e: any) {
                console.error("[Batch Checkroll] Failed to fetch payroll data:", e);
                // Continue with empty data - individual employee fetch may still work
            }

            // Normalize requested employee codes
            const normalizedEmpCodes = new Set(
                empCodes.map(code => code.trim().toUpperCase())
            );

            // Build results from fetched payroll data
            for (const empCode of empCodes) {
                const normalizedCode = empCode.trim().toUpperCase();
                const payrollRow = allPayrollData.find(row =>
                    (row.nik || '').trim().toUpperCase() === normalizedCode
                );

                if (payrollRow) {
                    // Get additional employee details
                    const employeeInfo = await employeeDetailService.getEmployeeInfo(normalizedCode);
                    const attendanceData = await employeeDetailService.getDailyAttendance(normalizedCode, month, year);
                    const overtimeData = await employeeDetailService.getDailyOvertime(normalizedCode, month, year);

                    results.push({
                        emp_code: normalizedCode,
                        month,
                        year,
                        employee: employeeInfo,
                        attendance: attendanceData,
                        overtime: overtimeData,
                        payroll_data: payrollRow,
                        debug_info: { found: true, source: "batch_fetch" }
                    });
                } else {
                    // Employee not found in payroll data - try individual fetch as fallback
                    try {
                        console.log(`[Batch Checkroll] Employee ${normalizedCode} not in batch data, fetching individually...`);
                        const individualResult = await employeeDetailService.getEmployeeCheckroll(normalizedCode, month, year);
                        if (!individualResult.error && individualResult.payroll_data) {
                            results.push(individualResult);
                        } else {
                            notFound.push({ empCode: normalizedCode, reason: "No payroll data" });
                        }
                    } catch (e: any) {
                        notFound.push({ empCode: normalizedCode, reason: e.message });
                    }
                }
            }

            return {
                success: true,
                data: results,
                errors: errors.length > 0 ? errors : undefined,
                not_found: notFound.length > 0 ? notFound : undefined,
                meta: {
                    requested: empCodes.length,
                    successful: results.length,
                    failed: errors.length,
                    not_found: notFound.length,
                    execution_time_ms: Date.now() - startTime
                }
            };
        } catch (e: any) {
            set.status = 500;
            return { error: e.message };
        }
    }, {
        query: t.Object({
            emp_codes: t.String(),
            month: t.String(),
            year: t.String()
        })
    })

    // ========================
    // PARAMETERIZED ROUTES (after static routes)
    // ========================

    // --- Get Employee by NIK ---
    .get("/by-nik/:nik", async ({ params, set }) => {
        const employee = await employeeRepository.getByNik(params.nik);
        if (!employee) {
            set.status = 404;
            return { error: "Employee not found" };
        }
        return employee;
    })
    // --- Checkroll (Full Implementation) ---
    .get("/:emp_code/checkroll", async ({ params, query, set }) => {
        try {
            const empCode = params.emp_code;
            const month = parseInt(query.month);
            const year = parseInt(query.year);

            const result = await employeeDetailService.getEmployeeCheckroll(empCode, month, year);
            console.log("[API DEBUG] Checkroll Result Keys:", Object.keys(result));
            if (result.debug_info) {
                console.log("[API DEBUG] Debug Info:", JSON.stringify(result.debug_info));
            } else {
                console.log("[API DEBUG] WARNING: debug_info MISSING in result!");
            }

            if (result.error) {
                set.status = 404;
                return result;
            }

            return result;
        } catch (e: any) {
            set.status = 500;
            return { error: e.message };
        }
    }, {
        query: t.Object({
            month: t.String(),
            year: t.String(),
            div: t.Optional(t.String())
        })
    })
    // --- Attendance Detail (Full Implementation) ---
    .get("/:emp_code/attendance/detail", async ({ params, query, set }) => {
        try {
            const empCode = params.emp_code;
            const month = parseInt(query.month);
            const year = parseInt(query.year);

            const result = await employeeDetailService.getDailyAttendance(empCode, month, year);
            return {
                emp_code: empCode,
                month,
                year,
                ...result
            };
        } catch (e: any) {
            set.status = 500;
            return { error: e.message };
        }
    }, {
        query: t.Object({
            month: t.String(),
            year: t.String(),
            div: t.Optional(t.String())
        })
    })
    // --- Overtime Detail (Full Implementation) ---
    .get("/:emp_code/overtime/detail", async ({ params, query, set }) => {
        try {
            const empCode = params.emp_code;
            const month = parseInt(query.month);
            const year = parseInt(query.year);

            const result = await employeeDetailService.getDailyOvertime(empCode, month, year);
            return {
                emp_code: empCode,
                month,
                year,
                ...result
            };
        } catch (e: any) {
            set.status = 500;
            return { error: e.message };
        }
    }, {
        query: t.Object({
            month: t.String(),
            year: t.String(),
            div: t.Optional(t.String())
        })
    })
    // --- Lembur Calculation (New) ---
    .get("/:emp_code/lembur", async ({ params, query, set }) => {
        try {
            const empCode = params.emp_code;
            const month = parseInt(query.month);
            const year = parseInt(query.year);

            const result = await lemburCalculator.calculate(empCode, month, year);
            return result;
        } catch (e: any) {
            set.status = 500;
            return { error: e.message };
        }
    }, {
        query: t.Object({
            month: t.String(),
            year: t.String()
        })
    })
    // --- Employee History (Multiple Periods) ---
    .get("/:emp_code/history", async ({ params, query, set }) => {
        try {
            const empCode = params.emp_code;
            const requestedMonths = parseInt(query.months || "12"); // Number of months to fetch
            const includeCurrent = query.include_current !== "false";

            // Get current period first
            const { currentPeriodService } = await import("../services/currentPeriodService");
            const currentPeriod = await currentPeriodService.getCurrentPeriod();

            // Calculate periods to fetch
            // When includeCurrent is false, we need to fetch requestedMonths + 1 to exclude current period
            // and still get the full requested number of historical months
            const monthsToFetch = includeCurrent ? requestedMonths : requestedMonths + 1;

            const periods = [];
            let startMonth = currentPeriod.month;
            let startYear = currentPeriod.year;

            for (let i = 0; i < monthsToFetch; i++) {
                let m = startMonth - i;
                let y = startYear;

                while (m < 1) {
                    m += 12;
                    y -= 1;
                }

                // Only add historical periods if include_current is false
                if (includeCurrent || !(m === currentPeriod.month && y === currentPeriod.year)) {
                    periods.push({ month: m, year: y });
                }
            }

            // Fetch data for each period
            const results = [];

            // Import wagesService for fetching PR_WAGES data
            const { wagesService } = await import("../services/wagesService");

            for (const period of periods) {
                try {
                    // Fetch payroll checkroll data
                    const result = await employeeDetailService.getEmployeeCheckroll(
                        empCode,
                        period.month,
                        period.year
                    );

                    // Fetch PR_WAGES data for actual upah bersih
                    const wagesData = await wagesService.getWagesByEmployee(
                        empCode,
                        period.month,
                        period.year
                    );

                    if (!result.error && result.payroll_data) {
                        const data = result.payroll_data;

                        // Spread ALL payroll_data fields (PayrollRow has 80+ fields)
                        // This ensures frontend gets complete daftar upah data including:
                        // PPH21, BPJS breakdown, pay rates, koreksi, premi detail, etc.
                        results.push({
                            // Period metadata
                            period_month: period.month,
                            period_year: period.year,
                            period_label: `${getMonthName(period.month)} ${period.year}`,

                            // Spread ALL payroll data fields
                            ...data,

                            // Override/ensure key identity fields
                            emp_code: empCode,
                            nik: data.nik || empCode,
                            nama: data.nama || data.emp_name || '-',

                            // Attendance summary from checkroll
                            attendance_summary: result.attendance?.summary || null,
                            cuti_tahunan_hari: data.cuti_tahunan_hari || result.attendance?.summary?.cuti_tahunan || 0,
                            cuti_sakit_haid_hari: data.cuti_sakit_haid_hari || result.attendance?.summary?.cuti_sakit || 0,
                            cuti_minggu_hari: data.cuti_minggu_hari || result.attendance?.summary?.cuti_minggu || 0,
                            cuti_nasional_hari: data.cuti_nasional_hari || result.attendance?.summary?.libur || 0,

                            // Overtime summary from checkroll
                            overtime_summary: result.overtime?.summary || null,

                            // Harvest summary from checkroll
                            harvest_summary: result.harvest?.summary || null,

                            // PR_WAGES data (actual paid amount from PR_WAGES table)
                            wages_data: wagesData ? {
                                wages_no: wagesData.wages_no,
                                payment_date: wagesData.payment_date,
                                payment_status: wagesData.payment_status,
                                upah_bersih_pr_wages: wagesData.upah_bersih,  // Actual paid amount
                                gaji_pokok_pr_wages: wagesData.gaji_pokok,
                                total_tunjangan_pr_wages: wagesData.total_tunjangan,
                                total_premi_pr_wages: wagesData.total_premi,
                                total_potongan_pr_wages: wagesData.total_potongan,
                                jumlah_hk_pr_wages: wagesData.jumlah_hk,
                                upah_dasar_pr_wages: wagesData.upah_dasar,
                            } : null,
                        });
                    }
                } catch (err) {
                    console.error(`[EmployeeHistory] Failed to fetch period ${period.month}/${period.year}:`, err);
                    // Continue with next period
                }
            }

            // Sort by period (most recent first)
            results.sort((a, b) => {
                const periodA = a.period_year * 100 + a.period_month;
                const periodB = b.period_year * 100 + b.period_month;
                return periodB - periodA;
            });

            return {
                success: true,
                emp_code: empCode,
                count: results.length,
                data: results,
                current_period: currentPeriod
            };
        } catch (e: any) {
            console.error("[EmployeeHistory] Error:", e);
            set.status = 500;
            return { error: e.message };
        }
    }, {
        query: t.Object({
            months: t.Optional(t.String()),
            include_current: t.Optional(t.String())
        })
    });

// Helper function for month name
function getMonthName(month: number): string {
    const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return months[month - 1] || '';
}
