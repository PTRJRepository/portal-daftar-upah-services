import { Database } from "../../../db/client";
import { Config } from "../../../config";
import { error as logError } from "../../../utils/logger";

const STAGING_CATALOG = Config.DB_STAGING_DATABASE;

export interface CompareSummary {
    match_count: number;
    staging_only: number;
    prod_only: number;
    staging_total: number;
    prod_total: number;
    pct_match: string;
}

export interface AttendanceCompareRow {
    emp_code: string;
    emp_name?: string;
    gang_code?: string;
    division?: string;
    job_code: string;
    trans_date: string;
    staging_trx: number;
    prod_found: boolean;
    prod_task_code?: string;
    prod_hours?: number;
    prod_ot?: boolean;
}

export interface OvertimeCompareRow {
    emp_code: string;
    emp_name?: string;
    gang_code?: string;
    division?: string;
    job_code: string;
    trans_date: string;
    staging_hours: number;
    staging_rate: number;
    prod_found: boolean;
    prod_task_code?: string;
    prod_hours?: number;
    prod_table?: string;
}

export interface LoosefruitCompareRow {
    emp_code: string;
    emp_name?: string;
    gang_code?: string;
    division?: string;
    trans_date: string;
    from_oc: string;
    staging_lf_bunches: number;
    prod_found: boolean;
    prod_mt?: number;
}

export class StagingComparisonService {
    private static instance: StagingComparisonService;
    private stagingDb: Database;
    private prodDb: Database;

    private constructor() {
        this.stagingDb = Database.getStagingInstance();
        this.prodDb = Database.getInstance();
    }

    public static getInstance(): StagingComparisonService {
        if (!StagingComparisonService.instance) {
            StagingComparisonService.instance = new StagingComparisonService();
        }
        return StagingComparisonService.instance;
    }

    // Returns Set of EmpCodes for a gang (or all if no gang specified)
    private async getGangMembers(gang?: string, division?: string): Promise<Set<string> | null> {
        if (!gang && !division) return null; // no filter
        const where: string[] = [];
        const params: any[] = [];
        if (gang) { where.push(`g.GangCode = ?`); params.push(gang); }
        if (division) { where.push(`g.LocCode = ?`); params.push(division); }
        const sql = `SELECT DISTINCT gl.GangMember as EmpCode
                     FROM HR_GANGLN gl WITH (NOLOCK)
                     JOIN HR_GANG g WITH (NOLOCK) ON gl.GangCode = g.GangCode
                     WHERE ${where.join(' AND ')}`;
        const rows = await this.prodDb.query<any>(sql, params);
        return new Set(rows.map((r: any) => String(r.EmpCode).trim()));
    }

    // Returns map EmpCode → {name, gang_code, division}
    private async getEmpInfo(empCodes: string[]): Promise<Map<string, { name: string; gang_code: string; division: string }>> {
        if (!empCodes.length) return new Map();
        const list = empCodes.map(e => `'${e.replace(/'/g, "''")}'`).join(',');
        const rows = await this.prodDb.query<any>(
            `SELECT e.EmpCode, e.EmpName, g.GangCode, g.LocCode
             FROM HR_EMPLOYEE e WITH (NOLOCK)
             LEFT JOIN HR_GANGLN gl WITH (NOLOCK) ON gl.GangMember = e.EmpCode
             LEFT JOIN HR_GANG g WITH (NOLOCK) ON g.GangCode = gl.GangCode
             WHERE e.EmpCode IN (${list})`,
        );
        const map = new Map<string, { name: string; gang_code: string; division: string }>();
        for (const r of rows) {
            const ec = String(r.EmpCode).trim();
            if (!map.has(ec)) {
                map.set(ec, {
                    name: String(r.EmpName || '').trim(),
                    gang_code: String(r.GangCode || '').trim(),
                    division: String(r.LocCode || '').trim(),
                });
            }
        }
        return map;
    }

    // ============================================================
    // 1. ATTENDANCE: Gwscannerdata vs PR_TASKREGLN
    // ============================================================

    async compareAttendance(
        date: string,
        limit = 50,
        gang?: string,
        division?: string,
    ): Promise<{ rows: AttendanceCompareRow[]; summary: CompareSummary }> {
        const gangMembers = await this.getGangMembers(gang, division);

        const stagingRows = await this.stagingDb.query<any>(
            `SELECT WORKERCODE, JOBCODE, TRANSDATE, TRANSNO, FIELDNO
             FROM [${STAGING_CATALOG}].[dbo].[Gwscannerdata]
             WHERE CAST(TRANSDATE AS DATE) = '${date}'
               AND WORKERCODE IS NOT NULL
               AND JOBCODE IS NOT NULL
               AND (TRANSSTATUS = 'OK' OR TRANSSTATUS LIKE 'OK%')
             ORDER BY WORKERCODE`,
        );

        // Filter by gang if specified
        const filtered = gangMembers
            ? stagingRows.filter((r: any) => gangMembers.has(String(r.WORKERCODE).trim()))
            : stagingRows;

        const stagingTotal = filtered.length;
        let matchCount = 0;
        let stagingOnly = 0;
        const rows: AttendanceCompareRow[] = [];
        const empCodes: string[] = [];

        for (const s of filtered.slice(0, limit)) {
            const empCode = String(s.WORKERCODE).trim();
            const jobCode = String(s.JOBCODE).trim();
            empCodes.push(empCode);

            const prod = await this.prodDb.queryOne<any>(
                `SELECT TOP 1 TaskCode, Hours, OT
                 FROM PR_TASKREGLN WITH (NOLOCK)
                 WHERE EmpCode = ? AND CAST(TrxDate AS DATE) = ? AND TaskCode LIKE ?
                 ORDER BY ID DESC`,
                [empCode, date, `%${jobCode}%`],
            );

            if (prod) {
                matchCount++;
                rows.push({ emp_code: empCode, job_code: jobCode, trans_date: date, staging_trx: 1, prod_found: true, prod_task_code: prod.TaskCode, prod_hours: prod.Hours, prod_ot: prod.OT === 1 });
            } else {
                stagingOnly++;
                rows.push({ emp_code: empCode, job_code: jobCode, trans_date: date, staging_trx: 1, prod_found: false });
            }
        }

        // Enrich with emp name + gang info
        const empInfo = await this.getEmpInfo([...new Set(empCodes)]);
        for (const r of rows) {
            const info = empInfo.get(r.emp_code);
            if (info) { r.emp_name = info.name; r.gang_code = info.gang_code; r.division = info.division; }
        }

        const prodCountRow = await this.prodDb.queryOne<any>(
            `SELECT COUNT(*) as cnt FROM PR_TASKREGLN WITH (NOLOCK)
             WHERE CAST(TrxDate AS DATE) = ?`,
            [date],
        );
        const prodTotal = prodCountRow?.cnt ?? 0;

        const total = rows.length;
        const pct = total > 0 ? ((matchCount / total) * 100).toFixed(1) : "0.0";

        return {
            rows,
            summary: {
                match_count: matchCount,
                staging_only: stagingOnly,
                prod_only: 0,
                staging_total: stagingTotal,
                prod_total: prodTotal,
                pct_match: pct,
            },
        };
    }

    // ============================================================
    // 2. OVERTIME: Overtime vs PR_TASKREGLN (OT=true)
    // ============================================================

    async compareOvertime(
        date: string,
        limit = 50,
        gang?: string,
        division?: string,
    ): Promise<{ rows: OvertimeCompareRow[]; summary: CompareSummary }> {
        const gangMembers = await this.getGangMembers(gang, division);

        const stagingRows = await this.stagingDb.query<any>(
            `SELECT WORKERCODE, JOBCODE, HOURS, BASICRATE, ADDRATE, TRANSNO, TRANSDATE
             FROM [${STAGING_CATALOG}].[dbo].[Overtime]
             WHERE CAST(TRANSDATE AS DATE) = '${date}'
               AND (TRANSSTATUS = 'OK' OR TRANSSTATUS LIKE 'OK%')
             ORDER BY WORKERCODE`,
        );

        const filtered = gangMembers
            ? stagingRows.filter((r: any) => gangMembers.has(String(r.WORKERCODE).trim()))
            : stagingRows;

        const stagingTotal = filtered.length;
        let matchCount = 0;
        let stagingOnly = 0;
        let prodOnly = 0;
        const rows: OvertimeCompareRow[] = [];
        const empCodes: string[] = [];

        for (const s of filtered.slice(0, limit)) {
            const empCode = String(s.WORKERCODE).trim();
            const jobCode = String(s.JOBCODE || "").trim();
            empCodes.push(empCode);

            const taskReg = await this.prodDb.queryOne<any>(
                `SELECT TOP 1 TaskCode, Hours FROM PR_TASKREGLN WITH (NOLOCK)
                 WHERE EmpCode = ? AND CAST(TrxDate AS DATE) = ? AND OT = 1 ORDER BY ID DESC`,
                [empCode, date],
            );
            if (taskReg) {
                matchCount++;
                rows.push({ emp_code: empCode, job_code: jobCode, trans_date: date, staging_hours: s.HOURS, staging_rate: s.BASICRATE, prod_found: true, prod_task_code: taskReg.TaskCode, prod_hours: taskReg.Hours, prod_table: "PR_TASKREGLN" });
                continue;
            }

            const rateDot = await this.prodDb.queryOne<any>(
                `SELECT TOP 1 Hours, Rate FROM PR_MTHRATEDOTLN WITH (NOLOCK)
                 WHERE EmpCode = ? AND CAST(StartDate AS DATE) = ? ORDER BY ID DESC`,
                [empCode, date],
            );
            if (rateDot) {
                matchCount++;
                rows.push({ emp_code: empCode, job_code: jobCode, trans_date: date, staging_hours: s.HOURS, staging_rate: s.BASICRATE, prod_found: true, prod_hours: rateDot.Hours, prod_table: "PR_MTHRATEDOTLN" });
                continue;
            }

            stagingOnly++;
            rows.push({ emp_code: empCode, job_code: jobCode, trans_date: date, staging_hours: s.HOURS, staging_rate: s.BASICRATE, prod_found: false });
        }

        const empInfo = await this.getEmpInfo([...new Set(empCodes)]);
        for (const r of rows) {
            const info = empInfo.get(r.emp_code);
            if (info) { r.emp_name = info.name; r.gang_code = info.gang_code; r.division = info.division; }
        }

        const prodCountRow = await this.prodDb.queryOne<any>(
            `SELECT COUNT(*) as cnt FROM PR_TASKREGLN WITH (NOLOCK)
             WHERE CAST(TrxDate AS DATE) = ? AND OT = 1`,
            [date],
        );
        prodOnly = Math.max(0, (prodCountRow?.cnt ?? 0) - matchCount);

        const total = rows.length;
        const pct = total > 0 ? ((matchCount / total) * 100).toFixed(1) : "0.0";

        return {
            rows,
            summary: { match_count: matchCount, staging_only: stagingOnly, prod_only: prodOnly, staging_total: stagingTotal, prod_total: prodCountRow?.cnt ?? 0, pct_match: pct },
        };
    }

    // ============================================================
    // 3. LOOSEFRUIT: Ffbscannerdata.LOOSEFRUIT vs PR_LOOSEFRUITLN
    // ============================================================

    async compareLoosefruit(
        date: string,
        limit = 50,
        gang?: string,
        division?: string,
    ): Promise<{ rows: LoosefruitCompareRow[]; summary: CompareSummary }> {
        const gangMembers = await this.getGangMembers(gang, division);

        const stagingRows = await this.stagingDb.query<any>(
            `SELECT WORKERCODE, FROMOCCODE, COUNT(*) as trx_count,
                    SUM(CAST(LOOSEFRUIT AS INT)) as total_lf
             FROM [${STAGING_CATALOG}].[dbo].[Ffbscannerdata]
             WHERE CAST(TRANSDATE AS DATE) = '${date}'
               AND CAST(LOOSEFRUIT AS INT) > 0
               AND (TRANSSTATUS = 'OK' OR TRANSSTATUS LIKE 'OK%')
             GROUP BY WORKERCODE, FROMOCCODE
             ORDER BY WORKERCODE`,
        );

        const filtered = gangMembers
            ? stagingRows.filter((r: any) => gangMembers.has(String(r.WORKERCODE).trim()))
            : stagingRows;

        const stagingTotal = filtered.length;
        let matchCount = 0;
        let stagingOnly = 0;
        const rows: LoosefruitCompareRow[] = [];
        const empCodes: string[] = [];

        for (const s of filtered.slice(0, limit)) {
            const empCode = String(s.WORKERCODE).trim();
            empCodes.push(empCode);

            const prod = await this.prodDb.queryOne<any>(
                `SELECT TOP 1 MT, ChargeTo FROM PR_LOOSEFRUITLN WITH (NOLOCK)
                 WHERE EmpCode = ? AND CAST(TrxDate AS DATE) = ? ORDER BY ID DESC`,
                [empCode, date],
            );

            if (prod) {
                matchCount++;
                rows.push({ emp_code: empCode, trans_date: date, from_oc: s.FROMOCCODE, staging_lf_bunches: s.total_lf, prod_found: true, prod_mt: prod.MT });
            } else {
                stagingOnly++;
                rows.push({ emp_code: empCode, trans_date: date, from_oc: s.FROMOCCODE,
                    staging_lf_bunches: s.total_lf,
                    prod_found: false,
                });
            }
        }

        // Enrich with emp name + gang info
        const empInfo = await this.getEmpInfo([...new Set(empCodes)]);
        for (const r of rows) {
            const info = empInfo.get(r.emp_code);
            if (info) { r.emp_name = info.name; r.gang_code = info.gang_code; r.division = info.division; }
        }

        // Check PR_LOOSEFRUITLN_ARC too for same date
        const prodLfCount = await this.prodDb.queryOne<any>(
            `SELECT COUNT(DISTINCT EmpCode) as workers, SUM(MT) as total_mt
             FROM PR_LOOSEFRUITLN WITH (NOLOCK)
             WHERE CAST(TrxDate AS DATE) = ?`,
            [date],
        );

        const total = rows.length;
        const pct = total > 0 ? ((matchCount / total) * 100).toFixed(1) : "0.0";

        return {
            rows,
            summary: {
                match_count: matchCount,
                staging_only: stagingOnly,
                prod_only: 0,
                staging_total: stagingTotal,
                prod_total: prodLfCount?.workers ?? 0,
                pct_match: pct,
            },
        };
    }

    // ============================================================
    // 4. DAILY SUMMARY: aggregate counts per day for a month
    // ============================================================

    async dailyAttendanceSummary(month: number, year: number, topN = 15) {
        const stagingDaily = await this.stagingDb.query<any>(
            `SELECT CAST(TRANSDATE AS DATE) as tgl, COUNT(*) as cnt
             FROM [${STAGING_CATALOG}].[dbo].[Gwscannerdata]
             WHERE YEAR(TRANSDATE) = ? AND MONTH(TRANSDATE) = ?
               AND (TRANSSTATUS = 'OK' OR TRANSSTATUS LIKE 'OK%')
             GROUP BY CAST(TRANSDATE AS DATE)
             ORDER BY cnt DESC`,
            [year, month],
        );

        const days: Array<{
            date: string;
            staging: number;
            prod_taskreg: number;
            prod_arc: number;
        }> = [];

        for (const row of stagingDaily.slice(0, topN)) {
            const dt = row.tgl;
            const prod = await this.prodDb.queryOne<any>(
                "SELECT COUNT(*) as cnt FROM PR_TASKREGLN WITH (NOLOCK) WHERE CAST(TrxDate AS DATE) = ?",
                [dt],
            );
            const arc = await this.prodDb.queryOne<any>(
                "SELECT COUNT(*) as cnt FROM PR_TASKREGLN_ARC WITH (NOLOCK) WHERE CAST(TrxDate AS DATE) = ?",
                [dt],
            );
            days.push({
                date: String(dt),
                staging: row.cnt,
                prod_taskreg: prod?.cnt ?? 0,
                prod_arc: arc?.cnt ?? 0,
            });
        }

        return days;
    }

    async dailyOvertimeSummary(month: number, year: number, topN = 15) {
        const stagingDaily = await this.stagingDb.query<any>(
            `SELECT CAST(TRANSDATE AS DATE) as tgl, COUNT(*) as cnt,
                    SUM(HOURS) as total_hours
             FROM [${STAGING_CATALOG}].[dbo].[Overtime]
             WHERE YEAR(TRANSDATE) = ? AND MONTH(TRANSDATE) = ?
             GROUP BY CAST(TRANSDATE AS DATE)
             ORDER BY cnt DESC`,
            [year, month],
        );

        const days: Array<{
            date: string;
            staging_rows: number;
            staging_hours: number;
            prod_taskreg_ot_rows: number;
            prod_taskreg_ot_hours: number;
            prod_ratedot_rows: number;
            prod_ratedot_hours: number;
        }> = [];

        for (const row of stagingDaily.slice(0, topN)) {
            const dt = row.tgl;
            const taskReg = await this.prodDb.queryOne<any>(
                "SELECT COUNT(*) as cnt, SUM(Hours) as total_hours FROM PR_TASKREGLN WITH (NOLOCK) WHERE CAST(TrxDate AS DATE) = ? AND OT=1",
                [dt],
            );
            const rateDot = await this.prodDb.queryOne<any>(
                "SELECT COUNT(*) as cnt, SUM(Hours) as total_hours FROM PR_MTHRATEDOTLN WITH (NOLOCK) WHERE CAST(StartDate AS DATE) = ?",
                [dt],
            );
            days.push({
                date: String(dt),
                staging_rows: row.cnt,
                staging_hours: row.total_hours ?? 0,
                prod_taskreg_ot_rows: taskReg?.cnt ?? 0,
                prod_taskreg_ot_hours: taskReg?.total_hours ?? 0,
                prod_ratedot_rows: rateDot?.cnt ?? 0,
                prod_ratedot_hours: rateDot?.total_hours ?? 0,
            });
        }

        return days;
    }

    async dailyLoosefruitSummary(month: number, year: number, topN = 15) {
        const stagingDaily = await this.stagingDb.query<any>(
            `SELECT CAST(TRANSDATE AS DATE) as tgl, COUNT(DISTINCT WORKERCODE) as workers,
                    SUM(CAST(LOOSEFRUIT AS INT)) as total_lf,
                    COUNT(*) as trx_count
             FROM [${STAGING_CATALOG}].[dbo].[Ffbscannerdata]
             WHERE YEAR(TRANSDATE) = ? AND MONTH(TRANSDATE) = ?
               AND CAST(LOOSEFRUIT AS INT) > 0
             GROUP BY CAST(TRANSDATE AS DATE)
             ORDER BY trx_count DESC`,
            [year, month],
        );

        const days: Array<{
            date: string;
            staging_workers: number;
            staging_lf_bunches: number;
            prod_workers: number;
            prod_mt: number;
        }> = [];

        for (const row of stagingDaily.slice(0, topN)) {
            const dt = row.tgl;
            const prod = await this.prodDb.queryOne<any>(
                "SELECT COUNT(DISTINCT EmpCode) as workers, SUM(MT) as total_mt FROM PR_LOOSEFRUITLN WITH (NOLOCK) WHERE CAST(TrxDate AS DATE) = ?",
                [dt],
            );
            days.push({
                date: String(dt),
                staging_workers: row.workers ?? 0,
                staging_lf_bunches: row.total_lf ?? 0,
                prod_workers: prod?.workers ?? 0,
                prod_mt: prod?.total_mt ?? 0,
            });
        }

        return days;
    }

    // ============================================================
    // 5. LOOSEFRUIT ANOMALIES: PR_LOOSEFRUIT_ARC rows where DocDate
    //    contains '_' (e.g. LF90439471_01) — excluded from payroll
    //    but surfaced here for audit/investigation.
    // ============================================================

    async loosefruitAnomalies(limit = 100): Promise<{
        rows: Array<{
            doc_id: string;
            doc_no: string;
            doc_date_raw: string;
            emp_codes: string[];
            line_count: number;
            total_mt: number;
            total_amount: number;
        }>;
        summary: {
            total_anomaly_headers: number;
            total_anomaly_lines: number;
            total_amount_excluded: number;
        };
    }> {
        const headers = await this.prodDb.query<any>(
            `SELECT TOP ${limit}
                    LF.ID, LF.DocDate as DocDateRaw,
                    COUNT(LFLN.ID) as LineCount,
                    SUM(LFLN.MT) as TotalMT,
                    SUM(LFLN.Amount) as TotalAmount
             FROM PR_LOOSEFRUIT_ARC LF WITH (NOLOCK)
             LEFT JOIN PR_LOOSEFRUITLN_ARC LFLN WITH (NOLOCK) ON LF.ID = LFLN.MasterID
             WHERE CHARINDEX('_', LF.DocDate) > 0
               AND LF.DocDate LIKE 'LF%_%'
             GROUP BY LF.ID, LF.DocDate
             ORDER BY LF.ID DESC`,
        );

        const rows = [];
        for (const h of headers) {
            const emps = await this.prodDb.query<any>(
                `SELECT TOP 5 DISTINCT EmpCode FROM PR_LOOSEFRUITLN_ARC WITH (NOLOCK)
                 WHERE MasterID = ?`,
                [h.ID],
            );
            rows.push({
                doc_id: String(h.ID),
                doc_no: "",
                doc_date_raw: h.DocDateRaw ?? "",
                emp_codes: emps.map((e: any) => String(e.EmpCode).trim()),
                line_count: h.LineCount ?? 0,
                total_mt: h.TotalMT ?? 0,
                total_amount: h.TotalAmount ?? 0,
            });
        }

        const sum = await this.prodDb.queryOne<any>(
            `SELECT COUNT(DISTINCT LF.ID) as headers,
                    COUNT(LFLN.ID) as lines,
                    SUM(LFLN.Amount) as total_amount
             FROM PR_LOOSEFRUIT_ARC LF WITH (NOLOCK)
             LEFT JOIN PR_LOOSEFRUITLN_ARC LFLN WITH (NOLOCK) ON LF.ID = LFLN.MasterID
             WHERE CHARINDEX('_', LF.DocDate) > 0
               AND LF.DocDate LIKE 'LF%_%'`,
        );

        return {
            rows,
            summary: {
                total_anomaly_headers: sum?.headers ?? 0,
                total_anomaly_lines: sum?.lines ?? 0,
                total_amount_excluded: sum?.total_amount ?? 0,
            },
        };
    }

    // ============================================================
    // 8. SUMMARY ALL: Daftar Upah-style — all 3 modules per employee
    // ============================================================

    async summaryAll(month: number, year: number, gang?: string, division?: string) {
        const gangMembers = await this.getGangMembers(gang, division);
        const gf = gangMembers ? `AND WORKERCODE IN (${[...gangMembers].map(e => `'${e.replace(/'/g,"''")}'`).join(',')})` : '';
        const gfProd = gangMembers ? `AND EmpCode IN (${[...gangMembers].map(e => `'${e.replace(/'/g,"''")}'`).join(',')})` : '';

        // HR_LEAVE code mapping: LeaveID → LeaveCode
        const leaveIdMap: Record<number, string> = { 1: 'A', 6: 'S', 8: 'CT', 9: 'H1', 10: 'H2', 11: 'ALPHA', 12: 'CTH' };

        const [sAtt, sOt, sLf, sLeave, pAtt, pOt, pLf, pLeaveArc] = await Promise.all([
            this.stagingDb.query<any>(`SELECT WORKERCODE, COUNT(DISTINCT CAST(TRANSDATE AS DATE)) as hk FROM [${STAGING_CATALOG}].[dbo].[Gwscannerdata] WHERE YEAR(TRANSDATE)=? AND MONTH(TRANSDATE)=? AND WORKERCODE IS NOT NULL AND (TRANSSTATUS='OK' OR TRANSSTATUS LIKE 'OK%') ${gf} GROUP BY WORKERCODE`, [year, month]),
            this.stagingDb.query<any>(`SELECT WORKERCODE, SUM(HOURS) as jam FROM [${STAGING_CATALOG}].[dbo].[Overtime] WHERE YEAR(TRANSDATE)=? AND MONTH(TRANSDATE)=? AND WORKERCODE IS NOT NULL AND (TRANSSTATUS='OK' OR TRANSSTATUS LIKE 'OK%') ${gf} GROUP BY WORKERCODE`, [year, month]),
            this.stagingDb.query<any>(`SELECT WORKERCODE, SUM(CAST(LOOSEFRUIT AS INT)) as bunches FROM [${STAGING_CATALOG}].[dbo].[Ffbscannerdata] WHERE YEAR(TRANSDATE)=? AND MONTH(TRANSDATE)=? AND CAST(LOOSEFRUIT AS INT)>0 AND (TRANSSTATUS='OK' OR TRANSSTATUS LIKE 'OK%') ${gf} GROUP BY WORKERCODE`, [year, month]),
            // Staging Workerleave: count leave days per LEAVETYPE per employee (only recent data)
            this.stagingDb.query<any>(`SELECT EMPCODE, LEAVETYPE, COUNT(*) as days FROM [${STAGING_CATALOG}].[dbo].[Workerleave] WHERE YEAR(LEAVEDATE)=? AND MONTH(LEAVEDATE)=? AND (TRANSSTATUS='OK' OR TRANSSTATUS LIKE 'OK%') ${gf.replace(/WORKERCODE/g, 'EMPCODE')} GROUP BY EMPCODE, LEAVETYPE`, [year, month]),
            this.prodDb.query<any>(`SELECT EmpCode, COUNT(DISTINCT CAST(TrxDate AS DATE)) as hk, SUM(Hours) as jam FROM PR_TASKREGLN WITH (NOLOCK) WHERE YEAR(TrxDate)=? AND MONTH(TrxDate)=? AND OT=0 ${gfProd} GROUP BY EmpCode`, [year, month]),
            this.prodDb.query<any>(`SELECT EmpCode, COUNT(DISTINCT CAST(TrxDate AS DATE)) as hari, SUM(Hours) as jam FROM PR_TASKREGLN WITH (NOLOCK) WHERE YEAR(TrxDate)=? AND MONTH(TrxDate)=? AND OT=1 ${gfProd} GROUP BY EmpCode`, [year, month]),
            this.prodDb.query<any>(`SELECT EmpCode, SUM(MT) as mt FROM PR_LOOSEFRUITLN WITH (NOLOCK) WHERE YEAR(TrxDate)=? AND MONTH(TrxDate)=? ${gfProd} GROUP BY EmpCode`, [year, month]),
            // Prod leave from ARCHIVE table (live HR_LEAVETRX is empty, data in _ARC)
            this.prodDb.query<any>(`SELECT EmpCode, LeaveID, SUM(LeaveLength) as days FROM HR_LEAVETRX_ARC WITH (NOLOCK) WHERE YEAR(Date)=? AND MONTH(Date)=? ${gfProd} GROUP BY EmpCode, LeaveID`, [year, month]),
        ]);

        const mk = (rows: any[], keyCol: string) => new Map(rows.map((r: any) => [String(r[keyCol]).trim(), r]));
        const mSAtt = mk(sAtt, 'WORKERCODE'), mSOt = mk(sOt, 'WORKERCODE'), mSLf = mk(sLf, 'WORKERCODE');
        const mPAtt = mk(pAtt, 'EmpCode'), mPOt = mk(pOt, 'EmpCode'), mPLf = mk(pLf, 'EmpCode');

        // Aggregate prod leave by EmpCode → total_days
        const pLeaveByEmp = new Map<string, number>();
        for (const r of pLeaveArc) {
            const ec = String(r.EmpCode).trim();
            pLeaveByEmp.set(ec, (pLeaveByEmp.get(ec) ?? 0) + Number(r.days ?? 0));
        }

        // Aggregate staging leave by EMPCODE → {sakit, cuti, haid, hamil, alpha, cth, total}
        const sLeaveByEmp = new Map<string, { sakit: number; cuti: number; haid: number; hamil: number; alpha: number; cth: number; total: number }>();
        for (const r of sLeave) {
            const ec = String(r.EMPCODE).trim();
            if (!sLeaveByEmp.has(ec)) sLeaveByEmp.set(ec, { sakit: 0, cuti: 0, haid: 0, hamil: 0, alpha: 0, cth: 0, total: 0 });
            const entry = sLeaveByEmp.get(ec)!;
            const days = Number(r.days ?? 0);
            entry.total += days;
            const lt = String(r.LEAVETYPE ?? '').toUpperCase();
            if (lt === 'S') entry.sakit += days;
            else if (lt === 'CT') entry.cuti += days;
            else if (lt === 'H1') entry.haid += days;
            else if (lt === 'H2') entry.hamil += days;
            else if (lt === 'A') entry.alpha += days;
            else if (lt === 'CTH' || lt === 'P1' || lt === 'P2' || lt === 'P3') entry.cth += days;
        }

        const allEmps = [...new Set([...mSAtt.keys(), ...mSOt.keys(), ...mSLf.keys(), ...sLeaveByEmp.keys()])].sort();
        const empInfo = await this.getEmpInfo(allEmps);

        const rows = allEmps.map(ec => {
            const info = empInfo.get(ec);
            const sHk = Number(mSAtt.get(ec)?.hk ?? 0);
            const pHk = Number(mPAtt.get(ec)?.hk ?? 0);
            const sOtJam = Number(mSOt.get(ec)?.jam ?? 0);
            const pOtJam = Number(mPOt.get(ec)?.jam ?? 0);
            const sBunches = Number(mSLf.get(ec)?.bunches ?? 0);
            const pMt = Number(mPLf.get(ec)?.mt ?? 0);
            const sLeave = sLeaveByEmp.get(ec);
            const pLeaveDays = pLeaveByEmp.get(ec) ?? 0;
            return {
                emp_code: ec, emp_name: info?.name ?? '', gang_code: info?.gang_code ?? '', division: info?.division ?? '',
                s_hk: sHk, p_hk: pHk, diff_hk: sHk - pHk,
                s_ot_jam: sOtJam, p_ot_jam: pOtJam, diff_ot: +(sOtJam - pOtJam).toFixed(2),
                s_bunches: sBunches, p_mt: pMt, diff_lf: +(sBunches - pMt).toFixed(2),
                s_leave_days: sLeave?.total ?? 0, s_leave_sakit: sLeave?.sakit ?? 0, s_leave_cuti: sLeave?.cuti ?? 0, s_leave_alpha: sLeave?.alpha ?? 0,
                p_leave_days: pLeaveDays, diff_leave: (sLeave?.total ?? 0) - pLeaveDays,
                has_diff: sHk !== pHk || Math.abs(sOtJam - pOtJam) > 0.01 || Math.abs(sBunches - pMt) > 0.01 || (sLeave?.total ?? 0) !== pLeaveDays,
            };
        });

        const match = rows.filter(r => !r.has_diff).length;
        return { rows, summary: { total: rows.length, match, diff: rows.length - match, pct_match: rows.length ? ((match / rows.length) * 100).toFixed(1) : '0.0' } };
    }

    // ============================================================
    // 7. PIVOT MATRIX: per-employee × per-day for a full month
    //    Returns data ready for a date-as-columns matrix table
    // ============================================================

    async pivotAttendance(month: number, year: number, gang?: string, division?: string) {
        const gangMembers = await this.getGangMembers(gang, division);
        const gangFilter = gangMembers ? `AND WORKERCODE IN (${[...gangMembers].map(e => `'${e.replace(/'/g,"''")}'`).join(',')})` : '';

        // Staging: rows per worker per day
        const staging = await this.stagingDb.query<any>(
            `SELECT WORKERCODE, DAY(TRANSDATE) as day, COUNT(*) as trx
             FROM [${STAGING_CATALOG}].[dbo].[Gwscannerdata]
             WHERE YEAR(TRANSDATE) = ? AND MONTH(TRANSDATE) = ?
               AND WORKERCODE IS NOT NULL
               AND (TRANSSTATUS = 'OK' OR TRANSSTATUS LIKE 'OK%') ${gangFilter}
             GROUP BY WORKERCODE, DAY(TRANSDATE)`,
            [year, month],
        );

        // Prod: rows per worker per day
        const prod = await this.prodDb.query<any>(
            `SELECT EmpCode, DAY(TrxDate) as day, COUNT(*) as trx, SUM(Hours) as hours
             FROM PR_TASKREGLN WITH (NOLOCK)
             WHERE YEAR(TrxDate) = ? AND MONTH(TrxDate) = ? AND OT = 0
             ${gangMembers ? `AND EmpCode IN (${[...gangMembers].map(e => `'${e.replace(/'/g,"''")}'`).join(',')})` : ''}
             GROUP BY EmpCode, DAY(TrxDate)`,
            [year, month],
        );

        // Build pivot maps
        const stagingMap = new Map<string, Map<number, number>>();
        for (const r of staging) {
            const ec = String(r.WORKERCODE).trim();
            if (!stagingMap.has(ec)) stagingMap.set(ec, new Map());
            stagingMap.get(ec)!.set(Number(r.day), r.trx);
        }
        const prodMap = new Map<string, Map<number, { trx: number; hours: number }>>();
        for (const r of prod) {
            const ec = String(r.EmpCode).trim();
            if (!prodMap.has(ec)) prodMap.set(ec, new Map());
            prodMap.get(ec)!.set(Number(r.day), { trx: r.trx, hours: r.hours });
        }

        const allEmps = [...new Set([...stagingMap.keys(), ...prodMap.keys()])].sort();
        const empInfo = await this.getEmpInfo(allEmps);
        const daysInMonth = new Date(year, month, 0).getDate();

        const rows = allEmps.map(ec => {
            const info = empInfo.get(ec);
            const sMap = stagingMap.get(ec) ?? new Map();
            const pMap = prodMap.get(ec) ?? new Map();
            const days: Record<number, { s: number; p: number; diff: boolean }> = {};
            for (let d = 1; d <= daysInMonth; d++) {
                const s = sMap.get(d) ?? 0;
                const p = pMap.get(d) ?? 0;
                days[d] = { s, p, diff: s !== p };
            }
            const totalS = [...sMap.values()].reduce((a, b) => a + b, 0);
            const totalP = [...pMap.values()].reduce((a, b) => a + b.trx, 0);
            return { emp_code: ec, emp_name: info?.name ?? '', gang_code: info?.gang_code ?? '', division: info?.division ?? '', days, total_staging: totalS, total_prod: totalP, has_diff: totalS !== totalP };
        });

        return { rows, days_in_month: daysInMonth, month, year };
    }

    async pivotOvertime(month: number, year: number, gang?: string, division?: string) {
        const gangMembers = await this.getGangMembers(gang, division);
        const gangFilter = gangMembers ? `AND WORKERCODE IN (${[...gangMembers].map(e => `'${e.replace(/'/g,"''")}'`).join(',')})` : '';

        const staging = await this.stagingDb.query<any>(
            `SELECT WORKERCODE, DAY(TRANSDATE) as day, SUM(HOURS) as hours
             FROM [${STAGING_CATALOG}].[dbo].[Overtime]
             WHERE YEAR(TRANSDATE) = ? AND MONTH(TRANSDATE) = ?
               AND WORKERCODE IS NOT NULL
               AND (TRANSSTATUS = 'OK' OR TRANSSTATUS LIKE 'OK%') ${gangFilter}
             GROUP BY WORKERCODE, DAY(TRANSDATE)`,
            [year, month],
        );

        const prod = await this.prodDb.query<any>(
            `SELECT EmpCode, DAY(TrxDate) as day, SUM(Hours) as hours
             FROM PR_TASKREGLN WITH (NOLOCK)
             WHERE YEAR(TrxDate) = ? AND MONTH(TrxDate) = ? AND OT = 1
             ${gangMembers ? `AND EmpCode IN (${[...gangMembers].map(e => `'${e.replace(/'/g,"''")}'`).join(',')})` : ''}
             GROUP BY EmpCode, DAY(TrxDate)`,
            [year, month],
        );

        const stagingMap = new Map<string, Map<number, number>>();
        for (const r of staging) {
            const ec = String(r.WORKERCODE).trim();
            if (!stagingMap.has(ec)) stagingMap.set(ec, new Map());
            stagingMap.get(ec)!.set(Number(r.day), Number(r.hours));
        }
        const prodMap = new Map<string, Map<number, number>>();
        for (const r of prod) {
            const ec = String(r.EmpCode).trim();
            if (!prodMap.has(ec)) prodMap.set(ec, new Map());
            prodMap.get(ec)!.set(Number(r.day), Number(r.hours));
        }

        const allEmps = [...new Set([...stagingMap.keys(), ...prodMap.keys()])].sort();
        const empInfo = await this.getEmpInfo(allEmps);
        const daysInMonth = new Date(year, month, 0).getDate();

        const rows = allEmps.map(ec => {
            const info = empInfo.get(ec);
            const sMap = stagingMap.get(ec) ?? new Map();
            const pMap = prodMap.get(ec) ?? new Map();
            const days: Record<number, { s: number; p: number; diff: boolean }> = {};
            for (let d = 1; d <= daysInMonth; d++) {
                const s = sMap.get(d) ?? 0;
                const p = pMap.get(d) ?? 0;
                days[d] = { s, p, diff: Math.abs(s - p) > 0.01 };
            }
            const totalS = [...sMap.values()].reduce((a, b) => a + b, 0);
            const totalP = [...pMap.values()].reduce((a, b) => a + b, 0);
            return { emp_code: ec, emp_name: info?.name ?? '', gang_code: info?.gang_code ?? '', division: info?.division ?? '', days, total_staging: totalS, total_prod: totalP, has_diff: Math.abs(totalS - totalP) > 0.01 };
        });

        return { rows, days_in_month: daysInMonth, month, year };
    }

    async pivotLoosefruit(month: number, year: number, gang?: string, division?: string) {
        const gangMembers = await this.getGangMembers(gang, division);
        const gangFilter = gangMembers ? `AND WORKERCODE IN (${[...gangMembers].map(e => `'${e.replace(/'/g,"''")}'`).join(',')})` : '';

        const staging = await this.stagingDb.query<any>(
            `SELECT WORKERCODE, DAY(TRANSDATE) as day, SUM(CAST(LOOSEFRUIT AS INT)) as bunches
             FROM [${STAGING_CATALOG}].[dbo].[Ffbscannerdata]
             WHERE YEAR(TRANSDATE) = ? AND MONTH(TRANSDATE) = ?
               AND CAST(LOOSEFRUIT AS INT) > 0
               AND (TRANSSTATUS = 'OK' OR TRANSSTATUS LIKE 'OK%') ${gangFilter}
             GROUP BY WORKERCODE, DAY(TRANSDATE)`,
            [year, month],
        );

        const prod = await this.prodDb.query<any>(
            `SELECT EmpCode, DAY(TrxDate) as day, SUM(MT) as mt
             FROM PR_LOOSEFRUITLN WITH (NOLOCK)
             WHERE YEAR(TrxDate) = ? AND MONTH(TrxDate) = ?
             ${gangMembers ? `AND EmpCode IN (${[...gangMembers].map(e => `'${e.replace(/'/g,"''")}'`).join(',')})` : ''}
             GROUP BY EmpCode, DAY(TrxDate)`,
            [year, month],
        );

        const stagingMap = new Map<string, Map<number, number>>();
        for (const r of staging) {
            const ec = String(r.WORKERCODE).trim();
            if (!stagingMap.has(ec)) stagingMap.set(ec, new Map());
            stagingMap.get(ec)!.set(Number(r.day), Number(r.bunches));
        }
        const prodMap = new Map<string, Map<number, number>>();
        for (const r of prod) {
            const ec = String(r.EmpCode).trim();
            if (!prodMap.has(ec)) prodMap.set(ec, new Map());
            prodMap.get(ec)!.set(Number(r.day), Number(r.mt));
        }

        const allEmps = [...new Set([...stagingMap.keys(), ...prodMap.keys()])].sort();
        const empInfo = await this.getEmpInfo(allEmps);
        const daysInMonth = new Date(year, month, 0).getDate();

        const rows = allEmps.map(ec => {
            const info = empInfo.get(ec);
            const sMap = stagingMap.get(ec) ?? new Map();
            const pMap = prodMap.get(ec) ?? new Map();
            const days: Record<number, { s: number; p: number; diff: boolean }> = {};
            for (let d = 1; d <= daysInMonth; d++) {
                const s = sMap.get(d) ?? 0;
                const p = pMap.get(d) ?? 0;
                days[d] = { s, p, diff: Math.abs(s - p) > 0.01 };
            }
            const totalS = [...sMap.values()].reduce((a, b) => a + b, 0);
            const totalP = [...pMap.values()].reduce((a, b) => a + b, 0);
            return { emp_code: ec, emp_name: info?.name ?? '', gang_code: info?.gang_code ?? '', division: info?.division ?? '', days, total_staging: totalS, total_prod: totalP, has_diff: Math.abs(totalS - totalP) > 0.01 };
        });

        return { rows, days_in_month: daysInMonth, month, year };
    }

    async monthlyAttendance(month: number, year: number, gang?: string, division?: string) {
        const gangMembers = await this.getGangMembers(gang, division);
        const gangFilter = gangMembers ? `AND WORKERCODE IN (${[...gangMembers].map(e => `'${e.replace(/'/g,"''")}'`).join(',')})` : '';

        const staging = await this.stagingDb.query<any>(
            `SELECT WORKERCODE, COUNT(*) as staging_days, SUM(1) as staging_trx
             FROM [${STAGING_CATALOG}].[dbo].[Gwscannerdata]
             WHERE YEAR(TRANSDATE) = ? AND MONTH(TRANSDATE) = ?
               AND WORKERCODE IS NOT NULL ${gangFilter}
             GROUP BY WORKERCODE ORDER BY WORKERCODE`,
            [year, month],
        );

        const empCodes = staging.map((r: any) => String(r.WORKERCODE).trim());
        const empInfo = await this.getEmpInfo(empCodes);

        // Batched prod query (was N+1)
        const empList = empCodes.length ? `('${empCodes.map(e => e.replace(/'/g, "''")).join("','")}')` : "('')";
        const prod = await this.prodDb.query<any>(
            `SELECT EmpCode, COUNT(*) as prod_days, SUM(Hours) as prod_hours
             FROM PR_TASKREGLN WITH (NOLOCK)
             WHERE EmpCode IN ${empList} AND YEAR(TrxDate) = ? AND MONTH(TrxDate) = ? AND OT = 0
             GROUP BY EmpCode`,
            [year, month],
        );
        const prodMap = new Map(prod.map((r: any) => [String(r.EmpCode).trim(), r]));

        const rows = staging.map((s: any) => {
            const empCode = String(s.WORKERCODE).trim();
            const p = prodMap.get(empCode);
            const info = empInfo.get(empCode);
            const stagingDays = s.staging_days ?? 0;
            const prodDays = p?.prod_days ?? 0;
            return {
                emp_code: empCode,
                emp_name: info?.name ?? '',
                gang_code: info?.gang_code ?? '',
                division: info?.division ?? '',
                staging_days: stagingDays,
                prod_days: prodDays,
                prod_hours: p?.prod_hours ?? 0,
                delta_days: stagingDays - prodDays,
                status: stagingDays === prodDays ? 'match' : 'diff',
            };
        });
        const match = rows.filter(r => r.status === 'match').length;
        return { rows, summary: { total: rows.length, match, diff: rows.length - match, pct_match: rows.length ? ((match / rows.length) * 100).toFixed(1) : '0.0' } };
    }

    async monthlyOvertime(month: number, year: number, gang?: string, division?: string) {
        const gangMembers = await this.getGangMembers(gang, division);
        const gangFilter = gangMembers ? `AND WORKERCODE IN (${[...gangMembers].map(e => `'${e.replace(/'/g,"''")}'`).join(',')})` : '';

        const staging = await this.stagingDb.query<any>(
            `SELECT WORKERCODE, COUNT(*) as staging_days, SUM(HOURS) as staging_hours
             FROM [${STAGING_CATALOG}].[dbo].[Overtime]
             WHERE YEAR(TRANSDATE) = ? AND MONTH(TRANSDATE) = ?
               AND WORKERCODE IS NOT NULL ${gangFilter}
             GROUP BY WORKERCODE ORDER BY WORKERCODE`,
            [year, month],
        );

        const empCodes = staging.map((r: any) => String(r.WORKERCODE).trim());
        const empInfo = await this.getEmpInfo(empCodes);

        // Batched prod query (was N+1)
        const empList = empCodes.length ? `('${empCodes.map(e => e.replace(/'/g, "''")).join("','")}')` : "('')";
        const prod = await this.prodDb.query<any>(
            `SELECT EmpCode, COUNT(*) as prod_days, SUM(Hours) as prod_hours
             FROM PR_TASKREGLN WITH (NOLOCK)
             WHERE EmpCode IN ${empList} AND YEAR(TrxDate) = ? AND MONTH(TrxDate) = ? AND OT = 1
             GROUP BY EmpCode`,
            [year, month],
        );
        const prodMap = new Map(prod.map((r: any) => [String(r.EmpCode).trim(), r]));

        const rows = staging.map((s: any) => {
            const empCode = String(s.WORKERCODE).trim();
            const p = prodMap.get(empCode);
            const info = empInfo.get(empCode);
            const sh = Number(s.staging_hours ?? 0);
            const ph = Number(p?.prod_hours ?? 0);
            return {
                emp_code: empCode,
                emp_name: info?.name ?? '',
                gang_code: info?.gang_code ?? '',
                division: info?.division ?? '',
                staging_days: s.staging_days ?? 0,
                staging_hours: sh,
                prod_days: p?.prod_days ?? 0,
                prod_hours: ph,
                delta_hours: sh - ph,
                status: Math.abs(sh - ph) < 0.01 ? 'match' : 'diff',
            };
        });
        const match = rows.filter(r => r.status === 'match').length;
        return { rows, summary: { total: rows.length, match, diff: rows.length - match, pct_match: rows.length ? ((match / rows.length) * 100).toFixed(1) : '0.0' } };
    }

    async monthlyLoosefruit(month: number, year: number, gang?: string, division?: string) {
        const gangMembers = await this.getGangMembers(gang, division);
        const gangFilter = gangMembers ? `AND WORKERCODE IN (${[...gangMembers].map(e => `'${e.replace(/'/g,"''")}'`).join(',')})` : '';

        const staging = await this.stagingDb.query<any>(
            `SELECT WORKERCODE, SUM(CAST(LOOSEFRUIT AS INT)) as staging_bunches, COUNT(*) as staging_trx
             FROM [${STAGING_CATALOG}].[dbo].[Ffbscannerdata]
             WHERE YEAR(TRANSDATE) = ? AND MONTH(TRANSDATE) = ?
               AND CAST(LOOSEFRUIT AS INT) > 0 ${gangFilter}
             GROUP BY WORKERCODE ORDER BY WORKERCODE`,
            [year, month],
        );

        const empCodes = staging.map((r: any) => String(r.WORKERCODE).trim());
        const empInfo = await this.getEmpInfo(empCodes);

        // Batched prod query (was N+1)
        const empList = empCodes.length ? `('${empCodes.map(e => e.replace(/'/g, "''")).join("','")}')` : "('')";
        const prod = await this.prodDb.query<any>(
            `SELECT EmpCode, SUM(MT) as prod_mt, COUNT(*) as prod_days
             FROM PR_LOOSEFRUITLN WITH (NOLOCK)
             WHERE EmpCode IN ${empList} AND YEAR(TrxDate) = ? AND MONTH(TrxDate) = ?
             GROUP BY EmpCode`,
            [year, month],
        );
        const prodMap = new Map(prod.map((r: any) => [String(r.EmpCode).trim(), r]));

        const rows = staging.map((s: any) => {
            const empCode = String(s.WORKERCODE).trim();
            const p = prodMap.get(empCode);
            const info = empInfo.get(empCode);
            const sb = Number(s.staging_bunches ?? 0);
            const pm = Number(p?.prod_mt ?? 0);
            return {
                emp_code: empCode,
                emp_name: info?.name ?? '',
                gang_code: info?.gang_code ?? '',
                division: info?.division ?? '',
                staging_bunches: sb,
                staging_trx: s.staging_trx ?? 0,
                prod_mt: pm,
                prod_days: p?.prod_days ?? 0,
                delta: sb - pm,
                status: p?.prod_days ? (Math.abs(sb - pm) < 0.01 ? 'match' : 'diff') : 'miss',
            };
        });
        const match = rows.filter(r => r.status === 'match').length;
        return { rows, summary: { total: rows.length, match, diff: rows.length - match, pct_match: rows.length ? ((match / rows.length) * 100).toFixed(1) : '0.0' } };
    }


    // ============================================================
    // 10. EMPLOYEE DETAIL: per-day raw rows for one employee (debug)
    // ============================================================

    async employeeDetail(empCode: string, month: number, year: number) {
        const ec = empCode.trim();
        const [sAtt, sOt, sLf, pAtt, pOt, pLf, empRows] = await Promise.all([
            this.stagingDb.query<any>(
                `SELECT CAST(TRANSDATE AS DATE) as tgl, JOBCODE, FIELDNO, FROMOCCODE, TRANSNO, TRANSSTATUS
                 FROM [${STAGING_CATALOG}].[dbo].[Gwscannerdata]
                 WHERE WORKERCODE = ? AND YEAR(TRANSDATE) = ? AND MONTH(TRANSDATE) = ?
                 ORDER BY TRANSDATE`,
                [ec, year, month],
            ),
            this.stagingDb.query<any>(
                `SELECT CAST(TRANSDATE AS DATE) as tgl, JOBCODE, HOURS, BASICRATE, ADDRATE, TRANSNO, TRANSSTATUS
                 FROM [${STAGING_CATALOG}].[dbo].[Overtime]
                 WHERE WORKERCODE = ? AND YEAR(TRANSDATE) = ? AND MONTH(TRANSDATE) = ?
                 ORDER BY TRANSDATE`,
                [ec, year, month],
            ),
            this.stagingDb.query<any>(
                `SELECT CAST(TRANSDATE AS DATE) as tgl, FROMOCCODE, LOOSEFRUIT, TASKNO, TRANSNO, TRANSSTATUS
                 FROM [${STAGING_CATALOG}].[dbo].[Ffbscannerdata]
                 WHERE WORKERCODE = ? AND YEAR(TRANSDATE) = ? AND MONTH(TRANSDATE) = ?
                   AND CAST(LOOSEFRUIT AS INT) > 0
                 ORDER BY TRANSDATE`,
                [ec, year, month],
            ),
            this.prodDb.query<any>(
                `SELECT CAST(TrxDate AS DATE) as tgl, TaskCode, Hours, ChargeTo, Rate, ID
                 FROM PR_TASKREGLN WITH (NOLOCK)
                 WHERE EmpCode = ? AND YEAR(TrxDate) = ? AND MONTH(TrxDate) = ? AND OT = 0
                 ORDER BY TrxDate`,
                [ec, year, month],
            ),
            this.prodDb.query<any>(
                `SELECT CAST(TrxDate AS DATE) as tgl, TaskCode, Hours, Rate, ChargeTo, ID
                 FROM PR_TASKREGLN WITH (NOLOCK)
                 WHERE EmpCode = ? AND YEAR(TrxDate) = ? AND MONTH(TrxDate) = ? AND OT = 1
                 ORDER BY TrxDate`,
                [ec, year, month],
            ),
            this.prodDb.query<any>(
                `SELECT CAST(TrxDate AS DATE) as tgl, MT, ChargeTo, MasterID, ID
                 FROM PR_LOOSEFRUITLN WITH (NOLOCK)
                 WHERE EmpCode = ? AND YEAR(TrxDate) = ? AND MONTH(TrxDate) = ?
                 ORDER BY TrxDate`,
                [ec, year, month],
            ),
            this.prodDb.query<any>(
                `SELECT e.EmpCode, e.EmpName, g.GangCode, g.LocCode
                 FROM HR_EMPLOYEE e WITH (NOLOCK)
                 LEFT JOIN HR_GANGLN gl WITH (NOLOCK) ON gl.GangMember = e.EmpCode
                 LEFT JOIN HR_GANG g WITH (NOLOCK) ON g.GangCode = gl.GangCode
                 WHERE e.EmpCode = ?`,
                [ec],
            ),
        ]);

        const info = empRows[0] ?? null;

        const attByDay = new Map<string, { s: any[]; p: any[] }>();
        const otByDay  = new Map<string, { s: any[]; p: any[] }>();
        const lfByDay  = new Map<string, { s: any[]; p: any[] }>();

        const ensure = (map: Map<string, { s: any[]; p: any[] }>, date: string) => {
            if (!map.has(date)) map.set(date, { s: [], p: [] });
            return map.get(date)!;
        };

        const isCancelled = (r: any) => !(String(r.TRANSSTATUS ?? '').startsWith('OK'));

        for (const r of sAtt) ensure(attByDay, String(r.tgl).slice(0,10)).s.push({ job_code: r.JOBCODE, field: r.FIELDNO, oc: r.FROMOCCODE, trans_no: r.TRANSNO, cancelled: isCancelled(r) });
        for (const r of pAtt) ensure(attByDay, String(r.tgl).slice(0,10)).p.push({ task_code: r.TaskCode, hours: r.Hours, charge_to: r.ChargeTo, rate: r.Rate, id: r.ID });
        for (const r of sOt)  ensure(otByDay,  String(r.tgl).slice(0,10)).s.push({ job_code: r.JOBCODE, hours: r.HOURS, rate: r.BASICRATE, add_rate: r.ADDRATE, trans_no: r.TRANSNO, cancelled: isCancelled(r) });
        for (const r of pOt)  ensure(otByDay,  String(r.tgl).slice(0,10)).p.push({ task_code: r.TaskCode, hours: r.Hours, rate: r.Rate, charge_to: r.ChargeTo, id: r.ID });
        for (const r of sLf)  ensure(lfByDay,  String(r.tgl).slice(0,10)).s.push({ oc: r.FROMOCCODE, bunches: r.LOOSEFRUIT, task_no: r.TASKNO, trans_no: r.TRANSNO, cancelled: isCancelled(r) });
        for (const r of pLf)  ensure(lfByDay,  String(r.tgl).slice(0,10)).p.push({ mt: r.MT, charge_to: r.ChargeTo, master_id: r.MasterID, id: r.ID });

        // Attendance: exclude cancelled from diff check.
        // Rule: cancelled staging + prod data = ERROR (should be 0 in prod)
        const attRows = [...attByDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, { s, p }]) => {
            const sValid = s.filter((r: any) => !r.cancelled);
            const sCancelled = s.filter((r: any) => r.cancelled);
            const cancelledButInProd = sCancelled.length > 0 && p.length > 0;
            const has_diff = (sValid.length > 0) !== (p.length > 0) || cancelledButInProd;
            return { date, staging: s, prod: p, has_diff };
        });

        // Overtime: exclude cancelled hours from comparison
        const otRows = [...otByDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, { s, p }]) => {
            const sHours = s.filter((r: any) => !r.cancelled).reduce((acc: number, r: any) => acc + Number(r.hours ?? 0), 0);
            const pHours = p.reduce((acc: number, r: any) => acc + Number(r.hours ?? 0), 0);
            const sCancelled = s.filter((r: any) => r.cancelled);
            const cancelledButInProd = sCancelled.length > 0 && p.length > 0;
            return { date, staging: s, prod: p, has_diff: Math.abs(sHours - pHours) > 0.01 || cancelledButInProd };
        });

        // Loosefruit: exclude cancelled from bunches total and TRANSNO matching
        const lfRows = [...lfByDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, { s, p }]) => {
            const sValid = s.filter((r: any) => !r.cancelled);
            const sCancelled = s.filter((r: any) => r.cancelled);
            const sBunches = sValid.reduce((acc: number, r: any) => acc + Number(r.bunches ?? 0), 0);
            const pMt      = p.reduce((acc: number, r: any) => acc + Number(r.mt ?? 0), 0);
            const prodMasterIds = new Set(p.map((r: any) => String(r.master_id ?? '')));
            const sWithMatch = s.map((r: any) => ({
                ...r,
                matched: r.cancelled
                    ? !prodMasterIds.has(String(r.trans_no ?? ''))
                    : prodMasterIds.has(String(r.trans_no ?? '')),
            }));
            const cancelledButInProd = sCancelled.some((r: any) => prodMasterIds.has(String(r.trans_no ?? '')));
            const allValidMatched = sValid.every((r: any) => prodMasterIds.has(String(r.trans_no ?? ''))) && sValid.length === p.length;
            return {
                date, staging: sWithMatch, prod: p,
                staging_bunches: sBunches, prod_mt: pMt,
                has_diff: !allValidMatched || Math.abs(sBunches - pMt) > 0.01 || cancelledButInProd,
            };
        });

        return {
            emp_code: ec,
            emp_name: String(info?.EmpName ?? '').trim(),
            gang_code: String(info?.GangCode ?? '').trim(),
            division: String(info?.LocCode ?? '').trim(),
            month, year,
            attendance: attRows,
            overtime:   otRows,
            loosefruit: lfRows,
        };
    }

    // ============================================================
    // 10. CELL DETAIL: raw rows for one (module, emp_code, day) cell
    // ============================================================

    async cellDetail(module: string, empCode: string, date: string) {
        const ec = empCode.trim();
        const d = String(date).slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error("Invalid date format, expected YYYY-MM-DD");

        if (module === "attendance") {
            const [s, p] = await Promise.all([
                this.stagingDb.query<any>(
                    `SELECT WORKERCODE, JOBCODE, FIELDNO, FROMOCCODE, TRANSNO, TRANSSTATUS
                     FROM [${STAGING_CATALOG}].[dbo].[Gwscannerdata]
                     WHERE WORKERCODE = ? AND CAST(TRANSDATE AS DATE) = ?`,
                    [ec, d],
                ),
                this.prodDb.query<any>(
                    `SELECT TaskCode, Hours, Rate, ChargeTo, ID, OT
                     FROM PR_TASKREGLN WITH (NOLOCK)
                     WHERE EmpCode = ? AND CAST(TrxDate AS DATE) = ? AND OT = 0`,
                    [ec, d],
                ),
            ]);
            return { module, emp_code: ec, date: d, staging: s, prod: p };
        }

        if (module === "overtime") {
            const [s, p] = await Promise.all([
                this.stagingDb.query<any>(
                    `SELECT WORKERCODE, JOBCODE, HOURS, BASICRATE, ADDRATE, TRANSNO, TRANSSTATUS
                     FROM [${STAGING_CATALOG}].[dbo].[Overtime]
                     WHERE WORKERCODE = ? AND CAST(TRANSDATE AS DATE) = ?`,
                    [ec, d],
                ),
                this.prodDb.query<any>(
                    `SELECT TaskCode, Hours, Rate, ChargeTo, ID
                     FROM PR_TASKREGLN WITH (NOLOCK)
                     WHERE EmpCode = ? AND CAST(TrxDate AS DATE) = ? AND OT = 1`,
                    [ec, d],
                ),
            ]);
            return { module, emp_code: ec, date: d, staging: s, prod: p };
        }

        if (module === "loosefruit") {
            const [s, p] = await Promise.all([
                this.stagingDb.query<any>(
                    `SELECT WORKERCODE, FROMOCCODE, LOOSEFRUIT, TASKNO, TRANSNO, TRANSSTATUS
                     FROM [${STAGING_CATALOG}].[dbo].[Ffbscannerdata]
                     WHERE WORKERCODE = ? AND CAST(TRANSDATE AS DATE) = ? AND CAST(LOOSEFRUIT AS INT) > 0`,
                    [ec, d],
                ),
                this.prodDb.query<any>(
                    `SELECT MT, ChargeTo, MasterID, ID
                     FROM PR_LOOSEFRUITLN WITH (NOLOCK)
                     WHERE EmpCode = ? AND CAST(TrxDate AS DATE) = ?`,
                    [ec, d],
                ),
            ]);
            return { module, emp_code: ec, date: d, staging: s, prod: p };
        }

        throw new Error(`Unknown module: ${module}`);
    }

    // ============================================================
    // 11. MONTHLY BRONDOL COMPARISON (Staging Ffbscannerdata.LOOSEFRUIT vs PR_LOOSEFRUITLN)
    //   Returns per-employee identity + brondol selisih aggregated across the month.
    // ============================================================

    async monthlyBrondolComparison(month: number, year: number, gang?: string, division?: string) {
        if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error("Invalid month (1-12)");
        if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error("Invalid year");

        const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
        const endDate = new Date(year, month, 1).toISOString().slice(0, 10); // exclusive first of next month

        // 1) staging brondol: sum LOOSEFRUIT grouped by WORKERCODE
        const stagingSql = `
            SELECT WORKERCODE AS emp_code,
                   SUM(CAST(LOOSEFRUIT AS DECIMAL(18,2))) AS staging_brondol
            FROM [${STAGING_CATALOG}].[dbo].[Ffbscannerdata] WITH (NOLOCK)
            WHERE CAST(TRANSDATE AS DATE) >= ? AND CAST(TRANSDATE AS DATE) < ?
              AND CAST(LOOSEFRUIT AS INT) > 0
            ${gang ? "AND EXISTS (SELECT 1 FROM [" + STAGING_CATALOG + "].[dbo].[HR_GANGLN] g WHERE g.EmpCode = [Ffbscannerdata].WORKERCODE AND g.GangCode = ?)" : ""}
            GROUP BY WORKERCODE
        `;
        const stagingParams: any[] = [startDate, endDate];
        if (gang) stagingParams.push(gang);
        const stagingRows = await this.stagingDb.query<any>(stagingSql, stagingParams);

        // 2) plantware brondol: sum from PR_LOOSEFRUITLN grouped by EmpCode
        const prodSql = `
            SELECT l.EmpCode AS emp_code,
                   SUM(ISNULL(l.MT, 0)) AS plantware_brondol
            FROM PR_LOOSEFRUITLN l WITH (NOLOCK)
            WHERE CAST(l.TrxDate AS DATE) >= ? AND CAST(l.TrxDate AS DATE) < ?
            ${division ? "AND EXISTS (SELECT 1 FROM HR_EMPLOYEE e WHERE e.EmpCode = l.EmpCode AND e.LocCode = ?)" : ""}
            GROUP BY l.EmpCode
        `;
        const prodParams: any[] = [startDate, endDate];
        if (division) prodParams.push(division);
        const prodRows = await this.prodDb.query<any>(prodSql, prodParams);

        // 3) Merge into a map keyed by emp_code
        const map = new Map<string, { emp_code: string; staging_brondol: number; plantware_brondol: number; selisih: number }>();
        for (const r of stagingRows) {
            const ec = String(r.emp_code ?? "").trim();
            if (!ec) continue;
            const sb = Number(r.staging_brondol ?? 0);
            map.set(ec, { emp_code: ec, staging_brondol: sb, plantware_brondol: 0, selisih: sb });
        }
        for (const r of prodRows) {
            const ec = String(r.emp_code ?? "").trim();
            if (!ec) continue;
            const pb = Number(r.plantware_brondol ?? 0);
            const existing = map.get(ec);
            if (existing) {
                existing.plantware_brondol = pb;
                existing.selisih = Number((existing.staging_brondol - pb).toFixed(2));
            } else {
                map.set(ec, { emp_code: ec, staging_brondol: 0, plantware_brondol: pb, selisih: Number((0 - pb).toFixed(2)) });
            }
        }

        // 4) Attach identity fields from Plantware employee master (one batch lookup)
        const empCodes = Array.from(map.keys());
        let identityMap = new Map<string, { emp_name: string; gang_code: string; gang_name: string; division: string; loccode: string }>();
        if (empCodes.length > 0) {
            const placeholders = empCodes.map(() => "?").join(",");
            const idRows = await this.prodDb.query<any>(
                `SELECT e.EmpCode, e.EmpName, e.LocCode, g.GangCode, g.Description AS GangName
                 FROM HR_EMPLOYEE e WITH (NOLOCK)
                 LEFT JOIN HR_GANGLN gl WITH (NOLOCK) ON gl.GangMember = e.EmpCode
                 LEFT JOIN HR_GANG g WITH (NOLOCK) ON g.GangCode = gl.GangCode
                 WHERE e.EmpCode IN (${placeholders})`,
                empCodes,
            );
            for (const r of idRows) {
                const ec = String(r.EmpCode ?? "").trim();
                if (!ec) continue;
                identityMap.set(ec, {
                    emp_name: String(r.EmpName ?? "").trim(),
                    gang_code: String(r.GangCode ?? "").trim(),
                    gang_name: String(r.GangName ?? "").trim(),
                    division: String(r.LocCode ?? "").trim(),
                    loccode: String(r.LocCode ?? "").trim(),
                });
            }
        }

        // 5) Compose final rows
        const rows = Array.from(map.values()).map((r) => {
            const id = identityMap.get(r.emp_code);
            return {
                emp_code: r.emp_code,
                emp_name: id?.emp_name ?? "",
                gang: id?.gang_code ?? "",
                gang_name: id?.gang_name ?? "",
                divisi: id?.division ?? "",
                estate: id?.loccode ?? "",
                staging_brondol: r.staging_brondol,
                plantware_brondol: r.plantware_brondol,
                selisih: r.selisih,
            };
        });

        // 6) Sort: by selisih desc (biggest gap first), then by emp_code asc
        rows.sort((a, b) => b.selisih - a.selisih || a.emp_code.localeCompare(b.emp_code));

        const totalSelisih = Number(rows.reduce((s, r) => s + r.selisih, 0).toFixed(2));
        const totalStaging = Number(rows.reduce((s, r) => s + r.staging_brondol, 0).toFixed(2));
        const totalPlantware = Number(rows.reduce((s, r) => s + r.plantware_brondol, 0).toFixed(2));

        return {
            month, year,
            periode: `${year}-${String(month).padStart(2, "0")}`,
            gang: gang ?? null,
            division: division ?? null,
            count: rows.length,
            totals: { staging_brondol: totalStaging, plantware_brondol: totalPlantware, selisih: totalSelisih },
            rows,
        };
    }
}
