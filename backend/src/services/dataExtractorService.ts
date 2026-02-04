import { Database } from "../db/client";
import { payrollService } from "./payrollService";
import { gangService } from "./gangService";
import { lemburCalculator } from "./lemburCalculator";
import { EmployeeEstateService } from "./employeeEstateService";
import { calculatePph21Ter } from "./pph21TerService";

interface EmployeeRow {
    emp_code: string;
    emp_name: string;
    gender: string;
    loc_code: string;
    gang_code: string;
    pay_rate: number;
    beras_rate: number;
    join_date: string | null;
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

interface ShortageDetail {
    date: string;
    day_name: string;
    actual_hours: number;
    target_hours: number;
    shortage_hours: number;
}

interface PayrollRow {
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
    hari_kerja: number;
    gaji_pokok: number;
    kehadiran: number;
    cuti_tahunan_hari: number;
    cuti_sakit_haid_hari: number;
    cuti_minggu_hari: number;
    cuti_nasional_hari: number;
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
    total_tunjangan: number;
    premi_brondol: number;
    premi_pph: number; // PREMI PPH - ADDED (+) to upah_bersih, not subtracted
    total_premi: number;
    premi: Record<string, number>;
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
    astek_084: number;
    penghasilan_bruto: number; // Sum of: gaji_pokok_aktual + beras_jumlah + jabatan_jumlah + masa_kerja_jumlah + lembur_jumlah + total_premi
    upah_kotor_pajak: number; // Jumlah Upah Kotor + Astek + BPJS Kesehatan (untuk header/pajak)
    // PPH21 TER fields
    tarif_pajak_ter: number; // TER rate as percentage (e.g., 5 for 5%)
    pph21_ter: number; // Calculated PPH21 amount using TER method
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
    const mapping: Record<number, string> = {
        2250: 'TK/0',
        3250: 'TK/1',
        4200: 'TK/2',
        3750: 'K/0',
        4650: 'K/1',
        5550: 'K/2',
        6450: 'K/3'  // K/3 → TER C
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
    "INFRA": "INF", "AREC": "ARC", "IJL": "IJL"
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
        serverProfile?: string
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

        let gangCondition = "";
        if (specificEmpCode) {
            gangCondition = `RTRIM(e.EmpCode) = '${specificEmpCode.trim()}'`;
        } else if (gangCode && gangCode !== "ALL") {
            // Use UPPER for case-insensitive comparison and RTRIM to handle trailing spaces
            gangCondition = `UPPER(RTRIM(gl.GangCode)) = UPPER('${gangCode.trim()}')`;
        } else if (divisionCode) {
            const gangs = await gangService.fetchGangs(divisionCode);
            if (gangs.length > 0) {
                // Use UPPER for case-insensitive comparison and RTRIM for trailing spaces
                const conditions = gangs.map((gang: { gang_code: string }) => `UPPER(RTRIM(gl.GangCode)) = UPPER('${gang.gang_code.trim()}')`).join(' OR ');
                gangCondition = `(${conditions})`;
            } else {
                gangCondition = "1=0";
            }
        }

        const startTotal = performance.now();
        const employees = await this.getEmployees(gangCondition, serverProfile);

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
        const [attendanceMap, cuti, premiResult, potonganResult, lembur, beras, berasDocDesc, lemburDocDesc, jabatan, masaKerja, upahPokok, brondol, jobTitles] = await Promise.all([
            this.getAttendance(empCodes, startDate, endDate, serverProfile),
            this.getCuti(empCodes, startDate, endDate, serverProfile),
            this.getPremi(empCodes, startDate, endDate, serverProfile),
            this.getPotongan(empCodes, startDate, endDate, serverProfile),
            this.getLemburDetailsFromCalculator(empCodes, month, year, serverProfile),

            this.getTunjanganAmount(empCodes, startDate, endDate, "BERAS", serverProfile),
            this.getBerasFromDocDesc(empCodes, startDate, endDate, serverProfile),
            this.getLemburFromDocDesc(empCodes, startDate, endDate, serverProfile),
            this.getTunjanganAmount(empCodes, startDate, endDate, "JABATAN", serverProfile),
            this.getTunjanganAmount(empCodes, startDate, endDate, "MASA%KERJA", serverProfile),
            this.getUpahPokok(empCodes, serverProfile),
            this.getBrondol(empCodes, startDate, endDate, serverProfile),

            EmployeeEstateService.getEmployeeJobs()
        ]);

        // Destructure premi result - uses DocDesc as title
        const { amounts: premi, titleMap: premiTitleMap } = premiResult;
        // Destructure potongan result - uses TaskDesc as title
        const { amounts: potongan, titleMap: potonganTitleMap } = potonganResult;

        const dataRows: PayrollRow[] = [];
        const dynamicPremiSet = new Set<string>();
        const dynamicPotonganSet = new Set<string>();

        for (const emp of employees) {
            const attData = attendanceMap[emp.emp_code] || { hk: 0, total_hours: 0, shortage_count: 0, total_amount_rp: 0 };
            const hk = attData.hk;
            // REMOVED: Skip employees with HK=0 - now we display all employees even with no attendance

            const empCuti = cuti[emp.emp_code] || { cuti_tahunan: 0, cuti_sakit_haid: 0, cuti_minggu: 0, cuti_nasional: 0 };
            const empPremi = premi[emp.emp_code] || {};
            const empPotongan = potongan[emp.emp_code] || {};
            const empLembur = lembur[emp.emp_code] || { jam: 0, jumlah: 0 };
            const empLemburDocDesc = lemburDocDesc[emp.emp_code] || 0;
            const empBeras = beras[emp.emp_code] || 0;
            const empBerasDocDesc = berasDocDesc[emp.emp_code] || 0;
            const empJabatan = jabatan[emp.emp_code] || 0;
            const empMasaKerjaJumlah = masaKerja[emp.emp_code] || 0;
            const daysInMonth = new Date(year, month, 0).getDate();
            const empUpahDasar = upahPokok[emp.emp_code] || emp.pay_rate || 0;
            const empJobTitle = jobTitles[emp.emp_code] || "";

            // ... (Rest of existing logic mostly unchanged until row creation)
            const totalCuti = empCuti.cuti_tahunan + empCuti.cuti_sakit_haid + empCuti.cuti_minggu + empCuti.cuti_nasional;
            const hari_kerja = Math.max(0, hk - totalCuti);

            // [MODIFIED] Use database amount for basic salary
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
            const berasJumlah = (berasRate > 0 && hk > 0 ? berasRate * hk : 0) + empBerasDocDesc;

            const jabatanRate = hk > 0 && empJabatan > 0 ? empJabatan / hk : 0;
            const masaKerjaRate = hk > 0 && empMasaKerjaJumlah > 0 ? empMasaKerjaJumlah / hk : 0;
            const empLemburJumlah = empLembur.jumlah + empLemburDocDesc;

            // [UPDATED] Gaji Pokok untuk Grup Penggajian
            // gaji_pokok_ideal = upah_dasar × jumlah_hk (untuk referensi)
            // gaji_pokok_aktual = total_amount_rp dari PR_TASKREGLN (amount plantware) - untuk display dan perhitungan
            // koreksi_hk = gaji_pokok_aktual - gaji_pokok_ideal
            const gaji_pokok_ideal = empUpahDasar * hk;
            const gaji_pokok_aktual = attData.total_amount_rp ?? 0;
            const gaji_pokok = gaji_pokok_aktual;  // Use actual for display and calculation
            const total_tunjangan = berasJumlah + empJabatan + empMasaKerjaJumlah + empLemburJumlah;

            empPremi["brondol"] = (empPremi["brondol"] || 0) + empBrondol;

            let total_premi = 0;
            for (const [key, val] of Object.entries(empPremi)) {
                // Exclude koreksi from total_premi (koreksi handled in potongan)
                if (key !== "koreksi") {
                    total_premi += val as number;
                }
                if (key !== "brondol" && key !== "koreksi") {
                    dynamicPremiSet.add(key);
                }
            }

            const pot_spsi = Math.abs(empPotongan["SPSI"] || 0);
            const pot_pph21 = Math.abs(empPotongan["PPH21"] || 0);
            // [NEW] Premi PPH from TaskDesc = 'ACCRUALS-CHECKROLL' (treated as potongan upah bersih)
            const pot_premi_pph = Math.abs(empPotongan["PREMI_PPH"] || 0);

            // [CRITICAL FIX] Add PREMI_PPH to dynamicPotonganSet if it has a value
            if (pot_premi_pph > 0) {
                dynamicPotonganSet.add("PREMI_PPH");
            }

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

            const carumanBase = (empUpahDasar * 30) + empMasaKerjaJumlah;

            const pot_astek_pekerja = Math.round(carumanBase * 0.02 * 100) / 100;
            const pot_astek_majikan = Math.round(carumanBase * 0.0454 * 100) / 100;
            const pot_astek_jumlah = Math.round((pot_astek_pekerja + pot_astek_majikan) * 100) / 100;

            const pot_bpjs_kesehatan_pekerja_formula = Math.round(carumanBase * 0.01 * 100) / 100;
            const pot_bpjs_kesehatan_pekerja = pot_bpjs_kesehatan_pekerja_formula + db_bpjs_kes;

            const pot_bpjs_kesehatan_majikan = Math.round(carumanBase * 0.04 * 100) / 100;
            const pot_bpjs_kesehatan_jumlah = Math.round((pot_bpjs_kesehatan_pekerja + pot_bpjs_kesehatan_majikan) * 100) / 100;

            const pot_bpjs_pensiun_pekerja = Math.round(carumanBase * 0.01 * 100) / 100;
            const pot_bpjs_pensiun_majikan = Math.round(carumanBase * 0.02 * 100) / 100;
            const pot_bpjs_pensiun_jumlah = Math.round((pot_bpjs_pensiun_pekerja + pot_bpjs_pensiun_majikan) * 100) / 100;

            // [FIXED] PREMI_PPH is an ADDITION (penambah), NOT a deduction
            // [FIXED] pot_koreksi is ONLY in Potongan Upah Kotor, NOT in total_potongan
            // total_potongan = astek + bpjs_pekerja + spsi + pph21 + other (no koreksi)
            const total_potongan = pot_astek_pekerja + pot_bpjs_kesehatan_pekerja + pot_bpjs_pensiun_pekerja +
                pot_spsi + pot_pph21 + other_potongan;

            // [FIXED] KOREKSI is deducted from jumlah_upah_kotor (Potongan Upah Kotor section)
            // Use gaji_pokok_aktual (calculated earlier) for gross wage calculation
            const jumlah_upah_kotor = (gaji_pokok_aktual + total_tunjangan + total_premi) - pot_koreksi;

            // [NEW] Upah Kotor Pajak = Jumlah Upah Kotor + Astek + BPJS Kesehatan (untuk header/pajak)
            const upah_kotor_pajak = jumlah_upah_kotor + pot_astek_pekerja + pot_bpjs_kesehatan_pekerja;

            // [FIXED] PREMI_PPH is ADDED (+) to upah_bersih, not subtracted
            // Formula: upah_bersih = jumlah_upah_kotor - total_potongan + premi_pph
            const upah_bersih = jumlah_upah_kotor - total_potongan + pot_premi_pph;

            // [UPDATED] Calculate Ideal and Actual Salary for Penggajian Group
            // gaji_pokok_ideal = upah_dasar × jumlah_hk (HK aktual yang dijalani karyawan)
            // gaji_pokok_ideal already calculated above

            // koreksi_hk = gaji_pokok_aktual - gaji_pokok_ideal
            const koreksi_hk = gaji_pokok_aktual - gaji_pokok_ideal;

            // [NEW] Astek 0.84% calculation
            // Formula: (gaji_pokok_ideal + tunjangan_masa_kerja) * 0.84%
            const astek_084 = Math.round((gaji_pokok_ideal + empMasaKerjaJumlah) * 0.0084);

            // [NEW] Penghasilan Bruto calculation
            // Sum of: gaji_pokok_aktual + beras_jumlah + jabatan_jumlah + masa_kerja_jumlah + lembur_jumlah + total_premi
            // Using gaji_pokok_aktual (REAL salary), NOT gaji_pokok_ideal
            const penghasilan_bruto = gaji_pokok_aktual + berasJumlah + empJabatan + empMasaKerjaJumlah + empLembur.jumlah + total_premi;

            const statusPtkp = mapBerasRateToPTKP(berasRate);

            // [NEW] PPH21 TER calculation
            // Calculate TER rate and PPH21 amount based on penghasilan_bruto and status_ptkp
            const pph21TerResult = calculatePph21Ter(penghasilan_bruto, statusPtkp);
            const tarif_pajak_ter = pph21TerResult.rate_percent; // Rate as percentage (e.g., 5 for 5%)
            const pph21_ter = pph21TerResult.tax_amount;
            const row: PayrollRow = {
                nik: emp.emp_code,
                nama: emp.emp_name,
                jabatan_estate: empJobTitle,
                jenis_kelamin: emp.gender === "2" || emp.gender === "P" ? "P" : "L",
                status_ptkp: statusPtkp,
                kategori_ter: mapPTKPToTER(statusPtkp),
                loc_code: emp.loc_code,
                gang_code: emp.gang_code,
                upah_dasar: empUpahDasar,
                jumlah_hk: hk,
                total_jam_kerja: attData.total_hours,
                has_shortage: attData.shortage_count > 0,
                shortage_details: attData.shortage_details || [],
                shortage_total_hours: attData.shortage_total_hours || 0,
                hari_kerja,
                gaji_pokok,
                kehadiran: hari_kerja,
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
                lembur_jam: empLembur.jam,
                lembur_rate: empLemburJumlah > 0 && empLembur.jam > 0 ? empLemburJumlah / empLembur.jam : 0,
                lembur_jumlah: empLemburJumlah,
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
                pot_spsi,
                pot_pph21,
                pot_koreksi,
                premi_koreksi: pot_koreksi,
                potongan_upah_kotor_total: pot_koreksi,
                potongan_upah_kotor_details: {
                    koreksi: pot_koreksi,
                    ...koreksiVariations,
                    total: pot_koreksi
                },
                astek_084,
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
                upah_bersih,
                // REMOVED: premi: empPremi - causes double-counting in frontend
                // Individual premi fields are already added via ...empPremi below
                pot_astek: pot_astek_pekerja,
                pot_astek_pekerja: pot_astek_pekerja,
                pot_astek_maj: pot_astek_majikan,
                pot_bpjs_pekerja_total: pot_bpjs_kesehatan_pekerja + pot_bpjs_pensiun_pekerja,
                // Add individual koreksi variations as separate fields
                ...koreksiVariations,
                // Add dynamic potongan fields (PREMI_PPH, POTONGAN X, etc.) excluding static fields
                ...Object.fromEntries(
                    Object.entries(empPotongan).filter(([key]) =>
                        key !== "SPSI" && key !== "PPH21" && !key.startsWith("KOREKSI")
                    )
                ),
                ...empPremi,
                // [RESTORED] premi object for aggregation seeder compatibility
                premi: empPremi
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

    private async getEmployees(gangCondition: string, serverProfile?: string): Promise<EmployeeRow[]> {
        const db = serverProfile ? Database.getInstance(undefined, serverProfile) : this.db;
        const whereClause = gangCondition ? `WHERE ${gangCondition}` : "";
        const rows = await db.query<any>(`
            SELECT DISTINCT
                RTRIM(e.EmpCode) as emp_code,
                e.EmpName as emp_name,
                e.Gender as gender,
                RTRIM(e.LocCode) as loc_code,
                RTRIM(gl.GangCode) as gang_code,
                COALESCE(p.PayRate, 0) as pay_rate,
                COALESCE(p.RiceRation, 0) as beras_rate,
                em.AppJoinGrpDate as join_date
            FROM HR_EMPLOYEE e
            LEFT JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
            LEFT JOIN HR_PAYROLL p ON RTRIM(p.EmpCode) = RTRIM(e.EmpCode)
            LEFT JOIN HR_EMPLOYMENT em ON RTRIM(em.EmpCode) = RTRIM(e.EmpCode)
            ${whereClause}
            ORDER BY emp_code
        `);
        return rows.map((r: any) => ({
            emp_code: r.emp_code?.trim() || "",
            emp_name: r.emp_name?.trim() || "",
            gender: String(r.gender || "1"),
            loc_code: r.loc_code?.trim() || "",
            gang_code: r.gang_code?.trim() || "",
            pay_rate: r.pay_rate || 0,
            beras_rate: r.beras_rate || 0,
            join_date: r.join_date || null
        }));
    }

    private async getAttendance(empCodes: string[], startDate: string, endDate: string, serverProfile?: string): Promise<Record<string, {
        hk: number;
        total_hours: number;
        shortage_count: number;
        total_amount_rp: number;
        shortage_details: Array<{ date: string; day_name: string; actual_hours: number; target_hours: number; shortage_hours: number }>;
        shortage_total_hours: number;
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
                    shortage_total_hours: 0
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
                
                UNION ALL

                SELECT trl.EmpCode, trl.TrxDate
                FROM PR_TASKREGLN_ARC trl
                JOIN PR_TASKREG_ARC tr ON tr.ID = trl.MasterID
                WHERE RTRIM(trl.EmpCode) IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate < ?
                  AND trl.OT = 0
                  AND DATEPART(weekday, trl.TrxDate) = 1
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
    private async getPremi(empCodes: string[], startDate: string, endDate: string, serverProfile?: string): Promise<{ amounts: Record<string, Record<string, number>>; titleMap: Record<string, string> }> {
        if (!empCodes.length) return { amounts: {}, titleMap: {} };
        const db = serverProfile ? Database.getInstance(undefined, serverProfile) : this.db;
        const empList = empCodes.map(e => `'${e}'`).join(",");

        // Query DocDesc containing 'PREMI' but EXCLUDE those containing 'PPH'
        // DocDesc will be used as column header
        // Also EXCLUDE TaskDesc = 'ACCRUALS-CHECKROLL' (Premi PPH diambil dari query terpisah)
        let rows = await db.query<{ emp_code: string; doc_desc: string; amount: number }>(`
            SELECT RTRIM(t.EmpCode) as emp_code, t.DocDesc as doc_desc, SUM(ln.Amount) as amount
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
                  UPPER(t.DocDesc) LIKE '%PREMI%' OR
                  UPPER(t.DocDesc) LIKE '%PRUN%' OR
                  UPPER(t.DocDesc) LIKE '%INSENTIF%' OR
                  UPPER(t.DocDesc) LIKE '%PANEN%' OR
                  UPPER(t.DocDesc) LIKE '%KINERJA%' OR
                  UPPER(t.DocDesc) LIKE '%RAWAT%'
              )
              AND UPPER(t.DocDesc) NOT LIKE '%PPH%'
              AND (mt.TaskDesc IS NULL OR mt.TaskDesc <> 'ACCRUALS-CHECKROLL')
              AND ln.Amount > 0
            GROUP BY RTRIM(t.EmpCode), t.DocDesc
        `, [startDate, endDate, startDate, endDate]);

        const amounts: Record<string, Record<string, number>> = {};
        const titleMap: Record<string, string> = {}; // key (normalized) -> DocDesc (original)

        for (const r of rows) {
            const emp = r.emp_code?.trim() || "";
            if (!amounts[emp]) amounts[emp] = {};
            const key = this.normalizePremiName(r.doc_desc || "");
            amounts[emp][key] = (amounts[emp][key] || 0) + (r.amount || 0);

            // Store DocDesc as title for dynamic headers
            if (!titleMap[key]) {
                titleMap[key] = r.doc_desc?.trim() || key;
            }
        }

        return { amounts, titleMap };
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
        let rows = await db.query<{ emp_code: string; doc_desc: string; task_desc: string | null; amount: number }>(`
            SELECT
                RTRIM(t.EmpCode) as emp_code,
                t.DocDesc as doc_desc,
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
                -- REMOVED: %TIKET% - Premi Tiket adalah TUNJANGAN/PREMI, bukan POTONGAN
                -- OR UPPER(t.DocDesc) LIKE '%TIKET%'
                OR UPPER(t.DocDesc) LIKE '%KONTAN%'
                OR UPPER(t.DocDesc) LIKE '%ALAT%'
                OR UPPER(t.DocDesc) LIKE '%THR%'
            )
            GROUP BY RTRIM(t.EmpCode), t.DocDesc, mt.TaskDesc
        `, [startDate, endDate, startDate, endDate]);

        const amounts: Record<string, Record<string, number>> = {};
        const titleMap: Record<string, string> = {};

        for (const r of rows) {
            const emp = r.emp_code?.trim() || "";
            if (!amounts[emp]) amounts[emp] = {};

            // [REMOVED] The check for PREMI in TaskDesc was incorrect
            // Real PREMI_PPH items (TaskDesc='ACCRUALS-CHECKROLL') are handled by separate query below
            // Items with TaskDesc like '(DE) POTONGAN PREMI' should be processed normally based on DocDesc

            const { key, title } = this.normalizePotonganName(r.doc_desc || "");
            amounts[emp][key] = (amounts[emp][key] || 0) + Math.abs(r.amount || 0);
            // Store title mapping for dynamic headers
            if (!titleMap[key]) {
                titleMap[key] = title;
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
                  AND trl.TrxDate >= ? AND trl.TrxDate < ?
                  AND trl.OT = 1
                
                UNION ALL

                SELECT trl.EmpCode, trl.Hours, trl.Amount
                FROM PR_TASKREGLN_ARC trl
                JOIN PR_TASKREG_ARC tr ON tr.ID = trl.MasterID
                WHERE RTRIM(trl.EmpCode) IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate < ?
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
     * Get additional beras amount from DocDesc containing 'BERAS'
     * This is added on top of the standard beras_rate * HK calculation
     */
    private async getBerasFromDocDesc(empCodes: string[], startDate: string, endDate: string, serverProfile?: string): Promise<Record<string, number>> {
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
                  AND UPPER(t.DocDesc) LIKE '%BERAS%'
                  AND ln.Amount > 0

                UNION ALL

                SELECT t.EmpCode, ln.Amount
                FROM PR_ADTRANS_ARC t
                JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
                WHERE RTRIM(t.EmpCode) IN (${empList})
                  AND t.DocDate >= ? AND t.DocDate < ?
                  AND UPPER(t.DocDesc) LIKE '%BERAS%'
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

        let rows = await db.query<{ emp_code: string; total: number }>(`
            SELECT RTRIM(EmpCode) as emp_code, SUM(Amount) as total
            FROM (
                SELECT t.EmpCode, ln.Amount
                FROM PR_ADTRANS t
                JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
                WHERE RTRIM(t.EmpCode) IN (${empList})
                  AND t.DocDate >= ? AND t.DocDate < ?
                  AND UPPER(t.DocDesc) LIKE '%LEMBUR%'
                  AND ln.Amount > 0

                UNION ALL

                SELECT t.EmpCode, ln.Amount
                FROM PR_ADTRANS_ARC t
                JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
                WHERE RTRIM(t.EmpCode) IN (${empList})
                  AND t.DocDate >= ? AND t.DocDate < ?
                  AND UPPER(t.DocDesc) LIKE '%LEMBUR%'
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

    private async getUpahPokok(empCodes: string[], serverProfile?: string): Promise<Record<string, number>> {
        if (!empCodes.length) return {};
        const db = serverProfile ? Database.getInstance(undefined, serverProfile) : this.db;
        const empList = empCodes.map(e => `'${e}'`).join(",");

        const rows = await db.query<{ emp_code: string; upah_dasar: number }>(`
            WITH LatestCPTRX AS (
                SELECT EmpCode, NewRate, ROW_NUMBER() OVER (PARTITION BY EmpCode ORDER BY UpdateDate DESC) as rn
                FROM HR_CPTRX
            )
            SELECT RTRIM(e.EmpCode) as emp_code, COALESCE(lc.NewRate, 0) as upah_dasar
            FROM HR_EMPLOYEE e
            LEFT JOIN LatestCPTRX lc ON RTRIM(lc.EmpCode) = RTRIM(e.EmpCode) AND lc.rn = 1
            WHERE RTRIM(e.EmpCode) IN (${empList})
        `);

        const result: Record<string, number> = {};
        for (const r of rows) {
            result[r.emp_code?.trim() || ""] = r.upah_dasar || 0;
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

    private normalizePotonganName(docDesc: string): { key: string; title: string } {
        const upper = docDesc.toUpperCase().trim();
        const cleanTitle = docDesc.trim();

        // [RULE 1] Handle KOREKSI variations separately
        // Pattern: KOREKSI, KOREKSI A, KOREKSI PANEN, KOREKSI X, etc.
        // Each variation becomes a separate key for display in POTONGAN UPAH KOTOR
        if (upper.includes("KOREKSI")) {
            // Use the full DocDesc as the key, normalized
            const key = upper.replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
            return { key, title: cleanTitle };
        }

        // [RULE 2] Static: PPH (but NOT if it contains PREMI - handled earlier)
        if (upper.includes("PPH") || upper.includes("PAJAK")) {
            // Double check: if contains PREMI, don't treat as PPH21
            if (upper.includes("PREMI")) {
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
        if (upper.startsWith("POTONGAN") || upper.startsWith("POT ") || upper.startsWith("POT_")) {
            const key = upper.replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
            return { key, title: cleanTitle };
        }

        // [RULE 5] Default: Use DocDesc as title, normalized key for field name
        const key = upper.replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
        return { key, title: cleanTitle };
    }

    private async getBrondol(empCodes: string[], startDate: string, endDate: string, serverProfile?: string): Promise<Record<string, number>> {
        if (!empCodes.length) return {};
        const db = serverProfile ? Database.getInstance(undefined, serverProfile) : this.db;
        const empList = empCodes.map(e => `'${e}'`).join(",");

        let rows = await db.query<{ emp_code: string; total: number }>(`
            SELECT RTRIM(EmpCode) as emp_code, SUM(Amount) as total
            FROM (
                SELECT LFLN.EmpCode, LFLN.Amount
                FROM PR_LOOSEFRUIT LF
                JOIN PR_LOOSEFRUITLN LFLN ON LF.ID = LFLN.MasterID
                WHERE RTRIM(LFLN.EmpCode) IN (${empList})
                  AND LF.DocDate >= ? AND LF.DocDate < ?
                
                UNION ALL

                SELECT LFLN.EmpCode, LFLN.Amount
                FROM PR_LOOSEFRUIT_ARC LF
                JOIN PR_LOOSEFRUITLN_ARC LFLN ON LF.ID = LFLN.MasterID
                WHERE RTRIM(LFLN.EmpCode) IN (${empList})
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
}

export const dataExtractorService = DataExtractorService.getInstance();
