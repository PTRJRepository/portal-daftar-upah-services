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
import { OtherIncomesService } from "./otherIncomesService";
import { calculateAllCaruman, getCarumanForPph21 } from './carumanDefinitions';

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

        // Get current period to determine if we need historical data
        const currentPeriod = await currentPeriodService.getCurrentPeriod();
        const currentMonth = currentPeriod.month;
        const currentYear = currentPeriod.year;

        // Determine if the selected period is historical (before current period)
        const isHistorical = (year < currentYear) || (year === currentYear && month < currentMonth);

        console.log(`[DataExtractor] Current period: ${currentMonth}/${currentYear}, Selected: ${month}/${year}, IsHistorical: ${isHistorical}, useHistoryDb: ${useHistoryDb}, gangPrefix: ${gangPrefix}`);

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

                    console.log(`[DataExtractor] Intercepted deep history request for ${month}/${year}. Returning seeded snapshot data. (${historyData.data_rows.length} rows)`);
                    return historyData;
                } else {
                    console.log(`[DataExtractor] No seeded history found for ${month}/${year}. Falling back to live/archive calculation...`);
                }
            } catch (err) {
                console.error(`[DataExtractor] Failed to fetch historical snapshot, falling back:`, err);
            }
        }
        // ------------------------------------

        // [GANG MAPPING] Fetch all gangs to build mapping maps
        // We need this because Frontend sends "Code" (e.g. AB1) but Database uses "Description" (e.g. Divisi AB1)
        // And Frontend expects "Code" back in the response.
        const allGangs = await gangService.fetchGangs(divisionCode || undefined, undefined, includeVirtualGangs);

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
            console.log(`[DataExtractor] Gang Filter: Input='${gangCode}' (Using exact Code matching)`);
            // Set gangCodeInput so getEmployees can build path-specific conditions
            gangCodeInput = trimmedInput;
            // Default condition using GangCode from HR_GANGLN (live path)
            // getEmployees will override this for historical path
            gangCondition = `(UPPER(RTRIM(gl.GangCode)) = '${trimmedInput}' OR UPPER(RTRIM(g.GangCode)) = '${trimmedInput}' OR UPPER(RTRIM(g.Description)) = '${trimmedInput}')`;
        } else if (divisionCode) {
            // Already fetched `allGangs` above for mapping, reuse it for condition
            if (allGangs.length > 0) {
                // Use UPPER for case-insensitive comparison and RTRIM for trailing spaces
                // Use description (from HR_GANG) to match with PR_GANG.Description (Plantware)
                const conditions = allGangs.map((gang: { description: string }) => `UPPER(RTRIM(g.Description)) = UPPER('${gang.description.trim()}')`).join(' OR ');
                gangCondition = `(${conditions})`;
            } else {
                gangCondition = "1=0";
            }
        }

        const startTotal = performance.now();
        let employees = await this.getEmployees(gangCondition, month, year, serverProfile, isHistorical, gangCodeInput);

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
        // Fetch all required data in parallel
        const [
            attendanceMap, cuti, premiResult, potonganResult, lembur, lemburWithDetails, lemburDocDesc, berasDocDesc, jabatan, masaKerja, upahPokok, brondol, jobTitles, taskCodes, bunchesBatch, manualAdjustmentsRaw
        ] = await Promise.all([
            this.getAttendance(empCodes, startDate, endDate, serverProfile),
            this.getCuti(empCodes, startDate, endDate, serverProfile),
            this.getPremi(empCodes, startDate, endDate, isHistorical, serverProfile),
            this.getPotongan(empCodes, startDate, endDate, serverProfile),
            this.getLemburDetailsFromCalculator(empCodes, month, year, serverProfile),
            this.getLemburDetailsWithTaskBreakdown(empCodes, month, year, serverProfile),

            this.getLemburFromDocDesc(empCodes, startDate, endDate, serverProfile),
            this.getBerasFromDocDesc(empCodes, startDate, endDate, serverProfile), // RESTORED
            this.getTunjanganAmount(empCodes, startDate, endDate, "JABATAN", serverProfile),
            this.getTunjanganAmount(empCodes, startDate, endDate, "MASA%KERJA", serverProfile),
            this.getUpahPokok(empCodes, year, serverProfile),
            this.getBrondol(empCodes, startDate, endDate, serverProfile),

            EmployeeEstateService.getEmployeeJobs(),
            this.getTaskCodes(empCodes, startDate, endDate, serverProfile),
            // [OPTIMIZATION] Skip bunches fetch if requested (e.g. for Payslips)
            !skipHarvest ? this.getBunchesBatch(empCodes, month, year) : Promise.resolve(new Map()),
            manualAdjustmentService.getAdjustments(month, year, gangCode || undefined)
        ]);

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

        const gajiPokokBatchResult = await gajiPokokService.calculateBatch(gajiPokokInputs);

        // Cast manual adjustments to expected type
        const manualAdjustments = (manualAdjustmentsRaw || []) as any[];

        // Destructure premi result - uses DocDesc as title
        const { amounts: premi, titleMap: premiTitleMap, details: premiDetails } = premiResult;
        // Destructure potongan result - uses TaskDesc as title
        const { amounts: potongan, titleMap: potonganTitleMap } = potonganResult;

        // Fetch db other incomes mapping for THP and Tax
        const dbOtherIncomes = await OtherIncomesService.getIncomes(year, month, divisionCode, gangCode);
        const dbThpIncomesMap = new Map<string, number>();
        const dbTaxableIncomesMap = new Map<string, number>();

        for (const inc of dbOtherIncomes) {
            const nik = String(inc.nik || '').trim().toUpperCase();
            if (inc.is_paid_in_thp) {
                dbThpIncomesMap.set(nik, (dbThpIncomesMap.get(nik) || 0) + Number(inc.amount));
            }
            if (inc.is_taxable) {
                dbTaxableIncomesMap.set(nik, (dbTaxableIncomesMap.get(nik) || 0) + Number(inc.amount));
            }
        }

        // Fetch Master PTKP records for the current year
        const { ptkpTaxService } = await import('./ptkpTaxService');
        const ptkpMasterRecords = await ptkpTaxService.getPtkpByYear(year);
        const dbPtkpMap = new Map<string, string>();
        for (const record of ptkpMasterRecords) {
            if (record.emp_code) {
                dbPtkpMap.set(record.emp_code.trim().toUpperCase(), record.ptkp_status);
            }
        }

        const dataRows: PayrollRow[] = [];
        const dynamicPremiSet = new Set<string>();
        const dynamicPotonganSet = new Set<string>();

        for (const emp of employees) {
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

            if (emp.emp_code.includes('474')) {
                console.log(`[DEBUG] F0474 Filter Check:
                    HK: ${hk}
                    Cuti Minggu: ${empCuti.cuti_minggu}
                    Cuti Nasional: ${empCuti.cuti_nasional}
                    Effective HK: ${effective_hk}
                    Total Earnings: ${total_earnings} (Amount: ${attData.total_amount_rp}, Premi: ${total_premi_temp}, Lembur: ${empLemburDetails.jumlah})
                    Action: ${effective_hk <= 0 && total_earnings <= 0 ? 'SKIP' : 'KEEP'}
                `);
            }

            // Filter: Skip if Effective HK is 0 or less AND Total Earnings is 0 or less
            if (effective_hk <= 0 && total_earnings <= 0) continue;
            const daysInMonth = new Date(year, month, 0).getDate();

            // Get data carefully computed by GajiPokokService
            const gpResult = gajiPokokBatchResult.results.get(emp.emp_code)?.output?.value;
            const empUpahDasar = gpResult?.upah_dasar?.value || emp.pay_rate || 0;

            const empJobTitle = jobTitles[emp.emp_code] || "";

            // ... (Rest of existing logic mostly unchanged until row creation)
            const totalCuti = empCuti.cuti_tahunan + empCuti.cuti_sakit_haid + empCuti.cuti_minggu + empCuti.cuti_nasional;
            const hari_kerja = Math.max(0, hk - totalCuti);

            // [FILTER] Employee filtering logic
            const effective_work_hk = hk - (empCuti.cuti_minggu + empCuti.cuti_nasional);
            const other_cuti = empCuti.cuti_tahunan + empCuti.cuti_sakit_haid;

            if (effective_work_hk <= 0 && other_cuti == 0 && total_earnings <= 0) continue;

            const upah_pokok = attData.total_amount_rp || 0;
            const empBrondol = brondol[emp.emp_code] || 0;

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

            const jabatanRate = hari_kerja > 0 && empJabatan > 0 ? empJabatan / hari_kerja : 0;
            const masaKerjaRate = hk > 0 && empMasaKerjaJumlah > 0 ? empMasaKerjaJumlah / hk : 0;

            const empLemburJumlahPure = empLemburDetails.jumlah || 0;
            const empLemburJamPure = empLemburDetails.jam || 0;

            const gaji_pokok_ideal = gpResult?.gaji_pokok_ideal?.value || 0;
            const gaji_pokok_aktual = gpResult?.gaji_pokok_aktual?.value || 0;
            const gaji_pokok = gaji_pokok_aktual;
            const total_tunjangan = berasJumlah + empJabatan + empMasaKerjaJumlah + empLemburJumlahPure;

            // PREMI CALCULATION - Ensure everything is summed into total_premi
            // Add Brondol to empPremi first
            if (empBrondol > 0) {
                empPremi["brondol"] = (empPremi["brondol"] || 0) + empBrondol;
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

            // [FIXED] PREMI_PPH is an ADDITION (penambah), NOT a deduction
            // [FIXED] pot_koreksi is ONLY in Potongan Upah Kotor, NOT in total_potongan
            // total_potongan = astek + bpjs_pekerja + spsi + pph21 + other (no koreksi)
            const total_potongan = pot_astek_pekerja + pot_bpjs_kesehatan_pekerja + pot_bpjs_pensiun_pekerja +
                pot_spsi + pot_pph21 + other_potongan;

            // [FIXED] KOREKSI is deducted from jumlah_upah_kotor (Potongan Upah Kotor section)
            // Use gaji_pokok_aktual (calculated earlier) for gross wage calculation
            const jumlah_upah_kotor = (gaji_pokok_aktual + total_tunjangan + total_premi) - pot_koreksi;

            const rawEmpNik = String(emp.actual_nik || emp.emp_code || '').trim().toUpperCase();
            const pendapatan_tidak_tetap_thp = dbThpIncomesMap.get(rawEmpNik) || 0;
            const pendapatan_tidak_tetap_taxable = dbTaxableIncomesMap.get(rawEmpNik) || 0;

            // [NEW] Upah Kotor Pajak = Jumlah Upah Kotor + Astek + BPJS Kesehatan + Other Taxable Incomes (untuk header/pajak)
            const upah_kotor_pajak = jumlah_upah_kotor + pot_astek_pekerja + pot_bpjs_kesehatan_pekerja + pendapatan_tidak_tetap_taxable;

            // [FIXED] PREMI_PPH is ADDED (+) to upah_bersih, not subtracted
            // Formula: upah_bersih = jumlah_upah_kotor - total_potongan + premi_pph + pendapatan_tidak_tetap_thp
            const upah_bersih = jumlah_upah_kotor - total_potongan + pot_premi_pph + pendapatan_tidak_tetap_thp;

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
                emp_code: emp.emp_code,  // Actual EmpCode (e.g. A0023)
                nik: emp.actual_nik || emp.emp_code,  // Actual NIK KTP (e.g. 1902050504860001)
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
                premi_brondol: empBrondol,
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

        return {
            data_rows: dataRows,
            dynamic_premi_headers: Array.from(dynamicPremiSet),
            dynamic_potongan_headers: Array.from(dynamicPotonganSet),
            premi_title_map: premiTitleMap,
            potongan_title_map: potonganTitleMap,
            meta: {
                execution_time_ms: Date.now() - startTime,
                row_count: dataRows.length
            }
        };
    }

    public async getEmployees(gangCondition: string, month: number, year: number, serverProfile?: string, isHistorical: boolean = false, gangCodeInput: string | null = null): Promise<EmployeeRow[]> {
        const db = serverProfile ? Database.getInstance(undefined, serverProfile) : this.db;
        console.log(`[DataExtractor] getEmployees: serverProfile=${serverProfile || 'undefined (using this.db)'}, month=${month}, year=${year}, isHistorical=${isHistorical}`);

        let rows: any[];

        if (isHistorical) {
            // For historical data, use PR_GANGLN_ARC with AccMonth/AccYear filtering
            let accMonth: number;
            let accYear: number;

            const { accMonth: calculatedAccMonth, accYear: calculatedAccYear } = currentPeriodService.calendarToAccMonth(month, year);
            accMonth = calculatedAccMonth;
            accYear = calculatedAccYear;

            console.log(`[DataExtractor] Historical query: calendar ${month}/${year} -> AccMonth ${accMonth}/AccYear ${accYear}`);

            // For historical path: g = PR_GANG (has GangID, Description, no GangCode)
            // Override gangCondition if gangCodeInput is provided
            let historicalCondition = gangCondition;
            if (gangCodeInput) {
                historicalCondition = `(UPPER(RTRIM(g.GangID)) = '${gangCodeInput}' OR UPPER(RTRIM(g.Description)) = '${gangCodeInput}')`;
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
            console.log(`[DataExtractor] Current query: using HR_GANGLN for ${month}/${year}`);

            rows = await db.query<any>(`
                SELECT DISTINCT
                    RTRIM(e.EmpCode) as emp_code,
                    e.NewICNo as actual_nik,
                    e.EmpName as emp_name,
                    e.Gender as gender,
                    RTRIM(e.LocCode) as loc_code,
                    RTRIM(gl.GangCode) as gang_code,
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
                console.log(`[DataExtractor] No data in HR_GANGLN for current period ${month}/${year}, falling back to PR_GANGLN_ARC...`);



                const { accMonth: fallbackAccMonth, accYear: fallbackAccYear } = currentPeriodService.calendarToAccMonth(month, year);
                console.log(`[DataExtractor] ARC Fallback: calendar ${month}/${year} -> AccMonth ${fallbackAccMonth}/AccYear ${fallbackAccYear}`);

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

                if (rows.length > 0) {
                    console.log(`[DataExtractor] ARC Fallback successful: found ${rows.length} employees from PR_GANGLN_ARC`);
                } else {
                    console.log(`[DataExtractor] ARC Fallback: still no data found in PR_GANGLN_ARC`);
                }
            }
        }

        // Fetch HR data overrides (e.g. NIK KTP)
        const empCodes = rows.map((r: any) => r.emp_code?.trim()).filter(Boolean);
        const hrDataMap = await employeeHrDataService.getHrDataBulk(empCodes);

        return rows.map((r: any) => {
            const rawGangCode = r.gang_code?.trim() || "";
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
                loc_code: r.loc_code?.trim() || "",
                gang_code: rawGangCode, // Return exact fetched code
                pay_rate: r.pay_rate || 0,
                beras_rate: r.beras_rate || 0,
                join_date: r.join_date || null,
                res_address: r.res_address?.trim() || "",
                hr_emp_type: r.hr_emp_type?.trim() || ""
            };
        });
    }

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

        // SQL to calculate shortage with more accurate Friday detection using DATENAME
        // Friday requires >= 5 hours, Other days require >= 7 hours
        // Only count if Hours > 0
        const shortageSql = `
            SUM(CASE
                WHEN DATENAME(weekday, trl.TrxDate) IN ('Friday', 'Jumat') THEN
                    CASE WHEN trl.Hours < 5 AND trl.Hours > 0 THEN 1 ELSE 0 END
                ELSE
                    CASE WHEN trl.Hours < 7 AND trl.Hours > 0 THEN 1 ELSE 0 END
            END) as shortage_count
        `;

        let rows = await db.query<{ emp_code: string; hk: number; total_hours: number; shortage_count: number; total_amount_rp: number }>(`
            SELECT RTRIM(trl.EmpCode) as emp_code, COUNT(DISTINCT trl.TrxDate) as hk, SUM(trl.Hours) as total_hours,
                   ${shortageSql},
                   SUM(trl.Amount) as total_amount_rp
            FROM PR_TASKREGLN trl
            JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
            WHERE RTRIM(trl.EmpCode) IN (${empList})
              AND trl.TrxDate >= ? AND trl.TrxDate < ?
              AND trl.OT = 0
            GROUP BY RTRIM(trl.EmpCode)

            UNION ALL

            SELECT RTRIM(trl.EmpCode) as emp_code, COUNT(DISTINCT trl.TrxDate) as hk, SUM(trl.Hours) as total_hours,
                   ${shortageSql},
                   SUM(trl.Amount) as total_amount_rp
            FROM PR_TASKREGLN_ARC trl
            JOIN PR_TASKREG_ARC tr ON tr.ID = trl.MasterID
            WHERE RTRIM(trl.EmpCode) IN (${empList})
              AND trl.TrxDate >= ? AND trl.TrxDate < ?
              AND trl.OT = 0
            GROUP BY RTRIM(trl.EmpCode)
        `, [startDate, endDate, startDate, endDate]);

        // Query to get detailed shortage records (individual days with shortage)
        const shortageDetailsQuery = `
            SELECT
                RTRIM(trl.EmpCode) as emp_code,
                CONVERT(varchar, trl.TrxDate, 23) as date,
                DATENAME(weekday, trl.TrxDate) as day_name,
                SUM(trl.Hours) as actual_hours,
                CASE
                    WHEN DATENAME(weekday, trl.TrxDate) IN ('Friday', 'Jumat') THEN 5
                    ELSE 7
                END as target_hours
            FROM PR_TASKREGLN trl
            JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
            WHERE RTRIM(trl.EmpCode) IN (${empList})
              AND trl.TrxDate >= ? AND trl.TrxDate < ?
              AND trl.OT = 0
            GROUP BY RTRIM(trl.EmpCode), trl.TrxDate
            HAVING SUM(trl.Hours) < CASE
                WHEN DATENAME(weekday, trl.TrxDate) IN ('Friday', 'Jumat') THEN 5
                ELSE 7
            END
            AND SUM(trl.Hours) > 0

            UNION ALL

            SELECT
                RTRIM(trl.EmpCode) as emp_code,
                CONVERT(varchar, trl.TrxDate, 23) as date,
                DATENAME(weekday, trl.TrxDate) as day_name,
                SUM(trl.Hours) as actual_hours,
                CASE
                    WHEN DATENAME(weekday, trl.TrxDate) IN ('Friday', 'Jumat') THEN 5
                    ELSE 7
                END as target_hours
            FROM PR_TASKREGLN_ARC trl
            JOIN PR_TASKREG_ARC tr ON tr.ID = trl.MasterID
            WHERE RTRIM(trl.EmpCode) IN (${empList})
              AND trl.TrxDate >= ? AND trl.TrxDate < ?
              AND trl.OT = 0
            GROUP BY RTRIM(trl.EmpCode), trl.TrxDate
            HAVING SUM(trl.Hours) < CASE
                WHEN DATENAME(weekday, trl.TrxDate) IN ('Friday', 'Jumat') THEN 5
                ELSE 7
            END
            AND SUM(trl.Hours) > 0
        `;

        const shortageRows = await db.query<{
            emp_code: string;
            date: string;
            day_name: string;
            actual_hours: number;
            target_hours: number;
        }>(shortageDetailsQuery, [startDate, endDate, startDate, endDate]);

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

        // Initialize result with aggregated data
        for (const r of rows) {
            const empCode = r.emp_code?.trim() || "";
            if (!result[empCode]) {
                result[empCode] = {
                    hk: 0,
                    total_hours: 0,
                    shortage_count: 0,
                    total_amount_rp: 0,
                    shortage_details: [],
                    shortage_total_hours: 0,
                    excess_details: [],
                    excess_total_hours: 0
                };
            }
            result[empCode].hk += r.hk || 0;
            result[empCode].total_hours += r.total_hours || 0;
            result[empCode].shortage_count += r.shortage_count || 0;
            result[empCode].total_amount_rp += r.total_amount_rp || 0;
        }

        // Add shortage details
        for (const r of shortageRows) {
            const empCode = r.emp_code?.trim() || "";
            if (result[empCode]) {
                const shortage_hours = r.target_hours - r.actual_hours;
                result[empCode].shortage_details.push({
                    date: r.date,
                    day_name: r.day_name,
                    actual_hours: r.actual_hours,
                    target_hours: r.target_hours,
                    shortage_hours: shortage_hours
                });
                result[empCode].shortage_total_hours += shortage_hours;
            }
        }

        // [NEW] Query to get excess hours records (individual days where hours EXCEED target - "Salah Scan")
        const excessDetailsQuery = `
            SELECT
                RTRIM(trl.EmpCode) as emp_code,
                CONVERT(varchar, trl.TrxDate, 23) as date,
                DATENAME(weekday, trl.TrxDate) as day_name,
                SUM(trl.Hours) as actual_hours,
                CASE
                    WHEN DATENAME(weekday, trl.TrxDate) IN ('Friday', 'Jumat') THEN 5
                    ELSE 7
                END as target_hours
            FROM PR_TASKREGLN trl
            JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
            WHERE RTRIM(trl.EmpCode) IN (${empList})
              AND trl.TrxDate >= ? AND trl.TrxDate < ?
              AND trl.OT = 0
            GROUP BY RTRIM(trl.EmpCode), trl.TrxDate
            HAVING SUM(trl.Hours) > CASE
                WHEN DATENAME(weekday, trl.TrxDate) IN ('Friday', 'Jumat') THEN 5
                ELSE 7
            END

            UNION ALL

            SELECT
                RTRIM(trl.EmpCode) as emp_code,
                CONVERT(varchar, trl.TrxDate, 23) as date,
                DATENAME(weekday, trl.TrxDate) as day_name,
                SUM(trl.Hours) as actual_hours,
                CASE
                    WHEN DATENAME(weekday, trl.TrxDate) IN ('Friday', 'Jumat') THEN 5
                    ELSE 7
                END as target_hours
            FROM PR_TASKREGLN_ARC trl
            JOIN PR_TASKREG_ARC tr ON tr.ID = trl.MasterID
            WHERE RTRIM(trl.EmpCode) IN (${empList})
              AND trl.TrxDate >= ? AND trl.TrxDate < ?
              AND trl.OT = 0
            GROUP BY RTRIM(trl.EmpCode), trl.TrxDate
            HAVING SUM(trl.Hours) > CASE
                WHEN DATENAME(weekday, trl.TrxDate) IN ('Friday', 'Jumat') THEN 5
                ELSE 7
            END
        `;

        const excessRows = await db.query<{
            emp_code: string;
            date: string;
            day_name: string;
            actual_hours: number;
            target_hours: number;
        }>(excessDetailsQuery, [startDate, endDate, startDate, endDate]);

        // Add excess details ("Salah Scan")
        for (const r of excessRows) {
            const empCode = r.emp_code?.trim() || "";
            if (result[empCode]) {
                const excess_hours = r.actual_hours - r.target_hours;
                result[empCode].excess_details.push({
                    date: r.date,
                    day_name: r.day_name,
                    actual_hours: r.actual_hours,
                    target_hours: r.target_hours,
                    excess_hours: excess_hours
                });
                result[empCode].excess_total_hours += excess_hours;
            }
        }

        return result;
    }

    private async getCuti(empCodes: string[], startDate: string, endDate: string, serverProfile?: string): Promise<Record<string, CutiData>> {
        if (!empCodes.length) return {};
        const db = serverProfile ? Database.getInstance(undefined, serverProfile) : this.db;
        const empList = empCodes.map(e => `'${e}'`).join(",");

        // Initialize result
        const result: Record<string, CutiData> = {};
        for (const emp of empCodes) {
            result[emp] = { cuti_tahunan: 0, cuti_sakit_haid: 0, cuti_minggu: 0, cuti_nasional: 0 };
        }

        // Query cuti tahunan and sakit (by TaskCode)
        // Use UNION ALL for Cuti
        let cutiTaskRows = await db.query<{ emp_code: string; cuti_tahunan: number; cuti_sakit_haid: number }>(`
            SELECT
                RTRIM(EmpCode) as emp_code,
                SUM(cuti_tahunan) as cuti_tahunan,
                SUM(cuti_sakit_haid) as cuti_sakit_haid
            FROM (
                SELECT
                    trl.EmpCode,
                    CASE WHEN trl.TaskCode LIKE 'GA9129%' THEN 1 ELSE 0 END as cuti_tahunan,
                    CASE WHEN trl.TaskCode LIKE 'GA9126%' THEN 1 ELSE 0 END as cuti_sakit_haid
                FROM PR_TASKREGLN trl
                JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
                WHERE RTRIM(trl.EmpCode) IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate < ?
                  AND trl.OT = 0
                  AND (trl.TaskCode LIKE 'GA9129%' OR trl.TaskCode LIKE 'GA9126%')
                
                UNION ALL

                SELECT
                    trl.EmpCode,
                    CASE WHEN trl.TaskCode LIKE 'GA9129%' THEN 1 ELSE 0 END as cuti_tahunan,
                    CASE WHEN trl.TaskCode LIKE 'GA9126%' THEN 1 ELSE 0 END as cuti_sakit_haid
                FROM PR_TASKREGLN_ARC trl
                JOIN PR_TASKREG_ARC tr ON tr.ID = trl.MasterID
                WHERE RTRIM(trl.EmpCode) IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate < ?
                  AND trl.OT = 0
                  AND (trl.TaskCode LIKE 'GA9129%' OR trl.TaskCode LIKE 'GA9126%')
            ) combined
            GROUP BY RTRIM(EmpCode)
        `, [startDate, endDate, startDate, endDate]);

        for (const r of cutiTaskRows) {
            const emp = r.emp_code?.trim() || "";
            if (result[emp]) {
                result[emp].cuti_tahunan = r.cuti_tahunan || 0;
                result[emp].cuti_sakit_haid = r.cuti_sakit_haid || 0;
            }
        }

        // Query cuti minggu (Sundays - DATEPART weekday = 1) - UNION ALL
        let cutiMingguRows = await db.query<{ emp_code: string; cuti_minggu: number }>(`
            SELECT RTRIM(EmpCode) as emp_code, COUNT(DISTINCT TrxDate) as cuti_minggu
            FROM (
                SELECT trl.EmpCode, trl.TrxDate
                FROM PR_TASKREGLN trl
                JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
                WHERE RTRIM(trl.EmpCode) IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate < ?
                  AND trl.OT = 0
                  AND DATEPART(weekday, trl.TrxDate) = 1
                  AND NOT EXISTS (SELECT 1 FROM HR_GPH h WHERE h.HolidayDate = trl.TrxDate)
                
                UNION ALL

                SELECT trl.EmpCode, trl.TrxDate
                FROM PR_TASKREGLN_ARC trl
                JOIN PR_TASKREG_ARC tr ON tr.ID = trl.MasterID
                WHERE RTRIM(trl.EmpCode) IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate < ?
                  AND trl.OT = 0
                  AND DATEPART(weekday, trl.TrxDate) = 1
                  AND NOT EXISTS (SELECT 1 FROM HR_GPH h WHERE h.HolidayDate = trl.TrxDate)
            ) combined
            GROUP BY RTRIM(EmpCode)
        `, [startDate, endDate, startDate, endDate]);

        for (const r of cutiMingguRows) {
            const emp = r.emp_code?.trim() || "";
            if (result[emp]) {
                result[emp].cuti_minggu = r.cuti_minggu || 0;
            }
        }

        // Query cuti nasional (National holidays - join HR_GPH) - UNION ALL
        let cutiNasionalRows = await db.query<{ emp_code: string; cuti_nasional: number }>(`
            SELECT RTRIM(EmpCode) as emp_code, COUNT(DISTINCT TrxDate) as cuti_nasional
            FROM (
                SELECT trl.EmpCode, trl.TrxDate
                FROM PR_TASKREGLN trl
                JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
                JOIN HR_GPH h ON h.HolidayDate = trl.TrxDate
                WHERE RTRIM(trl.EmpCode) IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate < ?
                  AND trl.OT = 0
                
                UNION ALL

                SELECT trl.EmpCode, trl.TrxDate
                FROM PR_TASKREGLN_ARC trl
                JOIN PR_TASKREG_ARC tr ON tr.ID = trl.MasterID
                JOIN HR_GPH h ON h.HolidayDate = trl.TrxDate
                WHERE RTRIM(trl.EmpCode) IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate < ?
                  AND trl.OT = 0
            ) combined
            GROUP BY RTRIM(EmpCode)
        `, [startDate, endDate, startDate, endDate]);

        for (const r of cutiNasionalRows) {
            const emp = r.emp_code?.trim() || "";
            if (result[emp]) {
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

    private async getPotongan(empCodes: string[], startDate: string, endDate: string, serverProfile?: string): Promise<{ amounts: Record<string, Record<string, number>>; titleMap: Record<string, string> }> {
        if (!empCodes.length) return { amounts: {}, titleMap: {} };
        const db = serverProfile ? Database.getInstance(undefined, serverProfile) : this.db;
        const empList = empCodes.map(e => `'${e}'`).join(",");

        // [PYTHON COMPATIBILITY] Query using DocDesc directly from PR_ADTRANS/PR_ADTRANS_ARC
        //
        // 1. PPH21 (dipotong/minus) - DocDesc mengandung "PPH" TAPI BUKAN "PREMI PPH"
        // 2. KOREKSI (potongan upah kotor) - DocDesc mengandung "KOREKSI"
        // 3. POTONGAN lainnya (potongan upah bersih) - DocDesc mengandung "POT", dll
        //
        // NOTE: Premi PPH (ditambah/plus) diambil dari query terpisah menggunakan TaskDesc

        // [UPDATED] Add LEFT JOIN for TaskDesc to filter PPH items where TaskDesc contains PREMI
        let rows = await db.query<{ emp_code: string; doc_desc: string; task_code: string | null; task_desc: string | null; amount: number }>(`
            SELECT
                RTRIM(t.EmpCode) as emp_code,
                t.DocDesc as doc_desc,
                ln.TaskCode as task_code,
                mt.TaskDesc as task_desc,
                SUM(COALESCE(ln.Amount, 0)) as amount
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
                -- PPH21: DocDesc mengandung PPH TAPI bukan PREMI PPH (baik di DocDesc maupun TaskDesc)
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
                -- POTONGAN PPH21 Specific (from TaskCode DEPH21AB1 or TaskDesc (DE) POTONGAN PPH21)
                OR UPPER(ln.TaskCode) LIKE '%DEPH21%'
                OR UPPER(mt.TaskDesc) LIKE '%POTONGAN PPH21%'
            )
            GROUP BY RTRIM(t.EmpCode), t.DocDesc, ln.TaskCode, mt.TaskDesc
        `, [startDate, endDate, startDate, endDate]);

        const amounts: Record<string, Record<string, number>> = {};
        const titleMap: Record<string, string> = {};

        for (const r of rows) {
            const emp = r.emp_code?.trim() || "";
            if (!amounts[emp]) amounts[emp] = {};

            // [REMOVED] The check for PREMI in TaskDesc was incorrect
            // Real PREMI_PPH items (TaskDesc='ACCRUALS-CHECKROLL') are handled by separate query below
            // Items with TaskDesc like '(DE) POTONGAN PREMI' should be processed normally based on DocDesc

            const { key, title } = this.normalizePotonganName(r.doc_desc || "", r.task_desc, r.task_code);

            // [DEBUG] Log PPH items
            if (r.doc_desc?.toUpperCase().includes("PPH")) {
                console.log(`[DEBUG_PPH] Emp: ${emp} | Doc: "${r.doc_desc}" | Task: "${r.task_desc}" | Key: "${key}" | Amt: ${r.amount}`);
            }

            amounts[emp][key] = (amounts[emp][key] || 0) + Math.abs(r.amount || 0);

            // [MODIFIED] Use ONLY TaskCode as title (shorter, cleaner headers) for normal potongan.
            // But for KOREKSI (Potongan Upah Kotor), user requested to use DocDesc.
            if (!titleMap[key]) {
                if (key.startsWith('KOREKSI')) {
                    titleMap[key] = title; // title is already the clean DocDesc
                } else {
                    // Priority: TaskCode > Title (fallback) > key (last resort)
                    const taskCode = r.task_code?.trim();
                    titleMap[key] = taskCode || title;
                }
            }
        }

        // [NEW] Query for Premi PPH from TaskDesc = 'ACCRUALS-CHECKROLL'
        // Ini masuk ke kategori POTONGAN UPAH BERSIH (ditambah lalu dipotong)
        // Bukan bagian dari premi, meskipun namanya "PREMI PPH"
        const premiPphRows = await db.query<{ emp_code: string; doc_desc: string; amount: number }>(`
            SELECT
                RTRIM(t.EmpCode) as emp_code,
                t.DocDesc as doc_desc,
                SUM(ln.Amount) as amount
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
            JOIN PR_TASKCODE mt ON ln.TaskCode = mt.TaskCode
            WHERE mt.TaskDesc = 'ACCRUALS-CHECKROLL'
            GROUP BY RTRIM(t.EmpCode), t.DocDesc
        `, [startDate, endDate, startDate, endDate]);

        // Add Premi PPH to amounts with key "PREMI_PPH"
        // Ini akan muncul sebagai kolom di POTONGAN UPAH BERSIH
        for (const r of premiPphRows) {
            const emp = r.emp_code?.trim() || "";
            if (!amounts[emp]) amounts[emp] = {};
            amounts[emp]["PREMI_PPH"] = (amounts[emp]["PREMI_PPH"] || 0) + Math.abs(r.amount || 0);
            // Store title mapping
            if (!titleMap["PREMI_PPH"]) {
                titleMap["PREMI_PPH"] = "PREMI PPH";
            }
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

    private async getUpahPokok(empCodes: string[], year: number, serverProfile?: string): Promise<Record<string, number>> {
        if (!empCodes.length) return {};
        const db = serverProfile ? Database.getInstance(undefined, serverProfile) : this.db;
        const empList = empCodes.map(e => `'${e}'`).join(",");

        // Get current period to determine if we should use historical rates
        const currentPeriod = await currentPeriodService.getCurrentPeriod();
        const currentYear = currentPeriod.year;

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
