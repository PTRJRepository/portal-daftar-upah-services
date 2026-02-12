/**
 * History Database Service
 * 
 * Service ini menangani routing database berdasarkan RUN_MODE dan
 * menyediakan method untuk operasi CRUD pada tabel history.
 * 
 * Database Configuration:
 * - RUN_MODE=prod (history mode):
 *   - Payroll/Daftar Upah: extend_db_ptrj
 *   - Detail Transaksi (Taskreg, ADTrans): extend_db_ptrj_transaksi
 * - RUN_MODE=dev: Menggunakan db_ptrj (real-time)
 */

import { Database } from "../db/client";
import { Config } from "../config";

// Environment variable untuk database transaksi
const DB_EXTEND_TRANS_DATABASE = Config.DB_EXTEND_TRANS_DATABASE;

export interface PayrollHistoryMaster {
    id?: number;
    history_id: string;
    period_month: number;
    period_year: number;
    division_code: string;
    gang_code: string;
    gang_description?: string;
    total_employees: number;
    total_hk: number;
    total_hari_kerja: number;
    total_cuti_tahunan: number;
    total_cuti_sakit: number;
    total_cuti_minggu: number;
    total_cuti_nasional: number;
    total_upah_dasar: number;
    total_upah_pokok: number;
    total_gaji_pokok: number;
    total_beras: number;
    total_jabatan: number;
    total_masa_kerja: number;
    total_lembur: number;
    total_tunjangan: number;
    total_premi_brondol: number;
    total_premi_prunning: number;
    total_premi_insentif: number;
    total_premi_kinerja: number;
    total_premi: number;
    dynamic_premi_data?: string;
    total_koreksi: number;
    total_potongan: number;
    total_pph21: number;
    total_bpjs_pekerja: number;
    total_bpjs_majikan: number;
    total_spsi: number;
    dynamic_potongan_data?: string;
    total_upah_kotor: number;
    total_upah_bersih: number;
    total_ffb_weight?: number;
    total_weight_tbs?: number;
    informasi_tambahan?: string;
    created_at?: Date;
    created_by?: string;
    source_endpoint?: string;
    is_locked?: boolean;
    lock_reason?: string;
}

export interface PayrollHistoryDetail {
    id?: number;
    history_id: string;
    master_id: number;
    emp_code: string;
    emp_name?: string;
    nik?: string;
    gender?: string;
    gang_code: string;
    division_code: string;
    loc_code?: string;
    status_ptkp?: string;
    kategori_ter?: string;
    hari_kerja: number;
    cuti_tahunan_hari: number;
    cuti_sakit_haid_hari: number;
    cuti_minggu_hari: number;
    cuti_nasional_hari: number;
    jumlah_hk: number;
    total_jam_kerja: number;
    upah_dasar: number;
    upah_pokok: number;
    gaji_pokok: number;
    gaji_pokok_ideal: number;
    gaji_pokok_aktual: number;
    koreksi_hk: number;
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
    lembur_records?: string;
    total_tunjangan: number;
    premi_brondol: number;
    premi_pph: number;
    total_premi: number;
    premi_detail?: string;
    pot_spsi: number;
    pot_pph21: number;
    pot_koreksi: number;
    pot_bpjs_kesehatan_pekerja: number;
    pot_bpjs_kesehatan_majikan: number;
    pot_bpjs_pensiun_pekerja: number;
    pot_bpjs_pensiun_majikan: number;
    pot_bpjs_pekerja_total: number;
    pot_astek_pekerja: number;
    pot_astek_majikan: number;
    pot_astek_jumlah: number;
    potongan_detail?: string;
    total_potongan: number;
    total_potongan_bersih: number;
    jumlah_upah_kotor: number;
    upah_kotor_pajak: number;
    penghasilan_bruto: number;
    tarif_pajak_ter?: number;
    pph21_ter: number;
    upah_bersih: number;
    task_code?: string;
    task_desc?: string;
    shortage_details?: string;
    shortage_total_hours?: number;
    created_at?: Date;
}

export interface HistoryTaskreg {
    id?: number;
    history_id: string;
    original_master_id?: number;
    reg_no?: string;
    reg_date?: Date;
    emp_code: string;
    gang_code?: string;
    division_code?: string;
    original_line_id?: number;
    line_no?: number;
    trx_date: Date;
    task_code?: string;
    task_desc?: string;
    hours: number;
    ot: boolean;
    rate?: number;
    amount: number;
    tapping_type?: string;
    location_code?: string;
    status?: string;
    is_cuti_tahunan: boolean;
    is_cuti_sakit: boolean;
    is_cuti_minggu: boolean;
    is_cuti_nasional: boolean;
    is_hari_kerja: boolean;
    is_lembur: boolean;
    period_month: number;
    period_year: number;
    source_table: string;
    created_at?: Date;
}

export interface HistoryAdtrans {
    id?: number;
    history_id: string;
    original_master_id?: number;
    doc_no?: string;
    doc_date: Date;
    doc_desc?: string;
    emp_code: string;
    gang_code?: string;
    division_code?: string;
    original_line_id?: number;
    line_no?: number;
    task_code?: string;
    task_desc?: string;
    amount: number;
    quantity?: number;
    uom?: string;
    category: string;
    sub_category?: string;
    is_dynamic: boolean;
    dynamic_header_name?: string;
    is_premi_pph: boolean;
    is_koreksi: boolean;
    is_potongan: boolean;
    is_premi: boolean;
    period_month: number;
    period_year: number;
    source_table: string;
    created_at?: Date;
}

export interface HistoryGangMember {
    id?: number;
    history_id: string;
    gang_code: string;
    gang_description?: string;
    division_code: string;
    loc_code?: string;
    emp_code: string;
    emp_name?: string;
    join_date?: Date;
    is_active: boolean;
    period_month: number;
    period_year: number;
    source_table: string;
    created_at?: Date;
}

export interface HistoryMetadata {
    id?: number;
    history_id: string;
    operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOCK' | 'UNLOCK' | 'ARCHIVE' | 'RESTORE';
    entity_type: 'PAYROLL_MASTER' | 'PAYROLL_DETAIL' | 'TASKREG' | 'ADTRANS' | 'GANG_MEMBER' | 'BATCH';
    entity_id?: number;
    period_month: number;
    period_year: number;
    division_code?: string;
    gang_code?: string;
    description?: string;
    old_values?: string;
    new_values?: string;
    record_count?: number;
    status?: 'SUCCESS' | 'FAILED' | 'PENDING' | 'ROLLBACK';
    error_message?: string;
    performed_by: string;
    performed_at?: Date;
    ip_address?: string;
    user_agent?: string;
    session_id?: string;
}

export class HistoryDatabaseService {
    private static instance: HistoryDatabaseService;

    private constructor() { }

    public static getInstance(): HistoryDatabaseService {
        if (!HistoryDatabaseService.instance) {
            HistoryDatabaseService.instance = new HistoryDatabaseService();
        }
        return HistoryDatabaseService.instance;
    }

    /**
     * Check if system is in history mode (prod)
     */
    public isHistoryMode(): boolean {
        return Config.RUN_MODE === 'prod';
    }

    /**
     * Get database instance for payroll/daftar upah data
     * - History mode (prod): extend_db_ptrj
     * - Dev mode: db_ptrj (default)
     */
    public getPayrollDatabase(): Database {
        if (this.isHistoryMode()) {
            return Database.getInstance(Config.DB_EXTEND_DATABASE, Config.DB_EXTEND_PROFILE);
        }
        return Database.getInstance();
    }

    /**
     * Get database instance for transaction data
     * - History mode (prod): extend_db_ptrj_transaksi
     * - Dev mode: db_ptrj (default)
     */
    public getTransactionDatabase(): Database {
        if (this.isHistoryMode()) {
            return Database.getInstance(DB_EXTEND_TRANS_DATABASE, Config.DB_EXTEND_PROFILE);
        }
        return Database.getInstance();
    }

    /**
     * Generate unique history_id
     */
    public generateHistoryId(): string {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `HIST-${timestamp}-${random}`;
    }

    // ============================================================================
    // PAYROLL HISTORY MASTER OPERATIONS
    // ============================================================================

    /**
     * Insert or update payroll history master
     */
    public async savePayrollHistoryMaster(data: PayrollHistoryMaster): Promise<number> {
        const db = this.getPayrollDatabase();

        // Check if record exists
        const existing = await db.queryOne<{ id: number }>(`
            SELECT id FROM dbo.payroll_history_master
            WHERE period_month = ? AND period_year = ? AND division_code = ? AND gang_code = ?
        `, [data.period_month, data.period_year, data.division_code, data.gang_code]);

        if (existing) {
            // Update existing
            await db.query(`
                UPDATE dbo.payroll_history_master SET
                    history_id = ?,
                    gang_description = ?,
                    total_employees = ?,
                    total_hk = ?,
                    total_hari_kerja = ?,
                    total_cuti_tahunan = ?,
                    total_cuti_sakit = ?,
                    total_cuti_minggu = ?,
                    total_cuti_nasional = ?,
                    total_upah_dasar = ?,
                    total_upah_pokok = ?,
                    total_gaji_pokok = ?,
                    total_beras = ?,
                    total_jabatan = ?,
                    total_masa_kerja = ?,
                    total_lembur = ?,
                    total_tunjangan = ?,
                    total_premi_brondol = ?,
                    total_premi_prunning = ?,
                    total_premi_insentif = ?,
                    total_premi_kinerja = ?,
                    total_premi = ?,
                    dynamic_premi_data = ?,
                    total_koreksi = ?,
                    total_potongan = ?,
                    total_pph21 = ?,
                    total_bpjs_pekerja = ?,
                    total_bpjs_majikan = ?,
                    total_spsi = ?,
                    dynamic_potongan_data = ?,
                    total_upah_kotor = ?,
                    total_upah_bersih = ?,
                    total_ffb_weight = ?,
                    total_weight_tbs = ?,
                    informasi_tambahan = ?,
                    created_by = ?,
                    source_endpoint = ?,
                    is_locked = ?,
                    lock_reason = ?
                WHERE id = ?
            `, [
                data.history_id,
                data.gang_description,
                data.total_employees,
                data.total_hk,
                data.total_hari_kerja,
                data.total_cuti_tahunan,
                data.total_cuti_sakit,
                data.total_cuti_minggu,
                data.total_cuti_nasional,
                data.total_upah_dasar,
                data.total_upah_pokok,
                data.total_gaji_pokok,
                data.total_beras,
                data.total_jabatan,
                data.total_masa_kerja,
                data.total_lembur,
                data.total_tunjangan,
                data.total_premi_brondol,
                data.total_premi_prunning,
                data.total_premi_insentif,
                data.total_premi_kinerja,
                data.total_premi,
                data.dynamic_premi_data,
                data.total_koreksi,
                data.total_potongan,
                data.total_pph21,
                data.total_bpjs_pekerja,
                data.total_bpjs_majikan,
                data.total_spsi,
                data.dynamic_potongan_data,
                data.total_upah_kotor,
                data.total_upah_bersih,
                data.total_ffb_weight,
                data.total_weight_tbs,
                data.informasi_tambahan,
                data.created_by,
                data.source_endpoint,
                data.is_locked,
                data.lock_reason,
                existing.id
            ]);
            return existing.id;
        } else {
            // Insert new
            const result = await db.query(`
                INSERT INTO dbo.payroll_history_master (
                    history_id, period_month, period_year, division_code, gang_code, gang_description,
                    total_employees, total_hk, total_hari_kerja,
                    total_cuti_tahunan, total_cuti_sakit, total_cuti_minggu, total_cuti_nasional,
                    total_upah_dasar, total_upah_pokok, total_gaji_pokok,
                    total_beras, total_jabatan, total_masa_kerja, total_lembur, total_tunjangan,
                    total_premi_brondol, total_premi_prunning, total_premi_insentif, total_premi_kinerja, total_premi,
                    dynamic_premi_data, total_koreksi, total_potongan, total_pph21,
                    total_bpjs_pekerja, total_bpjs_majikan, total_spsi,
                    dynamic_potongan_data, total_upah_kotor, total_upah_bersih,
                    total_ffb_weight, total_weight_tbs, informasi_tambahan,
                    created_by, source_endpoint, is_locked, lock_reason
                ) OUTPUT INSERTED.id VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                )
            `, [
                data.history_id, data.period_month, data.period_year, data.division_code, data.gang_code, data.gang_description,
                data.total_employees, data.total_hk, data.total_hari_kerja,
                data.total_cuti_tahunan, data.total_cuti_sakit, data.total_cuti_minggu, data.total_cuti_nasional,
                data.total_upah_dasar, data.total_upah_pokok, data.total_gaji_pokok,
                data.total_beras, data.total_jabatan, data.total_masa_kerja, data.total_lembur, data.total_tunjangan,
                data.total_premi_brondol, data.total_premi_prunning, data.total_premi_insentif, data.total_premi_kinerja, data.total_premi,
                data.dynamic_premi_data, data.total_koreksi, data.total_potongan, data.total_pph21,
                data.total_bpjs_pekerja, data.total_bpjs_majikan, data.total_spsi,
                data.dynamic_potongan_data, data.total_upah_kotor, data.total_upah_bersih,
                data.total_ffb_weight, data.total_weight_tbs, data.informasi_tambahan,
                data.created_by, data.source_endpoint, data.is_locked || false, data.lock_reason
            ]);
            return result[0]?.id;
        }
    }

    /**
     * Get payroll history master by period and gang
     */
    public async getPayrollHistoryMaster(
        periodMonth: number,
        periodYear: number,
        divisionCode?: string,
        gangCode?: string
    ): Promise<PayrollHistoryMaster[]> {
        const db = this.getPayrollDatabase();

        let sql = `
            SELECT * FROM dbo.payroll_history_master
            WHERE period_month = ? AND period_year = ?
        `;
        const params: any[] = [periodMonth, periodYear];

        if (divisionCode) {
            sql += ` AND division_code = ?`;
            params.push(divisionCode);
        }

        if (gangCode) {
            sql += ` AND gang_code = ?`;
            params.push(gangCode);
        }

        sql += ` ORDER BY division_code, gang_code`;

        return await db.query<PayrollHistoryMaster>(sql, params);
    }

    /**
     * Lock payroll history to prevent modification
     */
    public async lockPayrollHistory(
        periodMonth: number,
        periodYear: number,
        divisionCode: string,
        gangCode: string,
        reason: string,
        lockedBy: string
    ): Promise<boolean> {
        const db = this.getPayrollDatabase();

        await db.query(`
            UPDATE dbo.payroll_history_master
            SET is_locked = 1, lock_reason = ?
            WHERE period_month = ? AND period_year = ? AND division_code = ? AND gang_code = ?
        `, [reason, periodMonth, periodYear, divisionCode, gangCode]);

        return true;
    }

    // ============================================================================
    // PAYROLL HISTORY DETAIL OPERATIONS
    // ============================================================================

    /**
     * Insert payroll history detail
     */
    public async savePayrollHistoryDetail(data: PayrollHistoryDetail): Promise<number> {
        const db = this.getPayrollDatabase();

        const result = await db.query(`
            INSERT INTO dbo.payroll_history_detail (
                history_id, master_id, emp_code, emp_name, nik, gender, gang_code, division_code, loc_code,
                status_ptkp, kategori_ter, hari_kerja, cuti_tahunan_hari, cuti_sakit_haid_hari,
                cuti_minggu_hari, cuti_nasional_hari, jumlah_hk, total_jam_kerja, upah_dasar,
                upah_pokok, gaji_pokok, gaji_pokok_ideal, gaji_pokok_aktual, koreksi_hk,
                beras_rate, beras_jumlah, jabatan_rate, jabatan_jumlah, masa_kerja_tahun,
                masa_kerja_rate, masa_kerja_jumlah, lembur_jam, lembur_rate, lembur_jumlah,
                lembur_records, total_tunjangan, premi_brondol, premi_pph, total_premi, premi_detail,
                pot_spsi, pot_pph21, pot_koreksi, pot_bpjs_kesehatan_pekerja, pot_bpjs_kesehatan_majikan,
                pot_bpjs_pensiun_pekerja, pot_bpjs_pensiun_majikan, pot_bpjs_pekerja_total,
                pot_astek_pekerja, pot_astek_majikan, pot_astek_jumlah, potongan_detail,
                total_potongan, total_potongan_bersih, jumlah_upah_kotor, upah_kotor_pajak,
                penghasilan_bruto, tarif_pajak_ter, pph21_ter, upah_bersih, task_code, task_desc,
                shortage_details, shortage_total_hours
            ) OUTPUT INSERTED.id VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
        `, [
            data.history_id, data.master_id, data.emp_code, data.emp_name, data.nik, data.gender,
            data.gang_code, data.division_code, data.loc_code, data.status_ptkp, data.kategori_ter,
            data.hari_kerja, data.cuti_tahunan_hari, data.cuti_sakit_haid_hari, data.cuti_minggu_hari,
            data.cuti_nasional_hari, data.jumlah_hk, data.total_jam_kerja, data.upah_dasar,
            data.upah_pokok, data.gaji_pokok, data.gaji_pokok_ideal, data.gaji_pokok_aktual, data.koreksi_hk,
            data.beras_rate, data.beras_jumlah, data.jabatan_rate, data.jabatan_jumlah, data.masa_kerja_tahun,
            data.masa_kerja_rate, data.masa_kerja_jumlah, data.lembur_jam, data.lembur_rate, data.lembur_jumlah,
            data.lembur_records, data.total_tunjangan, data.premi_brondol, data.premi_pph, data.total_premi, data.premi_detail,
            data.pot_spsi, data.pot_pph21, data.pot_koreksi, data.pot_bpjs_kesehatan_pekerja, data.pot_bpjs_kesehatan_majikan,
            data.pot_bpjs_pensiun_pekerja, data.pot_bpjs_pensiun_majikan, data.pot_bpjs_pekerja_total,
            data.pot_astek_pekerja, data.pot_astek_majikan, data.pot_astek_jumlah, data.potongan_detail,
            data.total_potongan, data.total_potongan_bersih, data.jumlah_upah_kotor, data.upah_kotor_pajak,
            data.penghasilan_bruto, data.tarif_pajak_ter, data.pph21_ter, data.upah_bersih,
            data.task_code, data.task_desc, data.shortage_details, data.shortage_total_hours
        ]);

        return result[0]?.id;
    }

    /**
     * Get payroll history details by master_id
     */
    public async getPayrollHistoryDetails(masterId: number): Promise<PayrollHistoryDetail[]> {
        const db = this.getPayrollDatabase();

        return await db.query<PayrollHistoryDetail>(`
            SELECT * FROM dbo.payroll_history_detail
            WHERE master_id = ?
            ORDER BY emp_code
        `, [masterId]);
    }

    /**
     * Delete payroll history details by master_id (for re-insert)
     */
    public async deletePayrollHistoryDetails(masterId: number): Promise<void> {
        const db = this.getPayrollDatabase();

        await db.query(`
            DELETE FROM dbo.payroll_history_detail
            WHERE master_id = ?
        `, [masterId]);
    }

    // ============================================================================
    // TRANSACTION HISTORY OPERATIONS
    // ============================================================================

    /**
     * Insert taskreg history
     */
    public async saveTaskregHistory(data: HistoryTaskreg): Promise<number> {
        const db = this.getTransactionDatabase();

        const result = await db.query(`
            INSERT INTO dbo.history_taskreg (
                history_id, original_master_id, reg_no, reg_date, emp_code, gang_code, division_code,
                original_line_id, line_no, trx_date, task_code, task_desc, hours, ot, rate, amount,
                tapping_type, location_code, status, is_cuti_tahunan, is_cuti_sakit, is_cuti_minggu,
                is_cuti_nasional, is_hari_kerja, is_lembur, period_month, period_year, source_table
            ) OUTPUT INSERTED.id VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
        `, [
            data.history_id, data.original_master_id, data.reg_no, data.reg_date, data.emp_code,
            data.gang_code, data.division_code, data.original_line_id, data.line_no, data.trx_date,
            data.task_code, data.task_desc, data.hours, data.ot, data.rate, data.amount,
            data.tapping_type, data.location_code, data.status, data.is_cuti_tahunan,
            data.is_cuti_sakit, data.is_cuti_minggu, data.is_cuti_nasional, data.is_hari_kerja,
            data.is_lembur, data.period_month, data.period_year, data.source_table
        ]);

        return result[0]?.id;
    }

    /**
     * Insert adtrans history
     */
    public async saveAdtransHistory(data: HistoryAdtrans): Promise<number> {
        const db = this.getTransactionDatabase();

        const result = await db.query(`
            INSERT INTO dbo.history_adtrans (
                history_id, original_master_id, doc_no, doc_date, doc_desc, emp_code, gang_code,
                division_code, original_line_id, line_no, task_code, task_desc, amount, quantity,
                uom, category, sub_category, is_dynamic, dynamic_header_name, is_premi_pph,
                is_koreksi, is_potongan, is_premi, period_month, period_year, source_table
            ) OUTPUT INSERTED.id VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
        `, [
            data.history_id, data.original_master_id, data.doc_no, data.doc_date, data.doc_desc,
            data.emp_code, data.gang_code, data.division_code, data.original_line_id, data.line_no,
            data.task_code, data.task_desc, data.amount, data.quantity, data.uom, data.category,
            data.sub_category, data.is_dynamic, data.dynamic_header_name, data.is_premi_pph,
            data.is_koreksi, data.is_potongan, data.is_premi, data.period_month, data.period_year,
            data.source_table
        ]);

        return result[0]?.id;
    }

    /**
     * Insert gang member history
     */
    public async saveGangMemberHistory(data: HistoryGangMember): Promise<number> {
        const db = this.getTransactionDatabase();

        const result = await db.query(`
            INSERT INTO dbo.history_gang_member (
                history_id, gang_code, gang_description, division_code, loc_code, emp_code,
                emp_name, join_date, is_active, period_month, period_year, source_table
            ) OUTPUT INSERTED.id VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
        `, [
            data.history_id, data.gang_code, data.gang_description, data.division_code,
            data.loc_code, data.emp_code, data.emp_name, data.join_date, data.is_active,
            data.period_month, data.period_year, data.source_table
        ]);

        return result[0]?.id;
    }

    /**
     * Delete transaction history by history_id
     */
    public async deleteTransactionHistory(historyId: string): Promise<void> {
        const db = this.getTransactionDatabase();

        await db.query(`DELETE FROM dbo.history_taskreg WHERE history_id = ?`, [historyId]);
        await db.query(`DELETE FROM dbo.history_adtrans WHERE history_id = ?`, [historyId]);
        await db.query(`DELETE FROM dbo.history_gang_member WHERE history_id = ?`, [historyId]);
    }

    // ============================================================================
    // METADATA OPERATIONS
    // ============================================================================

    /**
     * Insert history metadata for audit trail
     */
    public async saveHistoryMetadata(data: HistoryMetadata): Promise<number> {
        const db = this.getTransactionDatabase();

        const result = await db.query(`
            INSERT INTO dbo.history_metadata (
                history_id, operation, entity_type, entity_id, period_month, period_year,
                division_code, gang_code, description, old_values, new_values, record_count,
                status, error_message, performed_by, ip_address, user_agent, session_id
            ) OUTPUT INSERTED.id VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
        `, [
            data.history_id, data.operation, data.entity_type, data.entity_id, data.period_month,
            data.period_year, data.division_code, data.gang_code, data.description, data.old_values,
            data.new_values, data.record_count, data.status || 'SUCCESS', data.error_message,
            data.performed_by, data.ip_address, data.user_agent, data.session_id
        ]);

        return result[0]?.id;
    }

    /**
     * Get history metadata by history_id
     */
    public async getHistoryMetadata(historyId: string): Promise<HistoryMetadata[]> {
        const db = this.getTransactionDatabase();

        return await db.query<HistoryMetadata>(`
            SELECT * FROM dbo.history_metadata
            WHERE history_id = ?
            ORDER BY performed_at DESC
        `, [historyId]);
    }
}

export const historyDatabaseService = HistoryDatabaseService.getInstance();