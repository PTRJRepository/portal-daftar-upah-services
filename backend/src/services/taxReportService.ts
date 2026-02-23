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
    // Monthly actual PPH21 from history database
    monthly_pph21: Record<string, number>; // "1" -> Jan, "2" -> Feb, etc.
    total_income: number;
    // Header-only placeholders
    thr: number;
    bonus: number;
    medical_claim: number;
    // BPJS & ASTEK included in annual income
    bpjs_kesehatan_4pct: number;
    astek_jht: number;
    total_penghasilan_setahun: number;
    // Potongan & Perhitungan
    biaya_jabatan: number; // 5% of total, max 6.000.000
    astek_pensiun_pekerja_setahun: number;
    bpjs_pensiun_pekerja_setahun: number;
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
    }>;
    total: {
        astek_pekerja: number;
        astek_majikan: number;
        bpjs_kes_pekerja: number;
        bpjs_kes_majikan: number;
        bpjs_pensiun_pekerja: number;
        bpjs_pensiun_majikan: number;
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
                total_potongan_kotor: (row.pot_spsi || 0) + (row.pot_koreksi || 0),

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
            gender: string;
            status_ptkp: string;
            kategori_ter: string;
            monthly_income: Record<string, number>;
            monthly_pph21: Record<string, number>;
            monthly_astek_pekerja: Record<string, number>;
            monthly_bpjs_pensiun_pekerja: Record<string, number>;
            monthly_bpjs_kes_majikan: Record<string, number>;
            monthly_astek_jumlah: Record<string, number>;
        }>();

        for (const { month, data } of allMonthData) {
            if (!data || data.data_rows.length === 0) continue;
            availableMonths.push(month);

            for (const row of data.data_rows) {
                const empCode = row.emp_code;
                if (!employeeMap.has(empCode)) {
                    employeeMap.set(empCode, {
                        emp_name: row.nama || row.emp_name || '',
                        gender: row.jenis_kelamin || '',
                        status_ptkp: row.status_ptkp || '',
                        kategori_ter: row.kategori_ter || '',
                        monthly_income: {},
                        monthly_pph21: {},
                        monthly_astek_pekerja: {},
                        monthly_bpjs_pensiun_pekerja: {},
                        monthly_bpjs_kes_majikan: {},
                        monthly_astek_jumlah: {},
                    });
                }

                const emp = employeeMap.get(empCode)!;
                // Use penghasilan_bruto as monthly income (gross income for tax)
                emp.monthly_income[String(month)] = row.penghasilan_bruto || row.jumlah_upah_kotor || 0;
                emp.monthly_pph21[String(month)] = row.pph21_ter || row.pot_pph21 || 0;
                emp.monthly_astek_pekerja[String(month)] = row.pot_astek || 0;
                emp.monthly_bpjs_pensiun_pekerja[String(month)] = row.pot_bpjs_pensiun_pekerja || 0;
                emp.monthly_bpjs_kes_majikan[String(month)] = row.pot_bpjs_kesehatan_majikan || 0;
                emp.monthly_astek_jumlah[String(month)] = (row.pot_astek || 0) + (row.pot_astek_maj || 0);

                const empCodeTrimmed = empCode?.trim() || '';
                const masterPtkp = ptkpMap.get(empCodeTrimmed) || row.status_ptkp || 'TK/0';
                const kategoriTer = mapPTKPToTER(masterPtkp);

                // Update PTKP/TER if newer month has data
                if (masterPtkp) emp.status_ptkp = masterPtkp;
                if (kategoriTer) emp.kategori_ter = kategoriTer;
            }
        }

        // Calculate annual totals
        const employees: AnnualIncomeRow[] = [];
        let idx = 0;

        for (const [empCode, emp] of employeeMap) {
            idx++;

            // Total income from all months
            const totalIncome = Object.values(emp.monthly_income).reduce((sum, v) => sum + v, 0);

            // BPJS Kesehatan 4% of total income (employer portion accumulated)
            const bpjsKes4pct = Object.values(emp.monthly_bpjs_kes_majikan).reduce((sum, v) => sum + v, 0);

            // ASTEK JHT accumulated
            const astekJht = Object.values(emp.monthly_astek_jumlah).reduce((sum, v) => sum + v, 0);

            // Total penghasilan setahun
            const totalPenghasilanSetahun = totalIncome;

            // Biaya Jabatan: 5% of total, max 6.000.000
            const biayaJabatan = Math.min(totalPenghasilanSetahun * 0.05, 6000000);

            // ASTEK Pensiun pekerja total
            const astekPensiunPekerja = Object.values(emp.monthly_astek_pekerja).reduce((sum, v) => sum + v, 0);

            // BPJS Pensiun pekerja total
            const bpjsPensiunPekerja = Object.values(emp.monthly_bpjs_pensiun_pekerja).reduce((sum, v) => sum + v, 0);

            // Total potongan
            const totalPotongan = biayaJabatan + astekPensiunPekerja + bpjsPensiunPekerja;

            // Penghasilan Netto
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
                monthly_income: emp.monthly_income,
                monthly_pph21: emp.monthly_pph21,
                total_income: totalIncome,
                thr: 0, // Header only
                bonus: 0, // Header only
                medical_claim: 0, // Header only
                bpjs_kesehatan_4pct: bpjsKes4pct,
                astek_jht: astekJht,
                total_penghasilan_setahun: totalPenghasilanSetahun,
                biaya_jabatan: biayaJabatan,
                astek_pensiun_pekerja_setahun: astekPensiunPekerja,
                bpjs_pensiun_pekerja_setahun: bpjsPensiunPekerja,
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
            }>;
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
                    });
                }

                const emp = employeeMap.get(empCode)!;
                emp.monthly_data[String(month)] = {
                    astek_pekerja: row.pot_astek || 0,
                    astek_majikan: row.pot_astek_maj || 0,
                    bpjs_kes_pekerja: row.pot_bpjs_kesehatan_pekerja || 0,
                    bpjs_kes_majikan: row.pot_bpjs_kesehatan_majikan || 0,
                    bpjs_pensiun_pekerja: row.pot_bpjs_pensiun_pekerja || 0,
                    bpjs_pensiun_majikan: row.pot_bpjs_pensiun_majikan || 0,
                };
            }
        }

        const employees: AstekBpjsMonthlyRow[] = [];
        let idx = 0;

        for (const [empCode, emp] of employeeMap) {
            idx++;

            const total = {
                astek_pekerja: 0,
                astek_majikan: 0,
                bpjs_kes_pekerja: 0,
                bpjs_kes_majikan: 0,
                bpjs_pensiun_pekerja: 0,
                bpjs_pensiun_majikan: 0,
            };

            for (const monthData of Object.values(emp.monthly_data)) {
                total.astek_pekerja += monthData.astek_pekerja;
                total.astek_majikan += monthData.astek_majikan;
                total.bpjs_kes_pekerja += monthData.bpjs_kes_pekerja;
                total.bpjs_kes_majikan += monthData.bpjs_kes_majikan;
                total.bpjs_pensiun_pekerja += monthData.bpjs_pensiun_pekerja;
                total.bpjs_pensiun_majikan += monthData.bpjs_pensiun_majikan;
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
