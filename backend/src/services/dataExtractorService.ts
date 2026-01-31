import { Database } from "../db/client";
import { payrollService } from "./payrollService";
import { gangService } from "./gangService";
import { lemburCalculator } from "./lemburCalculator";
import { EmployeeEstateService } from "./employeeEstateService";

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
    jabatan_estate?: string; // [NEW] Job Title from auxiliary table
    jenis_kelamin: string;
    loc_code: string;
    gang_code: string;
    upah_dasar: number;
    jumlah_hk: number;
    total_jam_kerja: number; // [NEW] Total hours for the period
    has_shortage?: boolean; // [NEW] Flag for short working hours
    shortage_details?: ShortageDetail[]; // [NEW] Details of shortage days
    shortage_total_hours?: number; // [NEW] Total shortage hours
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
    // Other deductions
    pot_spsi: number;
    pot_pph21: number;
    pot_koreksi: number;
    premi_koreksi: number;
    total_potongan: number;
    upah_bersih: number;
    [key: string]: any;
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

        let gangCondition = "";
        if (specificEmpCode) {
            gangCondition = `RTRIM(e.EmpCode) = '${specificEmpCode.trim()}'`;
        } else if (gangCode && gangCode !== "ALL") {
            gangCondition = `RTRIM(LTRIM(gl.GangCode)) = '${gangCode.trim()}'`;
        } else if (divisionCode) {
            const gangs = await gangService.fetchGangs(divisionCode);
            if (gangs.length > 0) {
                const conditions = gangs.map((gang: { gang_code: string }) => `RTRIM(LTRIM(gl.GangCode)) = '${gang.gang_code}'`).join(' OR ');
                gangCondition = `(${conditions})`;
            } else {
                gangCondition = "1=0";
            }
        }

        const startTotal = performance.now();
        const employees = await this.getEmployees(gangCondition, serverProfile);
        console.log(`[Perf] GetEmployees: ${employees.length} rows in ${(performance.now() - startTotal).toFixed(2)}ms`);

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
        const [attendanceMap, cuti, premiResult, potonganResult, lembur, beras, jabatan, masaKerja, upahPokok, brondol, jobTitles] = await Promise.all([
            this.getAttendance(empCodes, startDate, endDate, serverProfile).then(res => { console.log(`[Perf] Attendance: ${(performance.now() - startParallel).toFixed(2)}ms`); return res; }),
            this.getCuti(empCodes, startDate, endDate, serverProfile).then(res => { console.log(`[Perf] Cuti: ${(performance.now() - startParallel).toFixed(2)}ms`); return res; }),
            this.getPremi(empCodes, startDate, endDate, serverProfile).then(res => { console.log(`[Perf] Premi: ${(performance.now() - startParallel).toFixed(2)}ms`); return res; }),
            this.getPotongan(empCodes, startDate, endDate, serverProfile).then(res => { console.log(`[Perf] Potongan: ${(performance.now() - startParallel).toFixed(2)}ms`); return res; }),
            this.getLemburDetailsFromCalculator(empCodes, month, year, serverProfile).then(res => { console.log(`[Perf] LemburCalc: ${(performance.now() - startParallel).toFixed(2)}ms`); return res; }),

            this.getTunjanganAmount(empCodes, startDate, endDate, "BERAS", serverProfile).then(res => { console.log(`[Perf] Beras: ${(performance.now() - startParallel).toFixed(2)}ms`); return res; }),
            this.getTunjanganAmount(empCodes, startDate, endDate, "JABATAN", serverProfile).then(res => { console.log(`[Perf] Jabatan: ${(performance.now() - startParallel).toFixed(2)}ms`); return res; }),
            this.getTunjanganAmount(empCodes, startDate, endDate, "MASA%KERJA", serverProfile).then(res => { console.log(`[Perf] MasaKerja: ${(performance.now() - startParallel).toFixed(2)}ms`); return res; }),
            this.getUpahPokok(empCodes, serverProfile).then(res => { console.log(`[Perf] UpahPokok: ${(performance.now() - startParallel).toFixed(2)}ms`); return res; }),
            this.getBrondol(empCodes, startDate, endDate, serverProfile).then(res => { console.log(`[Perf] Brondol: ${(performance.now() - startParallel).toFixed(2)}ms`); return res; }),

            EmployeeEstateService.getEmployeeJobs().then(res => { console.log(`[Perf] JobTitles: ${(performance.now() - startParallel).toFixed(2)}ms`); return res; })
        ]);
        console.log(`[Perf] ParallelFetch Total: ${(performance.now() - startParallel).toFixed(2)}ms`);

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
            if (hk === 0) continue;

            const empCuti = cuti[emp.emp_code] || { cuti_tahunan: 0, cuti_sakit_haid: 0, cuti_minggu: 0, cuti_nasional: 0 };
            const empPremi = premi[emp.emp_code] || {};
            const empPotongan = potongan[emp.emp_code] || {};
            const empLembur = lembur[emp.emp_code] || { jam: 0, jumlah: 0 };
            const empBeras = beras[emp.emp_code] || 0;
            const empJabatan = jabatan[emp.emp_code] || 0;
            const empMasaKerjaJumlah = masaKerja[emp.emp_code] || 0;
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
            const berasJumlah = berasRate > 0 && hk > 0 ? berasRate * hk : 0;

            const jabatanRate = hk > 0 && empJabatan > 0 ? empJabatan / hk : 0;
            const masaKerjaRate = hk > 0 && empMasaKerjaJumlah > 0 ? empMasaKerjaJumlah / hk : 0;

            const gaji_pokok = upah_pokok;
            const total_tunjangan = berasJumlah + empJabatan + empMasaKerjaJumlah + empLembur.jumlah;

            empPremi["brondol"] = (empPremi["brondol"] || 0) + empBrondol;

            let total_premi = 0;
            for (const [key, val] of Object.entries(empPremi)) {
                if (key !== "koreksi") {
                    total_premi += val as number;
                }
                if (key !== "brondol" && key !== "koreksi") {
                    dynamicPremiSet.add(key);
                }
            }

            const pot_spsi = Math.abs(empPotongan["SPSI"] || 0);
            const pot_pph21 = Math.abs(empPotongan["PPH21"] || 0);
            const pot_koreksi = Math.abs(empPotongan["KOREKSI"] || 0);

            let other_potongan = 0;
            let db_bpjs_kes = 0;

            for (const [key, val] of Object.entries(empPotongan)) {
                if (key === "SPSI" || key === "PPH21" || key === "KOREKSI") continue;

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

            const total_potongan = pot_astek_pekerja + pot_bpjs_kesehatan_pekerja + pot_bpjs_pensiun_pekerja +
                pot_spsi + pot_pph21 + other_potongan + pot_koreksi;

            const jumlah_upah_kotor = (gaji_pokok + total_tunjangan + total_premi) - pot_koreksi;
            const upah_bersih = jumlah_upah_kotor - total_potongan;

            const row: PayrollRow = {
                nik: emp.emp_code,
                nama: emp.emp_name,
                jabatan_estate: empJobTitle,
                jenis_kelamin: emp.gender === "2" || emp.gender === "P" ? "P" : "L",
                loc_code: emp.loc_code,
                gang_code: emp.gang_code,
                upah_dasar: empUpahDasar,
                jumlah_hk: hk,
                total_jam_kerja: attData.total_hours,
                has_shortage: attData.shortage_count > 0, // [NEW] Map to boolean
                shortage_details: attData.shortage_details || [], // [NEW] Detailed shortage info
                shortage_total_hours: attData.shortage_total_hours || 0, // [NEW] Total shortage hours
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
                lembur_rate: empLembur.jumlah > 0 && empLembur.jam > 0 ? empLembur.jumlah / empLembur.jam : 0,
                lembur_jumlah: empLembur.jumlah,
                total_tunjangan,
                premi_brondol: empBrondol,
                upah_pokok,
                total_premi,
                jumlah_upah_kotor,
                pot_astek_pekerja,
                pot_astek_majikan,
                pot_astek_jumlah,
                pot_bpjs_kesehatan_pekerja,
                pot_bpjs_kesehatan_majikan,
                pot_bpjs_kesehatan_jumlah,
                pot_bpjs_pensiun_pekerja,
                pot_bpjs_pensiun_majikan,
                pot_bpjs_pensiun_jumlah,
                pot_spsi,
                pot_pph21,
                pot_koreksi,
                premi_koreksi: pot_koreksi,
                potongan_upah_kotor_total: pot_koreksi,
                total_potongan,
                total_potongan_bersih: total_potongan,
                upah_bersih,
                premi: empPremi,
                pot_astek: pot_astek_pekerja,
                pot_astek_maj: pot_astek_majikan,
                pot_bpjs_pekerja_total: pot_bpjs_kesehatan_pekerja + pot_bpjs_pensiun_pekerja,
                ...empPremi
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
                e.EmpCode as emp_code,
                e.EmpName as emp_name,
                e.Gender as gender,
                e.LocCode as loc_code,
                gl.GangCode as gang_code,
                COALESCE(p.PayRate, 0) as pay_rate,
                COALESCE(p.RiceRation, 0) as beras_rate,
                em.AppJoinGrpDate as join_date
            FROM HR_EMPLOYEE e
            LEFT JOIN HR_GANGLN gl ON gl.GangMember = e.EmpCode
            LEFT JOIN HR_PAYROLL p ON p.EmpCode = e.EmpCode
            LEFT JOIN HR_EMPLOYMENT em ON em.EmpCode = e.EmpCode
            ${whereClause}
            ORDER BY e.EmpCode
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
            SELECT RTRIM(trl.EmpCode) as emp_code, COUNT(*) as hk, SUM(trl.Hours) as total_hours,
                   ${shortageSql},
                   SUM(trl.Amount) as total_amount_rp
            FROM PR_TASKREGLN trl
            JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
            WHERE RTRIM(trl.EmpCode) IN (${empList})
              AND trl.TrxDate >= ? AND trl.TrxDate < ?
              AND trl.OT = 0
            GROUP BY RTRIM(trl.EmpCode)

            UNION ALL

            SELECT RTRIM(trl.EmpCode) as emp_code, COUNT(*) as hk, SUM(trl.Hours) as total_hours,
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
    private async getPremi(empCodes: string[], startDate: string, endDate: string, serverProfile?: string): Promise<{ amounts: Record<string, Record<string, number>>; titleMap: Record<string, string> }> {
        if (!empCodes.length) return { amounts: {}, titleMap: {} };
        const db = serverProfile ? Database.getInstance(undefined, serverProfile) : this.db;
        const empList = empCodes.map(e => `'${e}'`).join(",");

        // Query DocDesc containing 'PREMI' - DocDesc will be used as column header
        let rows = await db.query<{ emp_code: string; doc_desc: string; amount: number }>(`
            SELECT RTRIM(EmpCode) as emp_code, DocDesc as doc_desc, SUM(Amount) as amount
            FROM (
                SELECT t.EmpCode, t.DocDesc, ln.Amount
                FROM PR_ADTRANS t
                JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
                WHERE RTRIM(t.EmpCode) IN (${empList})
                  AND t.DocDate >= ? AND t.DocDate < ?
                  AND UPPER(t.DocDesc) LIKE 'PREMI%'
                  AND ln.Amount > 0
                
                UNION ALL

                SELECT t.EmpCode, t.DocDesc, ln.Amount
                FROM PR_ADTRANS_ARC t
                JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
                WHERE RTRIM(t.EmpCode) IN (${empList})
                  AND t.DocDate >= ? AND t.DocDate < ?
                  AND UPPER(t.DocDesc) LIKE 'PREMI%'
                  AND ln.Amount > 0
            ) combined
            GROUP BY RTRIM(EmpCode), DocDesc
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

        // [REFACTORED] Query based on TaskDesc from PR_TASKCODE instead of DocDesc
        // Static: PPH, SPSI
        // Dynamic: POTONGAN (excluding PPH/SPSI)
        let rows = await db.query<{ emp_code: string; task_desc: string; amount: number }>(`
            SELECT RTRIM(t.EmpCode) as emp_code, mt.TaskDesc as task_desc, SUM(COALESCE(ln.Amount, 0)) as amount
            FROM (
                SELECT t.EmpCode, t.ID, t.DocDate
                FROM PR_ADTRANS t
                WHERE RTRIM(t.EmpCode) IN (${empList})
                  AND t.DocDate >= ? AND t.DocDate < ?
                
                UNION ALL

                SELECT t.EmpCode, t.ID, t.DocDate
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
            WHERE mt.TaskDesc IS NOT NULL
              AND (
                UPPER(mt.TaskDesc) LIKE '%PPH%'
                OR UPPER(mt.TaskDesc) LIKE '%SPSI%'
                OR UPPER(mt.TaskDesc) LIKE '%POTONGAN%'
              )
            GROUP BY RTRIM(t.EmpCode), mt.TaskDesc
        `, [startDate, endDate, startDate, endDate]);

        const amounts: Record<string, Record<string, number>> = {};
        const titleMap: Record<string, string> = {};

        for (const r of rows) {
            const emp = r.emp_code?.trim() || "";
            if (!amounts[emp]) amounts[emp] = {};
            const { key, title } = this.normalizePotonganName(r.task_desc || "");
            amounts[emp][key] = (amounts[emp][key] || 0) + Math.abs(r.amount || 0);
            // Store title mapping for dynamic headers
            if (!titleMap[key]) {
                titleMap[key] = title;
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

    private normalizePotonganName(taskDesc: string): { key: string; title: string } {
        const upper = taskDesc.toUpperCase().trim();
        const cleanTitle = taskDesc.trim();

        // Static: PPH
        if (upper.includes("PPH") || upper.includes("PAJAK")) {
            return { key: "PPH21", title: "PPH21" };
        }
        // Static: SPSI
        if (upper.includes("SPSI")) {
            return { key: "SPSI", title: "SPSI" };
        }
        // Static: KOREKSI (should not happen with TaskDesc, but keep for safety)
        if (upper.includes("KOREKSI")) {
            return { key: "KOREKSI", title: "KOREKSI" };
        }
        // Dynamic: Use TaskDesc as title, normalized key for field name
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
