/**
 * Wages Service
 * 
 * Service untuk mengambil data dari PR_WAGES dan PR_EMPWAGES
 * untuk perbandingan dengan daftar upah (payroll history).
 * 
 * Tables:
 * - PR_WAGES: Header wages per periode
 * - PR_EMPWAGES: Detail wages per karyawan
 * - PR_EMPWAGES_ARC: Archive table untuk history
 */

import { Database } from "../db/client";
import { Config } from "../config";

export interface WagesHeader {
    wages_no: string;
    wages_date: Date;
    period_month: number;
    period_year: number;
    division_code: string;
    gang_code?: string;
    total_employees: number;
    total_hk: number;
    total_amount: number;
    status?: string;
    created_at?: Date;
}

export interface WagesDetail {
    id?: number;
    wages_no: string;
    emp_code: string;
    emp_name?: string;
    nik?: string;
    gang_code: string;
    division_code: string;
    jumlah_hk: number;
    upah_dasar?: number;
    upah_pokok?: number;
    gaji_pokok?: number;
    total_tunjangan?: number;
    total_premi?: number;
    total_potongan?: number;
    upah_bersih: number;
    payment_status?: string;
    payment_date?: Date;
}

export interface WagesComparison {
    emp_code: string;
    nik?: string;
    nama?: string;
    gang_code: string;
    division_code: string;
    
    // Data dari daftar upah (calculated) - Detailed breakdown
    daftar_upah: {
        jumlah_hk: number;
        upah_dasar: number;
        gaji_pokok: number;
        // Tunjangan detail
        beras_jumlah: number;
        jabatan_jumlah: number;
        masa_kerja_jumlah: number;
        total_tunjangan: number;
        // Lembur
        lembur_jam: number;
        lembur_jumlah: number;
        // Premi detail
        premi_brondol: number;
        premi_pph: number;
        total_premi: number;
        // Potongan detail
        pot_spsi: number;
        pot_pph21: number;
        pot_astek_pekerja: number;
        pot_bpjs_kesehatan_pekerja: number;
        pot_bpjs_pensiun_pekerja: number;
        pot_koreksi: number;
        total_potongan: number;
        // Summary
        jumlah_upah_kotor: number;
        upah_bersih: number;
        // Pajak info
        status_ptkp?: string;
        kategori_ter?: string;
        tarif_pajak_ter?: number;
        pph21_ter?: number;
    };
    
    // Data dari wages (paid)
    wages: {
        wages_no: string;
        wages_date?: Date;
        jumlah_hk: number;
        upah_dasar?: number;
        gaji_pokok?: number;
        total_tunjangan?: number;
        total_premi?: number;
        total_potongan?: number;
        upah_bersih: number;
        payment_status?: string;
    } | null;
    
    // Comparison result
    comparison: {
        hk_match: boolean;
        amount_match: boolean;
        hk_difference: number;
        amount_difference: number;
        status: 'MATCH' | 'MINOR_DIFF' | 'MAJOR_DIFF' | 'NO_WAGES';
    };
}

export interface WagesComparisonSummary {
    period_month: number;
    period_year: number;
    period_label: string;
    total_employees: number;
    matched: number;
    minor_differences: number;
    major_differences: number;
    no_wages_data: number;
    total_variance: number;
    tolerance: number;
}

// Tolerance for matching (in Rupiah)
const AMOUNT_TOLERANCE = 1000; // Rp 1,000
const HK_TOLERANCE = 0.5; // 0.5 HK

class WagesService {
    private static instance: WagesService;
    
    private constructor() {}
    
    public static getInstance(): WagesService {
        if (!WagesService.instance) {
            WagesService.instance = new WagesService();
        }
        return WagesService.instance;
    }
    
    /**
     * Get wages data for a specific period
     */
    async getWagesByPeriod(month: number, year: number, divisionCode?: string): Promise<WagesDetail[]> {
        const db = Database.getInstance(Config.DEFAULT_DATABASE, Config.DB_PROFILE);

        let query = `
            SELECT
                ew.WAGES_NO as wages_no,
                ew.EMP_CODE as emp_code,
                e.EMP_NAME as emp_name,
                e.NIK as nik,
                e.GANG_CODE as gang_code,
                SUBSTRING(e.GANG_CODE, 1, 2) as division_code,
                ew.JUMLAH_HK as jumlah_hk,
                ew.UPAH_DASAR as upah_dasar,
                ew.UPAH_POKOK as upah_pokok,
                ew.GAJI_POKOK as gaji_pokok,
                ew.TOTAL_TUNJANGAN as total_tunjangan,
                ew.TOTAL_PREMI as total_premi,
                ew.TOTAL_POTONGAN as total_potongan,
                ew.UPAH_BERSIH as upah_bersih,
                ew.STATUS as payment_status,
                w.WAGES_DATE as payment_date
            FROM PR_EMPWAGES ew
            INNER JOIN PR_WAGES w ON ew.WAGES_NO = w.WAGES_NO
            LEFT JOIN HR_EMPLOYEE e ON ew.EMP_CODE = e.EMP_CODE
            WHERE MONTH(w.WAGES_DATE) = ?
              AND YEAR(w.WAGES_DATE) = ?
        `;

        const params: any[] = [month, year];

        if (divisionCode && divisionCode !== 'ALL') {
            query += ` AND SUBSTRING(e.GANG_CODE, 1, 2) = ?`;
            params.push(divisionCode);
        }

        query += ` ORDER BY e.GANG_CODE, e.EMP_NAME`;

        try {
            const result = await db.query<any>(query, params);
            return result.map(row => this.mapWagesDetail(row));
        } catch (error: any) {
            console.error('[WagesService] Error fetching wages by period:', error);
            // Try archive table if main table fails
            return this.getWagesFromArchive(month, year, divisionCode);
        }
    }
    
    /**
     * Get wages from archive table
     */
    private async getWagesFromArchive(month: number, year: number, divisionCode?: string): Promise<WagesDetail[]> {
        const db = Database.getInstance(Config.DEFAULT_DATABASE, Config.DB_PROFILE);

        let query = `
            SELECT
                ew.WAGES_NO as wages_no,
                ew.EMP_CODE as emp_code,
                e.EMP_NAME as emp_name,
                e.NIK as nik,
                e.GANG_CODE as gang_code,
                SUBSTRING(e.GANG_CODE, 1, 2) as division_code,
                ew.JUMLAH_HK as jumlah_hk,
                ew.UPAH_DASAR as upah_dasar,
                ew.UPAH_POKOK as upah_pokok,
                ew.GAJI_POKOK as gaji_pokok,
                ew.TOTAL_TUNJANGAN as total_tunjangan,
                ew.TOTAL_PREMI as total_premi,
                ew.TOTAL_POTONGAN as total_potongan,
                ew.UPAH_BERSIH as upah_bersih,
                ew.STATUS as payment_status
            FROM PR_EMPWAGES_ARC ew
            LEFT JOIN HR_EMPLOYEE e ON ew.EMP_CODE = e.EMP_CODE
            WHERE ew.PERIOD_MONTH = ?
              AND ew.PERIOD_YEAR = ?
        `;

        const params: any[] = [month, year];

        if (divisionCode && divisionCode !== 'ALL') {
            query += ` AND SUBSTRING(e.GANG_CODE, 1, 2) = ?`;
            params.push(divisionCode);
        }

        query += ` ORDER BY e.GANG_CODE, e.EMP_NAME`;

        try {
            const result = await db.query<any>(query, params);
            return result.map(row => this.mapWagesDetail(row));
        } catch (error: any) {
            console.error('[WagesService] Error fetching wages from archive:', error);
            return [];
        }
    }
    
    /**
     * Get wages for a specific employee
     */
    async getWagesByEmployee(empCode: string, month: number, year: number): Promise<WagesDetail | null> {
        const db = Database.getInstance(Config.DEFAULT_DATABASE, Config.DB_PROFILE);

        const query = `
            SELECT
                ew.WAGES_NO as wages_no,
                ew.EMP_CODE as emp_code,
                e.EMP_NAME as emp_name,
                e.NIK as nik,
                e.GANG_CODE as gang_code,
                SUBSTRING(e.GANG_CODE, 1, 2) as division_code,
                ew.JUMLAH_HK as jumlah_hk,
                ew.UPAH_DASAR as upah_dasar,
                ew.UPAH_POKOK as upah_pokok,
                ew.GAJI_POKOK as gaji_pokok,
                ew.TOTAL_TUNJANGAN as total_tunjangan,
                ew.TOTAL_PREMI as total_premi,
                ew.TOTAL_POTONGAN as total_potongan,
                ew.UPAH_BERSIH as upah_bersih,
                ew.STATUS as payment_status,
                w.WAGES_DATE as payment_date
            FROM PR_EMPWAGES ew
            INNER JOIN PR_WAGES w ON ew.WAGES_NO = w.WAGES_NO
            LEFT JOIN HR_EMPLOYEE e ON ew.EMP_CODE = e.EMP_CODE
            WHERE ew.EMP_CODE = ?
              AND MONTH(w.WAGES_DATE) = ?
              AND YEAR(w.WAGES_DATE) = ?
        `;

        try {
            const result = await db.query<any>(query, [empCode, month, year]);
            if (result && result.length > 0) {
                return this.mapWagesDetail(result[0]);
            }
            return null;
        } catch (error: any) {
            console.error('[WagesService] Error fetching wages by employee:', error);
            return null;
        }
    }
    
    /**
     * Get employee wages history (multiple periods)
     */
    async getEmployeeWagesHistory(empCode: string, months: number = 12): Promise<WagesDetail[]> {
        const db = Database.getInstance(Config.DEFAULT_DATABASE, Config.DB_PROFILE);

        const query = `
            SELECT TOP ${months}
                ew.WAGES_NO as wages_no,
                ew.EMP_CODE as emp_code,
                e.EMP_NAME as emp_name,
                e.NIK as nik,
                e.GANG_CODE as gang_code,
                SUBSTRING(e.GANG_CODE, 1, 2) as division_code,
                ew.JUMLAH_HK as jumlah_hk,
                ew.UPAH_DASAR as upah_dasar,
                ew.UPAH_POKOK as upah_pokok,
                ew.GAJI_POKOK as gaji_pokok,
                ew.TOTAL_TUNJANGAN as total_tunjangan,
                ew.TOTAL_PREMI as total_premi,
                ew.TOTAL_POTONGAN as total_potongan,
                ew.UPAH_BERSIH as upah_bersih,
                ew.STATUS as payment_status,
                w.WAGES_DATE as payment_date,
                MONTH(w.WAGES_DATE) as period_month,
                YEAR(w.WAGES_DATE) as period_year
            FROM PR_EMPWAGES ew
            INNER JOIN PR_WAGES w ON ew.WAGES_NO = w.WAGES_NO
            LEFT JOIN HR_EMPLOYEE e ON ew.EMP_CODE = e.EMP_CODE
            WHERE ew.EMP_CODE = ?
            ORDER BY w.WAGES_DATE DESC
        `;

        try {
            const result = await db.query<any>(query, [empCode]);
            return result.map(row => this.mapWagesDetail(row));
        } catch (error: any) {
            console.error('[WagesService] Error fetching employee wages history:', error);
            return [];
        }
    }
    
    /**
     * Compare payroll data with wages data
     */
    async comparePayrollWithWages(
        payrollData: any[],
        month: number,
        year: number,
        divisionCode?: string
    ): Promise<{ summary: WagesComparisonSummary; data: WagesComparison[] }> {
        
        // Get wages data for the same period
        const wagesData = await this.getWagesByPeriod(month, year, divisionCode);
        
        // Create a map for quick lookup
        const wagesMap = new Map<string, WagesDetail>();
        wagesData.forEach(w => {
            wagesMap.set(w.emp_code.toUpperCase(), w);
        });
        
        // Compare each payroll record with wages
        const comparisons: WagesComparison[] = payrollData.map(payroll => {
            const empCode = (payroll.nik || payroll.emp_code || '').toUpperCase();
            const wages = wagesMap.get(empCode);
            
            // Build detailed daftar upah data
            const daftarUpah = {
                jumlah_hk: Number(payroll.jumlah_hk) || 0,
                upah_dasar: Number(payroll.upah_dasar) || 0,
                gaji_pokok: Number(payroll.gaji_pokok) || 0,
                // Tunjangan detail
                beras_jumlah: Number(payroll.beras_jumlah) || 0,
                jabatan_jumlah: Number(payroll.jabatan_jumlah) || 0,
                masa_kerja_jumlah: Number(payroll.masa_kerja_jumlah) || 0,
                total_tunjangan: Number(payroll.total_tunjangan) || 0,
                // Lembur
                lembur_jam: Number(payroll.lembur_jam) || 0,
                lembur_jumlah: Number(payroll.lembur_jumlah) || 0,
                // Premi detail
                premi_brondol: Number(payroll.premi_brondol) || 0,
                premi_pph: Number(payroll.premi_pph) || 0,
                total_premi: Number(payroll.total_premi) || 0,
                // Potongan detail
                pot_spsi: Number(payroll.pot_spsi) || 0,
                pot_pph21: Number(payroll.pot_pph21) || 0,
                pot_astek_pekerja: Number(payroll.pot_astek_pekerja) || Number(payroll.pot_astek) || 0,
                pot_bpjs_kesehatan_pekerja: Number(payroll.pot_bpjs_kesehatan_pekerja) || 0,
                pot_bpjs_pensiun_pekerja: Number(payroll.pot_bpjs_pensiun_pekerja) || 0,
                pot_koreksi: Number(payroll.pot_koreksi) || 0,
                total_potongan: Number(payroll.total_potongan) || 0,
                // Summary
                jumlah_upah_kotor: Number(payroll.jumlah_upah_kotor) || 0,
                upah_bersih: Number(payroll.upah_bersih) || 0,
                // Pajak info
                status_ptkp: payroll.status_ptkp || '-',
                kategori_ter: payroll.kategori_ter || '-',
                tarif_pajak_ter: Number(payroll.tarif_pajak_ter) || 0,
                pph21_ter: Number(payroll.pph21_ter) || 0
            };
            
            let comparison: WagesComparison['comparison'];
            
            if (wages) {
                const hkDiff = Math.abs(daftarUpah.jumlah_hk - wages.jumlah_hk);
                const amountDiff = Math.abs(daftarUpah.upah_bersih - wages.upah_bersih);
                
                const hkMatch = hkDiff <= HK_TOLERANCE;
                const amountMatch = amountDiff <= AMOUNT_TOLERANCE;
                
                let status: 'MATCH' | 'MINOR_DIFF' | 'MAJOR_DIFF' | 'NO_WAGES';
                if (hkMatch && amountMatch) {
                    status = 'MATCH';
                } else if (amountDiff <= 10000) {
                    status = 'MINOR_DIFF';
                } else {
                    status = 'MAJOR_DIFF';
                }
                
                comparison = {
                    hk_match: hkMatch,
                    amount_match: amountMatch,
                    hk_difference: daftarUpah.jumlah_hk - wages.jumlah_hk,
                    amount_difference: daftarUpah.upah_bersih - wages.upah_bersih,
                    status
                };
            } else {
                comparison = {
                    hk_match: false,
                    amount_match: false,
                    hk_difference: 0,
                    amount_difference: 0,
                    status: 'NO_WAGES'
                };
            }
            
            return {
                emp_code: empCode,
                nik: payroll.nik || wages?.nik,
                nama: payroll.nama || payroll.emp_name || wages?.emp_name,
                gang_code: payroll.gang_code || wages?.gang_code || '',
                division_code: payroll.division_code || wages?.division_code || '',
                daftar_upah: daftarUpah,
                wages: wages ? {
                    wages_no: wages.wages_no,
                    wages_date: wages.payment_date,
                    jumlah_hk: wages.jumlah_hk,
                    upah_dasar: wages.upah_dasar,
                    gaji_pokok: wages.gaji_pokok,
                    total_tunjangan: wages.total_tunjangan,
                    total_premi: wages.total_premi,
                    total_potongan: wages.total_potongan,
                    upah_bersih: wages.upah_bersih,
                    payment_status: wages.payment_status
                } : null,
                comparison
            };
        });
        
        // Calculate summary
        const summary: WagesComparisonSummary = {
            period_month: month,
            period_year: year,
            period_label: this.getMonthName(month) + ' ' + year,
            total_employees: comparisons.length,
            matched: comparisons.filter(c => c.comparison.status === 'MATCH').length,
            minor_differences: comparisons.filter(c => c.comparison.status === 'MINOR_DIFF').length,
            major_differences: comparisons.filter(c => c.comparison.status === 'MAJOR_DIFF').length,
            no_wages_data: comparisons.filter(c => c.comparison.status === 'NO_WAGES').length,
            total_variance: comparisons.reduce((sum, c) => sum + Math.abs(c.comparison.amount_difference), 0),
            tolerance: AMOUNT_TOLERANCE
        };
        
        return { summary, data: comparisons };
    }
    
    /**
     * Get available periods from wages table
     */
    async getAvailableWagesPeriods(): Promise<{ month: number; year: number; label: string; employee_count: number }[]> {
        const db = Database.getInstance(Config.DEFAULT_DATABASE, Config.DB_PROFILE);
        
        const query = `
            SELECT 
                MONTH(w.WAGES_DATE) as month,
                YEAR(w.WAGES_DATE) as year,
                COUNT(DISTINCT ew.EMP_CODE) as employee_count
            FROM PR_WAGES w
            INNER JOIN PR_EMPWAGES ew ON w.WAGES_NO = ew.WAGES_NO
            GROUP BY MONTH(w.WAGES_DATE), YEAR(w.WAGES_DATE)
            ORDER BY year DESC, month DESC
        `;
        
        try {
            const result = await db.query<any>(query, {});
            return result.map(row => ({
                month: row.month,
                year: row.year,
                label: `${this.getMonthName(row.month)} ${row.year}`,
                employee_count: row.employee_count
            }));
        } catch (error: any) {
            console.error('[WagesService] Error fetching available periods:', error);
            return [];
        }
    }
    
    /**
     * Map database row to WagesDetail interface
     */
    private mapWagesDetail(row: any): WagesDetail {
        return {
            wages_no: row.wages_no || '',
            emp_code: row.emp_code || '',
            emp_name: row.emp_name || '',
            nik: row.nik || '',
            gang_code: row.gang_code || '',
            division_code: row.division_code || '',
            jumlah_hk: Number(row.jumlah_hk) || 0,
            upah_dasar: Number(row.upah_dasar) || 0,
            upah_pokok: Number(row.upah_pokok) || 0,
            gaji_pokok: Number(row.gaji_pokok) || 0,
            total_tunjangan: Number(row.total_tunjangan) || 0,
            total_premi: Number(row.total_premi) || 0,
            total_potongan: Number(row.total_potongan) || 0,
            upah_bersih: Number(row.upah_bersih) || 0,
            payment_status: row.payment_status || '',
            payment_date: row.payment_date || undefined
        };
    }
    
    /**
     * Get month name in Indonesian
     */
    private getMonthName(month: number): string {
        const months = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        return months[month - 1] || '';
    }
}

export const wagesService = WagesService.getInstance();
