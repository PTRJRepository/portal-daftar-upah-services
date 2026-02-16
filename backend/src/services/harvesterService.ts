/**
 * Service untuk mengambil data bunches (hasil panen) dari tabel PR_HARVESTER_ARC dan PR_HARVESTERLN_ARC
 */

import { Database } from "../db/client";
import type { HarvestData, HarvestDataRaw, HarvestExtendedData, HarvestMasterData, HarvestLineData } from "../types/harvest";

export class HarvesterService {
    private static instance: HarvesterService;
    private db: Database;

    private constructor() {
        this.db = Database.getInstance();
    }

    public static getInstance(): HarvesterService {
        if (!HarvesterService.instance) {
            HarvesterService.instance = new HarvesterService();
        }
        return HarvesterService.instance;
    }

    /**
     * Cek apakah suatu gang adalah gang panen (berakhiran dengan "H")
     */
    public isHarvestGang(gangCode: string): boolean {
        if (!gangCode) return false;
        return gangCode.trim().toUpperCase().endsWith("H");
    }

    /**
     * Ambil data bunches untuk karyawan tertentu dalam periode tertentu
     * Data diambil dari PR_HARVESTERLN_ARC (detail per karyawan)
     */
    public async getEmployeeBunches(empCode: string, month: number, year: number): Promise<HarvestData> {
        const defaultData: HarvestData = {
            total_bunches: 0,
            bunches_ripe: 0,
            bunches_unripe: 0,
            bunches_round: 0,
            bunches_transactions: 0,
        };

        try {
            // Cari data di archive table (PR_HARVESTERLN_ARC)
            // Filter by TrxDate (tanggal transaksi) dan EmpCode
            const sql = `
                SELECT
                    EmpCode,
                    EmpName,
                    SUM(TotalBunches) as TotalBunches,
                    SUM(Ripe) as Ripe,
                    SUM(Unripe) as Unripe,
                    SUM(TotalRound) as TotalRound,
                    COUNT(*) as TrxCount
                FROM PR_HARVESTERLN_ARC
                WHERE EmpCode = ?
                    AND MONTH(TrxDate) = ?
                    AND YEAR(TrxDate) = ?
                GROUP BY EmpCode, EmpName
            `;

            const results = await this.db.query<HarvestDataRaw>(sql, [empCode, month, year]);

            if (results.length > 0) {
                const row = results[0];
                return {
                    total_bunches: row.TotalBunches || 0,
                    bunches_ripe: row.Ripe || 0,
                    bunches_unripe: row.Unripe || 0,
                    bunches_round: row.TotalRound || 0,
                    bunches_transactions: row.TrxCount || 0,
                };
            }

            return defaultData;

        } catch (error: any) {
            console.error("[HarvesterService] Error fetching employee bunches:", error.message);
            return defaultData;
        }
    }

    /**
     * Ambil data bunches untuk beberapa karyawan sekaligus (batch)
     * Digunakan untuk mengoptimalkan query saat mengambil data payroll
     */
    public async getBatchEmployeeBunches(empCodes: string[], month: number, year: number): Promise<Map<string, HarvestData>> {
        const resultMap = new Map<string, HarvestData>();

        // Default data untuk setiap karyawan
        for (const empCode of empCodes) {
            resultMap.set(empCode, {
                total_bunches: 0,
                bunches_ripe: 0,
                bunches_unripe: 0,
                bunches_round: 0,
                bunches_transactions: 0,
            });
        }

        if (empCodes.length === 0) {
            return resultMap;
        }

        try {
            // Build IN clause untuk empCodes
            const placeholders = empCodes.map(() => "?").join(",");
            const sql = `
                SELECT
                    EmpCode,
                    EmpName,
                    SUM(TotalBunches) as TotalBunches,
                    SUM(Ripe) as Ripe,
                    SUM(Unripe) as Unripe,
                    SUM(TotalRound) as TotalRound,
                    COUNT(*) as TrxCount
                FROM PR_HARVESTERLN_ARC
                WHERE EmpCode IN (${placeholders})
                    AND MONTH(TrxDate) = ?
                    AND YEAR(TrxDate) = ?
                GROUP BY EmpCode, EmpName
            `;

            const results = await this.db.query<HarvestDataRaw>(sql, [...empCodes, month, year]);

            for (const row of results) {
                resultMap.set(row.EmpCode, {
                    total_bunches: row.TotalBunches || 0,
                    bunches_ripe: row.Ripe || 0,
                    bunches_unripe: row.Unripe || 0,
                    bunches_round: row.TotalRound || 0,
                    bunches_transactions: row.TrxCount || 0,
                });
            }

        } catch (error: any) {
            console.error("[HarvesterService] Error fetching batch bunches:", error.message);
        }

        return resultMap;
    }

    /**
     * Ambil data bunches untuk satu gang (dari Master table)
     * Digunakan untuk validasi dan summary
     */
    public async getGangBunchesFromMaster(gangCode: string, month: number, year: number): Promise<number> {
        try {
            const sql = `
                SELECT SUM(TotalBunches) as TotalBunches
                FROM PR_HARVESTER_ARC
                WHERE GangCode = ?
                    AND MONTH(DocDate) = ?
                    AND YEAR(DocDate) = ?
            `;

            const result = await this.db.query<{ TotalBunches: number }>(sql, [gangCode, month, year]);

            if (result.length > 0) {
                return result[0].TotalBunches || 0;
            }

            return 0;

        } catch (error: any) {
            console.error("[HarvesterService] Error fetching gang bunches:", error.message);
            return 0;
        }
    }

    /**
     * Ambil data bunches lengkap (extended) untuk karyawan
     * Termasuk data master dan line
     */
    public async getEmployeeBunchesExtended(empCode: string, gangCode: string, month: number, year: number): Promise<HarvestExtendedData | null> {
        try {
            // Ambil dari line table (detail per karyawan)
            const lineSql = `
                SELECT TOP 1
                    m.GangCode,
                    m.DocDate,
                    l.EmpCode,
                    l.EmpName,
                    SUM(l.TotalBunches) as TotalBunches,
                    SUM(l.Ripe) as Ripe,
                    SUM(l.Unripe) as Unripe,
                    SUM(l.TotalRound) as TotalRound,
                    COUNT(*) as TrxCount
                FROM PR_HARVESTERLN_ARC l
                INNER JOIN PR_HARVESTER_ARC m ON l.MasterID = m.ID
                WHERE l.EmpCode = ?
                    AND m.GangCode = ?
                    AND MONTH(l.TrxDate) = ?
                    AND YEAR(l.TrxDate) = ?
                GROUP BY m.GangCode, m.DocDate, l.EmpCode, l.EmpName
            `;

            const results = await this.db.query<any>(lineSql, [empCode, gangCode, month, year]);

            if (results.length > 0) {
                const row = results[0];
                return {
                    gang_code: row.GangCode,
                    emp_code: row.EmpCode,
                    emp_name: row.EmpName,
                    month: month,
                    year: year,
                    doc_date: new Date(row.DocDate),
                    total_bunches: row.TotalBunches || 0,
                    bunches_ripe: row.Ripe || 0,
                    bunches_unripe: row.Unripe || 0,
                    bunches_round: row.TotalRound || 0,
                    bunches_transactions: row.TrxCount || 0,
                };
            }

            return null;

        } catch (error: any) {
            console.error("[HarvesterService] Error fetching extended bunches:", error.message);
            return null;
        }
    }
}

export const harvesterService = HarvesterService.getInstance();
