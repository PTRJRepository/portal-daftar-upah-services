/**
 * Tax Report Service
 * 
 * Mengagregasi data pajak dari history tables untuk Report Pajak.
 * - Pajak Bulanan (PPH21 per bulan)
 * - Pajak Tahunan (akumulasi setahun + perhitungan PTKP, Biaya Jabatan, PKP)
 * - ASTEK & BPJS Tahunan (akumulasi per bulan)
 */

import * as fs from 'fs';
import * as path from 'path';
import { historyDatabaseService } from './historyDatabaseService';
import { ptkpTaxService, mapPTKPToTER } from './ptkpTaxService';
import { pph21TerService } from './pph21TerService';
import { divisionDefinition } from './divisionDefinition';
import { OtherIncomesService } from './otherIncomesService';
import { getCarumanForPph21, calculateAllCaruman, CARUMAN_RATES } from './carumanDefinitions';
import { DataExtractorService } from './dataExtractorService';
import { currentPeriodService } from './currentPeriodService';

// ============================================================
// PTKP Rule from JSON
// ============================================================
interface PtkpRule {
    conditions: { condition: string; value: number }[];
}

let ptkpRules: PtkpRule | null = null;

function loadPtkpRules(): PtkpRule {
    if (ptkpRules) return ptkpRules;

    const possiblePaths = [
        path.resolve(process.cwd(), 'Additional_services/hitung_pajak/rule_PTKP_Tahunan.json'),
        path.resolve(process.cwd(), '../Additional_services/hitung_pajak/rule_PTKP_Tahunan.json'),
        path.resolve(__dirname, '../../Additional_services/hitung_pajak/rule_PTKP_Tahunan.json'),
        path.resolve(import.meta.dir, '../../../Additional_services/hitung_pajak/rule_PTKP_Tahunan.json'),
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            const raw = fs.readFileSync(p, 'utf-8');
            ptkpRules = JSON.parse(raw);
            return ptkpRules!;
        }
    }

    throw new Error(`PTKP rules file not found. Tried: ${possiblePaths.join(', ')}`);
}

function getPtkpValue(ptkpStatus: string): number {
    const rules = loadPtkpRules();
    const normalized = (ptkpStatus || '').toUpperCase().trim();
    const match = rules.conditions.find(c => c.condition.toUpperCase() === normalized);
    return match ? match.value : 54000000; // Default TK/0
}

// ============================================================
// THR and Exgratia from JSON
// ============================================================
interface ThrBonusMaps {
    thrMap: Map<string, number>;
    exgratiaMap: Map<string, number>;
}

let thrBonusMaps: ThrBonusMaps | null = null;

function loadThrBonusMaps(): ThrBonusMaps {
    if (thrBonusMaps) return thrBonusMaps;

    thrBonusMaps = {
        thrMap: new Map(),
        exgratiaMap: new Map()
    };

    const baseDataDir = path.resolve(process.cwd(), '../Additional_services/pajak_kalkulator/data_statis');
    const alternativeDataDir = path.resolve(__dirname, '../../../../Additional_services/pajak_kalkulator/data_statis');

    // Use the first existing directory base
    const dir = fs.existsSync(baseDataDir) ? baseDataDir : (fs.existsSync(alternativeDataDir) ? alternativeDataDir : null);

    if (!dir) {
        console.warn('THR/Bonus data directory not found. THR and Exgratia will be 0.');
        return thrBonusMaps;
    }

    const filesToLoad = [
        path.join(dir, 'infra', 'thr_bonus_infra.json'),
        path.join(dir, '1b', 'thr_bonus_1b.json'),
        path.join(dir, '2a', 'thr_bonus_2a.json')
    ];

    const allBonusData: any[] = [];

    for (const p of filesToLoad) {
        if (fs.existsSync(p)) {
            try {
                const raw = fs.readFileSync(p, 'utf-8');
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    allBonusData.push(...parsed);
                }
            } catch (err) {
                console.error(`Failed to load ${p}:`, err);
            }
        } else {
            console.warn(`File not found: ${p}`);
        }
    }

    // Build Maps
    for (const item of allBonusData) {
        const keyStr = String(item.nik || item.nama || '').trim().toUpperCase();
        if (keyStr) {
            thrBonusMaps.thrMap.set(keyStr, item.thr || 0);
            thrBonusMaps.exgratiaMap.set(keyStr, item.exgratia || item.bonus || 0);
        }
    }

    return thrBonusMaps;
}

// ============================================================
// THR Periode Rule from JSON
// ============================================================
interface ThrPeriode {
    year: number;
    month: number;
    type: string;
    name: string;
    description: string;
    is_active: boolean;
}

function loadActiveThrPeriode(): ThrPeriode | null {
    // Hardcode THR to March as requested by user
    return {
        year: 2026,
        month: 3,
        type: 'THR',
        name: 'THR 2026',
        description: 'Fixed THR Period (March)',
        is_active: true
    };
}

// ============================================================
// Interfaces
// ============================================================

export interface MonthlyTaxRow {
    no: number;
    emp_code: string;
    emp_name: string;
    nik: string;
    gender: string;
    status_ptkp: string;
    kategori_ter: string;
    gang_code: string;
    upah_kotor: number;
    penghasilan_bruto: number;
    tarif_pajak_ter: number;
    pph21_ter: number;

    // Breakdown Details
    hk?: number;
    gaji_pokok_aktual?: number;
    koreksi_hk?: number;

    tunjangan_beras?: number;
    tunjangan_jabatan?: number;
    tunjangan_masa_kerja?: number;
    tunjangan_lembur?: number;
    total_tunjangan?: number;

    /** Dynamic premi map: key = premi name (e.g. 'brondol', 'pruning'), value = amount */
    premi_detail?: Record<string, number>;
    premi_brondol?: number;
    premi_pph?: number;
    total_premi?: number;

    pot_spsi?: number;
    pot_koreksi?: number;
    total_potongan_kotor?: number;

    bpjs_kes_majikan?: number;
    astek_jht_majikan?: number;

    // New fields for enriched report
    upah_dasar?: number;
    gaji_pokok_ideal?: number;  // upah_dasar × HK
    thr_amount?: number;
    exgratia_amount?: number;
    other_incomes?: { type: string; name: string; amount: number }[];
}

export interface AnnualIncomeRow {
    no: number;
    emp_code: string;
    emp_name: string;
    nik: string;
    gender: string;
    status_ptkp: string;
    kategori_ter: string;
    // Monthly income (upah kotor / penghasilan bruto per bulan)
    monthly_income: Record<string, number>; // "1" -> Jan, "2" -> Feb, etc.
    monthly_gaji_kotor: Record<string, number>;
    monthly_masa_kerja: Record<string, number>;
    monthly_bpjs_kesehatan: Record<string, number>;
    monthly_astek_ins_084: Record<string, number>;
    monthly_astek_ins_2: Record<string, number>;
    monthly_pensiun_1: Record<string, number>;
    // Monthly actual PPH21 from TER calculation
    monthly_pph21: Record<string, number>; // "1" -> Jan, "2" -> Feb, etc.
    // Monthly actual PPH21 dari history_adtrans (hanya untuk tab Historis PPH21)
    monthly_pph21_adtrans: Record<string, number>;
    total_income: number;
    gaji_jan_nov: number;
    masa_kerja_jan_nov: number;

    // Header-only placeholders / specific columns
    thr: number;
    bonus: number;
    medical_claim: number;
    bpjs_kesehatan_4pct: number;  // Ditanggung majikan
    astek_084pct: number;         // JKK/JKM ditanggung majikan

    total_penghasilan_setahun: number;

    // Potongan & Perhitungan
    astek_ins_2pct: number;       // JHT ditanggung pekerja
    biaya_jabatan: number;        // 5% of total, max 6.000.000
    pensiun_1pct: number;         // BPJS Pensiun pekerja 1%
    total_potongan_tahunan: number;

    penghasilan_netto_setahun: number;
    ptkp: number;
    penghasilan_kena_pajak: number;
    pph21_kena_pajak: number;
}

export interface DecemberTaxRow {
    no: number;
    emp_code: string;
    emp_name: string;
    nik: string;
    npwp: string;
    alamat: string;
    jabatan: string;
    gender: string;
    status_ptkp: string;
    kategori_ter: string;
    masa_kerja_tahun: string;
    masa_kerja_bulan: string;
    gaji_pokok_des: number;
    tunjangan_des: number;
    premi_asuransi_des: number;
    tunjangan_pph_des: number;
    bruto_des: number;
    thr: number;
    bonus: number;
    tantiem: number;
    other_incomes?: { type: string; name: string; amount: number }[];
    gaji_pokok_setahun: number;
    tunjangan_lainnya_setahun: number;
    premi_asuransi_setahun: number;
    tunjangan_pph_setahun: number;
    natura_setahun: number;
    thr_bonus_tantiem_setahun: number;
    bruto_setahun: number;
    biaya_jabatan: number;
    iuran_jht_jp_setahun: number;
    netto_setahun: number;
    ptkp: number;
    pkp: number;
    pph21_setahun: number;
    pph21_jan_nov: number;
    pph21_desember: number;

    // Details for interactive popup
    monthly_breakdown: {
        gaji_pokok: Record<string, number>;
        tunjangan: Record<string, number>;
        premi_asuransi: Record<string, number>;
        iuran_pensiun: Record<string, number>;
        pph21: Record<string, number>;
    };
}

export interface AstekBpjsMonthlyRow {
    no: number;
    emp_code: string;
    emp_name: string;
    nik: string;
    monthly_data: Record<string, {
        upah_dasar: number;
        gaji_pokok: number;  // upah_dasar × 30
        astek_pekerja: number;
        astek_majikan: number;
        bpjs_kes_pekerja: number;
        bpjs_kes_majikan: number;
        bpjs_pensiun_pekerja: number;
        bpjs_pensiun_majikan: number;
        masa_kerja?: number;
    }>;
    total: {
        upah_dasar: number;
        gaji_pokok: number;
        astek_pekerja: number;
        astek_majikan: number;
        bpjs_kes_pekerja: number;
        bpjs_kes_majikan: number;
        bpjs_pensiun_pekerja: number;
        bpjs_pensiun_majikan: number;
        masa_kerja?: number;
    };
}

// ============================================================
// Service
// ============================================================

class TaxReportService {
    private static instance: TaxReportService;
    private constructor() { }

    public static getInstance(): TaxReportService {
        if (!TaxReportService.instance) {
            TaxReportService.instance = new TaxReportService();
        }
        return TaxReportService.instance;
    }

    /**
     * Check if the given period matches the current server month/year
     */
    private async isCurrentPeriod(month: number, year: number): Promise<boolean> {
        const currentPeriod = await currentPeriodService.getCurrentPeriod();
        return month === currentPeriod.month && year === currentPeriod.year;
    }

    /**
     * Fetch payroll data, prioritizing LIVE data for current periods, with HISTORY fallback.
     */
    private async fetchPayrollData(month: number, year: number, gangCode: string, divisionCode?: string) {
        let isSourceCurrent = false;
        const isCurrent = await this.isCurrentPeriod(month, year);
        if (isCurrent) {
            console.log(`[TaxReportService] Current period detected (${month}/${year}). Attempting LIVE database.`);
            const liveData = await DataExtractorService.getInstance().extractPayrollData(
                month, year, gangCode, divisionCode
            );

            if (liveData && liveData.data_rows && liveData.data_rows.length > 0) {
                console.log(`[TaxReportService] LIVE database has data. Using LIVE database.`);
                isSourceCurrent = true;
                return { data: liveData, isSourceCurrent };
            } else {
                console.log(`[TaxReportService] LIVE database is empty. Falling back to HISTORY database.`);
            }
        }

        console.log(`[TaxReportService] Using HISTORY database for (${month}/${year}).`);
        const historyData = await historyDatabaseService.getHistoricalPayrollDataAsExtractorFormat(
            month, year, gangCode, divisionCode
        );
        return { data: historyData, isSourceCurrent };
    }

    /**
     * Get monthly tax report (PPH21) for a specific period
     */
    public async getMonthlyTaxReport(
        year: number,
        month: number,
        divisionCode?: string,
        gangCode?: string,
        gangPrefix?: string
    ): Promise<{ employees: MonthlyTaxRow[]; period: { month: number; year: number }; total_pph21: number; premiKeys: string[]; data_source: 'current' | 'history' }> {
        // Resolve virtual division (e.g., "INF" -> "P1A") before querying history database
        let effectiveDivisionCode = divisionCode;
        if (divisionCode && divisionDefinition.isVirtualDivision(divisionCode)) {
            const sourceDivisions = await divisionDefinition.getSourceDivisionsForAggregation(divisionCode);
            effectiveDivisionCode = sourceDivisions[0]; // Use first source division for history query
            console.log(`[TaxReportService] Virtual division ${divisionCode} resolved to ${effectiveDivisionCode}`);
        }

        const { data: historyData, isSourceCurrent } = await this.fetchPayrollData(
            month, year, gangCode || 'ALL', effectiveDivisionCode || undefined
        );

        if (!historyData || historyData.data_rows.length === 0) {
            return { employees: [], period: { month, year }, total_pph21: 0, premiKeys: [], data_source: isSourceCurrent ? 'current' : 'history' };
        }

        if (gangPrefix) {
            historyData.data_rows = historyData.data_rows.filter((r: any) => (r.gang_code || '').startsWith(gangPrefix));
        }

        const ptkpMaster = await ptkpTaxService.getPtkpByYear(year);
        const ptkpMap = new Map<string, string>();
        for (const p of ptkpMaster) {
            ptkpMap.set(p.emp_code.trim(), p.ptkp_status);
        }

        let totalPph21 = 0;

        // Load THR and Exgratia for the specific month if it matches the active THR month
        const activeThr = loadActiveThrPeriode();
        const isThrMonth = activeThr && activeThr.month === month && activeThr.year === year;

        let thrMap: Map<string, number> | null = null;
        let exgratiaMap: Map<string, number> | null = null;

        if (isThrMonth) {
            const maps = loadThrBonusMaps();
            thrMap = maps.thrMap;
            exgratiaMap = maps.exgratiaMap;
        }

        // --- Fetch Database Other Incomes ---
        const dbOtherIncomes = await OtherIncomesService.getIncomes(year, month, effectiveDivisionCode, gangCode);
        const dbThrMap = new Map<string, number>();
        const dbExgratiaMap = new Map<string, number>();
        const dbCustomIncomeMap = new Map<string, number>();

        for (const inc of dbOtherIncomes) {
            if (inc.is_taxable) {
                const currentNik = String(inc.nik || '').trim().toUpperCase();
                const amt = Number(inc.amount) || 0;
                const type = String(inc.income_type || '').toUpperCase();

                if (type === 'THR') {
                    dbThrMap.set(currentNik, (dbThrMap.get(currentNik) || 0) + amt);
                } else if (type === 'BONUS' || type === 'EXGRATIA') {
                    dbExgratiaMap.set(currentNik, (dbExgratiaMap.get(currentNik) || 0) + amt);
                } else {
                    dbCustomIncomeMap.set(currentNik, (dbCustomIncomeMap.get(currentNik) || 0) + amt);
                }
            }
        }

        const employees: MonthlyTaxRow[] = historyData.data_rows.map((row: any, idx: number) => {
            const empCodeTrimmed = row.emp_code?.trim() || '';
            const masterPtkp = ptkpMap.get(empCodeTrimmed) || row.status_ptkp || 'TK/0';
            const kategoriTer = mapPTKPToTER(masterPtkp);

            // Fetch breakdown for pure calculation
            const gajiPokokAktual = row.gaji_pokok_aktual || row.gaji_pokok || 0;
            const upahDasar = row.upah_dasar || 0;
            const tunjanganBeras = row.beras_jumlah || 0;
            const tunjanganJabatan = row.jabatan_jumlah || 0;
            const tunjanganMasaKerja = row.masa_kerja_jumlah || 0;
            const tunjanganLembur = row.lembur_jumlah || 0;
            const totalPremi = row.total_premi || 0;

            // [CENTRALIZED] Calculate ASTEK 0.84% and BPJS Kes 4% from carumanDefinitions
            const pph21Caruman = getCarumanForPph21(upahDasar, tunjanganMasaKerja);
            const astek084 = pph21Caruman.astek_majikan_084;
            const bpjsKesehatanMajikan4Pct = pph21Caruman.bpjs_kes_majikan_4;
            const carumanBase = pph21Caruman.base;

            let penghasilanBruto = pph21TerService.calculatePenghasilanBruto(
                gajiPokokAktual, tunjanganBeras, tunjanganJabatan, tunjanganMasaKerja,
                tunjanganLembur, totalPremi, astek084, bpjsKesehatanMajikan4Pct, row.pot_koreksi || 0
            );

            let thrAmount = 0;
            let exgratiaAmount = 0;
            let otherIncomeAmount = 0;

            const rawEmpNik = String(row.nik_ktp || row.nik || '').trim().toUpperCase();

            // 1. Dynamic THR Calculation (Fallback)
            if (isThrMonth) {
                const masaKerjaTahun = row.masa_kerja_tahun || 0;
                if (masaKerjaTahun >= 1) {
                    const upahDasar = row.upah_dasar || 0;
                    const berasRate = row.beras_rate || 0;
                    thrAmount = (upahDasar * 30) + (berasRate * 30) + tunjanganMasaKerja;
                }

                // 2. Exgratia Calculation (Fallback)
                let rawEmpName = String(row.nama || row.emp_name || '').toUpperCase();
                rawEmpName = rawEmpName.replace(/\s*\([^)]*\)\s*/g, '').trim();
                const firstName = rawEmpName.split(' ')[0].trim();

                if (exgratiaMap && thrMap) {
                    if (exgratiaMap.has(rawEmpNik)) {
                        exgratiaAmount = exgratiaMap.get(rawEmpNik)!;
                    } else if (exgratiaMap.has(rawEmpName)) {
                        exgratiaAmount = exgratiaMap.get(rawEmpName)!;
                    } else {
                        for (const [jsonName, jsonThr] of thrMap.entries()) {
                            if (jsonName === firstName || rawEmpName.startsWith(jsonName)) {
                                exgratiaAmount = exgratiaMap.get(jsonName) || 0;
                                break;
                            }
                        }
                    }
                }
            }

            // 3. Database Overrides & Custom Incomes
            if (dbThrMap.has(rawEmpNik)) {
                thrAmount = dbThrMap.get(rawEmpNik)!;
            }
            if (dbExgratiaMap.has(rawEmpNik)) {
                exgratiaAmount = dbExgratiaMap.get(rawEmpNik)!;
            }
            if (dbCustomIncomeMap.has(rawEmpNik)) {
                otherIncomeAmount = dbCustomIncomeMap.get(rawEmpNik)!;
            }

            const empOtherIncomes = dbOtherIncomes
                .filter(inc => String(inc.nik || '').trim().toUpperCase() === rawEmpNik)
                .map(inc => ({
                    type: inc.income_type,
                    name: inc.income_name,
                    amount: Number(inc.amount) || 0
                }));

            // If we have THR/Exgratia from JSON but not in DB, add them to the list for UI display
            if (thrAmount > 0 && !dbThrMap.has(rawEmpNik)) {
                empOtherIncomes.push({ type: 'THR', name: 'THR (Formula)', amount: thrAmount });
            }
            if (exgratiaAmount > 0 && !dbExgratiaMap.has(rawEmpNik)) {
                empOtherIncomes.push({ type: 'BONUS', name: 'Exgratia (Static)', amount: exgratiaAmount });
            }

            penghasilanBruto += (thrAmount + exgratiaAmount + otherIncomeAmount);

            // Purely calculated PPh21 (TER)
            const pphResult = pph21TerService.calculatePph21Ter(penghasilanBruto, masterPtkp);
            const pph21 = pphResult.tax_amount;
            const tarifPajakTer = pphResult.rate_percent;

            totalPph21 += pph21;

            // Discover dynamic premi fields from row keys (e.g. premi_brondol, premi_pruning, etc.)
            const premiDetail: Record<string, number> = {};

            // [NEW] First, check if there's a premi_detail JSON string from history database
            // This contains the parsed premi data with keys like 'BRONDOL', 'PRUNING', etc.
            if (row.premi_detail && typeof row.premi_detail === 'object') {
                // If it's already parsed (object)
                for (const [key, value] of Object.entries(row.premi_detail)) {
                    const val = Number(value) || 0;
                    if (val > 0) {
                        // Use the key directly (it's already in uppercase like 'BRONDOL', 'PRUNING')
                        const label = String(key).toUpperCase().replace(/_/g, ' ');
                        premiDetail[label] = val;
                    }
                }
            } else if (row.premi_detail && typeof row.premi_detail === 'string') {
                // If it's a JSON string, parse it
                try {
                    const parsedPremi = JSON.parse(row.premi_detail);
                    for (const [key, value] of Object.entries(parsedPremi)) {
                        const val = Number(value) || 0;
                        if (val > 0) {
                            const label = String(key).toUpperCase().replace(/_/g, ' ');
                            premiDetail[label] = val;
                        }
                    }
                } catch (e) {
                    console.error('[TaxReportService] Error parsing premi_detail:', e);
                }
            }

            // [LEGACY] Also look for keys starting with 'premi_' in the row object
            // This is for compatibility with old data structure
            for (const key of Object.keys(row)) {
                if (key.startsWith('premi_') && key !== 'premi_pph' && key !== 'premi_pph21') {
                    const val = Number(row[key]) || 0;
                    if (val > 0) {
                        const label = key.replace(/^premi_/, '').replace(/_/g, ' ').toUpperCase();
                        // Only add if not already present (avoid duplicate from premi_detail)
                        if (!premiDetail[label]) {
                            premiDetail[label] = val;
                        }
                    }
                }
            }

            // If brondol not in premi_* but row has premi_brondol, ensure it is included
            if (!('BRONDOL' in premiDetail) && row.premi_brondol) {
                premiDetail['BRONDOL'] = Number(row.premi_brondol) || 0;
            }
            // remaining = total_premi minus all named items detected
            const namedSum = Object.values(premiDetail).reduce((s, v) => s + v, 0);
            const remaining = (totalPremi || 0) - namedSum;
            if (remaining > 0) {
                premiDetail['LAINNYA'] = remaining;
            }

            return {
                no: idx + 1,
                emp_code: row.emp_code,
                emp_name: row.nama || row.emp_name || '',
                nik: row.nik || '',
                gender: row.jenis_kelamin || '',
                status_ptkp: masterPtkp,
                kategori_ter: kategoriTer,
                gang_code: row.gang_code || '',
                upah_kotor: row.jumlah_upah_kotor || row.upah_kotor || 0,
                penghasilan_bruto: penghasilanBruto,
                tarif_pajak_ter: tarifPajakTer,
                pph21_ter: pph21,

                // Detailed breakdowns
                hk: row.jumlah_hk || row.hk || 0,
                gaji_pokok_aktual: gajiPokokAktual,
                koreksi_hk: row.koreksi_hk || 0,

                tunjangan_beras: tunjanganBeras,
                tunjangan_jabatan: tunjanganJabatan,
                tunjangan_masa_kerja: tunjanganMasaKerja,
                tunjangan_lembur: tunjanganLembur,
                total_tunjangan: row.total_tunjangan || 0,

                premi_detail: premiDetail,
                premi_brondol: row.premi_brondol || 0,
                premi_pph: row.premi_pph || 0,
                total_premi: totalPremi,

                pot_spsi: row.pot_spsi || 0,
                pot_koreksi: row.pot_koreksi || 0,
                total_potongan_kotor: row.pot_koreksi || 0,

                bpjs_kes_majikan: bpjsKesehatanMajikan4Pct,
                astek_jht_majikan: astek084,

                // Enriched fields
                upah_dasar: upahDasar,
                gaji_pokok_ideal: row.gaji_pokok_ideal || 0,
                carumanBase: carumanBase,
                thr_amount: thrAmount,
                exgratia_amount: exgratiaAmount,
                other_incomes: empOtherIncomes
            };
        });

        // Collect all unique premi keys across all employees
        const premiKeySet = new Set<string>();
        for (const emp of employees) {
            if (emp.premi_detail) {
                for (const k of Object.keys(emp.premi_detail)) {
                    premiKeySet.add(k);
                }
            }
        }
        // Sort: BRONDOL first, then alphabetical, LAINNYA last
        const premiKeys = Array.from(premiKeySet).sort((a, b) => {
            if (a === 'BRONDOL') return -1;
            if (b === 'BRONDOL') return 1;
            if (a === 'LAINNYA') return 1;
            if (b === 'LAINNYA') return -1;
            return a.localeCompare(b);
        });

        return { employees, period: { month, year }, total_pph21: totalPph21, premiKeys, data_source: isSourceCurrent ? 'current' : 'history' };
    }

    /**
     * Get annual tax report — aggregate 12 months of income data
     */
    public async getAnnualTaxReport(
        year: number,
        targetMonth?: number,
        divisionCode?: string,
        gangCode?: string,
        gangPrefix?: string
    ): Promise<{ employees: AnnualIncomeRow[]; year: number; available_months: number[] }> {
        // Resolve virtual division (e.g., "INF" -> "P1A") before querying history database
        let effectiveDivisionCode = divisionCode;
        if (divisionCode && divisionDefinition.isVirtualDivision(divisionCode)) {
            const sourceDivisions = await divisionDefinition.getSourceDivisionsForAggregation(divisionCode);
            effectiveDivisionCode = sourceDivisions[0]; // Use first source division for history query
            console.log(`[TaxReportService] Virtual division ${divisionCode} resolved to ${effectiveDivisionCode}`);
        }

        // Collect all monthly data
        const monthlyResults: Map<string, any[]> = new Map();
        const availableMonths: number[] = [];

        // Fetch all 12 months concurrently
        const monthPromises = [];
        for (let m = 1; m <= 12; m++) {
            monthPromises.push(
                this.fetchPayrollData(
                    m, year, gangCode || 'ALL', effectiveDivisionCode || undefined
                ).then(({ data }) => ({ month: m, data }))
            );
        }

        const allMonthData = await Promise.all(monthPromises);

        // Fetch PTKP mapping for this year
        const ptkpMaster = await ptkpTaxService.getPtkpByYear(year);
        const ptkpMap = new Map<string, string>();
        for (const p of ptkpMaster) {
            ptkpMap.set(p.emp_code.trim(), p.ptkp_status);
        }

        // Build employee map
        const employeeMap = new Map<string, {
            emp_name: string;
            nik: string;
            gender: string;
            status_ptkp: string;
            kategori_ter: string;
            monthly_income: Record<string, number>;
            monthly_pph21: Record<string, number>;
            monthly_pph21_adtrans: Record<string, number>;
            monthly_astek_pekerja: Record<string, number>;
            monthly_bpjs_pensiun_pekerja: Record<string, number>;
            monthly_bpjs_kes_majikan: Record<string, number>;
            monthly_astek_majikan: Record<string, number>;
            monthly_astek_jumlah: Record<string, number>;
            monthly_thr_factors: Record<string, { masa_kerja_tahun: number, upah_dasar: number, beras_rate: number, masa_kerja_jumlah: number }>;
            monthly_details: Record<string, { hk: number, gaji_pokok: number, masa_kerja: number, upah_dasar: number }>;
            was_in_target_gang: boolean;
        }>();

        // Load THR and Exgratia mappings + active THR Periode BEFORE the loop
        const { thrMap, exgratiaMap } = loadThrBonusMaps();
        const activeThr = loadActiveThrPeriode();

        // --- Fetch Database Other Incomes for the Year ---
        const dbOtherIncomesYear = await OtherIncomesService.getIncomesForYear(year, effectiveDivisionCode, gangCode);
        const dbIncomeByMonthNik = new Map<string, { thr: number, exgratia: number, custom: number }>();
        const dbIncomeByNik = new Map<string, { thr: number, exgratia: number, custom: number }>();

        for (const inc of dbOtherIncomesYear) {
            if (inc.is_taxable) {
                const nik = String(inc.nik || '').trim().toUpperCase();
                const amt = Number(inc.amount) || 0;
                const type = String(inc.income_type || '').toUpperCase();
                const monthKey = `${inc.period_month}_${nik}`;

                if (!dbIncomeByMonthNik.has(monthKey)) dbIncomeByMonthNik.set(monthKey, { thr: 0, exgratia: 0, custom: 0 });
                const mData = dbIncomeByMonthNik.get(monthKey)!;
                if (!dbIncomeByNik.has(nik)) dbIncomeByNik.set(nik, { thr: 0, exgratia: 0, custom: 0 });
                const yData = dbIncomeByNik.get(nik)!;

                if (type === 'THR') { mData.thr += amt; yData.thr += amt; }
                else if (type === 'BONUS' || type === 'EXGRATIA') { mData.exgratia += amt; yData.exgratia += amt; }
                else { mData.custom += amt; yData.custom += amt; }
            }
        }

        // --- Fetch PPH dari history_adtrans (sumber utama) untuk seluruh tahun ---
        const adtransPphByYear = await historyDatabaseService.getPphFromAdtransByYear(
            year, effectiveDivisionCode, gangCode
        );

        for (const { month, data } of allMonthData) {
            if (!data || data.data_rows.length === 0) continue;
            availableMonths.push(month);

            const filteredRows = gangPrefix ? data.data_rows.filter((r: any) => (r.gang_code || '').startsWith(gangPrefix)) : data.data_rows;

            for (const row of filteredRows) {
                const empCode = row.emp_code;
                if (!employeeMap.has(empCode)) {
                    employeeMap.set(empCode, {
                        emp_name: row.nama || row.emp_name || '',
                        nik: row.nik || '',
                        gender: row.jenis_kelamin || '',
                        status_ptkp: row.status_ptkp || '',
                        kategori_ter: row.kategori_ter || '',
                        monthly_income: {},
                        monthly_pph21: {},
                        monthly_pph21_adtrans: {},
                        monthly_astek_pekerja: {},
                        monthly_bpjs_pensiun_pekerja: {},
                        monthly_bpjs_kes_majikan: {},
                        monthly_astek_majikan: {},
                        monthly_astek_jumlah: {},
                        monthly_thr_factors: {},
                        monthly_details: {},
                        was_in_target_gang: false,
                    });
                }

                const emp = employeeMap.get(empCode)!;
                // Use jumlah_upah_kotor as monthly income per user instruction ("upah kotor bukan plus dengan astek dan bpjs")
                // Add back pot_koreksi to ensure it doesn't reduce penghasilan bruto (it should ONLY reduce upah kotor)
                emp.monthly_income[String(month)] = (row.jumlah_upah_kotor !== undefined ? row.jumlah_upah_kotor + (row.pot_koreksi || 0) : null) || row.penghasilan_bruto || 0;
                const empCodeTrimmed = empCode?.trim() || '';
                const masterPtkp = ptkpMap.get(empCodeTrimmed) || row.status_ptkp || 'TK/0';
                const kategoriTer = mapPTKPToTER(masterPtkp);

                // Calculate PPh21 on the fly (TER) untuk report pajak
                // storedPph21 dari pot_pph21 hanya untuk referensi, TIDAK digunakan di report

                const gajiPokokAktual = row.gaji_pokok_aktual || row.gaji_pokok || 0;
                const upahDasar = row.upah_dasar || 0;
                const tunjanganBeras = row.beras_jumlah || 0;
                const tunjanganJabatan = row.jabatan_jumlah || 0;
                const tunjanganMasaKerja = row.masa_kerja_jumlah || 0;
                const tunjanganLembur = row.lembur_jumlah || 0;
                const totalPremi = row.total_premi || 0;

                // [CENTRALIZED] Calculate ASTEK 0.84% and BPJS Kes 4% from carumanDefinitions
                const pph21Caruman = getCarumanForPph21(upahDasar, tunjanganMasaKerja);
                const astek084 = pph21Caruman.astek_majikan_084;
                const bpjsKesehatanMajikan4Pct = pph21Caruman.bpjs_kes_majikan_4;
                const carumanBase = pph21Caruman.base;

                let penghasilanBruto = pph21TerService.calculatePenghasilanBruto(
                    gajiPokokAktual, tunjanganBeras, tunjanganJabatan, tunjanganMasaKerja,
                    tunjanganLembur, totalPremi, astek084, bpjsKesehatanMajikan4Pct, row.pot_koreksi || 0
                );

                // Jika ada THR/Exgratia, tetap tambahkan ke bruto untuk keperluan perhitungan setahun
                const isThrMonth = activeThr && activeThr.month === month && activeThr.year === year;
                let thrAmount = 0;
                let exgratiaAmount = 0;
                let otherIncomeAmount = 0;

                const rawEmpNik = String(row.nik_ktp || row.nik || '').trim().toUpperCase();

                if (isThrMonth) {
                    const masaKerjaTahun = row.masa_kerja_tahun || 0;
                    if (masaKerjaTahun >= 1) {
                        const upahDasar = row.upah_dasar || 0;
                        const berasRate = row.beras_rate || 0;
                        thrAmount = (upahDasar * 30) + (berasRate * 30) + tunjanganMasaKerja;
                    }

                    let rawEmpName = String(row.nama || row.emp_name || '').toUpperCase();
                    rawEmpName = rawEmpName.replace(/\s*\([^)]*\)\s*/g, '').trim();
                    const firstName = rawEmpName.split(' ')[0].trim();

                    if (exgratiaMap.has(rawEmpNik)) {
                        exgratiaAmount = exgratiaMap.get(rawEmpNik)!;
                    } else if (exgratiaMap.has(rawEmpName)) {
                        exgratiaAmount = exgratiaMap.get(rawEmpName)!;
                    } else {
                        for (const [jsonName] of thrMap.entries()) {
                            if (jsonName === firstName || rawEmpName.startsWith(jsonName)) {
                                exgratiaAmount = exgratiaMap.get(jsonName) || 0;
                                break;
                            }
                        }
                    }
                }

                // Database Overrides & Custom Incomes
                const dbKey = `${month}_${rawEmpNik}`;
                if (dbIncomeByMonthNik.has(dbKey)) {
                    const dbData = dbIncomeByMonthNik.get(dbKey)!;
                    if (dbData.thr > 0) thrAmount = dbData.thr;
                    if (dbData.exgratia > 0) exgratiaAmount = dbData.exgratia;
                    if (dbData.custom > 0) otherIncomeAmount = dbData.custom;
                }

                penghasilanBruto += (thrAmount + exgratiaAmount + otherIncomeAmount);

                // PPh21 TER calculation (untuk report pajak / kalkulasi)
                const pphResult = pph21TerService.calculatePph21Ter(penghasilanBruto, masterPtkp);
                emp.monthly_pph21[String(month)] = pphResult.tax_amount;

                // PPH21 dari ADTrans (untuk tab Historis PPH21 saja)
                const adtransPphYear = adtransPphByYear.get((empCode || '').trim());
                const adtransPphVal = adtransPphYear ? (adtransPphYear.get(month) || 0) : 0;
                emp.monthly_pph21_adtrans[String(month)] = adtransPphVal;

                emp.monthly_astek_pekerja[String(month)] = row.pot_astek || 0;
                emp.monthly_bpjs_pensiun_pekerja[String(month)] = row.pot_bpjs_pensiun_pekerja || 0;
                emp.monthly_bpjs_kes_majikan[String(month)] = row.pot_bpjs_kesehatan_majikan || 0;
                emp.monthly_astek_majikan[String(month)] = row.pot_astek_maj || 0;
                emp.monthly_astek_jumlah[String(month)] = (row.pot_astek || 0) + (row.pot_astek_maj || 0);

                emp.monthly_details[String(month)] = {
                    hk: row.jumlah_hk || row.hk || 0,
                    gaji_pokok: gajiPokokAktual,
                    masa_kerja: tunjanganMasaKerja,
                    upah_dasar: row.upah_dasar || 0
                };

                emp.monthly_thr_factors[String(month)] = {
                    masa_kerja_tahun: row.masa_kerja_tahun || 0,
                    upah_dasar: row.upah_dasar || 0,
                    beras_rate: row.beras_rate || 0,
                    masa_kerja_jumlah: row.masa_kerja_jumlah || 0
                };

                // Update PTKP/TER if newer month has data
                if (masterPtkp) emp.status_ptkp = masterPtkp;
                if (kategoriTer) emp.kategori_ter = kategoriTer;

                // Check if employee matches target criteria
                if ((targetMonth === undefined || month === targetMonth) &&
                    (!gangCode || gangCode === 'ALL' || row.gang_code === gangCode)) {
                    emp.was_in_target_gang = true;
                }
            }
        }


        // Calculate annual totals
        const employees: AnnualIncomeRow[] = [];
        let idx = 0;

        for (const [empCode, emp] of employeeMap) {
            if (!emp.was_in_target_gang) continue; // Only include employees from the target gang & month

            idx++;

            const totalIncome = Object.values(emp.monthly_income).reduce((sum, v) => sum + v, 0);

            let gajiJanNov = 0;
            let masaKerjaJanNov = 0;
            let astek084pct = 0;
            let astekIns2pct = 0;
            let pensiun1pct = 0;

            let totalDasarCaruman084 = 0; // For accumulating base (Gaji Standar + Masa Kerja) before percentage

            const monthlyGajiKotor: Record<string, number> = {};
            const monthlyMasaKerja: Record<string, number> = {};
            const monthlyBpjsKesehatan: Record<string, number> = {};
            const monthlyAstekIns084: Record<string, number> = {};
            const monthlyAstekIns2: Record<string, number> = {};
            const monthlyPensiun1: Record<string, number> = {};

            // Calculate Jan-Nov totals and manual Astek/Pensiun
            for (let m = 1; m <= 11; m++) {
                const income = emp.monthly_income[String(m)] || 0;
                const details = emp.monthly_details[String(m)];

                if (details) {
                    const gajiKotor = income;
                    masaKerjaJanNov += details.masa_kerja;
                    gajiJanNov += gajiKotor; // Gaji Kotor includes Masa Kerja

                    monthlyGajiKotor[String(m)] = gajiKotor;
                    monthlyMasaKerja[String(m)] = details.masa_kerja;

                    // Accumulate base for Astek 0.84%
                    totalDasarCaruman084 += (details.upah_dasar * 30) + details.masa_kerja;

                    // [CENTRALIZED] Kalkulasi via carumanDefinitions
                    const monthCaruman = calculateAllCaruman(details.upah_dasar, details.masa_kerja);
                    const bpjsKesVal = monthCaruman.bpjs_kes_majikan;
                    const astek084Val = monthCaruman.astek_majikan_jkk_jkm;
                    const astek2Val = monthCaruman.astek_pekerja_jht;
                    const pensiun1Val = monthCaruman.bpjs_pensiun_pekerja;

                    // astek084pct is calculated after loop from accumulated base
                    astekIns2pct += astek2Val;
                    pensiun1pct += pensiun1Val;

                    monthlyBpjsKesehatan[String(m)] = bpjsKesVal;
                    monthlyAstekIns084[String(m)] = astek084Val;
                    monthlyAstekIns2[String(m)] = astek2Val;
                    monthlyPensiun1[String(m)] = pensiun1Val;
                } else if (income > 0) {
                    // Fallback if no details
                    gajiJanNov += income;
                    monthlyGajiKotor[String(m)] = income;
                    monthlyMasaKerja[String(m)] = 0;
                    monthlyBpjsKesehatan[String(m)] = 0;
                    monthlyAstekIns084[String(m)] = 0;
                    monthlyAstekIns2[String(m)] = 0;
                    monthlyPensiun1[String(m)] = 0;
                }
            }

            // Diakumulasi dulu base-nya lalu persentasenya dikalikan menggunakan service OOP caruman
            const accumCaruman = calculateAllCaruman(totalDasarCaruman084 / 30, 0);
            astek084pct = accumCaruman.astek_majikan_jkk_jkm;

            // Fetch variables for specific lookup
            const rawEmpNik = String(emp.nik || '').trim().toUpperCase();
            let rawEmpName = String(emp.emp_name || '').toUpperCase();

            // Remove alias in brackets e.g. "HERI GUNAWAN (SALMAH)" -> "HERI GUNAWAN"
            rawEmpName = rawEmpName.replace(/\s*\(.*?\)\s*/g, '').trim();
            const firstName = rawEmpName.split(' ')[0].trim();

            let thr = 0;
            let customIncomeYear = 0;

            // 1. Dynamic THR Calculation (Fallback)
            if (activeThr) {
                // Get factors from the specific THR month, fallback to latest available month
                let thrFactors = emp.monthly_thr_factors[String(activeThr.month)];
                if (!thrFactors) {
                    for (let m = 12; m >= 1; m--) {
                        if (emp.monthly_thr_factors[String(m)]) {
                            thrFactors = emp.monthly_thr_factors[String(m)];
                            break;
                        }
                    }
                }

                if (thrFactors && thrFactors.masa_kerja_tahun >= 1) {
                    thr = (thrFactors.upah_dasar * 30) + (thrFactors.beras_rate * 30) + thrFactors.masa_kerja_jumlah;
                }
            }

            // 2. Fetch Exgratia (Bonus) from Static JSON (Fallback)
            let exgratia = 0;
            if (exgratiaMap.has(rawEmpNik)) {
                exgratia = exgratiaMap.get(rawEmpNik)!;
            } else if (exgratiaMap.has(rawEmpName)) {
                exgratia = exgratiaMap.get(rawEmpName)!;
            } else {
                for (const [jsonName, jsonThr] of thrMap.entries()) {
                    if (jsonName === firstName || rawEmpName.startsWith(jsonName)) {
                        exgratia = exgratiaMap.get(jsonName) || 0;
                        break;
                    }
                }
            }

            // 3. Database Overrides & Custom Incomes
            if (dbIncomeByNik.has(rawEmpNik)) {
                const dbData = dbIncomeByNik.get(rawEmpNik)!;
                if (dbData.thr > 0) thr = dbData.thr;
                if (dbData.exgratia > 0) exgratia = dbData.exgratia;
                if (dbData.custom > 0) customIncomeYear = dbData.custom;
            }

            // BPJS Kesehatan 4% of total income (employer portion accumulated - typically Jan-Nov based on requirements, but using raw history if not strictly told otherwise. We will use 1-11 to be safe)
            let bpjsKes4pct = 0;
            for (let m = 1; m <= 11; m++) {
                bpjsKes4pct += emp.monthly_bpjs_kes_majikan[String(m)] || 0;
            }

            // ASTEK JHT (Total if needed for other tabs)
            const astekJht = Object.values(emp.monthly_astek_jumlah).reduce((sum, v) => sum + v, 0);

            // Total penghasilan setahun (Gaji + Masa Kerja + BPJS 4% + Astek 0.84% + THR + Bonus) as per image structure calculation
            const totalPenghasilanSetahun = gajiJanNov + masaKerjaJanNov + bpjsKes4pct + astek084pct + thr + exgratia + customIncomeYear;

            // Biaya Jabatan: 5% of Total Penghasilan Setahun, max 6.000.000
            const biayaJabatan = Math.min(totalPenghasilanSetahun * 0.05, 6000000);

            // Total potongan
            const totalPotongan = astekIns2pct + biayaJabatan + pensiun1pct;

            // Penghasilan Netto Setahun
            const penghasilanNetto = totalPenghasilanSetahun - totalPotongan;

            // PTKP from rules (using ptkp_pajak, not beras)
            const ptkpValue = getPtkpValue(emp.status_ptkp);

            // Penghasilan Kena Pajak
            const pkp = Math.max(0, penghasilanNetto - ptkpValue);

            // PPH21 calculation on PKP (progressive rate)
            const pph21 = this.calculateProgressivePph21(pkp);

            employees.push({
                no: idx,
                emp_code: empCode,
                emp_name: emp.emp_name,
                nik: emp.nik,
                gender: emp.gender,
                status_ptkp: emp.status_ptkp,
                kategori_ter: emp.kategori_ter,
                // Monthly income (upah kotor / penghasilan bruto per bulan)
                monthly_income: emp.monthly_income,
                monthly_gaji_kotor: monthlyGajiKotor,
                monthly_masa_kerja: monthlyMasaKerja,
                monthly_bpjs_kesehatan: monthlyBpjsKesehatan,
                monthly_astek_ins_084: monthlyAstekIns084,
                monthly_astek_ins_2: monthlyAstekIns2,
                monthly_pensiun_1: monthlyPensiun1,
                monthly_pph21: emp.monthly_pph21,
                monthly_pph21_adtrans: emp.monthly_pph21_adtrans,
                total_income: totalIncome,
                gaji_jan_nov: gajiJanNov,
                masa_kerja_jan_nov: masaKerjaJanNov,
                thr: thr, // Fetched from static JSON / Dynamic formula
                bonus: exgratia, // Mapped Exgratia
                medical_claim: 0, // Header only
                bpjs_kesehatan_4pct: bpjsKes4pct,
                astek_084pct: astek084pct,
                total_penghasilan_setahun: totalPenghasilanSetahun,
                astek_ins_2pct: astekIns2pct,
                biaya_jabatan: biayaJabatan,
                pensiun_1pct: pensiun1pct,
                total_potongan_tahunan: totalPotongan,
                penghasilan_netto_setahun: penghasilanNetto,
                ptkp: ptkpValue,
                penghasilan_kena_pajak: pkp,
                pph21_kena_pajak: pph21,
            });
        }

        return { employees, year, available_months: availableMonths.sort((a, b) => a - b) };
    }

    /**
     * Get annual ASTEK & BPJS report — per month per employee
     */
    public async getAnnualAstekBpjsReport(
        year: number,
        targetMonth?: number,
        divisionCode?: string,
        gangCode?: string,
        gangPrefix?: string
    ): Promise<{ employees: AstekBpjsMonthlyRow[]; year: number; available_months: number[] }> {
        // Resolve virtual division (e.g., "INF" -> "P1A") before querying history database
        let effectiveDivisionCode = divisionCode;
        if (divisionCode && divisionDefinition.isVirtualDivision(divisionCode)) {
            const sourceDivisions = await divisionDefinition.getSourceDivisionsForAggregation(divisionCode);
            effectiveDivisionCode = sourceDivisions[0]; // Use first source division for history query
            console.log(`[TaxReportService] Virtual division ${divisionCode} resolved to ${effectiveDivisionCode}`);
        }

        const availableMonths: number[] = [];

        // Fetch all 12 months concurrently
        const monthPromises = [];
        for (let m = 1; m <= 12; m++) {
            monthPromises.push(
                this.fetchPayrollData(
                    m, year, gangCode || 'ALL', effectiveDivisionCode || undefined
                ).then(({ data }) => ({ month: m, data }))
            );
        }

        const allMonthData = await Promise.all(monthPromises);

        const employeeMap = new Map<string, {
            emp_name: string;
            nik: string;
            monthly_data: Record<string, {
                upah_dasar: number;
                gaji_pokok: number;
                astek_pekerja: number;
                astek_majikan: number;
                bpjs_kes_pekerja: number;
                bpjs_kes_majikan: number;
                bpjs_pensiun_pekerja: number;
                bpjs_pensiun_majikan: number;
                masa_kerja: number;
            }>;
            was_in_target_gang: boolean;
        }>();

        for (const { month, data } of allMonthData) {
            if (!data || data.data_rows.length === 0) continue;
            availableMonths.push(month);

            const filteredRows = gangPrefix ? data.data_rows.filter((r: any) => (r.gang_code || '').startsWith(gangPrefix)) : data.data_rows;

            for (const row of filteredRows) {
                const empCode = row.emp_code;
                if (!employeeMap.has(empCode)) {
                    employeeMap.set(empCode, {
                        emp_name: row.nama || row.emp_name || '',
                        nik: row.nik || '',
                        monthly_data: {},
                        was_in_target_gang: false,
                    });
                }

                const emp = employeeMap.get(empCode)!;

                // [CENTRALIZED] Calculate via carumanDefinitions
                const upahDasar = row.upah_dasar || 0;
                const gajiPokokBpjs = upahDasar * 30;  // Gaji Pokok = Upah Dasar × 30
                const masaKerja = row.masa_kerja_jumlah || 0;
                const monthCaruman = calculateAllCaruman(upahDasar, masaKerja);

                emp.monthly_data[String(month)] = {
                    upah_dasar: upahDasar,
                    gaji_pokok: gajiPokokBpjs,
                    astek_pekerja: monthCaruman.astek_pekerja_jht,
                    astek_majikan: monthCaruman.astek_majikan_jkk_jkm,
                    bpjs_kes_pekerja: monthCaruman.bpjs_kes_pekerja,
                    bpjs_kes_majikan: monthCaruman.bpjs_kes_majikan,
                    bpjs_pensiun_pekerja: monthCaruman.bpjs_pensiun_pekerja,
                    bpjs_pensiun_majikan: monthCaruman.bpjs_pensiun_majikan,
                    masa_kerja: masaKerja
                };

                // Check if employee matches target criteria
                if ((targetMonth === undefined || month === targetMonth) &&
                    (!gangCode || gangCode === 'ALL' || row.gang_code === gangCode)) {
                    emp.was_in_target_gang = true;
                }
            }
        }

        const employees: AstekBpjsMonthlyRow[] = [];
        let idx = 0;

        for (const [empCode, emp] of employeeMap) {
            if (!emp.was_in_target_gang) continue; // Filter by target criteria

            idx++;

            const total = {
                upah_dasar: 0,
                gaji_pokok: 0,
                astek_pekerja: 0,
                astek_majikan: 0,
                bpjs_kes_pekerja: 0,
                bpjs_kes_majikan: 0,
                bpjs_pensiun_pekerja: 0,
                bpjs_pensiun_majikan: 0,
                masa_kerja: 0,
            };

            for (const monthData of Object.values(emp.monthly_data)) {
                total.upah_dasar += monthData.upah_dasar || 0;
                total.gaji_pokok += monthData.gaji_pokok || 0;
                total.astek_pekerja += monthData.astek_pekerja;
                total.astek_majikan += monthData.astek_majikan;
                total.bpjs_kes_pekerja += monthData.bpjs_kes_pekerja;
                total.bpjs_kes_majikan += monthData.bpjs_kes_majikan;
                total.bpjs_pensiun_pekerja += monthData.bpjs_pensiun_pekerja;
                total.bpjs_pensiun_majikan += monthData.bpjs_pensiun_majikan;
                total.masa_kerja += monthData.masa_kerja || 0;
            }

            // Diakumulasi persentasenya dari total base menggunakan OOP/Centralized Service
            total.astek_majikan = calculateAllCaruman((total.gaji_pokok + total.masa_kerja) / 30, 0).astek_majikan_jkk_jkm;

            employees.push({
                no: idx,
                emp_code: empCode,
                emp_name: emp.emp_name,
                nik: emp.nik,
                monthly_data: emp.monthly_data,
                total,
            });
        }

        return { employees, year, available_months: availableMonths.sort((a, b) => a - b) };
    }

    /**
     * Calculate progressive PPH21 from PKP (Penghasilan Kena Pajak)
     * Progressive tariff:
     *   0 - 60.000.000  => 5%
     *   60.000.001 - 250.000.000 => 15%
     *   250.000.001 - 500.000.000 => 25%
     *   500.000.001 - 5.000.000.000 => 30%
     *   > 5.000.000.000 => 35%
     */
    private calculateProgressivePph21(pkp: number): number {
        if (pkp <= 0) return 0;

        let tax = 0;
        const brackets = [
            { limit: 60000000, rate: 0.05 },
            { limit: 250000000, rate: 0.15 },
            { limit: 500000000, rate: 0.25 },
            { limit: 5000000000, rate: 0.30 },
            { limit: Infinity, rate: 0.35 },
        ];

        let remaining = pkp;
        let prevLimit = 0;

        for (const bracket of brackets) {
            const taxable = Math.min(remaining, bracket.limit - prevLimit);
            if (taxable <= 0) break;
            tax += taxable * bracket.rate;
            remaining -= taxable;
            prevLimit = bracket.limit;
        }

        return Math.round(tax);
    }

    public async getDecemberTaxReport(
        year: number,
        divisionCode?: string,
        gangCode?: string,
        gangPrefix?: string
    ): Promise<{ employees: DecemberTaxRow[]; year: number; available_months: number[] }> {
        // Resolve virtual division (e.g., "INF" -> "P1A") before querying history database
        let effectiveDivisionCode = divisionCode;
        if (divisionCode && divisionDefinition.isVirtualDivision(divisionCode)) {
            const sourceDivisions = await divisionDefinition.getSourceDivisionsForAggregation(divisionCode);
            effectiveDivisionCode = sourceDivisions[0]; // Use first source division for history query
            console.log(`[TaxReportService] Virtual division ${divisionCode} resolved to ${effectiveDivisionCode}`);
        }

        // Collect all monthly data
        const availableMonths: number[] = [];
        const monthPromises = [];
        for (let m = 1; m <= 12; m++) {
            monthPromises.push(
                this.fetchPayrollData(
                    m, year, gangCode || 'ALL', effectiveDivisionCode || undefined
                ).then(({ data }) => ({ month: m, data }))
            );
        }

        const allMonthData = await Promise.all(monthPromises);
        const { thrMap, exgratiaMap } = loadThrBonusMaps();
        const activeThr = loadActiveThrPeriode();

        // Fetch PTKP mapping for this year
        const ptkpMaster = await ptkpTaxService.getPtkpByYear(year);
        const ptkpMap = new Map<string, string>();
        for (const p of ptkpMaster) {
            ptkpMap.set(p.emp_code.trim(), p.ptkp_status);
        }

        const employeeMap = new Map<string, any>();

        for (const { month, data } of allMonthData) {
            if (!data || data.data_rows.length === 0) continue;
            availableMonths.push(month);

            const filteredRows = gangPrefix ? data.data_rows.filter((r: any) => (r.gang_code || '').startsWith(gangPrefix)) : data.data_rows;
            for (const row of filteredRows) {
                const empCode = row.emp_code;
                if (!employeeMap.has(empCode)) {
                    employeeMap.set(empCode, {
                        emp_code: empCode,
                        emp_name: row.nama || row.emp_name || '',
                        nik: row.nik_ktp || row.nik || '',
                        npwp: row.pajak_npwp || '',
                        alamat: row.alamat || '',
                        jabatan: row.jabatan || '',
                        gender: row.jenis_kelamin || '',
                        status_ptkp: row.status_ptkp || '',
                        kategori_ter: row.kategori_ter || '',
                        monthly_income: {},
                        monthly_details: {},
                        monthly_pph21: {},
                        monthly_premi_asuransi: {},
                        monthly_iuran_pensiun: {},
                        monthly_thr_factors: {},
                        was_in_target_gang: false,
                        masa_kerja_tahun: '00',
                        masa_kerja_bulan: '00'
                    });
                }

                const emp = employeeMap.get(empCode);

                if (month === 12) {
                    const mkTahunStr = String(row.masa_kerja_tahun || '0').padStart(2, '0');
                    const mkBulanStr = String(row.masa_kerja_bulan || '0').padStart(2, '0');
                    emp.masa_kerja_tahun = mkTahunStr;
                    emp.masa_kerja_bulan = mkBulanStr;
                }

                if (!gangCode || gangCode === 'ALL' || row.gang_code === gangCode) {
                    emp.was_in_target_gang = true;
                }

                const empCodeTrimmed = empCode?.trim() || '';
                const masterPtkp = ptkpMap.get(empCodeTrimmed) || row.status_ptkp || 'TK/0';
                const kategoriTer = mapPTKPToTER(masterPtkp);

                // Fetch breakdown for pure calculation
                const gajiPokokAktual = row.gaji_pokok_aktual || row.gaji_pokok || 0;
                const tunjanganBeras = row.beras_jumlah || 0;
                const tunjanganJabatan = row.jabatan_jumlah || 0;
                const tunjanganMasaKerja = row.masa_kerja_jumlah || 0;
                const tunjanganLembur = row.lembur_jumlah || 0;
                const totalPremi = row.total_premi || 0;

                // [CENTRALIZED] Calculate via carumanDefinitions
                const upahDasarCalc = row.upah_dasar || 0;
                const pph21Caruman = getCarumanForPph21(upahDasarCalc, tunjanganMasaKerja);
                const astek084 = pph21Caruman.astek_majikan_084;
                const bpjsKesehatanMajikan4Pct = pph21Caruman.bpjs_kes_majikan_4;

                const penghasilanBruto = pph21TerService.calculatePenghasilanBruto(
                    gajiPokokAktual, tunjanganBeras, tunjanganJabatan, tunjanganMasaKerja,
                    tunjanganLembur, totalPremi, astek084, bpjsKesehatanMajikan4Pct, row.pot_koreksi || 0
                );

                // Purely calculated PPh21 (TER) - untuk report pajak
                const pphResult = pph21TerService.calculatePph21Ter(penghasilanBruto, masterPtkp);

                const hk = row.jumlah_hk || row.hk || 0;
                const gp = gajiPokokAktual;
                const mk = tunjanganMasaKerja;
                const upahDasar = row.upah_dasar || 0;
                const decCaruman = calculateAllCaruman(upahDasar, mk);

                // Add back pot_koreksi to ensure it doesn't reduce penghasilan bruto (it should ONLY reduce upah kotor)
                emp.monthly_income[String(month)] = (row.jumlah_upah_kotor !== undefined ? row.jumlah_upah_kotor + (row.pot_koreksi || 0) : null) || row.upah_kotor || row.penghasilan_bruto || row.total_income || 0;
                emp.monthly_details[String(month)] = { hk, gaji_pokok: gp, masa_kerja: mk, upah_dasar: upahDasar };
                emp.monthly_pph21[String(month)] = pphResult.tax_amount;

                // Premi Asuransi: BPJS Kes 4% + Astek 0.84%
                emp.monthly_premi_asuransi[String(month)] = decCaruman.bpjs_kes_majikan + decCaruman.astek_majikan_jkk_jkm;
                // Iuran Pensiun & JHT: BPJS Pensiun 1% + Astek 2%
                emp.monthly_iuran_pensiun[String(month)] = decCaruman.bpjs_pensiun_pekerja + decCaruman.astek_pekerja_jht;

                if (activeThr && month === activeThr.month) {
                    emp.monthly_thr_factors[String(month)] = {
                        masa_kerja_tahun: row.masa_kerja_tahun || 0,
                        upah_dasar: row.upah_dasar || 0,
                        beras_rate: row.r_beras || row.beras_rate || 0,
                        masa_kerja_jumlah: mk
                    };
                }

                // Update PTKP/TER if newer month has data
                if (masterPtkp) emp.status_ptkp = masterPtkp;
                if (kategoriTer) emp.kategori_ter = kategoriTer;
            }
        }

        const employees: DecemberTaxRow[] = [];
        let idx = 0;

        for (const [empCode, emp] of employeeMap) {
            // Only include those active in target gang
            if (!emp.was_in_target_gang) continue;

            // Check if they have december income
            if (!emp.monthly_income['12']) continue;

            idx++;

            let pph21JanNov = 0;
            let gajiPokokSetahun = 0;
            let premiAsuransiSetahun = 0;
            let iuranSetahun = 0;

            let totalDasarCaruman084Year = 0;
            let bpjsKesMajikanYear = 0;

            for (let m = 1; m <= 11; m++) {
                if (emp.monthly_income[String(m)]) {
                    gajiPokokSetahun += emp.monthly_income[String(m)];
                    iuranSetahun += emp.monthly_iuran_pensiun[String(m)] || 0;
                    pph21JanNov += emp.monthly_pph21[String(m)] || 0;
                }
            }

            // Build detailed monthly breakdown for frontend (1-12)
            const breakdown = {
                gaji_pokok: {} as Record<string, number>,
                tunjangan: {} as Record<string, number>,
                premi_asuransi: {} as Record<string, number>,
                iuran_pensiun: {} as Record<string, number>,
                pph21: {} as Record<string, number>,
            };

            for (let m = 1; m <= 12; m++) {
                const ms = String(m);
                const inc = emp.monthly_income[ms] || 0;
                const det = emp.monthly_details[ms];
                const gp = det ? det.gaji_pokok : 0;
                const tunj = Math.max(0, inc - gp);

                breakdown.gaji_pokok[ms] = inc; // Frontend expects "Gaji Pokok" (Income) here, or we can use inc as Total Income
                // Wait, in previous logic gajiPokokSetahun += incDes; so "Gaji Pokok" in breakdown means the total income before premi.
                // Actually the current code does: gajiPokokSetahun += emp.monthly_income[String(m)];
                // Let's pass the raw values so frontend can show them:
                breakdown.gaji_pokok[ms] = inc;
                breakdown.tunjangan[ms] = tunj;
                breakdown.premi_asuransi[ms] = emp.monthly_premi_asuransi[ms] || 0;
                breakdown.iuran_pensiun[ms] = emp.monthly_iuran_pensiun[ms] || 0;
                breakdown.pph21[ms] = emp.monthly_pph21[ms] || 0;

                if (det) {
                    const upahDasarLocal = det.upah_dasar || 0;
                    totalDasarCaruman084Year += (upahDasarLocal * 30) + det.masa_kerja;
                    const decCaruman = calculateAllCaruman(upahDasarLocal, det.masa_kerja);
                    bpjsKesMajikanYear += decCaruman.bpjs_kes_majikan;
                }
            }

            // December logic
            const incDes = emp.monthly_income['12'] || 0;
            const detDes = emp.monthly_details['12'];
            const gpDes = detDes ? (detDes.gaji_pokok + detDes.masa_kerja) : 0;

            const detGajiPokokDes = detDes ? detDes.gaji_pokok : 0;
            const tunjanganDes = Math.max(0, incDes - detGajiPokokDes);
            const premiDes = emp.monthly_premi_asuransi['12'] || 0;
            const iuranDes = emp.monthly_iuran_pensiun['12'] || 0;
            const brutoDes = incDes + premiDes;

            gajiPokokSetahun += incDes;
            iuranSetahun += iuranDes;

            // Recalculate premi asuransi setahun (BPJS Kes 4% + Astek 0.84% from accumulated base using OOP service)
            const accumCaruman = calculateAllCaruman(totalDasarCaruman084Year / 30, 0);
            premiAsuransiSetahun = bpjsKesMajikanYear + accumCaruman.astek_majikan_jkk_jkm;

            // THR & Bonus
            const rawEmpNik = String(emp.nik || '').trim().toUpperCase();
            let rawEmpName = String(emp.emp_name || '').toUpperCase().replace(/\s*\(.*?\)\s*/g, '').trim();
            const firstName = rawEmpName.split(' ')[0].trim();

            let thr = 0;
            if (activeThr) {
                let thrFactors = emp.monthly_thr_factors[String(activeThr.month)];
                if (!thrFactors) {
                    for (let m = 12; m >= 1; m--) {
                        if (emp.monthly_thr_factors[String(m)]) {
                            thrFactors = emp.monthly_thr_factors[String(m)];
                            break;
                        }
                    }
                }
                if (thrFactors && thrFactors.masa_kerja_tahun >= 1) {
                    thr = (thrFactors.upah_dasar * 30) + (thrFactors.beras_rate * 30) + thrFactors.masa_kerja_jumlah;
                }
            }

            let bonus = 0;
            if (exgratiaMap.has(rawEmpNik)) bonus = exgratiaMap.get(rawEmpNik) || 0;
            else if (exgratiaMap.has(rawEmpName)) bonus = exgratiaMap.get(rawEmpName) || 0;
            else {
                for (const [jsonName, jsonThr] of thrMap.entries()) {
                    if (jsonName === firstName || rawEmpName.startsWith(jsonName)) {
                        bonus = exgratiaMap.get(jsonName) || 0;
                        break;
                    }
                }
            }

            const thrBonusTantiemSetahun = thr + bonus;
            const brutoSetahun = gajiPokokSetahun + premiAsuransiSetahun + thrBonusTantiemSetahun;

            const biayaJabatan = Math.min(brutoSetahun * 0.05, 6000000);
            const nettoSetahun = Math.max(0, brutoSetahun - biayaJabatan - iuranSetahun);

            const ptkpValue = getPtkpValue(emp.status_ptkp);

            // Round down to thousands
            const pkpRaw = Math.max(0, nettoSetahun - ptkpValue);
            const pkp = Math.floor(pkpRaw / 1000) * 1000;

            const pph21Setahun = this.calculateProgressivePph21(pkp);
            const pph21Desember = Math.max(0, pph21Setahun - pph21JanNov);

            employees.push({
                no: idx,
                emp_code: emp.emp_code,
                emp_name: emp.emp_name,
                nik: emp.nik,
                npwp: emp.npwp,
                alamat: emp.alamat,
                jabatan: emp.jabatan,
                gender: emp.gender,
                status_ptkp: emp.status_ptkp,
                kategori_ter: emp.kategori_ter,
                masa_kerja_tahun: emp.masa_kerja_tahun,
                masa_kerja_bulan: emp.masa_kerja_bulan,
                gaji_pokok_des: detGajiPokokDes,
                tunjangan_des: tunjanganDes,
                premi_asuransi_des: premiDes,
                tunjangan_pph_des: 0,
                bruto_des: brutoDes,
                thr: thr,
                bonus: bonus,
                tantiem: 0,
                other_incomes: (thr > 0 || bonus > 0) ? [
                    ...(thr > 0 ? [{ type: 'THR', name: 'THR', amount: thr }] : []),
                    ...(bonus > 0 ? [{ type: 'BONUS', name: 'Bonus/Exgratia', amount: bonus }] : [])
                ] : [],
                gaji_pokok_setahun: gajiPokokSetahun,
                tunjangan_lainnya_setahun: 0,
                premi_asuransi_setahun: premiAsuransiSetahun,
                tunjangan_pph_setahun: 0,
                natura_setahun: 0,
                thr_bonus_tantiem_setahun: thrBonusTantiemSetahun,
                bruto_setahun: brutoSetahun,
                biaya_jabatan: biayaJabatan,
                iuran_jht_jp_setahun: iuranSetahun,
                netto_setahun: nettoSetahun,
                ptkp: ptkpValue,
                pkp: pkp,
                pph21_setahun: pph21Setahun,
                pph21_jan_nov: pph21JanNov,
                pph21_desember: pph21Desember,
                monthly_breakdown: breakdown
            });
        }

        return { employees, year, available_months: Array.from(new Set(availableMonths)).sort((a, b) => a - b) };
    }
}

export const taxReportService = TaxReportService.getInstance();
