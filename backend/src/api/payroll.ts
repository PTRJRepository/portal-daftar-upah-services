import { Config } from "../config";
import { Elysia, t } from "elysia";
import { gangService } from "../services/gangService";
import { headerService } from "../services/headerService";
import { payrollService } from "../services/payrollService";
import { AuthService } from "../services/authService";
import { currentPeriodService } from "../services/currentPeriodService";
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
        try {
            const user = await getUserFromHeader(headers);
            return { currentUser: user };
        } catch (e) {
            console.error("[PayrollRoutes] Derive error:", e);
            return { currentUser: null };
        }
    })
    .onBeforeHandle(({ currentUser, set }) => {
        if (!currentUser) {
            set.status = 401;
            return { message: "Unauthorized" };
        }
    })
    // --- Divisions ---as
    .get("/divisions", async ({ currentUser }) => {
        if (currentUser) {
            return authService.getAccessibleDivisions(currentUser);
        }
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
    // --- Current Period ---
    .get("/current-period", async ({ set }) => {
        try {
            const period = await currentPeriodService.getCurrentPeriod();
            return period;
        } catch (e: any) {
            set.status = 500;
            return { message: `Failed to get current period: ${e.message}` };
        }
    })
    // --- Gangs ---
    .get("/gangs", async ({ query, currentUser, set }) => {
        try {
            const division = query.division === "ALL" ? undefined : query.division;
            const search = query.search || undefined;

            // Permission check
            if (currentUser && (currentUser.role !== UserRole.ADMIN)) {
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
    // --- Save Manual Edit ---
    .post("/manual-edit", async ({ body, currentUser, set }) => {
        try {
            const { manualAdjustmentService } = await import("../services/manualAdjustmentService");
            const data = body as any;

            const username = currentUser?.username || 'system';
            const resultId = await manualAdjustmentService.saveAdjustment(data, username);

            return { success: true, id: resultId, message: "Manual adjustment saved successfully." };
        } catch (e: any) {
            console.error("[PayrollRoutes] manual-edit error:", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        body: t.Object({
            period_month: t.Number(),
            period_year: t.Number(),
            emp_code: t.String(),
            gang_code: t.String(),
            division_code: t.Optional(t.String()),
            adjustment_type: t.String(), // PREMI, POTONGAN_KOTOR, POTONGAN_BERSIH
            adjustment_name: t.String(),
            amount: t.Number(),
            remarks: t.Optional(t.String())
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

            const result = await dataExtractorService.extractPayrollData(month, year, "ALL", divisionCode, null, Config.DB_PROFILE);

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
                    'upah_bersih', 'koreksi_hk',
                    // Harvest items
                    'bunches_total', 'bunches_ripe', 'bunches_unripe',
                    'bunches_underripe', 'bunches_overripe', 'bunches_rotten', 'bunches_abnormal',
                    'loose_fruit', 'bunches_transactions'
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

            // PERMISSION CHECK - Enforce for KERANI
            // ADMIN = All access
            // USER = All access (Legacy behavior retained for backward compatibility if needed, or strictly enforce?)
            // KERANI = RESTRICTED to assigned divisions

            if (currentUser.role === UserRole.KERANI) {
                const requestedDiv = String(divisionCode).trim().toUpperCase();
                const hasPermission = currentUser.divisions.some(d => {
                    const div = String(d).trim().toUpperCase();
                    if (div === requestedDiv) return true;

                    // Check alias
                    try {
                        const alias = gangService.convertDivisionToLocCode(div);
                        if (alias === requestedDiv) return true;
                    } catch (e) {
                        // ignore 
                    }
                    return false;
                });

                if (!hasPermission) {
                    console.warn(`[PayrollRoutes] KERANI ${currentUser.username} denied. Divs: ${JSON.stringify(currentUser.divisions)}, Req: ${requestedDiv}`);
                    // console.log(`[DEBUG] permission check failed`);
                    set.status = 403;
                    return { error: `Access refused: You do not have permission for division ${divisionCode}` };
                }
            }

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

            const includeVirtual = query.include_virtual === 'true';

            // Use Config.DB_PROFILE for payroll data (main payroll database)
            console.log(`[PayrollRoutes] locked/report/raw-tree calling extractPayrollData with ${Config.DB_PROFILE}, includeVirtual=${includeVirtual}`);
            const result = await dataExtractorService.extractPayrollData(month, year, "ALL", divisionCode, null, Config.DB_PROFILE, includeVirtual);

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
            year: t.String(),
            include_virtual: t.Optional(t.String())
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

            // PERMISSION CHECK - Enforce for KERANI
            // The Python backend (payroll_locked.py) does NOT check if the user has the division in their token.
            // However, for KERANI, we need to be STRICT.

            if (currentUser.role === UserRole.KERANI) {
                const requestedDiv = String(divisionCode).trim().toUpperCase();
                const hasPermission = currentUser.divisions.some(d => {
                    const div = String(d).trim().toUpperCase();
                    if (div === requestedDiv) return true;

                    // Check alias
                    try {
                        const alias = gangService.convertDivisionToLocCode(div);
                        if (alias === requestedDiv) return true;
                    } catch (e) {
                        // ignore 
                    }
                    return false;
                });

                if (!hasPermission) {
                    console.warn(`[PayrollRoutes] KERANI ${currentUser.username} attempted to access unauthorized gangs for division: ${divisionCode}`);
                    set.status = 403;
                    return { error: `Access denied. You have ${JSON.stringify(currentUser.divisions)}, but requested ${divisionCode}` };
                }
            }

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

            // Use Config.DB_PROFILE for payroll data
            const result = await dataExtractorService.extractPayrollData(month, year, gangCode, undefined, null, Config.DB_PROFILE);

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
    })

    // =========================================================================
    // NEW COMPONENT ARCHITECTURE ENDPOINTS
    // These endpoints expose the new unified component services with metadata
    // =========================================================================

    /**
     * Get payroll report with full component metadata
     * This endpoint demonstrates the new architecture where all calculations
     * return PayrollComponent with traceable metadata
     */
    .get("/report-with-components", async ({ query, set }) => {
        try {
            const { dataExtractorService } = await import("../services/dataExtractorService");

            const gangCode = query.gang_code || "ALL";
            const month = parseInt(query.month || String(new Date().getMonth() + 1));
            const year = parseInt(query.year || String(new Date().getFullYear()));

            // Use new component-based extraction method
            const result = await dataExtractorService.extractPayrollDataWithComponents(month, year, gangCode, undefined, null, Config.DB_PROFILE);

            return {
                gang_code: gangCode,
                month,
                year,
                data: result.data_rows,
                components: result.components,  // All component data with metadata
                meta: result.meta
            };
        } catch (e: any) {
            console.error("[PayrollRoutes] report-with-components error:", e);
            set.status = 500;
            return { error: e.message };
        }
    }, {
        query: t.Object({
            gang_code: t.Optional(t.String()),
            month: t.Optional(t.String()),
            year: t.Optional(t.String())
        })
    })

    /**
     * Get detailed component breakdown for a single employee
     * Returns all calculations with full metadata traceability
     */
    .get("/employee/:emp_code/components", async ({ params, query, set }) => {
        try {
            const { dataExtractorService } = await import("../services/dataExtractorService");

            const empCode = params.emp_code;
            const month = parseInt(query.month || String(new Date().getMonth() + 1));
            const year = parseInt(query.year || String(new Date().getFullYear()));

            const result = await dataExtractorService.getEmployeeComponentDetails(empCode, month, year, Config.DB_PROFILE);

            return result;
        } catch (e: any) {
            console.error("[PayrollRoutes] employee components error:", e);
            set.status = 500;
            return { error: e.message };
        }
    }, {
        params: t.Object({
            emp_code: t.String()
        }),
        query: t.Object({
            month: t.Optional(t.String()),
            year: t.Optional(t.String())
        })
    })

    /**
     * Get component registry health status
     * Returns all registered components and their versions
     */
    .get("/components/registry", async () => {
        try {
            const { payrollComponentRegistry } = await import("../services/payroll");

            const health = payrollComponentRegistry.getHealthStatus();

            return health;
        } catch (e: any) {
            console.error("[PayrollRoutes] components registry error:", e);
            return { error: e.message };
        }
    })
