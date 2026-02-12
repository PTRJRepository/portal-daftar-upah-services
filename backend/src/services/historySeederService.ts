/**
 * History Seeder Service
 * 
 * Service ini menangani proses seeding data history dari database real-time
 * ke database history (extend_db_ptrj dan extend_db_ptrj_transaksi).
 * 
 * Digunakan ketika RUN_MODE=prod untuk menyimpan snapshot data payroll
 * pada bulan yang dipilih.
 */

import { Database } from "../db/client";
import { Config } from "../config";
import { historyDatabaseService, PayrollHistoryMaster, PayrollHistoryDetail, HistoryTaskreg, HistoryAdtrans, HistoryGangMember, HistoryMetadata } from "./historyDatabaseService";
import { dataExtractorService } from "./dataExtractorService";
import { gangService } from "./gangService";
import { PayrollDataService } from "./payrollDataService";

export interface SeederResult {
    success: boolean;
    history_id: string;
    period_month: number;
    period_year: number;
    division_code: string;
    gang_code: string;
    total_employees: number;
    records_inserted: {
        master: number;
        detail: number;
        taskreg: number;
        adtrans: number;
        gang_member: number;
    };
    errors: string[];
}

export interface SeederOptions {
    periodMonth: number;
    periodYear: number;
    divisionCode: string;
    gangCode?: string;  // Optional, if not provided will seed all gangs in division
    createdBy: string;
    ipAddress?: string;
    userAgent?: string;
    force?: boolean;  // Overwrite existing data
}

export class HistorySeederService {
    private static instance: HistorySeederService;

    private constructor() { }

    public static getInstance(): HistorySeederService {
        if (!HistorySeederService.instance) {
            HistorySeederService.instance = new HistorySeederService();
        }
        return HistorySeederService.instance;
    }

    /**
     * Main method to seed payroll history data
     */
    public async seedPayrollHistory(options: SeederOptions): Promise<SeederResult> {
        const result: SeederResult = {
            success: false,
            history_id: '',
            period_month: options.periodMonth,
            period_year: options.periodYear,
            division_code: options.divisionCode,
            gang_code: options.gangCode || 'ALL',
            total_employees: 0,
            records_inserted: {
                master: 0,
                detail: 0,
                taskreg: 0,
                adtrans: 0,
                gang_member: 0
            },
            errors: []
        };

        try {
            // Generate history_id
            const historyId = historyDatabaseService.generateHistoryId();
            result.history_id = historyId;

            // Check if history mode is enabled
            if (!historyDatabaseService.isHistoryMode()) {
                result.errors.push('History mode is not enabled. Set RUN_MODE=prod in .env');
                return result;
            }

            // 1. Get payroll data from real-time database
            const payrollData = await this.fetchPayrollData(options);

            if (!payrollData || payrollData.length === 0) {
                result.errors.push('No payroll data found for the specified period');
                return result;
            }

            // 2. Seed master and detail
            for (const gangData of payrollData) {
                try {
                    await this.seedGangHistory(historyId, gangData, options, result);
                } catch (error: any) {
                    result.errors.push(`Error seeding gang ${gangData.gang_code}: ${error.message}`);
                }
            }

            // 3. Seed transaction data
            await this.seedTransactionData(historyId, options, result);

            // 4. Seed gang member data
            await this.seedGangMemberData(historyId, options, result);

            // 5. Save metadata
            await this.saveSeederMetadata(historyId, options, result);

            result.success = result.errors.length === 0;

        } catch (error: any) {
            result.errors.push(`Fatal error: ${error.message}`);
        }

        return result;
    }

    /**
     * Fetch payroll data from real-time database
     */
    private async fetchPayrollData(options: SeederOptions): Promise<any[]> {
        // Use dataExtractorService to get payroll data
        const authToken = 'system'; // Internal token for seeder

        const rawData = await dataExtractorService.extractPayrollData(
            options.periodMonth,
            options.periodYear,
            options.gangCode || 'ALL',
            options.divisionCode,
            null,
            Config.DB_PROFILE,
            false
        );

        // Group by gang
        const gangMap = new Map<string, any[]>();

        for (const row of rawData.data_rows) {
            const gangCode = row.gang_code;
            if (!gangMap.has(gangCode)) {
                gangMap.set(gangCode, []);
            }
            gangMap.get(gangCode)!.push(row);
        }

        // Convert to array
        const result: any[] = [];
        for (const [gangCode, employees] of gangMap) {
            result.push({
                gang_code: gangCode,
                employees: employees
            });
        }

        return result;
    }

    /**
     * Seed history for a single gang
     */
    private async seedGangHistory(
        historyId: string,
        gangData: any,
        options: SeederOptions,
        result: SeederResult
    ): Promise<void> {
        const employees = gangData.employees;
        if (!employees || employees.length === 0) return;

        // Calculate totals
        const totals = this.calculateTotals(employees);

        // Create master record
        const masterData: PayrollHistoryMaster = {
            history_id: historyId,
            period_month: options.periodMonth,
            period_year: options.periodYear,
            division_code: options.divisionCode,
            gang_code: gangData.gang_code,
            gang_description: gangData.gang_code, // Will be updated with actual description
            total_employees: employees.length,
            ...totals,
            created_by: options.createdBy,
            source_endpoint: '/api/history/seed',
            is_locked: false
        };

        const masterId = await historyDatabaseService.savePayrollHistoryMaster(masterData);
        result.records_inserted.master++;

        // Create detail records
        for (const emp of employees) {
            const detailData = this.mapEmployeeToDetail(historyId, masterId, emp);
            await historyDatabaseService.savePayrollHistoryDetail(detailData);
            result.records_inserted.detail++;
        }

        result.total_employees += employees.length;
    }

    /**
     * Calculate totals from employee data
     */
    private calculateTotals(employees: any[]): any {
        const totals = {
            total_hk: 0,
            total_hari_kerja: 0,
            total_cuti_tahunan: 0,
            total_cuti_sakit: 0,
            total_cuti_minggu: 0,
            total_cuti_nasional: 0,
            total_upah_dasar: 0,
            total_upah_pokok: 0,
            total_gaji_pokok: 0,
            total_beras: 0,
            total_jabatan: 0,
            total_masa_kerja: 0,
            total_lembur: 0,
            total_tunjangan: 0,
            total_premi_brondol: 0,
            total_premi_prunning: 0,
            total_premi_insentif: 0,
            total_premi_kinerja: 0,
            total_premi: 0,
            total_koreksi: 0,
            total_potongan: 0,
            total_pph21: 0,
            total_bpjs_pekerja: 0,
            total_bpjs_majikan: 0,
            total_spsi: 0,
            total_upah_kotor: 0,
            total_upah_bersih: 0
        };

        for (const emp of employees) {
            totals.total_hk += emp.jumlah_hk || 0;
            totals.total_hari_kerja += emp.hari_kerja || 0;
            totals.total_cuti_tahunan += emp.cuti_tahunan_hari || 0;
            totals.total_cuti_sakit += emp.cuti_sakit_haid_hari || 0;
            totals.total_cuti_minggu += emp.cuti_minggu_hari || 0;
            totals.total_cuti_nasional += emp.cuti_nasional_hari || 0;
            totals.total_upah_dasar += emp.upah_dasar || 0;
            totals.total_upah_pokok += emp.upah_pokok || 0;
            totals.total_gaji_pokok += emp.gaji_pokok || 0;
            totals.total_beras += emp.beras_jumlah || 0;
            totals.total_jabatan += emp.jabatan_jumlah || 0;
            totals.total_masa_kerja += emp.masa_kerja_jumlah || 0;
            totals.total_lembur += emp.lembur_jumlah || 0;
            totals.total_tunjangan += emp.total_tunjangan || 0;
            totals.total_premi_brondol += emp.premi_brondol || 0;
            totals.total_premi += emp.total_premi || 0;
            totals.total_koreksi += emp.pot_koreksi || 0;
            totals.total_potongan += emp.total_potongan || 0;
            totals.total_pph21 += emp.pot_pph21 || 0;
            totals.total_bpjs_pekerja += emp.pot_bpjs_pekerja_total || 0;
            totals.total_bpjs_majikan += (emp.pot_bpjs_kesehatan_majikan || 0) + (emp.pot_bpjs_pensiun_majikan || 0) + (emp.pot_astek_majikan || 0);
            totals.total_spsi += emp.pot_spsi || 0;
            totals.total_upah_kotor += emp.jumlah_upah_kotor || 0;
            totals.total_upah_bersih += emp.upah_bersih || 0;
        }

        return totals;
    }

    /**
     * Map employee data to detail record
     */
    private mapEmployeeToDetail(historyId: string, masterId: number, emp: any): PayrollHistoryDetail {
        return {
            history_id: historyId,
            master_id: masterId,
            emp_code: emp.nik || emp.emp_code,
            emp_name: emp.nama || emp.emp_name,
            nik: emp.nik,
            gender: emp.jenis_kelamin || emp.gender,
            gang_code: emp.gang_code,
            division_code: emp.division_code,
            loc_code: emp.loc_code,
            status_ptkp: emp.status_ptkp,
            kategori_ter: emp.kategori_ter,
            hari_kerja: emp.hari_kerja || 0,
            cuti_tahunan_hari: emp.cuti_tahunan_hari || 0,
            cuti_sakit_haid_hari: emp.cuti_sakit_haid_hari || 0,
            cuti_minggu_hari: emp.cuti_minggu_hari || 0,
            cuti_nasional_hari: emp.cuti_nasional_hari || 0,
            jumlah_hk: emp.jumlah_hk || 0,
            total_jam_kerja: emp.total_jam_kerja || 0,
            upah_dasar: emp.upah_dasar || 0,
            upah_pokok: emp.upah_pokok || 0,
            gaji_pokok: emp.gaji_pokok || 0,
            gaji_pokok_ideal: emp.gaji_pokok_ideal || 0,
            gaji_pokok_aktual: emp.gaji_pokok_aktual || 0,
            koreksi_hk: emp.koreksi_hk || 0,
            beras_rate: emp.beras_rate || 0,
            beras_jumlah: emp.beras_jumlah || 0,
            jabatan_rate: emp.jabatan_rate || 0,
            jabatan_jumlah: emp.jabatan_jumlah || 0,
            masa_kerja_tahun: emp.masa_kerja_tahun || 0,
            masa_kerja_rate: emp.masa_kerja_rate || 0,
            masa_kerja_jumlah: emp.masa_kerja_jumlah || 0,
            lembur_jam: emp.lembur_jam || 0,
            lembur_rate: emp.lembur_rate || 0,
            lembur_jumlah: emp.lembur_jumlah || 0,
            lembur_records: emp.lembur_records ? JSON.stringify(emp.lembur_records) : undefined,
            total_tunjangan: emp.total_tunjangan || 0,
            premi_brondol: emp.premi_brondol || 0,
            premi_pph: emp.premi_pph || 0,
            total_premi: emp.total_premi || 0,
            premi_detail: emp.premi ? JSON.stringify(emp.premi) : undefined,
            pot_spsi: emp.pot_spsi || 0,
            pot_pph21: emp.pot_pph21 || 0,
            pot_koreksi: emp.pot_koreksi || 0,
            pot_bpjs_kesehatan_pekerja: emp.pot_bpjs_kesehatan_pekerja || 0,
            pot_bpjs_kesehatan_majikan: emp.pot_bpjs_kesehatan_majikan || 0,
            pot_bpjs_pensiun_pekerja: emp.pot_bpjs_pensiun_pekerja || 0,
            pot_bpjs_pensiun_majikan: emp.pot_bpjs_pensiun_majikan || 0,
            pot_bpjs_pekerja_total: emp.pot_bpjs_pekerja_total || 0,
            pot_astek_pekerja: emp.pot_astek_pekerja || 0,
            pot_astek_majikan: emp.pot_astek_majikan || 0,
            pot_astek_jumlah: emp.pot_astek_jumlah || 0,
            potongan_detail: undefined,
            total_potongan: emp.total_potongan || 0,
            total_potongan_bersih: emp.total_potongan_bersih || 0,
            jumlah_upah_kotor: emp.jumlah_upah_kotor || 0,
            upah_kotor_pajak: emp.upah_kotor_pajak || 0,
            penghasilan_bruto: emp.penghasilan_bruto || 0,
            tarif_pajak_ter: emp.tarif_pajak_ter,
            pph21_ter: emp.pph21_ter || 0,
            upah_bersih: emp.upah_bersih || 0,
            task_code: emp.task_code,
            task_desc: emp.task_desc,
            shortage_details: emp.shortage_details ? JSON.stringify(emp.shortage_details) : undefined,
            shortage_total_hours: emp.shortage_total_hours
        };
    }

    /**
     * Seed transaction data (Taskreg and ADTrans)
     */
    private async seedTransactionData(
        historyId: string,
        options: SeederOptions,
        result: SeederResult
    ): Promise<void> {
        const db = Database.getInstance();

        const startDate = `${options.periodYear}-${options.periodMonth.toString().padStart(2, '0')}-01`;
        const nextMonth = options.periodMonth === 12 ? 1 : options.periodMonth + 1;
        const nextYear = options.periodMonth === 12 ? options.periodYear + 1 : options.periodYear;
        const endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;

        // Get employee codes for this division/gang
        const empCodes = await this.getEmployeeCodes(options);

        if (empCodes.length === 0) return;

        const empList = empCodes.map(e => `'${e}'`).join(',');

        // 1. Seed Taskreg data
        try {
            const taskregRows = await db.query<any>(`
                SELECT 
                    tr.ID as master_id, tr.RegNo, tr.RegDate, tr.EmpCode,
                    trl.ID as line_id, trl.Line, trl.TrxDate, trl.TaskCode, 
                    trl.Hours, trl.OT, trl.Rate, trl.Amount, trl.TappingType
                FROM PR_TASKREG tr
                JOIN PR_TASKREGLN trl ON tr.ID = trl.MasterID
                WHERE tr.EmpCode IN (${empList})
                  AND trl.TrxDate >= '${startDate}' AND trl.TrxDate < '${endDate}'
                
                UNION ALL
                
                SELECT 
                    tr.ID as master_id, tr.RegNo, tr.RegDate, tr.EmpCode,
                    trl.ID as line_id, trl.Line, trl.TrxDate, trl.TaskCode,
                    trl.Hours, trl.OT, trl.Rate, trl.Amount, trl.TappingType
                FROM PR_TASKREG_ARC tr
                JOIN PR_TASKREGLN_ARC trl ON tr.ID = trl.MasterID
                WHERE tr.EmpCode IN (${empList})
                  AND trl.TrxDate >= '${startDate}' AND trl.TrxDate < '${endDate}'
            `);

            for (const row of taskregRows) {
                const taskregData: HistoryTaskreg = {
                    history_id: historyId,
                    original_master_id: row.master_id,
                    reg_no: row.RegNo,
                    reg_date: row.RegDate,
                    emp_code: row.EmpCode?.trim(),
                    original_line_id: row.line_id,
                    line_no: row.Line,
                    trx_date: row.TrxDate,
                    task_code: row.TaskCode?.trim(),
                    hours: row.Hours || 0,
                    ot: row.OT === 1 || row.OT === true,
                    rate: row.Rate,
                    amount: row.Amount || 0,
                    tapping_type: row.TappingType?.trim(),
                    is_cuti_tahunan: false, // Will be determined by task code
                    is_cuti_sakit: false,
                    is_cuti_minggu: false,
                    is_cuti_nasional: false,
                    is_hari_kerja: true,
                    is_lembur: row.OT === 1 || row.OT === true,
                    period_month: options.periodMonth,
                    period_year: options.periodYear,
                    source_table: row.master_id > 1000000000 ? 'PR_TASKREG_ARC' : 'PR_TASKREG'
                };

                await historyDatabaseService.saveTaskregHistory(taskregData);
                result.records_inserted.taskreg++;
            }
        } catch (error: any) {
            result.errors.push(`Error seeding taskreg: ${error.message}`);
        }

        // 2. Seed ADTrans data
        try {
            const adtransRows = await db.query<any>(`
                SELECT 
                    t.ID as master_id, t.DocNo, t.DocDate, t.DocDesc, t.EmpCode,
                    ln.ID as line_id, ln.Line, ln.TaskCode, ln.Amount, ln.Qty, ln.UOM,
                    tc.TaskDesc
                FROM PR_ADTRANS t
                JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
                LEFT JOIN PR_TASKCODE tc ON ln.TaskCode = tc.TaskCode
                WHERE t.EmpCode IN (${empList})
                  AND t.DocDate >= '${startDate}' AND t.DocDate < '${endDate}'
                
                UNION ALL
                
                SELECT 
                    t.ID as master_id, t.DocNo, t.DocDate, t.DocDesc, t.EmpCode,
                    ln.ID as line_id, ln.Line, ln.TaskCode, ln.Amount, ln.Qty, ln.UOM,
                    tc.TaskDesc
                FROM PR_ADTRANS_ARC t
                JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
                LEFT JOIN PR_TASKCODE tc ON ln.TaskCode = tc.TaskCode
                WHERE t.EmpCode IN (${empList})
                  AND t.DocDate >= '${startDate}' AND t.DocDate < '${endDate}'
            `);

            for (const row of adtransRows) {
                const docDesc = (row.DocDesc || '').toUpperCase();
                const taskDesc = (row.TaskDesc || '').toUpperCase();

                // Determine category
                let category = 'OTHER';
                let subCategory: string | undefined;

                if (docDesc.includes('PREMI') || docDesc.includes('PRUN') || docDesc.includes('INSENTIF') || docDesc.includes('PANEN') || docDesc.includes('KINERJA')) {
                    category = 'PREMI';
                    if (docDesc.includes('BRONDOL')) subCategory = 'BRONDOL';
                    else if (docDesc.includes('PRUN')) subCategory = 'PRUNING';
                    else if (docDesc.includes('INSENTIF')) subCategory = 'INSENTIF';
                    else if (docDesc.includes('KINERJA')) subCategory = 'KINERJA';
                } else if (docDesc.includes('BERAS') || docDesc.includes('JABATAN') || docDesc.includes('MASA KERJA') || docDesc.includes('LEMBUR')) {
                    category = 'TUNJANGAN';
                    if (docDesc.includes('BERAS')) subCategory = 'BERAS';
                    else if (docDesc.includes('JABATAN')) subCategory = 'JABATAN';
                    else if (docDesc.includes('MASA')) subCategory = 'MASA_KERJA';
                    else if (docDesc.includes('LEMBUR')) subCategory = 'LEMBUR';
                } else if (docDesc.includes('KOREKSI') || docDesc.includes('POT') || docDesc.includes('PPH') || docDesc.includes('SPSI') || docDesc.includes('BPJS')) {
                    category = 'POTONGAN';
                    if (docDesc.includes('KOREKSI')) subCategory = 'KOREKSI';
                    else if (docDesc.includes('PPH')) subCategory = 'PPH21';
                    else if (docDesc.includes('SPSI')) subCategory = 'SPSI';
                    else if (docDesc.includes('BPJS')) subCategory = 'BPJS';
                }

                const adtransData: HistoryAdtrans = {
                    history_id: historyId,
                    original_master_id: row.master_id,
                    doc_no: row.DocNo?.trim(),
                    doc_date: row.DocDate,
                    doc_desc: row.DocDesc?.trim(),
                    emp_code: row.EmpCode?.trim(),
                    original_line_id: row.line_id,
                    line_no: row.Line,
                    task_code: row.TaskCode?.trim(),
                    task_desc: row.TaskDesc?.trim(),
                    amount: row.Amount || 0,
                    quantity: row.Qty,
                    uom: row.UOM?.trim(),
                    category,
                    sub_category: subCategory,
                    is_dynamic: false,
                    is_premi_pph: taskDesc.includes('ACCRUALS-CHECKROLL'),
                    is_koreksi: docDesc.includes('KOREKSI'),
                    is_potongan: docDesc.includes('POT') || docDesc.includes('POTONGAN'),
                    is_premi: docDesc.includes('PREMI'),
                    period_month: options.periodMonth,
                    period_year: options.periodYear,
                    source_table: row.master_id > 1000000000 ? 'PR_ADTRANS_ARC' : 'PR_ADTRANS'
                };

                await historyDatabaseService.saveAdtransHistory(adtransData);
                result.records_inserted.adtrans++;
            }
        } catch (error: any) {
            result.errors.push(`Error seeding adtrans: ${error.message}`);
        }
    }

    /**
     * Seed gang member data
     */
    private async seedGangMemberData(
        historyId: string,
        options: SeederOptions,
        result: SeederResult
    ): Promise<void> {
        const db = Database.getInstance();

        try {
            // Get current period gang members
            const gangMembers = await db.query<any>(`
                SELECT 
                    g.GangCode, g.Description as GangDesc, g.LocCode,
                    gl.GangMember as EmpCode, e.EmpName, em.AppJoinGrpDate
                FROM HR_GANG g
                JOIN HR_GANGLN gl ON g.GangCode = gl.GangCode
                JOIN HR_EMPLOYEE e ON gl.GangMember = e.EmpCode
                LEFT JOIN HR_EMPLOYMENT em ON e.EmpCode = em.EmpCode
                WHERE g.LocCode = '${options.divisionCode}'
            `);

            for (const row of gangMembers) {
                const gangMemberData: HistoryGangMember = {
                    history_id: historyId,
                    gang_code: row.GangCode?.trim(),
                    gang_description: row.GangDesc?.trim(),
                    division_code: options.divisionCode,
                    loc_code: row.LocCode?.trim(),
                    emp_code: row.EmpCode?.trim(),
                    emp_name: row.EmpName?.trim(),
                    join_date: row.AppJoinGrpDate,
                    is_active: true,
                    period_month: options.periodMonth,
                    period_year: options.periodYear,
                    source_table: 'HR_GANGLN'
                };

                await historyDatabaseService.saveGangMemberHistory(gangMemberData);
                result.records_inserted.gang_member++;
            }
        } catch (error: any) {
            result.errors.push(`Error seeding gang members: ${error.message}`);
        }
    }

    /**
     * Get employee codes for the specified division/gang
     */
    private async getEmployeeCodes(options: SeederOptions): Promise<string[]> {
        const db = Database.getInstance();

        let sql = `
            SELECT DISTINCT RTRIM(e.EmpCode) as emp_code
            FROM HR_EMPLOYEE e
            INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
            INNER JOIN HR_GANG g ON RTRIM(g.GangCode) = RTRIM(gl.GangCode)
            WHERE g.LocCode = '${options.divisionCode}'
        `;

        if (options.gangCode && options.gangCode !== 'ALL') {
            sql += ` AND g.GangCode = '${options.gangCode}'`;
        }

        const rows = await db.query<{ emp_code: string }>(sql);
        return rows.map(r => r.emp_code);
    }

    /**
     * Save seeder metadata
     */
    private async saveSeederMetadata(
        historyId: string,
        options: SeederOptions,
        result: SeederResult
    ): Promise<void> {
        const metadata: HistoryMetadata = {
            history_id: historyId,
            operation: 'CREATE',
            entity_type: 'BATCH',
            period_month: options.periodMonth,
            period_year: options.periodYear,
            division_code: options.divisionCode,
            gang_code: options.gangCode,
            description: `Seeded payroll history for ${options.divisionCode} - ${options.gangCode || 'ALL'}`,
            new_values: JSON.stringify(result.records_inserted),
            record_count: result.total_employees,
            status: result.success ? 'SUCCESS' : 'FAILED',
            error_message: result.errors.length > 0 ? result.errors.join('; ') : undefined,
            performed_by: options.createdBy,
            ip_address: options.ipAddress,
            user_agent: options.userAgent
        };

        await historyDatabaseService.saveHistoryMetadata(metadata);
    }
}

export const historySeederService = HistorySeederService.getInstance();