/**
 * Aggregation Seeding Routes
 * API endpoints for triggering and managing aggregation seeding to extend_db_ptrj
 * Always uses server_profile_1 for extend_db_ptrj connection
 */

import { Elysia, t } from "elysia";
import { Database } from "../db/client";
import { dataExtractorService } from "../services/dataExtractorService";

interface AggregationRecord {
    gang_code: string;
    gang_description: string;
    total_employees: number;
    total_hk: number;
    total_hari_kerja: number;
    total_cuti_tahunan: number;
    total_cuti_sakit: number;
    total_cuti_minggu: number;
    total_cuti_nasional: number;
    total_upah_dasar: number;
    total_upah_pokok: number;
    total_gaji_pokok: number;
    total_beras: number;
    total_jabatan: number;
    total_masa_kerja: number;
    total_lembur: number;
    total_tunjangan: number;
    total_premi_brondol: number;
    total_premi_prunning: number;
    total_premi: number;
    total_potongan: number;
    total_pph21: number;
    total_bpjs_pekerja: number;
    total_bpjs_majikan: number;
    total_spsi: number;
    total_upah_kotor: number;
    total_upah_bersih: number;
    total_ffb_weight: number;
    dynamic_premi_data: string;  // JSON string of all dynamic premi
    total_koreksi: number;       // Total corrections (koreksi HK + pot_koreksi)
}

interface SeedResult {
    division: string;
    gang: string;
    employees_processed: number;
    status: string;
}

export const aggregationSeederRoutes = new Elysia({ prefix: "/payroll/aggregation" })
    .get("/health", async () => {
        const db = Database.getExtendedInstance();
        try {
            await db.query("SELECT 1");
            return {
                success: true,
                message: "extend_db_ptrj connection successful (server_profile_1)",
                profile: "SERVER_PROFILE_1",
                timestamp: new Date().toISOString()
            };
        } catch (error: any) {
            return {
                success: false,
                message: `Connection failed: ${error.message}`,
                profile: "SERVER_PROFILE_1",
                timestamp: new Date().toISOString()
            };
        }
    })
    .post("/seed", async ({ body, headers }) => {
        // Verify authentication
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return { success: false, error: "Unauthorized" };
        }

        const { division, month, year, force } = body;

        try {
            const result = await seedAggregationToDb(division, month, year, force);
            return {
                success: true,
                data: result
            };
        } catch (error: any) {
            console.error("[AggregationSeeder] Error:", error);
            return {
                success: false,
                error: error.message || "Failed to seed aggregation"
            };
        }
    }, {
        body: t.Object({
            division: t.Optional(t.String()),
            month: t.Numeric(),
            year: t.Numeric(),
            force: t.Optional(t.Boolean())
        })
    })
    .get("/history", async ({ query, headers }) => {
        // Verify authentication
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return { success: false, error: "Unauthorized" };
        }

        const month = parseInt(query.month || "0");
        const year = parseInt(query.year || "0");
        const division = query.division;

        try {
            const db = Database.getExtendedInstance();

            let sql = `
                SELECT
                    id, period_month, period_year, division_code, gang_code, gang_description,
                    total_employees, total_hk, total_hari_kerja,
                    total_upah_dasar, total_upah_pokok, total_gaji_pokok,
                    total_beras, total_jabatan, total_masa_kerja, total_lembur, total_tunjangan,
                    total_premi_brondol, total_premi_prunning, total_premi,
                    total_potongan, total_pph21, total_bpjs_pekerja, total_bpjs_majikan, total_spsi,
                    total_upah_kotor, total_upah_bersih, total_ffb_weight, created_at, updated_at, source_endpoint
                FROM dbo.daftar_upah_aggregation_history
                WHERE 1=1
            `;

            const params: any[] = [];

            if (month > 0) {
                sql += " AND period_month = ?";
                params.push(month);
            }
            if (year > 0) {
                sql += " AND period_year = ?";
                params.push(year);
            }
            if (division) {
                sql += " AND division_code = ?";
                params.push(division);
            }

            sql += " ORDER BY division_code, gang_code";

            const records = await db.query<any>(sql, params.length > 0 ? params : undefined);

            return {
                success: true,
                data: records,
                count: records.length
            };
        } catch (error: any) {
            console.error("[AggregationHistory] Error:", error);
            return {
                success: false,
                error: error.message || "Failed to fetch aggregation history",
                data: []
            };
        }
    })
    .get("/summary", async ({ query, headers }) => {
        // Verify authentication
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return { success: false, error: "Unauthorized" };
        }

        const month = parseInt(query.month || "0");
        const year = parseInt(query.year || "0");

        try {
            const db = Database.getExtendedInstance();

            const summary = await db.query<{
                division_code: string;
                gang_count: number;
                total_emp: number;
                total_hk: number;
                total_upah: number;
                total_premi: number;
                total_lembur: number;
                total_ffb: number;
                total_potongan: number;
                total_pph21: number;
                total_bpjs_pekerja: number;
                total_bpjs_majikan: number;
                total_spsi: number;
            }>(`
                SELECT
                    division_code,
                    COUNT(*) as gang_count,
                    SUM(total_employees) as total_emp,
                    SUM(total_hk) as total_hk,
                    SUM(total_upah_bersih) as total_upah,
                    SUM(total_premi) as total_premi,
                    SUM(total_lembur) as total_lembur,
                    SUM(total_ffb_weight) as total_ffb,
                    SUM(total_potongan) as total_potongan,
                    SUM(total_pph21) as total_pph21,
                    SUM(total_bpjs_pekerja) as total_bpjs_pekerja,
                    SUM(total_bpjs_majikan) as total_bpjs_majikan,
                    SUM(total_spsi) as total_spsi
                FROM dbo.daftar_upah_aggregation_history
                WHERE period_month = ? AND period_year = ?
                GROUP BY division_code
                ORDER BY division_code
            `, [month, year]);

            const grandTotal = summary.reduce((acc, row) => ({
                division_code: "GRAND TOTAL",
                gang_count: acc.gang_count + (row.gang_count || 0),
                total_emp: acc.total_emp + (row.total_emp || 0),
                total_hk: acc.total_hk + (row.total_hk || 0),
                total_upah: acc.total_upah + (row.total_upah || 0),
                total_premi: acc.total_premi + (row.total_premi || 0),
                total_lembur: acc.total_lembur + (row.total_lembur || 0),
                total_ffb: acc.total_ffb + (row.total_ffb || 0),
                total_potongan: acc.total_potongan + (row.total_potongan || 0),
                total_pph21: acc.total_pph21 + (row.total_pph21 || 0),
                total_bpjs_pekerja: acc.total_bpjs_pekerja + (row.total_bpjs_pekerja || 0),
                total_bpjs_majikan: acc.total_bpjs_majikan + (row.total_bpjs_majikan || 0),
                total_spsi: acc.total_spsi + (row.total_spsi || 0)
            }), {
                division_code: "GRAND TOTAL",
                gang_count: 0,
                total_emp: 0,
                total_hk: 0,
                total_upah: 0,
                total_premi: 0,
                total_lembur: 0,
                total_ffb: 0,
                total_potongan: 0,
                total_pph21: 0,
                total_bpjs_pekerja: 0,
                total_bpjs_majikan: 0,
                total_spsi: 0
            });

            return {
                success: true,
                summary: summary,
                grand_total: grandTotal
            };
        } catch (error: any) {
            console.error("[AggregationSummary] Error:", error);
            return {
                success: false,
                error: error.message || "Failed to fetch aggregation summary",
                summary: [],
                grand_total: null
            };
        }
    })
    .get("/divisions", async ({ headers }) => {
        // Verify authentication
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return { success: false, error: "Unauthorized" };
        }

        try {
            const db = Database.getExtendedInstance();

            const rows = await db.query<{ division_code: string }>(`
                SELECT DISTINCT division_code
                FROM dbo.daftar_upah_aggregation_history
                WHERE division_code IS NOT NULL
                ORDER BY division_code
            `);

            const divisions = rows.map(r => r.division_code);

            return {
                success: true,
                divisions: divisions
            };
        } catch (error: any) {
            console.error("[AggregationDivisions] Error:", error);
            return {
                success: false,
                error: error.message || "Failed to fetch divisions",
                divisions: []
            };
        }
    })
    .get("/periods", async ({ headers }) => {
        // Verify authentication
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return { success: false, error: "Unauthorized" };
        }

        try {
            const db = Database.getExtendedInstance();

            const periods = await db.query<{ period_month: number; period_year: number }>(`
                SELECT DISTINCT period_month, period_year
                FROM dbo.daftar_upah_aggregation_history
                ORDER BY period_year DESC, period_month DESC
            `);

            return {
                success: true,
                periods: periods
            };
        } catch (error: any) {
            console.error("[AggregationPeriods] Error:", error);
            return {
                success: false,
                error: error.message || "Failed to fetch periods",
                periods: []
            };
        }
    })
    .get("/status/:month/:year", async ({ params, headers }) => {
        // Check aggregation status for a specific period
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return { success: false, error: "Unauthorized" };
        }

        const month = parseInt(params.month);
        const year = parseInt(params.year);

        try {
            const db = Database.getExtendedInstance();

            const statusRecords = await db.query<{
                division_code: string;
                gang_count: number;
            }>(`
                SELECT division_code, COUNT(*) as gang_count
                FROM dbo.daftar_upah_aggregation_history
                WHERE period_month = ? AND period_year = ?
                GROUP BY division_code
                ORDER BY division_code
            `, [month, year]);

            return {
                success: true,
                month,
                year,
                divisions: statusRecords,
                total_gangs: statusRecords.reduce((sum, r) => sum + (r.gang_count || 0), 0)
            };
        } catch (error: any) {
            console.error("[AggregationStatus] Error:", error);
            return {
                success: false,
                error: error.message || "Failed to fetch aggregation status",
                divisions: [],
                total_gangs: 0
            };
        }
    });

// ===================== HELPER FUNCTIONS =====================

async function seedAggregationToDb(division: string | undefined, month: number, year: number, force: boolean = false) {
    // Get all divisions from backend if not specified
    const divisions = division ? [division] : await fetchAvailableDivisions();

    // Determine target divisions based on what data exists
    let divisionsToProcess: string[] = [];

    if (division) {
        divisionsToProcess = divisions.filter(d => d === division);
    } else {
        // Optimisation: Don't pre-check. Just try to process each division.
        // If no data found, it will be skipped inside the loop.
        divisionsToProcess = divisions;
    }

    const results: SeedResult[] = [];
    const sourceEndpoint = "backend-api";

    for (const div of divisionsToProcess) {
        console.log(`[AggregationSeeder] Processing division: ${div} (${month}/${year})`);

        // Extract payroll data from backend
        const extractResult = await dataExtractorService.extractPayrollData(
            month, year, "ALL", div, null, "SERVER_PROFILE_1"
        );

        // Group by gang
        const gangsMap: Record<string, any[]> = {};
        for (const row of extractResult.data_rows) {
            const gang = row.gang_code || "UNKNOWN";
            if (!gangsMap[gang]) gangsMap[gang] = [];
            gangsMap[gang].push(row);
        }

        // Insert/update each gang's aggregation
        for (const [gangCode, employees] of Object.entries(gangsMap)) {
            // Skip if no employees or all have 0 HK
            const activeEmployees = employees.filter((emp: any) => (emp.jumlah_hk || 0) > 0);
            if (activeEmployees.length === 0 && !force) {
                console.log(`[AggregationSeeder] Skipping ${gangCode}: no active employees`);
                continue;
            }

            // Calculate gang aggregation
            const aggregation = calculateGangAggregation(employees, gangCode, "");

            // Add division-specific FFB weight
            aggregation.total_ffb_weight = await fetchFfbWeightForDivision(div, month, year);

            // Insert/update to extend_db_ptrj
            await insertOrUpdateAggregation(div, month, year, aggregation, sourceEndpoint);

            results.push({
                division: div,
                gang: gangCode,
                employees_processed: employees.length,
                status: "success"
            });
        }
    }

    return {
        processed: results,
        total_divisions: divisionsToProcess.length,
        month,
        year,
        timestamp: new Date().toISOString()
    };
}

function fetchAvailableDivisions(): string[] {
    // Known divisions
    return ["PG1A", "PG1B", "PG2A", "PG2B", "DME", "ARA", "ARB1", "ARB2", "INFRA", "AREC", "IJL", "MILL"];
}

async function checkDivisionHasData(division: string, month: number, year: number): Promise<boolean> {
    try {
        const result = await dataExtractorService.extractPayrollData(
            month, year, "ALL", division, null, "SERVER_PROFILE_1"
        );
        return result.data_rows && result.data_rows.length > 0;
    } catch {
        return false;
    }
}

async function insertOrUpdateAggregation(
    division: string,
    month: number,
    year: number,
    aggregation: AggregationRecord,
    sourceEndpoint: string
) {
    const db = Database.getExtendedInstance();

    try {
        // Check if record exists
        const existing = await db.queryOne<{ id: number }>(`
            SELECT id FROM dbo.daftar_upah_aggregation_history
            WHERE gang_code = ? AND period_month = ? AND period_year = ?
        `, [aggregation.gang_code, month, year]);

        if (existing) {
            // Update existing record
            await db.query(`
                UPDATE dbo.daftar_upah_aggregation_history SET
                    division_code = ?,
                    gang_description = ?,
                    total_employees = ?,
                    total_hk = ?,
                    total_hari_kerja = ?,
                    total_cuti_tahunan = ?,
                    total_cuti_sakit = ?,
                    total_cuti_minggu = ?,
                    total_cuti_nasional = ?,
                    total_upah_dasar = ?,
                    total_upah_pokok = ?,
                    total_gaji_pokok = ?,
                    total_beras = ?,
                    total_jabatan = ?,
                    total_masa_kerja = ?,
                    total_lembur = ?,
                    total_tunjangan = ?,
                    total_premi_brondol = ?,
                    total_premi_prunning = ?,
                    total_premi = ?,
                    total_potongan = ?,
                    total_pph21 = ?,
                    total_bpjs_pekerja = ?,
                    total_bpjs_majikan = ?,
                    total_spsi = ?,
                    total_upah_kotor = ?,
                    total_upah_bersih = ?,
                    total_ffb_weight = ?,
                    dynamic_premi_data = ?,
                    total_koreksi = ?,
                    updated_at = GETDATE(),
                    source_endpoint = ?
                WHERE id = ?
            `, [
                division,
                aggregation.gang_description,
                aggregation.total_employees,
                aggregation.total_hk,
                aggregation.total_hari_kerja,
                aggregation.total_cuti_tahunan,
                aggregation.total_cuti_sakit,
                aggregation.total_cuti_minggu,
                aggregation.total_cuti_nasional,
                aggregation.total_upah_dasar,
                aggregation.total_upah_pokok,
                aggregation.total_gaji_pokok,
                aggregation.total_beras,
                aggregation.total_jabatan,
                aggregation.total_masa_kerja,
                aggregation.total_lembur,
                aggregation.total_tunjangan,
                aggregation.total_premi_brondol,
                aggregation.total_premi_prunning,
                aggregation.total_premi,
                aggregation.total_potongan,
                aggregation.total_pph21,
                aggregation.total_bpjs_pekerja,
                aggregation.total_bpjs_majikan,
                aggregation.total_spsi,
                aggregation.total_upah_kotor,
                aggregation.total_upah_bersih,
                aggregation.total_ffb_weight,
                aggregation.dynamic_premi_data,
                aggregation.total_koreksi,
                sourceEndpoint,
                existing.id
            ]);
        } else {
            // Insert new record - using explicit named parameters
            await db.query(`
                INSERT INTO dbo.daftar_upah_aggregation_history (
                    period_month, period_year, division_code, gang_code, gang_description,
                    total_employees, total_hk, total_hari_kerja,
                    total_cuti_tahunan, total_cuti_sakit, total_cuti_minggu, total_cuti_nasional,
                    total_upah_dasar, total_upah_pokok, total_gaji_pokok,
                    total_beras, total_jabatan, total_masa_kerja, total_lembur, total_tunjangan,
                    total_premi_brondol, total_premi_prunning, total_premi,
                    total_potongan, total_pph21, total_bpjs_pekerja, total_bpjs_majikan, total_spsi,
                    total_upah_kotor, total_upah_bersih, total_ffb_weight,
                    dynamic_premi_data, total_koreksi,
                    created_at, updated_at, source_endpoint
                ) VALUES (
                    @p0, @p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, @p9, @p10, @p11,
                    @p12, @p13, @p14, @p15, @p16, @p17, @p18, @p19, @p20, @p21, @p22,
                    @p23, @p24, @p25, @p26, @p27, @p28, @p29, @p30,
                    @p31, @p32,
                    GETDATE(), GETDATE(), @p33
                )
            `, {
                p0: month,
                p1: year,
                p2: division,
                p3: aggregation.gang_code,
                p4: aggregation.gang_description,
                p5: aggregation.total_employees,
                p6: aggregation.total_hk,
                p7: aggregation.total_hari_kerja,
                p8: aggregation.total_cuti_tahunan,
                p9: aggregation.total_cuti_sakit,
                p10: aggregation.total_cuti_minggu,
                p11: aggregation.total_cuti_nasional,
                p12: aggregation.total_upah_dasar,
                p13: aggregation.total_upah_pokok,
                p14: aggregation.total_gaji_pokok,
                p15: aggregation.total_beras,
                p16: aggregation.total_jabatan,
                p17: aggregation.total_masa_kerja,
                p18: aggregation.total_lembur,
                p19: aggregation.total_tunjangan,
                p20: aggregation.total_premi_brondol,
                p21: aggregation.total_premi_prunning,
                p22: aggregation.total_premi,
                p23: aggregation.total_potongan,
                p24: aggregation.total_pph21,
                p25: aggregation.total_bpjs_pekerja,
                p26: aggregation.total_bpjs_majikan,
                p27: aggregation.total_spsi,
                p28: aggregation.total_upah_kotor,
                p29: aggregation.total_upah_bersih,
                p30: aggregation.total_ffb_weight,
                p31: aggregation.dynamic_premi_data,
                p32: aggregation.total_koreksi,
                p33: sourceEndpoint
            });
        }
    } catch (error) {
        console.error("[InsertAggregation] Error:", error);
        throw error;
    }
}

async function fetchFfbWeightForDivision(divisionCode: string, month: number, year: number): Promise<number> {
    try {
        const db = Database.getMillInstance();

        // Use fuzzy match for division code in both SupplierName and CustomerCode
        const matchPattern = `%${divisionCode}%`;

        const result = await db.queryOne<{ total_weight: string }>(`
            SELECT SUM(CAST(T.[NetWeight] AS DECIMAL(18,2))) / 1000.0 AS total_weight
            FROM [dbo].[WM_TICKET] T
            LEFT JOIN [dbo].[PU_SUPPLIER] S ON T.[CustomerCode] = S.[SupplierCode]
            WHERE T.[CustomerCode] LIKE 'PTRJ%'
              AND MONTH(T.[DateReceived]) = @p1
              AND YEAR(T.[DateReceived]) = @p2
              AND T.[ProductCode] = 'FFB'
              AND (S.[Name] LIKE @p0 OR T.[CustomerCode] LIKE @p0)
        `, { p0: matchPattern, p1: month, p2: year });

        if (result && result.total_weight) {
            const weight = parseFloat(result.total_weight);
            console.log(`[FFB] ${divisionCode}: ${weight.toFixed(2)} tons`);
            return weight;
        }

        // Debug: List available suppliers for this period if no match
        // This helps us see if the division name is different (e.g. 'DME' vs 'ESTATE DME')
        const debugCheck = await db.query<{ Code: string, Name: string }>(`
            SELECT DISTINCT TOP 5 T.CustomerCode as Code, S.Name
            FROM [dbo].[WM_TICKET] T
            LEFT JOIN [dbo].[PU_SUPPLIER] S ON T.[CustomerCode] = S.[SupplierCode]
            WHERE T.[CustomerCode] LIKE 'PTRJ%'
              AND MONTH(T.[DateReceived]) = @p1
              AND YEAR(T.[DateReceived]) = @p2
        `, { p1: month, p2: year });

        const available = debugCheck.map(r => `${r.Code} (${r.Name})`).join(", ");
        console.log(`[FFB] ${divisionCode}: No data found. Available PTRJ suppliers: [${available || 'NONE'}]`);

        return 0;
    } catch (error: any) {
        // If table doesn't exist or other error, log and return 0
        if (error.message?.includes('Invalid object name') || error.message?.includes('does not exist')) {
            console.warn(`[FFB] WM_TICKET/PU_SUPPLIER table not found in db_ptrj_mill, using 0`);
        } else {
            console.error(`[FFB] Failed to fetch weight for ${divisionCode}:`, error.message);
        }
        return 0;
    }
}

function calculateGangAggregation(employees: any[], gangCode: string, gangDesc: string): AggregationRecord {
    // Filter employees: only include those with HK > 0
    const activeEmployees = employees.filter((emp: any) => {
        const hkVal = emp.jumlah_hk || emp.jumlah_hk;
        const hk = parseFloat(hkVal) || 0;
        return hk > 0;
    });

    console.log(`[Aggregation] ${gangCode}: ${employees.length} -> ${activeEmployees.length} active employees`);

    // DEBUG: Inspect first employee's premi object
    if (activeEmployees.length > 0) {
        const sampleEmp = activeEmployees[0];
        console.log(`[DebugPremi] First Emp (${sampleEmp.emp_code}):`, JSON.stringify(sampleEmp.premi || {}));
    }

    function safeSum(field: string): number {
        return activeEmployees.reduce((sum: number, emp: any) => {
            const val = emp[field];
            if (val === null || val === undefined) return sum;
            try {
                return sum + (parseFloat(val) || 0);
            } catch {
                return sum;
            }
        }, 0);
    }

    function safeSumPremi(field_name: string): number {
        return activeEmployees.reduce((sum: number, emp: any) => {
            // Check nested premi dict
            const premi_dict = emp.premi || {};
            if (typeof premi_dict === "object" && field_name in premi_dict) {
                const val = premi_dict[field_name];
                if (val !== null && val !== undefined) {
                    try {
                        return sum + (parseFloat(val) || 0);
                    } catch {
                        // pass
                    }
                }
            }
            return sum;
        }, 0);
    }

    // Calculate total_premi (excluding certain types) and build dynamic premi data
    const excludePatterns = ['prun', 'pruning', 'prunning', 'insentif panen', 'insentif_panen', 'panen', 'tiket', 'koreksi'];

    function extractTotalPremi(): {
        total_premi_calculated: number;
        premi_brondol: number;
        premi_prunning: number;
        dynamic_premi_data: string;
    } {
        let premi_brondol = 0.0;
        let premi_prunning = 0.0;
        let total_premi_calculated = 0.0;
        const dynamic_premi: Record<string, number> = {};

        for (const emp of activeEmployees) {
            const premi_obj = emp.premi || {};

            if (typeof premi_obj === "object" && Object.keys(premi_obj).length > 0) {
                // Process from nested premi object ONLY
                for (const key in premi_obj) {
                    const val = parseFloat(premi_obj[key] || 0);
                    if (val <= 0) continue;

                    const key_lower = key.toLowerCase();

                    // Track brondol and prunning separately
                    if (key_lower.includes("brondol")) {
                        premi_brondol += val;
                    } else if (key_lower.includes("prun") || key_lower.includes("pruning") || key_lower.includes("prunning")) {
                        premi_prunning += val;
                    }

                    // Add ALL premi to dynamic (including brondol/prunning)
                    let header_name = key.replace('premi_', '').replace('PREMI ', '').replace(/_/g, ' ').trim().toUpperCase();

                    // Normalize: Any 'PANEN' keyword should become 'INSENTIF PANEN'
                    if (header_name.includes('PANEN') && !header_name.includes('INSENTIF')) {
                        header_name = 'INSENTIF PANEN';
                    }

                    // Normalize 'INSENTIF_PANEN' to 'INSENTIF PANEN'
                    if (header_name === 'INSENTIFPANEN') header_name = 'INSENTIF PANEN';

                    if (header_name) {
                        if (!dynamic_premi[header_name]) {
                            dynamic_premi[header_name] = 0.0;
                        }
                        dynamic_premi[header_name] += val;
                    }

                    // Calculate total_premi EXCLUDING specific patterns
                    const should_exclude = excludePatterns.some(pattern => key_lower.includes(pattern));
                    if (!should_exclude) {
                        total_premi_calculated += val;
                    }
                }
            } else {
                // FALLBACK: Scan for flat premi_ keys
                for (const key in emp) {
                    if (key.startsWith("premi_") && key !== "total_premi") {
                        const val = parseFloat(emp[key] || 0);
                        if (val <= 0) continue;

                        const key_lower = key.toLowerCase();

                        // Track brondol and prunning separately
                        if (key_lower.includes("brondol")) {
                            premi_brondol += val;
                        } else if (key_lower.includes("prun") || key_lower.includes("pruning") || key_lower.includes("prunning")) {
                            premi_prunning += val;
                        }

                        // Add ALL premi to dynamic
                        let header_name = key.replace('premi_', '').replace('PREMI ', '').replace(/_/g, ' ').trim().toUpperCase();

                        // Normalize: Any 'PANEN' keyword should become 'INSENTIF PANEN'
                        if (header_name.includes('PANEN') && !header_name.includes('INSENTIF')) {
                            header_name = 'INSENTIF PANEN';
                        }

                        // Normalize 'INSENTIF_PANEN' to 'INSENTIF PANEN'
                        if (header_name === 'INSENTIFPANEN') header_name = 'INSENTIF PANEN';

                        if (header_name) {
                            if (!dynamic_premi[header_name]) {
                                dynamic_premi[header_name] = 0.0;
                            }
                            dynamic_premi[header_name] += val;
                        }

                        // Calculate total_premi EXCLUDING specific patterns
                        const should_exclude = excludePatterns.some(pattern => key_lower.includes(pattern));
                        if (!should_exclude) {
                            total_premi_calculated += val;
                        }
                    }
                }
            }
        }

        // Convert to list format for JSON storage
        const dynamic_premi_list = Object.entries(dynamic_premi)
            .filter(([_, total]) => total > 0)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([header, total]) => ({ header, total: Math.round(total * 100) / 100 }));

        return {
            total_premi_calculated,
            premi_brondol,
            premi_prunning,
            dynamic_premi_data: JSON.stringify(dynamic_premi_list)
        };
    }

    const {
        total_premi_calculated: total_premi_calc,
        premi_brondol: total_brondol,
        premi_prunning: total_prunning,
        dynamic_premi_data
    } = extractTotalPremi();

    // Calculate total_koreksi (koreksi_hk + pot_koreksi + premi_koreksi)
    const total_koreksi = safeSum("koreksi_hk") + safeSum("pot_koreksi") + safeSum("premi_koreksi");

    console.log(`[DebugPremi] Dynamic Data for ${gangCode}:`, dynamic_premi_data);

    return {
        gang_code: gangCode,
        gang_description: gangDesc,
        total_employees: activeEmployees.length,
        total_hk: safeSum("jumlah_hk"),
        total_hari_kerja: safeSum("hari_kerja"),
        total_cuti_tahunan: safeSum("cuti_tahunan_hari"),
        total_cuti_sakit: safeSum("cuti_sakit_haid_hari"),
        total_cuti_minggu: safeSum("cuti_minggu_hari"),
        total_cuti_nasional: safeSum("cuti_nasional_hari"),
        total_upah_dasar: safeSum("upah_dasar"),
        total_upah_pokok: safeSum("upah_pokok"),
        total_gaji_pokok: safeSum("gaji_pokok"),
        total_beras: safeSum("beras_jumlah"),
        total_jabatan: safeSum("jabatan_jumlah"),
        total_masa_kerja: safeSum("masa_kerja_jumlah") || safeSum("masa_kerja_amount"),
        total_lembur: safeSum("lembur_jumlah"),
        total_tunjangan: safeSum("total_tunjangan"),
        total_premi_brondol: total_brondol,
        total_premi_prunning: total_prunning,
        total_premi: total_premi_calc,
        total_potongan: safeSum("total_potongan"),
        total_pph21: safeSum("pot_pph21"),
        total_bpjs_pekerja: safeSum("pot_bpjs_kesehatan_pekerja") + safeSum("pot_bpjs_pensiun_pekerja"),
        total_bpjs_majikan: safeSum("pot_bpjs_kesehatan_majikan") + safeSum("pot_bpjs_pensiun_majikan"),
        total_spsi: safeSum("pot_spsi"),
        total_upah_kotor: safeSum("jumlah_upah_kotor"),
        total_upah_bersih: safeSum("upah_bersih"),
        total_ffb_weight: 0,
        dynamic_premi_data,
        total_koreksi
    };
}
