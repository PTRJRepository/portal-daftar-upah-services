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

function buildNormalizedSqlNameExpression(columnName: string): string {
    let expression = `UPPER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(REPLACE(${columnName}, CHAR(9), ' '), CHAR(10), ' '), CHAR(13), ' '), CHAR(160), ' '))))`;
    for (let i = 0; i < 4; i += 1) {
        expression = `REPLACE(${expression}, '  ', ' ')`;
    }
    return expression;
}

export interface AutoBufferManualAdjustmentSeedInput {
    period_month: number;
    period_year: number;
    division_code: string;
    gang_code?: string;
    use_history_db?: boolean;
    snapshot_version?: number | null;
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
            dbJabatanJumlah: toNumber(row.jabatan_jumlah),
            dbMasaKerjaJumlah: toNumber(row.masa_kerja_jumlah)
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
                    auto.jabatanAmount
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
                    auto.masaKerjaAmount
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
                    auto.spsiDeduction
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
        const replaceExisting = input.replace_existing !== false;
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
        let deletedExisting = 0;
        if (replaceExisting) {
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
            deletedExisting = toNumber(countRow?.count);

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
        }

        let inserted = 0;
        let updated = 0;
        const normalizedAdjustmentNameSql = buildNormalizedSqlNameExpression("adjustment_name");

        for (const entry of entries) {
            const existing = await db.queryOne<{ id: number }>(`
                SELECT id
                FROM dbo.payroll_manual_adjustments
                WHERE period_month = ? AND period_year = ?
                  AND emp_code = ?
                  AND adjustment_type = ?
                  AND ${normalizedAdjustmentNameSql} = ?
            `, [
                entry.period_month,
                entry.period_year,
                entry.emp_code,
                entry.adjustment_type,
                entry.adjustment_name.toUpperCase()
            ]);

            if (existing) {
                await db.query(`
                    UPDATE dbo.payroll_manual_adjustments
                    SET gang_code = ?, division_code = ?, amount = ?, remarks = ?,
                        updated_at = GETDATE(), updated_by = ?
                    WHERE id = ?
                `, [
                    entry.gang_code,
                    entry.division_code,
                    entry.amount,
                    entry.remarks,
                    createdBy,
                    existing.id
                ]);
                updated += 1;
                continue;
            }

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
            replace_existing: replaceExisting,
            value_priority_mode_source: "db_ptrj_only"
        };
    }
}

export const autoBufferManualAdjustmentSeederService = AutoBufferManualAdjustmentSeederService.getInstance();
