import { Database } from "../db/client";
import { Config } from "../config";
import { payrollService } from "./payrollService";
import { gangService } from "./gangService";
import { lemburCalculator } from "./lemburCalculator";
import { EmployeeEstateService } from "./employeeEstateService";
import { calculatePph21Ter } from "./pph21TerService";
import { currentPeriodService } from "./currentPeriodService";
import { PayrollComponentMetadata } from "../types/payroll/PayrollComponent";
import { harvesterService } from "./harvesterService";
import { historyDatabaseService } from "./historyDatabaseService";
// Import new unified component services
import { lemburService, premiService, tunjanganService, potonganService, pph21TerService, payrollComponentRegistry } from "./payroll";
import { gajiPokokService } from "./payroll/components/GajiPokokService";
import { manualAdjustmentService } from "./manualAdjustmentService";
import { employeeHrDataService } from "./employeeHrDataService";
import { divisionDefinition } from "./divisionDefinition";
import { employeeGangHistoryService } from "./employeeGangHistoryService";
import { OtherIncomesService } from "./otherIncomesService";
import { calculateAllCaruman, getCarumanForPph21 } from './carumanDefinitions';
import { cacheService } from './cacheService';
import { debug, info, warn, error as logError } from "../utils/logger";

const CATEGORY = "DataExtractor";

interface EmployeeRow {
    emp_code: string;
    emp_name: string;
    gender: string;
    loc_code: string;
    gang_code: string;
    pay_rate: number;
    beras_rate: number;
    join_date: string | null;
    actual_nik?: string;
}

interface CutiData {
    cuti_tahunan: number;
    cuti_sakit_haid: number;
    cuti_minggu: number;
    cuti_nasional: number;
}

interface LemburData {
    jam: number;
    jumlah: number;
}

interface LemburRecord {
    trx_date: string;
    task_code: string;
    task_desc: string;
    day_type: string;
    hours: number;
    rate: number;
    amount: number;
    record_count?: number; // Number of transactions grouped (for grouped task breakdown)
    meta?: PayrollComponentMetadata;
}

interface LemburDataWithDetails extends LemburData {
    records: LemburRecord[];
}

interface ShortageDetail {
    date: string;
    day_name: string;
    actual_hours: number;
    target_hours: number;
    shortage_hours: number;
}

interface ExcessDetail {
    date: string;
    day_name: string;
    actual_hours: number;
    target_hours: number;
    excess_hours: number;
}

interface PayrollRow {
    emp_code?: string;
    nik: string;
    nama: string;
    jabatan_estate?: string;
    jenis_kelamin: string;
    status_ptkp: string;
    kategori_ter: string;
    loc_code: string;
    gang_code: string;
    upah_dasar: number;
    jumlah_hk: number;
    total_jam_kerja: number;
    has_shortage?: boolean;
    shortage_details?: ShortageDetail[];
    shortage_total_hours?: number;
    has_excess?: boolean;
    excess_details?: ExcessDetail[];
    excess_total_hours?: number;
    hk_warning?: string; // 'kurang_jam' | 'salah_scan' | null
    hari_kerja: number;
    gaji_pokok: number;
    kehadiran: number;
    cuti_tahunan_hari: number;
    cuti_sakit_haid_hari: number;
    cuti_minggu_hari: number;
    cuti_nasional_hari: number;
    // Task/Job Code fields
    task_code?: string;
    task_desc?: string;
    task_type?: string;
    task_uom?: string;
    beras_rate: number;
    beras_jumlah: number;
    jabatan_rate: number;
    jabatan_jumlah: number;
    masa_kerja_tahun: number;
    masa_kerja_rate: number;
    masa_kerja_jumlah: number;
    lembur_jam: number;
    lembur_rate: number;
    lembur_jumlah: number;
    lembur_records?: Array<{
        trx_date: string;
        task_code: string;
        task_desc: string;
        day_type: string;
        hours: number;
        rate: number;
        amount: number;
        meta?: PayrollComponentMetadata;
    }>;
    // Harvest / Bunches fields (for harvest gangs ending with "H")
    bunches_total?: number;
    bunches_ripe?: number;
    bunches_unripe?: number;
    bunches_underripe?: number;
    bunches_overripe?: number;
    bunches_rotten?: number;
    bunches_abnormal?: number;
    loose_fruit?: number;
    bunches_transactions?: number;
    total_tunjangan: number;
    premi_brondol: number;
    // [PHASE 2.5] Brondol dual source breakdown
    premi_brondol_loosefruit: number;  // From PR_LOOSEFRUIT
    premi_brondol_adtrans: number;     // From PR_ADTRANS (DocDesc containing BRONDOL)
    premi_brondol_total: number;        // Combined total (loosefruit + adtrans)
    premi_pph: number; // PREMI PPH - ADDED (+) to upah_bersih, not subtracted
    total_premi: number;
    premi: Record<string, number>;
    premi_details?: any[];
    jumlah_upah_kotor: number;
    // Caruman ASTEK
    pot_astek_pekerja: number;
    pot_astek_majikan: number;
    pot_astek_jumlah: number;
    // BPJS Kesehatan
    pot_bpjs_kesehatan_pekerja: number;
    pot_bpjs_kesehatan_majikan: number;
    pot_bpjs_kesehatan_jumlah: number;
    // BPJS Pensiun
    pot_bpjs_pensiun_pekerja: number;
    pot_bpjs_pensiun_majikan: number;
    pot_bpjs_pensiun_jumlah: number;
    // New fields for Penggajian Group
    gaji_pokok_ideal: number;
    gaji_pokok_aktual: number;
    koreksi_hk: number;
    // Other deductions
    pot_spsi: number;
    pot_pph21: number;
    pot_koreksi: number;
    premi_koreksi: number;
    potongan_upah_kotor_total: number;
    potongan_upah_kotor_details?: {
        koreksi: number;
        total: number;
    };
    total_potongan: number;
    total_potongan_bersih: number;
    // New calculated tax fields
    // IMPORTANT: ASTEK and BPJS Kesehatan are calculated from payrate × 30 (monthly salary), NOT from actual HK
    gaji_pokok_bulanan: number; // payrate × 30 (for ASTEK/BPJS calculation)
    astek_084: number; // ASTEK/BPJS Pensiun Majikan (0.84%) - calculated from gaji_pokok_bulanan + masa_kerja_jumlah
    bpjs_kesehatan_majikan_4_pct: number; // BPJS Kesehatan Majikan (4%) - calculated from gaji_pokok_bulanan + masa_kerja_jumlah
    penghasilan_bruto: number; // For PPH21 TER: gaji_pokok_aktual + tunjangan + lembur + premi + astek_084 + bpjs_kesehatan_majikan_4_pct
    upah_kotor_pajak: number; // Jumlah Upah Kotor + Astek + BPJS Kesehatan (untuk header/pajak)
    // PPH21 TER fields
    tarif_pajak_ter: number; // TER rate as percentage (e.g., 5 for 5%)
    pph21_ter: number; // Calculated PPH21 amount using TER method
    pendapatan_tidak_tetap_thp: number;
    pendapatan_tidak_tetap_taxable: number;
    upah_bersih: number;
    pot_astek: number;
    pot_astek_maj: number;
    pot_bpjs_pekerja_total: number;
    // Other Incomes (THR, Bonus, Custom) - for display and calculation
    other_incomes?: { type: string; name: string; amount: number }[];
    // Taxable breakdown of other incomes (for PAJAK section)
    taxable_pendapatan_thr: number;
    taxable_pendapatan_bonus: number;
    taxable_pendapatan_custom: number;
    taxable_pendapatan_lainnya: number;
    [key: string]: any;
}

/**
 * Map beras_rate (RiceRation) to PTKP status
 * PTKP = Penghasilan Tidak Kena Pajak (Non-Taxable Income Status)
 * Based on RiceRation values from HR_PAYROLL
 */
function mapBerasRateToPTKP(berasRate: number): string {
    // Handle monthly bulk values
    if (berasRate && berasRate >= 10000) {
        berasRate = Math.round(berasRate / 30);
    }
    const mapping: Record<number, string> = {
        2250: 'TK/0',
        3250: 'TK/1',
        4200: 'TK/2',
        3700: 'K/0',
        4650: 'K/1',
        5500: 'K/2',
        6450: 'K/3',
        // Legacy DB formulas
        3150: 'TK/1',
        4050: 'TK/2',
        4950: 'TK/3',
        3600: 'K/0',
        4500: 'K/1',
        5400: 'K/2',
        6300: 'K/3',
        3750: 'K/0',
        5550: 'K/2',
    };
    return mapping[berasRate] || '-';
}

/**
 * Map PTKP status to TER (Tarif Efektif Rata-rata) category
 * Based on formula: IF(OR(PTKP="TK/0",PTKP="TK/1",PTKP="K/0"),"TER A",IF(PTKP="K/3","TER C","TER B"))
 */
function mapPTKPToTER(statusPTKP: string): string {
    if (!statusPTKP || statusPTKP === '-') return '-';
    if (statusPTKP === 'TK/0' || statusPTKP === 'TK/1' || statusPTKP === 'K/0') {
        return 'TER A';
    }
    if (statusPTKP === 'K/3') {
        return 'TER C';
    }
    return 'TER B';
}

function cleanNameFormat(name: string): string {
    if (!name) return '';
    return name.replace(/\([^)]*\)/g, '').replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
}

const DIVISION_TO_LOCCODE: Record<string, string> = {
    "PG1A": "P1A", "PG1B": "P1B", "PG2A": "P2A", "PG2B": "P2B",
    "DME": "DME", "ARA": "ARA", "ARB1": "AB1", "ARB2": "AB2",
    "INFRA": "INF", "ARC": "ARC", "IJL": "IJL"
};

export class DataExtractorService {
    private static instance: DataExtractorService;
    private db: Database;

    private constructor() {
        this.db = Database.getInstance();
    }

    public static getInstance(): DataExtractorService {
        if (!DataExtractorService.instance) {
            DataExtractorService.instance = new DataExtractorService();
        }
        return DataExtractorService.instance;
    }

    public async extractPayrollData(
        month: number,
        year: number,
        gangCode: string = "ALL",
        divisionCode?: string,
        specificEmpCode: string | null = null,
        serverProfile?: string,
        includeVirtualGangs: boolean = false,
        useHistoryDb?: boolean | null,
        gangPrefix?: string,
        skipHarvest: boolean = false
    ): Promise<{
        data_rows: PayrollRow[];
        dynamic_premi_headers: string[];
        dynamic_potongan_headers: string[];
        premi_title_map: Record<string, string>;
        potongan_title_map: Record<string, string>;
        meta: { execution_time_ms: number; row_count: number }
    }> {
        const startTime = Date.now();
        const startDate = `${year}-${month.toString().padStart(2, "0")}-01`;
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        const endDate = `${nextYear}-${nextMonth.toString().padStart(2, "0")}-01`;

        // Calculate days in the selected month for ideal salary calculation
        const daysInMonth = new Date(year, month, 0).getDate();

        // ============================================================
        // [OPTIMIZATION] Cache key based on all parameters
        // Cache is only active in production mode (see cacheService.ts)
        // Historical data (before current period) cached longer (1hr)
        // Current period data cached shorter (2min) for fresher reads
        // ============================================================
        const cacheKey = `payroll_data:${month}:${year}:${gangCode || 'ALL'}:${divisionCode || ''}:${specificEmpCode || ''}:${gangPrefix || ''}:${skipHarvest}`;
        const cached = cacheService.get<any>(cacheKey);
        if (cached) {
            debug(CATEGORY, `Cache HIT for ${cacheKey} (${cached.data_rows?.length || 0} rows)`);
            return { ...cached, meta: { ...cached.meta, _cache_hit: true } };
        }

        // ============================================================
        // [OPTIMIZATION] Parallelize: currentPeriod + gangService fetch together
        // ============================================================
        const [currentPeriod, allGangs] = await Promise.all([
            currentPeriodService.getCurrentPeriod(),
            gangService.fetchGangs(divisionCode || undefined, undefined, includeVirtualGangs)
        ]);
        const currentMonth = currentPeriod.month;
        const currentYear = currentPeriod.year;

        // Determine if the selected period is historical (before current period)
        const isHistorical = (year < currentYear) || (year === currentYear && month < currentMonth);



        // --- DEEP HISTORY INTERCEPTOR ---
        // For development/debugging as requested, bypass the interceptor to allow getPremi logic to run for History
        // If history mode is on, try to fetch from the snapshot tables first.
        let shouldFetchHistory = false; // Bypass: isHistorical && historyDatabaseService.isHistoryMode();

        // Explicit override from frontend
        if (useHistoryDb === true) {
            shouldFetchHistory = false; // Bypass: true
        } else if (useHistoryDb === false) {
            shouldFetchHistory = false;
        }

        if (shouldFetchHistory) {
            try {
                const historyData = await historyDatabaseService.getHistoricalPayrollDataAsExtractorFormat(
                    month, year, gangCode, divisionCode, specificEmpCode
                );

                if (historyData && historyData.data_rows.length > 0) {
                    // Apply gangPrefix filter if present
                    if (gangPrefix) {
                        const isNumeric = /^\d+$/.test(gangPrefix);
                        historyData.data_rows = historyData.data_rows.filter((r: any) => {
                            const gc = (r.gang_code || '').trim().toUpperCase();
                            if (isNumeric) {
                                const asistensi = gc.startsWith('K2') ? '1' : (gc.match(/\d+/)?.[0] ?? null);
                                return asistensi === gangPrefix;
                            }
                            return gc.startsWith(gangPrefix.toUpperCase());
                        });
                    }

                    debug(CATEGORY, `Intercepted deep history request for ${month}/${year}. Returning seeded snapshot data. (${historyData.data_rows.length} rows)`);
                    return historyData;
                } else {
                    debug(CATEGORY, `No seeded history found for ${month}/${year}. Falling back to live/archive calculation...`);
                }
            } catch (err) {
                logError(CATEGORY, `Failed to fetch historical snapshot, falling back:`, err);
            }
        }
        // ------------------------------------

        // [GANG MAPPING] Build mapping maps from fetched gangs
        const codeToDesc: Record<string, string> = {};
        const descToCode: Record<string, string> = {};

        allGangs.forEach((g: any) => {
            const code = g.gang_code?.trim().toUpperCase(); // e.g. "AB1"
            const desc = g.description?.trim().toUpperCase(); // e.g. "DIVISI AB1" (from backend/DB)
            if (code && desc) {
                codeToDesc[code] = desc; // AB1 -> DIVISI AB1
                descToCode[desc] = g.gang_code.trim(); // DIVISI AB1 -> AB1 (preserve original casing if possible, but map key is upper)
            }
        });

        let gangCondition = "1=1";
        // Also store the raw gangCode input for path-specific filtering in getEmployees
        let gangCodeInput: string | null = null;
        if (specificEmpCode) {
            gangCondition = `RTRIM(e.EmpCode) = '${specificEmpCode.trim()}'`;
        } else if (gangCode && gangCode !== "ALL") {
            const trimmedInput = gangCode.trim().toUpperCase();
            debug(CATEGORY, `Gang Filter: Input='${gangCode}' (Using exact Code matching)`);
            // Set gangCodeInput so getEmployees can build path-specific conditions
            gangCodeInput = trimmedInput;
            // Default condition using GangCode from HR_GANGLN (live path)
            // getEmployees will override this for historical path
            gangCondition = `(UPPER(RTRIM(gl.GangCode)) = '${trimmedInput}' OR UPPER(RTRIM(g.GangCode)) = '${trimmedInput}' OR UPPER(RTRIM(g.Description)) = '${trimmedInput}')`;
        } else if (divisionCode) {
            // Already fetched `allGangs` above for mapping, reuse it for condition
            if (allGangs.length > 0) {
                // Use UPPER for case-insensitive comparison and RTRIM for trailing spaces
                // Match by BOTH GangCode AND Description for maximum reliability across Plantware tables
                const conditions = allGangs.map((gang: { gang_code: string, description: string }) =>
                    `(UPPER(RTRIM(g.GangCode)) = UPPER('${gang.gang_code.trim()}') OR UPPER(RTRIM(g.Description)) = UPPER('${gang.description.trim()}'))`
                ).join(' OR ');
                gangCondition = `(${conditions})`;
            } else {
                gangCondition = "1=0";
            }
        }

        const startTotal = performance.now();
        let employees = await this.getEmployees(gangCondition, month, year, serverProfile, isHistorical, gangCodeInput);
        debug(CATEGORY, `Phase 0 - getEmployees: ${(performance.now() - startTotal).toFixed(0)}ms, found ${employees.length} employees`);

        // Apply gangPrefix (Group/Asistensi) filter for LIVE path
        if (gangPrefix && employees.length > 0) {
            const isNumeric = /^\d+$/.test(gangPrefix);
            employees = employees.filter(emp => {
                const gc = (emp.gang_code || '').trim().toUpperCase();
                if (isNumeric) {
                    // Extract asistensi number from gang code:
                    // K2xxx → '1' (special case), otherwise first digit sequence
                    const asistensi = gc.startsWith('K2') ? '1' : (gc.match(/\d+/)?.[0] ?? null);
                    return asistensi === gangPrefix;
                }
                return gc.startsWith(gangPrefix.toUpperCase());
            });
        }

        if (employees.length === 0) {
            return {
                data_rows: [],
                dynamic_premi_headers: [],
                dynamic_potongan_headers: [],
                premi_title_map: {},
                potongan_title_map: {},
                meta: { execution_time_ms: 0, row_count: 0 }
            };
        }

        const empCodes = employees.map(e => e.emp_code);

        const startParallel = performance.now();

        // Helper: wrap a query so timeout/error returns a default value instead of crashing Promise.all
        async function safeQuery<T>(label: string, fn: () => Promise<T>, defaultValue: T): Promise<T> {
            try {
                return await fn();
            } catch (err: any) {
                const isTimeout = err.message?.includes('Timeout') || err.message?.includes('timeout');
                if (isTimeout) {
                    warn(CATEGORY, `⚠️ ${label} timed out — using default (0) values`);
                } else {
                    logError(CATEGORY, `${label} failed — using default values:`, err);
                }
                return defaultValue;
            }
        }

        const emptyPremiResult = { amounts: {} as Record<string, Record<string, number>>, titleMap: {} as Record<string, string>, details: {} as Record<string, any[]> };
        const emptyPotonganResult = { amounts: {} as Record<string, Record<string, number>>, titleMap: {} as Record<string, string> };

        // [OPTIMIZATION] Batch processing to prevent SQL timeouts.
        const BATCH_SIZE = 300; 
        const empCodeChunks: string[][] = [];
        for (let i = 0; i < empCodes.length; i += BATCH_SIZE) {
            empCodeChunks.push(empCodes.slice(i, i + BATCH_SIZE));
        }

        // Accumulators for batched results
        let attendanceMap: Record<string, any> = {};
        let cuti: Record<string, CutiData> = {};
        let premiResult = { amounts: {} as Record<string, Record<string, number>>, titleMap: {} as Record<string, string>, details: {} as Record<string, any[]> };
        let potonganResult = { amounts: {} as Record<string, Record<string, number>>, titleMap: {} as Record<string, string> };
        let lembur: Record<string, LemburData> = {};
        let lemburWithDetails: Record<string, any> = {};
        let lemburDocDesc: Record<string, number> = {};
        let berasDocDesc: Record<string, number> = {};
        let jabatan: Record<string, number> = {};
        let masaKerja: Record<string, number> = {};
        let upahPokok: Record<string, number> = {};
        let brondol: Record<string, number> = {};
        let taskCodes: Record<string, any> = {};
        let bunchesBatch = new Map();
        let positionHistory = {} as Record<string, string>;

        // Global queries that don't depend on empCodes chunks
        const [jobTitles, manualAdjustmentsRaw] = await Promise.all([
            safeQuery('getJobTitles', () => EmployeeEstateService.getEmployeeJobs(), {} as Record<string, string>),
            safeQuery('getManualAdj', () => manualAdjustmentService.getAdjustments(month, year, gangCode || undefined), [])
        ]);

        // Process chunks sequentially to drastically reduce database overhead and prevent timeouts
        for (let idx = 0; idx < empCodeChunks.length; idx++) {
            const chunk = empCodeChunks[idx];
            debug(CATEGORY, `Processing batch ${idx + 1}/${empCodeChunks.length} (${chunk.length} employees)...`);

            // Execute the heavy queries just for this chunk
            const [
                attB, cutiB, premiB, potB, lemburCalcB, lemburDetB, lemburDocB, berasDocB, 
                jabatanB, masaKerjaB, upahB, brondolB, taskCodesB, bunchesB, posHistB
            ] = await Promise.all([
                safeQuery('getAttendance', () => this.getAttendance(chunk, startDate, endDate, serverProfile, isHistorical), {} as Record<string, any>),
                safeQuery('getCuti', () => this.getCuti(chunk, startDate, endDate, serverProfile, isHistorical), {} as Record<string, CutiData>),
                safeQuery('getPremi', () => this.getPremi(chunk, startDate, endDate, isHistorical, serverProfile), JSON.parse(JSON.stringify(emptyPremiResult))),
                safeQuery('getPotongan', () => this.getPotongan(chunk, startDate, endDate, serverProfile, isHistorical), JSON.parse(JSON.stringify(emptyPotonganResult))),
                safeQuery('getLemburCalculator', () => this.getLemburDetailsFromCalculator(chunk, month, year, serverProfile), {} as Record<string, LemburData>),
                safeQuery('getLemburDetails', () => this.getLemburDetailsWithTaskBreakdown(chunk, month, year, serverProfile), {} as Record<string, any>),
                safeQuery('getLemburDocDesc', () => this.getLemburFromDocDesc(chunk, startDate, endDate, serverProfile, isHistorical), {} as Record<string, number>),
                safeQuery('getBerasDocDesc', () => this.getBerasFromDocDesc(chunk, startDate, endDate, serverProfile, isHistorical), {} as Record<string, number>),
                safeQuery('getJabatan', () => this.getTunjanganAmount(chunk, startDate, endDate, "JABATAN", serverProfile, isHistorical), {} as Record<string, number>),
                safeQuery('getMasaKerja', () => this.getTunjanganAmount(chunk, startDate, endDate, "MASA%KERJA", serverProfile, isHistorical), {} as Record<string, number>),
                safeQuery('getUpahPokok', () => this.getUpahPokok(chunk, year, currentYear, serverProfile), {} as Record<string, number>),
                safeQuery('getBrondol', () => this.getBrondol(chunk, startDate, endDate, serverProfile, isHistorical), {} as Record<string, number>),
                safeQuery('getTaskCodes', () => this.getTaskCodes(chunk, startDate, endDate, serverProfile, isHistorical), {} as Record<string, any>),
                !skipHarvest ? safeQuery('getBunches', () => this.getBunchesBatch(chunk, month, year), new Map()) : Promise.resolve(new Map()),
                safeQuery('getPositionHistory', () => this.getPositionHistory(chunk, month, year), {} as Record<string, string>)
            ]);

            // Merge back into main accumulators
            Object.assign(attendanceMap, attB);
            Object.assign(cuti, cutiB);
            
            Object.assign(premiResult.amounts, premiB.amounts);
            Object.assign(premiResult.titleMap, premiB.titleMap);
            Object.assign(premiResult.details, premiB.details);

            Object.assign(potonganResult.amounts, potB.amounts);
            Object.assign(potonganResult.titleMap, potB.titleMap);

            Object.assign(lembur, lemburCalcB);
            Object.assign(lemburWithDetails, lemburDetB);
            Object.assign(lemburDocDesc, lemburDocB);
            Object.assign(berasDocDesc, berasDocB);
            Object.assign(jabatan, jabatanB);
            Object.assign(masaKerja, masaKerjaB);
            Object.assign(upahPokok, upahB);
            Object.assign(brondol, brondolB);
            Object.assign(taskCodes, taskCodesB);
            Object.assign(positionHistory, posHistB);

            for (const [k, v] of bunchesB.entries()) bunchesBatch.set(k, v);
        }

        debug(CATEGORY, `Phase 1 (Chunked queries): ${(performance.now() - startParallel).toFixed(0)}ms for ${empCodes.length} employees`);

        // ============================================================
        // [OPTIMIZATION] Phase 2: 4 parallel calls
        // ============================================================
        const startPhase2 = performance.now();

        // [NEW] Use GajiPokokService for basic salary calculations in batch
        const gajiPokokInputs = empCodes.map(code => ({
            emp_code: code,
            month,
            year,
            server_profile: serverProfile,
            // Optimization: Pass pre-fetched data so GajiPokokService doesn't re-query
            attendance: attendanceMap[code] || { hk: 0, total_amount_rp: 0 },
            // [FIXED] Only pass upah_dasar if it exists and > 0, otherwise let service fetch from HR_PAYROLL
            // If upahPokok[code] is 0 or undefined, the service will query HR_PAYROLL.PayRate
            upah_dasar: (upahPokok[code] && upahPokok[code] > 0) ? upahPokok[code] : undefined
        }));

        // Cast manual adjustments to expected type
        const manualAdjustments = (manualAdjustmentsRaw || []) as any[];

        // Destructure premi result - uses DocDesc as title
        const { amounts: premi, titleMap: premiTitleMap, details: premiDetails } = premiResult;
        // Destructure potongan result - uses TaskDesc as title
        const { amounts: potongan, titleMap: potonganTitleMap } = potonganResult;

        // ============================================================
        // [OPTIMIZATION] Parallelize: all independent after Promise.all
        // Run concurrently: gajiPokokBatch + OtherIncomes + PTKP + empCode resolution
        // ============================================================
        const [gajiPokokBatchResult, dbOtherIncomes, ptkpMasterRecords, latestEmpCodeMap] = await Promise.all([
            gajiPokokService.calculateBatch(gajiPokokInputs),
            OtherIncomesService.getIncomes(year, month, divisionCode, gangCode),
            (async () => {
                const { ptkpTaxService } = await import('./ptkpTaxService');
                return await ptkpTaxService.getPtkpByYear(year);
            })(),
            (async () => {
                const niksToResolve = employees.map(e => e.actual_nik).filter(Boolean) as string[];
                const prefGangMap = new Map<string, string>();
                if (gangCode && gangCode !== 'ALL') {
                    niksToResolve.forEach(nik => prefGangMap.set(nik.toUpperCase(), gangCode));
                }
                return await employeeGangHistoryService.resolveLatestEmpCodes(niksToResolve, prefGangMap);
            })()
        ]);
        debug(CATEGORY, `Phase 2 (4 parallel calls): ${(performance.now() - startPhase2).toFixed(0)}ms`);

        // [DEBUG] Check if THR records are fetched
        const thrCount = dbOtherIncomes.filter((i: any) => i.income_type === 'THR').length;
        debug("THR FIX", `dbOtherIncomes total=${dbOtherIncomes.length}, THR=${thrCount}, gang=${gangCode}`);
        // ==============================================================================
        // [THR FIX] Pendapatan Lainnya (THR, Bonus, Custom) Storage & Lookup Strategy
        // ==============================================================================
        // PROBLEM: Karyawan yang pindah division mendapat emp_code baru, tapi THR tetap
        // tersimpan dengan emp_code lama di employee_other_incomes.
        //
        // SOLUTION: NIK adalah identifier STABIL yang tidak berubah saat karyawan pindah.
        // emp_code bisa berubah, jadi kita PRIORITASKAN lookup via NIK.
        //
        // DUPLICATE NIK HANDLING: Jika ada NIK duplikat di data THR (karyawan berbeda
        // tapi NIK sama di DB), gunakan komposit key "NIK + NAMA" untuk disambiguate.
        // Nama diambil dari gang member (emp.emp_name dari HR_PAYROLL) untuk matching.
        //
        // LOOKUP PRIORITY:
        //   1. By NIK (primary, stabil)
        //   2. By NIK + emp_name (fallback untuk duplicate NIK)
        //   3. By emp_code (last resort, hanya jika NIK kosong)
        // ==============================================================================

        const dbThpIncomesMap = new Map<string, number>();
        const dbTaxableIncomesMap = new Map<string, number>();
        // Primary storage: key by NIK
        const dbOtherIncomesByNik = new Map<string, { type: string; name: string; amount: number; emp_name?: string }[]>();
        // Fallback storage: key by "NIK + EMP_NAME" for duplicate NIK disambiguation
        const dbOtherIncomesByNikName = new Map<string, { type: string; name: string; amount: number; emp_name?: string }[]>();
        // [NEW] Separate taxable breakdown by income type for PAJAK section display
        const dbTaxableOtherIncomesByNik = new Map<string, { type: string; name: string; amount: number }[]>();
        const dbTaxableOtherIncomesByNikName = new Map<string, { type: string; name: string; amount: number }[]>();
        // [LEVEL 4] Storage by CLEANED NAME — last resort for karyawan pindahan whose NIK
        // in HR_EMPLOYEE differs from NIK stored in employee_other_incomes
        const dbThpByCleanName = new Map<string, number>();
        const dbTaxableByCleanName = new Map<string, number>();
        const dbOtherIncomesByCleanName = new Map<string, { type: string; name: string; amount: number; emp_name?: string }[]>();
        const dbTaxableOtherByCleanName = new Map<string, { type: string; name: string; amount: number }[]>();

        // First pass: count how many records per NIK to detect duplicates
        const nikCount = new Map<string, number>();
        for (const inc of dbOtherIncomes) {
            const nik = String(inc.nik || '').trim().toUpperCase();
            if (nik) {
                nikCount.set(nik, (nikCount.get(nik) || 0) + 1);
            }
        }

        for (const inc of dbOtherIncomes) {
            const nik = String(inc.nik || '').trim().toUpperCase();
            const empCode = String(inc.emp_code || '').trim().toUpperCase();
            // Nama dari DB record (ini adalah nama yang tersimpan di employee_other_incomes)
            const dbEmpName = String(inc.emp_name || '').trim().toUpperCase();
            const incomeEntry = {
                type: inc.income_type,
                name: inc.income_name || inc.income_type,
                amount: Number(inc.amount),
                emp_name: dbEmpName
            };
            const dbCleanName = cleanNameFormat(dbEmpName);
            const nikNameKey = nik ? `${nik}||${dbCleanName}` : '';

            if (inc.is_paid_in_thp) {
                // Level 1: Store by emp_code (prioritas utama — simpel & langsung)
                if (empCode) {
                    dbThpIncomesMap.set(empCode, (dbThpIncomesMap.get(empCode) || 0) + Number(inc.amount));
                }
                // Level 2: Also store by NIK (fallback — karyawan yang ganti emp_code)
                if (nik && nik !== empCode) {
                    dbThpIncomesMap.set(nik, (dbThpIncomesMap.get(nik) || 0) + Number(inc.amount));
                }
                // Level 3: Also store by NIK+NAME if duplicate NIK (for disambiguation)
                if (nik && nikCount.get(nik)! > 1 && nikNameKey) {
                    const existing = dbThpIncomesMap.get(nikNameKey) || 0;
                    dbThpIncomesMap.set(nikNameKey, existing + Number(inc.amount));
                }
            }
            if (inc.is_taxable) {
                // Level 1: Store by emp_code (prioritas utama — simpel & langsung)
                if (empCode) {
                    dbTaxableIncomesMap.set(empCode, (dbTaxableIncomesMap.get(empCode) || 0) + Number(inc.amount));
                    if (!dbTaxableOtherIncomesByNik.has(empCode)) {
                        dbTaxableOtherIncomesByNik.set(empCode, []);
                    }
                    dbTaxableOtherIncomesByNik.get(empCode)!.push(incomeEntry);
                }
                // Level 2: Also store by NIK (fallback — karyawan yang ganti emp_code)
                if (nik && nik !== empCode) {
                    dbTaxableIncomesMap.set(nik, (dbTaxableIncomesMap.get(nik) || 0) + Number(inc.amount));
                    if (!dbTaxableOtherIncomesByNik.has(nik)) {
                        dbTaxableOtherIncomesByNik.set(nik, []);
                    }
                    dbTaxableOtherIncomesByNik.get(nik)!.push(incomeEntry);
                }
                // Level 3: Also store by NIK+NAME if duplicate NIK (for disambiguation)
                if (nik && nikCount.get(nik)! > 1 && nikNameKey) {
                    const existing = dbTaxableIncomesMap.get(nikNameKey) || 0;
                    dbTaxableIncomesMap.set(nikNameKey, existing + Number(inc.amount));
                    if (!dbTaxableOtherIncomesByNikName.has(nikNameKey)) {
                        dbTaxableOtherIncomesByNikName.set(nikNameKey, []);
                    }
                    dbTaxableOtherIncomesByNikName.get(nikNameKey)!.push(incomeEntry);
                }
            }
            // Build primary array: store by emp_code (prioritas utama)
            // Karyawan yang tidak ganti emp_code → ketemu langsung
            // Karyawan yang ganti emp_code → fallback ke NIK lookup di bawah
            if (empCode) {
                if (!dbOtherIncomesByNik.has(empCode)) {
                    dbOtherIncomesByNik.set(empCode, []);
                }
                dbOtherIncomesByNik.get(empCode)!.push(incomeEntry);
            }
            // Also store by NIK as fallback (untuk karyawan yang ganti emp_code)
            if (nik && nik !== empCode) {
                if (!dbOtherIncomesByNik.has(nik)) {
                    dbOtherIncomesByNik.set(nik, []);
                }
                dbOtherIncomesByNik.get(nik)!.push(incomeEntry);
                // Also store by NIK+NAME for duplicate NIK disambiguation
                if (nikCount.get(nik)! > 1 && nikNameKey) {
                    if (!dbOtherIncomesByNikName.has(nikNameKey)) {
                        dbOtherIncomesByNikName.set(nikNameKey, []);
                    }
                    dbOtherIncomesByNikName.get(nikNameKey)!.push(incomeEntry);
                }
            }
            // [LEVEL 4] Store by CLEANED NAME as last resort
            // This catches karyawan pindahan whose NIK is completely different
            if (dbCleanName) {
                if (inc.is_paid_in_thp) {
                    dbThpByCleanName.set(dbCleanName, (dbThpByCleanName.get(dbCleanName) || 0) + Number(inc.amount));
                }
                if (inc.is_taxable) {
                    dbTaxableByCleanName.set(dbCleanName, (dbTaxableByCleanName.get(dbCleanName) || 0) + Number(inc.amount));
                    if (!dbTaxableOtherByCleanName.has(dbCleanName)) {
                        dbTaxableOtherByCleanName.set(dbCleanName, []);
                    }
                    dbTaxableOtherByCleanName.get(dbCleanName)!.push(incomeEntry);
                }
                if (!dbOtherIncomesByCleanName.has(dbCleanName)) {
                    dbOtherIncomesByCleanName.set(dbCleanName, []);
                }
                dbOtherIncomesByCleanName.get(dbCleanName)!.push(incomeEntry);
            }
        }


        // Build PTKP map from parallel-fetched records
        const dbPtkpMap = new Map<string, string>();
        for (const record of ptkpMasterRecords) {
            if (record.emp_code) {
                dbPtkpMap.set(record.emp_code.trim().toUpperCase(), record.ptkp_status);
            }
        }

        const dataRows: PayrollRow[] = [];
        const dynamicPremiSet = new Set<string>();
        const dynamicPotonganSet = new Set<string>();
        const startRowProcessing = performance.now();

        for (const emp of employees) {
            const nikClean = emp.actual_nik?.trim().toUpperCase() || "";
            const latestEmpCode = latestEmpCodeMap.get(nikClean) || emp.emp_code;

            const attData = attendanceMap[emp.emp_code] || { hk: 0, total_hours: 0, shortage_count: 0, total_amount_rp: 0 };
            const hk = attData.hk;
            const empCuti = cuti[emp.emp_code] || { cuti_tahunan: 0, cuti_sakit_haid: 0, cuti_minggu: 0, cuti_nasional: 0 };

            // Calculate Effective HK (excluding Sundays and National Holidays)
            // This filters out employees who only have auto-generated holiday attendance but no actual work/leave
            const effective_hk = hk - (empCuti.cuti_minggu + empCuti.cuti_nasional);

            const empPremi = premi[emp.emp_code] || {};
            const empPotongan = potongan[emp.emp_code] || {};
            const empLembur = lembur[emp.emp_code] || { jam: 0, jumlah: 0 };
            const empLemburDetails = lemburWithDetails[emp.emp_code] || { jam: 0, jumlah: 0, task_breakdown: [] };
            const empLemburDocDesc = lemburDocDesc[emp.emp_code] || 0;
            const empBerasDocDesc = berasDocDesc[emp.emp_code] || 0;
            const empJabatan = jabatan[emp.emp_code] || 0;
            const empMasaKerjaJumlah = masaKerja[emp.emp_code] || 0;

            // Calculate total earnings potential to check if employee should be kept despite low HK
            const total_premi_temp = Object.values(empPremi).reduce((a, b) => a + b, 0);
            const total_earnings = (attData.total_amount_rp || 0) + total_premi_temp + empLemburDetails.jumlah + empJabatan + empMasaKerjaJumlah;



            // Filter: Skip if Effective HK is 0 or less AND Total Earnings is 0 or less
            if (effective_hk <= 0 && total_earnings <= 0) continue;
            const daysInMonth = new Date(year, month, 0).getDate();

            // Get data carefully computed by GajiPokokService
            const gpResult = gajiPokokBatchResult.results.get(emp.emp_code)?.output?.value;
            const empUpahDasar = gpResult?.upah_dasar?.value || emp.pay_rate || 0;

            // Get job title from history override if available, otherwise use real-time
            const empJobTitle = positionHistory[emp.emp_code] || jobTitles[emp.emp_code] || "";

            // ... (Rest of existing logic mostly unchanged until row creation)
            const totalCuti = empCuti.cuti_tahunan + empCuti.cuti_sakit_haid + empCuti.cuti_minggu + empCuti.cuti_nasional;
            const hari_kerja = Math.max(0, hk - totalCuti);

            // [FILTER] Employee filtering logic
            const effective_work_hk = hk - (empCuti.cuti_minggu + empCuti.cuti_nasional);
            const other_cuti = empCuti.cuti_tahunan + empCuti.cuti_sakit_haid;

            if (effective_work_hk <= 0 && other_cuti == 0 && total_earnings <= 0) continue;

            const upah_pokok = attData.total_amount_rp || 0;
            // [PHASE 2.5] Brondol dual source tracking
            const empBrondolLoosefruit = brondol[emp.emp_code] || 0;
            const empBrondolAdtrans = empPremi["brondol"] || 0; // From PR_ADTRANS (before adding loosefruit)
            const empBrondolTotal = empBrondolLoosefruit + empBrondolAdtrans;
            // Keep empBrondol for backward compatibility (total)
            const empBrondol = empBrondolTotal;

            let masaKerjaLama = 0;
            if (emp.join_date) {
                const joinDate = new Date(emp.join_date);
                if (!isNaN(joinDate.getTime())) {
                    const now = new Date(year, month - 1, 1);
                    masaKerjaLama = Math.floor((now.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 365));
                    if (masaKerjaLama < 0) masaKerjaLama = 0;
                }
            }

            const berasRate = emp.beras_rate > 0 ? emp.beras_rate : 0;
            const berasJumlahBase = berasRate > 0 && hk > 0 ? berasRate * hk : 0;

            const isF2H = emp.gang_code === 'F2H';
            const additionalBeras = isF2H ? empBerasDocDesc : 0;
            const berasJumlah = berasJumlahBase + additionalBeras;

            const jabatanRate = hari_kerja > 0 ? empJabatan / hari_kerja : 0;
            const masaKerjaRate = hari_kerja > 0 && empMasaKerjaJumlah > 0 ? empMasaKerjaJumlah / hari_kerja : 0;

            const empLemburJumlahPure = empLemburDetails.jumlah || 0;
            const empLemburJamPure = empLemburDetails.jam || 0;

            const gaji_pokok_ideal = gpResult?.gaji_pokok_ideal?.value || 0;
            const gaji_pokok_aktual = gpResult?.gaji_pokok_aktual?.value || 0;
            const gaji_pokok = gaji_pokok_aktual;
            const total_tunjangan = berasJumlah + empJabatan + empMasaKerjaJumlah + empLemburJumlahPure;

            // PREMI CALCULATION - Ensure everything is summed into total_premi
            // [PHASE 2.5] Brondol is now combined at line 570 (empBrondol = empBrondolTotal)
            // empPremi["brondol"] already contains adtrans, we need to add ONLY loosefruit portion
            if (empBrondolLoosefruit > 0) {
                // empPremi["brondol"] currently has adtrans, add loosefruit to combine both sources
                empPremi["brondol"] = (empPremi["brondol"] || 0) + empBrondolLoosefruit;
                premiTitleMap["brondol"] = "PREMI BRONDOL";
            }

            let total_premi = 0;
            for (const [key, val] of Object.entries(empPremi)) {
                // Key could be: brondol, premi_pruning, premi_kinerja, premi_harvesting, etc.
                const amount = Number(val) || 0;
                // [MODIFIED] User requested to exclude ONLY 'koreksi' from total_premi
                // Tiket, panen, pruning, etc. are all included as requested.
                if (key !== "koreksi") {
                    total_premi += amount;
                }

                // Add all individual premiums (except static/excluded ones) to dynamic set for UI columns
                if (key !== "koreksi") {
                    dynamicPremiSet.add(key);
                }
            }

            // [NEW] Inject PREMI Manual Adjustments
            const empAdjustments = manualAdjustments ? manualAdjustments.filter(a => String(a.emp_code).trim() === String(emp.emp_code).trim()) : [];
            const empPremiAdjustments = empAdjustments.filter(a => a.adjustment_type === 'PREMI');

            for (const adj of empPremiAdjustments) {
                const adjName = adj.adjustment_name.toUpperCase().replace(/ /g, '_');
                const key = `PREMI_${adjName}`;

                // Add to premiums list
                empPremi[key] = (empPremi[key] || 0) + adj.amount;
                total_premi += adj.amount;
                dynamicPremiSet.add(key);

                // Add to title map so it looks nice on frontend
                premiTitleMap[key] = adj.adjustment_name;
            }

            const pot_spsi = Math.abs(empPotongan["SPSI"] || 0);
            const pot_pph21 = Math.abs(empPotongan["PPH21"] || 0);
            // [NEW] Premi PPH from TaskDesc = 'ACCRUALS-CHECKROLL' (treated as potongan upah bersih)
            const pot_premi_pph = Math.abs(empPotongan["PREMI_PPH"] || 0);

            // [CRITICAL FIX] PREMI_PPH is explicitly excluded from dynamicPotonganSet
            // so it doesn't appear as a generic deduction in the UI. Ensure it is handled 
            // separately as an addition to net wage.

            // [NEW] Handle KOREKSI variations separately
            // Collect all keys that start with "KOREKSI" (KOREKSI, KOREKSI_A, KOREKSI_PANEN, etc.)
            const koreksiVariations: { [key: string]: number } = {};
            let pot_koreksi = 0;

            for (const [key, val] of Object.entries(empPotongan)) {
                if (key.startsWith("KOREKSI")) {
                    const amount = Math.abs(val as number);
                    koreksiVariations[key] = amount;
                    pot_koreksi += amount;
                    dynamicPotonganSet.add(key);
                }
            }

            // [NEW] Inject POTONGAN_KOTOR Manual Adjustments (acts like KOREKSI)
            const empPotKotorAdjustments = empAdjustments.filter(a => a.adjustment_type === 'POTONGAN_KOTOR');
            for (const adj of empPotKotorAdjustments) {
                const adjName = adj.adjustment_name.toUpperCase().replace(/ /g, '_');
                const key = `KOREKSI_${adjName}`; // Treated as koreksi so it deducts before Pajak

                empPotongan[key] = (empPotongan[key] || 0) + adj.amount;

                koreksiVariations[key] = (koreksiVariations[key] || 0) + adj.amount;
                pot_koreksi += adj.amount;

                dynamicPotonganSet.add(key);
                potonganTitleMap[key] = adj.adjustment_name;
            }

            let other_potongan = 0;
            let db_bpjs_kes = 0;

            for (const [key, val] of Object.entries(empPotongan)) {
                // Skip static fields and KOREKSI, PREMI_PPH (handled above)
                // Use case-insensitive check for KOREKSI to be safe
                const keyUpper = key.toUpperCase();
                if (key === "SPSI" || key === "PPH21" || keyUpper.startsWith("KOREKSI") || key === "PREMI_PPH") {
                    continue;
                }

                if (key.includes("BPJS")) {
                    if (!key.includes("MAJIKAN") && !key.includes("MAJ")) {
                        db_bpjs_kes += Math.abs(val as number);
                    }
                    continue;
                }

                other_potongan += Math.abs(val as number);
                dynamicPotonganSet.add(key);
            }

            // [NEW] Inject POTONGAN_BERSIH Manual Adjustments
            const empPotBersihAdjustments = empAdjustments.filter(a => a.adjustment_type === 'POTONGAN_BERSIH');
            for (const adj of empPotBersihAdjustments) {
                const adjName = adj.adjustment_name.toUpperCase().replace(/ /g, '_');
                const key = `POTONGAN_${adjName}`;

                empPotongan[key] = (empPotongan[key] || 0) + adj.amount;
                other_potongan += adj.amount;

                dynamicPotonganSet.add(key);
                potonganTitleMap[key] = adj.adjustment_name;
            }

            const caruman = calculateAllCaruman(empUpahDasar, empMasaKerjaJumlah);

            const pot_astek_pekerja = caruman.astek_pekerja_jht;
            const pot_astek_majikan = caruman.astek_majikan_total;
            const pot_astek_jumlah = pot_astek_pekerja + pot_astek_majikan;

            const pot_bpjs_kesehatan_pekerja_formula = caruman.bpjs_kes_pekerja;
            const pot_bpjs_kesehatan_pekerja = pot_bpjs_kesehatan_pekerja_formula + db_bpjs_kes;

            const pot_bpjs_kesehatan_majikan = caruman.bpjs_kes_majikan;
            const pot_bpjs_kesehatan_jumlah = pot_bpjs_kesehatan_pekerja + pot_bpjs_kesehatan_majikan;

            const pot_bpjs_pensiun_pekerja = caruman.bpjs_pensiun_pekerja;
            const pot_bpjs_pensiun_majikan = caruman.bpjs_pensiun_majikan;
            const pot_bpjs_pensiun_jumlah = pot_bpjs_pensiun_pekerja + pot_bpjs_pensiun_majikan;

            // ==============================================================================
            // [THR FIX v2] Multi-level lookup — NIK-first for karyawan pindahan
            // ==============================================================================
            // ROOT CAUSE: ALL 1616 THR records in employee_other_incomes have EMPTY emp_code.
            // NIK is the only reliable identifier in the database.
            //
            // PRIORITY:
            //   1. NIK — langsung & simpel (SEMUA record THR disimpan by NIK)
            //   2. NIK + EMP_NAME — duplicate NIK disambiguation
            //   3. emp_code — fallback (untuk case emp_code mulai terisi di masa depan)
            //   4. CLEANED NAME — last resort (karyawan pindahan, NIK berbeda total)
            // ==============================================================================
            const empNik = String(emp.actual_nik || '').trim().toUpperCase();
            const empCodeKey = String(emp.emp_code || '').trim().toUpperCase();
            // Nama dari gang member (HR_PAYROLL) - digunakan untuk NIK+NAME composite key
            const originalEmpName = String(emp.emp_name || '').trim().toUpperCase();
            const empNameForKey = cleanNameFormat(originalEmpName);
            // Composite key: NIK + EMP_NAME (digunakan jika ada duplicate NIK)
            const nikNameKey = empNik && empNameForKey ? `${empNik}||${empNameForKey}` : '';

            // Helper: lookup dengan 4-level fallback
            // [THR FIX] PRIORITY CHANGE: NIK adalah identifier STABIL yang tidak berubah saat karyawan pindah.
            // Data menunjukkan SEMUA 1616 THR record di employee_other_incomes punya emp_code KOSONG
            // dan hanya NIK yang terisi. Jadi NIK jadi prioritas utama.
            //
            // PRIORITY:
            //   1. NIK — langsung (SEMUA record THR disimpan by NIK, emp_code kosong)
            //   2. NIK + EMP_NAME — duplicate NIK disambiguation
            //   3. emp_code — fallback (untuk case di masa depan kalau emp_code mulai terisi)
            //   4. CLEANED NAME — last resort (karyawan pindahan, NIK berbeda total)
            const lookupByNik = (map: Map<string, number>, nameMap?: Map<string, number>) => {
                let val = 0;
                if (empCodeKey === 'B0065') {
                    console.log(`[THR FIX DEBUG] lookupByNik: empNik=${empNik}, map.size=${map.size}, map.has(empNik)=${map.has(empNik)}, map.get(empNik)=${map.get(empNik)}`);
                }
                // Level 1: NIK (prioritas utama — semua THR disimpan by NIK)
                if (empNik) {
                    val = map.get(empNik) || 0;
                }
                // Level 2: NIK + NAMA (duplicate NIK disambiguation)
                if (val === 0 && nikNameKey) {
                    val = map.get(nikNameKey) || 0;
                }
                // Level 3: emp_code (fallback — untuk case emp_code terisi)
                if (val === 0 && empCodeKey) {
                    val = map.get(empCodeKey) || 0;
                }
                // Level 4: CLEANED NAME (karyawan pindahan — NIK berbeda total)
                if (val === 0 && empNameForKey && nameMap) {
                    val = nameMap.get(empNameForKey) || 0;
                }
                return val;
            };

            const lookupOtherIncomes = (map: Map<string, { type: string; name: string; amount: number; emp_name?: string }[]>, nameMap?: Map<string, { type: string; name: string; amount: number; emp_name?: string }[]>) => {
                const results = new Map<string, { type: string; name: string; amount: number; emp_name?: string }>();
                
                const addEntries = (entries: { type: string; name: string; amount: number; emp_name?: string }[]) => {
                    for (const e of entries) {
                        const key = `${e.type}|${e.name}`;
                        // Keep the first found (prioritize lookup order)
                        if (!results.has(key)) results.set(key, e);
                    }
                };

                // Merging approach instead of fallback.
                // An employee might have THR recorded under their NIK, but a manual custom income mapped under their empCode.
                // We shouldn't stop checking level 3 if level 1 matches.

                // Level 1: NIK (prioritas utama — semua THR disimpan by NIK)
                if (empNik) addEntries(map.get(empNik) || []);
                
                // Level 2: NIK + NAMA (duplicate NIK disambiguation)
                if (nikNameKey) addEntries(map.get(nikNameKey) || []);
                
                // Level 3: emp_code (fallback — untuk case emp_code terisi manual UI)
                if (empCodeKey) addEntries(map.get(empCodeKey) || []);
                
                // Level 4: CLEANED NAME (karyawan pindahan — NIK berbeda total)
                if (empNameForKey && nameMap) addEntries(nameMap.get(empNameForKey) || []);

                return Array.from(results.values());
            };

            const pendapatan_tidak_tetap_thp = lookupByNik(dbThpIncomesMap, dbThpByCleanName);
            const pendapatan_tidak_tetap_taxable = lookupByNik(dbTaxableIncomesMap, dbTaxableByCleanName);

            // [PRE-COMPUTE] Pendapatan Lainnya (THR + Bonus + Custom) for upah_bersih deduction
            const empOtherIncomes = lookupOtherIncomes(dbOtherIncomesByNik, dbOtherIncomesByCleanName);
            const empTaxableOtherIncomes = lookupOtherIncomes(dbTaxableOtherIncomesByNik, dbTaxableOtherByCleanName);
            // Also check nik+name specific maps for taxable breakdown
            const empTaxableOtherIncomesNikName = nikNameKey ? (dbTaxableOtherIncomesByNikName.get(nikNameKey) || []) : [];
            const empTaxableOtherIncomesAll = [...empTaxableOtherIncomes, ...empTaxableOtherIncomesNikName.filter(
                ni => !empTaxableOtherIncomes.some(existing => existing.type === ni.type && existing.name === ni.name)
            )];

            const getOiByType = (type: string) => empOtherIncomes
                .filter(oi => (oi.type || '').toUpperCase() === type.toUpperCase())
                .reduce((sum, oi) => sum + Number(oi.amount || 0), 0);
            const getTaxableOiByType = (type: string, incomeList: { type: string; name: string; amount: number }[]) =>
                incomeList
                    .filter(oi => (oi.type || '').toUpperCase() === type.toUpperCase())
                    .reduce((sum, oi) => sum + Number(oi.amount || 0), 0);

            const taxable_pendapatan_thr = getTaxableOiByType('THR', empTaxableOtherIncomesAll);
            const taxable_pendapatan_bonus = getTaxableOiByType('BONUS', empTaxableOtherIncomesAll);
            const taxable_pendapatan_custom = getTaxableOiByType('CUSTOM', empTaxableOtherIncomesAll);

            // [DYNAMIC] Discover all non-standard income types and sum them
            const standardTypes = new Set(['THR', 'BONUS', 'CUSTOM']);
            const customTypeAmounts: Record<string, number> = {};
            for (const oi of empOtherIncomes) {
                const oiType = (oi.type || '').toUpperCase();
                if (oiType && !standardTypes.has(oiType)) {
                    customTypeAmounts[oiType] = (customTypeAmounts[oiType] || 0) + Number(oi.amount || 0);
                }
            }
            // [DEBUG KONTAN] Log custom type amounts for this employee
            const customTypesTotal = Object.values(customTypeAmounts).reduce((sum, v) => sum + v, 0);
            if (customTypesTotal > 0) {
                debug("KONTAN", `empNik=${empNik}, empCodeKey=${empCodeKey}, customTypeAmounts=`, JSON.stringify(customTypeAmounts));
            }

            // Taxable for custom types
            let taxable_custom_types_total = 0;
            for (const oi of empTaxableOtherIncomesAll) {
                const oiType = (oi.type || '').toUpperCase();
                if (oiType && !standardTypes.has(oiType)) {
                    taxable_custom_types_total += Number(oi.amount || 0);
                }
            }
            const taxable_pendapatan_lainnya = taxable_pendapatan_thr + taxable_pendapatan_bonus + taxable_pendapatan_custom + taxable_custom_types_total;
            const pendapatan_lainnya_amount = getOiByType('THR') + getOiByType('BONUS') + getOiByType('CUSTOM') + customTypesTotal;

            // [FIXED] PREMI_PPH is an ADDITION (penambah), NOT a deduction
            // [FIXED] pot_koreksi is ONLY in Potongan Upah Kotor, NOT in total_potongan
            // total_potongan = astek + bpjs_pekerja + spsi + pph21 + other (no koreksi) + pendapatan_lainnya_amount
            const total_potongan = pot_astek_pekerja + pot_bpjs_kesehatan_pekerja + pot_bpjs_pensiun_pekerja +
                pot_spsi + pot_pph21 + other_potongan + pendapatan_lainnya_amount;

            // [FIXED] KOREKSI is deducted from jumlah_upah_kotor (Potongan Upah Kotor section)
            // Use gaji_pokok_aktual (calculated earlier) for gross wage calculation
            // [OTHER INCOMES] Add pendapatan_tidak_tetap_thp to jumlah_upah_kotor so it's included in tax calculation
            // [PENDAPATAN LAINNYA] Add pendapatan_lainnya_amount to jumlah_upah_kotor so it is visibly deducted in total_potongan
            const jumlah_upah_kotor = (gaji_pokok_aktual + total_tunjangan + total_premi + pendapatan_tidak_tetap_thp + pendapatan_lainnya_amount) - pot_koreksi;

            // [NEW] Upah Kotor Pajak = (Jumlah Upah Kotor - Pendapatan Lainnya) + Astek + BPJS Kesehatan + Other Taxable Incomes (untuk header/pajak)
            const upah_kotor_pajak = (jumlah_upah_kotor - pendapatan_lainnya_amount) + pot_astek_pekerja + pot_bpjs_kesehatan_pekerja + pendapatan_tidak_tetap_taxable;

            // [FIXED] PREMI_PPH is ADDED (+) to upah_bersih, not subtracted
            // [OTHER INCOMES] Subtract pendapatan_tidak_tetap_thp because it's already paid in THP (not in regular payroll)
            // [PENDAPATAN LAINNYA] Already deducted mathematically via total_potongan
            // Formula: upah_bersih = jumlah_upah_kotor - total_potongan + premi_pph - pendapatan_tidak_tetap_thp
            const upah_bersih = jumlah_upah_kotor - total_potongan + pot_premi_pph - pendapatan_tidak_tetap_thp;

            // formula handled inside OOP logic
            const koreksi_hk = gpResult?.koreksi_hk?.value || 0;

            // [FIXED] Astek 0.84% calculation
            // IMPORTANT: Always calculated from payrate × 30 (monthly salary), NOT from gaji_pokok_ideal
            // Formula: (payrate × 30 + tunjangan_masa_kerja) × 0.84%
            // This is the EMPLOYER portion of BPJS Pensiun (ASTEK) for tax calculation
            const gaji_pokok_bulanan = caruman.gajiStandar; // Always payrate × 30
            const astek_084 = caruman.astek_majikan_jkk_jkm; // 0.84%

            // [CENTRALIZED] BPJS Kesehatan Majikan (4%)
            const bpjs_kesehatan_majikan_4_pct = caruman.bpjs_kes_majikan; // 4%

            // [UPDATED] Penghasilan Bruto calculation for PPh21 TER
            // IMPORTANT: Includes ASTEK (0.84%) + BPJS Kesehatan Majikan (4%) + Taxable Other Incomes (THR, etc)
            // Per PP 58 Tahun 2023, penghasilan bruto untuk perhitungan PPh21 meliputi:
            // - Gaji Pokok Aktual
            // - Tunjangan (Beras, Jabatan, Masa Kerja)
            // - Lembur
            // - Premi
            // - ASTEK/BPJS Pensiun Majikan (0.84%)
            // - BPJS Kesehatan Majikan (4%)
            // - Other Taxable Incomes
            const penghasilan_bruto = gaji_pokok_aktual +
                berasJumlah +
                empJabatan +
                empMasaKerjaJumlah +
                empLemburJumlahPure +
                total_premi +
                astek_084 +
                bpjs_kesehatan_majikan_4_pct +
                pendapatan_tidak_tetap_taxable -
                pot_koreksi;

            // Use DB Master PTKP mapped status if available, or fallback to RiceRation mapping
            const rawEmpCode = String(emp.emp_code || '').trim().toUpperCase();
            const statusPtkp = dbPtkpMap.get(rawEmpCode) || mapBerasRateToPTKP(berasRate);

            // [NEW] PPH21 TER calculation
            // Calculate TER rate and PPH21 amount based on penghasilan_bruto and status_ptkp
            const pph21TerResult = calculatePph21Ter(penghasilan_bruto, statusPtkp);
            const tarif_pajak_ter = pph21TerResult.rate_percent; // Rate as percentage (e.g., 5 for 5%)
            const pph21_ter = pph21TerResult.tax_amount;
            const row: PayrollRow = {
                emp_code: latestEmpCode,  // Plantware internal EmpCode
                nik: emp.actual_nik || emp.emp_code,  // Actual NIK KTP (e.g. 1902050504860001)
                new_nik: emp.actual_nik || emp.emp_code,  // NEW: Explicit KTP NIK
                nama: emp.emp_name,
                jabatan_estate: empJobTitle,
                jenis_kelamin: emp.gender === "2" || emp.gender === "P" ? "P" : "L",
                status_ptkp: statusPtkp,
                kategori_ter: mapPTKPToTER(statusPtkp),
                loc_code: emp.loc_code,
                gang_code: emp.gang_code,
                upah_dasar: empUpahDasar,
                jumlah_hk: hk, // [UPDATED] Use Total HK (including Sundays & Holidays) as requested
                total_jam_kerja: attData.total_hours,
                has_shortage: attData.shortage_count > 0,
                shortage_details: attData.shortage_details || [],
                shortage_total_hours: attData.shortage_total_hours || 0,
                has_excess: (attData.excess_details || []).length > 0,
                excess_details: attData.excess_details || [],
                excess_total_hours: attData.excess_total_hours || 0,
                hari_kerja,
                gaji_pokok,
                kehadiran: hari_kerja,
                // Task/Job Code fields
                task_code: taskCodes[emp.emp_code]?.task_code || "",
                task_desc: taskCodes[emp.emp_code]?.task_desc || "",
                task_type: taskCodes[emp.emp_code]?.task_type || "",
                task_uom: taskCodes[emp.emp_code]?.task_uom || "",
                cuti_tahunan_hari: empCuti.cuti_tahunan,
                cuti_sakit_haid_hari: empCuti.cuti_sakit_haid,
                cuti_minggu_hari: empCuti.cuti_minggu,
                cuti_nasional_hari: empCuti.cuti_nasional,
                beras_rate: berasRate,
                beras_jumlah: berasJumlah,
                jabatan_rate: jabatanRate,
                jabatan_jumlah: empJabatan,
                masa_kerja_tahun: masaKerjaLama,
                masa_kerja_rate: masaKerjaRate,
                masa_kerja_jumlah: empMasaKerjaJumlah,
                // [FIX] Use pure overtime (OT=1) values to ensure detail records match the total
                lembur_jam: empLemburJamPure,
                lembur_rate: empLemburJumlahPure > 0 && empLemburJamPure > 0 ? empLemburJumlahPure / empLemburJamPure : 0,
                lembur_jumlah: empLemburJumlahPure,
                lembur_records: (empLemburDetails.records || []).map((r: any) => ({
                    ...r,
                    trx_date: r.date || r.trx_date || "", // Map date to trx_date, handle both just in case
                    meta: r.meta
                })),
                // Harvest / Bunches data (only for harvest gangs ending with "H")
                ...(harvesterService.isHarvestGang(emp.gang_code) ? {
                    bunches_total: bunchesBatch.get(emp.emp_code)?.total_bunches || 0,
                    bunches_ripe: bunchesBatch.get(emp.emp_code)?.bunches_ripe || 0,
                    bunches_unripe: bunchesBatch.get(emp.emp_code)?.bunches_unripe || 0,
                    bunches_underripe: bunchesBatch.get(emp.emp_code)?.bunches_underripe || 0,
                    bunches_overripe: bunchesBatch.get(emp.emp_code)?.bunches_overripe || 0,
                    bunches_rotten: bunchesBatch.get(emp.emp_code)?.bunches_rotten || 0,
                    bunches_abnormal: bunchesBatch.get(emp.emp_code)?.bunches_abnormal || 0,
                    loose_fruit: bunchesBatch.get(emp.emp_code)?.loose_fruit || 0,
                    bunches_transactions: bunchesBatch.get(emp.emp_code)?.bunches_transactions || 0,
                } : {}),
                total_tunjangan,
                // [PHASE 2.5] Brondol dual source breakdown
                // Keep premi_brondol for backward compatibility (combined total)
                premi_brondol: empBrondol,
                premi_brondol_loosefruit: empBrondolLoosefruit,
                premi_brondol_adtrans: empBrondolAdtrans,
                premi_brondol_total: empBrondolTotal,
                upah_pokok,
                total_premi,
                jumlah_upah_kotor,
                upah_kotor_pajak,
                pot_astek_majikan,
                pot_astek_jumlah,
                pot_bpjs_kesehatan_pekerja,
                pot_bpjs_kesehatan_majikan,
                pot_bpjs_kesehatan_jumlah,
                pot_bpjs_pensiun_pekerja,
                pot_bpjs_pensiun_majikan,
                pot_bpjs_pensiun_jumlah,
                gaji_pokok_ideal,
                gaji_pokok_aktual,
                koreksi_hk,
                hk_warning: koreksi_hk < 0 ? 'kurang_jam' : (koreksi_hk > 0 ? 'salah_scan' : undefined),
                pot_spsi,
                pot_pph21,
                // [ALIAS] Ensure PPH21 and SPSI are available as keys expected by AggregationService/Frontend
                pph21: pot_pph21,
                spsi: pot_spsi,
                pot_koreksi,
                premi_koreksi: pot_koreksi,
                potongan_upah_kotor_total: pot_koreksi,
                potongan_upah_kotor_details: {
                    koreksi: pot_koreksi,
                    ...koreksiVariations,
                    total: pot_koreksi
                },
                gaji_pokok_bulanan,
                astek_084,
                bpjs_kesehatan_majikan_4_pct,
                penghasilan_bruto,
                tarif_pajak_ter,
                pph21_ter,
                total_potongan,
                // [FIXED] total_potongan_bersih = total_potongan - premi_pph
                // Because premi_pph is ADDED (+), not deducted
                // So: Jumlah Potongan Bersih = BPJS + ASTEK + SPSI + PPH21 - PREMI_PPH
                total_potongan_bersih: total_potongan - pot_premi_pph,
                // [NEW] premi_pph is separate field for display with + sign
                premi_pph: pot_premi_pph,
                pendapatan_tidak_tetap_thp,
                pendapatan_tidak_tetap_taxable,
                upah_bersih,
                // Other Incomes for display (THR, Bonus, Custom, etc.)
                other_incomes: empOtherIncomes,
                // [NEW] Pre-computed income fields for gang_total aggregation
                pendapatan_thr: getOiByType('THR'),
                pendapatan_bonus: getOiByType('BONUS'),
                pendapatan_custom: getOiByType('CUSTOM'),
                // [DYNAMIC] Add pendapatan_{type} for each custom income type
                ...Object.fromEntries(
                    Object.entries(customTypeAmounts).map(([type, amount]) => [
                        `pendapatan_${type.toLowerCase()}`, amount
                    ])
                ),
                pendapatan_lainnya: pendapatan_lainnya_amount,
                // [NEW] Pendapatan Lainnya shown as a deduction in Potongan Upah Bersih section
                pot_pendapatan_lainnya: pendapatan_lainnya_amount,
                // [NEW] Taxable breakdown of other incomes for PAJAK section display
                // These show how THR/Bonus/Custom are included in penghasilan_bruto
                taxable_pendapatan_thr,
                taxable_pendapatan_bonus,
                taxable_pendapatan_custom,
                taxable_pendapatan_lainnya,
                // REMOVED: premi: empPremi - causes double-counting in frontend
                // Individual premi fields are already added via ...empPremi below
                pot_astek: pot_astek_pekerja,
                pot_astek_pekerja: pot_astek_pekerja,
                pot_astek_maj: pot_astek_majikan,
                pot_bpjs_pekerja_total: pot_bpjs_kesehatan_pekerja + pot_bpjs_pensiun_pekerja,
                // Add individual koreksi variations as separate fields
                ...koreksiVariations,
                // Add dynamic potongan fields (POTONGAN X, etc.) excluding static fields and PREMI_PPH
                // PREMI_PPH is explicitly excluded to prevent it from being
                // misinterpreted as a generic deduction or premium in export functions.
                // It is already handled as the `premi_pph` field above.
                ...Object.fromEntries(
                    Object.entries(empPotongan).filter(([key]) =>
                        key !== "SPSI" && key !== "PPH21" && !key.startsWith("KOREKSI") && key !== "PREMI_PPH"
                    )
                ),
                ...empPremi,
                // [RESTORED] premi object for aggregation seeder compatibility
                premi: empPremi,
                premi_details: premiDetails[emp.emp_code] || []
            };

            dataRows.push(row);
        }
        debug(CATEGORY, `Phase 3 - Row processing (${employees.length} employees): ${(performance.now() - startRowProcessing).toFixed(0)}ms`);

        const totalMs = Date.now() - startTime;
        const result = {
            data_rows: dataRows,
            dynamic_premi_headers: Array.from(dynamicPremiSet),
            dynamic_potongan_headers: Array.from(dynamicPotonganSet),
            premi_title_map: premiTitleMap,
            potongan_title_map: potonganTitleMap,
            meta: {
                execution_time_ms: totalMs,
                row_count: dataRows.length
            }
        };

        // ============================================================
        // [OPTIMIZATION] Cache the result
        // Historical periods (before current): cache 1 hour
        // Current period: cache 2 minutes (fresher data)
        // ============================================================
        const cacheTtl = isHistorical ? 3600 : 120;
        cacheService.set(cacheKey, result, cacheTtl);
        debug(CATEGORY, `TOTAL: ${totalMs}ms for ${gangCode}/${month}/${year} (${dataRows.length} rows, cache TTL=${cacheTtl}s)`);

        return result;
    }

    public async getEmployees(gangCondition: string, month: number, year: number, serverProfile?: string, isHistorical: boolean = false, gangCodeInput: string | null = null): Promise<EmployeeRow[]> {
        const db = serverProfile ? Database.getInstance(undefined, serverProfile) : this.db;


        let rows: any[];

        if (isHistorical) {
            // For historical data, use PR_GANGLN_ARC with AccMonth/AccYear filtering
            let accMonth: number;
            let accYear: number;

            const { accMonth: calculatedAccMonth, accYear: calculatedAccYear } = currentPeriodService.calendarToAccMonth(month, year);
            accMonth = calculatedAccMonth;
            accYear = calculatedAccYear;



            // For historical path: g = PR_GANG (has GangID, Description, no GangCode)
            // Override gangCondition if gangCodeInput is provided
            let historicalCondition = gangCondition;
            if (gangCodeInput) {
                historicalCondition = `(UPPER(RTRIM(g.GangID)) = '${gangCodeInput}' OR UPPER(RTRIM(g.Description)) = '${gangCodeInput}')`;
            } else {
                historicalCondition = gangCondition.replace(/g\.GangCode/ig, 'g.GangID');
            }

            // PR_GANGLN_ARC uses EmpCode column and MasterID to join with PR_GANG
            rows = await db.query<any>(`
                SELECT DISTINCT
                    RTRIM(e.EmpCode) as emp_code,
                    e.NewICNo as actual_nik,
                    e.EmpName as emp_name,
                    e.Gender as gender,
                    RTRIM(e.LocCode) as loc_code,
                    COALESCE(RTRIM(g.GangID), RTRIM(g.Description)) as gang_code,
                    RTRIM(g.Description) as gang_desc,
                    COALESCE(p.PayRate, 0) as pay_rate,
                    COALESCE(p.RiceRation, 0) as beras_rate,
                    em.AppJoinGrpDate as join_date,
                    e.ResAddress as res_address,
                    e.HREmpType as hr_emp_type
                FROM HR_EMPLOYEE e
                INNER JOIN PR_GANGLN_ARC gl ON RTRIM(gl.EmpCode) = RTRIM(e.EmpCode)
                    AND gl.AccMonth = ?
                    AND gl.AccYear = ?
                INNER JOIN PR_GANG g ON g.ID = gl.MasterID
                LEFT JOIN HR_PAYROLL p ON RTRIM(p.EmpCode) = RTRIM(e.EmpCode)
                LEFT JOIN HR_EMPLOYMENT em ON RTRIM(em.EmpCode) = RTRIM(e.EmpCode)
                WHERE ${historicalCondition}
                ORDER BY emp_code
            `, [accMonth, accYear]);
        } else {
            // For current/future data, use HR_GANGLN (current active data)


            rows = await db.query<any>(`
                SELECT DISTINCT
                    RTRIM(e.EmpCode) as emp_code,
                    e.NewICNo as actual_nik,
                    e.EmpName as emp_name,
                    e.Gender as gender,
                    RTRIM(e.LocCode) as loc_code,
                    RTRIM(gl.GangCode) as gang_code,
                    RTRIM(g.Description) as gang_desc,
                    COALESCE(p.PayRate, 0) as pay_rate,
                    COALESCE(p.RiceRation, 0) as beras_rate,
                    em.AppJoinGrpDate as join_date,
                    e.ResAddress as res_address,
                    e.HREmpType as hr_emp_type
                FROM HR_EMPLOYEE e
                INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
                INNER JOIN HR_GANG g ON RTRIM(g.GangCode) = RTRIM(gl.GangCode)
                LEFT JOIN HR_PAYROLL p ON RTRIM(p.EmpCode) = RTRIM(e.EmpCode)
                LEFT JOIN HR_EMPLOYMENT em ON RTRIM(em.EmpCode) = RTRIM(e.EmpCode)
                WHERE ${gangCondition}
                ORDER BY emp_code
            `);

            // [FALLBACK] If no data in base table (HR_GANGLN) for current period,
            // try ARC table (PR_GANGLN_ARC) as fallback - data may have been archived
            if (rows.length === 0) {
                const { accMonth: fallbackAccMonth, accYear: fallbackAccYear } = currentPeriodService.calendarToAccMonth(month, year);

                // Build ARC-compatible gang condition (PR_GANG uses GangID/Description, not GangCode)
                let arcCondition = gangCondition;
                if (gangCodeInput) {
                    arcCondition = `(UPPER(RTRIM(g.GangID)) = '${gangCodeInput}' OR UPPER(RTRIM(g.Description)) = '${gangCodeInput}')`;
                }

                rows = await db.query<any>(`
                    SELECT DISTINCT
                        RTRIM(e.EmpCode) as emp_code,
                        e.NewICNo as actual_nik,
                        e.EmpName as emp_name,
                        e.Gender as gender,
                        RTRIM(e.LocCode) as loc_code,
                        COALESCE(RTRIM(g.GangID), RTRIM(g.Description)) as gang_code,
                        RTRIM(g.Description) as gang_desc,
                        COALESCE(p.PayRate, 0) as pay_rate,
                        COALESCE(p.RiceRation, 0) as beras_rate,
                        em.AppJoinGrpDate as join_date,
                        e.ResAddress as res_address,
                        e.HREmpType as hr_emp_type
                    FROM HR_EMPLOYEE e
                    INNER JOIN PR_GANGLN_ARC gl ON RTRIM(gl.EmpCode) = RTRIM(e.EmpCode)
                        AND gl.AccMonth = ?
                        AND gl.AccYear = ?
                    INNER JOIN PR_GANG g ON g.ID = gl.MasterID
                    LEFT JOIN HR_PAYROLL p ON RTRIM(p.EmpCode) = RTRIM(e.EmpCode)
                    LEFT JOIN HR_EMPLOYMENT em ON RTRIM(em.EmpCode) = RTRIM(e.EmpCode)
                    WHERE ${arcCondition}
                    ORDER BY emp_code
                `, [fallbackAccMonth, fallbackAccYear]);

                if (rows.length === 0) {
                    console.log(`[DataExtractor] ARC Fallback: no data found for ${month}/${year}`);
                }
            }
        }

        // Fetch HR data overrides (e.g. NIK KTP)
        const empCodes = rows.map((r: any) => r.emp_code?.trim()).filter(Boolean);
        const hrDataMap = await employeeHrDataService.getHrDataBulk(empCodes);

        return rows.map((r: any) => {
            const rawGangCode = r.gang_code?.trim() || "";
            const rawLocCode = r.loc_code?.trim() || "";
            const rawDesc = r.gang_desc?.trim() || "";
            
            // Resolve display LocCode (checks for virtual divisions like NRS, INF, etc.)
            const resolvedLocCode = divisionDefinition.getVirtualDivisionForGang(rawGangCode, rawLocCode, rawDesc) || rawLocCode;

            const empCodeClean = r.emp_code?.trim().toUpperCase() || "";
            const hrOverride = hrDataMap.get(empCodeClean);

            // If there's an override for NIK, use it. Otherwise use NewICNo, otherwise use EmpCode
            const finalNik = hrOverride?.nik_ktp?.trim() || r.actual_nik?.trim() || r.emp_code?.trim() || "";
            const finalNpwp = hrOverride?.npwp?.trim() || "";

            return {
                emp_code: r.emp_code?.trim() || "",
                actual_nik: finalNik,
                pajak_npwp: finalNpwp,
                emp_name: r.emp_name?.trim() || "",
                gender: String(r.gender || "1"),
                loc_code: resolvedLocCode,
                gang_code: rawGangCode, // Return exact fetched code
                pay_rate: r.pay_rate || 0,
                beras_rate: r.beras_rate || 0,
                join_date: r.join_date || null,
                res_address: r.res_address?.trim() || "",
                hr_emp_type: r.hr_emp_type?.trim() || ""
            };
        });
    }

    // ============================================================
    // [OPTIMIZATION] Consolidated: 3 queries → 1 query
    // Combines: attendance summary + shortage details + excess details
    // All in a single UNION ALL, processed in-memory
    // ============================================================
    private async getAttendance(empCodes: string[], startDate: string, endDate: string, serverProfile?: string): Promise<Record<string, {
        hk: number;
        total_hours: number;
        shortage_count: number;
        total_amount_rp: number;
        shortage_details: Array<{ date: string; day_name: string; actual_hours: number; target_hours: number; shortage_hours: number }>;
        shortage_total_hours: number;
        excess_details: Array<{ date: string; day_name: string; actual_hours: number; target_hours: number; excess_hours: number }>;
        excess_total_hours: number;
    }>> {
        if (!empCodes.length) return {};
        const db = serverProfile ? Database.getInstance(undefined, serverProfile) : this.db;
        const empList = empCodes.map(e => `'${e}'`).join(",");

        // [OPTIMIZATION] Single query: summary + shortage details + excess details
        // Uses a derived table with row_type to distinguish aggregation vs detail rows
        // Row_type: 'A' = summary aggregation, 'S' = shortage detail, 'E' = excess detail
        const rows = await db.query<{
            emp_code: string;
            row_type: string;
            hk: number;
            total_hours: number;
            shortage_count: number;
            total_amount_rp: number;
            detail_date: string | null;
            detail_day_name: string | null;
            detail_hours: number;
            detail_target: number;
        }>(`
            SELECT
                emp_code,
                row_type,
                MAX(hk) as hk,
                MAX(total_hours) as total_hours,
                MAX(shortage_count) as shortage_count,
                MAX(total_amount_rp) as total_amount_rp,
                MAX(detail_date) as detail_date,
                MAX(detail_day_name) as detail_day_name,
                MAX(detail_hours) as detail_hours,
                MAX(detail_target) as detail_target
            FROM (
                -- LIVE: Summary aggregation
                SELECT
                    RTRIM(trl.EmpCode) as emp_code,
                    'A' as row_type,
                    COUNT(DISTINCT trl.TrxDate) as hk,
                    SUM(trl.Hours) as total_hours,
                    SUM(CASE
                        WHEN DATENAME(weekday, trl.TrxDate) IN ('Friday', 'Jumat')
                            THEN CASE WHEN trl.Hours < 5 AND trl.Hours > 0 THEN 1 ELSE 0 END
                        ELSE CASE WHEN trl.Hours < 7 AND trl.Hours > 0 THEN 1 ELSE 0 END
                    END) as shortage_count,
                    SUM(trl.Amount) as total_amount_rp,
                    NULL as detail_date, NULL as detail_day_name, NULL as detail_hours, NULL as detail_target
                FROM PR_TASKREGLN trl
                JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
                WHERE RTRIM(trl.EmpCode) IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate < ?
                  AND trl.OT = 0
                GROUP BY RTRIM(trl.EmpCode)

                UNION ALL

                -- ARC: Summary aggregation
                SELECT
                    RTRIM(trl.EmpCode) as emp_code,
                    'A' as row_type,
                    COUNT(DISTINCT trl.TrxDate) as hk,
                    SUM(trl.Hours) as total_hours,
                    SUM(CASE
                        WHEN DATENAME(weekday, trl.TrxDate) IN ('Friday', 'Jumat')
                            THEN CASE WHEN trl.Hours < 5 AND trl.Hours > 0 THEN 1 ELSE 0 END
                        ELSE CASE WHEN trl.Hours < 7 AND trl.Hours > 0 THEN 1 ELSE 0 END
                    END) as shortage_count,
                    SUM(trl.Amount) as total_amount_rp,
                    NULL as detail_date, NULL as detail_day_name, NULL as detail_hours, NULL as detail_target
                FROM PR_TASKREGLN_ARC trl
                JOIN PR_TASKREG_ARC tr ON tr.ID = trl.MasterID
                WHERE RTRIM(trl.EmpCode) IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate < ?
                  AND trl.OT = 0
                GROUP BY RTRIM(trl.EmpCode)

                UNION ALL

                -- LIVE: Shortage detail rows
                SELECT
                    RTRIM(trl.EmpCode) as emp_code,
                    'S' as row_type,
                    0 as hk, 0 as total_hours, 0 as shortage_count, 0 as total_amount_rp,
                    CONVERT(varchar, trl.TrxDate, 23) as detail_date,
                    DATENAME(weekday, trl.TrxDate) as detail_day_name,
                    SUM(trl.Hours) as detail_hours,
                    CASE WHEN DATENAME(weekday, trl.TrxDate) IN ('Friday', 'Jumat') THEN 5 ELSE 7 END as detail_target
                FROM PR_TASKREGLN trl
                JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
                WHERE RTRIM(trl.EmpCode) IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate < ?
                  AND trl.OT = 0
                GROUP BY RTRIM(trl.EmpCode), trl.TrxDate
                HAVING SUM(trl.Hours) < CASE WHEN DATENAME(weekday, trl.TrxDate) IN ('Friday', 'Jumat') THEN 5 ELSE 7 END
                   AND SUM(trl.Hours) > 0

                UNION ALL

                -- ARC: Shortage detail rows
                SELECT
                    RTRIM(trl.EmpCode) as emp_code,
                    'S' as row_type,
                    0 as hk, 0 as total_hours, 0 as shortage_count, 0 as total_amount_rp,
                    CONVERT(varchar, trl.TrxDate, 23) as detail_date,
                    DATENAME(weekday, trl.TrxDate) as detail_day_name,
                    SUM(trl.Hours) as detail_hours,
                    CASE WHEN DATENAME(weekday, trl.TrxDate) IN ('Friday', 'Jumat') THEN 5 ELSE 7 END as detail_target
                FROM PR_TASKREGLN_ARC trl
                JOIN PR_TASKREG_ARC tr ON tr.ID = trl.MasterID
                WHERE RTRIM(trl.EmpCode) IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate < ?
                  AND trl.OT = 0
                GROUP BY RTRIM(trl.EmpCode), trl.TrxDate
                HAVING SUM(trl.Hours) < CASE WHEN DATENAME(weekday, trl.TrxDate) IN ('Friday', 'Jumat') THEN 5 ELSE 7 END
                   AND SUM(trl.Hours) > 0

                UNION ALL

                -- LIVE: Excess detail rows
                SELECT
                    RTRIM(trl.EmpCode) as emp_code,
                    'E' as row_type,
                    0 as hk, 0 as total_hours, 0 as shortage_count, 0 as total_amount_rp,
                    CONVERT(varchar, trl.TrxDate, 23) as detail_date,
                    DATENAME(weekday, trl.TrxDate) as detail_day_name,
                    SUM(trl.Hours) as detail_hours,
                    CASE WHEN DATENAME(weekday, trl.TrxDate) IN ('Friday', 'Jumat') THEN 5 ELSE 7 END as detail_target
                FROM PR_TASKREGLN trl
                JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
                WHERE RTRIM(trl.EmpCode) IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate < ?
                  AND trl.OT = 0
                GROUP BY RTRIM(trl.EmpCode), trl.TrxDate
                HAVING SUM(trl.Hours) > CASE WHEN DATENAME(weekday, trl.TrxDate) IN ('Friday', 'Jumat') THEN 5 ELSE 7 END

                UNION ALL

                -- ARC: Excess detail rows
                SELECT
                    RTRIM(trl.EmpCode) as emp_code,
                    'E' as row_type,
                    0 as hk, 0 as total_hours, 0 as shortage_count, 0 as total_amount_rp,
                    CONVERT(varchar, trl.TrxDate, 23) as detail_date,
                    DATENAME(weekday, trl.TrxDate) as detail_day_name,
                    SUM(trl.Hours) as detail_hours,
                    CASE WHEN DATENAME(weekday, trl.TrxDate) IN ('Friday', 'Jumat') THEN 5 ELSE 7 END as detail_target
                FROM PR_TASKREGLN_ARC trl
                JOIN PR_TASKREG_ARC tr ON tr.ID = trl.MasterID
                WHERE RTRIM(trl.EmpCode) IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate < ?
                  AND trl.OT = 0
                GROUP BY RTRIM(trl.EmpCode), trl.TrxDate
                HAVING SUM(trl.Hours) > CASE WHEN DATENAME(weekday, trl.TrxDate) IN ('Friday', 'Jumat') THEN 5 ELSE 7 END
            ) combined
            GROUP BY emp_code, row_type
        `, [startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate]);

        // Build result map
        const result: Record<string, {
            hk: number;
            total_hours: number;
            shortage_count: number;
            total_amount_rp: number;
            shortage_details: Array<{ date: string; day_name: string; actual_hours: number; target_hours: number; shortage_hours: number }>;
            shortage_total_hours: number;
            excess_details: Array<{ date: string; day_name: string; actual_hours: number; target_hours: number; excess_hours: number }>;
            excess_total_hours: number;
        }> = {};

        for (const r of rows) {
            const empCode = r.emp_code?.trim() || "";
            if (!result[empCode]) {
                result[empCode] = {
                    hk: 0, total_hours: 0, shortage_count: 0, total_amount_rp: 0,
                    shortage_details: [], shortage_total_hours: 0,
                    excess_details: [], excess_total_hours: 0
                };
            }

            if (r.row_type === 'A') {
                result[empCode].hk += r.hk || 0;
                result[empCode].total_hours += r.total_hours || 0;
                result[empCode].shortage_count += r.shortage_count || 0;
                result[empCode].total_amount_rp += r.total_amount_rp || 0;
            } else if (r.row_type === 'S') {
                if (r.detail_date && result[empCode]) {
                    const shortage_hours = (r.detail_target || 0) - (r.detail_hours || 0);
                    result[empCode].shortage_details.push({
                        date: r.detail_date,
                        day_name: r.detail_day_name || "",
                        actual_hours: r.detail_hours || 0,
                        target_hours: r.detail_target || 0,
                        shortage_hours
                    });
                    result[empCode].shortage_total_hours += shortage_hours;
                }
            } else if (r.row_type === 'E') {
                if (r.detail_date && result[empCode]) {
                    const excess_hours = (r.detail_hours || 0) - (r.detail_target || 0);
                    result[empCode].excess_details.push({
                        date: r.detail_date,
                        day_name: r.detail_day_name || "",
                        actual_hours: r.detail_hours || 0,
                        target_hours: r.detail_target || 0,
                        excess_hours
                    });
                    result[empCode].excess_total_hours += excess_hours;
                }
            }
        }

        return result;
    }

    private async getCuti(empCodes: string[], startDate: string, endDate: string, serverProfile?: string): Promise<Record<string, CutiData>> {
        if (!empCodes.length) return {};
        const db = serverProfile ? Database.getInstance(undefined, serverProfile) : this.db;
        const empList = empCodes.map(e => `'${e}'`).join(",");

        // ============================================================
        // [OPTIMIZATION] Consolidated: 3 queries → 1 query
        // All cuti types (task-based, minggu, nasional) in single round-trip
        // ============================================================
        const rows = await db.query<{ emp_code: string; cuti_tahunan: number; cuti_sakit_haid: number; cuti_minggu: number; cuti_nasional: number }>(`
            SELECT
                RTRIM(EmpCode) as emp_code,
                SUM(cuti_tahunan) as cuti_tahunan,
                SUM(cuti_sakit_haid) as cuti_sakit_haid,
                SUM(cuti_minggu) as cuti_minggu,
                SUM(cuti_nasional) as cuti_nasional
            FROM (
                -- LIVE table: all cuti types via conditional aggregation
                SELECT
                    trl.EmpCode,
                    CASE WHEN trl.TaskCode LIKE 'GA9129%' THEN 1 ELSE 0 END as cuti_tahunan,
                    CASE WHEN trl.TaskCode LIKE 'GA9126%' THEN 1 ELSE 0 END as cuti_sakit_haid,
                    CASE WHEN DATEPART(weekday, trl.TrxDate) = 1 AND NOT EXISTS (SELECT 1 FROM HR_GPH h WHERE h.HolidayDate = trl.TrxDate) THEN 1 ELSE 0 END as cuti_minggu,
                    CASE WHEN EXISTS (SELECT 1 FROM HR_GPH h WHERE h.HolidayDate = trl.TrxDate) THEN 1 ELSE 0 END as cuti_nasional
                FROM PR_TASKREGLN trl
                JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
                WHERE RTRIM(trl.EmpCode) IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate < ?
                  AND trl.OT = 0
                  AND (
                      trl.TaskCode LIKE 'GA9129%' OR trl.TaskCode LIKE 'GA9126%'
                      OR DATEPART(weekday, trl.TrxDate) = 1
                  )

                UNION ALL

                -- ARCHIVE table: same conditional aggregation
                SELECT
                    trl.EmpCode,
                    CASE WHEN trl.TaskCode LIKE 'GA9129%' THEN 1 ELSE 0 END as cuti_tahunan,
                    CASE WHEN trl.TaskCode LIKE 'GA9126%' THEN 1 ELSE 0 END as cuti_sakit_haid,
                    CASE WHEN DATEPART(weekday, trl.TrxDate) = 1 AND NOT EXISTS (SELECT 1 FROM HR_GPH h WHERE h.HolidayDate = trl.TrxDate) THEN 1 ELSE 0 END as cuti_minggu,
                    CASE WHEN EXISTS (SELECT 1 FROM HR_GPH h WHERE h.HolidayDate = trl.TrxDate) THEN 1 ELSE 0 END as cuti_nasional
                FROM PR_TASKREGLN_ARC trl
                JOIN PR_TASKREG_ARC tr ON tr.ID = trl.MasterID
                WHERE RTRIM(trl.EmpCode) IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate < ?
                  AND trl.OT = 0
                  AND (
                      trl.TaskCode LIKE 'GA9129%' OR trl.TaskCode LIKE 'GA9126%'
                      OR DATEPART(weekday, trl.TrxDate) = 1
                  )
            ) combined
            GROUP BY RTRIM(EmpCode)
        `, [startDate, endDate, startDate, endDate]);

        // Initialize result with all employees (0 values for those with no cuti)
        const result: Record<string, CutiData> = {};
        for (const emp of empCodes) {
            result[emp] = { cuti_tahunan: 0, cuti_sakit_haid: 0, cuti_minggu: 0, cuti_nasional: 0 };
        }
        // Fill in actual values from query
        for (const r of rows) {
            const emp = r.emp_code?.trim() || "";
            if (result[emp]) {
                result[emp].cuti_tahunan = r.cuti_tahunan || 0;
                result[emp].cuti_sakit_haid = r.cuti_sakit_haid || 0;
                result[emp].cuti_minggu = r.cuti_minggu || 0;
                result[emp].cuti_nasional = r.cuti_nasional || 0;
            }
        }

        return result;
    }

    // [PREMI] Uses DocDesc containing 'PREMI' as column header title
    // [RULE] Exclude premi containing 'PPH' - those should go to potongan instead
    private async getPremi(empCodes: string[], startDate: string, endDate: string, isHistorical: boolean = false, serverProfile?: string): Promise<{ amounts: Record<string, Record<string, number>>; titleMap: Record<string, string>; details: Record<string, any[]> }> {
        if (!empCodes.length) return { amounts: {}, titleMap: {}, details: {} };
        const db = serverProfile ? Database.getInstance(undefined, serverProfile) : this.db;
        const empList = empCodes.map(e => `'${e}'`).join(",");

        // Query DocDesc containing 'PREMI' but EXCLUDE those containing 'PPH'
        // DocDesc will be used as column header
        // Also EXCLUDE TaskDesc = 'ACCRUALS-CHECKROLL' (Premi PPH diambil dari query terpisah)
        let rows = await db.query<{ emp_code: string; doc_desc: string; amount: number; task_code: string; task_desc: string }>(`
            SELECT RTRIM(t.EmpCode) as emp_code, t.DocDesc as doc_desc, SUM(ln.Amount) as amount, ln.TaskCode as task_code, mt.TaskDesc as task_desc
            FROM (
                SELECT t.EmpCode, t.ID, t.DocDesc, t.DocDate
                FROM PR_ADTRANS t
                WHERE RTRIM(t.EmpCode) IN (${empList})
                  AND t.DocDate >= ? AND t.DocDate < ?

                UNION ALL

                SELECT t.EmpCode, t.ID, t.DocDesc, t.DocDate
                FROM PR_ADTRANS_ARC t
                WHERE RTRIM(t.EmpCode) IN (${empList})
                  AND t.DocDate >= ? AND t.DocDate < ?
            ) t
            JOIN (
                SELECT MasterID, TaskCode, Amount FROM PR_ADTRANSLN
                UNION ALL
                SELECT MasterID, TaskCode, Amount FROM PR_ADTRANSLN_ARC
            ) ln ON t.ID = ln.MasterID
            LEFT JOIN PR_TASKCODE mt ON ln.TaskCode = mt.TaskCode
            WHERE ${isHistorical ? `(
                  UPPER(t.DocDesc) LIKE '%PREMI%'
                  AND UPPER(t.DocDesc) NOT LIKE '%PPH%'
                  AND UPPER(t.DocDesc) NOT LIKE '%JABATAN%'
                  AND UPPER(t.DocDesc) NOT LIKE '%BERAS%'
                  AND UPPER(t.DocDesc) NOT LIKE '%LEMBUR%'
                  AND UPPER(t.DocDesc) NOT LIKE '%MASA%'
                  AND UPPER(t.DocDesc) NOT LIKE '%POTONGAN%'
                  AND UPPER(t.DocDesc) NOT LIKE '%KOREKSI%'
                  AND UPPER(t.DocDesc) NOT LIKE '%SPSI%'
                  AND (mt.TaskDesc IS NULL OR mt.TaskDesc <> 'ACCRUALS-CHECKROLL')
              )` : `(
                  (
                      (UPPER(mt.TaskDesc) LIKE '%(AL)%' AND UPPER(mt.TaskDesc) LIKE '%TUNJANGAN%') OR
                      UPPER(t.DocDesc) LIKE '%PREMI%'
                  )
                  AND (mt.TaskDesc IS NULL OR UPPER(mt.TaskDesc) NOT LIKE '%MASA%')
                  AND (mt.TaskDesc IS NULL OR UPPER(mt.TaskDesc) NOT LIKE '%LEMBUR%')
                  AND (mt.TaskDesc IS NULL OR UPPER(mt.TaskDesc) NOT LIKE '%JABATAN%')
                  AND (mt.TaskDesc IS NULL OR UPPER(mt.TaskDesc) NOT LIKE '%BERAS%')
                  AND UPPER(t.DocDesc) NOT LIKE '%PPH%'
                  AND UPPER(t.DocDesc) NOT LIKE '%JABATAN%'
                  AND UPPER(t.DocDesc) NOT LIKE '%BERAS%'
                  AND UPPER(t.DocDesc) NOT LIKE '%LEMBUR%'
                  AND UPPER(t.DocDesc) NOT LIKE '%MASA%'
                  AND UPPER(t.DocDesc) NOT LIKE '%POTONGAN%'
                  AND UPPER(t.DocDesc) NOT LIKE '%KOREKSI%'
                  AND UPPER(t.DocDesc) NOT LIKE '%SPSI%'
                  AND (mt.TaskDesc IS NULL OR mt.TaskDesc <> 'ACCRUALS-CHECKROLL')
              )`}
              AND ln.Amount > 0
            GROUP BY RTRIM(t.EmpCode), t.DocDesc, ln.TaskCode, mt.TaskDesc
        `, [startDate, endDate, startDate, endDate]);

        const amounts: Record<string, Record<string, number>> = {};
        const titleMap: Record<string, string> = {}; // key (normalized) -> DocDesc (original)
        const details: Record<string, any[]> = {}; // emp_code -> list of detail objects

        for (const r of rows) {
            const emp = r.emp_code?.trim() || "";
            if (!amounts[emp]) amounts[emp] = {};
            if (!details[emp]) details[emp] = [];
            const key = this.normalizePremiName(r.doc_desc || "");
            amounts[emp][key] = (amounts[emp][key] || 0) + (r.amount || 0);

            details[emp].push({
                doc_desc: r.doc_desc?.trim(),
                task_code: r.task_code?.trim(),
                task_desc: r.task_desc?.trim(),
                amount: r.amount,
                normalized_key: key
            });

            // [MODIFIED] Use DocDesc (TaskCode) as title for PREMI as requested
            // so it displays on two lines
            if (!titleMap[key]) {
                const taskCode = r.task_code?.trim();
                const docDesc = r.doc_desc?.trim() || key;
                titleMap[key] = taskCode ? `${docDesc}\n(${taskCode})` : docDesc;
            }
        }

        return { amounts, titleMap, details };
    }

    // ============================================================
    // [OPTIMIZATION] Consolidated: 2 queries → 1 UNION ALL query
    // Combines: main potongan rows + PREMI_PPH (ACCRUALS-CHECKROLL) rows
    // ============================================================
    private async getPotongan(empCodes: string[], startDate: string, endDate: string, serverProfile?: string): Promise<{ amounts: Record<string, Record<string, number>>; titleMap: Record<string, string> }> {
        if (!empCodes.length) return { amounts: {}, titleMap: {} };
        const db = serverProfile ? Database.getInstance(undefined, serverProfile) : this.db;
        const empList = empCodes.map(e => `'${e}'`).join(",");

        // [OPTIMIZATION] Single query: main potongan + PREMI_PPH (ACCRUALS-CHECKROLL) combined
        // row_type: 'P' = regular potongan, 'X' = PREMI_PPH
        let rows = await db.query<{ emp_code: string; doc_desc: string; task_code: string | null; task_desc: string | null; amount: number; row_type: string }>(`
            SELECT
                RTRIM(t.EmpCode) as emp_code,
                t.DocDesc as doc_desc,
                ln.TaskCode as task_code,
                mt.TaskDesc as task_desc,
                SUM(COALESCE(ln.Amount, 0)) as amount,
                CASE WHEN mt.TaskDesc = 'ACCRUALS-CHECKROLL' THEN 'X' ELSE 'P' END as row_type
            FROM (
                SELECT t.EmpCode, t.ID, t.DocDesc, t.DocDate
                FROM PR_ADTRANS t
                WHERE RTRIM(t.EmpCode) IN (${empList})
                  AND t.DocDate >= ? AND t.DocDate < ?

                UNION ALL

                SELECT t.EmpCode, t.ID, t.DocDesc, t.DocDate
                FROM PR_ADTRANS_ARC t
                WHERE RTRIM(t.EmpCode) IN (${empList})
                  AND t.DocDate >= ? AND t.DocDate < ?
            ) t
            JOIN (
                SELECT MasterID, TaskCode, Amount FROM PR_ADTRANSLN
                UNION ALL
                SELECT MasterID, TaskCode, Amount FROM PR_ADTRANSLN_ARC
            ) ln ON t.ID = ln.MasterID
            LEFT JOIN PR_TASKCODE mt ON ln.TaskCode = mt.TaskCode
            WHERE (
                -- Main potongan conditions
                (
                    (UPPER(t.DocDesc) LIKE '%PPH%' AND UPPER(t.DocDesc) NOT LIKE '%PREMI%')
                    OR UPPER(t.DocDesc) LIKE '%POT%'
                    OR UPPER(t.DocDesc) LIKE '%BPJS%'
                    OR UPPER(t.DocDesc) LIKE '%PINJAM%'
                    OR UPPER(t.DocDesc) LIKE '%KL%'
                    OR UPPER(t.DocDesc) LIKE '%SPSI%'
                    OR UPPER(t.DocDesc) LIKE '%KOREKSI%'
                    OR UPPER(t.DocDesc) LIKE '%TOTAL%'
                    OR UPPER(t.DocDesc) LIKE '%KONTAN%'
                    OR UPPER(t.DocDesc) LIKE '%ALAT%'
                    OR UPPER(t.DocDesc) LIKE '%THR%'
                    OR UPPER(ln.TaskCode) LIKE '%DEPH21%'
                    OR UPPER(mt.TaskDesc) LIKE '%POTONGAN PPH21%'
                )
                -- PREMI_PPH (ACCRUALS-CHECKROLL) - also included
                OR mt.TaskDesc = 'ACCRUALS-CHECKROLL'
            )
            GROUP BY RTRIM(t.EmpCode), t.DocDesc, ln.TaskCode, mt.TaskDesc,
                CASE WHEN mt.TaskDesc = 'ACCRUALS-CHECKROLL' THEN 'X' ELSE 'P' END
        `, [startDate, endDate, startDate, endDate]);

        const amounts: Record<string, Record<string, number>> = {};
        const titleMap: Record<string, string> = {};

        for (const r of rows) {
            const emp = r.emp_code?.trim() || "";
            if (!amounts[emp]) amounts[emp] = {};

            let key: string;
            // Handle PREMI_PPH separately
            if (r.row_type === 'X') {
                key = "PREMI_PPH";
                if (!titleMap[key]) titleMap[key] = "PREMI PPH";
            } else {
                const { key: k, title } = this.normalizePotonganName(r.doc_desc || "", r.task_desc, r.task_code);
                key = k;
                if (!titleMap[key]) {
                    if (key.startsWith('KOREKSI')) {
                        titleMap[key] = title;
                    } else {
                        const taskCode = r.task_code?.trim();
                        titleMap[key] = taskCode || title;
                    }
                }
            }

            // [DEBUG] Log PPH items
            if (r.doc_desc?.toUpperCase().includes("PPH") && r.row_type !== 'X') {
                console.log(`[DEBUG_PPH] Emp: ${emp} | Doc: "${r.doc_desc}" | Task: "${r.task_desc}" | Key: "${key}" | Amt: ${r.amount}`);
            }

            amounts[emp][key] = (amounts[emp][key] || 0) + Math.abs(r.amount || 0);
        }

        return { amounts, titleMap };
    }

    private async getLemburDetailsFromCalculator(empCodes: string[], month: number, year: number, serverProfile?: string): Promise<Record<string, LemburData>> {
        const data = await lemburCalculator.calculateBatchData(empCodes, month, year, serverProfile);
        const result: Record<string, LemburData> = {};
        for (const k in data) {
            result[k] = {
                jam: data[k].total_hours || 0,
                jumlah: data[k].total_payment || 0
            };
        }
        return result;
    }

    private async getLemburDetailsWithTaskBreakdown(empCodes: string[], month: number, year: number, serverProfile?: string): Promise<Record<string, LemburDataWithDetails>> {
        const data = await lemburCalculator.calculateBatchDataWithTaskBreakdown(empCodes, month, year, serverProfile);
        const result: Record<string, LemburDataWithDetails> = {};
        for (const k in data) {
            // Use individual transaction records from lemburCalculator
            // This ensures total lembur = sum of all detail records (no double counting)
            const records = (data[k].records || []).map((rec) => ({
                trx_date: rec.date,
                task_code: rec.task_code,
                task_desc: rec.task_desc,
                day_type: rec.day_type,
                hours: rec.hours,
                rate: rec.rate,
                amount: rec.amount
            }));

            result[k] = {
                jam: data[k].total_hours || 0,
                jumlah: data[k].total_payment || 0,
                records: records
            };
        }
        return result;
    }

    private async getLemburDetails(empCodes: string[], startDate: string, endDate: string, serverProfile?: string): Promise<Record<string, LemburData>> {
        if (!empCodes.length) return {};
        const db = serverProfile ? Database.getInstance(undefined, serverProfile) : this.db;
        const empList = empCodes.map(e => `'${e}'`).join(",");

        let rows = await db.query<{ emp_code: string; total_hours: number; total_amount: number }>(`
            SELECT RTRIM(EmpCode) as emp_code, SUM(Hours) as total_hours, SUM(Amount) as total_amount
            FROM (
                SELECT trl.EmpCode, trl.Hours, trl.Amount
                FROM PR_TASKREGLN trl
                JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
                WHERE RTRIM(trl.EmpCode) IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate <= ?
                  AND trl.OT = 1

                UNION ALL

                SELECT trl.EmpCode, trl.Hours, trl.Amount
                FROM PR_TASKREGLN_ARC trl
                JOIN PR_TASKREG_ARC tr ON tr.ID = trl.MasterID
                WHERE RTRIM(trl.EmpCode) IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate <= ?
                  AND trl.OT = 1
            ) combined
            GROUP BY RTRIM(EmpCode)
        `, [startDate, endDate, startDate, endDate]);

        const result: Record<string, LemburData> = {};
        for (const r of rows) {
            result[r.emp_code?.trim() || ""] = {
                jam: r.total_hours || 0,
                jumlah: r.total_amount || 0
            };
        }
        return result;
    }

    private async getTunjanganAmount(empCodes: string[], startDate: string, endDate: string, tunjanganType: string, serverProfile?: string): Promise<Record<string, number>> {
        if (!empCodes.length) return {};
        const db = serverProfile ? Database.getInstance(undefined, serverProfile) : this.db;
        const empList = empCodes.map(e => `'${e}'`).join(",");

        let rows = await db.query<{ emp_code: string; total: number }>(`
            SELECT RTRIM(EmpCode) as emp_code, SUM(Amount) as total
            FROM (
                SELECT t.EmpCode, ln.Amount
                FROM PR_ADTRANS t
                JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
                WHERE RTRIM(t.EmpCode) IN (${empList})
                  AND t.DocDate >= ? AND t.DocDate < ?
                  AND UPPER(t.DocDesc) LIKE '%${tunjanganType}%'
                  AND ln.Amount > 0
                
                UNION ALL

                SELECT t.EmpCode, ln.Amount
                FROM PR_ADTRANS_ARC t
                JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
                WHERE RTRIM(t.EmpCode) IN (${empList})
                  AND t.DocDate >= ? AND t.DocDate < ?
                  AND UPPER(t.DocDesc) LIKE '%${tunjanganType}%'
                  AND ln.Amount > 0
            ) combined
            GROUP BY RTRIM(EmpCode)
        `, [startDate, endDate, startDate, endDate]);

        const result: Record<string, number> = {};
        for (const r of rows) {
            result[r.emp_code?.trim() || ""] = r.total || 0;
        }
        return result;
    }


    /**
     * Get additional lembur amount from DocDesc containing 'LEMBUR'
     * This is added on top of the standard lembur calculation from OT records
     */
    private async getLemburFromDocDesc(empCodes: string[], startDate: string, endDate: string, serverProfile?: string): Promise<Record<string, number>> {
        if (!empCodes.length) return {};
        const db = serverProfile ? Database.getInstance(undefined, serverProfile) : this.db;
        const empList = empCodes.map(e => `'${e}'`).join(",");

        // Try ARC table first (for archived/locked periods)
        let rows = await db.query<{ emp_code: string; total: number; doc_desc: string }>(`
            SELECT t.EmpCode as emp_code, SUM(ln.Amount) as total, t.DocDesc as doc_desc
            FROM PR_ADTRANS_ARC t
            JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
            WHERE t.EmpCode IN (${empList})
              AND t.DocDate >= ? AND t.DocDate < ?
              AND UPPER(t.DocDesc) LIKE '%LEMBUR%'
              AND ln.Amount > 0
            GROUP BY t.EmpCode, t.DocDesc
        `, [startDate, endDate]);

        // If no data, try base table
        if (rows.length === 0) {
            rows = await db.query<{ emp_code: string; total: number; doc_desc: string }>(`
                SELECT t.EmpCode as emp_code, SUM(ln.Amount) as total, t.DocDesc as doc_desc
                FROM PR_ADTRANS t
                JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
                WHERE t.EmpCode IN(${empList})
                  AND t.DocDate >= ? AND t.DocDate < ?
            AND UPPER(t.DocDesc) LIKE '%LEMBUR%'
                  AND ln.Amount > 0
                GROUP BY t.EmpCode, t.DocDesc
            `, [startDate, endDate]);
        }

        if (rows.length > 0) {
            // console.log(`[DataExtractor] Sample lembur DocDesc: `, rows.slice(0, 3));
        }

        const result: Record<string, number> = {};
        for (const r of rows) {
            const empCode = r.emp_code?.trim() || "";
            result[empCode] = (result[empCode] || 0) + (r.total || 0);
        }
        return result;
    }

    /**
     * Get additional beras amount from DocDesc containing 'BERAS'
     * This is added on top of the standard beras calculation (berasRate * HK)
     */
    private async getBerasFromDocDesc(empCodes: string[], startDate: string, endDate: string, serverProfile?: string): Promise<Record<string, number>> {
        if (!empCodes.length) return {};
        const db = serverProfile ? Database.getInstance(undefined, serverProfile) : this.db;
        const empList = empCodes.map(e => `'${e}'`).join(",");

        // Try ARC table first (for archived/locked periods) - WITHOUT RTRIM on EmpCode
        let rows = await db.query<{ emp_code: string; total: number; doc_desc: string }>(`
            SELECT t.EmpCode as emp_code, SUM(ln.Amount) as total, t.DocDesc as doc_desc
            FROM PR_ADTRANS_ARC t
            JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
            WHERE t.EmpCode IN (${empList})
              AND t.DocDate >= ? AND t.DocDate < ?
              AND UPPER(t.DocDesc) LIKE '%BERAS%'
              AND ln.Amount > 0
            GROUP BY t.EmpCode, t.DocDesc
        `, [startDate, endDate]);

        // If no data, try base table
        if (rows.length === 0) {
            rows = await db.query<{ emp_code: string; total: number; doc_desc: string }>(`
                SELECT t.EmpCode as emp_code, SUM(ln.Amount) as total, t.DocDesc as doc_desc
                FROM PR_ADTRANS t
                JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
                WHERE t.EmpCode IN (${empList})
                  AND t.DocDate >= ? AND t.DocDate < ?
                  AND UPPER(t.DocDesc) LIKE '%BERAS%'
                  AND ln.Amount > 0
                GROUP BY t.EmpCode, t.DocDesc
            `, [startDate, endDate]);
        }

        if (rows.length > 0) {
            // console.log(`[DataExtractor] Sample beras DocDesc: `, rows.slice(0, 3));
        }

        const result: Record<string, number> = {};
        for (const r of rows) {
            const empCode = r.emp_code?.trim() || "";
            result[empCode] = (result[empCode] || 0) + (r.total || 0);
        }
        return result;
    }

    // [OPTIMIZATION] Added currentYear param to avoid redundant getCurrentPeriod() call
    private async getUpahPokok(empCodes: string[], year: number, currentYear: number, serverProfile?: string): Promise<Record<string, number>> {
        if (!empCodes.length) return {};
        const db = serverProfile ? Database.getInstance(undefined, serverProfile) : this.db;
        const empList = empCodes.map(e => `'${e}'`).join(",");

        // For historical years (before current year), we still query HR_CPTRX
        // to get the employee-specific rate, but if the queried rate is <= 134500 (current standard),
        // we'll override it with the historical standard rate for that year.
        const rows = await db.query<{ emp_code: string; upah_dasar: number }>(`
            WITH LatestCPTRX AS(
                SELECT EmpCode, NewRate, ROW_NUMBER() OVER(PARTITION BY EmpCode ORDER BY UpdateDate DESC) as rn
                FROM HR_CPTRX
            )
            SELECT RTRIM(e.EmpCode) as emp_code, COALESCE(lc.NewRate, 0) as upah_dasar
            FROM HR_EMPLOYEE e
            LEFT JOIN LatestCPTRX lc ON RTRIM(lc.EmpCode) = RTRIM(e.EmpCode) AND lc.rn = 1
            WHERE RTRIM(e.EmpCode) IN(${empList})
        `);

        const result: Record<string, number> = {};
        for (const r of rows) {
            let rate = r.upah_dasar || 0;

            // For historical years (before current year), override rate if it's the standard minimum
            // or less (e.g., 2026 standard is 134500) and replace it with historical year's standard rate.
            if (year < currentYear && rate <= 134500) {
                rate = Config.getUpahDasar(year);
            }

            result[r.emp_code?.trim() || ""] = rate;
        }
        return result;
    }

    private normalizePremiName(docDesc: string): string {
        let name = docDesc.trim().toUpperCase();

        // Match Python manual handling
        if (name.includes("KOREKSI")) return "koreksi";
        if (name.includes("BRONDOL")) return "brondol";

        // Standard normalization
        name = name
            .replace(/^TUNJANGAN\s*PREMI\s*/i, "")
            .replace(/^PREMI\s*/i, "");

        return `premi_${name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")}`;
    }

    private normalizePotonganName(docDesc: string, taskDesc?: string | null, taskCode?: string | null): { key: string; title: string } {
        const upper = docDesc.toUpperCase().trim();
        const upperTask = taskDesc ? taskDesc.toUpperCase().trim() : "";
        const upperCode = taskCode ? taskCode.toUpperCase().trim() : "";
        const cleanTitle = docDesc.trim();

        // [RULE 1] Handle KOREKSI variations separately
        // Pattern: KOREKSI, KOREKSI A, KOREKSI PANEN, KOREKSI X, etc.
        // Each variation becomes a separate key for display in POTONGAN UPAH KOTOR
        if (upper.includes("KOREKSI")) {
            // Use the full DocDesc as the key, normalized
            const key = upper.replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
            return { key, title: cleanTitle };
        }

        // [RULE 1.5] Specific for Potongan PPh21 matching TaskDesc or DocDesc
        // Pebrikiki untuk PPh21 (yang dipotong atau yang menjadi pengurang upah bersih) dengan taskDesc (DEPH21AB1) (DE) POTONGAN PPH21
        if (upperCode.includes("DEPH21") || upperTask.includes("POTONGAN PPH21") || upper.includes("POTONGAN PPH21") || (upper.includes("PPH21") && upper.includes("POTONGAN"))) {
            return { key: "PPH21", title: "Potongan PPh21" };
        }

        // [RULE 2] Static: PPH21 (PPH yang dipotong) - MUST CHECK BEFORE POTONGAN rule
        // Pattern: DocDesc mengandung "PPH" atau "PAJAK" TAPI tidak mengandung "PREMI"
        // Examples:
        //   - "PPH21" → PPH21 ✓
        //   - "POTONGAN PPH 21" → PPH21 ✓ (contains PPH, not PREMI)
        //   - "PREMI PPH 21" → PREMI_PPH_21 ✗ (contains PREMI)
        //   - "PREMI PPH" → PREMI_PPH ✗ (contains PREMI)
        if (upper.includes("PPH") || upper.includes("PAJAK")) {
            // EXCLUDE: If contains PREMI in DocDesc or TaskDesc, don't treat as PPH21
            // User Request: "kecualikan kata premi,,jadi misal docDesc (premi pph tidak masuk ke pph21)"
            if (upper.includes("PREMI") || upperTask.includes("PREMI")) {
                const key = upper.replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
                return { key, title: cleanTitle };
            }
            return { key: "PPH21", title: "PPH21" };
        }

        // [RULE 3] Static: SPSI
        if (upper.includes("SPSI")) {
            return { key: "SPSI", title: "SPSI" };
        }

        // [RULE 4] Dynamic POTONGAN X patterns
        // Pattern: POTONGAN, POTONGAN A, POTONGAN BERAS, POT X, etc.
        // Each variation becomes a separate column in POTONGAN UPAH BERSIH
        // NOTE: "POTONGAN PPH 21" is handled by RULE 2 (PPH check above)
        if (upper.startsWith("POTONGAN") || upper.startsWith("POT ") || upper.startsWith("POT_")) {
            const key = upper.replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
            return { key, title: cleanTitle };
        }

        // [RULE 5] Default: Use DocDesc as title, normalized key for field name
        const key = upper.replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
        return { key, title: cleanTitle };
    }

    /**
     * Fetch bunches data for multiple employees in batch
     * Only returns data for harvest gangs (ending with "H")
     */
    private async getBunchesBatch(empCodes: string[], month: number, year: number): Promise<Map<string, import("../types/harvest").HarvestData>> {
        if (empCodes.length === 0) {
            return new Map();
        }

        try {
            return await harvesterService.getBatchEmployeeBunches(empCodes, month, year);
        } catch (error: any) {
            console.error("[DataExtractor] Error fetching bunches batch:", error.message);
            return new Map();
        }
    }

    private async getBrondol(empCodes: string[], startDate: string, endDate: string, serverProfile?: string): Promise<Record<string, number>> {
        if (!empCodes.length) return {};
        const db = serverProfile ? Database.getInstance(undefined, serverProfile) : this.db;
        const empList = empCodes.map(e => `'${e}'`).join(",");

        let rows = await db.query<{ emp_code: string; total: number }>(`
            SELECT RTRIM(EmpCode) as emp_code, SUM(Amount) as total
        FROM(
            SELECT LFLN.EmpCode, LFLN.Amount
                FROM PR_LOOSEFRUIT LF
                JOIN PR_LOOSEFRUITLN LFLN ON LF.ID = LFLN.MasterID
                WHERE RTRIM(LFLN.EmpCode) IN(${empList})
                  AND LF.DocDate >= ? AND LF.DocDate < ?

            UNION ALL

                SELECT LFLN.EmpCode, LFLN.Amount
                FROM PR_LOOSEFRUIT_ARC LF
                JOIN PR_LOOSEFRUITLN_ARC LFLN ON LF.ID = LFLN.MasterID
                WHERE RTRIM(LFLN.EmpCode) IN(${empList})
                  AND LF.DocDate >= ? AND LF.DocDate < ?
            ) combined
            GROUP BY RTRIM(EmpCode)
            `, [startDate, endDate, startDate, endDate]);

        const result: Record<string, number> = {};
        for (const r of rows) {
            result[r.emp_code?.trim() || ""] = r.total || 0;
        }
        return result;
    }
    /**
     * Get Job Title (Position) for each employee for the specified month from history table
     */
    private async getPositionHistory(empCodes: string[], month: number, year: number): Promise<Record<string, string>> {
        if (!empCodes.length) return {};
        try {
            const extDb = Database.getExtendedInstance();
            const empList = empCodes.map(e => `'${e}'`).join(",");

            const rows = await extDb.query<{ emp_code: string; position: string }>(`
            SELECT RTRIM(emp_code) as emp_code, position
            FROM history_hr_employee
            WHERE RTRIM(emp_code) IN (${empList})
              AND period_month = ?
              AND period_year = ?
        `, [month, year]);

            const result: Record<string, string> = {};
            for (const r of rows) {
                if (r.emp_code && r.position) {
                    result[r.emp_code.trim()] = r.position.trim();
                }
            }
            return result;
        } catch (e) {
            console.error("[DataExtractor] Failed to get position history:", e);
            return {};
        }
    }

    /**
     * Get Task/Job Code for each employee for the specified month
     * Uses UNION ALL to combine data from both current (PR_TASKREGLN) and historical (PR_TASKREGLN_ARC) tables
     * Returns the most frequent task code for each employee (or the most recent one)
     */
    private async getTaskCodes(empCodes: string[], startDate: string, endDate: string, serverProfile?: string): Promise<Record<string, {
        task_code: string;
        task_desc: string;
        task_type: string;
        task_uom: string;
    }>> {
        if (!empCodes.length) return {};
        const db = serverProfile ? Database.getInstance(undefined, serverProfile) : this.db;
        const empList = empCodes.map(e => `'${e}'`).join(",");

        // Get task codes with descriptions from both tables, then rank by frequency
        // Using simpler column aliases to avoid SQL Gateway issues
        let rows = await db.query<any>(`
            SELECT EmpCode, TaskCode, TaskDesc, TaskType, UOM
            FROM (
                SELECT
                    RTRIM(trl.EmpCode) as EmpCode,
                    trl.TaskCode,
                    tc.TaskDesc,
                    tc.TaskType,
                    tc.UOM,
                    ROW_NUMBER() OVER (
                        PARTITION BY RTRIM(trl.EmpCode)
                        ORDER BY COUNT(*) DESC, trl.TaskCode
                    ) as rn
                FROM PR_TASKREGLN trl
                INNER JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
                LEFT JOIN PR_TASKCODE tc ON trl.TaskCode = tc.TaskCode
                WHERE RTRIM(trl.EmpCode) IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate < ?
                  AND trl.OT = 0
                  AND trl.TaskCode IS NOT NULL
                  AND trl.TaskCode <> ''
                GROUP BY RTRIM(trl.EmpCode), trl.TaskCode, tc.TaskDesc, tc.TaskType, tc.UOM

                UNION ALL

                SELECT
                    RTRIM(trl.EmpCode) as EmpCode,
                    trl.TaskCode,
                    tc.TaskDesc,
                    tc.TaskType,
                    tc.UOM,
                    ROW_NUMBER() OVER (
                        PARTITION BY RTRIM(trl.EmpCode)
                        ORDER BY COUNT(*) DESC, trl.TaskCode
                    ) as rn
                FROM PR_TASKREGLN_ARC trl
                INNER JOIN PR_TASKREG_ARC tr ON tr.ID = trl.MasterID
                LEFT JOIN PR_TASKCODE tc ON trl.TaskCode = tc.TaskCode
                WHERE RTRIM(trl.EmpCode) IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate < ?
                  AND trl.OT = 0
                  AND trl.TaskCode IS NOT NULL
                  AND trl.TaskCode <> ''
                GROUP BY RTRIM(trl.EmpCode), trl.TaskCode, tc.TaskDesc, tc.TaskType, tc.UOM
            ) RankedTasks
            WHERE rn = 1
        `, [startDate, endDate, startDate, endDate]);

        const result: Record<string, { task_code: string; task_desc: string; task_type: string; task_uom: string }> = {};
        for (const r of rows) {
            const empCode = (r.EmpCode || "").trim();
            result[empCode] = {
                task_code: r.TaskCode || "",
                task_desc: r.TaskDesc || "",
                task_type: r.TaskType || "",
                task_uom: r.UOM || ""
            };
        }
        return result;
    }

    // =========================================================================
    // NEW UNIFIED COMPONENT ARCHITECTURE METHODS
    // These methods use the new component services with metadata
    // =========================================================================

    /**
     * Extract payroll data using new unified component services
     * This method demonstrates the new architecture where all calculations
     * return PayrollComponent with full metadata
     *
     * @experimental - This is the future replacement for extractPayrollData
     */
    public async extractPayrollDataWithComponents(
        month: number,
        year: number,
        gangCode: string = "ALL",
        divisionCode?: string,
        specificEmpCode: string | null = null,
        serverProfile?: string,
        useHistoryDb?: boolean | null
    ): Promise<{
        data_rows: PayrollRow[];
        components: {
            lembur: Record<string, any>;
            premi: Record<string, any>;
            tunjangan: Record<string, any>;
            potongan: Record<string, any>;
            pph21_ter: Record<string, any>;
        };
        meta: { execution_time_ms: number; row_count: number }
    }> {
        const startTime = Date.now();

        // First, get the base data using the existing method
        // Also passing includeVirtualGangs as false by default to match existing signature, and then useHistoryDb.
        const baseResult = await this.extractPayrollData(month, year, gangCode, divisionCode, specificEmpCode, serverProfile, false, useHistoryDb);

        // Then calculate components using the new component services
        const empCodes = baseResult.data_rows.map(row => row.nik);

        // Calculate all components in parallel using the registry
        const componentResults = await payrollComponentRegistry.calculateAllBatch(
            empCodes.map(code => ({
                emp_code: code,
                month,
                year,
                server_profile: serverProfile,
            })),
            ['gaji_pokok', 'lembur', 'premi', 'tunjangan', 'potongan', 'pph21_ter']
        );

        // Transform results into organized structure
        const components = {
            gaji_pokok: this.transformComponentResults(componentResults, 'gaji_pokok'),
            lembur: this.transformComponentResults(componentResults, 'lembur'),
            premi: this.transformComponentResults(componentResults, 'premi'),
            tunjangan: this.transformComponentResults(componentResults, 'tunjangan'),
            potongan: this.transformComponentResults(componentResults, 'potongan'),
            pph21_ter: this.transformComponentResults(componentResults, 'pph21_ter'),
        };

        return {
            data_rows: baseResult.data_rows,
            components,
            meta: {
                execution_time_ms: Date.now() - startTime,
                row_count: baseResult.data_rows.length
            }
        };
    }

    /**
     * Transform component results from Map to organized structure
     */
    private transformComponentResults(
        allResults: Record<string, Record<string, any>>,
        componentName: string
    ): Record<string, any> {
        const result: Record<string, any> = {};

        // allResults has structure: { emp_code: { lembur: {...}, premi: {...}, ...} }
        for (const [empCode, empResults] of Object.entries(allResults)) {
            const componentResult = empResults[componentName];
            if (componentResult && componentResult.output) {
                result[empCode] = {
                    value: componentResult.output.value,
                    meta: componentResult.output.meta,
                    execution_time_ms: componentResult.execution_time_ms,
                };
            }
        }

        return result;
    }

    /**
     * Get detailed component data for a single employee
     * Returns all calculations with full metadata traceability
     */
    public async getEmployeeComponentDetails(
        empCode: string,
        month: number,
        year: number,
        serverProfile?: string
    ): Promise<{
        employee: any;
        components: {
            gaji_pokok: any;
            lembur: any;
            premi: any;
            tunjangan: any;
            potongan: any;
            pph21_ter: any;
        };
        calculation_meta: {
            period: { month: number; year: number };
            generated_at: Date;
            execution_time_ms: number;
            service_versions: Record<string, number>;
        };
    }> {
        const startTime = Date.now();

        // Calculate all components for this employee
        const gajiPokokResult = await gajiPokokService.calculate({
            emp_code: empCode,
            month,
            year,
            server_profile: serverProfile,
        });

        const lemburResult = await lemburService.calculate({
            emp_code: empCode,
            month,
            year,
            server_profile: serverProfile,
            include_details: true,
        });

        const premiResult = await premiService.calculate({
            emp_code: empCode,
            month,
            year,
            server_profile: serverProfile,
        });

        const tunjanganResult = await tunjanganService.calculate({
            emp_code: empCode,
            month,
            year,
            server_profile: serverProfile,
        });

        // Get penghasilan_bruto from tunjangan for PPH21 calculation
        const penghasilanBruto = tunjanganResult.output.value.total.value +
            (tunjanganResult.output.value.beras?.value || 0) +
            (tunjanganResult.output.value.jabatan?.value || 0) +
            (tunjanganResult.output.value.masa_kerja?.value || 0) +
            (premiResult.output.value.total_premi || 0);

        const potonganResult = await potonganService.calculate({
            emp_code: empCode,
            month,
            year,
            server_profile: serverProfile,
            penghasilan_bruto: penghasilanBruto,
        });

        const pph21TerResult = await pph21TerService.calculate({
            emp_code: empCode,
            month,
            year,
            server_profile: serverProfile,
            penghasilan_bruto: penghasilanBruto,
        });

        return {
            employee: { emp_code: empCode },
            components: {
                gaji_pokok: gajiPokokResult.output,
                lembur: lemburResult.output,
                premi: premiResult.output,
                tunjangan: tunjanganResult.output,
                potongan: potonganResult.output,
                pph21_ter: pph21TerResult.output,
            },
            calculation_meta: {
                period: { month, year },
                generated_at: new Date(),
                execution_time_ms: Date.now() - startTime,
                service_versions: payrollComponentRegistry.getAllServiceVersions(),
            },
        };
    }
}

export const dataExtractorService = DataExtractorService.getInstance();
