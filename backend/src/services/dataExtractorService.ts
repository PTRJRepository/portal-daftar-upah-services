import { Database } from "../db/client";
import { payrollService } from "./payrollService";

interface EmployeeRow {
    emp_code: string;
    emp_name: string;
    gender: string;
    loc_code: string;
    gang_code: string;
    pay_rate: number;
}

interface PayrollRow {
    nik: string;
    nama: string;
    jenis_kelamin: string;
    loc_code: string;
    gang_code: string;
    upah_dasar: number;
    jumlah_hk: number;
    gaji_pokok: number;
    beras_jumlah: number;
    jabatan_jumlah: number;
    masa_kerja_jumlah: number;
    lembur_jumlah: number;
    total_tunjangan: number;
    premi_brondol: number;
    total_premi: number;
    jumlah_upah_kotor: number;
    pot_spsi: number;
    pot_pph21: number;
    pot_koreksi: number;
    total_potongan: number;
    upah_bersih: number;
    [key: string]: any;
}

// Division to LocCode mapping
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

    /**
     * Extract all payroll data for a division
     */
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
        const daysInMonth = new Date(year, month, 0).getDate();
        const startDate = `${year}-${month.toString().padStart(2, "0")}-01`;
        const endDate = `${year}-${month.toString().padStart(2, "0")}-${daysInMonth}`;

        // Build gang condition
        let gangCondition = "";
        if (gangCode && gangCode !== "ALL") {
            gangCondition = `g.GangCode = '${gangCode}'`;
        } else if (divisionCode) {
            const locCode = DIVISION_TO_LOCCODE[divisionCode] || divisionCode;
            gangCondition = `g.LocCode = '${locCode}'`;
        }

        // 1. Get employees
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

        // 2. Run parallel queries
        const [attendance, premi, potongan, lembur, beras, jabatan, masaKerja] = await Promise.all([
            this.getAttendance(empCodes, startDate, endDate),
            this.getPremi(empCodes, startDate, endDate),
            this.getPotongan(empCodes, startDate, endDate),
            this.getLembur(empCodes, startDate, endDate),
            this.getTunjangan(empCodes, startDate, endDate, "BERAS"),
            this.getTunjangan(empCodes, startDate, endDate, "JABATAN"),
            this.getTunjangan(empCodes, startDate, endDate, "MASA%KERJA")
        ]);

        // 3. Build employee data
        const dataRows: PayrollRow[] = [];
        const dynamicPremiSet = new Set<string>();
        const dynamicPotonganSet = new Set<string>();

        for (const emp of employees) {
            const hk = attendance[emp.emp_code] || 0;
            if (hk === 0) continue; // Skip employees with no HK

            const empPremi = premi[emp.emp_code] || {};
            const empPotongan = potongan[emp.emp_code] || {};
            const empLembur = lembur[emp.emp_code] || 0;
            const empBeras = beras[emp.emp_code] || 0;
            const empJabatan = jabatan[emp.emp_code] || 0;
            const empMasaKerja = masaKerja[emp.emp_code] || 0;

            // Calculate payroll
            const gaji_pokok = payrollService.calculateGajiPokok(emp.pay_rate, hk);
            const total_tunjangan = empBeras + empJabatan + empMasaKerja + empLembur;

            let total_premi = 0;
            for (const [key, val] of Object.entries(empPremi)) {
                total_premi += val as number;
                dynamicPremiSet.add(key);
            }

            let total_potongan = 0;
            for (const [key, val] of Object.entries(empPotongan)) {
                total_potongan += Math.abs(val as number);
                dynamicPotonganSet.add(key);
            }

            const jumlah_upah_kotor = gaji_pokok + total_tunjangan + total_premi;
            const upah_bersih = jumlah_upah_kotor - total_potongan;

            const row: PayrollRow = {
                nik: emp.emp_code,
                nama: emp.emp_name,
                jenis_kelamin: emp.gender === "2" || emp.gender === "P" ? "P" : "L",
                loc_code: emp.loc_code,
                gang_code: emp.gang_code,
                upah_dasar: emp.pay_rate,
                jumlah_hk: hk,
                gaji_pokok,
                beras_jumlah: empBeras,
                jabatan_jumlah: empJabatan,
                masa_kerja_jumlah: empMasaKerja,
                lembur_jumlah: empLembur,
                total_tunjangan,
                premi_brondol: 0,
                total_premi,
                jumlah_upah_kotor,
                pot_spsi: empPotongan["SPSI"] || 0,
                pot_pph21: empPotongan["PPH21"] || 0,
                pot_koreksi: empPotongan["KOREKSI"] || 0,
                total_potongan,
                upah_bersih,
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
                g.GangCode as gang_code,
                COALESCE(p.PayRate, 0) as pay_rate
            FROM HR_EMPLOYEE e
            JOIN HR_GANGLN gl ON gl.GangMember = e.EmpCode
            JOIN HR_GANG g ON g.GangCode = gl.GangCode
            LEFT JOIN HR_PAYROLL p ON p.EmpCode = e.EmpCode
            ${whereClause}
            ORDER BY e.EmpName
        `);
        return rows.map(r => ({
            emp_code: r.emp_code?.trim() || "",
            emp_name: r.emp_name?.trim() || "",
            gender: String(r.gender || "1"),
            loc_code: r.loc_code?.trim() || "",
            gang_code: r.gang_code?.trim() || "",
            pay_rate: r.pay_rate || 0
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
              AND trl.TrxDate >= ? AND trl.TrxDate <= ?
              AND trl.OT = 0
            GROUP BY trl.EmpCode
        `, [startDate, endDate]);

        if (rows.length === 0) {
            rows = await this.db.query<{ emp_code: string; hk: number }>(`
                SELECT trl.EmpCode as emp_code, COUNT(*) as hk
                FROM PR_TASKREGLN_ARC trl
                JOIN PR_TASKREG_ARC tr ON tr.ID = trl.MasterID
                WHERE trl.EmpCode IN (${empList})
                  AND trl.TrxDate >= ? AND trl.TrxDate <= ?
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

    private async getPremi(empCodes: string[], startDate: string, endDate: string): Promise<Record<string, Record<string, number>>> {
        if (!empCodes.length) return {};
        const empList = empCodes.map(e => `'${e}'`).join(",");
        let rows = await this.db.query<{ emp_code: string; doc_desc: string; amount: number }>(`
            SELECT t.EmpCode as emp_code, t.DocDesc as doc_desc, SUM(ln.Amount) as amount
            FROM PR_ADTRANS t
            JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
            WHERE t.EmpCode IN (${empList})
              AND t.DocDate >= ? AND t.DocDate < ?
              AND UPPER(t.DocDesc) LIKE '%PREMI%'
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
                  AND UPPER(t.DocDesc) LIKE '%PREMI%'
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
        let rows = await this.db.query<{ emp_code: string; doc_desc: string; amount: number }>(`
            SELECT t.EmpCode as emp_code, t.DocDesc as doc_desc, SUM(ln.Amount) as amount
            FROM PR_ADTRANS t
            JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
            WHERE t.EmpCode IN (${empList})
              AND t.DocDate >= ? AND t.DocDate < ?
              AND ln.Amount < 0
            GROUP BY t.EmpCode, t.DocDesc
        `, [startDate, endDate]);

        if (rows.length === 0) {
            rows = await this.db.query<{ emp_code: string; doc_desc: string; amount: number }>(`
                SELECT t.EmpCode as emp_code, t.DocDesc as doc_desc, SUM(ln.Amount) as amount
                FROM PR_ADTRANS_ARC t
                JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
                WHERE t.EmpCode IN (${empList})
                  AND t.DocDate >= ? AND t.DocDate < ?
                  AND ln.Amount < 0
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

    private async getLembur(empCodes: string[], startDate: string, endDate: string): Promise<Record<string, number>> {
        if (!empCodes.length) return {};
        const empList = empCodes.map(e => `'${e}'`).join(",");
        let rows = await this.db.query<{ emp_code: string; total: number }>(`
            SELECT t.EmpCode as emp_code, SUM(ln.Amount) as total
            FROM PR_ADTRANS t
            JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
            WHERE t.EmpCode IN (${empList})
              AND t.DocDate >= ? AND t.DocDate < ?
              AND UPPER(t.DocDesc) LIKE '%LEMBUR%'
            GROUP BY t.EmpCode
        `, [startDate, endDate]);

        if (rows.length === 0) {
            rows = await this.db.query<{ emp_code: string; total: number }>(`
                SELECT t.EmpCode as emp_code, SUM(ln.Amount) as total
                FROM PR_ADTRANS_ARC t
                JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
                WHERE t.EmpCode IN (${empList})
                  AND t.DocDate >= ? AND t.DocDate < ?
                  AND UPPER(t.DocDesc) LIKE '%LEMBUR%'
                GROUP BY t.EmpCode
            `, [startDate, endDate]);
        }

        const result: Record<string, number> = {};
        for (const r of rows) {
            result[r.emp_code?.trim() || ""] = r.total || 0;
        }
        return result;
    }

    private async getTunjangan(empCodes: string[], startDate: string, endDate: string, tunjanganType: string): Promise<Record<string, number>> {
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

    private normalizePremiName(docDesc: string): string {
        let name = docDesc.trim().toUpperCase()
            .replace(/^TUNJANGAN\s*PREMI\s*/i, "")
            .replace(/^PREMI\s*/i, "");
        return `premi_${name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")}`;
    }

    private normalizePotonganName(docDesc: string): string {
        if (docDesc.toUpperCase().includes("SPSI")) return "SPSI";
        if (docDesc.toUpperCase().includes("PPH21")) return "PPH21";
        if (docDesc.toUpperCase().includes("KOREKSI")) return "KOREKSI";
        return docDesc.trim().toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
    }
}

export const dataExtractorService = DataExtractorService.getInstance();
