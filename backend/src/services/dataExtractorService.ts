import { Database } from "../db/client";
import { payrollService } from "./payrollService";
import { gangService } from "./gangService";

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

interface PayrollRow {
    nik: string;
    nama: string;
    jenis_kelamin: string;
    loc_code: string;
    gang_code: string;
    upah_dasar: number;
    jumlah_hk: number;
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
        divisionCode?: string
    ): Promise<{
        data_rows: PayrollRow[];
        dynamic_premi_headers: string[];
        dynamic_potongan_headers: string[];
        meta: { execution_time_ms: number; row_count: number }
    }> {
        const startTime = Date.now();
        const startDate = `${year}-${month.toString().padStart(2, "0")}-01`;
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        const endDate = `${nextYear}-${nextMonth.toString().padStart(2, "0")}-01`;

        let gangCondition = "";
        if (gangCode && gangCode !== "ALL") {
            // Match Python: RTRIM(LTRIM(gl.GangCode)) = ?
            gangCondition = `RTRIM(LTRIM(gl.GangCode)) = '${gangCode.trim()}'`;
        } else if (divisionCode) {
            // Get all gang codes for this division from gangService (matches Python approach)
            const gangs = await gangService.fetchGangs(divisionCode);
            if (gangs.length > 0) {
                const conditions = gangs.map((gang: { gang_code: string }) => `RTRIM(LTRIM(gl.GangCode)) = '${gang.gang_code}'`).join(' OR ');
                gangCondition = `(${conditions})`;
            } else {
                gangCondition = "1=0"; // No gangs found, return no employees
            }
        }

        const employees = await this.getEmployees(gangCondition);
        if (employees.length === 0) {
            return {
                data_rows: [],
                dynamic_premi_headers: [],
                dynamic_potongan_headers: [],
                meta: { execution_time_ms: Date.now() - startTime, row_count: 0 }
            };
        }

        const empCodes = employees.map(e => e.emp_code);

        const [attendance, cuti, premi, potongan, lembur, beras, jabatan, masaKerja, upahPokok, brondol] = await Promise.all([
            this.getAttendance(empCodes, startDate, endDate),
            this.getCuti(empCodes, startDate, endDate),
            this.getPremi(empCodes, startDate, endDate),
            this.getPotongan(empCodes, startDate, endDate),
            this.getLemburDetails(empCodes, startDate, endDate),
            this.getTunjanganAmount(empCodes, startDate, endDate, "BERAS"),
            this.getTunjanganAmount(empCodes, startDate, endDate, "JABATAN"),
            this.getTunjanganAmount(empCodes, startDate, endDate, "MASA%KERJA"),
            this.getUpahPokok(empCodes),
            this.getBrondol(empCodes, startDate, endDate)
        ]);

        const dataRows: PayrollRow[] = [];
        const dynamicPremiSet = new Set<string>();
        const dynamicPotonganSet = new Set<string>();

        for (const emp of employees) {
            const hk = attendance[emp.emp_code] || 0;
            if (hk === 0) continue;

            const empCuti = cuti[emp.emp_code] || { cuti_tahunan: 0, cuti_sakit_haid: 0, cuti_minggu: 0, cuti_nasional: 0 };
            const empPremi = premi[emp.emp_code] || {};
            const empPotongan = potongan[emp.emp_code] || {};
            const empLembur = lembur[emp.emp_code] || { jam: 0, jumlah: 0 };
            const empBeras = beras[emp.emp_code] || 0;
            const empJabatan = jabatan[emp.emp_code] || 0;
            const empMasaKerjaJumlah = masaKerja[emp.emp_code] || 0;
            const empUpahDasar = upahPokok[emp.emp_code] || emp.pay_rate || 0;

            const totalCuti = empCuti.cuti_tahunan + empCuti.cuti_sakit_haid + empCuti.cuti_minggu + empCuti.cuti_nasional;
            const hari_kerja = Math.max(0, hk - totalCuti);

            // Calculate upah_pokok = hari_kerja × upah_dasar
            const upah_pokok = hari_kerja * empUpahDasar;

            // Get brondol amount
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

            // Calculate beras: Always use rate × HK formula
            const berasRate = emp.beras_rate > 0 ? emp.beras_rate : 0;
            const berasJumlah = berasRate > 0 && hk > 0 ? berasRate * hk : 0;

            // Calculate jabatan and masa kerja rates
            const jabatanRate = hk > 0 && empJabatan > 0 ? empJabatan / hk : 0;
            const masaKerjaRate = hk > 0 && empMasaKerjaJumlah > 0 ? empMasaKerjaJumlah / hk : 0;

            const gaji_pokok = payrollService.calculateGajiPokok(empUpahDasar, hk);
            const total_tunjangan = berasJumlah + empJabatan + empMasaKerjaJumlah + empLembur.jumlah;

            let total_premi = 0;
            for (const [key, val] of Object.entries(empPremi)) {
                total_premi += val as number;
                dynamicPremiSet.add(key);
            }

            // Calculate total potongan (only pekerja portions + other deductions)
            const pot_spsi = Math.abs(empPotongan["SPSI"] || 0);
            const pot_pph21 = Math.abs(empPotongan["PPH21"] || 0);
            const pot_koreksi = Math.abs(empPotongan["KOREKSI"] || 0);

            // Sum other dynamic potongan
            let other_potongan = 0;
            let db_bpjs_kes = 0; // Accumulated BPJS from DocDesc (transaction data)

            for (const [key, val] of Object.entries(empPotongan)) {
                // Skip static columns
                if (key === "SPSI" || key === "PPH21" || key === "KOREKSI") continue;

                // Handle BPJS from transactions (DocDesc)
                // Logic matches Python: Add to BPJS Kesehatan Pekerja, exclude from 'other'
                if (key.includes("BPJS")) {
                    // Exclude Majikan portions from this manual addition (formula only)
                    if (!key.includes("MAJIKAN") && !key.includes("MAJ")) {
                        db_bpjs_kes += Math.abs(val as number);
                    }
                    continue; // Skip adding to other_potongan
                }

                other_potongan += Math.abs(val as number);
                dynamicPotonganSet.add(key);
            }

            // Calculate BPJS/ASTEK based on formula
            // Base = (upah_dasar × 30) + masa_kerja_jumlah
            const carumanBase = (empUpahDasar * 30) + empMasaKerjaJumlah;

            // Caruman ASTEK: Pekerja 2%, Majikan 4.54%
            const pot_astek_pekerja = Math.round(carumanBase * 0.02 * 100) / 100;
            const pot_astek_majikan = Math.round(carumanBase * 0.0454 * 100) / 100;
            const pot_astek_jumlah = Math.round((pot_astek_pekerja + pot_astek_majikan) * 100) / 100;

            // BPJS Kesehatan: Pekerja 1%, Majikan 4%
            const pot_bpjs_kesehatan_pekerja_formula = Math.round(carumanBase * 0.01 * 100) / 100;
            const pot_bpjs_kesehatan_pekerja = pot_bpjs_kesehatan_pekerja_formula + db_bpjs_kes;

            const pot_bpjs_kesehatan_majikan = Math.round(carumanBase * 0.04 * 100) / 100;
            const pot_bpjs_kesehatan_jumlah = Math.round((pot_bpjs_kesehatan_pekerja + pot_bpjs_kesehatan_majikan) * 100) / 100;

            // BPJS Pensiun: Pekerja 1%, Majikan 2%
            const pot_bpjs_pensiun_pekerja = Math.round(carumanBase * 0.01 * 100) / 100;
            const pot_bpjs_pensiun_majikan = Math.round(carumanBase * 0.02 * 100) / 100;
            const pot_bpjs_pensiun_jumlah = Math.round((pot_bpjs_pensiun_pekerja + pot_bpjs_pensiun_majikan) * 100) / 100;

            // Total potongan = ASTEK pekerja + BPJS Kesehatan pekerja (updated) + BPJS Pensiun pekerja + SPSI + PPH21 + other
            const total_potongan = pot_astek_pekerja + pot_bpjs_kesehatan_pekerja + pot_bpjs_pensiun_pekerja +
                pot_spsi + pot_pph21 + other_potongan + pot_koreksi;

            const jumlah_upah_kotor = (gaji_pokok + total_tunjangan + total_premi) - pot_koreksi;
            const upah_bersih = jumlah_upah_kotor - total_potongan;

            const row: PayrollRow = {
                nik: emp.emp_code,
                nama: emp.emp_name,
                jenis_kelamin: emp.gender === "2" || emp.gender === "P" ? "P" : "L",
                loc_code: emp.loc_code,
                gang_code: emp.gang_code,
                upah_dasar: empUpahDasar,
                jumlah_hk: hk,
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
                // Caruman ASTEK
                pot_astek_pekerja,
                pot_astek_majikan,
                pot_astek_jumlah,
                // BPJS Kesehatan
                pot_bpjs_kesehatan_pekerja,
                pot_bpjs_kesehatan_majikan,
                pot_bpjs_kesehatan_jumlah,
                // BPJS Pensiun
                pot_bpjs_pensiun_pekerja,
                pot_bpjs_pensiun_majikan,
                pot_bpjs_pensiun_jumlah,
                // Other deductions
                pot_spsi,
                pot_pph21,
                pot_koreksi,
                premi_koreksi: pot_koreksi,
                potongan_upah_kotor_total: pot_koreksi,
                total_potongan,
                total_potongan_bersih: total_potongan, // Frontend expects this field name
                upah_bersih,
                // Frontend compatibility aliases
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
            meta: {
                execution_time_ms: Date.now() - startTime,
                row_count: dataRows.length
            }
        };
    }

    private async getEmployees(gangCondition: string): Promise<EmployeeRow[]> {
        const whereClause = gangCondition ? `WHERE ${gangCondition}` : "";
        const rows = await this.db.query<any>(`
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
            JOIN HR_GANGLN gl ON gl.GangMember = e.EmpCode
            LEFT JOIN HR_PAYROLL p ON p.EmpCode = e.EmpCode
            LEFT JOIN HR_EMPLOYMENT em ON em.EmpCode = e.EmpCode
            ${whereClause}
            ORDER BY e.EmpName
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

    private async getAttendance(empCodes: string[], startDate: string, endDate: string): Promise<Record<string, number>> {
        if (!empCodes.length) return {};
        const empList = empCodes.map(e => `'${e}'`).join(",");
        let rows = await this.db.query<{ emp_code: string; hk: number }>(`
            SELECT trl.EmpCode as emp_code, COUNT(*) as hk
            FROM PR_TASKREGLN trl
            JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
            WHERE trl.EmpCode IN (${empList})
              AND trl.TrxDate >= ? AND trl.TrxDate < ?
              AND trl.OT = 0
            GROUP BY trl.EmpCode
        `, [startDate, endDate]);

        if (rows.length === 0) {
            rows = await this.db.query<{ emp_code: string; hk: number }>(`
                SELECT trl.EmpCode as emp_code, COUNT(*) as hk
                FROM PR_TASKREGLN_ARC trl
                JOIN PR_TASKREG_ARC tr ON tr.ID = trl.MasterID
                WHERE trl.EmpCode IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate < ?
                  AND trl.OT = 0
                GROUP BY trl.EmpCode
            `, [startDate, endDate]);
        }

        const result: Record<string, number> = {};
        for (const r of rows) {
            result[r.emp_code?.trim() || ""] = r.hk || 0;
        }
        return result;
    }

    private async getCuti(empCodes: string[], startDate: string, endDate: string): Promise<Record<string, CutiData>> {
        if (!empCodes.length) return {};
        const empList = empCodes.map(e => `'${e}'`).join(",");

        // Initialize result
        const result: Record<string, CutiData> = {};
        for (const emp of empCodes) {
            result[emp] = { cuti_tahunan: 0, cuti_sakit_haid: 0, cuti_minggu: 0, cuti_nasional: 0 };
        }

        // Query cuti tahunan and sakit (by TaskCode)
        let cutiTaskRows = await this.db.query<{ emp_code: string; cuti_tahunan: number; cuti_sakit_haid: number }>(`
            SELECT
                trl.EmpCode as emp_code,
                SUM(CASE WHEN trl.TaskCode LIKE 'GA9129%' THEN 1 ELSE 0 END) as cuti_tahunan,
                SUM(CASE WHEN trl.TaskCode LIKE 'GA9126%' THEN 1 ELSE 0 END) as cuti_sakit_haid
            FROM PR_TASKREGLN trl
            JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
            WHERE trl.EmpCode IN (${empList})
              AND trl.TrxDate >= ? AND trl.TrxDate < ?
              AND trl.OT = 0
              AND (trl.TaskCode LIKE 'GA9129%' OR trl.TaskCode LIKE 'GA9126%')
            GROUP BY trl.EmpCode
        `, [startDate, endDate]);

        if (cutiTaskRows.length === 0) {
            cutiTaskRows = await this.db.query<{ emp_code: string; cuti_tahunan: number; cuti_sakit_haid: number }>(`
                SELECT
                    trl.EmpCode as emp_code,
                    SUM(CASE WHEN trl.TaskCode LIKE 'GA9129%' THEN 1 ELSE 0 END) as cuti_tahunan,
                    SUM(CASE WHEN trl.TaskCode LIKE 'GA9126%' THEN 1 ELSE 0 END) as cuti_sakit_haid
                FROM PR_TASKREGLN_ARC trl
                JOIN PR_TASKREG_ARC tr ON tr.ID = trl.MasterID
                WHERE trl.EmpCode IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate < ?
                  AND trl.OT = 0
                  AND (trl.TaskCode LIKE 'GA9129%' OR trl.TaskCode LIKE 'GA9126%')
                GROUP BY trl.EmpCode
            `, [startDate, endDate]);
        }

        for (const r of cutiTaskRows) {
            const emp = r.emp_code?.trim() || "";
            if (result[emp]) {
                result[emp].cuti_tahunan = r.cuti_tahunan || 0;
                result[emp].cuti_sakit_haid = r.cuti_sakit_haid || 0;
            }
        }

        // Query cuti minggu (Sundays - DATEPART weekday = 1)
        let cutiMingguRows = await this.db.query<{ emp_code: string; cuti_minggu: number }>(`
            SELECT trl.EmpCode as emp_code, COUNT(DISTINCT trl.TrxDate) as cuti_minggu
            FROM PR_TASKREGLN trl
            JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
            WHERE trl.EmpCode IN (${empList})
              AND trl.TrxDate >= ? AND trl.TrxDate < ?
              AND trl.OT = 0
              AND DATEPART(weekday, trl.TrxDate) = 1
            GROUP BY trl.EmpCode
        `, [startDate, endDate]);

        if (cutiMingguRows.length === 0) {
            cutiMingguRows = await this.db.query<{ emp_code: string; cuti_minggu: number }>(`
                SELECT trl.EmpCode as emp_code, COUNT(DISTINCT trl.TrxDate) as cuti_minggu
                FROM PR_TASKREGLN_ARC trl
                JOIN PR_TASKREG_ARC tr ON tr.ID = trl.MasterID
                WHERE trl.EmpCode IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate < ?
                  AND trl.OT = 0
                  AND DATEPART(weekday, trl.TrxDate) = 1
                GROUP BY trl.EmpCode
            `, [startDate, endDate]);
        }

        for (const r of cutiMingguRows) {
            const emp = r.emp_code?.trim() || "";
            if (result[emp]) {
                result[emp].cuti_minggu = r.cuti_minggu || 0;
            }
        }

        // Query cuti nasional (National holidays - join HR_GPH)
        let cutiNasionalRows = await this.db.query<{ emp_code: string; cuti_nasional: number }>(`
            SELECT trl.EmpCode as emp_code, COUNT(DISTINCT trl.TrxDate) as cuti_nasional
            FROM PR_TASKREGLN trl
            JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
            JOIN HR_GPH h ON h.HolidayDate = trl.TrxDate
            WHERE trl.EmpCode IN (${empList})
              AND trl.TrxDate >= ? AND trl.TrxDate < ?
              AND trl.OT = 0
            GROUP BY trl.EmpCode
        `, [startDate, endDate]);

        if (cutiNasionalRows.length === 0) {
            cutiNasionalRows = await this.db.query<{ emp_code: string; cuti_nasional: number }>(`
                SELECT trl.EmpCode as emp_code, COUNT(DISTINCT trl.TrxDate) as cuti_nasional
                FROM PR_TASKREGLN_ARC trl
                JOIN PR_TASKREG_ARC tr ON tr.ID = trl.MasterID
                JOIN HR_GPH h ON h.HolidayDate = trl.TrxDate
                WHERE trl.EmpCode IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate < ?
                  AND trl.OT = 0
                GROUP BY trl.EmpCode
            `, [startDate, endDate]);
        }

        for (const r of cutiNasionalRows) {
            const emp = r.emp_code?.trim() || "";
            if (result[emp]) {
                result[emp].cuti_nasional = r.cuti_nasional || 0;
            }
        }

        return result;
    }

    private async getPremi(empCodes: string[], startDate: string, endDate: string): Promise<Record<string, Record<string, number>>> {
        if (!empCodes.length) return {};
        const empList = empCodes.map(e => `'${e}'`).join(",");
        let rows = await this.db.query<{ emp_code: string; doc_desc: string; amount: number }>(`
            SELECT t.EmpCode as emp_code, t.DocDesc as doc_desc, SUM(ln.Amount) as amount
            FROM PR_ADTRANS t
            JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
            WHERE t.EmpCode IN (${empList})
              AND t.DocDate >= ? AND t.DocDate < ?
              AND UPPER(t.DocDesc) LIKE 'PREMI%'
              AND ln.Amount > 0
            GROUP BY t.EmpCode, t.DocDesc
        `, [startDate, endDate]);

        if (rows.length === 0) {
            rows = await this.db.query<{ emp_code: string; doc_desc: string; amount: number }>(`
                SELECT t.EmpCode as emp_code, t.DocDesc as doc_desc, SUM(ln.Amount) as amount
                FROM PR_ADTRANS_ARC t
                JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
                WHERE t.EmpCode IN (${empList})
                  AND t.DocDate >= ? AND t.DocDate < ?
                  AND UPPER(t.DocDesc) LIKE 'PREMI%'
                  AND ln.Amount > 0
                GROUP BY t.EmpCode, t.DocDesc
            `, [startDate, endDate]);
        }

        const result: Record<string, Record<string, number>> = {};
        for (const r of rows) {
            const emp = r.emp_code?.trim() || "";
            if (!result[emp]) result[emp] = {};
            const key = this.normalizePremiName(r.doc_desc || "");
            result[emp][key] = (result[emp][key] || 0) + (r.amount || 0);
        }
        return result;
    }

    private async getPotongan(empCodes: string[], startDate: string, endDate: string): Promise<Record<string, Record<string, number>>> {
        if (!empCodes.length) return {};
        const empList = empCodes.map(e => `'${e}'`).join(",");

        // Query based on DocDesc patterns matching Python backend implementation
        let rows = await this.db.query<{ emp_code: string; doc_desc: string; amount: number }>(`
            SELECT t.EmpCode as emp_code, t.DocDesc as doc_desc, SUM(COALESCE(ln.Amount, 0)) as amount
            FROM PR_ADTRANS t
            JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
            WHERE t.EmpCode IN (${empList})
              AND t.DocDate >= ? AND t.DocDate < ?
              AND (UPPER(t.DocDesc) LIKE '%POT%'
                   OR UPPER(t.DocDesc) LIKE '%PPH%'
                   OR UPPER(t.DocDesc) LIKE '%BPJS%'
                   OR UPPER(t.DocDesc) LIKE '%PINJAM%'
                   OR UPPER(t.DocDesc) LIKE '%KL%'
                   OR UPPER(t.DocDesc) LIKE '%SPSI%'
                   OR UPPER(t.DocDesc) LIKE '%KOREKSI%'
                   OR UPPER(t.DocDesc) LIKE '%TOTAL%'
                   OR UPPER(t.DocDesc) LIKE '%TIKET%'
                   OR UPPER(t.DocDesc) LIKE '%KONTAN%'
                   OR UPPER(t.DocDesc) LIKE '%ALAT%'
                   OR UPPER(t.DocDesc) LIKE '%THR%')
            GROUP BY t.EmpCode, t.DocDesc
        `, [startDate, endDate]);

        if (rows.length === 0) {
            rows = await this.db.query<{ emp_code: string; doc_desc: string; amount: number }>(`
                SELECT t.EmpCode as emp_code, t.DocDesc as doc_desc, SUM(COALESCE(ln.Amount, 0)) as amount
                FROM PR_ADTRANS_ARC t
                JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
                WHERE t.EmpCode IN (${empList})
                  AND t.DocDate >= ? AND t.DocDate < ?
                  AND (UPPER(t.DocDesc) LIKE '%POT%'
                       OR UPPER(t.DocDesc) LIKE '%PPH%'
                       OR UPPER(t.DocDesc) LIKE '%BPJS%'
                       OR UPPER(t.DocDesc) LIKE '%PINJAM%'
                       OR UPPER(t.DocDesc) LIKE '%KL%'
                       OR UPPER(t.DocDesc) LIKE '%SPSI%'
                       OR UPPER(t.DocDesc) LIKE '%KOREKSI%'
                       OR UPPER(t.DocDesc) LIKE '%TOTAL%'
                       OR UPPER(t.DocDesc) LIKE '%TIKET%'
                       OR UPPER(t.DocDesc) LIKE '%KONTAN%'
                       OR UPPER(t.DocDesc) LIKE '%ALAT%'
                       OR UPPER(t.DocDesc) LIKE '%THR%')
                GROUP BY t.EmpCode, t.DocDesc
            `, [startDate, endDate]);
        }

        const result: Record<string, Record<string, number>> = {};
        for (const r of rows) {
            const emp = r.emp_code?.trim() || "";
            if (!result[emp]) result[emp] = {};
            const key = this.normalizePotonganName(r.doc_desc || "");
            result[emp][key] = (result[emp][key] || 0) + Math.abs(r.amount || 0);
        }
        return result;
    }

    private async getLemburDetails(empCodes: string[], startDate: string, endDate: string): Promise<Record<string, LemburData>> {
        if (!empCodes.length) return {};
        const empList = empCodes.map(e => `'${e}'`).join(",");

        let rows = await this.db.query<{ emp_code: string; total_hours: number; total_amount: number }>(`
            SELECT trl.EmpCode as emp_code, SUM(trl.Hours) as total_hours, SUM(trl.Amount) as total_amount
            FROM PR_TASKREGLN trl
            JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
            WHERE trl.EmpCode IN (${empList})
              AND trl.TrxDate >= ? AND trl.TrxDate < ?
              AND trl.OT = 1
            GROUP BY trl.EmpCode
        `, [startDate, endDate]);

        if (rows.length === 0) {
            rows = await this.db.query<{ emp_code: string; total_hours: number; total_amount: number }>(`
                SELECT trl.EmpCode as emp_code, SUM(trl.Hours) as total_hours, SUM(trl.Amount) as total_amount
                FROM PR_TASKREGLN_ARC trl
                JOIN PR_TASKREG_ARC tr ON tr.ID = trl.MasterID
                WHERE trl.EmpCode IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate < ?
                  AND trl.OT = 1
                GROUP BY trl.EmpCode
            `, [startDate, endDate]);
        }

        const result: Record<string, LemburData> = {};
        for (const r of rows) {
            result[r.emp_code?.trim() || ""] = {
                jam: r.total_hours || 0,
                jumlah: r.total_amount || 0
            };
        }
        return result;
    }

    private async getTunjanganAmount(empCodes: string[], startDate: string, endDate: string, tunjanganType: string): Promise<Record<string, number>> {
        if (!empCodes.length) return {};
        const empList = empCodes.map(e => `'${e}'`).join(",");

        let rows = await this.db.query<{ emp_code: string; total: number }>(`
            SELECT t.EmpCode as emp_code, SUM(ln.Amount) as total
            FROM PR_ADTRANS t
            JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
            WHERE t.EmpCode IN (${empList})
              AND t.DocDate >= ? AND t.DocDate < ?
              AND UPPER(t.DocDesc) LIKE '%${tunjanganType}%'
              AND ln.Amount > 0
            GROUP BY t.EmpCode
        `, [startDate, endDate]);

        if (rows.length === 0) {
            rows = await this.db.query<{ emp_code: string; total: number }>(`
                SELECT t.EmpCode as emp_code, SUM(ln.Amount) as total
                FROM PR_ADTRANS_ARC t
                JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
                WHERE t.EmpCode IN (${empList})
                  AND t.DocDate >= ? AND t.DocDate < ?
                  AND UPPER(t.DocDesc) LIKE '%${tunjanganType}%'
                  AND ln.Amount > 0
                GROUP BY t.EmpCode
            `, [startDate, endDate]);
        }

        const result: Record<string, number> = {};
        for (const r of rows) {
            result[r.emp_code?.trim() || ""] = r.total || 0;
        }
        return result;
    }

    private async getUpahPokok(empCodes: string[]): Promise<Record<string, number>> {
        if (!empCodes.length) return {};
        const empList = empCodes.map(e => `'${e}'`).join(",");

        const rows = await this.db.query<{ emp_code: string; upah_dasar: number }>(`
            WITH LatestCPTRX AS (
                SELECT EmpCode, NewRate, ROW_NUMBER() OVER (PARTITION BY EmpCode ORDER BY UpdateDate DESC) as rn
                FROM HR_CPTRX
            )
            SELECT e.EmpCode as emp_code, COALESCE(lc.NewRate, 0) as upah_dasar
            FROM HR_EMPLOYEE e
            LEFT JOIN LatestCPTRX lc ON lc.EmpCode = e.EmpCode AND lc.rn = 1
            WHERE e.EmpCode IN (${empList})
        `);

        const result: Record<string, number> = {};
        for (const r of rows) {
            result[r.emp_code?.trim() || ""] = r.upah_dasar || 0;
        }
        return result;
    }

    private normalizePremiName(docDesc: string): string {
        let name = docDesc.trim().toUpperCase()
            .replace(/^TUNJANGAN\s*PREMI\s*/i, "")
            .replace(/^PREMI\s*/i, "");
        return `premi_${name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")}`;
    }

    private normalizePotonganName(docDesc: string): string {
        const upper = docDesc.toUpperCase().trim();
        // Check PPH first (most critical)
        if (upper.includes("PPH") || upper.includes("PAJAK")) return "PPH21";
        // Check SPSI
        if (upper.includes("SPSI")) return "SPSI";
        // Check KOREKSI
        if (upper.includes("KOREKSI")) return "KOREKSI";
        // Return normalized name for dynamic potongan
        return upper.replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
    }

    private async getBrondol(empCodes: string[], startDate: string, endDate: string): Promise<Record<string, number>> {
        if (!empCodes.length) return {};
        const empList = empCodes.map(e => `'${e}'`).join(",");

        let rows = await this.db.query<{ emp_code: string; total: number }>(`
            SELECT LFLN.EmpCode as emp_code, SUM(LFLN.Amount) as total
            FROM PR_LOOSEFRUIT LF
            JOIN PR_LOOSEFRUITLN LFLN ON LF.ID = LFLN.MasterID
            WHERE LFLN.EmpCode IN (${empList})
              AND LF.DocDate >= ? AND LF.DocDate < ?
            GROUP BY LFLN.EmpCode
        `, [startDate, endDate]);

        if (rows.length === 0) {
            rows = await this.db.query<{ emp_code: string; total: number }>(`
                SELECT LFLN.EmpCode as emp_code, SUM(LFLN.Amount) as total
                FROM PR_LOOSEFRUIT_ARC LF
                JOIN PR_LOOSEFRUITLN_ARC LFLN ON LF.ID = LFLN.MasterID
                WHERE LFLN.EmpCode IN (${empList})
                  AND LF.DocDate >= ? AND LF.DocDate < ?
                GROUP BY LFLN.EmpCode
            `, [startDate, endDate]);
        }

        const result: Record<string, number> = {};
        for (const r of rows) {
            result[r.emp_code?.trim() || ""] = r.total || 0;
        }
        return result;
    }
}

export const dataExtractorService = DataExtractorService.getInstance();
