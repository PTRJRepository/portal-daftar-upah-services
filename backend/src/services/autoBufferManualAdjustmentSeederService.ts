import { Database } from "../db/client";
import { Config } from "../config";
import { dataExtractorService } from "./dataExtractorService";
import { payrollAutoBufferService } from "./payroll/payrollAutoBufferService";
import { buildAutoBufferSeedRemark } from "./payroll/manualAdjustments/autoBufferAdcodeMap";
import { deriveInitialSpsiMember } from "../utils/payrollProfileRules";

const AUTO_BUFFER_ADJUSTMENT_TYPE = "AUTO_BUFFER";

const AUTO_BUFFER_ADJUSTMENT_NAME = {
    jabatan: "AUTO TUNJANGAN JABATAN",
    masaKerja: "AUTO MASA KERJA",
    spsi: "AUTO SPSI"
} as const;

function toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeString(value: unknown): string {
    return String(value || "").trim();
}

export interface AutoBufferManualAdjustmentSeedInput {
    period_month: number;
    period_year: number;
    division_code: string;
    gang_code?: string;
    use_history_db?: boolean;
    snapshot_version?: number | null;
    // Backward-compatible request field; seeder now always replaces scoped AUTO_BUFFER rows.
    replace_existing?: boolean;
    created_by?: string;
}

export interface AutoBufferManualAdjustmentSeedEntry {
    period_month: number;
    period_year: number;
    emp_code: string;
    gang_code: string;
    division_code: string;
    adjustment_type: typeof AUTO_BUFFER_ADJUSTMENT_TYPE;
    adjustment_name: string;
    amount: number;
    remarks: string;
}

type ExtractedPayrollLike = {
    emp_code?: string;
    nik?: string;
    gang_code?: string;
    jabatan?: string;
    jabatan_estate?: string;
    role?: string;
    hari_kerja?: number;
    jumlah_hk?: number;
    masa_kerja_tahun?: number;
    masa_kerja_display_years?: number;
    jabatan_jumlah?: number;
    masa_kerja_jumlah?: number;
    pot_spsi?: number;
    is_spsi_member?: boolean;
};

export function buildAutoBufferSeedEntries(
    rows: ExtractedPayrollLike[],
    periodMonth: number,
    periodYear: number,
    divisionCode: string
): AutoBufferManualAdjustmentSeedEntry[] {
    const normalizedDivision = normalizeString(divisionCode).toUpperCase();
    const entries: AutoBufferManualAdjustmentSeedEntry[] = [];

    for (const row of rows || []) {
        const empCode = normalizeString(row.emp_code || row.nik).toUpperCase();
        if (!empCode) continue;

        const gangCode = normalizeString(row.gang_code).toUpperCase() || "UNKNOWN";
        const hariKerja = Math.max(0, toNumber(row.hari_kerja));
        const kehadiran = Math.max(0, toNumber(row.jumlah_hk));
        const masaKerjaTahun = Math.max(
            0,
            Math.floor(toNumber(row.masa_kerja_tahun ?? row.masa_kerja_display_years))
        );

        const dbPotSpsi = Math.abs(toNumber(row.pot_spsi));
        const dbJabatanJumlah = toNumber(row.jabatan_jumlah);
        const dbMasaKerjaJumlah = toNumber(row.masa_kerja_jumlah);
        const isSpsiMember = typeof row.is_spsi_member === "boolean"
            ? row.is_spsi_member
            : deriveInitialSpsiMember(dbPotSpsi);

        const auto = payrollAutoBufferService.calculateAutomaticValues({
            jabatanText: normalizeString(row.jabatan_estate || row.jabatan),
            roleText: normalizeString(row.jabatan || row.role),
            hariKerja,
            kehadiran,
            masaKerjaTahun,
            isSpsiMember,
            dbJabatanJumlah,
            dbMasaKerjaJumlah
        });

        entries.push(
            {
                period_month: periodMonth,
                period_year: periodYear,
                emp_code: empCode,
                gang_code: gangCode,
                division_code: normalizedDivision,
                adjustment_type: AUTO_BUFFER_ADJUSTMENT_TYPE,
                adjustment_name: AUTO_BUFFER_ADJUSTMENT_NAME.jabatan,
                amount: auto.jabatanAmount,
                remarks: buildAutoBufferSeedRemark(
                    AUTO_BUFFER_ADJUSTMENT_NAME.jabatan,
                    auto.jabatanAmount,
                    dbJabatanJumlah
                )
            },
            {
                period_month: periodMonth,
                period_year: periodYear,
                emp_code: empCode,
                gang_code: gangCode,
                division_code: normalizedDivision,
                adjustment_type: AUTO_BUFFER_ADJUSTMENT_TYPE,
                adjustment_name: AUTO_BUFFER_ADJUSTMENT_NAME.masaKerja,
                amount: auto.masaKerjaAmount,
                remarks: buildAutoBufferSeedRemark(
                    AUTO_BUFFER_ADJUSTMENT_NAME.masaKerja,
                    auto.masaKerjaAmount,
                    dbMasaKerjaJumlah
                )
            },
            {
                period_month: periodMonth,
                period_year: periodYear,
                emp_code: empCode,
                gang_code: gangCode,
                division_code: normalizedDivision,
                adjustment_type: AUTO_BUFFER_ADJUSTMENT_TYPE,
                adjustment_name: AUTO_BUFFER_ADJUSTMENT_NAME.spsi,
                amount: auto.spsiDeduction,
                remarks: buildAutoBufferSeedRemark(
                    AUTO_BUFFER_ADJUSTMENT_NAME.spsi,
                    auto.spsiDeduction,
                    dbPotSpsi
                )
            }
        );
    }

    return entries;
}

export class AutoBufferManualAdjustmentSeederService {
    private static instance: AutoBufferManualAdjustmentSeederService;

    public static getInstance(): AutoBufferManualAdjustmentSeederService {
        if (!AutoBufferManualAdjustmentSeederService.instance) {
            AutoBufferManualAdjustmentSeederService.instance = new AutoBufferManualAdjustmentSeederService();
        }
        return AutoBufferManualAdjustmentSeederService.instance;
    }

    private getDatabase(): Database {
        return Database.getExtendedInstance();
    }

    public async seedPeriod(input: AutoBufferManualAdjustmentSeedInput) {
        const periodMonth = Math.floor(toNumber(input.period_month));
        const periodYear = Math.floor(toNumber(input.period_year));
        const divisionCode = normalizeString(input.division_code).toUpperCase();
        const gangCode = normalizeString(input.gang_code || "ALL").toUpperCase() || "ALL";
        const useHistoryDb = input.use_history_db === true;
        const snapshotVersion = input.snapshot_version == null ? null : Math.floor(toNumber(input.snapshot_version));
        const createdBy = normalizeString(input.created_by) || "system";

        if (periodMonth < 1 || periodMonth > 12) {
            throw new Error("period_month harus 1-12");
        }
        if (periodYear < 2000) {
            throw new Error("period_year tidak valid");
        }
        if (!divisionCode) {
            throw new Error("division_code wajib diisi");
        }

        const extracted = await dataExtractorService.extractPayrollData(
            periodMonth,
            periodYear,
            gangCode,
            divisionCode,
            null,
            Config.DB_PROFILE,
            false,
            useHistoryDb,
            undefined,
            true,
            true,
            snapshotVersion,
            "db_ptrj_only"
        );

        const entries = buildAutoBufferSeedEntries(
            extracted.data_rows as ExtractedPayrollLike[],
            periodMonth,
            periodYear,
            divisionCode
        );

        const db = this.getDatabase();
        const countQuery = `
            SELECT COUNT(1) as count
            FROM dbo.payroll_manual_adjustments
            WHERE period_month = ? AND period_year = ?
              AND division_code = ?
              AND adjustment_type = '${AUTO_BUFFER_ADJUSTMENT_TYPE}'
              ${gangCode !== "ALL" ? "AND gang_code = ?" : ""}
        `;
        const countParams = gangCode !== "ALL"
            ? [periodMonth, periodYear, divisionCode, gangCode]
            : [periodMonth, periodYear, divisionCode];
        const countRow = await db.queryOne<{ count: number }>(countQuery, countParams);
        const deletedExisting = toNumber(countRow?.count);

        const deleteQuery = `
            DELETE FROM dbo.payroll_manual_adjustments
            WHERE period_month = ? AND period_year = ?
              AND division_code = ?
              AND adjustment_type = '${AUTO_BUFFER_ADJUSTMENT_TYPE}'
              ${gangCode !== "ALL" ? "AND gang_code = ?" : ""}
        `;
        const deleteParams = gangCode !== "ALL"
            ? [periodMonth, periodYear, divisionCode, gangCode]
            : [periodMonth, periodYear, divisionCode];
        await db.query(deleteQuery, deleteParams);

        let inserted = 0;
        const updated = 0;

        for (const entry of entries) {
            await db.query(`
                INSERT INTO dbo.payroll_manual_adjustments (
                    period_month, period_year, emp_code, gang_code, division_code,
                    adjustment_type, adjustment_name, amount, remarks, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                entry.period_month,
                entry.period_year,
                entry.emp_code,
                entry.gang_code,
                entry.division_code,
                entry.adjustment_type,
                entry.adjustment_name,
                entry.amount,
                entry.remarks,
                createdBy
            ]);
            inserted += 1;
        }

        return {
            period_month: periodMonth,
            period_year: periodYear,
            division_code: divisionCode,
            gang_code: gangCode,
            source_rows: extracted.data_rows.length,
            seeded_entries: entries.length,
            inserted,
            updated,
            deleted_existing: deletedExisting,
            replace_existing: true,
            value_priority_mode_source: "db_ptrj_only"
        };
    }

    public async validatePeriod(input: AutoBufferManualAdjustmentSeedInput) {
        const periodMonth = Math.floor(toNumber(input.period_month));
        const periodYear = Math.floor(toNumber(input.period_year));
        const divisionCode = normalizeString(input.division_code).toUpperCase();
        const gangCode = normalizeString(input.gang_code || "ALL").toUpperCase();
        const updatedBy = normalizeString(input.created_by) || "system";

        if (periodMonth < 1 || periodMonth > 12) throw new Error("period_month harus 1-12");
        if (periodYear < 2000) throw new Error("period_year tidak valid");
        if (!divisionCode) throw new Error("division_code wajib diisi");

        const extendDb = this.getDatabase();
        
        // 1. Fetch current AUTO_BUFFER records
        const fetchQuery = `
            SELECT id, emp_code, adjustment_name, amount, remarks
            FROM dbo.payroll_manual_adjustments
            WHERE period_month = ? AND period_year = ?
              AND division_code = ?
              AND adjustment_type = '${AUTO_BUFFER_ADJUSTMENT_TYPE}'
              ${gangCode !== "ALL" ? "AND gang_code = ?" : ""}
        `;
        const fetchParams = gangCode !== "ALL"
            ? [periodMonth, periodYear, divisionCode, gangCode]
            : [periodMonth, periodYear, divisionCode];
            
        const existingRecords = await extendDb.query<any>(fetchQuery, fetchParams);
        
        if (existingRecords.length === 0) {
            return { processed: 0, updated: 0, matches: 0, misses: 0 };
        }

        // Prepare date range for db_ptrj query
        const startDate = `${periodYear}-${String(periodMonth).padStart(2, "0")}-01`;
        const endDateObj = new Date(periodYear, periodMonth, 1);
        const endDate = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, "0")}-01`;

        // 2. Query true values from PR_ADTRANS and PR_ADTRANS_ARC in db_ptrj
        // We use inner join with HR_GANGLN just like dataExtractorService to limit to specific gangs/divisions
        const dbMain = Database.getInstance(); // Uses SERVER_PROFILE_2 natively or SERVER_PROFILE_1 in DEV
        
        // Build gang filter if needed
        let gangJoin = `INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(t.EmpCode)`;
        let gangCondition = ``;
        
        if (gangCode !== "ALL") {
            gangCondition = `AND RTRIM(gl.GangCode) = '${gangCode}'`;
        }

        const trueValuesQuery = `
            SELECT RTRIM(t.EmpCode) as emp_code, 
                   CASE 
                       WHEN UPPER(t.DocDesc) LIKE '%JABATAN%' THEN 'AUTO TUNJANGAN JABATAN'
                       WHEN UPPER(t.DocDesc) LIKE '%MASA%KERJA%' THEN 'AUTO MASA KERJA'
                       WHEN UPPER(t.DocDesc) LIKE '%SPSI%' THEN 'AUTO SPSI'
                   END as adjustment_name,
                   SUM(ln.Amount) as total
            FROM (
                SELECT t.EmpCode, t.ID, t.DocDesc, t.DocDate
                FROM PR_ADTRANS t
                ${gangJoin}
                WHERE t.DocDate >= ? AND t.DocDate < ? ${gangCondition}
                
                UNION ALL
                
                SELECT t.EmpCode, t.ID, t.DocDesc, t.DocDate
                FROM PR_ADTRANS_ARC t
                ${gangJoin}
                WHERE t.DocDate >= ? AND t.DocDate < ? ${gangCondition}
            ) t
            JOIN (
                SELECT MasterID, Amount FROM PR_ADTRANSLN
                UNION ALL
                SELECT MasterID, Amount FROM PR_ADTRANSLN_ARC
            ) ln ON t.ID = ln.MasterID
            WHERE UPPER(t.DocDesc) LIKE '%JABATAN%' 
               OR UPPER(t.DocDesc) LIKE '%MASA%KERJA%' 
               OR UPPER(t.DocDesc) LIKE '%SPSI%'
            GROUP BY RTRIM(t.EmpCode),
                   CASE 
                       WHEN UPPER(t.DocDesc) LIKE '%JABATAN%' THEN 'AUTO TUNJANGAN JABATAN'
                       WHEN UPPER(t.DocDesc) LIKE '%MASA%KERJA%' THEN 'AUTO MASA KERJA'
                       WHEN UPPER(t.DocDesc) LIKE '%SPSI%' THEN 'AUTO SPSI'
                   END
        `;
        
        const trueValues = await dbMain.query<any>(trueValuesQuery, [startDate, endDate, startDate, endDate]);
        
        // Map true values for quick lookup
        const trueValuesMap = new Map<string, number>();
        for (const row of trueValues) {
            const key = `${row.emp_code}_${row.adjustment_name}`;
            trueValuesMap.set(key, toNumber(row.total));
        }

        let updatedCount = 0;
        let matches = 0;
        let misses = 0;

        // 3. Compare and Update
        for (const record of existingRecords) {
            const key = `${record.emp_code}_${record.adjustment_name}`;
            const dbAmount = trueValuesMap.get(key) || 0;
            const currentAmount = Math.abs(toNumber(record.amount)); // Comparing absolute values for safety since SPSI is a deduction
            const absoluteDbAmount = Math.abs(dbAmount);
            
            // Build the new remark containing the match status
            const newRemark = buildAutoBufferSeedRemark(record.adjustment_name, currentAmount, absoluteDbAmount);
            
            // Check if it's a match
            if (Math.abs(currentAmount - absoluteDbAmount) <= 0.01) {
                matches++;
            } else {
                misses++;
            }

            // Update if the remark has changed (e.g. status flipped from MISS to MATCH or amount changed)
            if (record.remarks !== newRemark) {
                await extendDb.query(`
                    UPDATE dbo.payroll_manual_adjustments
                    SET remarks = ?, updated_at = GETDATE(), updated_by = ?
                    WHERE id = ?
                `, [newRemark, updatedBy, record.id]);
                updatedCount++;
            }
        }

        return {
            processed: existingRecords.length,
            updated: updatedCount,
            matches: matches,
            misses: misses
        };
    }
}

export const autoBufferManualAdjustmentSeederService = AutoBufferManualAdjustmentSeederService.getInstance();
