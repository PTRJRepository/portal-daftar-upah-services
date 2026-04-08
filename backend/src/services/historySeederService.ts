/**
 * History Seeder Service
 * 
 * Service ini menangani proses seeding data history dari database real-time
 * ke database history (extend_db_ptrj dan extend_db_ptrj_transaksi).
 * 
 * Digunakan ketika RUN_MODE=prod untuk menyimpan snapshot data payroll
 * pada bulan yang dipilih.
 */

import { Database } from "../db/client";
import { Config } from "../config";
import { historyDatabaseService, PayrollHistoryMaster, PayrollHistoryDetail, HistoryTaskreg, HistoryAdtrans, HistoryGangMember, HistoryMetadata, HistoryHrEmployee, HistoryHrGang } from "./historyDatabaseService";
import { dataExtractorService } from "./dataExtractorService";
import { gangService } from "./gangService";
import { divisionConfigService } from "./config/DivisionConfigService";
import { PayrollDataService } from "./payrollDataService";
import { employeeHrDataService } from "./employeeHrDataService";
import { employeeGangHistoryService } from "./employeeGangHistoryService";
import { duplicateNikMitigationService } from "./DuplicateNikMitigationService";

export interface SeederResult {
    success: boolean;
    history_id: string;
    period_month: number;
    period_year: number;
    division_code: string;
    gang_code: string;
    total_employees: number;
    records_inserted: {
        master: number;
        detail: number;
        taskreg: number;
        adtrans: number;
        gang_member: number;
        hr_employee?: number;
        hr_gang?: number;
    };
    errors: string[];
}

export interface SeederOptions {
    periodMonth: number;
    periodYear: number;
    divisionCode?: string;
    gangCode?: string;  // Optional, if not provided will seed all gangs in division
    createdBy: string;
    ipAddress?: string;
    userAgent?: string;
    force?: boolean;  // Overwrite existing data
    seederMode?: 'ALL' | 'PAYROLL' | 'PAYROLL_ONLY' | 'EMPLOYEE_HR' | 'GANG_HR' | 'ALL_HR';
}
export interface SeederProgress {
    is_running: boolean;
    current_step: string;
    current_division?: string;
    current_gang?: string;
    period?: string;
    gangs_total: number;
    gangs_done: number;
    employees_processed: number;
    started_at?: string;
    last_update?: string;
}

export class HistorySeederService {
    // Static progress tracker
    private static progress: SeederProgress = {
        is_running: false,
        current_step: 'idle',
        gangs_total: 0,
        gangs_done: 0,
        employees_processed: 0
    };

    // Timeout protection (30 minutes max)
    private static readonly MAX_RUN_TIME_MS = 30 * 60 * 1000; // 30 minutes
    private static startTime: number | null = null;
    private static timeoutCheckInterval: NodeJS.Timeout | null = null;

    public static getProgress(): SeederProgress {
        // Check if seeder is stuck (running too long)
        if (HistorySeederService.progress.is_running && HistorySeederService.startTime) {
            const elapsed = Date.now() - HistorySeederService.startTime;
            if (elapsed > HistorySeederService.MAX_RUN_TIME_MS) {
                console.error(`[HistorySeeder] ⚠️ Seeder detected as STUCK! Running for ${Math.round(elapsed / 1000)}s (max: ${HistorySeederService.MAX_RUN_TIME_MS / 1000}s). Force resetting...`);
                HistorySeederService.forceReset('Stuck timeout - auto reset');
            }
        }
        return { ...HistorySeederService.progress };
    }

    private static updateProgress(update: Partial<SeederProgress>) {
        Object.assign(HistorySeederService.progress, update, { last_update: new Date().toISOString() });
    }

    /**
     * Force reset the seeder progress (for stuck seeder recovery)
     */
    public static forceReset(reason: string = 'Manual reset'): void {
        console.warn(`[HistorySeeder] Force resetting progress. Reason: ${reason}`);
        if (HistorySeederService.timeoutCheckInterval) {
            clearInterval(HistorySeederService.timeoutCheckInterval);
            HistorySeederService.timeoutCheckInterval = null;
        }
        HistorySeederService.startTime = null;
        HistorySeederService.progress = {
            is_running: false,
            current_step: '⚠️ Reset: ' + reason,
            gangs_total: 0,
            gangs_done: 0,
            employees_processed: 0,
            last_update: new Date().toISOString()
        };
    }

    private static instance: HistorySeederService;

    private constructor() { }

    public static getInstance(): HistorySeederService {
        if (!HistorySeederService.instance) {
            HistorySeederService.instance = new HistorySeederService();
        }
        return HistorySeederService.instance;
    }

    /**
     * Main method to seed payroll history data
     */
    public async seedPayrollHistory(options: SeederOptions): Promise<SeederResult> {
        const startTime = Date.now();
        const result: SeederResult = {
            success: false,
            history_id: '',
            period_month: options.periodMonth,
            period_year: options.periodYear,
            division_code: options.divisionCode || 'ALL',
            gang_code: options.gangCode || 'ALL',
            total_employees: 0,
            records_inserted: {
                master: 0,
                detail: 0,
                taskreg: 0,
                adtrans: 0,
                gang_member: 0,
                hr_employee: 0,
                hr_gang: 0
            },
            errors: []
        };

        // Check if another seeder is already running
        if (HistorySeederService.progress.is_running && !options.force) {
            const elapsed = HistorySeederService.startTime 
                ? Math.round((Date.now() - HistorySeederService.startTime) / 1000) 
                : 0;
            console.warn(`[HistorySeeder] ⚠️ Seeder already running for ${elapsed}s. Rejecting new request.`);
            result.errors.push(`Seeder already running (started ${elapsed}s ago). Please wait or force reset.`);
            return result;
        }

        // [OPTIMIZATION] If divisionCode is 'ALL', process divisions one by one
        // to prevent timeout and memory issues in extractPayrollData
        if ((!options.divisionCode || options.divisionCode === 'ALL') && (options.gangCode === 'ALL' || !options.gangCode)) {
            console.log(`[HistorySeeder] 🔄 Processing ALL divisions iteratively...`);

            // ⚠️ REMOVED: Initial DELETE ALL - each division will delete its own data before insert
            // This ensures if one division fails, other divisions' data remains intact

            HistorySeederService.updateProgress({
                is_running: true,
                current_step: 'Memulai seeding seluruh divisi...',
                period: `${options.periodMonth}/${options.periodYear}`,
                current_division: 'ALL',
                started_at: new Date().toISOString()
            });

            try {
                const { gangService } = await import("./gangService");
                const allDivisions = await gangService.getAllDivisions();
                console.log(`[HistorySeeder] Found ${allDivisions.length} divisions to process: ${allDivisions.join(', ')}`);

                for (let i = 0; i < allDivisions.length; i++) {
                    const div = allDivisions[i];
                    HistorySeederService.updateProgress({
                        current_step: `Processing division ${div} (${i + 1}/${allDivisions.length})...`,
                        current_division: div,
                        is_running: true // Keep running status
                    });

                    // Recursive call for single division
                    const divOptions = { ...options, divisionCode: div, force: true };
                    // Temporarily set progress to false so the recursive call isn't rejected
                    const oldProgress = { ...HistorySeederService.progress };
                    HistorySeederService.progress.is_running = false;
                    
                    const divResult = await this.seedPayrollHistory(divOptions);
                    
                    // Restore overall running status
                    HistorySeederService.progress.is_running = true;

                    // Accumulate results
                    if (divResult.success) {
                        result.total_employees += divResult.total_employees;
                        result.records_inserted.master += divResult.records_inserted.master;
                        result.records_inserted.detail += divResult.records_inserted.detail;
                        result.records_inserted.taskreg += divResult.records_inserted.taskreg;
                        result.records_inserted.adtrans += divResult.records_inserted.adtrans;
                        result.records_inserted.gang_member += divResult.records_inserted.gang_member;
                        result.records_inserted.hr_employee += divResult.records_inserted.hr_employee || 0;
                        result.records_inserted.hr_gang += divResult.records_inserted.hr_gang || 0;
                    } else if (divResult.errors.length > 0) {
                        result.errors.push(`[${div}] ${divResult.errors.join('; ')}`);
                    }

                    // Optional short delay between divisions
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                result.success = true;
                result.history_id = 'BATCH-' + Date.now().toString(36).toUpperCase();
                const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
                HistorySeederService.updateProgress({
                    is_running: false,
                    current_step: `✅ Selesai! Seeding ${allDivisions.length} divisi berhasil dalam ${totalTime}s.`,
                    current_division: 'DONE'
                });
                return result;
            } catch (error: any) {
                console.error(`[HistorySeeder] Batch seeding failed:`, error);
                HistorySeederService.updateProgress({ is_running: false, current_step: `❌ Gagal: ${error.message}` });
                result.errors.push(`Batch seeding failed: ${error.message}`);
                return result;
            }
        }

        console.log(`[HistorySeeder] =======================================`);
        console.log(`[HistorySeeder] Starting payroll history seeding`);
        console.log(`[HistorySeeder] Period: ${options.periodMonth}/${options.periodYear}`);
        console.log(`[HistorySeeder] Division: ${options.divisionCode || 'ALL'}, Gang: ${options.gangCode || 'ALL'}`);
        console.log(`[HistorySeeder] Mode: ${options.seederMode || 'PAYROLL'}`);
        console.log(`[HistorySeeder] =======================================`);

        try {
            // ⚠️ CRITICAL FIX: DELETE old data BEFORE seeding to prevent duplicates
            // This ensures clean data when re-seeding same division/period
            console.log(`[HistorySeeder] 🗑️  Step 0: Cleaning old data for ${options.divisionCode || 'ALL'} period ${options.periodMonth}/${options.periodYear}...`);
            
            try {
                const deleteHistoryDb = Database.getExtendedInstance();
                
                // Build WHERE clause
                const whereClauses: string[] = ['period_month = ?', 'period_year = ?'];
                const deleteParams: any[] = [options.periodMonth, options.periodYear];

                if (options.divisionCode && options.divisionCode !== 'ALL') {
                    whereClauses.push('division_code = ?');
                    deleteParams.push(options.divisionCode);
                }

                if (options.gangCode && options.gangCode !== 'ALL') {
                    whereClauses.push('gang_code = ?');
                    deleteParams.push(options.gangCode);
                }

                const whereClause = whereClauses.join(' AND ');
                const deleteSql = `DELETE FROM dbo.daftar_upah_aggregation_history WHERE ${whereClause}`;

                console.log(`[HistorySeeder] 🗑️  SQL: ${deleteSql}`);
                console.log(`[HistorySeeder] 🗑️  Params: ${JSON.stringify(deleteParams)}`);
                
                // First, check what we're about to delete
                const checkSql = deleteSql.replace('DELETE FROM', 'SELECT COUNT(*) as cnt FROM');
                const checkResult = await deleteHistoryDb.query(checkSql, deleteParams);
                const countBefore = checkResult?.[0]?.cnt || 0;
                console.log(`[HistorySeeder] 📊 Found ${countBefore} records to delete`);

                if (countBefore > 0) {
                    // Show sample of what will be deleted
                    const sampleSql = deleteSql.replace('DELETE FROM', 'SELECT TOP 3 division_code, gang_code FROM').split('WHERE')[0] + ' WHERE ' + deleteSql.split('WHERE')[1];
                    // Or more simply, just replace the starting part properly:
                    const simpleSampleSql = deleteSql.replace('DELETE FROM', 'SELECT TOP 3 division_code, gang_code FROM');
                    const sampleResult = await deleteHistoryDb.query(sampleSql, deleteParams);
                    console.log(`[HistorySeeder] 📋 Sample data to delete:`, sampleResult);

                    // Execute delete
                    await deleteHistoryDb.query(deleteSql, deleteParams);
                    console.log(`[HistorySeeder] ✅ Delete executed`);

                    // Verify deletion
                    const verifyResult = await deleteHistoryDb.query(checkSql, deleteParams);
                    const countAfter = verifyResult?.[0]?.cnt || 0;
                    console.log(`[HistorySeeder] ✅ Records remaining: ${countAfter}`);

                    if (countAfter > 0) {
                        console.log(`[HistorySeeder] ❌ WARNING: ${countAfter} records still remain!`);
                        const remainingSample = await deleteHistoryDb.query(sampleSql, deleteParams);
                        console.log(`[HistorySeeder] ❌ Remaining data:`, remainingSample);
                    }
                } else {
                    console.log(`[HistorySeeder] ℹ️  No old data found to delete`);
                }

            } catch (deleteError: any) {
                console.error(`[HistorySeeder] ❌ Delete failed:`, deleteError.message);
                console.error(`[HistorySeeder] ❌ Stack:`, deleteError.stack);
                result.errors.push(`Delete old data failed: ${deleteError.message}`);
            }

            // Set start time for timeout protection
            HistorySeederService.startTime = Date.now();

            // Reset progress
            HistorySeederService.updateProgress({
                is_running: true,
                current_step: 'Memulai seeding...',
                period: `${options.periodMonth}/${options.periodYear}`,
                current_division: options.divisionCode || 'ALL',
                gangs_total: 0, gangs_done: 0, employees_processed: 0,
                started_at: new Date().toISOString()
            });

            // Generate history_id
            const historyId = historyDatabaseService.generateHistoryId();
            result.history_id = historyId;

            // [FIX] Delete existing history for this division/period/gang to prevent duplication
            // This ensures idempotent seeding - running seeder multiple times produces same result
            //
            // CRITICAL: Only delete if a SPECIFIC divisionCode is provided.
            // If divisionCode is undefined (seeding ALL divisions), DO NOT delete
            // because the DELETE would wipe ALL history for that period across all divisions.
            // The absence of divisionCode means "additive" seeding - preserve existing data.
            if (options.force && options.divisionCode) {
                console.log(`[HistorySeeder] Deleting existing history for ${options.divisionCode}/${options.gangCode || 'ALL'} (${options.periodMonth}/${options.periodYear})...`);
                await historyDatabaseService.deleteHistoryForPeriodAndLocation(
                    options.periodMonth,
                    options.periodYear,
                    options.divisionCode,
                    options.gangCode
                );
            } else if (!options.force) {
                console.log(`[HistorySeeder] force=false - skipping delete (preserving existing history data)`);
            } else {
                console.log(`[HistorySeeder] No specific divisionCode provided - skipping delete to preserve existing data from other divisions`);
            }

            const seederMode = options.seederMode || 'PAYROLL';

            // PAYROLL SEEDER
            if (seederMode === 'ALL' || seederMode === 'PAYROLL') {
                // 1. Get payroll data from real-time database
                HistorySeederService.updateProgress({ current_step: 'Mengambil data payroll live...' });
                let payrollData: any[] = [];
                let totalEmployeesInData = 0;
                try {
                    payrollData = await this.fetchPayrollData(options);
                    console.log(`[HistorySeeder] fetchPayrollData returned ${payrollData.length} gangs`);
                    // Calculate total employees for progress display
                    for (const gang of payrollData) {
                        totalEmployeesInData += gang.employees?.length || 0;
                    }
                    console.log(`[HistorySeeder] Total employees in fetched data: ${totalEmployeesInData}`);
                } catch (fetchError: any) {
                    console.error(`[HistorySeeder] fetchPayrollData failed: ${fetchError.message}`);
                    result.errors.push(`Fetch payroll data failed: ${fetchError.message}`);
                    // CRITICAL: Update progress to mark as complete (not stuck)
                    HistorySeederService.updateProgress({
                        is_running: false,
                        current_step: `❌ Gagal mengambil data: ${fetchError.message}`,
                        gangs_total: 0,
                        gangs_done: 0,
                        employees_processed: 0
                    });
                    return result;
                }

                if (!payrollData || payrollData.length === 0) {
                    const periodStr = `${options.periodMonth}/${options.periodYear}`;
                    const divisionStr = options.divisionCode || 'ALL';
                    console.warn(`[HistorySeeder] No payroll data found for period ${periodStr}, division ${divisionStr}`);

                    // Provide more context for debugging
                    result.errors.push(
                        `No payroll data found for period ${periodStr} (Division: ${divisionStr}). ` +
                        `Possible causes: ` +
                        `1) Data does not exist in PR_GANGLN_ARC for accounting period, ` +
                        `2) HR_GANGLN has no employees for this gang/division, ` +
                        `3) Period conversion mismatch (calendar vs accounting period). ` +
                        `Suggestion: Try mode 'ALL_HR' to save HR data only, or check if raw payroll data exists in the database.`
                    );

                    if (seederMode === 'PAYROLL') {
                        // CRITICAL: Update progress to mark as complete (not stuck)
                        HistorySeederService.updateProgress({
                            is_running: false,
                            current_step: `⚠️ Tidak ada data untuk periode ${periodStr}. Coba mode ALL_HR atau periksa database.`,
                            gangs_total: 0,
                            gangs_done: 0,
                            employees_processed: 0
                        });
                        return result;
                    }
                    // For 'ALL' mode, continue to try HR data seeding
                } else {
                    // 2. Seed master and detail
                    HistorySeederService.updateProgress({ gangs_total: payrollData.length, current_step: 'Menyimpan data payroll per gang...', employees_processed: 0 });
                    for (let gi = 0; gi < payrollData.length; gi++) {
                        const gangData = payrollData[gi];
                        try {
                            HistorySeederService.updateProgress({
                                current_step: `Menyimpan gang ${gangData.gang_code || '?'} (${gi + 1}/${payrollData.length})`,
                                current_gang: gangData.gang_code,
                                gangs_done: gi,
                                employees_processed: result.total_employees
                            });
                            await this.seedGangHistory(historyId, gangData, options, result);
                        } catch (error: any) {
                            result.errors.push(`Error seeding gang ${gangData.gang_code}: ${error.message}`);
                        }
                    }
                    HistorySeederService.updateProgress({
                        gangs_done: payrollData.length,
                        employees_processed: result.total_employees,
                        current_step: 'Menyimpan data transaksi...'
                    });

                    // 3. Seed transaction data (with timeout protection)
                    console.log(`[HistorySeeder] Starting transaction seeding...`);
                    try {
                        // Transaction seeding can take a long time. We'll wrap it with a timeout
                        // If it takes more than 5 minutes, we'll skip it and continue
                        const TX_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
                        await Promise.race([
                            this.seedTransactionData(historyId, options, result),
                            new Promise((_, reject) =>
                                setTimeout(() => reject(new Error('Transaction seeding timeout after 5 minutes - skipping')), TX_TIMEOUT_MS)
                            )
                        ]).catch((err) => {
                            console.warn(`[HistorySeeder] ⚠️ Transaction seeding issue: ${err.message}`);
                            console.warn(`[HistorySeeder] ⚠️ Skipping transaction data - manual intervention may be needed`);
                        });
                        console.log(`[HistorySeeder] Transaction seeding step completed (may have skipped)`);
                    } catch (error: any) {
                        console.error(`[HistorySeeder] Error in seedTransactionData:`, error);
                        console.error(`[HistorySeeder] Error stack:`, error.stack);
                        result.errors.push(`Error seeding transactions: ${error.message}`);
                    }

                    // 4. Seed gang member data
                    await this.seedGangMemberData(historyId, options, result);
                }
            }

            // EXTENDED HR SEEDERS

            // EMPLOYEE HR SEEDER
            if (seederMode === 'ALL' || seederMode === 'ALL_HR' || seederMode === 'EMPLOYEE_HR') {
                HistorySeederService.updateProgress({ current_step: 'Menyimpan data HR Karyawan...' });
                await this.seedEmployeeHrHistory(historyId, options, result);
            }

            // GANG HR SEEDER
            if (seederMode === 'ALL' || seederMode === 'ALL_HR' || seederMode === 'GANG_HR') {
                HistorySeederService.updateProgress({ current_step: 'Menyimpan data HR Gang...' });
                await this.seedGangHrHistory(historyId, options, result);
            }

            // 5. Save metadata
            await this.saveSeederMetadata(historyId, options, result);

            const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
            result.success = result.errors.length === 0;

            console.log(`[HistorySeeder] =======================================`);
            console.log(`[HistorySeeder] Seeding completed in ${totalTime}s`);
            console.log(`[HistorySeeder] Success: ${result.success}`);
            console.log(`[HistorySeeder] Total employees: ${result.total_employees}`);
            console.log(`[HistorySeeder] Records: ${JSON.stringify(result.records_inserted)}`);
            if (result.errors.length > 0) {
                console.log(`[HistorySeeder] Errors: ${result.errors.join(', ')}`);
            }
            console.log(`[HistorySeeder] =======================================`);

            HistorySeederService.updateProgress({ is_running: false, current_step: result.success ? '✅ Selesai!' : '⚠️ Selesai dengan error' });
            HistorySeederService.startTime = null; // Reset timeout tracker

        } catch (error: any) {
            result.errors.push(`Fatal error: ${error.message}`);
            HistorySeederService.updateProgress({ is_running: false, current_step: `❌ Error: ${error.message}` });
            HistorySeederService.startTime = null; // Reset timeout tracker
        }

        return result;
    }

    /**
     * Helper: Retry a function with exponential backoff on timeout
     */
    private async withRetry<T>(fn: () => Promise<T>, context: string, maxRetries: number = 3): Promise<T> {
        let lastError: any;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error: any) {
                lastError = error;
                const isTimeout = error.message?.includes('timed out') ||
                    error.message?.includes('timeout') ||
                    error.message?.includes('Gateway returned 500');

                if (isTimeout && attempt < maxRetries) {
                    const delay = attempt * 2000; // 2s, 4s, 6s
                    console.warn(`[HistorySeeder] ${context} timeout (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw error;
                }
            }
        }
        throw lastError;
    }

    /**
     * Fetch payroll data from real-time database
     */
    private async fetchPayrollData(options: SeederOptions): Promise<any[]> {
        // Use dataExtractorService to get payroll data
        const authToken = 'system'; // Internal token for seeder

        // IMPORTANT: Pass useHistoryDb=false to force reading from the LIVE database.
        // Without this, extractPayrollData intercepts historical periods and tries to
        // read from the history DB (which is empty — it's the DB we're trying to seed!).
        console.log(`[HistorySeeder] Fetching payroll data for ${options.periodMonth}/${options.periodYear}...`);
        console.log(`[HistorySeeder] Division: ${options.divisionCode || 'ALL'}, Gang: ${options.gangCode || 'ALL'}`);

        console.log(`[HistorySeeder] Calling extractPayrollData...`);
        const rawData = await this.withRetry(async () => {
            return await dataExtractorService.extractPayrollData(
                options.periodMonth,
                options.periodYear,
                options.gangCode || 'ALL',
                options.divisionCode,
                null,
                Config.DB_PROFILE,
                false,  // includeVirtualGangs
                false   // useHistoryDb — always read from live DB for seeding
            );
        }, 'extractPayrollData');
        console.log(`[HistorySeeder] extractPayrollData completed, ${rawData.data_rows?.length || 0} rows`);

        // Group by gang
        const gangMap = new Map<string, any[]>();

        // ⚠️ CRITICAL: EXCLUDE virtual division gangs from parent division
        // WKS_PG (AMC) should be SEPARATE from P1A
        // WKS_AR (HMC) should be SEPARATE from AB2
        const virtualGangCodes = new Set<string>();
        const virtualDivs = divisionConfigService.getVirtualDivisions();
        virtualDivs.forEach(vDiv => {
            if (vDiv.sourceDivision === options.divisionCode && vDiv.gangPattern) {
                // Mark gangs matching this virtual pattern
                virtualGangCodes.add(vDiv.gangCode || '');
            }
        });
        // Also explicitly add known virtual gangs
        virtualGangCodes.add('AMC');  // WKS_PG
        virtualGangCodes.add('HMC');  // WKS_AR

        console.log(`[HistorySeeder] ⚠️ Excluding virtual gangs from parent: ${Array.from(virtualGangCodes).join(', ')}`);

        for (const row of rawData.data_rows) {
            const gangCode = row.gang_code;
            
            // Skip virtual gangs when seeding parent division
            if (virtualGangCodes.has(gangCode)) {
                console.log(`[HistorySeeder] ⏭️ Skipping virtual gang ${gangCode} from ${options.divisionCode}`);
                continue;
            }
            
            if (!gangMap.has(gangCode)) {
                gangMap.set(gangCode, []);
            }
            gangMap.get(gangCode)!.push(row);
        }

        // Convert to array
        const result: any[] = [];
        for (const [gangCode, employees] of gangMap) {
            result.push({
                gang_code: gangCode,
                employees: employees
            });
        }

        return result;
    }

    /**
     * Seed history for a single gang
     */
    private async seedGangHistory(
        historyId: string,
        gangData: any,
        options: SeederOptions,
        result: SeederResult
    ): Promise<void> {
        const employees = gangData.employees;
        console.log(`[HistorySeeder] seedGangHistory: gang=${gangData.gang_code}, employees count=${employees?.length || 0}`);

        if (!employees || employees.length === 0) {
            console.warn(`[HistorySeeder] ⚠️ No employees for gang ${gangData.gang_code}, skipping`);
            return;
        }

        // Debug: Log first employee structure
        if (employees.length > 0) {
            const firstEmp = employees[0];
            console.log(`[HistorySeeder] First employee: ${JSON.stringify({
                emp_code: firstEmp.emp_code,
                nik: firstEmp.nik,
                nama: firstEmp.nama || firstEmp.emp_name,
                gang_code: firstEmp.gang_code,
                loc_code: firstEmp.loc_code
            })}`);
        }

        // Calculate totals
        const totals = this.calculateTotals(employees);

        // Create master record
        const masterData: PayrollHistoryMaster = {
            history_id: historyId,
            period_month: options.periodMonth,
            period_year: options.periodYear,
            division_code: options.divisionCode || 'ALL',
            gang_code: gangData.gang_code,
            gang_description: gangData.gang_code, // Will be updated with actual description
            total_employees: employees.length,
            ...totals,
            created_by: options.createdBy,
            source_endpoint: '/api/history/seed',
            is_locked: false
        };

        const masterId = await historyDatabaseService.savePayrollHistoryMaster(masterData);
        result.records_inserted.master++;

        // Create detail records - with duplicate NIK handling
        for (const emp of employees) {
            // Use new method that handles duplicate NIKs
            // Pass options.divisionCode to ensure detail uses correct division (not loc_code)
            await this.handleDuplicateNikSeeding(historyId, masterId, emp, options, result, options.divisionCode);
        }
    }

    /**
     * Calculate totals from employee data
     */
    private calculateTotals(employees: any[]): any {
        const totals = {
            total_hk: 0,
            total_hari_kerja: 0,
            total_cuti_tahunan: 0,
            total_cuti_sakit: 0,
            total_cuti_minggu: 0,
            total_cuti_nasional: 0,
            total_upah_dasar: 0,
            total_upah_pokok: 0,
            total_gaji_pokok: 0,
            total_beras: 0,
            total_jabatan: 0,
            total_call_jabatan: 0,
            total_masa_kerja: 0,
            total_lembur: 0,
            total_tunjangan: 0,
            total_premi_brondol: 0,
            total_premi_prunning: 0,
            total_premi_insentif: 0,
            total_premi_kinerja: 0,
            total_premi: 0,
            total_koreksi: 0,
            total_potongan: 0,
            total_pph21: 0,
            total_bpjs_pekerja: 0,
            total_bpjs_majikan: 0,
            total_spsi: 0,
            total_upah_kotor: 0,
            total_upah_bersih: 0
        };

        for (const emp of employees) {
            totals.total_hk += emp.jumlah_hk || 0;
            totals.total_hari_kerja += emp.hari_kerja || 0;
            totals.total_cuti_tahunan += emp.cuti_tahunan_hari || 0;
            totals.total_cuti_sakit += emp.cuti_sakit_haid_hari || 0;
            totals.total_cuti_minggu += emp.cuti_minggu_hari || 0;
            totals.total_cuti_nasional += emp.cuti_nasional_hari || 0;
            totals.total_upah_dasar += emp.upah_dasar || 0;
            totals.total_upah_pokok += emp.upah_pokok || 0;
            totals.total_gaji_pokok += emp.gaji_pokok || 0;
            totals.total_beras += emp.beras_jumlah || 0;
            totals.total_jabatan += emp.jabatan_jumlah || 0;
            totals.total_masa_kerja += emp.masa_kerja_jumlah || 0;
            totals.total_lembur += emp.lembur_jumlah || 0;
            totals.total_tunjangan += emp.total_tunjangan || 0;
            totals.total_premi_brondol += emp.premi_brondol || 0;
            totals.total_premi += emp.total_premi || 0;
            totals.total_koreksi += emp.pot_koreksi || 0;
            totals.total_potongan += emp.total_potongan || 0;
            
            // Use pot_pph21 from database (actual deduction from PR_ADTRANS)
            totals.total_pph21 += emp.pot_pph21 || 0;
            
            totals.total_bpjs_pekerja += emp.pot_bpjs_pekerja_total || 0;
            totals.total_bpjs_majikan += (emp.pot_bpjs_kesehatan_majikan || 0) + (emp.pot_bpjs_pensiun_majikan || 0) + (emp.pot_astek_majikan || 0);
            totals.total_spsi += emp.pot_spsi || 0;
            totals.total_upah_kotor += emp.jumlah_upah_kotor || 0;
            totals.total_upah_bersih += emp.upah_bersih || 0;
        }

        return totals;
    }

    /**
     * Map employee data to detail record
     * @param divisionCode - The correct division code to use (from header), not loc_code which may be short form
     */
    private mapEmployeeToDetail(historyId: string, masterId: number, emp: any, divisionCode?: string): PayrollHistoryDetail {
        return {
            history_id: historyId,
            master_id: masterId,
            emp_code: emp.emp_code || emp.nik,  // EmpCode (e.g. A0023), fallback to nik
            emp_name: emp.nama || emp.emp_name,
            nik: emp.nik,  // PayrollRow.nik = actual KTP (NewICNo)
            gender: emp.jenis_kelamin || emp.gender,
            gang_code: emp.gang_code,
            division_code: divisionCode || emp.division_code || emp.loc_code, // Use passed divisionCode (from header) for consistency
            loc_code: emp.loc_code,
            status_ptkp: emp.status_ptkp,
            kategori_ter: emp.kategori_ter,
            hari_kerja: emp.hari_kerja || 0,
            cuti_tahunan_hari: emp.cuti_tahunan_hari || 0,
            cuti_sakit_haid_hari: emp.cuti_sakit_haid_hari || 0,
            cuti_minggu_hari: emp.cuti_minggu_hari || 0,
            cuti_nasional_hari: emp.cuti_nasional_hari || 0,
            jumlah_hk: emp.jumlah_hk || 0,
            total_jam_kerja: emp.total_jam_kerja || 0,
            upah_dasar: emp.upah_dasar || 0,
            upah_pokok: emp.upah_pokok || 0,
            gaji_pokok: emp.gaji_pokok || 0,
            gaji_pokok_ideal: emp.gaji_pokok_ideal || 0,
            gaji_pokok_aktual: emp.gaji_pokok_aktual || 0,
            koreksi_hk: emp.koreksi_hk || 0,
            beras_rate: emp.beras_rate || 0,
            beras_jumlah: emp.beras_jumlah || 0,
            jabatan_rate: emp.jabatan_rate || 0,
            jabatan_jumlah: emp.jabatan_jumlah || 0,
            masa_kerja_tahun: emp.masa_kerja_tahun || 0,
            masa_kerja_rate: emp.masa_kerja_rate || 0,
            masa_kerja_jumlah: emp.masa_kerja_jumlah || 0,
            lembur_jam: emp.lembur_jam || 0,
            lembur_rate: emp.lembur_rate || 0,
            lembur_jumlah: emp.lembur_jumlah || 0,
            lembur_records: emp.lembur_records ? JSON.stringify(emp.lembur_records) : undefined,
            total_tunjangan: emp.total_tunjangan || 0,
            // [PHASE 2.5] Brondol dual source breakdown
            premi_brondol: emp.premi_brondol || 0,  // Keep for backward compatibility (combined total)
            premi_brondol_loosefruit: emp.premi_brondol_loosefruit || 0,
            premi_brondol_adtrans: emp.premi_brondol_adtrans || 0,
            premi_brondol_total: emp.premi_brondol_total || (emp.premi_brondol || 0),
            premi_pph: emp.premi_pph || 0,
            total_premi: emp.total_premi || 0,
            premi_detail: emp.premi ? JSON.stringify(emp.premi) : undefined,
            pot_spsi: emp.pot_spsi || 0,
            pot_pph21: emp.pot_pph21 || 0,
            pot_koreksi: emp.pot_koreksi || 0,
            pot_bpjs_kesehatan_pekerja: emp.pot_bpjs_kesehatan_pekerja || 0,
            pot_bpjs_kesehatan_majikan: emp.pot_bpjs_kesehatan_majikan || 0,
            pot_bpjs_pensiun_pekerja: emp.pot_bpjs_pensiun_pekerja || 0,
            pot_bpjs_pensiun_majikan: emp.pot_bpjs_pensiun_majikan || 0,
            pot_bpjs_pekerja_total: emp.pot_bpjs_pekerja_total || 0,
            pot_astek_pekerja: emp.pot_astek_pekerja || emp.pot_astek || 0,
            pot_astek_majikan: emp.pot_astek_majikan || emp.pot_astek_maj || 0,
            pot_astek_jumlah: emp.pot_astek_jumlah || 0,
            potongan_detail: this.extractDynamicPotonganDetail(emp),
            total_potongan: emp.total_potongan || 0,
            total_potongan_bersih: emp.total_potongan_bersih || 0,
            jumlah_upah_kotor: emp.jumlah_upah_kotor || 0,
            upah_kotor_pajak: emp.upah_kotor_pajak || 0,
            penghasilan_bruto: emp.penghasilan_bruto || 0,
            tarif_pajak_ter: emp.tarif_pajak_ter,
            pph21_ter: emp.pph21_ter || 0,
            upah_bersih: emp.upah_bersih || 0,
            task_code: emp.task_code,
            task_desc: emp.task_desc,
            shortage_details: emp.shortage_details ? JSON.stringify(emp.shortage_details) : undefined,
            shortage_total_hours: emp.shortage_total_hours
        };
    }

    /**
     * Extract dynamic potongan fields (KOREKSI_*, POTONGAN_*) from employee row
     * and serialize as JSON for storage in history detail.
     */
    private extractDynamicPotonganDetail(emp: any): string | undefined {
        const potonganData: Record<string, number> = {};
        for (const key of Object.keys(emp)) {
            if ((key.startsWith('KOREKSI') || key.startsWith('POTONGAN_')) && typeof emp[key] === 'number' && emp[key] !== 0) {
                potonganData[key] = emp[key];
            }
        }
        return Object.keys(potonganData).length > 0 ? JSON.stringify(potonganData) : undefined;
    }

    /**
     * NEW: Handle duplicate NIK when seeding history
     * Ensures all EmpCodes for a duplicate NIK are included in history
     */
    private async handleDuplicateNikSeeding(
        historyId: string,
        masterId: number,
        emp: any,
        options: SeederOptions,
        result: SeederResult,
        divisionCode?: string
    ): Promise<void> {
        const nik = emp?.nik;

        // Safety check: if nik is missing, skip this employee
        if (!nik) {
            console.warn(`[HistorySeeder] ⚠️ Skipping employee with missing NIK: ${JSON.stringify({ emp_code: emp?.emp_code, nama: emp?.nama || emp?.emp_name })}`);
            return;
        }

        try {
            // Check if this NIK has duplicates
            const hasDuplicate = await duplicateNikMitigationService.hasDuplicate(nik);

            if (hasDuplicate) {
                // Get all EmpCodes for this NIK
                const empCodeMap = await duplicateNikMitigationService.getAllEmpCodesForNik(nik);

                // Log for audit
                console.log(`[HistorySeeder] Duplicate NIK detected: ${nik} has ${empCodeMap.emp_codes.length} EmpCodes: ${empCodeMap.emp_codes.join(', ')}`);

                // Create detail records for ALL EmpCodes associated with this NIK
                // This ensures complete history coverage
                for (const empCode of empCodeMap.emp_codes) {
                    const detailData = this.mapEmployeeToDetail(historyId, masterId, {
                        ...emp,
                        emp_code: empCode // Override with each EmpCode
                    }, divisionCode);

                    await historyDatabaseService.savePayrollHistoryDetail(detailData);
                    result.records_inserted.detail++;
                }

                result.total_employees += empCodeMap.emp_codes.length;
            } else {
                // Normal flow - single employee
                const detailData = this.mapEmployeeToDetail(historyId, masterId, emp, divisionCode);
                await historyDatabaseService.savePayrollHistoryDetail(detailData);
                result.records_inserted.detail++;
                result.total_employees += 1;
            }
        } catch (err: any) {
            // Log error but don't fail the whole gang
            console.error(`[HistorySeeder] Error handling NIK ${nik}: ${err.message}`);
            // Try to save at least one record
            try {
                const detailData = this.mapEmployeeToDetail(historyId, masterId, emp, divisionCode);
                await historyDatabaseService.savePayrollHistoryDetail(detailData);
                result.records_inserted.detail++;
                result.total_employees += 1;
            } catch (saveErr: any) {
                console.error(`[HistorySeeder] Failed to save fallback record for NIK ${nik}: ${saveErr.message}`);
            }
        }
    }

    /**
     * Seed transaction data (Taskreg and ADTrans)
     * Uses chunking to avoid SQL Server timeout on large IN clauses
     * ⚠️ FIXED: Now DELETE old data BEFORE INSERT to prevent duplicates
     */
    private async seedTransactionData(
        historyId: string,
        options: SeederOptions,
        result: SeederResult
    ): Promise<void> {
        // Use ExtendedInstance for history tables in extend_db_ptrj
        const dbExtend = Database.getExtendedInstance();
        // Use Instance for source tables in db_ptrj
        const dbSource = Database.getInstance();

        // ⚠️ CRITICAL FIX: DELETE old transaction data BEFORE insert to prevent duplicates
        console.log(`[HistorySeeder] 🗑️  Deleting old transaction data for period ${options.periodMonth}/${options.periodYear}, division ${options.divisionCode}...`);

        try {
            // Delete old taskreg history for this division/period
            // Note: payroll_history_header is the actual table name (not history_payroll_master)
            const deleteTaskregResult = await dbExtend.query(`
                DELETE ht FROM history_taskreg ht
                INNER JOIN payroll_history_header hpm ON ht.history_id = hpm.history_id
                WHERE hpm.period_month = ?
                  AND hpm.period_year = ?
                  AND hpm.division_code = ?
            `, [options.periodMonth, options.periodYear, options.divisionCode || 'ALL']);
            console.log(`[HistorySeeder] ✅ Deleted ${deleteTaskregResult.affectedRows || 0} old taskreg rows`);

            // Delete old adtrans history for this division/period
            const deleteAdtransResult = await dbExtend.query(`
                DELETE ha FROM history_adtrans ha
                INNER JOIN payroll_history_header hpm ON ha.history_id = hpm.history_id
                WHERE hpm.period_month = ?
                  AND hpm.period_year = ?
                  AND hpm.division_code = ?
            `, [options.periodMonth, options.periodYear, options.divisionCode || 'ALL']);
            console.log(`[HistorySeeder] ✅ Deleted ${deleteAdtransResult.affectedRows || 0} old adtrans rows`);

        } catch (deleteError: any) {
            console.warn(`[HistorySeeder] ⚠️ Failed to delete old transaction data: ${deleteError.message}`);
            // Continue anyway - don't block seeding if delete fails
        }

        const startDate = `${options.periodYear}-${options.periodMonth.toString().padStart(2, '0')}-01`;
        const nextMonth = options.periodMonth === 12 ? 1 : options.periodMonth + 1;
        const nextYear = options.periodMonth === 12 ? options.periodYear + 1 : options.periodYear;
        const endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;

        // Get employee codes for this division/gang
        console.log(`[HistorySeeder] Getting employee codes for ${options.divisionCode}...`);
        const empCodes = await this.withRetry(
            () => this.getEmployeeCodes(options),
            'getEmployeeCodes'
        );

        console.log(`[HistorySeeder] Found ${empCodes.length} employee codes`);

        if (empCodes.length === 0) {
            console.log(`[HistorySeeder] No employee codes found, skipping transaction seeding`);
            return;
        }

        // Chunk empCodes to avoid SQL timeout on large IN clauses
        const CHUNK_SIZE = 100;
        const chunks: string[][] = [];
        for (let i = 0; i < empCodes.length; i += CHUNK_SIZE) {
            chunks.push(empCodes.slice(i, i + CHUNK_SIZE));
        }
        console.log(`[HistorySeeder] Seeding transactions in ${chunks.length} chunks (${CHUNK_SIZE} empCodes each)`);

        // 1. Seed Taskreg data - fetch AND save in same chunk
        try {
            for (const chunk of chunks) {
                const taskregRows = await this.withRetry(async () => {
                    const empList = chunk.map(e => `'${e}'`).join(',');
                    return await dbSource.query<any>(`
                        SELECT
                            tr.ID as master_id, tr.DocID as RegNo, tr.DocDate as RegDate,
                            trl.ID as line_id, trl.EmpCode, trl.TrxDate, trl.TaskCode,
                            trl.Hours, trl.OT, trl.Rate, trl.Amount
                        FROM PR_TASKREGLN trl
                        JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
                        WHERE trl.EmpCode IN (${empList})
                          AND trl.TrxDate >= '${startDate}' AND trl.TrxDate < '${endDate}'

                        UNION ALL

                        SELECT
                            tr.ID as master_id, tr.DocID as RegNo, tr.DocDate as RegDate,
                            trl.ID as line_id, trl.EmpCode, trl.TrxDate, trl.TaskCode,
                            trl.Hours, trl.OT, trl.Rate, trl.Amount
                        FROM PR_TASKREGLN_ARC trl
                        JOIN PR_TASKREG_ARC tr ON tr.ID = trl.MasterID
                        WHERE trl.EmpCode IN (${empList})
                          AND trl.TrxDate >= '${startDate}' AND trl.TrxDate < '${endDate}'
                    `, []);
                }, 'seedTransactionData Taskreg chunk');

                // Save each row
                for (const row of taskregRows) {
                    const taskregData: HistoryTaskreg = {
                        history_id: historyId,
                        original_master_id: row.master_id,
                        reg_no: row.RegNo,
                        reg_date: row.RegDate,
                        emp_code: row.EmpCode?.trim(),
                        original_line_id: row.line_id,
                        line_no: undefined,  // Column 'Line' doesn't exist in PR_TASKREGLN
                        trx_date: row.TrxDate,
                        task_code: row.TaskCode?.trim(),
                        hours: row.Hours || 0,
                        ot: row.OT === 1 || row.OT === true,
                        rate: row.Rate,
                        amount: row.Amount || 0,
                        tapping_type: '',
                        is_cuti_tahunan: false,
                        is_cuti_sakit: false,
                        is_cuti_minggu: false,
                        is_cuti_nasional: false,
                        is_hari_kerja: true,
                        is_lembur: row.OT === 1 || row.OT === true,
                        period_month: options.periodMonth,
                        period_year: options.periodYear,
                        source_table: row.master_id > 1000000000 ? 'PR_TASKREG_ARC' : 'PR_TASKREG'
                    };
                    await historyDatabaseService.saveTaskregHistory(taskregData);
                    result.records_inserted.taskreg++;
                }
            }
            console.log(`[HistorySeeder] Taskreg seeding completed`);
        } catch (error: any) {
            result.errors.push(`Error seeding taskreg: ${error.message}`);
        }

        // 2. Seed ADTrans data - fetch AND save in same chunk
        try {
            for (const chunk of chunks) {
                const adtransRows = await this.withRetry(async () => {
                    const empList = chunk.map(e => `'${e}'`).join(',');
                    return await dbSource.query<any>(`
                        SELECT
                            t.ID as master_id, t.DocID as DocNo, t.DocDate, t.DocDesc, t.EmpCode,
                            ln.ID as line_id, ln.TaskCode, ln.Amount,
                            tc.TaskDesc
                        FROM PR_ADTRANSLN ln
                        JOIN PR_ADTRANS t ON t.ID = ln.MasterID
                        LEFT JOIN PR_TASKCODE tc ON ln.TaskCode = tc.TaskCode
                        WHERE t.EmpCode IN (${empList})
                          AND t.DocDate >= '${startDate}' AND t.DocDate < '${endDate}'

                        UNION ALL

                        SELECT
                            t.ID as master_id, t.DocID as DocNo, t.DocDate, t.DocDesc, t.EmpCode,
                            ln.ID as line_id, ln.TaskCode, ln.Amount,
                            tc.TaskDesc
                        FROM PR_ADTRANSLN_ARC ln
                        JOIN PR_ADTRANS_ARC t ON t.ID = ln.MasterID
                        LEFT JOIN PR_TASKCODE tc ON ln.TaskCode = tc.TaskCode
                        WHERE t.EmpCode IN (${empList})
                          AND t.DocDate >= '${startDate}' AND t.DocDate < '${endDate}'
                    `, []);
                }, 'seedTransactionData ADTrans chunk');

                // Save each row
                for (const row of adtransRows) {
                    const docDesc = (row.DocDesc || '').toUpperCase();
                    const taskDesc = (row.TaskDesc || '').toUpperCase();

                    let category = 'OTHER';
                    let subCategory: string | undefined;

                    if (docDesc.includes('PREMI') || docDesc.includes('PRUN') || docDesc.includes('INSENTIF') || docDesc.includes('PANEN') || docDesc.includes('KINERJA')) {
                        category = 'PREMI';
                        if (docDesc.includes('BRONDOL')) subCategory = 'BRONDOL';
                        else if (docDesc.includes('PRUN')) subCategory = 'PRUNING';
                        else if (docDesc.includes('INSENTIF')) subCategory = 'INSENTIF';
                        else if (docDesc.includes('KINERJA')) subCategory = 'KINERJA';
                    } else if (docDesc.includes('BERAS') || docDesc.includes('JABATAN') || docDesc.includes('MASA KERJA') || docDesc.includes('LEMBUR')) {
                        category = 'TUNJANGAN';
                        if (docDesc.includes('BERAS')) subCategory = 'BERAS';
                        else if (docDesc.includes('JABATAN')) subCategory = 'JABATAN';
                        else if (docDesc.includes('MASA')) subCategory = 'MASA_KERJA';
                        else if (docDesc.includes('LEMBUR')) subCategory = 'LEMBUR';
                    } else if (docDesc.includes('KOREKSI') || docDesc.includes('POT') || docDesc.includes('PPH') || docDesc.includes('SPSI') || docDesc.includes('BPJS')) {
                        category = 'POTONGAN';
                        if (docDesc.includes('KOREKSI')) subCategory = 'KOREKSI';
                        else if (docDesc.includes('PPH')) subCategory = 'PPH21';
                        else if (docDesc.includes('SPSI')) subCategory = 'SPSI';
                        else if (docDesc.includes('BPJS')) subCategory = 'BPJS';
                    }

                    const adtransData: HistoryAdtrans = {
                        history_id: historyId,
                        original_master_id: row.master_id,
                        doc_no: row.DocNo?.trim(),
                        doc_date: row.DocDate,
                        doc_desc: row.DocDesc?.trim(),
                        emp_code: row.EmpCode?.trim(),
                        original_line_id: row.line_id,
                        line_no: undefined,  // Column 'Line' doesn't exist in PR_ADTRANSLN
                        task_code: row.TaskCode?.trim(),
                        task_desc: row.TaskDesc?.trim(),
                        amount: row.Amount || 0,
                        quantity: undefined,  // Column 'Qty' doesn't exist in PR_ADTRANSLN
                        uom: '',
                        category,
                        sub_category: subCategory,
                        is_dynamic: false,
                        is_premi_pph: taskDesc.includes('ACCRUALS-CHECKROLL'),
                        is_koreksi: docDesc.includes('KOREKSI'),
                        is_potongan: docDesc.includes('POT') || docDesc.includes('POTONGAN'),
                        is_premi: docDesc.includes('PREMI'),
                        period_month: options.periodMonth,
                        period_year: options.periodYear,
                        source_table: row.master_id > 1000000000 ? 'PR_ADTRANS_ARC' : 'PR_ADTRANS'
                    };
                    await historyDatabaseService.saveAdtransHistory(adtransData);
                    result.records_inserted.adtrans++;
                }
            }
            console.log(`[HistorySeeder] ADTrans seeding completed`);
        } catch (error: any) {
            result.errors.push(`Error seeding ADTrans: ${error.message}`);
        }
    }

    /**
     * Seed gang member data
     */
    private async seedGangMemberData(
        historyId: string,
        options: SeederOptions,
        result: SeederResult
    ): Promise<void> {
        const db = Database.getInstance();

        try {
            // Get current period gang members
            let sql = `
                SELECT
                    g.GangCode, g.Description as GangDesc, g.LocCode,
                    gl.GangMember as EmpCode, e.EmpName, em.AppJoinGrpDate, e.NewICNo
                FROM HR_GANG g
                JOIN HR_GANGLN gl ON g.GangCode = gl.GangCode
                JOIN HR_EMPLOYEE e ON gl.GangMember = e.EmpCode
                LEFT JOIN HR_EMPLOYMENT em ON e.EmpCode = em.EmpCode
                WHERE 1=1
            `;

            const queryParams: any[] = [];

            if (options.divisionCode && options.divisionCode !== 'ALL') {
                // Use unified division mapping for LocCode filtering
                const locCodes = gangService.getAllDivisionAliases(options.divisionCode);
                const placeholders = locCodes.map(() => '?').join(',');
                sql += ` AND g.LocCode IN (${placeholders})`;
                queryParams.push(...locCodes);
            }

            if (options.gangCode && options.gangCode !== 'ALL') {
                sql += ` AND g.GangCode = ?`;
                queryParams.push(options.gangCode);
            }

            // Order by date to help with latest code resolution
            sql += ` ORDER BY em.AppJoinGrpDate DESC`;

            const gangMembers = await db.query<any>(sql, queryParams);
            
            // Resolve latest codes
            const niks = gangMembers.map((r: any) => r.NewICNo?.trim()).filter(Boolean);
            const latestEmpCodeMap = await employeeGangHistoryService.resolveLatestEmpCodes(niks);

            for (const row of gangMembers) {
                const nikClean = row.NewICNo?.trim().toUpperCase() || "";
                const latestEmpCode = latestEmpCodeMap.get(nikClean) || row.EmpCode;

                const gangMemberData: HistoryGangMember = {
                    history_id: historyId,
                    gang_code: row.GangCode?.trim(),
                    gang_description: row.GangDesc?.trim(),
                    division_code: options.divisionCode || 'ALL',
                    loc_code: row.LocCode?.trim(),
                    emp_code: latestEmpCode?.trim(),
                    emp_name: row.EmpName?.trim(),
                    nik: row.NewICNo?.trim(),
                    jabatan: '',  // Jabatan will be enriched separately
                    period_month: options.periodMonth,
                    period_year: options.periodYear,
                    join_date: row.AppJoinGrpDate,
                    is_active: true,
                    source_table: 'HR_GANGLN'
                };

                await historyDatabaseService.saveGangMemberHistory(gangMemberData);
                result.records_inserted.gang_member++;
            }
        } catch (error: any) {
            result.errors.push(`Error seeding gang members: ${error.message}`);
        }
    }

    /**
     * EXTENDED: Seed Employee HR History
     */
    private async seedEmployeeHrHistory(
        historyId: string,
        options: SeederOptions,
        result: SeederResult
    ): Promise<void> {
        const db = Database.getInstance();

        try {
            let sql = `
                SELECT
                    e.NewICNo as nik,
                    e.EmpCode as emp_code,
                    e.EmpName as emp_name,
                    em.CompCode as company_code,
                    g.LocCode as division_code,
                    g.LocCode as loc_code,
                    g.GangCode as gang_code,
                    -- JobCode, Position, TaxStatus don't exist in HR_PAYROLL - use NULL
                    NULL as job_code,
                    NULL as position,
                    em.AppJoinGrpDate as join_date,
                    em.TerminateDate as terminate_date,
                    e.Status as status,
                    e.HREmpType as employee_type,
                    e.Gender as gender,
                    e.Religion as religion,
                    e.MaritalStatus as marital_status,
                    e.PlaceOfBirth as birth_place,
                    e.DOB as birth_date,
                    -- PayRate & RiceRation are the ONLY valid columns in HR_PAYROLL
                    p.PayRate as upah_dasar,
                    CAST(p.RiceRation AS VARCHAR) as ptkp_beras,
                    NULL as ptkp_pajak,
                    COALESCE((
                        SELECT SUM(Hours)/7.0
                        FROM PR_TASKREG tr
                        JOIN PR_TASKREGLN trl ON tr.ID = trl.MasterID
                        WHERE trl.EmpCode = e.EmpCode
                          AND MONTH(trl.TrxDate) = ${options.periodMonth}
                          AND YEAR(trl.TrxDate) = ${options.periodYear}
                    ), 0) as total_hk
                FROM HR_EMPLOYEE e
                JOIN HR_EMPLOYMENT em ON e.EmpCode = em.EmpCode
                LEFT JOIN HR_GANGLN gl ON e.EmpCode = gl.GangMember
                LEFT JOIN HR_GANG g ON gl.GangCode = g.GangCode
                -- JOIN HR_PAYROLL to get rates (PayRate, JobCode, RiceRation only - Position & TaxStatus don't exist)
                LEFT JOIN HR_PAYROLL p ON RTRIM(p.EmpCode) = RTRIM(e.EmpCode)
                WHERE 1=1
            `;

            const empQueryParams: any[] = [];

            if (options.divisionCode && options.divisionCode !== 'ALL') {
                // Use unified division mapping for LocCode filtering
                const locCodes = gangService.getAllDivisionAliases(options.divisionCode);
                const placeholders = locCodes.map(() => '?').join(',');
                sql += ` AND g.LocCode IN (${placeholders})`;
                empQueryParams.push(...locCodes);
            }

            if (options.gangCode && options.gangCode !== 'ALL') {
                sql += ` AND g.GangCode = ?`;
                empQueryParams.push(options.gangCode);
            }

            // ORDER BY to help with latest resolution
            sql += ` ORDER BY em.AppJoinGrpDate DESC`;

            const employees = await db.query<any>(sql, empQueryParams);

            if (!result.records_inserted['hr_employee']) {
                result.records_inserted['hr_employee'] = 0;
            }

            // Resolve latest codes
            const niks = employees.map((r: any) => r.nik?.trim()).filter(Boolean);
            const latestEmpCodeMap = await employeeGangHistoryService.resolveLatestEmpCodes(niks);

            for (const row of employees) {
                const nikClean = row.nik?.trim().toUpperCase() || "";
                const latestEmpCode = latestEmpCodeMap.get(nikClean) || row.emp_code;

                const hrData: HistoryHrEmployee = {
                    history_id: historyId,
                    period_month: options.periodMonth,
                    period_year: options.periodYear,
                    nik: row.nik?.trim(),
                    emp_code: latestEmpCode?.trim(),
                    emp_name: row.emp_name?.trim(),
                    company_code: row.company_code?.trim(),
                    division_code: row.division_code?.trim(),
                    loc_code: row.loc_code?.trim(),
                    gang_code: row.gang_code?.trim(),
                    job_code: row.job_code?.trim() || undefined,
                    position: row.position?.trim() || undefined,
                    join_date: row.join_date,
                    terminate_date: row.terminate_date,
                    status: row.status?.trim(),
                    employee_type: row.employee_type?.trim(),
                    gender: row.gender?.trim(),
                    religion: row.religion?.trim(),
                    birth_place: row.birth_place?.trim(),
                    birth_date: row.birth_date,
                    marital_status: row.marital_status?.trim(),
                    tax_status: row.tax_status?.trim() || undefined,
                    ptkp_beras: row.ptkp_beras?.trim() || undefined,
                    ptkp_pajak: row.ptkp_pajak?.trim() || undefined,
                    // upah_dasar: use actual PayRate from HR_PAYROLL
                    // NOTE: PayRate can be 0 for valid cases (new employees, terminated, etc.)
                    // DO NOT change this to skip/filter on 0 value - 0 is valid
                    upah_dasar: row.upah_dasar ?? 0,
                    total_hk: row.total_hk || 0,
                    source_table: 'HR_EMPLOYEE_JOIN'
                };

                await historyDatabaseService.saveHrEmployeeHistory(hrData);
                result.records_inserted['hr_employee']++;
            }
        } catch (error: any) {
            result.errors.push(`Error seeding Employee HR: ${error.message}`);
        }
    }

    /**
     * EXTENDED: Seed Gang HR History
     */
    private async seedGangHrHistory(
        historyId: string,
        options: SeederOptions,
        result: SeederResult
    ): Promise<void> {
        const db = Database.getInstance();

        try {
            let sql = `
                SELECT 
                    g.LocCode as division_code,
                    g.LocCode as loc_code,
                    g.GangCode as gang_code,
                    g.Description as gang_description,
                    g.GangLeader as mandor_code,
                    m1.EmpName as mandor_name,
                    NULL as mandor_1_code,
                    NULL as mandor_1_name,
                    NULL as assistant_code,
                    NULL as assistant_name,
                    (SELECT COUNT(*) FROM HR_GANGLN gl WHERE gl.GangCode = g.GangCode) as total_members
                FROM HR_GANG g
                LEFT JOIN HR_EMPLOYEE m1 ON g.GangLeader = m1.EmpCode
                WHERE 1=1
            `;

            const gangQueryParams: any[] = [];

            if (options.divisionCode && options.divisionCode !== 'ALL') {
                // Use unified division mapping for LocCode filtering
                const locCodes = gangService.getAllDivisionAliases(options.divisionCode);
                const placeholders = locCodes.map(() => '?').join(',');
                sql += ` AND g.LocCode IN (${placeholders})`;
                gangQueryParams.push(...locCodes);
            }

            if (options.gangCode && options.gangCode !== 'ALL') {
                sql += ` AND g.GangCode = ?`;
                gangQueryParams.push(options.gangCode);
            }

            const gangs = await db.query<any>(sql, gangQueryParams);

            if (!result.records_inserted['hr_gang']) {
                result.records_inserted['hr_gang'] = 0;
            }

            for (const row of gangs) {
                const hrGang: HistoryHrGang = {
                    history_id: historyId,
                    period_month: options.periodMonth,
                    period_year: options.periodYear,
                    division_code: row.division_code?.trim(),
                    loc_code: row.loc_code?.trim(),
                    gang_code: row.gang_code?.trim(),
                    gang_description: row.gang_description?.trim(),
                    mandor_code: row.mandor_code?.trim(),
                    mandor_name: row.mandor_name?.trim(),
                    mandor_1_code: row.mandor_1_code?.trim(),
                    mandor_1_name: row.mandor_1_name?.trim(),
                    assistant_code: row.assistant_code?.trim(),
                    assistant_name: row.assistant_name?.trim(),
                    total_members: row.total_members || 0,
                    is_active: true, // Assuming active if present in current gang iteration
                    source_table: 'HR_GANG'
                };

                await historyDatabaseService.saveHrGangHistory(hrGang);
                result.records_inserted['hr_gang']++;
            }
        } catch (error: any) {
            result.errors.push(`Error seeding Gang HR: ${error.message}`);
        }
    }

    /**
     * Get employee codes for the specified division/gang
     */
    private async getEmployeeCodes(options: SeederOptions): Promise<string[]> {
        const db = Database.getInstance();

        let sql = `
            SELECT RTRIM(e.EmpCode) as emp_code
            FROM HR_EMPLOYEE e
            INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
            INNER JOIN HR_GANG g ON RTRIM(g.GangCode) = RTRIM(gl.GangCode)
        `;

        const empCodeParams: any[] = [];

        if (options.divisionCode && options.divisionCode !== 'ALL') {
            // Use unified division mapping for LocCode filtering
            const locCodes = gangService.getAllDivisionAliases(options.divisionCode);
            const placeholders = locCodes.map(() => '?').join(',');
            sql += ` WHERE g.LocCode IN (${placeholders})`;
            empCodeParams.push(...locCodes);
        } else {
            sql += ` WHERE 1=1`;
        }

        if (options.gangCode && options.gangCode !== 'ALL') {
            sql += ` AND g.GangCode = ?`;
            empCodeParams.push(options.gangCode);
        }

        const rows = await db.query<{ emp_code: string }>(sql, empCodeParams);
        // Remove duplicates in JavaScript instead of SQL
        const uniqueEmpCodes = [...new Set(rows.map(r => r.emp_code))];
        return uniqueEmpCodes;
    }

    /**
     * Save seeder metadata
     */
    private async saveSeederMetadata(
        historyId: string,
        options: SeederOptions,
        result: SeederResult
    ): Promise<void> {
        const metadata: HistoryMetadata = {
            history_id: historyId,
            operation: 'CREATE',
            entity_type: 'BATCH',
            period_month: options.periodMonth,
            period_year: options.periodYear,
            division_code: options.divisionCode,
            gang_code: options.gangCode,
            description: `Seeded payroll history for ${options.divisionCode} - ${options.gangCode || 'ALL'}`,
            new_values: JSON.stringify(result.records_inserted),
            record_count: result.total_employees,
            status: result.success ? 'SUCCESS' : 'FAILED',
            error_message: result.errors.length > 0 ? result.errors.join('; ') : undefined,
            performed_by: options.createdBy,
            ip_address: options.ipAddress,
            user_agent: options.userAgent
        };

        await historyDatabaseService.saveHistoryMetadata(metadata);
    }
}

export const historySeederService = HistorySeederService.getInstance();
