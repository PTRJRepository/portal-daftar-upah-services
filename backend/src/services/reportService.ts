import { Database } from "../db/client";
import { aggregationService } from "./aggregationService";
import { gangService } from "./gangService";
import { lemburCalculator } from "./lemburCalculator";

export class ReportService {
    private static instance: ReportService;
    private db: Database;

    private currentMonthCache: { year: number; month: number } | null = null;
    private currentMonthCacheTime: number = 0;
    private readonly CACHE_TTL_SECONDS = 300;

    private constructor() {
        this.db = Database.getInstance();
    }

    public static getInstance(): ReportService {
        if (!ReportService.instance) {
            ReportService.instance = new ReportService();
        }
        return ReportService.instance;
    }

    // --- Helpers ---

    private async getCurrentMonthFromDb(): Promise<{ year: number; month: number }> {
        const now = Date.now();
        if (this.currentMonthCache && (now - this.currentMonthCacheTime) < (this.CACHE_TTL_SECONDS * 1000)) {
            return this.currentMonthCache;
        }

        try {
            const rows = await this.db.query<{ year: number; month: number }>(`
                SELECT TOP 1 YEAR(DocDate) as year, MONTH(DocDate) as month 
                FROM PR_TASKREG 
                WHERE DocDate IS NOT NULL
                ORDER BY DocDate DESC
            `, []);
            const row = rows[0];

            if (row && row.year && row.month) {
                this.currentMonthCache = { year: row.year, month: row.month };
                this.currentMonthCacheTime = now;
                return this.currentMonthCache;
            }
        } catch (e) {
            console.error("Error getting current month from DB:", e);
        }

        const date = new Date();
        return { year: date.getFullYear(), month: date.getMonth() + 1 };
    }

    private async shouldUseArcTables(requestedMonth: number, requestedYear: number): Promise<boolean> {
        const { year: dbYear, month: dbMonth } = await this.getCurrentMonthFromDb();
        if (requestedYear < dbYear) return true;
        if (requestedYear === dbYear && requestedMonth < dbMonth) return true;
        return false;
    }

    private removeArcSuffix(sql: string): string {
        return sql
            .replace(/_ARC"/g, '"')
            .replace(/_ARC'/g, "'")
            .replace(/_ARC\s/g, ' ')
            .replace(/_ARC\)/g, ')')
            .replace(/_ARC\./g, '.')
            .replace(/_ARC,/g, ',')
            .replace(/_ARC$/g, '');
    }

    private async getGangConditionSql(gangCode: string, divisionCode?: string, alias: string = 'g'): Promise<{ sql: string; params: any[] }> {
        if (gangCode && gangCode.toUpperCase() !== 'ALL') {
            if (gangCode.includes('%')) {
                return { sql: `RTRIM(LTRIM(${alias}.GangCode)) LIKE ?`, params: [gangCode] };
            }
            return { sql: `RTRIM(LTRIM(${alias}.GangCode)) = ?`, params: [gangCode.trim()] };
        }

        if (divisionCode) {
            const gangs = await gangService.fetchGangs(divisionCode);
            if (gangs.length > 0) {
                // Use ? for all
                const conditions = gangs.map((_, i) => `RTRIM(LTRIM(${alias}.GangCode)) = ?`).join(' OR ');
                return {
                    sql: `(${conditions})`,
                    params: gangs.map(g => g.gang_code)
                };
            }
            return { sql: '1=0', params: [] };
        }

        return {
            sql: `(RTRIM(LTRIM(${alias}.GangCode)) = ? OR ? = 'ALL')`,
            params: [gangCode || 'ALL', (gangCode || 'ALL').toUpperCase()]
        };
    }

    // --- Core Logic ---

    public async generateReport(month: number, year: number, gangCode: string, divisionCode?: string): Promise<any> {
        const startTime = performance.now();
        const useArc = await this.shouldUseArcTables(month, year);

        const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        const endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;

        const cond = await this.getGangConditionSql(gangCode, divisionCode);
        const gangSubCond = await this.getGangConditionSql(gangCode, divisionCode, 'gsub');

        // Parallel Data Fetching
        const [
            employees,
            attendance,
            premiHeaders,
            premiAmounts,
            brondol,
            tunjangan,
            potongan,
            cuti,
            upahPokok,
            berasRate,
            masaKerja,
            lembur
        ] = await Promise.all([
            // 1. Employees
            this.db.query(this.reparam(`
                SELECT DISTINCT
                    e.EmpCode as nik,
                    e.EmpName as nama,
                    e.Gender as jenis_kelamin,
                    '' as tanggal_join,
                    '' as departemen,
                    '' as jabatan,
                    RTRIM(LTRIM(g.GangCode)) as gang
                FROM HR_EMPLOYEE e
                JOIN HR_GANGLN g ON g.GangMember = e.EmpCode
                WHERE ${cond.sql}
                ORDER BY e.EmpCode
            `, cond.params).sql, cond.params),

            // 2. Attendance (Reordered WHERE to match params: cond, start, end)
            this.runQueryWithMode(`
                SELECT tr.EmpCode, COUNT(DISTINCT tr.TrxDate) as hk_count, SUM(tr.Amount) as total_amount
                FROM PR_TASKREGLN_ARC tr
                JOIN PR_TASKREG_ARC tm ON tr.MasterID = tm.ID
                JOIN HR_GANGLN g ON g.GangMember = tr.EmpCode
                WHERE ${cond.sql} AND tr.TrxDate >= @start AND tr.TrxDate < @end
                  AND tr.OT = 0
                GROUP BY tr.EmpCode
            `, cond.params, startDate, endDate, useArc),

            // 3. Premi Headers (Union)
            this.runQueryWithMode(`
                SELECT DISTINCT t.DocDesc
                FROM PR_ADTRANS_ARC AS t
                JOIN PR_ADTRANSLN_ARC AS ln ON t.ID = ln.MasterID
                JOIN HR_GANGLN AS g ON g.GangMember = t.EmpCode
                WHERE ${cond.sql}
                    AND t.DocDate >= @start
                    AND t.DocDate < @end
                    AND COALESCE(ln.Amount,0) > 0
                    AND t.DocDesc IS NOT NULL
                    AND UPPER(t.DocDesc) LIKE 'PREMI%'
            `, cond.params, startDate, endDate, useArc, true),

            // 4. Premi Amounts (Union)
            this.runQueryWithMode(`
                SELECT t.EmpCode, t.DocDesc, SUM(COALESCE(ln.Amount,0)) as TotalAmount
                FROM PR_ADTRANS_ARC AS t
                JOIN PR_ADTRANSLN_ARC AS ln ON t.ID = ln.MasterID
                WHERE t.EmpCode IN (
                    SELECT DISTINCT gsub.GangMember FROM HR_GANGLN AS gsub WHERE ${gangSubCond.sql}
                )
                    AND t.DocDate >= @start
                    AND t.DocDate < @end
                    AND COALESCE(ln.Amount,0) > 0
                GROUP BY t.EmpCode, t.DocDesc
            `, gangSubCond.params, startDate, endDate, useArc, true),

            // 5. Brondol
            this.runQueryWithMode(`
                SELECT LFLN.EmpCode, SUM(LFLN.Amount) AS TotalAmount
                FROM "PR_LOOSEFRUIT_ARC" LF
                JOIN "PR_LOOSEFRUITLN_ARC" LFLN ON LF.ID = LFLN.MasterID
                WHERE LFLN.EmpCode IN (
                    SELECT DISTINCT gsub.GangMember FROM HR_GANGLN AS gsub WHERE ${gangSubCond.sql}
                )
                  AND LF.DocDate >= @start
                  AND LF.DocDate < @end
                GROUP BY LFLN.EmpCode
            `, gangSubCond.params, startDate, endDate, useArc),

            // 6. Tunjangan
            this.runQueryWithMode(`
                SELECT t.EmpCode, t.DocDesc, SUM(COALESCE(ln.Amount,0)) as TotalAmount
                FROM PR_ADTRANS_ARC AS t
                JOIN PR_ADTRANSLN_ARC AS ln ON t.ID = ln.MasterID
                WHERE t.EmpCode IN (
                    SELECT DISTINCT gsub.GangMember FROM HR_GANGLN AS gsub WHERE ${gangSubCond.sql}
                )
                    AND t.DocDate >= @start
                    AND t.DocDate < @end
                    AND UPPER(t.DocDesc) LIKE '%TUNJANGAN%'
                GROUP BY t.EmpCode, t.DocDesc
            `, gangSubCond.params, startDate, endDate, useArc),

            // 7. Potongan
            this.runQueryWithMode(`
                SELECT t.EmpCode, t.DocDesc, SUM(COALESCE(ln.Amount,0)) as TotalAmount
                FROM PR_ADTRANS_ARC AS t
                JOIN PR_ADTRANSLN_ARC AS ln ON t.ID = ln.MasterID
                WHERE t.EmpCode IN (
                    SELECT DISTINCT gsub.GangMember FROM HR_GANGLN AS gsub WHERE ${gangSubCond.sql}
                )
                    AND t.DocDate >= @start
                    AND t.DocDate < @end
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
            `, gangSubCond.params, startDate, endDate, useArc, false, true),

            // 8. Cuti (Reordered)
            this.runQueryWithMode(`
                SELECT
                    tr.EmpCode,
                    SUM(CASE WHEN tr.TaskCode LIKE 'GA9129%' THEN 1 ELSE 0 END) as cuti_tahunan_hari,
                    SUM(CASE WHEN tr.TaskCode LIKE 'GA9126%' THEN 1 ELSE 0 END) as cuti_sakit_haid_hari,
                    SUM(CASE WHEN tr.TaskCode LIKE 'GA9127%' THEN 1 ELSE 0 END) as cuti_minggu_hari,
                    SUM(CASE WHEN tr.TaskCode LIKE 'GA9128%' THEN 1 ELSE 0 END) as cuti_nasional_hari
                FROM PR_TASKREGLN_ARC tr
                JOIN PR_TASKREG_ARC tm ON tr.MasterID = tm.ID
                JOIN HR_GANGLN g ON g.GangMember = tr.EmpCode
                WHERE ${cond.sql} AND tr.TrxDate >= @start AND tr.TrxDate < @end
                  AND tr.OT = 0
                GROUP BY tr.EmpCode
            `, cond.params, startDate, endDate, useArc),

            // 9. Upah Pokok (Master)
            this.db.query(this.reparam(`
                WITH LatestCPTRX AS (
                    SELECT EmpCode, NewRate, ROW_NUMBER() OVER (PARTITION BY EmpCode ORDER BY UpdateDate DESC) as rn
                    FROM HR_CPTRX
                )
                SELECT DISTINCT e.EmpCode, COALESCE(lc.NewRate, 0) as upah_dasar
                FROM HR_EMPLOYEE e
                LEFT JOIN HR_GANGLN g ON g.GangMember = e.EmpCode
                LEFT JOIN LatestCPTRX lc ON lc.EmpCode = e.EmpCode AND lc.rn = 1
                WHERE ${cond.sql}
            `, cond.params).sql, cond.params),

            // 10. Beras Rate (Master)
            this.db.query(this.reparam(`
                SELECT DISTINCT e.EmpCode, COALESCE(p.RiceRation, 0) as beras_rate
                FROM HR_EMPLOYEE e
                LEFT JOIN HR_GANGLN g ON g.GangMember = e.EmpCode
                LEFT JOIN HR_PAYROLL p ON p.EmpCode = e.EmpCode
                WHERE ${cond.sql}
            `, cond.params).sql, cond.params),

            // 11. Masa Kerja (Master)
            this.db.query(this.reparam(`
                SELECT DISTINCT e.EmpCode, em.AppJoinGrpDate
                FROM HR_EMPLOYEE e
                LEFT JOIN HR_GANGLN g ON g.GangMember = e.EmpCode
                LEFT JOIN HR_EMPLOYMENT em ON em.EmpCode = e.EmpCode
                WHERE ${cond.sql}
            `, cond.params).sql, cond.params),

            // 12. Lembur Data
            this.runQueryWithMode(`
                SELECT DISTINCT trl.EmpCode, SUM(COALESCE(trl.Hours,0)) as TotalHours, SUM(COALESCE(trl.Amount,0)) as TotalAmount
                FROM PR_TASKREG_ARC tr
                JOIN PR_TASKREGLN_ARC trl ON tr.id = trl.masterId
                WHERE trl.EmpCode IN (
                    SELECT DISTINCT gsub.GangMember FROM HR_GANGLN AS gsub WHERE ${gangSubCond.sql}
                )
                  AND tr.DocDate >= @start
                  AND tr.DocDate < @end
                  AND trl.OT = 1
                GROUP BY trl.EmpCode
            `, gangSubCond.params, startDate, endDate, useArc)
        ]);

        const processedData = await this.processResults(
            employees, attendance, premiHeaders, premiAmounts, brondol, tunjangan,
            potongan, cuti, upahPokok, berasRate, masaKerja, lembur,
            gangCode, month, year, useArc
        );

        return aggregationService.createAggregatedResponse(
            processedData.data_rows,
            gangCode,
            month,
            year,
            performance.now() - startTime,
            true
        );
    }

    private reparam(sql: string, params: any[]): { sql: string, params: any[] } {
        return { sql, params };
    }

    private async runQueryWithMode(
        sqlTemplate: string,
        baseParams: any[],
        startDate: string,
        endDate: string,
        useArc: boolean,
        isUnion: boolean = false,
        isPotongan: boolean = false
    ): Promise<any[]> {
        let sql = useArc ? sqlTemplate : this.removeArcSuffix(sqlTemplate);

        // Handle placeholders for startDate/endDate
        // We append them to params and replace @start/@end with ?
        const currentParams = [...baseParams];

        currentParams.push(startDate);
        currentParams.push(endDate);

        sql = sql.replace(/@start/g, '?').replace(/@end/g, '?');

        return this.db.query(sql, currentParams);
    }

    // --- Processing ---

    private async processResults(
        employees: any[], attendance: any[], premiHeaders: any[], premiAmounts: any[],
        brondol: any[], tunjangan: any[], potongan: any[], cuti: any[],
        upahPokok: any[], berasRate: any[], masaKerja: any[], lembur: any[],
        gangCode: string, month: number, year: number, useArc: boolean
    ): Promise<any> {
        const employeeMap = new Map<string, any>();

        employees.forEach(e => {
            const nik = e.nik.trim();
            employeeMap.set(nik, {
                ...e,
                nik: nik,
                jenis_kelamin: (e.jenis_kelamin === '2' || String(e.jenis_kelamin).toUpperCase() === 'P') ? 'P' : 'L',
                premi: {},
                potongan_upah_kotor: { dynamic: {}, total: 0 },
                potongan_upah_bersih: { dynamic: {}, total: 0 },
                jumlah_hk: 0, hari_kerja: 0,
                gaji_pokok: 0, gaji_pokok_aktual: 0, gaji_pokok_ideal: 0, upah_pokok: 0, upah_dasar: 0,
                beras_jumlah: 0, jabatan_jumlah: 0, masa_kerja_jumlah: 0, lembur_jumlah: 0,
                total_tunjangan: 0, total_premi: 0, jumlah_upah_kotor: 0,
                pot_pph21: 0, pot_spsi: 0, pot_koreksi: 0,
                pot_kontan: 0, pot_thr: 0, pot_pinjam: 0, pot_tiket: 0, pot_alat: 0, pot_kl: 0,
                pot_bpjs_kesehatan_pekerja: 0, pot_bpjs_kesehatan_majikan: 0,
                pot_bpjs_pensiun_pekerja: 0, pot_bpjs_pensiun_majikan: 0,
                pot_bpjs_pekerja_total: 0, db_bpjs_kes: 0,
                total_potongan_bersih: 0, upah_bersih: 0
            });
        });

        attendance.forEach(r => {
            const emp = employeeMap.get(r.EmpCode.trim());
            if (emp) {
                emp.jumlah_hk = r.hk_count;
                emp.gaji_pokok_aktual = r.total_amount || 0;
            }
        });

        // Filter 0 HK
        for (const [key, emp] of employeeMap.entries()) {
            if (!emp.jumlah_hk) employeeMap.delete(key);
        }

        upahPokok.forEach(r => {
            const emp = employeeMap.get(r.EmpCode.trim());
            if (emp) {
                emp.upah_dasar = r.upah_dasar;
                emp.gaji_pokok_ideal = r.upah_dasar * emp.jumlah_hk;
                emp.gaji_pokok = emp.gaji_pokok_aktual || 0;
            }
        });

        cuti.forEach(r => {
            const emp = employeeMap.get(r.EmpCode.trim());
            if (emp) {
                emp.cuti_tahunan_hari = r.cuti_tahunan_hari;
                emp.cuti_sakit_haid_hari = r.cuti_sakit_haid_hari;
                emp.cuti_minggu_hari = r.cuti_minggu_hari;
                emp.cuti_nasional_hari = r.cuti_nasional_hari;

                const totalCuti = (r.cuti_tahunan_hari || 0) + (r.cuti_sakit_haid_hari || 0) + (r.cuti_minggu_hari || 0) + (r.cuti_nasional_hari || 0);
                emp.hari_kerja = Math.max(0, emp.jumlah_hk - totalCuti);
                emp.upah_pokok = emp.gaji_pokok; // aligned with dataExtractorService
            }
        });

        berasRate.forEach(r => {
            const emp = employeeMap.get(r.EmpCode.trim());
            if (emp) {
                emp.beras_rate = r.beras_rate;
                emp.beras_jumlah = (r.beras_rate || 0) * emp.jumlah_hk;
            }
        });

        tunjangan.forEach(r => {
            const emp = employeeMap.get(r.EmpCode.trim());
            if (emp && r.DocDesc) {
                const desc = r.DocDesc.toUpperCase();
                const amt = r.TotalAmount || 0;
                if (desc.includes('JABAT')) emp.jabatan_jumlah = (emp.jabatan_jumlah || 0) + amt;
                else if (desc.includes('MASA')) {
                    emp.masa_kerja_jumlah = (emp.masa_kerja_jumlah || 0) + amt;
                    emp.masa_kerja_amount = emp.masa_kerja_jumlah;
                }
            }
        });

        if (!useArc) {
            const empCodes = Array.from(employeeMap.keys());
            const formulas = await lemburCalculator.calculateBatchAmounts(empCodes, month, year);
            lembur.forEach(r => {
                const emp = employeeMap.get(r.EmpCode.trim());
                if (emp) {
                    emp.lembur_jam = r.TotalHours;
                    emp.lembur_jumlah = formulas[emp.nik] || 0;
                }
            });
        } else {
            lembur.forEach(r => {
                const emp = employeeMap.get(r.EmpCode.trim());
                if (emp) {
                    emp.lembur_jam = r.TotalHours;
                    emp.lembur_jumlah = r.TotalAmount || 0;
                }
            });
        }

        brondol.forEach(r => {
            const emp = employeeMap.get(r.EmpCode.trim());
            if (emp) emp.premi.brondol = r.TotalAmount || 0;
        });

        const dynamicPremiHeaders: Record<string, string> = {};
        premiAmounts.forEach(r => {
            const emp = employeeMap.get(r.EmpCode.trim());
            if (emp && r.DocDesc) {
                const desc = r.DocDesc.toUpperCase();
                const amt = r.TotalAmount || 0;
                if (desc.includes('KOREKSI')) {
                    emp.premi.koreksi = (emp.premi.koreksi || 0) + amt;
                } else if (desc.includes('BRONDOL')) {
                    emp.premi.brondol = (emp.premi.brondol || 0) + amt;
                } else if (desc.startsWith('PREMI')) {
                    const norm = this.normalizePremiName(desc);
                    const key = norm.replace('premi_', '');
                    emp.premi[key] = (emp.premi[key] || 0) + amt;
                    dynamicPremiHeaders[r.DocDesc] = norm;
                }
            }
        });

        const dynamicPotMap: Record<string, string> = {};
        potongan.forEach(r => {
            const emp = employeeMap.get(r.EmpCode.trim());
            if (emp && r.DocDesc) {
                const desc = r.DocDesc.toUpperCase();
                const amt = r.TotalAmount || 0;

                if (desc.includes('KOREKSI')) {
                    emp.pot_koreksi = amt;
                    emp.potongan_upah_kotor.koreksi = amt;
                } else if (desc.includes('PPH')) {
                    emp.pot_pph21 = amt;
                    emp.potongan_upah_bersih.pph21 = amt;
                } else if (desc.includes('SPSI')) {
                    emp.pot_spsi = amt;
                    emp.potongan_upah_bersih.spsi = amt;
                } else if (desc.includes('BPJS')) {
                    if (!desc.includes('MAJ')) emp.db_bpjs_kes = (emp.db_bpjs_kes || 0) + amt;
                } else {
                    emp.potongan_upah_bersih.dynamic[desc] = amt;
                    dynamicPotMap[desc] = `pot_dynamic_${Object.keys(dynamicPotMap).length + 1}`;
                    if (desc.includes('KONTAN')) emp.pot_kontan = amt;
                    else if (desc.includes('THR')) emp.pot_thr = amt;
                    else if (desc.includes('PINJAM')) emp.pot_pinjam = amt;
                    else if (desc.includes('TIKET')) emp.pot_tiket = amt;
                    else if (desc.includes('ALAT')) emp.pot_alat = amt;
                    else if (desc.includes('KL')) emp.pot_kl = amt;
                }
            }
        });

        const finalRows: any[] = [];

        for (const emp of employeeMap.values()) {
            emp.total_tunjangan = (emp.beras_jumlah || 0) + (emp.jabatan_jumlah || 0) + (emp.masa_kerja_jumlah || 0) + (emp.lembur_jumlah || 0);

            let totalPremi = 0;
            for (const [k, v] of Object.entries(emp.premi)) {
                if (k !== 'koreksi') totalPremi += (v as number);
            }
            emp.total_premi = totalPremi;
            emp.premi_koreksi = emp.premi.koreksi || 0;

            const bpjsBase = (emp.upah_dasar * 30) + (emp.masa_kerja_jumlah || 0);
            const astekPek = Math.round(bpjsBase * 0.02 * 100) / 100;
            const astekMaj = Math.round(bpjsBase * 0.0454 * 100) / 100;

            const bpjsKesPek = Math.round(bpjsBase * 0.01 * 100) / 100;
            const bpjsKesMaj = Math.round(bpjsBase * 0.04 * 100) / 100;
            const bpjsPenPek = Math.round(bpjsBase * 0.01 * 100) / 100;
            const bpjsPenMaj = Math.round(bpjsBase * 0.02 * 100) / 100;

            const finalBpjsKesPek = bpjsKesPek + (emp.db_bpjs_kes || 0);

            emp.pot_bpjs_kesehatan_pekerja = finalBpjsKesPek;
            emp.pot_bpjs_kesehatan_majikan = bpjsKesMaj;
            emp.pot_bpjs_pensiun_pekerja = bpjsPenPek;
            emp.pot_bpjs_pensiun_majikan = bpjsPenMaj;
            emp.pot_bpjs_pekerja_total = finalBpjsKesPek + bpjsPenPek;
            emp.pot_astek = astekPek;
            emp.pot_astek_maj = astekMaj;

            const potKoreksi = emp.pot_koreksi || 0;
            emp.potongan_upah_kotor.total = potKoreksi;
            emp.potongan_upah_kotor_total = potKoreksi;

            emp.jumlah_upah_kotor = (emp.gaji_pokok + emp.total_tunjangan + emp.total_premi) - potKoreksi;
            emp.upah_kotor_premi = emp.jumlah_upah_kotor;

            const dynamicSum = Object.values(emp.potongan_upah_bersih.dynamic || {}).reduce((a: any, b: any) => a + b, 0) as number;

            emp.total_potongan_bersih =
                astekPek +
                emp.pot_bpjs_pekerja_total +
                (emp.pot_spsi || 0) +
                (emp.pot_pph21 || 0) +
                dynamicSum;

            emp.potongan_upah_bersih.total = emp.total_potongan_bersih;
            emp.total_potongan = emp.total_potongan_bersih;

            emp.upah_bersih = emp.jumlah_upah_kotor - emp.total_potongan_bersih;

            finalRows.push(emp);
        }

        return {
            data_rows: finalRows,
            dynamic_premi_headers: dynamicPremiHeaders,
            dynamic_potongan_headers: dynamicPotMap
        };
    }

    private normalizePremiName(desc: string): string {
        let name = desc.replace('TUNJANGAN PREMI', '').replace('TUNJANGAN', '').replace('PREMI', '').trim();
        if (!name) return 'premi_unknown';
        return 'premi_' + name.toLowerCase().replace(/[^a-z0-9_]/g, '').replace(/\s+/g, '_');
    }
}

export const reportService = ReportService.getInstance();