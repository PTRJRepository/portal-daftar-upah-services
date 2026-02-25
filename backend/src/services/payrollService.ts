import { Database } from "../db/client";
import { cacheService } from "./cacheService";
import { Config } from "../config";

export interface BPJSComponents {
    kesehatan_pekerja: number;
    kesehatan_majikan: number;
    kesehatan_total: number;
    pensiun_pekerja: number;
    pensiun_majikan: number;
    pensiun_total: number;
    jumlah: number;
    pekerja_total: number;
    majikan_total: number;
    base_amount: number;
}

export interface PayrollRow {
    no: number;
    nik: string;
    nama: string;
    jenis_kelamin: string;
    gang_code: string;
    phone: string;
    upah_dasar: number;
    hari_kerja: number;
    upah_pokok: number;
    cuti_tahunan_hari: number;
    cuti_sakit_haid_hari: number;
    cuti_minggu_hari: number;
    cuti_nasional_hari: number;
    jumlah_hk: number;
    gaji_pokok: number;
    beras_rate: number;
    beras_jumlah: number;
    jabatan_rate: number;
    jabatan_jumlah: number;
    masa_kerja_tahun: number;
    masa_kerja_jumlah: number;
    lembur_jam: number;
    lembur_jumlah: number;
    total_tunjangan: number;
    premi_brondol: number;
    premi: Record<string, number>;
    total_premi: number;
    jumlah_upah_kotor: number;
    pot_spsi: number;
    pot_pph21: number;
    pot_koreksi: number;
    pot_bpjs_kesehatan_pekerja: number;
    pot_bpjs_pensiun_pekerja: number;
    pot_bpjs_pekerja_total: number;
    total_potongan: number;
    upah_bersih: number;
}

export class PayrollService {
    private static instance: PayrollService;
    private db: Database;

    private constructor() {
        this.db = Database.getInstance();
    }

    public static getInstance(): PayrollService {
        if (!PayrollService.instance) {
            PayrollService.instance = new PayrollService();
        }
        return PayrollService.instance;
    }

    // --- Core Calculation Methods ---

    /**
     * Calculate Hari Kerja = HK - (Tahunan + Sakit + Minggu + Nasional)
     */
    public calculateHariKerja(
        hkCount: number,
        cutiTahunan: number,
        cutiSakit: number,
        hkMinggu: number,
        hkNasional: number
    ): number {
        const totalCuti = cutiTahunan + cutiSakit + hkMinggu + hkNasional;
        return Math.max(0, hkCount - totalCuti);
    }

    /**
     * Calculate Gaji Pokok = (HK - Total Cuti) x Payrate
     */
    public calculateGajiPokok(
        hkCount: number,
        payrate: number,
        cutiTahunan: number = 0,
        cutiSakit: number = 0,
        hkMinggu: number = 0,
        hkNasional: number = 0
    ): number {
        const totalCuti = cutiTahunan + cutiSakit + hkMinggu + hkNasional;
        const hariKerja = Math.max(0, hkCount - totalCuti);
        return payrate ? hariKerja * payrate : 0;
    }

    /**
     * Calculate Gaji Pokok (JML HK × Upah Dasar) - for gross calculation
     */
    public calculateGajiPokokJmlHk(hkCount: number, payrate: number): number {
        return payrate ? hkCount * payrate : 0;
    }

    /**
     * Calculate Total Tunjangan = Beras + Jabatan + Masa Kerja + Lembur
     */
    public calculateTotalTunjangan(
        hkCount: number,
        berasPayrate: number,
        jabatanAmount: number,
        masaKerjaAmount: number,
        lemburAmount: number
    ): number {
        const berasJumlah = berasPayrate > 0 ? hkCount * berasPayrate : 0;
        return berasJumlah + jabatanAmount + masaKerjaAmount + lemburAmount;
    }

    /**
     * Calculate Total Premi = BRONDOL + PRUNING + Dynamic Premi
     * Note: Koreksi is NOT included in total_premi
     */
    public calculateTotalPremi(
        brondolAmount: number,
        dynamicPremiAmounts: number[]
    ): number {
        const totalDynamic = dynamicPremiAmounts.reduce((sum, val) => sum + val, 0);
        return brondolAmount + totalDynamic;
    }

    /**
     * Calculate BPJS components.
     * BASE = (Upah Dasar × 30) + Masa Kerja Amount  (always 30 days, not actual HK)
     * 
     * BPJS Pensiun: Pekerja 1%, Majikan 2%
     * BPJS Kesehatan: Pekerja 1%, Majikan 4%
     */
    public calculateBpjsComponents(masaKerjaJumlah: number, upahDasar: number = 0): BPJSComponents {
        const bpjsBase = (upahDasar * 30) + masaKerjaJumlah;

        // BPJS Kesehatan (Health)
        const kesehatanPekerja = Math.round(bpjsBase * 0.01 * 100) / 100; // 1%
        const kesehatanMajikan = Math.round(bpjsBase * 0.04 * 100) / 100; // 4%

        // BPJS Pensiun (Pension)
        const pensiunPekerja = Math.round(bpjsBase * 0.01 * 100) / 100;   // 1%
        const pensiunMajikan = Math.round(bpjsBase * 0.02 * 100) / 100;   // 2%

        // Totals
        const kesehatanTotal = Math.round((kesehatanPekerja + kesehatanMajikan) * 100) / 100;
        const pensiunTotal = Math.round((pensiunPekerja + pensiunMajikan) * 100) / 100;
        const pekerjaTotal = Math.round((kesehatanPekerja + pensiunPekerja) * 100) / 100;  // 2%
        const majikanTotal = Math.round((kesehatanMajikan + pensiunMajikan) * 100) / 100;  // 6%
        const jumlah = Math.round((pekerjaTotal + majikanTotal) * 100) / 100;              // 8%

        return {
            kesehatan_pekerja: kesehatanPekerja,
            kesehatan_majikan: kesehatanMajikan,
            kesehatan_total: kesehatanTotal,
            pensiun_pekerja: pensiunPekerja,
            pensiun_majikan: pensiunMajikan,
            pensiun_total: pensiunTotal,
            jumlah,
            pekerja_total: pekerjaTotal,
            majikan_total: majikanTotal,
            base_amount: bpjsBase
        };
    }

    /**
     * Calculate Jumlah Upah Kotor = Gaji Pokok + Total Tunjangan + Total Premi
     */
    public calculateJumlahUpahKotor(
        hkCount: number,
        payrate: number,
        totalTunjangan: number,
        totalPremi: number
    ): number {
        const gajiPokok = this.calculateGajiPokokJmlHk(hkCount, payrate);
        return gajiPokok + totalTunjangan + totalPremi;
    }

    /**
     * Calculate Total Potongan = BPJS Pekerja + SPSI + PPH21
     */
    public calculateTotalPotongan(
        bpjsPekerjaTotal: number,
        spsiAmount: number,
        pph21Amount: number
    ): number {
        return bpjsPekerjaTotal + spsiAmount + pph21Amount;
    }

    /**
     * Calculate Upah Bersih = Jumlah Upah Kotor - Total Potongan
     */
    public calculateUpahBersih(jumlahUpahKotor: number, totalPotongan: number): number {
        return jumlahUpahKotor - totalPotongan;
    }

    // --- Legacy Calculate Method (for basic API) ---
    public calculate(
        upahDasar: number,
        hkCount: number,
        allowances: Record<string, number>,
        deductions: Record<string, number>
    ): Record<string, any> {
        const workingDays = hkCount;
        const basicSalary = workingDays * upahDasar;
        const totalAllowances = Object.values(allowances || {}).reduce((sum, val) => sum + val, 0);
        const totalDeductions = Object.values(deductions || {}).reduce((sum, val) => sum + val, 0);
        const netSalary = basicSalary + totalAllowances - totalDeductions;

        return {
            hk_count: hkCount,
            working_days: workingDays,
            basic_salary: basicSalary,
            allowances,
            deductions,
            net_salary: netSalary
        };
    }

    // --- Date Helper ---
    private getDates(month: number, year: number): [string, string] {
        const start = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-01`;
        const end = month === 12
            ? `${(year + 1).toString().padStart(4, "0")}-01-01`
            : `${year.toString().padStart(4, "0")}-${(month + 1).toString().padStart(2, "0")}-01`;
        return [start, end];
    }

    // --- Payrate Map ---
    public async getPayratesMap(empCodes: string[], serverProfile?: string): Promise<Record<string, number>> {
        if (!empCodes.length) return {};

        const cacheKey = `payrates:${serverProfile || "default"}:${empCodes.sort().join(",")}`;
        const cached = cacheService.get<Record<string, number>>(cacheKey);
        if (cached) return cached;

        const map: Record<string, number> = {};
        const chunks = this.chunk(empCodes, 200);

        // Use specific profile if requested, otherwise default
        const db = serverProfile ? Database.getInstance(undefined, serverProfile) : this.db;

        for (const chunk of chunks) {
            const placeholders = chunk.map(() => `?`).join(",");
            const rows = await db.query<{ EmpCode: string; PayRate: number }>(`
                SELECT EmpCode, PayRate FROM HR_PAYROLL WHERE EmpCode IN (${placeholders})
            `, chunk);

            for (const row of rows) {
                map[row.EmpCode?.trim() || ""] = row.PayRate || 0;
            }
        }

        cacheService.set(cacheKey, map, 300);
        return map;
    }

    // --- Loosefruit (Brondol) Map ---
    public async getLoosefruitMap(
        empCodes: string[],
        startDate: string,
        endDate: string
    ): Promise<Record<string, number>> {
        if (!empCodes.length) return {};

        const cacheKey = `loosefruit:${startDate}:${endDate}:${empCodes.sort().join(",")}`;
        const cached = cacheService.get<Record<string, number>>(cacheKey);
        if (cached) return cached;

        const map: Record<string, number> = {};
        const chunks = this.chunk(empCodes, 200);

        for (const chunk of chunks) {
            const placeholders = chunk.map((_, i) => `@p${i}`).join(",");
            const rows = await this.db.query<{ EmpCode: string; Total: number }>(`
                SELECT LFLN.EmpCode, SUM(LFLN.Amount) as Total
                FROM PR_LOOSEFRUIT_ARC LF
                JOIN PR_LOOSEFRUITLN_ARC LFLN ON LF.ID = LFLN.MasterID
                WHERE LFLN.EmpCode IN (${placeholders})
                  AND LF.DocDate >= @p${chunk.length}
                  AND LF.DocDate < @p${chunk.length + 1}
                GROUP BY LFLN.EmpCode
            `, [...chunk, startDate, endDate]);

            for (const row of rows) {
                map[row.EmpCode?.trim() || ""] = row.Total || 0;
            }
        }

        cacheService.set(cacheKey, map, 300);
        return map;
    }

    // --- Premi Map (by DocDesc pattern) ---
    public async getPremiMap(
        empCodes: string[],
        startDate: string,
        endDate: string,
        pattern: string,
        exactMatch: boolean = false
    ): Promise<Record<string, number>> {
        if (!empCodes.length) return {};

        const matchType = exactMatch ? "exact" : "like";
        const cacheKey = `premi:${matchType}:${pattern}:${startDate}:${endDate}:${empCodes.sort().join(",")}`;
        const cached = cacheService.get<Record<string, number>>(cacheKey);
        if (cached) return cached;

        const map: Record<string, number> = {};
        const chunks = this.chunk(empCodes, 200);
        const operator = exactMatch ? "=" : "LIKE";

        for (const chunk of chunks) {
            const placeholders = chunk.map((_, i) => `@p${i}`).join(",");
            const rows = await this.db.query<{ EmpCode: string; Total: number }>(`
                SELECT t.EmpCode, SUM(ln.Amount) as Total
                FROM PR_ADTRANS_ARC t
                JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
                WHERE t.EmpCode IN (${placeholders})
                  AND t.DocDate >= @p${chunk.length}
                  AND t.DocDate < @p${chunk.length + 1}
                  AND UPPER(t.DocDesc) ${operator} UPPER(@p${chunk.length + 2})
                GROUP BY t.EmpCode
            `, [...chunk, startDate, endDate, exactMatch ? pattern : `%${pattern}%`]);

            for (const row of rows) {
                map[row.EmpCode?.trim() || ""] = row.Total || 0;
            }
        }

        cacheService.set(cacheKey, map, 300);
        return map;
    }

    // --- Normalize Premi Field Name ---
    public normalizePremiFieldName(docDesc: string): string {
        if (!docDesc) return "";

        let name = docDesc.trim().toUpperCase();
        const prefixes = ["TUNJANGAN PREMI", "TUNJANGAN", "PREMI"];

        for (const prefix of prefixes) {
            if (name.startsWith(prefix)) {
                name = name.slice(prefix.length).trim();
                break;
            }
        }

        if (!name) {
            if (docDesc.toUpperCase().includes("TUNJANGAN PREMI")) name = "TUNJANGAN_PREMI";
            else if (docDesc.toUpperCase() === "PREMI") name = "PREMI";
            else return "";
        }

        name = name.toLowerCase().replace(/ /g, "_");
        name = name.replace(/[^a-z0-9_]/g, "");
        name = name.replace(/_+/g, "_").replace(/^_|_$/g, "");

        if (!name) return "";
        return name.startsWith("premi_") ? name : `premi_${name}`;
    }

    // --- Helper: chunk array ---
    private chunk<T>(arr: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
        }
        return chunks;
    }
}

export const payrollService = PayrollService.getInstance();
