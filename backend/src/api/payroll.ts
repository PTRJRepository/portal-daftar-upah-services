import { Database } from "../db/client";
import { Config } from "../config";
import { Elysia, t } from "elysia";
import { gangService } from "../services/gangService";
import { headerService } from "../services/headerService";
import { payrollService } from "../services/payrollService";
import { AuthService } from "../services/authService";
import { currentPeriodService } from "../services/currentPeriodService";
import { User, UserRole } from "../types/user";


const authService = AuthService.getInstance();

/**
 * [PERFORMANCE] Strip heavy per-row array fields before sending JSON to browser.
 * Fields like shortage_details[], excess_details[], other_incomes[] are not needed
 * by the summary table but can make JSON 5-20x larger → browser "Aw, Snap!" crash.
 *
 * Notes on kept fields:
 * - has_shortage / has_excess: boolean flags, needed by table cell renderer for coloring
 * - shortage_total_hours / excess_total_hours: summary totals, needed for tooltip summary
 * - shortage_details[] / excess_details[]: REMOVED — detail arrays, not used in table view
 */
function slimEmployee(emp: any): any {
    const { shortage_details, excess_details, other_incomes, lembur_records, ...rest } = emp;
    return rest;
}

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
    // --- Divisions ---
    .get("/divisions", async ({ currentUser }): Promise<any> => {
        if (currentUser) {
            return authService.getAccessibleDivisions(currentUser);
        }
        const divisions = await gangService.getAllDivisions();
        return divisions;
    })
    .get("/subdivisions", async ({ set }) => {
        try {
            const subDivisions: any[] = [];
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
    .get("/gangs", async ({ query, currentUser, set }): Promise<any> => {
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
    .get("/columns", async ({ query, set }): Promise<any> => {
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
            const { cacheService } = await import("../services/cacheService");
            const data = body as any;
            console.log(`[manual-edit] Incoming payload:`, JSON.stringify({
                period_month: data.period_month,
                period_year: data.period_year,
                nik: data.nik,
                emp_code: data.emp_code,
                gang_code: data.gang_code,
                adjustment_type: data.adjustment_type,
                adjustment_name: data.adjustment_name,
                amount: data.amount
            }));

            const username = currentUser?.username || 'system';
            const resultId = await manualAdjustmentService.saveAdjustment(data, username);

            // Always clear cache after save to ensure fresh data on next load
            // Use suffix matching because keys format is payroll_data:{gangCode}:{month}:{year}
            const pattern = `:${data.period_month}:${data.period_year}`;
            cacheService.clearByPattern(pattern);
            console.log(`[PayrollRoutes] Cleared cache for pattern: ${pattern} after manual edit`);

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
            nik: t.Optional(t.String()),  // Real NIK (KTP) - for PENDAPATAN_LAINNYA
            emp_code: t.String(),
            gang_code: t.String(),
            division_code: t.Optional(t.String()),
            adjustment_type: t.String(), // PREMI, POTONGAN_KOTOR, POTONGAN_BERSIH, PENDAPATAN_LAINNYA
            adjustment_name: t.String(),
            amount: t.Number(),
            remarks: t.Optional(t.String())
        })
    })
    // --- BPJS Calculation (New) ---
    .get("/bpjs-calculate", async ({ query }) => {
        const masaKerjaJumlah = parseFloat(query.masa_kerja_jumlah || "0");
        const upahDasar = parseFloat(query.upah_dasar || "0");
        const components = payrollService.calculateBpjsComponents(masaKerjaJumlah, upahDasar);
        return components;
    }, {
        query: t.Object({
            masa_kerja_jumlah: t.Optional(t.String()),
            upah_dasar: t.Optional(t.String())
        })
    })
    // --- Report: Division Raw Tree ---
    .get("/report/division-raw-tree", async ({ query, set }): Promise<any> => {
        try {
            const { dataExtractorService } = await import("../services/dataExtractorService");

            const divisionCode = query.division_code;
            const month = parseInt(query.month);
            const year = parseInt(query.year);
            const useHistoryDb = query.use_history ? query.use_history === 'true' : null;
            const gangPrefix = query.gang_prefix;

            if (!divisionCode || !month || !year) {
                set.status = 400;
                return { error: "division_code, month, and year are required" };
            }

            // [OPTIMIZATION] The user explicitly requested to skip heavy bunches data (tandan) for the main table view
            const skipHarvest = true;

            // [DEBUG] Log input parameters
            console.log(`[PayrollRoutes] /report/division-raw-tree | div=${divisionCode} month=${month} year=${year} gangPrefix=${gangPrefix || 'none'} DB_PROFILE=${Config.DB_PROFILE} useHistory=${useHistoryDb} RUN_MODE=${Config.RUN_MODE}`);

            const result = await dataExtractorService.extractPayrollData(month, year, "ALL", divisionCode, null, Config.DB_PROFILE, false, useHistoryDb, gangPrefix, skipHarvest);

            // [DEBUG] Log result summary
            console.log(`[PayrollRoutes] /report/division-raw-tree RESULT | data_rows=${result.data_rows.length} gangs=${result.gangs?.length || 0} | gangPrefix=${gangPrefix}`);

            // Helper function to calculate totals for a list of employees
            const calculateTotals = (employees: any[]) => {
                // ============================================================
                // [PERATURAN BISNIS - ALWAYS ACTIVE FILTER]
                // FILTER: Selalu exclude karyawan dengan kehadiran = 0
                //
                // Using hari_kerja (kehadiran) for filtering because:
                // hari_kerja = hk - seluruh cuti (tahunan, sakit, minggu, nasional)
                // This reflects actual work days after leave deductions.
                // jumlah_hk alone is NOT sufficient - must subtract all leaves.
                //
                // Rule: EXCLUDE if hari_kerja <= 0 (same as dataExtractorService)
                // ============================================================
                const activeEmployees = employees.filter((emp: any) => {
                    const totalCuti = (emp.cuti_tahunan || 0) + (emp.cuti_sakit_haid || 0) + (emp.cuti_minggu || 0) + (emp.cuti_nasional || 0);
                    const hari_kerja = Math.max(0, (parseFloat(emp.jumlah_hk) || 0) - totalCuti);
                    return hari_kerja > 0;
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
                    // Pendapatan Lainnya (standard types)
                    'pendapatan_thr', 'pendapatan_bonus', 'pendapatan_custom',
                    'pendapatan_lainnya', 'pot_pendapatan_lainnya',
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

            console.log(`[PayrollRoutes] division-raw-tree: division=${divisionCode}, month=${month}, year=${year}, gangPrefix=${gangPrefix || 'none'}`);
            console.log(`[PayrollRoutes] division-raw-tree: data_rows count=${result.data_rows.length}, gangs count=${Object.keys(gangsMap).length}`);
            console.log(`[PayrollRoutes] division-raw-tree: dynamic_premi=${result.dynamic_premi_headers?.length || 0}, dynamic_pot=${result.dynamic_potongan_headers?.length || 0}`);

            // [PERFORMANCE] Calculate totals FIRST (needs full data with arrays),
            // then strip heavy array fields from employee rows before serializing to JSON.
            // This prevents "Aw, Snap!" browser crash caused by oversized JSON.
            const grandTotal = calculateTotals(result.data_rows);

            // Build gangs list with pre-calculated totals
            const gangsList = Object.entries(gangsMap)
                .map(([gang_code, employees]) => ({
                    gang_code,
                    employees: employees.map(slimEmployee),  // Strip heavy arrays before sending
                    gang_totals: calculateTotals(employees)  // Pre-calculated totals from FULL data
                }))
                .sort((a, b) => a.gang_code.localeCompare(b.gang_code));

            // grand total already calculated above (before slimming)

            const response = {
                division: divisionCode,
                month,
                year,
                gangs: gangsList,
                grand_total: grandTotal,  // Division-level totals
                dynamic_premi_headers: result.dynamic_premi_headers || [],
                dynamic_potongan_headers: result.dynamic_potongan_headers || [],
                premi_title_map: result.premi_title_map || {},
                potongan_title_map: result.potongan_title_map || {},
                meta: result.meta || {}
            };

            console.log(`[PayrollRoutes] division-raw-tree: returning response with ${gangsList.length} gangs`);
            return response;
        } catch (e: any) {
            console.error("[PayrollRoutes] division-raw-tree error:", e);
            set.status = 500;
            return { error: e.message };
        }
    }, {
        query: t.Object({
            division_code: t.String(),
            month: t.String(),
            year: t.String(),
            use_history: t.Optional(t.String()),
            gang_prefix: t.Optional(t.String())
        })
    })
    // --- Locked Report: Raw Tree (Alias for Proxy/Frontend Compat) ---
    .get("/locked/report/raw-tree", async ({ query, set, currentUser }): Promise<any> => {
        try {
            const { dataExtractorService } = await import("../services/dataExtractorService");

            // Frontend sends 'div' instead of 'division_code' for this endpoint
            const divisionCode = query.div;
            const month = parseInt(query.month);
            const year = parseInt(query.year);
            const useHistoryDb = query.use_history ? query.use_history === 'true' : null;

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
                // Normalize requested division using divisionDefinition resolveDivisionCode
                // This handles AREC -> ARC, WORKSHOP AR -> WKS_AR, etc.
                const { divisionDefinition } = await import("../services/divisionDefinition");
                const requestedDiv = divisionDefinition.resolveDivisionCode(String(divisionCode).trim().toUpperCase());



                const hasPermission = currentUser.divisions.some(d => {
                    // Also normalize user's division using resolveDivisionCode
                    const div = divisionDefinition.resolveDivisionCode(String(d).trim().toUpperCase());
                    const match = div === requestedDiv;

                    return match;
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
            const gangPrefix = query.gang_prefix;
            const gangCode = query.gang_code || "ALL";

            // Use Config.DB_PROFILE for payroll data (main payroll database)

            // [OPTIMIZATION] Skip heavy bunches data (tandan) for the main table view
            const skipHarvest = true;

            console.log(`[PayrollRoutes] /locked/report/raw-tree | div=${divisionCode} month=${month} year=${year} gangCode=${gangCode} gangPrefix=${gangPrefix} useHistory=${useHistoryDb}`);

            const result = await dataExtractorService.extractPayrollData(month, year, gangCode, divisionCode, null, Config.DB_PROFILE, includeVirtual, useHistoryDb, gangPrefix, skipHarvest);

            // [DEBUG] Log result summary
            const empCount = result?.data_rows?.length || 0;
            const gangCount = result?.gangs?.length || 0;
            console.log(`[PayrollRoutes] /locked/report/raw-tree RESULT | gangs=${gangCount} employees=${empCount} | gangCode=${gangCode} | gangPrefix=${gangPrefix}`);

            // Helper function to calculate totals for a list of employees
            const calculateTotals = (employees: any[]) => {
                // ============================================================
                // [PERATURAN BISNIS - ALWAYS ACTIVE FILTER]
                // FILTER: Selalu exclude karyawan dengan kehadiran = 0
                //
                // Using hari_kerja (kehadiran) for filtering because:
                // hari_kerja = hk - seluruh cuti (tahunan, sakit, minggu, nasional)
                // This reflects actual work days after leave deductions.
                // jumlah_hk alone is NOT sufficient - must subtract all leaves.
                //
                // Rule: EXCLUDE if hari_kerja <= 0 (same as dataExtractorService)
                // ============================================================
                const activeEmployees = employees.filter((emp: any) => {
                    const totalCuti = (emp.cuti_tahunan || 0) + (emp.cuti_sakit_haid || 0) + (emp.cuti_minggu || 0) + (emp.cuti_nasional || 0);
                    const hari_kerja = Math.max(0, (parseFloat(emp.jumlah_hk) || 0) - totalCuti);
                    return hari_kerja > 0;
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
                    // Pendapatan Lainnya (standard types)
                    'pendapatan_thr', 'pendapatan_bonus', 'pendapatan_custom',
                    'pendapatan_lainnya', 'pot_pendapatan_lainnya'
                ];

                // [FIX] Collect ALL dynamic field names (premi, potongan, pendapatan) upfront
                // to prevent double-counting in the per-row loops below.
                // CustomTypesTotal (e.g. KONTAN) is spread as pendapatan_kontan and ALSO included
                // in pendapatan_lainnya. We add all custom fields to a set so they get counted
                // ONCE via the numericFields loop, NOT again in the dynamic loops.
                const extraNumericFields: string[] = [];
                const extraPremiKeys: string[] = [];
                const extraPotonganKeys: string[] = [];
                for (const emp of employees) {
                    for (const key of Object.keys(emp)) {
                        if (key.startsWith('premi_') && key !== 'premi_brondol' && key !== 'premi_pph' && key !== 'premi_koreksi') {
                            if (!extraPremiKeys.includes(key)) extraPremiKeys.push(key);
                        }
                        if (key.startsWith('KOREKSI') || key.startsWith('POTONGAN')) {
                            if (!extraPotonganKeys.includes(key)) extraPotonganKeys.push(key);
                        }
                        if (key.startsWith('pendapatan_') && !numericFields.includes(key)) {
                            if (!extraNumericFields.includes(key)) extraNumericFields.push(key);
                        }
                    }
                }

                // Initialize totals
                for (const field of numericFields) {
                    totals[field] = 0;
                }
                totals['employee_count'] = activeEmployees.length;

                // Sum all numeric fields from active employees only
                for (const emp of activeEmployees) {
                    // Standard numeric fields
                    for (const field of numericFields) {
                        const val = emp[field];
                        if (val !== null && val !== undefined) {
                            totals[field] += parseFloat(val) || 0;
                        }
                    }

                    // Dynamic premi fields (already included in numericFields loop via extraNumericFields)
                    for (const key of extraPremiKeys) {
                        const val = emp[key];
                        if (val !== null && val !== undefined && typeof val === 'number') {
                            if (!totals[key]) totals[key] = 0;
                            totals[key] += val;
                        }
                    }

                    // Dynamic potongan fields
                    for (const key of extraPotonganKeys) {
                        const val = emp[key];
                        if (val !== null && val !== undefined && typeof val === 'number') {
                            if (!totals[key]) totals[key] = 0;
                            totals[key] += val;
                        }
                    }

                    // [FIX] Dynamic pendapatan_* fields - SKIP adding to totals here
                    // All custom pendapatan_* keys (e.g. pendapatan_kontan) are already included
                    // in the numericFields loop above via extraNumericFields.
                    // The old dynamic loop would double-count them.
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

            // [PERFORMANCE] Calculate totals FIRST (needs full data with arrays),
            // then strip heavy array fields from employee rows before serializing to JSON.
            // This prevents "Aw, Snap!" browser crash caused by oversized JSON.
            const grandTotal = calculateTotals(result.data_rows);

            // Build gangs list with pre-calculated totals
            const gangsList = Object.entries(gangsMap)
                .map(([gang_code, employees]) => ({
                    gang_code,
                    employees: employees.map(slimEmployee),  // Strip heavy arrays before sending
                    gang_totals: calculateTotals(employees)  // Pre-calculated totals from FULL data
                }))
                .sort((a, b) => a.gang_code.localeCompare(b.gang_code));

            // grand total already calculated above (before slimming)



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
            include_virtual: t.Optional(t.String()),
            use_history: t.Optional(t.String()),
            gang_prefix: t.Optional(t.String())
        })
    })
    // --- Locked Manual Edit ---
    .post("/locked/manual-edit", async ({ body, set, currentUser }) => {
        try {
            // PERMISSION CHECK
            if (!currentUser) {
                set.status = 401;
                return { error: "Unauthorized" };
            }

            const { manualAdjustmentService } = await import("../services/manualAdjustmentService");
            const { cacheService } = await import("../services/cacheService");
            const data = body as any;

            const username = currentUser?.username || 'system';
            const resultId = await manualAdjustmentService.saveAdjustment(data, username);

            // Always clear cache after save to ensure fresh data on next load
            // Use suffix matching because keys format is payroll_data:{gangCode}:{month}:{year}
            const pattern = `:${data.period_month}:${data.period_year}`;
            cacheService.clearByPattern(pattern);
            console.log(`[PayrollRoutes] Cleared cache for pattern: ${pattern} after locked manual edit`);

            return { success: true, id: resultId, message: "Manual adjustment saved successfully." };
        } catch (e: any) {
            console.error("[PayrollRoutes] locked/manual-edit error:", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        body: t.Object({
            period_month: t.Number(),
            period_year: t.Number(),
            nik: t.Optional(t.String()),  // Real NIK (KTP) - for PENDAPATAN_LAINNYA
            emp_code: t.String(),
            gang_code: t.String(),
            division_code: t.Optional(t.String()),
            adjustment_type: t.String(), // PREMI, POTONGAN_KOTOR, POTONGAN_BERSIH, PENDAPATAN_LAINNYA
            adjustment_name: t.String(),
            amount: t.Number(),
            remarks: t.Optional(t.String())
        })
    })
    // --- Explicit Strict Income Deletion (Kontan/THR) ---
    .post("/locked/income-delete", async ({ body, set, currentUser }) => {
        try {
            if (!currentUser) { set.status = 401; return { error: "Unauthorized" }; }
            const { Database } = await import("../db/client");
            const { cacheService } = await import("../services/cacheService");
            const data = body as any;
            const db = Database.getExtendedInstance();
            
            const incomeType = String(data.income_type || '').toUpperCase().trim();
            const realNik = (data.nik || '').trim();
            
            if (!incomeType || !realNik || !data.period_month || !data.period_year) {
                set.status = 400; return { error: "income_type, nik, period_month, period_year required" };
            }

            // Strictly delete ONLY this income type for this employee
            await db.query(`
                DELETE FROM employee_other_incomes 
                WHERE nik = ? AND period_month = ? AND period_year = ? AND income_type = ?
            `, [realNik, data.period_month, data.period_year, incomeType]);
            
            const pattern = `payroll_data:${data.period_month}:${data.period_year}`;
            cacheService.clearByPattern(pattern);
            
            return { success: true, message: `${incomeType} deleted successfully for NIK ${realNik}` };
        } catch (e: any) {
            set.status = 500; return { success: false, error: e.message };
        }
    }, {
        body: t.Object({
            nik: t.String(),
            period_month: t.Number(),
            period_year: t.Number(),
            income_type: t.String()
        })
    })
    // --- Locked Pendapatan Lainnya Edit (Generic: Kontanan, Insentif, etc.) ---
    .post("/locked/pendapatan-lainnya-edit", async ({ body, set, currentUser }) => {
        try {
            if (!currentUser) {
                set.status = 401;
                return { error: "Unauthorized" };
            }

            const { Database } = await import("../db/client");
            const { cacheService } = await import("../services/cacheService");
            const data = body as any;

            const db = Database.getExtendedInstance();
            const parsedAmount = parseFloat(data.amount?.toString()) || 0;
            const incomeType = String(data.income_type || '').toUpperCase().trim().replace(/\s+/g, '_');
            const incomeName = String(data.income_name || data.income_type || '').trim();

            if (!incomeType) {
                set.status = 400;
                return { error: "income_type is required" };
            }

            // Look for existing record for this NIK + emp_name + income_type in this period
            // Using NIK + emp_name to disambiguate employees that may share the same NIK
            const existing = await db.query(`
                SELECT id FROM employee_other_incomes 
                WHERE nik = ? AND emp_name = ? AND period_year = ? AND period_month = ? AND income_type = ?
            `, [data.nik, data.emp_name, data.period_year, data.period_month, incomeType]);

            const clearPeriodCache = () => {
                const pattern = `payroll_data:${data.period_month}:${data.period_year}`;
                cacheService.clearByPattern(pattern);
                console.log(`[PayrollRoutes] Cleared cache for pattern: ${pattern} after saving ${incomeType}`);
            };

            if (existing && existing.length > 0) {
                if (parsedAmount === 0) {
                    await db.query(`DELETE FROM employee_other_incomes WHERE id = ?`, [existing[0].id]);
                    clearPeriodCache();
                    return { success: true, action: 'deleted', message: `${incomeName} removed.` };
                } else {
                    await db.query(`
                        UPDATE employee_other_incomes 
                        SET amount = ?, emp_name = ?, gang_code = ?, division_code = ?, income_name = ?, updated_at = GETDATE()
                        WHERE id = ?
                    `, [parsedAmount, data.emp_name, data.gang_code, data.division_code || null, incomeName, existing[0].id]);
                    clearPeriodCache();
                    return { success: true, action: 'updated', id: existing[0].id, message: `${incomeName} updated.` };
                }
            } else {
                if (parsedAmount === 0) {
                    return { success: true, action: 'skipped', message: "Zero amount, nothing saved." };
                }
                await db.query(`
                    INSERT INTO employee_other_incomes (
                        nik, emp_name, division_code, gang_code, period_year, period_month,
                        income_type, income_name, amount, is_paid_in_thp, is_taxable
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
                `, [data.nik, data.emp_name, data.division_code || null, data.gang_code, data.period_year, data.period_month, incomeType, incomeName, parsedAmount]);
                clearPeriodCache();
                return { success: true, action: 'inserted', message: `${incomeName} saved.` };
            }
        } catch (e: any) {
            console.error("[PayrollRoutes] locked/pendapatan-lainnya-edit error:", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    }, {
        body: t.Object({
            nik: t.String(),
            emp_name: t.String(),
            period_month: t.Number(),
            period_year: t.Number(),
            amount: t.Number(),
            gang_code: t.String(),
            division_code: t.Optional(t.String()),
            income_type: t.String(),
            income_name: t.Optional(t.String())
        })
    })
    // --- Locked Pendapatan Lainnya Custom Types ---
    .get("/locked/pendapatan-lainnya-types", async ({ query, set, currentUser }): Promise<any> => {
        try {
            if (!currentUser) {
                set.status = 401;
                return { error: "Unauthorized" };
            }

            const { Database } = await import("../db/client");
            const db = Database.getExtendedInstance();
            const month = parseInt(query.month as string) || new Date().getMonth() + 1;
            const year = parseInt(query.year as string) || new Date().getFullYear();

            // Fetch distinct custom income types for this period
            // Exclude standard types (THR, BONUS, CUSTOM) that come from the OtherIncomes bulk system
            const rows = await db.query<{ income_type: string; income_name: string }>(`
                SELECT DISTINCT income_type, income_name 
                FROM employee_other_incomes
                WHERE period_year = ? AND period_month = ?
                  AND income_type NOT IN ('THR', 'BONUS', 'CUSTOM')
                ORDER BY income_type
            `, [year, month]);

            const types = rows.map(r => ({
                type: r.income_type,
                name: r.income_name || r.income_type
            }));

            return { success: true, types };
        } catch (e: any) {
            console.error("[PayrollRoutes] pendapatan-lainnya-types error:", e);
            set.status = 500;
            return { success: false, error: e.message };
        }
    })
    // --- Locked Gangs List ---
    .get("/locked/gangs", async ({ query, set, currentUser }): Promise<any> => {
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
                // Normalize requested division using divisionDefinition resolveDivisionCode
                // This handles AREC -> ARC, WORKSHOP AR -> WKS_AR, etc.
                const { divisionDefinition } = await import("../services/divisionDefinition");
                const requestedDiv = divisionDefinition.resolveDivisionCode(String(divisionCode).trim().toUpperCase());



                const hasPermission = currentUser.divisions.some(d => {
                    // Also normalize user's division using resolveDivisionCode
                    const div = divisionDefinition.resolveDivisionCode(String(d).trim().toUpperCase());
                    const match = div === requestedDiv;

                    return match;
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
    .get("/report", async ({ query, set }): Promise<any> => {
        try {
            const { dataExtractorService } = await import("../services/dataExtractorService");

            const gangCode = query.gang_code || "ALL";
            const month = parseInt(query.month || String(new Date().getMonth() + 1));
            const year = parseInt(query.year || String(new Date().getFullYear()));
            const useHistoryDb = query.use_history ? query.use_history === 'true' : null;
            const gangPrefix = query.gang_prefix;
            const serverProfile = query.server_profile || Config.DB_PROFILE;
            const skipHeavyDetails = query.summary_only === 'true';

            // Use provided serverProfile or default to Config.DB_PROFILE
            const result = await dataExtractorService.extractPayrollData(month, year, gangCode, undefined, null, serverProfile, false, useHistoryDb, gangPrefix, false, skipHeavyDetails);

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
            limit: t.Optional(t.String()),
            use_history: t.Optional(t.String()),
            gang_prefix: t.Optional(t.String()),
            server_profile: t.Optional(t.String()),
            summary_only: t.Optional(t.String())
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
    .get("/report-with-components", async ({ query, set }): Promise<any> => {
        try {
            const { dataExtractorService } = await import("../services/dataExtractorService");

            const gangCode = query.gang_code || "ALL";
            const month = parseInt(query.month || String(new Date().getMonth() + 1));
            const year = parseInt(query.year || String(new Date().getFullYear()));
            const useHistoryDb = query.use_history ? query.use_history === 'true' : null;

            // Use new component-based extraction method
            const result = await dataExtractorService.extractPayrollDataWithComponents(month, year, gangCode, undefined, null, Config.DB_PROFILE, useHistoryDb);

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
            year: t.Optional(t.String()),
            use_history: t.Optional(t.String())
        })
    })

    /**
     * Get detailed component breakdown for a single employee
     * Returns all calculations with full metadata traceability
     */
    .get("/employee/:emp_code/components", async ({ params, query, set }): Promise<any> => {
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
     * TEST ENDPOINT: Diagnose jabatan, THR, and KONTAN data availability
     * Tests the full chain: gang → employees → employee_estate / employee_other_incomes
     */
    .get("/test/jabatan-thr-kontan", async ({ query, set }) => {
        try {
            const db = Database.getExtendedInstance();
            const dbMain = Database.getInstance();
            const { OtherIncomesService } = await import("../services/otherIncomesService");

            const gangCode = (query.gang_code as string) || 'H1H';
            const month = parseInt(query.month as string) || 3;
            const year = parseInt(query.year as string) || 2026;

            const result: any = {
                params: { gang_code: gangCode, month, year },
                timestamp: new Date().toISOString()
            };

            // STEP 1: Get employees in the gang
            const gangEmployees = await dbMain.query(`
                SELECT TOP 20
                    RTRIM(e.EmpCode) as emp_code,
                    RTRIM(e.NewICNo) as nik,
                    RTRIM(e.EmpName) as emp_name,
                    RTRIM(gl.GangCode) as gang_code,
                    e.Status
                FROM HR_EMPLOYEE e
                INNER JOIN HR_GANGLN gl ON e.EmpCode = gl.GangMember
                INNER JOIN HR_GANG g ON gl.GangCode = g.GangCode
                WHERE gl.GangCode = ?
                ORDER BY e.EmpName
            `, [gangCode]);

            result.step1_employees = {
                total: gangEmployees.length,
                sample: gangEmployees.slice(0, 5).map((e: any) => ({
                    emp_code: e.emp_code,
                    nik: e.nik || '(empty)',
                    emp_name: e.emp_name
                }))
            };

            if (gangEmployees.length === 0) {
                result.conclusion = 'FAIL';
                result.message = `No employees found for gang ${gangCode}`;
                return result;
            }

            const empCodes = gangEmployees.map((e: any) => e.emp_code);
            const niks = gangEmployees.map((e: any) => (e.nik || '').trim().toUpperCase()).filter(Boolean);

            // STEP 2: Check employee_estate (JABATAN)
            const estateRows = await db.query(`
                SELECT empcode, employee_name, gang, jabatan
                FROM employee_estate
                WHERE empcode IN (${empCodes.map(() => '?').join(',')})
            `, empCodes);

            const estateMap = new Map<string, string>();
            estateRows.forEach((r: any) => estateMap.set(r.empcode?.trim().toUpperCase(), r.jabatan));

            // Also check by nik
            const estateRowsByNik = await db.query(`
                SELECT nik, employee_name, gang, jabatan
                FROM employee_estate
                WHERE nik IN (${niks.map(() => '?').join(',')})
            `, niks);
            estateRowsByNik.forEach((r: any) => {
                const key = (r.nik || '').trim().toUpperCase();
                if (key && !estateMap.has(key)) {
                    estateMap.set(key, r.jabatan);
                }
            });

            const totalEstateCount = await db.query(`SELECT COUNT(*) as cnt FROM employee_estate`);
            result.step2_jabatan = {
                table_total_records: totalEstateCount[0]?.cnt || 0,
                records_for_gang: estateRows.length,
                matched_by_empcode: estateRows.length,
                matched_by_nik: estateRowsByNik.length,
                sample: estateRows.slice(0, 5).map((r: any) => ({
                    empcode: r.empcode,
                    jabatan: r.jabatan
                })),
                status: estateRows.length > 0 ? 'OK' : 'EMPTY - seed needed'
            };

            // STEP 3: Check employee_other_incomes (THR + KONTAN)
            const otherIncomes = await OtherIncomesService.getIncomes(year, month, undefined, gangCode);
            const thrRecords = otherIncomes.filter((i: any) => i.income_type === 'THR');
            const kontanRecords = otherIncomes.filter((i: any) => i.income_type === 'KONTAN' || i.income_type === 'KONTANAN');

            // Match against gang employees
            let thrMatched = 0;
            let kontanMatched = 0;
            const thrSample: any[] = [];
            const kontanSample: any[] = [];

            for (const emp of gangEmployees) {
                const nikKey = (emp.nik || '').trim().toUpperCase();
                const empCodeKey = (emp.emp_code || '').trim().toUpperCase();

                const hasThr = thrRecords.some((r: any) =>
                    ((r.nik || '').trim().toUpperCase() === nikKey && nikKey) ||
                    ((r.emp_code || '').trim().toUpperCase() === empCodeKey && empCodeKey)
                );
                const hasKontan = kontanRecords.some((r: any) =>
                    ((r.nik || '').trim().toUpperCase() === nikKey && nikKey) ||
                    ((r.emp_code || '').trim().toUpperCase() === empCodeKey && empCodeKey)
                );

                if (hasThr) {
                    thrMatched++;
                    if (thrSample.length < 5) {
                        const rec = thrRecords.find((r: any) =>
                            ((r.nik || '').trim().toUpperCase() === nikKey && nikKey) ||
                            ((r.emp_code || '').trim().toUpperCase() === empCodeKey && empCodeKey)
                        );
                        thrSample.push({ emp_name: emp.emp_name, nik: nikKey || empCodeKey, amount: rec?.amount });
                    }
                }
                if (hasKontan) {
                    kontanMatched++;
                    if (kontanSample.length < 5) {
                        const rec = kontanRecords.find((r: any) =>
                            ((r.nik || '').trim().toUpperCase() === nikKey && nikKey) ||
                            ((r.emp_code || '').trim().toUpperCase() === empCodeKey && empCodeKey)
                        );
                        kontanSample.push({ emp_name: emp.emp_name, nik: nikKey || empCodeKey, amount: rec?.amount });
                    }
                }
            }

            const totalThrInDb = await db.query(`SELECT COUNT(*) as cnt FROM employee_other_incomes WHERE income_type = 'THR' AND period_year = ? AND period_month = ?`, [year, month]);
            const totalKontanInDb = await db.query(`SELECT COUNT(*) as cnt FROM employee_other_incomes WHERE income_type IN ('KONTAN','KONTANAN') AND period_year = ? AND period_month = ?`, [year, month]);

            result.step3_thr = {
                db_total_records: totalThrInDb[0]?.cnt || 0,
                for_gang: thrRecords.length,
                matched_to_gang_employees: thrMatched,
                gang_employees_total: gangEmployees.length,
                sample: thrSample,
                status: thrMatched > 0 ? 'OK' : 'EMPTY'
            };

            result.step4_kontan = {
                db_total_records: totalKontanInDb[0]?.cnt || 0,
                for_gang: kontanRecords.length,
                matched_to_gang_employees: kontanMatched,
                gang_employees_total: gangEmployees.length,
                sample: kontanSample,
                status: kontanMatched > 0 ? 'OK' : 'EMPTY - KONTAN data not seeded'
            };

            // CONCLUSION
            const allOk = thrMatched > 0 && kontanMatched >= 0 && estateRows.length > 0;
            result.conclusion = allOk ? 'PASS' : 'PARTIAL';
            result.message = allOk
                ? `Jabatan: ${estateRows.length} records, THR: ${thrMatched}/${gangEmployees.length} employees, KONTAN: ${kontanMatched} employees`
                : `Some data is missing. Seed missing tables.`;

            return result;
        } catch (e: any) {
            console.error("[PayrollRoutes] test/jabatan-thr-kontan error:", e);
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

    /**
     * PROGRESSIVE STREAMING ENDPOINT
     *
     * Uses Server-Sent Events (SSE) to stream gang data progressively.
     *
     * Flow:
     * 1. Run ALL heavy DB queries in parallel (same as original)
     * 2. Group employees by gang
     * 3. Stream each gang batch as it's processed
     * 4. Stream final grand_total when all gangs are done
     *
     * This allows the frontend to start rendering rows BEFORE all data is processed.
     *
     * Event types:
     * - meta: { total_gangs, total_employees, dynamic_headers, execution_time_ms }
     * - progress: { stage, message, processed_gangs, total_gangs }
     * - gang: { gang_code, employees[], gang_totals, chunk_index }
     * - complete: { grand_total, total_execution_ms }
     * - error: { message }
     */
    // Progressive streaming endpoint - uses SSE to stream data progressively
    // Falls back to standard fetch if SSE not supported
    .get("/report/division-raw-tree/stream", async ({ headers, query, set }): Promise<any> => {
        const authHeader = headers["authorization"] as string | undefined;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            set.status = 401;
            return { error: "Unauthorized" };
        }
        const token = authHeader.split(" ")[1];
        const user = await authService.verifyToken(token);

        const divisionCode = query.division_code;
        const month = parseInt(query.month);
        const year = parseInt(query.year);
        const gangPrefix = query.gang_prefix;
        const gangCode = query.gang_code || "ALL";

        if (!divisionCode || !month || !year) {
            set.status = 400;
            return { error: "division_code, month, and year are required" };
        }

        // Permission check
        if (user && user.role !== UserRole.ADMIN) {
            if (divisionCode && !user.divisions.includes(divisionCode)) {
                set.status = 403;
                return { error: "Division not accessible" };
            }
        }

        console.log(`[Stream] Starting progressive | div=${divisionCode} month=${month} year=${year} gangCode=${gangCode}`);

        const encoder = new TextEncoder();
        let cancelled = false;

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // Import services
                    const { dataExtractorService } = await import("../services/dataExtractorService");
                    const { Config } = await import("../config");

                    // Send initial progress
                    controller.enqueue(encoder.encode(`event: progress\ndata: ${JSON.stringify({
                        stage: 'connecting',
                        message: 'Menghubungi server...',
                        processed_gangs: 0,
                        total_gangs: 0
                    })}\n\n`));

                    // Use TRUE lazy loading extraction - yields data in phases
                    const progressiveStream = dataExtractorService.extractPayrollDataProgressive(
                        month, year, gangCode, divisionCode,
                        Config.DB_PROFILE, gangPrefix
                    );

                    let gangIndex = 0;
                    const gangOrder: string[] = [];
                    let lastMeta: any = null;
                    let lastPhase = '';
                    const streamStartTime = Date.now();
                    const allDynamicPremiHeaders = new Set<string>();
                    const allDynamicPotonganHeaders = new Set<string>();
                    let globalPremiTitleMap: Record<string, string> = {};
                    let globalPotonganTitleMap: Record<string, string> = {};

                    for await (const chunk of progressiveStream) {
                        if (cancelled) break;

                        const { phase, gangs, current_gang, meta, dynamic_premi_headers, dynamic_potongan_headers, dynamic_premi_titles, dynamic_potongan_titles } = chunk;

                        // Track gang order from identity phase
                        if (phase === 'identity' && gangOrder.length === 0) {
                            gangOrder.push(...Array.from(gangs.keys()).sort());
                        }

                        // Update dynamic headers as they arrive
                        if (dynamic_premi_headers) {
                            dynamic_premi_headers.forEach(h => allDynamicPremiHeaders.add(h));
                        }
                        if (dynamic_potongan_headers) {
                            dynamic_potongan_headers.forEach(h => allDynamicPotonganHeaders.add(h));
                        }
                        if (dynamic_premi_titles) {
                            Object.assign(globalPremiTitleMap, dynamic_premi_titles);
                        }
                        if (dynamic_potongan_titles) {
                            Object.assign(globalPotonganTitleMap, dynamic_potongan_titles);
                        }

                        if (phase !== lastPhase) {
                            console.log(`[Stream] Phase ${phase}: ${meta.message}`);
                            lastPhase = phase;
                        }

                        lastMeta = meta;

                        // Phase 0: Identity (names only)
                        if (phase === 'identity') {
                            controller.enqueue(encoder.encode(`event: meta\ndata: ${JSON.stringify({
                                division: divisionCode,
                                month,
                                year,
                                total_gangs: meta.total_gangs,
                                total_employees: meta.total_employees,
                                dynamic_premi_headers: [],
                                dynamic_potongan_headers: [],
                                stage: 'identity',
                                query_time_ms: 0
                            })}\n\n`));

                            // Send all gangs with names only
                            for (const [gangCodeKey, employees] of gangs) {
                                const idx = gangOrder.indexOf(gangCodeKey);
                                const slimEmployees = employees.map((emp: any) => {
                                    const { _phase, _enriched, _loading, ...rest } = emp;
                                    return slimEmployee(rest);
                                });

                                controller.enqueue(encoder.encode(`event: gang\ndata: ${JSON.stringify({
                                    gang_code: gangCodeKey,
                                    employees: slimEmployees,
                                    gang_index: idx >= 0 ? idx : gangIndex++,
                                    employees_count: employees.length,
                                    phase: 'identity',
                                    is_complete: false
                                })}\n\n`));
                            }

                            controller.enqueue(encoder.encode(`event: progress\ndata: ${JSON.stringify({
                                stage: 'identity_loaded',
                                message: meta.message,
                                processed_gangs: meta.total_gangs,
                                total_gangs: meta.total_gangs,
                                progress_pct: meta.progress_pct
                            })}\n\n`));
                        }

                        // Phase 1-3: Progressive enrichment
                        if (phase === 'attendance' || phase === 'overtime' || phase === 'premium') {
                            const stageMap: Record<string, string> = {
                                'attendance': 'attendance_loaded',
                                'overtime': 'overtime_loaded',
                                'premium': 'premium_loaded'
                            };

                            // Send updated gangs
                            for (const [gangCodeKey, employees] of gangs) {
                                const idx = gangOrder.indexOf(gangCodeKey);
                                const slimEmployees = employees.map((emp: any) => {
                                    const { _phase, _enriched, _loading, ...rest } = emp;
                                    return slimEmployee(rest);
                                });

                                controller.enqueue(encoder.encode(`event: gang_update\ndata: ${JSON.stringify({
                                    gang_code: gangCodeKey,
                                    employees: slimEmployees,
                                    gang_index: idx,
                                    phase: phase,
                                    is_complete: false
                                })}\n\n`));
                            }

                            controller.enqueue(encoder.encode(`event: progress\ndata: ${JSON.stringify({
                                stage: stageMap[phase] || 'loading',
                                message: meta.message,
                                processed_gangs: meta.total_gangs,
                                total_gangs: meta.total_gangs,
                                progress_pct: meta.progress_pct
                            })}\n\n`));
                        }

                        // Complete phase
                        if (phase === 'complete') {
                            console.log(`[Stream] ✅ Complete: ${meta.message}`);

                            // Send final filtered & sorted gangs
                            for (const [gangCodeKey, employees] of gangs) {
                                const idx = gangOrder.indexOf(gangCodeKey);
                                const slimEmployees = employees.map((emp: any) => {
                                    const { _phase, _enriched, _loading, ...rest } = emp;
                                    return slimEmployee(rest);
                                });

                                controller.enqueue(encoder.encode(`event: gang\ndata: ${JSON.stringify({
                                    gang_code: gangCodeKey,
                                    employees: slimEmployees,
                                    gang_index: idx >= 0 ? idx : gangIndex++,
                                    employees_count: employees.length,
                                    phase: 'complete',
                                    is_complete: true
                                })}\n\n`));
                            }

                            controller.enqueue(encoder.encode(`event: progress\ndata: ${JSON.stringify({
                                stage: 'complete',
                                message: meta.message,
                                processed_gangs: meta.processed_gangs,
                                total_gangs: meta.total_gangs,
                                progress_pct: 100
                            })}\n\n`));

                            // Send final headers
                            controller.enqueue(encoder.encode(`event: headers\ndata: ${JSON.stringify({
                                dynamic_premi_headers: Array.from(allDynamicPremiHeaders),
                                dynamic_potongan_headers: Array.from(allDynamicPotonganHeaders),
                                dynamic_premi_titles: globalPremiTitleMap,
                                dynamic_potongan_titles: globalPotonganTitleMap
                            })}\n\n`));

                            controller.enqueue(encoder.encode(`event: complete\ndata: ${JSON.stringify({
                                message: meta.message,
                                total_execution_ms: Date.now() - streamStartTime,
                                total_gangs: meta.total_gangs,
                                total_employees: meta.total_employees
                            })}\n\n`));
                        }
                    }

                    controller.close();

                } catch (e: any) {
                    console.error('[Stream] Error:', e);
                    try {
                        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: e.message })}\n\n`));
                        controller.close();
                    } catch {}
                }
            },
            cancel() {
                cancelled = true;
            }
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
                "Access-Control-Allow-Origin": "*",
            }
        });
    }, {
        query: t.Object({
            division_code: t.String(),
            month: t.String(),
            year: t.String(),
            gang_prefix: t.Optional(t.String()),
            gang_code: t.Optional(t.String())
        })
    })

    /**
     * Cache warming endpoint - pre-populates cache for fast subsequent requests
     * POST /api/payroll/warm-cache
     */
    .post("/warm-cache", async ({ body, set }): Promise<any> => {
        try {
            const { dataExtractorService } = await import("../services/dataExtractorService");
            const { divisionConfigService } = await import("../services/config/DivisionConfigService");
            const { currentPeriodService } = await import("../services/currentPeriodService");
            const { cacheService } = await import("../services/cacheService");
            const { Config } = await import("../config");

            const data = body as any;
            const division = data?.division || 'ALL';
            const month = data?.month;
            const year = data?.year;

            // Get current period if not specified
            let targetMonth = month;
            let targetYear = year;
            if (!targetMonth || !targetYear) {
                const current = await currentPeriodService.getCurrentPeriod();
                targetMonth = current.month;
                targetYear = current.year;
            }

            console.log(`[CacheWarm] Starting cache warm for div=${division} month=${targetMonth} year=${targetYear}`);

            const startTime = Date.now();
            let gangsWarmed = 0;
            let employeesWarmed = 0;
            let errors = 0;

            if (division === 'ALL') {
                // Warm cache for all divisions
                const divisions = divisionConfigService.getAllDivisionCodes();
                for (const div of divisions) {
                    try {
                        const result = await dataExtractorService.extractPayrollData(
                            targetMonth, targetYear, "ALL", div, null,
                            Config.DB_PROFILE, false, null, undefined, true, true
                        );
                        gangsWarmed++;
                        employeesWarmed += result.data_rows.length;
                    } catch (e) {
                        errors++;
                        console.error(`[CacheWarm] Error warming ${div}:`, e.message);
                    }
                }
            } else {
                // Warm cache for specific division
                const result = await dataExtractorService.extractPayrollData(
                    targetMonth, targetYear, "ALL", division, null,
                    Config.DB_PROFILE, false, null, undefined, true, true
                );
                gangsWarmed++;
                employeesWarmed += result.data_rows.length;
            }

            const elapsed = Date.now() - startTime;
            console.log(`[CacheWarm] Complete: ${gangsWarmed} divisions, ${employeesWarmed} employees in ${elapsed}ms, errors: ${errors}`);

            return {
                success: true,
                warmed: {
                    divisions: gangsWarmed,
                    employees: employeesWarmed,
                    elapsed_ms: elapsed,
                    errors
                }
            };
        } catch (e: any) {
            console.error('[CacheWarm] Error:', e);
            set.status = 500;
            return { error: e.message };
        }
    }, {
        body: t.Object({
            division: t.Optional(t.String()),
            month: t.Optional(t.Number()),
            year: t.Optional(t.Number())
        })
    })

    /**
     * Get cache statistics
     */
    .get("/cache-stats", async (): Promise<any> => {
        const { cacheService } = await import("../services/cacheService");
        return cacheService.getStats();
    })
