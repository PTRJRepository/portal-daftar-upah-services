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

let activeThrPeriode: ThrPeriode | null = null;
let isThrPeriodeLoaded = false;

function loadActiveThrPeriode(): ThrPeriode | null {
    if (isThrPeriodeLoaded) return activeThrPeriode;

    // Attempt to load from <project_root>/backend/data/thr_periode.json
    const possiblePaths = [
        path.resolve(process.cwd(), 'data/thr_periode.json'),
        path.resolve(__dirname, '../../data/thr_periode.json')
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            try {
                const raw = fs.readFileSync(p, 'utf-8');
                const parsed: ThrPeriode[] = JSON.parse(raw);
                activeThrPeriode = parsed.find(p => p.is_active) || null;
                break;
            } catch (err) {
                console.error(`Failed to load ${p}:`, err);
            }
        }
    }

    if (!activeThrPeriode) {
        console.warn('Active THR Periode not found or file missing.');
    }

    isThrPeriodeLoaded = true;
    return activeThrPeriode;
}

// ============================================================
// Interfaces
// ============================================================

export interface MonthlyTaxRow {
    no: number;
    emp_code: string;
    emp_name: string;
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

    premi_brondol?: number;
    premi_pph?: number;
    total_premi?: number;

    pot_spsi?: number;
    pot_koreksi?: number;
    total_potongan_kotor?: number;

    bpjs_kes_majikan?: number;
    astek_jht_majikan?: number;
}

export interface AnnualIncomeRow {
    no: number;
    emp_code: string;
    emp_name: string;
    gender: string;
    status_ptkp: string;
    kategori_ter: string;
    // Monthly income (upah kotor / penghasilan bruto per bulan)
    monthly_income: Record<string, number>; // "1" -> Jan, "2" -> Feb, etc.
    monthly_gaji_kotor: Record<string, number>;
    monthly_masa_kerja: Record<string, number>;
    // Monthly actual PPH21 from history database
    monthly_pph21: Record<string, number>; // "1" -> Jan, "2" -> Feb, etc.
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

export interface AstekBpjsMonthlyRow {
    no: number;
    emp_code: string;
    emp_name: string;
    monthly_data: Record<string, {
        astek_pekerja: number;
        astek_majikan: number;
        bpjs_kes_pekerja: number;
        bpjs_kes_majikan: number;
        bpjs_pensiun_pekerja: number;
        bpjs_pensiun_majikan: number;
        masa_kerja?: number;
    }>;
    total: {
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
     * Get monthly tax report (PPH21) for a specific period
     */
    public async getMonthlyTaxReport(
        year: number,
        month: number,
        divisionCode?: string,
        gangCode?: string
    ): Promise<{ employees: MonthlyTaxRow[]; period: { month: number; year: number }; total_pph21: number }> {
        const historyData = await historyDatabaseService.getHistoricalPayrollDataAsExtractorFormat(
            month, year, gangCode || 'ALL', divisionCode || undefined
        );

        if (!historyData || historyData.data_rows.length === 0) {
            return { employees: [], period: { month, year }, total_pph21: 0 };
        }

        const ptkpMaster = await ptkpTaxService.getPtkpByYear(year);
        const ptkpMap = new Map<string, string>();
        for (const p of ptkpMaster) {
            ptkpMap.set(p.emp_code.trim(), p.ptkp_status);
        }

        let totalPph21 = 0;
        const employees: MonthlyTaxRow[] = historyData.data_rows.map((row: any, idx: number) => {
            const pph21 = row.pph21_ter || row.pot_pph21 || 0;
            totalPph21 += pph21;

            const empCodeTrimmed = row.emp_code?.trim() || '';
            const masterPtkp = ptkpMap.get(empCodeTrimmed) || row.status_ptkp || 'TK/0';
            const kategoriTer = mapPTKPToTER(masterPtkp);

            return {
                no: idx + 1,
                emp_code: row.emp_code,
                emp_name: row.nama || row.emp_name || '',
                gender: row.jenis_kelamin || '',
                status_ptkp: masterPtkp,
                kategori_ter: kategoriTer,
                gang_code: row.gang_code || '',
                upah_kotor: row.jumlah_upah_kotor || 0,
                penghasilan_bruto: row.penghasilan_bruto || 0,
                tarif_pajak_ter: row.tarif_pajak_ter || 0,
                pph21_ter: pph21,

                // Detailed breakdowns
                hk: row.jumlah_hk || 0,
                gaji_pokok_aktual: row.gaji_pokok_aktual || 0,
                koreksi_hk: row.koreksi_hk || 0,

                tunjangan_beras: row.beras_jumlah || 0,
                tunjangan_jabatan: row.jabatan_jumlah || 0,
                tunjangan_masa_kerja: row.masa_kerja_jumlah || 0,
                tunjangan_lembur: row.lembur_jumlah || 0,
                total_tunjangan: row.total_tunjangan || 0,

                premi_brondol: row.premi_brondol || 0,
                premi_pph: row.premi_pph || 0,
                total_premi: row.total_premi || 0,

                pot_spsi: row.pot_spsi || 0,
                pot_koreksi: row.pot_koreksi || 0,
                total_potongan_kotor: row.pot_koreksi || 0,

                bpjs_kes_majikan: row.pot_bpjs_kesehatan_majikan || 0,
                astek_jht_majikan: row.pot_astek_maj || 0,
            };
        });

        return { employees, period: { month, year }, total_pph21: totalPph21 };
    }

    /**
     * Get annual tax report — aggregate 12 months of income data
     */
    public async getAnnualTaxReport(
        year: number,
        targetMonth?: number,
        divisionCode?: string,
        gangCode?: string
    ): Promise<{ employees: AnnualIncomeRow[]; year: number; available_months: number[] }> {
        // Collect all monthly data
        const monthlyResults: Map<string, any[]> = new Map();
        const availableMonths: number[] = [];

        // Fetch all 12 months concurrently
        const monthPromises = [];
        for (let m = 1; m <= 12; m++) {
            monthPromises.push(
                historyDatabaseService.getHistoricalPayrollDataAsExtractorFormat(
                    m, year, gangCode || 'ALL', divisionCode || undefined
                ).then(data => ({ month: m, data }))
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
            monthly_astek_pekerja: Record<string, number>;
            monthly_bpjs_pensiun_pekerja: Record<string, number>;
            monthly_bpjs_kes_majikan: Record<string, number>;
            monthly_astek_majikan: Record<string, number>;
            monthly_astek_jumlah: Record<string, number>;
            monthly_thr_factors: Record<string, { masa_kerja_tahun: number, upah_dasar: number, beras_rate: number, masa_kerja_jumlah: number }>;
            monthly_details: Record<string, { hk: number, gaji_pokok: number, masa_kerja: number }>;
            was_in_target_gang: boolean;
        }>();

        for (const { month, data } of allMonthData) {
            if (!data || data.data_rows.length === 0) continue;
            availableMonths.push(month);

            for (const row of data.data_rows) {
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
                emp.monthly_income[String(month)] = row.jumlah_upah_kotor || row.penghasilan_bruto || 0;
                emp.monthly_pph21[String(month)] = row.pph21_ter || row.pot_pph21 || 0;
                emp.monthly_astek_pekerja[String(month)] = row.pot_astek || 0;
                emp.monthly_bpjs_pensiun_pekerja[String(month)] = row.pot_bpjs_pensiun_pekerja || 0;
                emp.monthly_bpjs_kes_majikan[String(month)] = row.pot_bpjs_kesehatan_majikan || 0;
                emp.monthly_astek_majikan[String(month)] = row.pot_astek_maj || 0;
                emp.monthly_astek_jumlah[String(month)] = (row.pot_astek || 0) + (row.pot_astek_maj || 0);

                emp.monthly_details[String(month)] = {
                    hk: row.jumlah_hk || row.hk || 0,
                    gaji_pokok: row.gaji_pokok_aktual || row.gaji_pokok || 0,
                    masa_kerja: row.masa_kerja_jumlah || 0
                };

                emp.monthly_thr_factors[String(month)] = {
                    masa_kerja_tahun: row.masa_kerja_tahun || 0,
                    upah_dasar: row.upah_dasar || 0,
                    beras_rate: row.beras_rate || 0,
                    masa_kerja_jumlah: row.masa_kerja_jumlah || 0
                };

                const empCodeTrimmed = empCode?.trim() || '';
                const masterPtkp = ptkpMap.get(empCodeTrimmed) || row.status_ptkp || 'TK/0';
                const kategoriTer = mapPTKPToTER(masterPtkp);

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

        // Load THR and Exgratia mappings
        const { thrMap, exgratiaMap } = loadThrBonusMaps();

        // Load active THR Periode
        const activeThr = loadActiveThrPeriode();

        // Calculate annual totals
        const employees: AnnualIncomeRow[] = [];
        let idx = 0;

        for (const [empCode, emp] of employeeMap) {
            if (!emp.was_in_target_gang) continue; // Only include employees from the target gang & month

            idx++;

            // Total income from all months (for other logic if needed, but table uses Jan-Nov for sum)
            const totalIncome = Object.values(emp.monthly_income).reduce((sum, v) => sum + v, 0);

            let gajiJanNov = 0;
            let masaKerjaJanNov = 0;
            let astek084pct = 0;
            let astekIns2pct = 0;
            let pensiun1pct = 0;

            const monthlyGajiKotor: Record<string, number> = {};
            const monthlyMasaKerja: Record<string, number> = {};

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

                    const dasarAstek = (details.hk * details.gaji_pokok) + details.masa_kerja;
                    astek084pct += dasarAstek * 0.0084;
                    astekIns2pct += dasarAstek * 0.02;
                    pensiun1pct += dasarAstek * 0.01;
                } else if (income > 0) {
                    // Fallback if no details
                    gajiJanNov += income;
                    monthlyGajiKotor[String(m)] = income;
                    monthlyMasaKerja[String(m)] = 0;
                }
            }

            // Fetch variables for specific lookup
            const rawEmpNik = String(emp.nik || '').trim().toUpperCase();
            let rawEmpName = String(emp.emp_name || '').toUpperCase();

            // Remove alias in brackets e.g. "HERI GUNAWAN (SALMAH)" -> "HERI GUNAWAN"
            rawEmpName = rawEmpName.replace(/\s*\(.*?\)\s*/g, '').trim();
            const firstName = rawEmpName.split(' ')[0].trim();

            let thr = 0;

            // 1. Dynamic THR Calculation
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

            // 2. Fetch Exgratia (Bonus) from Static JSON
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

            // BPJS Kesehatan 4% of total income (employer portion accumulated - typically Jan-Nov based on requirements, but using raw history if not strictly told otherwise. We will use 1-11 to be safe)
            let bpjsKes4pct = 0;
            for (let m = 1; m <= 11; m++) {
                bpjsKes4pct += emp.monthly_bpjs_kes_majikan[String(m)] || 0;
            }

            // ASTEK JHT (Total if needed for other tabs)
            const astekJht = Object.values(emp.monthly_astek_jumlah).reduce((sum, v) => sum + v, 0);

            // Total penghasilan setahun (Gaji + Masa Kerja + BPJS 4% + Astek 0.84% + THR + Bonus) as per image structure calculation
            const totalPenghasilanSetahun = gajiJanNov + masaKerjaJanNov + bpjsKes4pct + astek084pct + thr + exgratia;

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
                gender: emp.gender,
                status_ptkp: emp.status_ptkp,
                kategori_ter: emp.kategori_ter,
                // Monthly income (upah kotor / penghasilan bruto per bulan)
                monthly_income: emp.monthly_income,
                monthly_gaji_kotor: monthlyGajiKotor,
                monthly_masa_kerja: monthlyMasaKerja,
                monthly_pph21: emp.monthly_pph21,
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
        gangCode?: string
    ): Promise<{ employees: AstekBpjsMonthlyRow[]; year: number; available_months: number[] }> {
        const availableMonths: number[] = [];

        // Fetch all 12 months concurrently
        const monthPromises = [];
        for (let m = 1; m <= 12; m++) {
            monthPromises.push(
                historyDatabaseService.getHistoricalPayrollDataAsExtractorFormat(
                    m, year, gangCode || 'ALL', divisionCode || undefined
                ).then(data => ({ month: m, data }))
            );
        }

        const allMonthData = await Promise.all(monthPromises);

        const employeeMap = new Map<string, {
            emp_name: string;
            monthly_data: Record<string, {
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

            for (const row of data.data_rows) {
                const empCode = row.emp_code;
                if (!employeeMap.has(empCode)) {
                    employeeMap.set(empCode, {
                        emp_name: row.nama || row.emp_name || '',
                        monthly_data: {},
                        was_in_target_gang: false,
                    });
                }

                const emp = employeeMap.get(empCode)!;

                // Manual Calculation for Astek and Pensiun
                const hk = row.jumlah_hk || row.hk || 0;
                const gajiPokok = row.gaji_pokok_aktual || row.gaji_pokok || 0;
                const masaKerja = row.masa_kerja_jumlah || 0;
                const dasarAstek = (hk * gajiPokok) + masaKerja;

                emp.monthly_data[String(month)] = {
                    astek_pekerja: dasarAstek * 0.02, // 2%
                    astek_majikan: dasarAstek * 0.0084, // 0.84%
                    bpjs_kes_pekerja: row.pot_bpjs_kesehatan_pekerja || 0,
                    bpjs_kes_majikan: row.pot_bpjs_kesehatan_majikan || 0,
                    bpjs_pensiun_pekerja: dasarAstek * 0.01, // 1%
                    bpjs_pensiun_majikan: row.pot_bpjs_pensiun_majikan || 0,
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
                astek_pekerja: 0,
                astek_majikan: 0,
                bpjs_kes_pekerja: 0,
                bpjs_kes_majikan: 0,
                bpjs_pensiun_pekerja: 0,
                bpjs_pensiun_majikan: 0,
                masa_kerja: 0,
            };

            for (const monthData of Object.values(emp.monthly_data)) {
                total.astek_pekerja += monthData.astek_pekerja;
                total.astek_majikan += monthData.astek_majikan;
                total.bpjs_kes_pekerja += monthData.bpjs_kes_pekerja;
                total.bpjs_kes_majikan += monthData.bpjs_kes_majikan;
                total.bpjs_pensiun_pekerja += monthData.bpjs_pensiun_pekerja;
                total.bpjs_pensiun_majikan += monthData.bpjs_pensiun_majikan;
                total.masa_kerja += monthData.masa_kerja || 0;
            }

            employees.push({
                no: idx,
                emp_code: empCode,
                emp_name: emp.emp_name,
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
}

export const taxReportService = TaxReportService.getInstance();
