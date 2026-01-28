import { Elysia, t } from "elysia";
import { AuthService } from "../services/authService";
import { employeeDetailService } from "../services/employeeDetailService";
import { lemburCalculator } from "../services/lemburCalculator";
import { employeeRepository } from "../services/employeeRepository";
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
    // --- Get Employee by NIK ---
    .get("/by-nik/:nik", async ({ params, set }) => {
        const employee = await employeeRepository.getByNik(params.nik);
        if (!employee) {
            set.status = 404;
            return { error: "Employee not found" };
        }
        return employee;
    })
    // --- Get Available Gangs ---
    .get("/available-gangs", async () => {
        const gangs = await employeeRepository.getAvailableGangs();
        return { count: gangs.length, gangs };
    });
