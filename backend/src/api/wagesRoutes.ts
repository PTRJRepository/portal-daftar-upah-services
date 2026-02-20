/**
 * Wages Routes
 * 
 * API endpoints untuk operasi wages comparison:
 * - GET /payroll/wages/period/:month/:year - Get wages data for period
 * - GET /payroll/wages/employee/:empCode/history - Get employee wages history
 * - GET /payroll/wages/comparison/:month/:year - Get comparison data
 * - GET /payroll/wages/periods/available - Get available periods
 */

import { Elysia, t } from "elysia";
import { wagesService } from "../services/wagesService";
import { dataExtractorService } from "../services/dataExtractorService";
import { AuthService } from "../services/authService";
import { User } from "../types/user";

const authService = AuthService.getInstance();

// Helper to get user from header
async function getUserFromHeader(headers: Record<string, string | undefined>): Promise<User | null> {
    const authHeader = headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    const token = authHeader.split(" ")[1];
    return authService.verifyToken(token);
}

// Helper to get month name
function getMonthName(month: number): string {
    const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return months[month - 1] || '';
}

export const wagesRoutes = new Elysia({ prefix: "/payroll/wages" })
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
    // GET AVAILABLE PERIODS
    // ========================
    .get("/periods/available", async () => {
        try {
            const periods = await wagesService.getAvailableWagesPeriods();
            return {
                success: true,
                count: periods.length,
                data: periods
            };
        } catch (e: any) {
            console.error("[WagesRoutes] Error fetching available periods:", e);
            return { success: false, error: e.message, data: [] };
        }
    })

    // ========================
    // GET WAGES BY PERIOD
    // ========================
    .get("/period/:month/:year", async ({ params, query, set }) => {
        try {
            const month = parseInt(params.month);
            const year = parseInt(params.year);
            const divisionCode = query.division as string | undefined;

            if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
                set.status = 400;
                return { error: "Invalid month or year" };
            }

            const wages = await wagesService.getWagesByPeriod(month, year, divisionCode);

            return {
                success: true,
                period: {
                    month,
                    year,
                    label: `${getMonthName(month)} ${year}`
                },
                count: wages.length,
                data: wages
            };
        } catch (e: any) {
            console.error("[WagesRoutes] Error fetching wages by period:", e);
            set.status = 500;
            return { error: e.message };
        }
    }, {
        query: t.Object({
            division: t.Optional(t.String())
        })
    })

    // ========================
    // GET EMPLOYEE WAGES HISTORY
    // ========================
    .get("/employee/:empCode/history", async ({ params, query, set }) => {
        try {
            const empCode = params.empCode;
            const months = parseInt(query.months || "12");

            const history = await wagesService.getEmployeeWagesHistory(empCode, months);

            return {
                success: true,
                emp_code: empCode,
                count: history.length,
                data: history
            };
        } catch (e: any) {
            console.error("[WagesRoutes] Error fetching employee wages history:", e);
            set.status = 500;
            return { error: e.message };
        }
    }, {
        query: t.Object({
            months: t.Optional(t.String())
        })
    })

    // ========================
    // GET WAGES COMPARISON (Main Endpoint)
    // ========================
    .get("/comparison/:month/:year", async ({ params, query, set }) => {
        try {
            const month = parseInt(params.month);
            const year = parseInt(params.year);
            const divisionCode = query.division as string | undefined;
            const gangCode = query.gang_code as string | undefined;

            if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
                set.status = 400;
                return { error: "Invalid month or year" };
            }

            // Step 1: Get payroll data (daftar upah) for the period
            console.log(`[WagesComparison] Fetching payroll data for ${month}/${year}...`);
            const payrollResult = await dataExtractorService.extractPayrollData(
                month,
                year,
                divisionCode || 'ALL',
                gangCode,
                undefined,
                "SERVER_PROFILE_2"
            );

            if (!payrollResult || !payrollResult.data_rows) {
                set.status = 404;
                return { 
                    error: "No payroll data found for this period",
                    period: { month, year, label: `${getMonthName(month)} ${year}` }
                };
            }

            const payrollData = payrollResult.data_rows;
            console.log(`[WagesComparison] Found ${payrollData.length} payroll records`);

            // Step 2: Compare with wages
            console.log(`[WagesComparison] Comparing with wages data...`);
            const comparison = await wagesService.comparePayrollWithWages(
                payrollData,
                month,
                year,
                divisionCode
            );

            return {
                success: true,
                period: {
                    month,
                    year,
                    label: `${getMonthName(month)} ${year}`
                },
                summary: comparison.summary,
                data: comparison.data
            };
        } catch (e: any) {
            console.error("[WagesRoutes] Error in wages comparison:", e);
            set.status = 500;
            return { error: e.message };
        }
    }, {
        query: t.Object({
            division: t.Optional(t.String()),
            gang_code: t.Optional(t.String())
        })
    })

    // ========================
    // GET SINGLE EMPLOYEE COMPARISON
    // ========================
    .get("/comparison/employee/:empCode", async ({ params, query, set }) => {
        try {
            const empCode = params.empCode;
            const month = parseInt(query.month);
            const year = parseInt(query.year);

            if (isNaN(month) || isNaN(year)) {
                set.status = 400;
                return { error: "Invalid month or year" };
            }

            // Get employee payroll data
            const payrollResult = await dataExtractorService.extractPayrollData(
                month,
                year,
                'ALL',
                undefined,
                undefined,
                "SERVER_PROFILE_2"
            );

            // Find the specific employee
            const employeePayroll = payrollResult?.data_rows?.find(
                (row: any) => (row.nik || row.emp_code || '').toUpperCase() === empCode.toUpperCase()
            );

            if (!employeePayroll) {
                set.status = 404;
                return { error: "Employee not found in payroll data" };
            }

            // Get wages for this employee
            const wages = await wagesService.getWagesByEmployee(empCode, month, year);

            // Build comparison
            const daftarUpah = {
                jumlah_hk: Number(employeePayroll.jumlah_hk) || 0,
                gaji_pokok: Number(employeePayroll.gaji_pokok) || 0,
                total_tunjangan: Number(employeePayroll.total_tunjangan) || 0,
                total_premi: Number(employeePayroll.total_premi) || 0,
                total_potongan: Number(employeePayroll.total_potongan) || 0,
                upah_bersih: Number(employeePayroll.upah_bersih) || 0
            };

            const wagesData = wages ? {
                wages_no: wages.wages_no,
                wages_date: wages.payment_date,
                jumlah_hk: wages.jumlah_hk,
                upah_bersih: wages.upah_bersih,
                payment_status: wages.payment_status
            } : null;

            const hkDiff = wages ? Math.abs(daftarUpah.jumlah_hk - wages.jumlah_hk) : 0;
            const amountDiff = wages ? Math.abs(daftarUpah.upah_bersih - wages.upah_bersih) : 0;

            let status: 'MATCH' | 'MINOR_DIFF' | 'MAJOR_DIFF' | 'NO_WAGES';
            if (!wages) {
                status = 'NO_WAGES';
            } else if (hkDiff <= 0.5 && amountDiff <= 1000) {
                status = 'MATCH';
            } else if (amountDiff <= 10000) {
                status = 'MINOR_DIFF';
            } else {
                status = 'MAJOR_DIFF';
            }

            return {
                success: true,
                emp_code: empCode,
                period: {
                    month,
                    year,
                    label: `${getMonthName(month)} ${year}`
                },
                employee: {
                    emp_code: empCode,
                    nik: employeePayroll.nik,
                    nama: employeePayroll.nama || employeePayroll.emp_name,
                    gang_code: employeePayroll.gang_code,
                    division_code: employeePayroll.division_code
                },
                daftar_upah: daftarUpah,
                wages: wagesData,
                comparison: {
                    hk_match: wages ? hkDiff <= 0.5 : false,
                    amount_match: wages ? amountDiff <= 1000 : false,
                    hk_difference: wages ? daftarUpah.jumlah_hk - wages.jumlah_hk : 0,
                    amount_difference: wages ? daftarUpah.upah_bersih - wages.upah_bersih : 0,
                    status
                }
            };
        } catch (e: any) {
            console.error("[WagesRoutes] Error in employee comparison:", e);
            set.status = 500;
            return { error: e.message };
        }
    }, {
        query: t.Object({
            month: t.String(),
            year: t.String()
        })
    })

    // ========================
    // GET WAGES VERIFICATION SUMMARY
    // ========================
    .get("/verification/summary/:month/:year", async ({ params, query, set }) => {
        try {
            const month = parseInt(params.month);
            const year = parseInt(params.year);
            const divisionCode = query.division as string | undefined;

            if (isNaN(month) || isNaN(year)) {
                set.status = 400;
                return { error: "Invalid month or year" };
            }

            // Get payroll data
            const payrollResult = await dataExtractorService.extractPayrollData(
                month,
                year,
                divisionCode || 'ALL',
                undefined,
                undefined,
                "SERVER_PROFILE_2"
            );

            const payrollData = payrollResult?.data_rows || [];

            // Get comparison
            const comparison = await wagesService.comparePayrollWithWages(
                payrollData,
                month,
                year,
                divisionCode
            );

            // Calculate additional metrics
            const totalUpahBersih = payrollData.reduce((sum: number, p: any) => sum + (Number(p.upah_bersih) || 0), 0);
            const totalWagesPaid = comparison.data
                .filter(c => c.wages)
                .reduce((sum, c) => sum + (c.wages?.upah_bersih || 0), 0);

            return {
                success: true,
                period: {
                    month,
                    year,
                    label: `${getMonthName(month)} ${year}`
                },
                summary: {
                    ...comparison.summary,
                    total_upah_bersih_calculated: totalUpahBersih,
                    total_wages_paid: totalWagesPaid,
                    verification_rate: comparison.summary.total_employees > 0 
                        ? ((comparison.summary.matched / comparison.summary.total_employees) * 100).toFixed(2) + '%'
                        : '0%',
                    data_completeness: comparison.summary.total_employees > 0
                        ? (((comparison.summary.total_employees - comparison.summary.no_wages_data) / comparison.summary.total_employees) * 100).toFixed(2) + '%'
                        : '0%'
                },
                breakdown: {
                    by_status: {
                        match: comparison.data.filter(c => c.comparison.status === 'MATCH'),
                        minor_diff: comparison.data.filter(c => c.comparison.status === 'MINOR_DIFF'),
                        major_diff: comparison.data.filter(c => c.comparison.status === 'MAJOR_DIFF'),
                        no_wages: comparison.data.filter(c => c.comparison.status === 'NO_WAGES')
                    }
                }
            };
        } catch (e: any) {
            console.error("[WagesRoutes] Error in verification summary:", e);
            set.status = 500;
            return { error: e.message };
        }
    }, {
        query: t.Object({
            division: t.Optional(t.String())
        })
    });
