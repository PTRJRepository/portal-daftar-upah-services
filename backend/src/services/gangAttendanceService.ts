/**
 * Gang Attendance Matrix Service
 * 
 * Generates attendance matrix for ALL employees in a gang or set of gangs.
 * Each employee gets a row with 1-31 day columns showing attendance status.
 * 
 * PRIMARY DATA SOURCE: extend_db_ptrj (historical snapshot database)
 * - Member list: dbo.history_gang_member (joined by emp_code)
 * - Attendance: dbo.history_taskreg (joined by emp_code)
 * - Bank account: HR_PAYROLL.BankAccNo (joined by EmpCode)
 * - NIK: HR_EMPLOYEE.NewICNo (derived from EmpCode)
 * 
 * EmpCode is the PRIMARY KEY for all joins and lookups.
 */

import { Database } from "../db/client";
import { faceVerificationService } from "./faceVerificationService";
import { lemburCalculator } from "./lemburCalculator";

// Status codes for the matrix cells
export type AttendanceStatus = 'H' | 'C' | 'S' | 'M' | 'N' | 'A' | '-' | 'L';

export interface GangMember {
    emp_code: string;
    emp_name: string;
    nik: string;
    gang_code: string;
    division_code: string;
    bank_acc_no: string;
    bank_code: string;
}

export interface GangAttendanceRow {
    emp_code: string;
    emp_name: string;
    nik: string;
    gang_code: string;
    bank_acc_no: string;
    daily: Record<number, AttendanceStatus>;  // 1-31 => status
    /** Face verification data from IT Solution API (absen_import). Key = day (1-31), value = hasWork (true/false) */
    face_verification?: Record<number, boolean>;
    summary: {
        hadir: number;
        cuti_tahunan: number;
        cuti_sakit: number;
        cuti_minggu: number;
        libur_nasional: number;
        alpa: number;
        total_hk: number;
    };
}

export interface GetGangAttendanceMatrixOptions {
    /** Whether to fetch face verification data from IT Solution API (default: true) */
    includeFaceVerification?: boolean;
}

export interface GangAttendanceResult {
    gang_code: string;
    gang_description: string;
    month: number;
    year: number;
    days_in_month: number;
    employees: GangAttendanceRow[];
    holidays: Record<number, string>; // day => description
    sundays: number[];
}

class GangAttendanceService {
    private static instance: GangAttendanceService;
    private db: Database;         // Main plantware DB (HR_EMPLOYEE, HR_PAYROLL, HR_GPH)
    private extDb: Database;      // extend_db_ptrj (history_gang_member, history_taskreg)

    private constructor() {
        this.db = Database.getInstance();
        this.extDb = Database.getExtendedInstance();
    }

    public static getInstance(): GangAttendanceService {
        if (!GangAttendanceService.instance) {
            GangAttendanceService.instance = new GangAttendanceService();
        }
        return GangAttendanceService.instance;
    }

    /**
     * Get gang members from HR_GANGLN + HR_EMPLOYEE (main db_ptrj)
     * Uses the current gang membership to get employees.
     * EmpCode is the key — NIK and bank account are resolved afterwards.
     *
     * RULE: emp_code ALWAYS comes from HR_GANGLN.GangMember (gang membership table).
     * This is the authoritative source for who belongs to which gang.
     * NIK is derived from emp_code via HR_EMPLOYEE.NewICNo.
     */
    private async getGangMembersFromMainDb(gangCodes: string[]): Promise<GangMember[]> {
        if (gangCodes.length === 0) return [];

        // Always trim gangCodes input
        const cleanGangCodes = gangCodes.map(gc => (gc || '').trim().toUpperCase()).filter(Boolean);
        const placeholders = cleanGangCodes.map(() => '?').join(',');
        try {
            const rows = await this.db.query<{
                emp_code: string;
                emp_name: string;
                gang_code: string;
                division_code: string;
            }>(`
                SELECT DISTINCT
                    -- emp_code comes from HR_GANGLN.GangMember (authoritative gang membership)
                    -- RTRIM ensures no trailing spaces cause lookup mismatches
                    RTRIM(gl.GangMember) as emp_code,
                    RTRIM(e.EmpName) as emp_name,
                    RTRIM(gl.GangCode) as gang_code,
                    RTRIM(ISNULL(grp.LocCode, SUBSTRING(gl.GangCode, 1, 2))) as division_code
                FROM HR_GANGLN gl
                JOIN HR_EMPLOYEE e ON RTRIM(e.EmpCode) = RTRIM(gl.GangMember)
                LEFT JOIN HR_GANG grp ON RTRIM(grp.GangCode) = RTRIM(gl.GangCode)
                WHERE RTRIM(gl.GangCode) IN (${placeholders})
                ORDER BY gang_code, emp_name
            `, cleanGangCodes);

            console.log(`[GangAttendanceService] Got ${rows.length} members from HR_GANGLN for gangs [${cleanGangCodes.join(',')}]`);

            // CRITICAL: Always trim ALL fields before returning to prevent downstream lookup failures.
            // emp_code is used as the primary key for all subsequent lookups (attendance, NIK, bank).
            return rows.map(r => ({
                emp_code: (r.emp_code || '').trim(), // Ensure no spaces
                emp_name: (r.emp_name || '').trim(),
                nik: '',
                gang_code: (r.gang_code || '').trim(),
                division_code: (r.division_code || '').trim(),
                bank_acc_no: '',
                bank_code: ''
            }));
        } catch (e) {
            console.error("[GangAttendanceService] Error fetching from HR_GANGLN:", e);
            return [];
        }
    }

    /**
     * Resolve NIK (NewICNo) from HR_EMPLOYEE by EmpCode (batch)
     * emp_code is the authoritative key from HR_GANGLN; NIK is derived from it.
     */
    private async resolveNikByEmpCodes(empCodes: string[]): Promise<Map<string, string>> {
        const result = new Map<string, string>();
        if (empCodes.length === 0) return result;

        // Always trim all empCodes to ensure consistent key matching
        const cleanCodes = empCodes.map(ec => (ec || '').trim().toUpperCase()).filter(Boolean);
        if (cleanCodes.length === 0) return result;

        const CHUNK = 500;
        for (let i = 0; i < cleanCodes.length; i += CHUNK) {
            const chunk = cleanCodes.slice(i, i + CHUNK);
            const placeholders = chunk.map(() => '?').join(',');
            try {
                const rows = await this.db.query<{ EmpCode: string; NewICNo: string }>(`
                    SELECT RTRIM(EmpCode) as EmpCode, RTRIM(ISNULL(NewICNo, '')) as NewICNo
                    FROM HR_EMPLOYEE
                    WHERE RTRIM(EmpCode) IN (${placeholders})
                `, chunk);
                for (const r of rows) {
                    // emp_code as key is always trimmed + uppercased
                    result.set(r.EmpCode.trim().toUpperCase(), r.NewICNo?.trim() || '');
                }
            } catch (e) {
                console.error("[GangAttendanceService] Error resolving NIK:", e);
            }
        }
        return result;
    }

    /**
     * Resolve bank account (BankAccNo) from HR_PAYROLL by EmpCode (batch)
     * emp_code is the authoritative key from HR_GANGLN; bank is resolved from it.
     */
    private async resolveBankByEmpCodes(empCodes: string[]): Promise<Map<string, { bank_acc_no: string; bank_code: string }>> {
        const result = new Map<string, { bank_acc_no: string; bank_code: string }>();
        if (empCodes.length === 0) return result;

        // Always trim all empCodes to ensure consistent key matching
        const cleanCodes = empCodes.map(ec => (ec || '').trim().toUpperCase()).filter(Boolean);
        if (cleanCodes.length === 0) return result;

        const CHUNK = 500;
        for (let i = 0; i < cleanCodes.length; i += CHUNK) {
            const chunk = cleanCodes.slice(i, i + CHUNK);
            const placeholders = chunk.map(() => '?').join(',');
            try {
                const rows = await this.db.query<{ EmpCode: string; BankAccNo: string; BankCode: string }>(`
                    SELECT RTRIM(EmpCode) as EmpCode,
                           RTRIM(ISNULL(BankAccNo, '')) as BankAccNo,
                           RTRIM(ISNULL(BankCode, '')) as BankCode
                    FROM HR_PAYROLL
                    WHERE RTRIM(EmpCode) IN (${placeholders})
                `, chunk);
                for (const r of rows) {
                    result.set(r.EmpCode.trim().toUpperCase(), {
                        bank_acc_no: r.BankAccNo?.trim() || '',
                        bank_code: r.BankCode?.trim() || ''
                    });
                }
            } catch (e) {
                console.error("[GangAttendanceService] Error resolving bank accounts:", e);
            }
        }
        return result;
    }

    /**
     * Bulk fetch attendance data from PR_TASKREGLN + PR_TASKREGLN_ARC (main db_ptrj)
     * Uses TaskCode to determine attendance status (same pattern as employeeDetailService)
     *
     * RULE: emp_code is the authoritative key from HR_GANGLN.
     * All attendance records are joined/filtered by this emp_code.
     */
    private async getBulkAttendanceFromMainDb(empCodes: string[], month: number, year: number): Promise<Map<string, { day: number; taskCode: string; isCutiTahunan: boolean; isCutiSakit: boolean; isCutiMinggu: boolean; isCutiNasional: boolean; isHariKerja: boolean; hours: number }[]>> {
        const result = new Map<string, { day: number; taskCode: string; isCutiTahunan: boolean; isCutiSakit: boolean; isCutiMinggu: boolean; isCutiNasional: boolean; isHariKerja: boolean; hours: number }[]>();
        if (empCodes.length === 0) return result;

        const daysInMonth = new Date(year, month, 0).getDate();
        const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
        const endDate = `${year}-${month.toString().padStart(2, '0')}-${daysInMonth}`;

        // CRITICAL: Always trim emp_codes to ensure consistent key matching with gang membership
        const cleanCodes = empCodes.map(ec => (ec || '').trim().toUpperCase()).filter(Boolean);

        const CHUNK = 500;
        for (let i = 0; i < cleanCodes.length; i += CHUNK) {
            const chunk = cleanCodes.slice(i, i + CHUNK);
            const placeholders = chunk.map(() => '?').join(',');

            try {
                // UNION ALL between PR_TASKREGLN and PR_TASKREGLN_ARC (same as employeeDetailService)
                const rows = await this.db.query<{
                    EmpCode: string;
                    day_of_month: number;
                    TaskCode: string;
                    Hours: number;
                }>(`
                    SELECT EmpCode, day_of_month, TaskCode, Hours FROM (
                        SELECT RTRIM(trl.EmpCode) as EmpCode,
                               DAY(trl.TrxDate) as day_of_month,
                               RTRIM(ISNULL(trl.TaskCode, '')) as TaskCode,
                               ISNULL(trl.Hours, 0) as Hours
                        FROM PR_TASKREGLN trl
                        JOIN PR_TASKREG trh ON trl.MasterID = trh.ID
                        WHERE RTRIM(trl.EmpCode) IN (${placeholders})
                          AND trl.TrxDate >= ? AND trl.TrxDate <= ?
                          AND trl.OT = 0

                        UNION ALL

                        SELECT RTRIM(trl.EmpCode) as EmpCode,
                               DAY(trl.TrxDate) as day_of_month,
                               RTRIM(ISNULL(trl.TaskCode, '')) as TaskCode,
                               ISNULL(trl.Hours, 0) as Hours
                        FROM PR_TASKREGLN_ARC trl
                        JOIN PR_TASKREG_ARC trh ON trl.MasterID = trh.ID
                        WHERE RTRIM(trl.EmpCode) IN (${placeholders})
                          AND trl.TrxDate >= ? AND trl.TrxDate <= ?
                          AND trl.OT = 0
                    ) combined
                    ORDER BY EmpCode, day_of_month
                `, [...chunk, startDate, endDate, ...chunk, startDate, endDate]);

                for (const row of rows) {
                    // emp_code is always trimmed + uppercased to match HR_GANGLN source
                    const empKey = (row.EmpCode || '').trim().toUpperCase();
                    if (!result.has(empKey)) {
                        result.set(empKey, []);
                    }
                    // Determine attendance flags from TaskCode (matching employeeDetailService logic)
                    const tc = (row.TaskCode || '').trim();
                    result.get(empKey)!.push({
                        day: row.day_of_month,
                        taskCode: tc,
                        isCutiTahunan: tc.startsWith('GA9129'),
                        isCutiSakit: tc.startsWith('GA9126'),
                        isCutiMinggu: tc.startsWith('GA9127'),
                        isCutiNasional: tc.startsWith('GA9128'),
                        isHariKerja: !tc.startsWith('GA912'),
                        hours: row.Hours
                    });
                }
            } catch (e) {
                console.error(`[GangAttendanceService] Error fetching PR_TASKREGLN chunk ${i}:`, e);
            }
        }
        return result;
    }

    /**
     * Get holidays from HR_GPH for Sunday/holiday identification
     */
    private async getHolidays(month: number, year: number): Promise<Record<number, string>> {
        const holidayMap: Record<number, string> = {};
        try {
            const { employeeDetailService } = await import("./employeeDetailService");
            const holidays = await employeeDetailService.getHolidaysFromHrGph(month, year);
            for (const [day, info] of Object.entries(holidays)) {
                holidayMap[Number(day)] = (info as any).description || 'Libur';
            }
        } catch (e) {
            console.error("[GangAttendanceService] Error fetching holidays:", e);
        }
        return holidayMap;
    }

    /**
     * Resolve attendance status from history_taskreg flags
     * Uses the pre-computed boolean flags instead of parsing TaskCode strings
     */
    private resolveStatusFromFlags(rec: { isCutiTahunan: boolean; isCutiSakit: boolean; isCutiMinggu: boolean; isCutiNasional: boolean; isHariKerja: boolean }, isSunday: boolean, isHoliday: boolean): AttendanceStatus {
        if (rec.isCutiTahunan) return 'C';
        if (rec.isCutiSakit) return 'S';
        if (rec.isCutiMinggu) return 'M';
        if (rec.isCutiNasional) return 'N';
        if (rec.isHariKerja) return 'H';
        if (isSunday) return 'M';
        if (isHoliday) return 'N';
        return 'H';
    }

    /**
     * Generate attendance matrix for one or more gangs
     * All data comes from extend_db_ptrj. EmpCode is the primary key.
     */
    public async getGangAttendanceMatrix(
        gangCodes: string[],
        month: number,
        year: number,
        options: GetGangAttendanceMatrixOptions = {}
    ): Promise<GangAttendanceResult[]> {
        const startTime = Date.now();
        const daysInMonth = new Date(year, month, 0).getDate();
        const includeFaceVerification = options.includeFaceVerification !== false;

        // 1. Get holidays + Sundays
        const holidayMap = await this.getHolidays(month, year);
        const sundays: number[] = [];
        for (let d = 1; d <= daysInMonth; d++) {
            if (new Date(year, month - 1, d).getDay() === 0) sundays.push(d);
        }
        const sundaySet = new Set(sundays);
        const holidayDaySet = new Set(Object.keys(holidayMap).map(Number));

        // 2. Get gang members from HR_GANGLN + HR_EMPLOYEE (main db_ptrj)
        const members = await this.getGangMembersFromMainDb(gangCodes);

        if (members.length === 0) {
            console.warn(`[GangAttendanceService] No members found for gangs [${gangCodes.join(',')}]`);
            return gangCodes.map(gc => ({
                gang_code: gc,
                gang_description: '',
                month,
                year,
                days_in_month: daysInMonth,
                employees: [],
                holidays: holidayMap,
                sundays
            }));
        }

        // 3. Collect all EmpCodes for batch lookups
        const allEmpCodes = members.map(m => m.emp_code);

        // 4. Parallel batch lookups: attendance from PR_TASKREGLN, NIK, bank account
        const [attendanceData, nikMap, bankMap] = await Promise.all([
            this.getBulkAttendanceFromMainDb(allEmpCodes, month, year),
            this.resolveNikByEmpCodes(allEmpCodes),
            this.resolveBankByEmpCodes(allEmpCodes)
        ]);

        // 5. Fetch face verification data from IT Solution API (if enabled)
        const divisionCodes = [...new Set(members.map(m => m.division_code))];
        let faceVerificationMap = new Map<string, { daily: Record<number, { hasWork: boolean }> }>();
        if (includeFaceVerification) {
            try {
                faceVerificationMap = await faceVerificationService.getFaceVerification(divisionCodes, month, year);
            } catch (e) {
                console.warn(`[GangAttendanceService] Face verification fetch failed:`, e);
            }
        }

        // 6. Enrich members with NIK and bank account data
        for (const member of members) {
            const key = member.emp_code.toUpperCase();
            member.nik = nikMap.get(key) || '';
            const bank = bankMap.get(key);
            if (bank) {
                member.bank_acc_no = bank.bank_acc_no;
                member.bank_code = bank.bank_code;
            }
        }

        // 7. Get gang descriptions from HR_GANG (main DB)
        const gangDescMap = new Map<string, string>();
        for (const m of members) {
            if (!gangDescMap.has(m.gang_code)) {
                gangDescMap.set(m.gang_code, '');
            }
        }
        try {
            const gcPlaceholders = gangCodes.map(() => '?').join(',');
            const gangRows = await this.db.query<{ GangCode: string; Description: string }>(
                `SELECT RTRIM(GangCode) as GangCode, Description FROM HR_GANG WHERE RTRIM(GangCode) IN (${gcPlaceholders})`,
                gangCodes
            );
            for (const r of gangRows) {
                gangDescMap.set(r.GangCode.trim(), r.Description?.trim() || '');
            }
        } catch (e) {
            console.warn("[GangAttendanceService] Could not fetch gang descriptions from HR_GANG:", e);
        }

        // 8. Build result per gang
        const results: GangAttendanceResult[] = [];

        for (const gangCode of gangCodes) {
            const gangMembers = members.filter(m => m.gang_code.toUpperCase() === gangCode.toUpperCase());

            const employees: GangAttendanceRow[] = gangMembers.map(member => {
                const empKey = member.emp_code.toUpperCase();
                const records = attendanceData.get(empKey) || [];

                // Initialize daily matrix
                const daily: Record<number, AttendanceStatus> = {};
                const summary = {
                    hadir: 0,
                    cuti_tahunan: 0,
                    cuti_sakit: 0,
                    cuti_minggu: 0,
                    libur_nasional: 0,
                    alpa: 0,
                    total_hk: 0
                };

                // Days with data
                const daysWithData = new Set<number>();
                let maxDataDay = 0;

                for (const rec of records) {
                    daysWithData.add(rec.day);
                    if (rec.day > maxDataDay) maxDataDay = rec.day;

                    const isSunday = sundaySet.has(rec.day);
                    const isHoliday = holidayDaySet.has(rec.day);
                    const status = this.resolveStatusFromFlags(rec, isSunday, isHoliday);

                    daily[rec.day] = status;

                    switch (status) {
                        case 'H': summary.hadir++; break;
                        case 'C': summary.cuti_tahunan++; break;
                        case 'S': summary.cuti_sakit++; break;
                        case 'M': summary.cuti_minggu++; break;
                        case 'N': summary.libur_nasional++; break;
                    }
                }

                // Fill missing days
                for (let d = 1; d <= daysInMonth; d++) {
                    if (!daysWithData.has(d)) {
                        const isSunday = sundaySet.has(d);
                        const isHoliday = holidayDaySet.has(d);

                        if (isSunday) {
                            daily[d] = 'M';
                            summary.cuti_minggu++;
                        } else if (isHoliday) {
                            daily[d] = 'N';
                            summary.libur_nasional++;
                        } else if (maxDataDay > 0 && d < maxDataDay) {
                            daily[d] = 'A';
                            summary.alpa++;
                        } else {
                            daily[d] = '-';
                        }
                    }
                }

                summary.total_hk = summary.hadir + summary.cuti_tahunan + summary.cuti_sakit;

                // Get face verification data for this employee
                const empFaceData = faceVerificationMap.get(empKey);
                const face_verification: Record<number, boolean> = {};
                if (empFaceData) {
                    for (const [day, data] of Object.entries(empFaceData.daily)) {
                        face_verification[Number(day)] = data.hasWork;
                    }
                }

                return {
                    emp_code: member.emp_code,
                    emp_name: member.emp_name,
                    nik: member.nik,
                    gang_code: member.gang_code,
                    bank_acc_no: member.bank_acc_no,
                    daily,
                    face_verification: Object.keys(face_verification).length > 0 ? face_verification : undefined,
                    summary
                };
            });

            results.push({
                gang_code: gangCode,
                gang_description: gangDescMap.get(gangCode) || '',
                month,
                year,
                days_in_month: daysInMonth,
                employees,
                holidays: holidayMap,
                sundays
            });
        }

        console.log(`[GangAttendanceService] Generated matrix for ${gangCodes.length} gang(s), ${members.length} employees in ${Date.now() - startTime}ms`);
        return results;
    }

    /**
     * Generate overtime (lembur) matrix for one or more gangs
     * Shows overtime hours per employee per day in a calendar-style grid.
     * Data comes from PR_TASKREGLN / PR_TASKREGLN_ARC where OT = 1
     */
    public async getGangOvertimeMatrix(
        gangCodes: string[],
        month: number,
        year: number
    ): Promise<GangOvertimeResult[]> {
        const startTime = Date.now();
        const daysInMonth = new Date(year, month, 0).getDate();
        const startDate = `${year}-${month.toString().padStart(2, "0")}-01`;
        const endDate = `${year}-${month.toString().padStart(2, "0")}-${daysInMonth}`;

        // Get holidays + Sundays
        const holidayMap = await this.getHolidays(month, year);
        const sundays: number[] = [];
        for (let d = 1; d <= daysInMonth; d++) {
            if (new Date(year, month - 1, d).getDay() === 0) sundays.push(d);
        }

        // Get gang members from main DB
        const members = await this.getGangMembersFromMainDb(gangCodes);
        if (members.length === 0) return [];

        // emp_code is already trimmed from getGangMembersFromMainDb
        const empCodes = members.map(m => m.emp_code);

        // Get overtime data from PR_TASKREGLN + ARC where OT = 1 (main db_ptrj)
        // RULE: emp_code comes from HR_GANGLN — attendance/lembur is joined via this authoritative emp_code
        const overtimeRows = await this.db.query<{
            EmpCode: string;
            TrxDate: string;
            Hours: number;
            TaskDesc: string;
            Amount: number;
        }>(`
            SELECT
                trl.EmpCode,
                trl.TrxDate,
                trl.Hours,
                tc.TaskDesc,
                trl.Amount
            FROM (
                -- Active Table
                SELECT l.EmpCode, l.TrxDate, l.Hours, l.TaskCode, l.Amount
                FROM PR_TASKREGLN l
                JOIN PR_TASKREG m ON l.MasterID = m.ID
                WHERE l.OT = 1 AND l.TrxDate >= ? AND l.TrxDate <= ?

                UNION ALL

                -- Archive Table
                SELECT l.EmpCode, l.TrxDate, l.Hours, l.TaskCode, l.Amount
                FROM PR_TASKREGLN_ARC l
                JOIN PR_TASKREG_ARC m ON l.MasterID = m.ID
                WHERE l.OT = 1 AND l.TrxDate >= ? AND l.TrxDate <= ?
            ) trl
            LEFT JOIN PR_TASKCODE tc ON tc.TaskCode = trl.TaskCode
            WHERE RTRIM(trl.EmpCode) IN (${empCodes.map((_, i) => `?`).join(',')})
            ORDER BY trl.EmpCode, trl.TrxDate
        `, [
            startDate, endDate,
            startDate, endDate,
            ...empCodes
        ]);

        // Compute DayType in JavaScript using holidayMap (no HR_HOLIDAY table needed)
        const holidayDays = new Set<number>(Object.keys(holidayMap).map(Number));

        // Group by employee
        const empOvertimeMap = new Map<string, {
            daily: Record<number, { hours: number; amount: number; taskDesc: string; dayType: string }[]>;
            totalHours: number;
            totalAmount: number;
            totalRecords: number;
        }>();

        for (const row of overtimeRows) {
            // emp_code key must match the authoritative HR_GANGLN source (trimmed + uppercased)
            const empKey = (row.EmpCode || '').trim().toUpperCase();
            const trxDate = new Date(row.TrxDate);
            const day = trxDate.getDate();
            const dayOfWeek = trxDate.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat

            // Compute DayType in JavaScript (no HR_HOLIDAY table)
            let dayType: string;
            if (holidayDays.has(day)) {
                dayType = 'Libur';
            } else if (dayOfWeek === 0) {
                dayType = 'Minggu';
            } else if (dayOfWeek === 5) {
                dayType = 'Jumat';
            } else {
                dayType = 'Hari Kerja';
            }

            if (!empOvertimeMap.has(empKey)) {
                empOvertimeMap.set(empKey, {
                    daily: {},
                    totalHours: 0,
                    totalAmount: 0,
                    totalRecords: 0
                });
            }
            const empData = empOvertimeMap.get(empKey)!;
            if (!empData.daily[day]) empData.daily[day] = [];
            empData.daily[day].push({
                hours: row.Hours,
                amount: row.Amount,
                taskDesc: row.TaskDesc || '-',
                dayType
            });
            empData.totalHours += row.Hours;
            empData.totalAmount += row.Amount;
            empData.totalRecords++;
        }

        // Build results per gang
        const results: GangOvertimeResult[] = [];
        const membersByGang = new Map<string, typeof members>();
        for (const member of members) {
            if (!membersByGang.has(member.gang_code)) {
                membersByGang.set(member.gang_code, []);
            }
            membersByGang.get(member.gang_code)!.push(member);
        }

        for (const [gangCode, gangMembers] of membersByGang) {
            const employees: GangOvertimeRow[] = gangMembers.map(member => {
                const otData = empOvertimeMap.get(member.emp_code.trim().toUpperCase());
                if (!otData) {
                    return {
                        emp_code: member.emp_code,
                        emp_name: member.emp_name,
                        nik: member.nik,
                        daily: {},
                        total_hours: 0,
                        total_amount: 0,
                        total_records: 0
                    };
                }
                return {
                    emp_code: member.emp_code,
                    emp_name: member.emp_name,
                    nik: member.nik,
                    daily: otData.daily,
                    total_hours: otData.totalHours,
                    total_amount: otData.totalAmount,
                    total_records: otData.totalRecords
                };
            });

            results.push({
                gang_code: gangCode,
                gang_description: '',
                month,
                year,
                days_in_month: daysInMonth,
                employees,
                holidays: holidayMap,
                sundays
            });
        }

        console.log(`[GangAttendanceService] Generated overtime matrix for ${gangCodes.length} gang(s), ${members.length} employees in ${Date.now() - startTime}ms`);
        return results;
    }
}

export interface GangOvertimeRow {
    emp_code: string;
    emp_name: string;
    nik: string;
    daily: Record<number, { hours: number; amount: number; taskDesc: string; dayType: string }[]>;
    total_hours: number;
    total_amount: number;
    total_records: number;
}

export interface GangOvertimeResult {
    gang_code: string;
    gang_description: string;
    month: number;
    year: number;
    days_in_month: number;
    employees: GangOvertimeRow[];
    holidays: Record<number, string>;
    sundays: number[];
}

export const gangAttendanceService = GangAttendanceService.getInstance();
