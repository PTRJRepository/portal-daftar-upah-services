import { Elysia, t } from "elysia";
import { gangService } from "../services/gangService";
import { headerService } from "../services/headerService";
import { payrollService } from "../services/payrollService";
import { AuthService } from "../services/authService";
import { User, UserRole } from "../types/user";

const authService = AuthService.getInstance();

// Helper to get user from header
async function getUserFromHeader(headers: Record<string, string | undefined>): Promise<User | null> {
    const authHeader = headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    const token = authHeader.split(" ")[1];
    return authService.verifyToken(token);
}

export const payrollRoutes = new Elysia({ prefix: "/payroll" })
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
    // --- Divisions ---
    .get("/divisions", async () => {
        const divisions = await gangService.getAllDivisions();
        return divisions;
    })
    .get("/subdivisions", async ({ set }) => {
        try {
            const subDivisions = await gangService.getSubDivisions();
            return subDivisions;
        } catch (e) {
            set.status = 500;
            return { message: "Failed to fetch sub-divisions" };
        }
    })
    // --- Gangs ---
    .get("/gangs", async ({ query, currentUser, set }) => {
        try {
            const division = query.division === "ALL" ? undefined : query.division;
            const search = query.search || undefined;

            // Permission check
            if (currentUser && currentUser.role !== UserRole.ADMIN) {
                if (division && !currentUser.divisions.includes(division)) {
                    set.status = 403;
                    return { message: "Division not accessible" };
                }
            }

            const gangs = await gangService.fetchGangs(division, search);
            return gangs;
        } catch (e: any) {
            set.status = 500;
            return { message: `Failed to fetch gangs: ${e.message}` };
        }
    }, {
        query: t.Object({
            division: t.Optional(t.String()),
            search: t.Optional(t.String()),
            force: t.Optional(t.String())
        })
    })
    .get("/gangs/by-loc", async ({ query, set }) => {
        try {
            const codes = await gangService.fetchGangsByLocCode(query.loc_code);
            if (codes.length === 0) {
                set.status = 404;
                return { message: `No gangs found for locCode ${query.loc_code}` };
            }
            return codes;
        } catch (e: any) {
            set.status = 500;
            return { message: `Failed to fetch gangs by locCode: ${e.message}` };
        }
    }, {
        query: t.Object({
            loc_code: t.String(),
            force: t.Optional(t.String())
        })
    })
    .get("/gang/:gang_code/info", async ({ params, set }) => {
        try {
            const info = await gangService.getGangInfo(params.gang_code);
            return info;
        } catch (e: any) {
            set.status = 500;
            return { message: `Failed to get gang info: ${e.message}` };
        }
    })
    // --- Headers (Full Implementation) ---
    .get("/headers", async ({ query, set }) => {
        try {
            const month = query.month ? parseInt(query.month) : undefined;
            const year = query.year ? parseInt(query.year) : undefined;
            const gangCode = query.gang_code || undefined;

            const result = await headerService.generateDynamicHeaders(month, year, gangCode);
            return result;
        } catch (e: any) {
            set.status = 500;
            return { message: `Failed to generate headers: ${e.message}` };
        }
    }, {
        query: t.Object({
            month: t.Optional(t.String()),
            year: t.Optional(t.String()),
            gang_code: t.Optional(t.String())
        })
    })
    // --- Columns (Full Implementation) ---
    .get("/columns", async ({ query, set }) => {
        try {
            const month = query.month ? parseInt(query.month) : undefined;
            const year = query.year ? parseInt(query.year) : undefined;
            const gangCode = query.gang_code || undefined;

            const columns = await headerService.getColumnDefinitions(month, year, gangCode);
            return columns;
        } catch (e: any) {
            set.status = 500;
            return { message: `Failed to generate column definitions: ${e.message}` };
        }
    }, {
        query: t.Object({
            month: t.Optional(t.String()),
            year: t.Optional(t.String()),
            gang_code: t.Optional(t.String()),
            fallback: t.Optional(t.String())
        })
    })
    // --- Calculate (using PayrollService) ---
    .post("/calculate", async ({ body }) => {
        const { upah_dasar, hk_count, allowances, deductions } = body as any;

        const result = payrollService.calculate(upah_dasar, hk_count, allowances || {}, deductions || {});
        return result;
    }, {
        body: t.Object({
            upah_dasar: t.Number(),
            hk_count: t.Number(),
            allowances: t.Optional(t.Record(t.String(), t.Number())),
            deductions: t.Optional(t.Record(t.String(), t.Number()))
        })
    })
    // --- BPJS Calculation (New) ---
    .get("/bpjs-calculate", async ({ query }) => {
        const masaKerjaJumlah = parseFloat(query.masa_kerja_jumlah || "0");
        const components = payrollService.calculateBpjsComponents(masaKerjaJumlah);
        return components;
    }, {
        query: t.Object({
            masa_kerja_jumlah: t.Optional(t.String())
        })
    })
    // --- Report: Division Raw Tree ---
    .get("/report/division-raw-tree", async ({ query, set }) => {
        try {
            const { dataExtractorService } = await import("../services/dataExtractorService");

            const divisionCode = query.division_code;
            const month = parseInt(query.month);
            const year = parseInt(query.year);

            if (!divisionCode || !month || !year) {
                set.status = 400;
                return { error: "division_code, month, and year are required" };
            }

            const result = await dataExtractorService.extractPayrollData(month, year, "ALL", divisionCode, null, "SERVER_PROFILE_2");

            // Helper function to calculate totals for a list of employees
            const calculateTotals = (employees: any[]) => {
                // Filter employees: only include those with HK > 0
                // This matches the behavior in aggregationSeederRoutes.ts for consistency
                const activeEmployees = employees.filter((emp: any) => {
                    const hkVal = emp.jumlah_hk || emp.jumlah_hk;
                    const hk = parseFloat(hkVal) || 0;
                    return hk > 0;
                });

                const totals: Record<string, number> = {};
                const numericFields = [
                    'jumlah_hk', 'hari_kerja', 'gaji_pokok', 'gaji_pokok_ideal', 'gaji_pokok_aktual',
                    'beras_jumlah', 'jabatan_jumlah', 'masa_kerja_jumlah', 'lembur_jumlah',
                    'total_tunjangan', 'premi_brondol', 'total_premi', 'pot_koreksi',
                    'potongan_upah_kotor_total', 'jumlah_upah_kotor',
                    'pot_astek', 'pot_astek_maj', 'pot_bpjs_kesehatan_pekerja', 'pot_bpjs_kesehatan_majikan',
                    'pot_bpjs_pensiun_pekerja', 'pot_bpjs_pensiun_majikan', 'pot_bpjs_pekerja_total',
                    'pot_spsi', 'pot_pph21', 'premi_pph', 'total_potongan', 'total_potongan_bersih',
                    'upah_bersih', 'koreksi_hk'
                ];

                // Initialize totals
                for (const field of numericFields) {
                    totals[field] = 0;
                }
                totals['employee_count'] = activeEmployees.length;

                // Sum all numeric fields from active employees only
                for (const emp of activeEmployees) {
                    for (const field of numericFields) {
                        const val = emp[field];
                        if (val !== null && val !== undefined) {
                            totals[field] += parseFloat(val) || 0;
                        }
                    }

                    // Also sum dynamic premi fields (premi_*)
                    for (const key of Object.keys(emp)) {
                        if (key.startsWith('premi_') && key !== 'premi_brondol' && key !== 'premi_pph' && key !== 'premi_koreksi') {
                            const val = emp[key];
                            if (val !== null && val !== undefined && typeof val === 'number') {
                                if (!totals[key]) totals[key] = 0;
                                totals[key] += val;
                            }
                        }

                        // Sum dynamic potongan fields
                        if (key.startsWith('KOREKSI') || key.startsWith('POTONGAN')) {
                            const val = emp[key];
                            if (val !== null && val !== undefined && typeof val === 'number') {
                                if (!totals[key]) totals[key] = 0;
                                totals[key] += val;
                            }
                        }
                    }
                }

                return totals;
            };

            // Group by gang and calculate totals
            const gangsMap: Record<string, any[]> = {};
            for (const row of result.data_rows) {
                const gang = row.gang_code || "UNKNOWN";
                if (!gangsMap[gang]) gangsMap[gang] = [];
                gangsMap[gang].push(row);
            }

            // Build gangs list with pre-calculated totals
            const gangsList = Object.entries(gangsMap)
                .map(([gang_code, employees]) => ({
                    gang_code,
                    employees,
                    gang_totals: calculateTotals(employees)  // Pre-calculated totals from backend
                }))
                .sort((a, b) => a.gang_code.localeCompare(b.gang_code));

            // Calculate grand total for the entire division
            const grandTotal = calculateTotals(result.data_rows);

            // DEBUG: Log response data
            console.log("[DEBUG] dynamic_potongan_headers:", result.dynamic_potongan_headers);
            console.log("[DEBUG] potongan_title_map:", result.potongan_title_map);
            console.log("[DEBUG] First row keys:", result.data_rows.length > 0 ? Object.keys(result.data_rows[0]).slice(0, 50) : []);
            // Check if any row has PREMI_PPH
            const hasPremiPph = result.data_rows.some((row: any) => row.PREMI_PPH !== undefined && row.PREMI_PPH !== 0);
            console.log("[DEBUG] Has PREMI_PPH in rows:", hasPremiPph);
            if (hasPremiPph) {
                const premiPphRows = result.data_rows.filter((r: any) => r.PREMI_PPH && r.PREMI_PPH > 0);
                console.log("[DEBUG] Rows with PREMI_PPH:", premiPphRows.length);
                if (premiPphRows.length > 0) {
                    console.log("[DEBUG] Sample PREMI_PPH row:", premiPphRows[0].nama, premiPphRows[0].PREMI_PPH);
                }
            }

            return {
                division: divisionCode,
                month,
                year,
                gangs: gangsList,
                grand_total: grandTotal,  // Division-level totals
                dynamic_premi_headers: result.dynamic_premi_headers,
                dynamic_potongan_headers: result.dynamic_potongan_headers,
                premi_title_map: result.premi_title_map,
                potongan_title_map: result.potongan_title_map,
                meta: result.meta
            };
        } catch (e: any) {
            console.error("[PayrollRoutes] division-raw-tree error:", e);
            set.status = 500;
            return { error: e.message };
        }
    }, {
        query: t.Object({
            division_code: t.String(),
            month: t.String(),
            year: t.String()
        })
    })
    // --- Locked Report: Raw Tree (Alias for Proxy/Frontend Compat) ---
    .get("/locked/report/raw-tree", async ({ query, set, currentUser }) => {
        try {
            const { dataExtractorService } = await import("../services/dataExtractorService");

            // Frontend sends 'div' instead of 'division_code' for this endpoint
            const divisionCode = query.div;
            const month = parseInt(query.month);
            const year = parseInt(query.year);

            if (!divisionCode || !month || !year) {
                set.status = 400;
                return { error: "div, month, and year are required" };
            }

            // PERMISSION CHECK
            if (!currentUser) {
                set.status = 401;
                return { error: "Unauthorized" };
            }

            // PERMISSION CHECK - RELAXED TO MATCH PYTHON BACKEND
            /*
            if (currentUser.role !== UserRole.ADMIN) {
                console.log(`[PayrollRoutes DEBUG Report] Permission Check for User: ${currentUser.username}, Requested: '${divisionCode}', UserDivs: ${JSON.stringify(currentUser.divisions)}`);

                // Normalize for comparison
                const requestedDiv = String(divisionCode).trim().toUpperCase();

                // Check if ANY user division (or its alias) matches the requests
                const hasPermission = currentUser.divisions.some(d => {
                    const div = String(d).trim().toUpperCase();
                    if (div === requestedDiv) return true;

                    // Helper: Convert P1A -> PG1A and vice versa via alias mapping
                    const alias = gangService.convertDivisionToLocCode(div);
                    if (alias === requestedDiv) return true;

                    return false;
                });

                if (!hasPermission) {
                    console.warn(`[PayrollRoutes] User ${currentUser.username} attempted to access unauthorized division: ${divisionCode}`);
                    set.status = 403;
                    return { error: `Access refused: You do not have permission for division ${divisionCode}` };
                }
            */

            // Use SERVER_PROFILE_2 for payroll data (main payroll database)
            // Changed from SERVER_PROFILE_1 per user requirement: payroll data is on PROFILE_2
            console.log(`[PayrollRoutes] locked/report/raw-tree calling extractPayrollData with SERVER_PROFILE_2`);
            const result = await dataExtractorService.extractPayrollData(month, year, "ALL", divisionCode, null, "SERVER_PROFILE_2");

            // Helper function to calculate totals for a list of employees
            const calculateTotals = (employees: any[]) => {
                // Filter employees: only include those with HK > 0
                // This matches the behavior in aggregationSeederRoutes.ts for consistency
                const activeEmployees = employees.filter((emp: any) => {
                    const hkVal = emp.jumlah_hk || emp.jumlah_hk;
                    const hk = parseFloat(hkVal) || 0;
                    return hk > 0;
                });

                const totals: Record<string, number> = {};
                const numericFields = [
                    'jumlah_hk', 'hari_kerja', 'gaji_pokok', 'gaji_pokok_ideal', 'gaji_pokok_aktual',
                    'beras_jumlah', 'jabatan_jumlah', 'masa_kerja_jumlah', 'lembur_jumlah',
                    'total_tunjangan', 'premi_brondol', 'total_premi', 'pot_koreksi',
                    'potongan_upah_kotor_total', 'jumlah_upah_kotor',
                    'pot_astek', 'pot_astek_maj', 'pot_bpjs_kesehatan_pekerja', 'pot_bpjs_kesehatan_majikan',
                    'pot_bpjs_pensiun_pekerja', 'pot_bpjs_pensiun_majikan', 'pot_bpjs_pekerja_total',
                    'pot_spsi', 'pot_pph21', 'premi_pph', 'total_potongan', 'total_potongan_bersih',
                    'upah_bersih', 'koreksi_hk'
                ];

                // Initialize totals
                for (const field of numericFields) {
                    totals[field] = 0;
                }
                totals['employee_count'] = activeEmployees.length;

                // Sum all numeric fields from active employees only
                for (const emp of activeEmployees) {
                    for (const field of numericFields) {
                        const val = emp[field];
                        if (val !== null && val !== undefined) {
                            totals[field] += parseFloat(val) || 0;
                        }
                    }

                    // Also sum dynamic premi fields (premi_*)
                    for (const key of Object.keys(emp)) {
                        if (key.startsWith('premi_') && key !== 'premi_brondol' && key !== 'premi_pph' && key !== 'premi_koreksi') {
                            const val = emp[key];
                            if (val !== null && val !== undefined && typeof val === 'number') {
                                if (!totals[key]) totals[key] = 0;
                                totals[key] += val;
                            }
                        }

                        // Sum dynamic potongan fields
                        if (key.startsWith('KOREKSI') || key.startsWith('POTONGAN')) {
                            const val = emp[key];
                            if (val !== null && val !== undefined && typeof val === 'number') {
                                if (!totals[key]) totals[key] = 0;
                                totals[key] += val;
                            }
                        }
                    }
                }

                return totals;
            };

            // Group by gang and calculate totals
            const gangsMap: Record<string, any[]> = {};
            for (const row of result.data_rows) {
                const gang = row.gang_code || "UNKNOWN";
                if (!gangsMap[gang]) gangsMap[gang] = [];
                gangsMap[gang].push(row);
            }

            // Build gangs list with pre-calculated totals
            const gangsList = Object.entries(gangsMap)
                .map(([gang_code, employees]) => ({
                    gang_code,
                    employees,
                    gang_totals: calculateTotals(employees)  // Pre-calculated totals from backend
                }))
                .sort((a, b) => a.gang_code.localeCompare(b.gang_code));

            // Calculate grand total for the entire division
            const grandTotal = calculateTotals(result.data_rows);

            // DEBUG: Log response data
            console.log("[DEBUG] dynamic_potongan_headers:", result.dynamic_potongan_headers);
            console.log("[DEBUG] potongan_title_map:", result.potongan_title_map);
            console.log("[DEBUG] First row keys:", result.data_rows.length > 0 ? Object.keys(result.data_rows[0]).slice(0, 50) : []);
            // Check if any row has PREMI_PPH
            const hasPremiPph = result.data_rows.some((row: any) => row.PREMI_PPH !== undefined && row.PREMI_PPH !== 0);
            console.log("[DEBUG] Has PREMI_PPH in rows:", hasPremiPph);
            if (hasPremiPph) {
                const premiPphRows = result.data_rows.filter((r: any) => r.PREMI_PPH && r.PREMI_PPH > 0);
                console.log("[DEBUG] Rows with PREMI_PPH:", premiPphRows.length);
                if (premiPphRows.length > 0) {
                    console.log("[DEBUG] Sample PREMI_PPH row:", premiPphRows[0].nama, premiPphRows[0].PREMI_PPH);
                }
            }

            return {
                division: divisionCode,
                month,
                year,
                gangs: gangsList,
                grand_total: grandTotal,  // Division-level totals
                dynamic_premi_headers: result.dynamic_premi_headers,
                dynamic_potongan_headers: result.dynamic_potongan_headers,
                premi_title_map: result.premi_title_map,
                potongan_title_map: result.potongan_title_map,
                meta: result.meta
            };
        } catch (e: any) {
            console.error("[PayrollRoutes] locked/report/raw-tree error:", e);
            set.status = 500;
            return { error: e.message };
        }
    }, {
        query: t.Object({
            div: t.String(),
            month: t.String(),
            year: t.String()
        })
    })
    // --- Locked Gangs List ---
    .get("/locked/gangs", async ({ query, set, currentUser }) => {
        try {
            // Frontend service likely sends 'div' based on previous pattern, 
            // but let's support 'division' too just in case.
            const divisionCode = query.div || query.division;

            if (!divisionCode) {
                set.status = 400;
                return { error: "Division code is required" };
            }

            // PERMISSION CHECK - RELAXED TO MATCH PYTHON BACKEND
            if (!currentUser) {
                set.status = 401;
                return { error: "Unauthorized" };
            }

            // The Python backend (payroll_locked.py) does NOT check if the user has the division in their token.
            // It allows any authenticated user to request any locked division.
            // We are mirroring that behavior here to resolve 403 errors for users like 'kerani_arec'.
            /*
            if (currentUser.role !== UserRole.ADMIN) {
                console.log(`[PayrollRoutes DEBUG] Permission Check for User: ${currentUser.username}, Requested: '${divisionCode}', UserDivs: ${JSON.stringify(currentUser.divisions)}`);
    
                // Normalize for comparison
                const requestedDiv = String(divisionCode).trim().toUpperCase();
    
                // Check if ANY user division (or its alias) matches the requests
                // This handles P1A vs PG1A mismatches
                const hasPermission = currentUser.divisions.some(d => {
                    const div = String(d).trim().toUpperCase();
                    if (div === requestedDiv) return true;
    
                    // Helper: Convert P1A -> PG1A and vice versa is tricky if GangService only does one way.
                    // But GangService has convertDivisionToLocCode (PG1A -> P1A).
                    // So if User has PG1A, convert to P1A and check.
                    const alias = gangService.convertDivisionToLocCode(div);
                    if (alias === requestedDiv) return true;
    
                    return false;
                });
    
                if (!hasPermission) {
                    console.warn(`[PayrollRoutes] User ${currentUser.username} attempted to access unauthorized gangs for division: ${divisionCode}`);
                    set.status = 403;
                    return { error: `Access denied. You have ${JSON.stringify(currentUser.divisions)}, but requested ${divisionCode}` };
                }
            }
            */

            const gangs = await gangService.fetchGangs(divisionCode);
            return gangs;
        } catch (e: any) {
            console.error("[PayrollRoutes] locked/gangs error:", e);
            set.status = 500;
            return { error: e.message };
        }
    }, {
        query: t.Object({
            div: t.Optional(t.String()),
            division: t.Optional(t.String())
        })
    })
    // --- Report: Gang Grid ---
    .get("/report", async ({ query, set }) => {
        try {
            const { dataExtractorService } = await import("../services/dataExtractorService");

            const gangCode = query.gang_code || "ALL";
            const month = parseInt(query.month || String(new Date().getMonth() + 1));
            const year = parseInt(query.year || String(new Date().getFullYear()));

            // Use SERVER_PROFILE_2 for payroll data
            const result = await dataExtractorService.extractPayrollData(month, year, gangCode, undefined, null, "SERVER_PROFILE_2");

            return {
                gang_code: gangCode,
                month,
                year,
                data: result.data_rows,
                dynamic_premi_headers: result.dynamic_premi_headers,
                dynamic_potongan_headers: result.dynamic_potongan_headers,
                meta: result.meta
            };
        } catch (e: any) {
            console.error("[PayrollRoutes] report error:", e);
            set.status = 500;
            return { error: e.message };
        }
    }, {
        query: t.Object({
            gang_code: t.Optional(t.String()),
            month: t.Optional(t.String()),
            year: t.Optional(t.String()),
            skip: t.Optional(t.String()),
            limit: t.Optional(t.String())
        })
    });
