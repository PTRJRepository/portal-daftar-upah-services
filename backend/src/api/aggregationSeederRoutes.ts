/**
 * Aggregation Seeding Routes
 * API endpoints for triggering and managing aggregation seeding to extend_db_ptrj
 * Always uses server_profile_1 for extend_db_ptrj connection
 */

import { Elysia, t } from "elysia";
import { Database } from "../db/client";
import { dataExtractorService } from "../services/dataExtractorService";
import { divisionDefinition } from "../services/divisionDefinition";

import { Config } from "../config";
import { PayrollDataService, AggregationRecord } from "../services/payrollDataService";

// Interface moved to PayrollDataService


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
                message: `extend_db_ptrj connection successful (${Config.DB_EXTEND_PROFILE})`,
                profile: Config.DB_EXTEND_PROFILE,
                timestamp: new Date().toISOString()
            };
        } catch (error: any) {
            return {
                success: false,
                message: `Connection failed: ${error.message}`,
                profile: Config.DB_EXTEND_PROFILE,
                timestamp: new Date().toISOString()
            };
        }
    })
    .post("/seed", async ({ body, headers, set }) => {
        // Verify authentication
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            set.status = 401;
            return { success: false, error: "Unauthorized" };
        }

        const { division, month, year, force } = body;

        try {
            // Seed hanya ke aggregation table (existing behavior)
            const result = await seedAggregationToDb(division, month, year, authHeader, force || false);
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
    .get("/seed/progress", async ({ headers, set }) => {
        // Verify authentication
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            set.status = 401;
            return { success: false, error: "Unauthorized" };
        }

        try {
            // Import HistorySeederService to get its static progress
            const { HistorySeederService } = await import("../services/historySeederService");
            const progress = HistorySeederService.getProgress();

            return {
                success: true,
                data: progress
            };
        } catch (error: any) {
            console.error("[AggregationSeeder] Progress Error:", error);
            set.status = 500;
            return {
                success: false,
                error: error.message || "Failed to fetch progress"
            };
        }
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
                    total_premi_brondol, total_premi_prunning, total_premi_insentif, total_premi_kinerja,
                    total_premi, dynamic_premi_data, informasi_tambahan, total_koreksi,
                    total_potongan, total_pph21, total_bpjs_pekerja, total_bpjs_majikan, total_spsi,
                    total_upah_kotor, total_upah_bersih, total_ffb_weight, total_weight_tbs,
                    created_at, updated_at, source_endpoint
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
    })
    .get("/validate", async ({ query, headers }) => {
        // Validate aggregation totals against real-time payroll calculations
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return { success: false, error: "Unauthorized" };
        }

        const month = parseInt(query.month);
        const year = parseInt(query.year);
        const divisionCode = query.division; // Optional: validate specific division only

        try {
            const db = Database.getExtendedInstance();

            // Get stored aggregation totals
            let aggQuery = `
                SELECT division_code, gang_code, gang_description,
                       total_employees, total_hk, total_upah_bersih, total_premi,
                       total_lembur, total_pph21, total_spsi, total_potongan,
                       total_premi_insentif, total_premi_kinerja, total_premi_prunning, total_koreksi
                FROM dbo.daftar_upah_aggregation_history
                WHERE period_month = ? AND period_year = ?
            `;
            const aggParams: any[] = [month, year];

            if (divisionCode) {
                aggQuery += ` AND division_code = ?`;
                aggParams.push(divisionCode);
            }

            aggQuery += " ORDER BY division_code, gang_code";

            const storedAggregations = await db.query<any>(aggQuery, aggParams);

            // Calculate real-time totals from payroll data
            const realTimeTotals: Record<string, any> = {};

            // Get divisions to validate
            const divisionsToValidate = divisionCode
                ? [divisionCode]
                : [...new Set(storedAggregations.map(a => a.division_code))];

            for (const div of divisionsToValidate) {
                // Extract payroll data using PayrollDataService (Source of Truth)
                try {
                    const authHeader = headers["authorization"] || "";

                    const payrollData = await PayrollDataService.fetchPayrollData(div, month, year, authHeader);

                    // Flatten records from all source divisions
                    let allRecords: AggregationRecord[] = [];
                    Object.values(payrollData).forEach(records => {
                        allRecords = [...allRecords, ...records];
                    });

                    for (const record of allRecords) {
                        const gangCode = record.gang_code;
                        if (!gangCode) continue;

                        const gangKey = `${div}_${gangCode}`;

                        realTimeTotals[gangKey] = {
                            division_code: div,
                            gang_code: gangCode,
                            total_employees: record.total_employees,
                            total_hk: record.total_hk,
                            total_upah_bersih: record.total_upah_bersih,
                            total_premi: record.total_premi,
                            total_lembur: record.total_lembur,
                            total_pph21: record.total_pph21,
                            total_spsi: record.total_spsi,
                            total_potongan: record.total_potongan
                        };
                    }
                } catch (e) {
                    console.error(`[Validation] Failed to fetch payroll data for ${div}:`, e);
                }
            }

            // Log stored aggregation for comparison
            console.log(`[Validation] Stored aggregations found: ${storedAggregations.length}`);
            for (const stored of storedAggregations) {
                console.log(`[Validation] Stored ${stored.division_code}_${stored.gang_code}: upah_bersih=${stored.total_upah_bersih}, HK=${stored.total_hk}, employees=${stored.total_employees}`);
            }

            // Compare stored vs real-time totals
            const discrepancies: any[] = [];
            const tolerances = {
                total_employees: 0,      // Must be exact match
                total_hk: 0.01,          // Small floating point tolerance
                total_upah_bersih: 1,    // 1 rupiah tolerance
                total_premi: 1,
                total_lembur: 1,
                total_pph21: 1,
                total_spsi: 1,
                total_potongan: 1
            };

            for (const stored of storedAggregations) {
                const gangKey = `${stored.division_code}_${stored.gang_code}`;
                const realTime = realTimeTotals[gangKey];

                if (!realTime) {
                    discrepancies.push({
                        division_code: stored.division_code,
                        gang_code: stored.gang_code,
                        status: "MISSING_IN_REALTIME",
                        message: "Gang exists in aggregation but not found in real-time payroll data"
                    });
                    continue;
                }

                // Check each field for discrepancies
                const fieldDiscrepancies: any = {};
                for (const [field, tolerance] of Object.entries(tolerances)) {
                    const storedValue = parseFloat(stored[field]) || 0;
                    const realTimeValue = realTime[field] || 0;
                    const diff = Math.abs(storedValue - realTimeValue);

                    if (diff > tolerance) {
                        fieldDiscrepancies[field] = {
                            stored: storedValue,
                            real_time: realTimeValue,
                            difference: diff
                        };
                    }
                }

                if (Object.keys(fieldDiscrepancies).length > 0) {
                    discrepancies.push({
                        division_code: stored.division_code,
                        gang_code: stored.gang_code,
                        status: "DISCREPANCY_FOUND",
                        field_discrepancies: fieldDiscrepancies
                    });
                }
            }

            // Check for gangs in real-time but not in aggregation
            for (const [gangKey, realTime] of Object.entries(realTimeTotals)) {
                const exists = storedAggregations.some(s =>
                    s.division_code === realTime.division_code && s.gang_code === realTime.gang_code
                );
                if (!exists) {
                    discrepancies.push({
                        division_code: realTime.division_code,
                        gang_code: realTime.gang_code,
                        status: "MISSING_IN_AGGREGATION",
                        message: "Gang found in real-time payroll but not in aggregation table"
                    });
                }
            }

            // Calculate division totals summary
            const divisionSummaries: any[] = [];
            for (const div of divisionsToValidate) {
                const divStored = storedAggregations.filter(a => a.division_code === div);
                const divRealTime = Object.values(realTimeTotals).filter((r: any) => r.division_code === div);

                const storedTotal = divStored.reduce((sum, r) => sum + (parseFloat(r.total_upah_bersih) || 0), 0);
                const realTimeTotal = divRealTime.reduce((sum: number, r: any) => sum + (r.total_upah_bersih || 0), 0);

                divisionSummaries.push({
                    division_code: div,
                    stored_aggregation_total: storedTotal,
                    real_time_payroll_total: realTimeTotal,
                    difference: Math.abs(storedTotal - realTimeTotal),
                    is_match: Math.abs(storedTotal - realTimeTotal) < 1 // Within 1 rupiah tolerance
                });
            }

            return {
                success: true,
                month,
                year,
                division_code: divisionCode || "ALL",
                validation_timestamp: new Date().toISOString(),
                division_summaries: divisionSummaries,
                discrepancies_found: discrepancies.length,
                discrepancies: discrepancies.slice(0, 100), // Limit to first 100
                total_gangs_checked: storedAggregations.length
            };
        } catch (error: any) {
            console.error("[AggregationValidation] Error:", error);
            return {
                success: false,
                error: error.message || "Failed to validate aggregation",
                discrepancies: []
            };
        }
    });

// ===================== HELPER FUNCTIONS =====================

// Helper functions removed as they are now in PayrollDataService

export async function seedAggregationToDb(division: string | undefined, month: number, year: number, authToken: string, force: boolean = false) {
    // When no division specified, get REAL divisions only (exclude virtual).
    // Virtual divisions (WKS_PG, WKS_AR, NRS, INF, etc.) are derived at READ time
    // by the summary service from the real source divisions' gangs.
    // Seeding virtual divisions separately would store gangs under virtual codes,
    // preventing correct re-mapping at read time.
    const divisions = division ? [division] : await fetchAvailableDivisions();

    // Determine target divisions based on what data exists
    let divisionsToProcess: string[] = [];

    if (division) {
        divisionsToProcess = divisions.filter(d => d === division);
    } else {
        // For bulk seeding: skip virtual divisions — the summary service groups
        // gangs into virtual divisions at read time using HR_GANG patterns.
        // Seeding only real divisions ensures gangs like AMC, HMC, B2N, INF, INT
        // are stored under their real source division (P1A, P1B, AB2).
        divisionsToProcess = divisions.filter(d => !divisionDefinition.isVirtualDivision(d));
        console.log(`[AggregationSeeder] Bulk seeding ${divisionsToProcess.length} real divisions (skipping virtual): ${divisionsToProcess.join(', ')}`);
    }

    const results: SeedResult[] = [];
    // Only difference: sourceEndpoint is now 'raw-tree-endpoint'
    const sourceEndpoint = "raw-tree-endpoint";
    const divisionTotals: Record<string, number> = {};

    for (const div of divisionsToProcess) {
        console.log(`[AggregationSeeder] Processing division: ${div} (${month}/${year})`);

        // Check if this is a virtual division
        const isVirtual = divisionDefinition.isVirtualDivision(div);

        let divisionsToQuery: string[];
        let targetDivisionCode: string; // The division code to use when inserting to aggregation

        if (isVirtual) {
            // For virtual divisions, we still rely on PayrollDataService to handle the source querying
            // But for the seeder, we iterate differently.
            // Actually PayrollDataService handles the mapping of division -> records.
            // So we can simplify this loop significantly.

            // However, to minimize risk of changing logic, I will keep the outer loop structure 
            // but use PayrollDataService to fetch the data.

            // Virtual division logic is now encapsulated in PayrollDataService.fetchPayrollData
            // But we need to know the target division code.
            targetDivisionCode = div;
            console.log(`[AggregationSeeder] Virtual division ${div} processing...`);
        } else if (div === 'MILL') {
            // MILL SPECIAL LOGIC
            console.log(`[AggregationSeeder] Processing MILL division using VenusHR data...`);
            try {
                const millData = await fetchMillData(month, year);

                // Create a single aggregation record for MILL
                const millRecord: AggregationRecord = {
                    gang_code: "MILL_GENERAL",
                    gang_description: "General Mill Operations",
                    total_employees: millData.total_employees,
                    total_hk: millData.total_hk,
                    total_hari_kerja: millData.total_hk, // Assuming same
                    total_cuti_tahunan: 0,
                    total_cuti_sakit: 0,
                    total_cuti_minggu: 0,
                    total_cuti_nasional: 0,
                    total_upah_dasar: 0,
                    total_upah_pokok: 0,
                    total_gaji_pokok: 0,
                    total_beras: 0,
                    total_jabatan: 0,
                    total_masa_kerja: 0,
                    total_lembur: 0,
                    total_tunjangan: 0,
                    total_premi_brondol: 0,
                    total_premi_prunning: 0,
                    total_premi_insentif: 0,
                    total_premi_kinerja: 0,
                    total_premi: 0,
                    total_potongan: 0,
                    total_pph21: 0,
                    total_bpjs_pekerja: 0,
                    total_bpjs_majikan: 0,
                    total_spsi: 0,
                    total_upah_kotor: millData.total_salary, // Assuming take home pay ~ upah kotor for simple report? Or upah bersih? SQL says "IsTakeHomePay"
                    total_upah_bersih: millData.total_salary, // Treating Take Home Pay as Upah Bersih
                    total_ffb_weight: 0,
                    total_weight_tbs: 0,
                    dynamic_premi_data: "[]",
                    informasi_tambahan: "Source: VenusHR",
                    total_koreksi: 0
                };

                // Use insertOrUpdateAggregation (single record)
                targetDivisionCode = div;
                await insertOrUpdateAggregation(targetDivisionCode, month, year, millRecord, sourceEndpoint);

                // Assuming success if no error thrown
                if (true) {
                    results.push({ division: div, gang: "MILL_GENERAL", employees_processed: millRecord.total_employees, status: "SUCCESS" });
                } else {
                    results.push({ division: div, gang: "MILL_GENERAL", employees_processed: 0, status: "SKIPPED/FAILED" });
                }
                continue; // Skip standard processing
            } catch (e: any) {
                console.error("[AggregationSeeder] MILL Error:", e);
                results.push({ division: div, gang: "MILL_GENERAL", employees_processed: 0, status: "ERROR: " + e.message });
                continue;
            }
        } else {
            targetDivisionCode = div;
        }

        // Use PayrollDataService to fetch data
        // For virtual divisions, it returns data for all source divisions.
        // For normal divisions, it returns data for just that division.
        // We need to aggregate them if it's a virtual division? 
        // PayrollDataService.fetchPayrollData returns Record<sourceDiv, AggregationRecord[]>

        try {
            const payrollData = await PayrollDataService.fetchPayrollData(div, month, year, authToken);

            // Collect all records from all returned source divisions
            let allRecords: AggregationRecord[] = [];
            Object.values(payrollData).forEach(records => {
                allRecords = [...allRecords, ...records];
            });

            if (allRecords.length === 0) {
                console.log(`[AggregationSeeder] No data found for ${div}`);
                results.push({ division: div, gang: "ALL", employees_processed: 0, status: "SKIPPED: No data" });
                continue;
            }

            console.log(`[AggregationSeeder] Fetched ${allRecords.length} records for ${div}`);

            let savedCount = 0;
            let totalEmployees = 0;

            for (const record of allRecords) {
                // Insert into DB
                // Note: We use targetDivisionCode (e.g. ESTATE_A_VIRTUAL) even if data came from source (ESTATE_A_1)
                // This matches previous logic? 
                // Wait, previous logic: "targetDivisionCode = div" (virtual)
                // And inside loop: "Iterate source divisions" -> "fetchRawTreeData(sourceDiv)" 
                // -> "insertOrUpdateAggregation(targetDivisionCode, ..., record)"
                // Yes, so we map all records to the targetDivisionCode.

                await insertOrUpdateAggregation(targetDivisionCode, month, year, record, sourceEndpoint);
                savedCount++;
                totalEmployees += record.total_employees;
            }

            results.push({
                division: div,
                gang: `Count: ${savedCount}`,
                employees_processed: totalEmployees,
                status: "SUCCESS"
            });

        } catch (error: any) {
            console.error(`[AggregationSeeder] Error processing ${div}:`, error);
            results.push({ division: div, gang: "ALL", employees_processed: 0, status: "ERROR: " + error.message });
        }
    }

    return results;
}









// Process each gang from the raw-tree response






async function fetchAvailableDivisions(): Promise<string[]> {
    // Get real divisions only + MILL. Virtual divisions (WKS_PG, WKS_AR, NRS, INF)
    // are derived from the real source divisions at read time by the summary service.
    const realDivisions = await divisionDefinition.getAllDivisions(false);
    return [...realDivisions, 'MILL']; // MILL is special, not virtual but needs manual seeding
}

async function checkDivisionHasData(division: string, month: number, year: number): Promise<boolean> {
    try {
        // Use Config.DB_PROFILE for payroll data (main payroll database)
        const result = await dataExtractorService.extractPayrollData(
            month, year, "ALL", division, null, Config.DB_PROFILE
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

    // Map internal division code to DB standardized code (e.g. PG1A -> P1A)
    const dbDivisionCode = DIVISION_CODE_MAP[division] || division;

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
                    total_premi_insentif = ?,
                    total_premi_kinerja = ?,
                    total_premi = ?,
                    total_potongan = ?,
                    total_pph21 = ?,
                    total_bpjs_pekerja = ?,
                    total_bpjs_majikan = ?,
                    total_spsi = ?,
                    total_upah_kotor = ?,
                    total_upah_bersih = ?,
                    total_ffb_weight = ?,
                    total_weight_tbs = ?,
                    dynamic_premi_data = ?,
                    informasi_tambahan = ?,
                    total_koreksi = ?,
                    updated_at = GETDATE(),
                    source_endpoint = ?
                WHERE id = ?
            `, [
                dbDivisionCode, // Use mapped code
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
                aggregation.total_premi_insentif,
                aggregation.total_premi_kinerja,
                aggregation.total_premi,
                aggregation.total_potongan,
                aggregation.total_pph21,
                aggregation.total_bpjs_pekerja,
                aggregation.total_bpjs_majikan,
                aggregation.total_spsi,
                aggregation.total_upah_kotor,
                aggregation.total_upah_bersih,
                aggregation.total_ffb_weight,
                aggregation.total_weight_tbs,
                aggregation.dynamic_premi_data,
                aggregation.informasi_tambahan,
                aggregation.total_koreksi,
                sourceEndpoint,
                existing.id
            ]);
        } else {
            // Insert new record - using ? placeholders for consistency
            // GETDATE() is used directly in SQL for timestamp fields
            await db.query(`
                INSERT INTO dbo.daftar_upah_aggregation_history (
                    period_month, period_year, division_code, gang_code, gang_description,
                    total_employees, total_hk, total_hari_kerja,
                    total_cuti_tahunan, total_cuti_sakit, total_cuti_minggu, total_cuti_nasional,
                    total_upah_dasar, total_upah_pokok, total_gaji_pokok,
                    total_beras, total_jabatan, total_masa_kerja, total_lembur, total_tunjangan,
                    total_premi_brondol, total_premi_prunning, total_premi_insentif, total_premi_kinerja, total_premi,
                    total_potongan, total_pph21, total_bpjs_pekerja, total_bpjs_majikan, total_spsi,
                    total_upah_kotor, total_upah_bersih, total_ffb_weight, total_weight_tbs,
                    dynamic_premi_data, informasi_tambahan, total_koreksi,
                    created_at, updated_at, source_endpoint
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE(), ?
                )
            `, [
                month,
                year,
                dbDivisionCode, // Use mapped code
                aggregation.gang_code,
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
                aggregation.total_premi_insentif,
                aggregation.total_premi_kinerja,
                aggregation.total_premi,
                aggregation.total_potongan,
                aggregation.total_pph21,
                aggregation.total_bpjs_pekerja,
                aggregation.total_bpjs_majikan,
                aggregation.total_spsi,
                aggregation.total_upah_kotor,
                aggregation.total_upah_bersih,
                aggregation.total_ffb_weight,
                aggregation.total_weight_tbs,
                aggregation.dynamic_premi_data,
                aggregation.informasi_tambahan,
                aggregation.total_koreksi,
                sourceEndpoint
            ]);
        }
    } catch (error) {
        console.error("[InsertAggregation] Error:", error);
        throw error;
    }
}

// Division mapping for standardization (Internal -> DB/Mill)
const DIVISION_CODE_MAP: Record<string, string> = {
    "PG1A": "P1A", "PG1B": "P1B", "PG2A": "P2A", "PG2B": "P2B",
    "ARB1": "AB1", "ARB2": "AB2",
    "INFRA": "INF", "ARC": "ARC",
    // Ensure 3-letter codes map to themselves or remain as is if not in list
    "DME": "DME", "ARA": "ARA", "IJL": "IJL", "MILL": "MILL"
};

async function fetchFfbWeightForDivision(divisionCode: string, month: number, year: number): Promise<number> {
    try {
        const db = Database.getMillInstance();

        // Use mapped code if available, otherwise original
        const searchCode = DIVISION_CODE_MAP[divisionCode] || divisionCode;

        // Use fuzzy match for division code in both SupplierName and CustomerCode
        const matchPattern = `%${searchCode}%`;

        const result = await db.queryOne<{ total_weight: string }>(`
            SELECT SUM(CAST(T.[NetWeight] AS DECIMAL(18,2))) / 1000.0 AS total_weight
            FROM [dbo].[WM_TICKET] T
            LEFT JOIN [dbo].[PU_SUPPLIER] S ON T.[CustomerCode] = S.[SupplierCode]
            WHERE T.[CustomerCode] LIKE 'PTRJ%'
              AND MONTH(T.[DateReceived]) = ?
              AND YEAR(T.[DateReceived]) = ?
              AND T.[ProductCode] = 'FFB'
              AND (S.[Name] LIKE ? OR T.[CustomerCode] LIKE ?)
        `, [month, year, matchPattern, matchPattern]);

        if (result && result.total_weight) {
            const weight = parseFloat(result.total_weight);
            console.log(`[FFB] ${divisionCode} (mapped: ${searchCode}): ${weight.toFixed(2)} tons`);
            return weight;
        }

        // Debug: List available suppliers for this period if no match
        // This helps us see if the division name is different (e.g. 'DME' vs 'ESTATE DME')
        const debugCheck = await db.query<{ Code: string, Name: string }>(`
            SELECT DISTINCT TOP 5 T.CustomerCode as Code, S.Name
            FROM [dbo].[WM_TICKET] T
            LEFT JOIN [dbo].[PU_SUPPLIER] S ON T.[CustomerCode] = S.[SupplierCode]
            WHERE T.[CustomerCode] LIKE 'PTRJ%'
              AND MONTH(T.[DateReceived]) = ?
              AND YEAR(T.[DateReceived]) = ?
        `, [month, year]);

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


/**
 * Fetch Mill Data from VenusHR database (SERVER_PROFILE_3)
 */
async function fetchMillData(month: number, year: number) {
    const db = Database.getVenusInstance();
    const monthStr = month.toString().padStart(2, '0');
    const pyNumberPattern = `PYW/PTRJ/${year}${monthStr}%`;

    console.log(`[AggregationSeeder] Fetching MILL data for pattern: ${pyNumberPattern}`);

    // 1. Get Total HK and Employees
    // Using provided logic: (Total_Data_Karyawan * DaysInMonth) - (Total_Mangkir + Total_Unpaid_Leave + Total_Sakit_With_Note)
    const hkQuery = `
        SELECT 
            (Total_Data_Karyawan * DaysInMonth) - (Total_Mangkir + Total_Unpaid_Leave + Total_Sakit_With_Note) AS total_HK,
            Total_Data_Karyawan AS total_employees
        FROM (
            SELECT 
                COUNT([EmployeeID]) AS Total_Data_Karyawan,
                SUM(ISNULL([TAAbsence], 0)) AS Total_Mangkir,
                SUM(ISNULL([UnpaidLeave], 0)) AS Total_Unpaid_Leave,
                SUM(ISNULL([TASick], 0)) AS Total_Sakit_With_Note,
                DAY(EOMONTH(CAST(SUBSTRING(MAX([PYNumber]), 10, 6) + '01' AS DATE))) AS DaysInMonth
            FROM [dbo].[HR_T_PYWeekly_M]
            WHERE [PYNumber] LIKE ? 
        ) AS Subquery;
    `;

    const hkResult = await db.queryOne<{ total_HK: number, total_employees: number }>(hkQuery, [pyNumberPattern]);

    // 2. Get Total Salary (Take Home Pay)
    const salaryQuery = `
        SELECT CAST(SUM([CompAmount]) AS BIGINT) AS TotalCompAmount
        FROM [dbo].[HR_T_PYWeekly_DComponent]
        WHERE [PYNumber] LIKE ?
          AND [IsTakeHomePay] = 1
    `;

    const salaryResult = await db.queryOne<{ TotalCompAmount: number }>(salaryQuery, [pyNumberPattern]);

    return {
        total_hk: hkResult?.total_HK || 0,
        total_employees: hkResult?.total_employees || 0,
        total_salary: salaryResult?.TotalCompAmount || 0
    };
}
