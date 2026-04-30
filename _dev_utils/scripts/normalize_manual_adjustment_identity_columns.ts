import { Database } from "../../backend/src/db/client";
import { Config } from "../../backend/src/config";

const APPLY = process.argv.includes("--apply");
const APPLY_RESOLVED = process.argv.includes("--apply-resolved");
const UNRESOLVED_ONLY = process.argv.includes("--unresolved-only");
const inspectNameArg = process.argv.find((arg) => arg.startsWith("--inspect-name="));
const INSPECT_NAME = inspectNameArg ? inspectNameArg.slice("--inspect-name=".length) : "";
const SCRIPT_USER = "normalize_manual_adjustment_identity_columns";

function qname(value: string): string {
    return `[${String(value || "").replace(/]/g, "]]")}]`;
}

async function main() {
    const extendDb = Database.getInstance(Config.DB_EXTEND_DATABASE, Config.DB_EXTEND_PROFILE);
    const mainDbName = qname(Config.DEFAULT_DATABASE);

    await extendDb.query(`
        IF COL_LENGTH('dbo.payroll_manual_adjustments', 'nik') IS NULL
        BEGIN
            ALTER TABLE dbo.payroll_manual_adjustments ADD nik VARCHAR(50) NULL;
        END;

        IF COL_LENGTH('dbo.payroll_manual_adjustments', 'emp_name') IS NULL
        BEGIN
            ALTER TABLE dbo.payroll_manual_adjustments ADD emp_name VARCHAR(150) NULL;
        END;

        IF COL_LENGTH('dbo.payroll_manual_adjustments', 'metadata_json') IS NULL
        BEGIN
            ALTER TABLE dbo.payroll_manual_adjustments ADD metadata_json NVARCHAR(MAX) NULL;
        END;

        IF NOT EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE name = 'IX_payroll_manual_adjustments_nik'
              AND object_id = OBJECT_ID('dbo.payroll_manual_adjustments')
        )
        BEGIN
            CREATE INDEX IX_payroll_manual_adjustments_nik
                ON dbo.payroll_manual_adjustments (nik, period_year, period_month);
        END;
    `);

    if (INSPECT_NAME) {
        const rows = await extendDb.query<any>(`
            SELECT TOP 1000
                id,
                period_month,
                period_year,
                RTRIM(emp_code) AS emp_code,
                RTRIM(ISNULL(nik, '')) AS nik,
                RTRIM(ISNULL(gang_code, '')) AS gang_code,
                RTRIM(ISNULL(division_code, '')) AS division_code,
                adjustment_type,
                adjustment_name,
                amount,
                remarks,
                created_at,
                created_by,
                updated_at,
                updated_by,
                RTRIM(ISNULL(emp_name, '')) AS emp_name,
                metadata_json
            FROM dbo.payroll_manual_adjustments
            WHERE UPPER(RTRIM(ISNULL(emp_name, ''))) = UPPER(RTRIM(?))
            ORDER BY id DESC
        `, [INSPECT_NAME]);
        console.log(JSON.stringify({ inspect_name: INSPECT_NAME, row_count: rows.length, rows }, null, 2));
        return;
    }

    const summary = await extendDb.query<any>(`
        SELECT
            COUNT(*) AS total_rows,
            SUM(CASE WHEN emp_code LIKE '[0-9]%' AND emp_code NOT LIKE '%[^0-9]%' THEN 1 ELSE 0 END) AS numeric_emp_code_rows,
            SUM(CASE WHEN nik IS NULL OR LTRIM(RTRIM(nik)) = '' THEN 1 ELSE 0 END) AS missing_nik_rows
        FROM dbo.payroll_manual_adjustments
    `);

    const preview = await extendDb.query<any>(`
        SELECT TOP 50
            p.id,
            RTRIM(p.emp_code) AS current_emp_code,
            RTRIM(ISNULL(p.nik, '')) AS current_nik,
            RTRIM(ISNULL(e.EmpCode, '')) AS resolved_emp_code,
            RTRIM(ISNULL(e.NewICNo, '')) AS resolved_nik,
            RTRIM(ISNULL(e.EmpName, '')) AS resolved_emp_name,
            p.adjustment_type,
            p.adjustment_name,
            p.amount
        FROM dbo.payroll_manual_adjustments p
        OUTER APPLY (
            SELECT TOP 1 e.*
            FROM ${mainDbName}.dbo.HR_EMPLOYEE e
            WHERE
                RTRIM(e.EmpCode) = RTRIM(p.emp_code)
                OR NULLIF(RTRIM(ISNULL(e.NewICNo, '')), '') = NULLIF(RTRIM(p.emp_code), '')
                OR NULLIF(RTRIM(ISNULL(e.NewICNo, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '')
            ORDER BY
                CASE
                    WHEN RTRIM(e.EmpCode) = RTRIM(p.emp_code) THEN 0
                    WHEN NULLIF(RTRIM(ISNULL(e.NewICNo, '')), '') = NULLIF(RTRIM(p.emp_code), '') THEN 1
                    WHEN NULLIF(RTRIM(ISNULL(e.NewICNo, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '') THEN 2
                    ELSE 3
                END,
                e.EmpCode DESC
        ) e
        WHERE
            (p.emp_code LIKE '[0-9]%' AND p.emp_code NOT LIKE '%[^0-9]%')
            OR (p.nik IS NULL OR LTRIM(RTRIM(p.nik)) = '')
        ORDER BY p.id DESC
    `);

    const unresolvedNumericPreview = await extendDb.query<any>(`
        SELECT TOP 50
            p.id,
            RTRIM(p.emp_code) AS current_emp_code,
            RTRIM(ISNULL(p.nik, '')) AS current_nik,
            RTRIM(ISNULL(h.emp_code, '')) AS history_resolved_emp_code,
            RTRIM(ISNULL(h.nik, '')) AS history_resolved_nik,
            RTRIM(ISNULL(h.emp_name, '')) AS history_resolved_emp_name,
            RTRIM(ISNULL(h.match_source, '')) AS history_match_source,
            RTRIM(ISNULL(p.emp_name, '')) AS emp_name,
            RTRIM(ISNULL(p.gang_code, '')) AS gang_code,
            RTRIM(ISNULL(p.division_code, '')) AS division_code,
            p.period_month,
            p.period_year,
            p.adjustment_type,
            p.adjustment_name,
            p.amount,
            p.created_by,
            p.updated_by,
            p.remarks
        FROM dbo.payroll_manual_adjustments p
        OUTER APPLY (
            SELECT TOP 1 e.*
            FROM ${mainDbName}.dbo.HR_EMPLOYEE e
            WHERE
                RTRIM(e.EmpCode) = RTRIM(p.emp_code)
                OR NULLIF(RTRIM(ISNULL(e.NewICNo, '')), '') = NULLIF(RTRIM(p.emp_code), '')
                OR NULLIF(RTRIM(ISNULL(e.NewICNo, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '')
            ORDER BY
                CASE
                    WHEN RTRIM(e.EmpCode) = RTRIM(p.emp_code) THEN 0
                    WHEN NULLIF(RTRIM(ISNULL(e.NewICNo, '')), '') = NULLIF(RTRIM(p.emp_code), '') THEN 1
                    WHEN NULLIF(RTRIM(ISNULL(e.NewICNo, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '') THEN 2
                    ELSE 3
                END,
                e.EmpCode DESC
        ) e
        OUTER APPLY (
            SELECT COUNT(DISTINCT RTRIM(h2.emp_code)) AS distinct_emp_codes
            FROM dbo.history_hr_employee h2
            WHERE h2.period_month = p.period_month
              AND h2.period_year = p.period_year
              AND NULLIF(RTRIM(ISNULL(h2.emp_code, '')), '') IS NOT NULL
              AND (
                  NULLIF(RTRIM(ISNULL(h2.nik, '')), '') = NULLIF(RTRIM(p.emp_code), '')
                  OR NULLIF(RTRIM(ISNULL(h2.new_nik, '')), '') = NULLIF(RTRIM(p.emp_code), '')
                  OR NULLIF(RTRIM(ISNULL(h2.nik, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '')
                  OR NULLIF(RTRIM(ISNULL(h2.new_nik, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '')
                  OR (
                      NULLIF(RTRIM(ISNULL(p.emp_name, '')), '') IS NOT NULL
                      AND NULLIF(RTRIM(ISNULL(p.gang_code, '')), '') IS NOT NULL
                      AND UPPER(RTRIM(h2.emp_name)) = UPPER(RTRIM(p.emp_name))
                      AND UPPER(RTRIM(h2.gang_code)) = UPPER(RTRIM(p.gang_code))
                  )
              )
        ) hc
        OUTER APPLY (
            SELECT TOP 1
                RTRIM(h1.emp_code) AS emp_code,
                COALESCE(NULLIF(RTRIM(ISNULL(h1.nik, '')), ''), NULLIF(RTRIM(ISNULL(h1.new_nik, '')), ''), RTRIM(p.emp_code)) AS nik,
                RTRIM(ISNULL(h1.emp_name, '')) AS emp_name,
                CASE
                    WHEN NULLIF(RTRIM(ISNULL(h1.nik, '')), '') = NULLIF(RTRIM(p.emp_code), '')
                      OR NULLIF(RTRIM(ISNULL(h1.new_nik, '')), '') = NULLIF(RTRIM(p.emp_code), '')
                      OR NULLIF(RTRIM(ISNULL(h1.nik, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '')
                      OR NULLIF(RTRIM(ISNULL(h1.new_nik, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '')
                    THEN 'history_nik'
                    ELSE 'history_name_gang'
                END AS match_source
            FROM dbo.history_hr_employee h1
            WHERE h1.period_month = p.period_month
              AND h1.period_year = p.period_year
              AND NULLIF(RTRIM(ISNULL(h1.emp_code, '')), '') IS NOT NULL
              AND hc.distinct_emp_codes = 1
              AND (
                  NULLIF(RTRIM(ISNULL(h1.nik, '')), '') = NULLIF(RTRIM(p.emp_code), '')
                  OR NULLIF(RTRIM(ISNULL(h1.new_nik, '')), '') = NULLIF(RTRIM(p.emp_code), '')
                  OR NULLIF(RTRIM(ISNULL(h1.nik, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '')
                  OR NULLIF(RTRIM(ISNULL(h1.new_nik, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '')
                  OR (
                      NULLIF(RTRIM(ISNULL(p.emp_name, '')), '') IS NOT NULL
                      AND NULLIF(RTRIM(ISNULL(p.gang_code, '')), '') IS NOT NULL
                      AND UPPER(RTRIM(h1.emp_name)) = UPPER(RTRIM(p.emp_name))
                      AND UPPER(RTRIM(h1.gang_code)) = UPPER(RTRIM(p.gang_code))
                  )
              )
            ORDER BY
                CASE
                    WHEN NULLIF(RTRIM(ISNULL(h1.nik, '')), '') = NULLIF(RTRIM(p.emp_code), '')
                      OR NULLIF(RTRIM(ISNULL(h1.new_nik, '')), '') = NULLIF(RTRIM(p.emp_code), '')
                      OR NULLIF(RTRIM(ISNULL(h1.nik, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '')
                      OR NULLIF(RTRIM(ISNULL(h1.new_nik, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '')
                    THEN 0
                    ELSE 1
                END,
                h1.created_at DESC,
                h1.id DESC
        ) h
        WHERE
            p.emp_code LIKE '[0-9]%'
            AND p.emp_code NOT LIKE '%[^0-9]%'
            AND NULLIF(RTRIM(ISNULL(e.EmpCode, '')), '') IS NULL
        ORDER BY p.id DESC
    `);

    const identityVerification = await extendDb.query<any>(`
        SELECT
            SUM(CASE
                WHEN p.emp_code LIKE '[0-9]%'
                 AND p.emp_code NOT LIKE '%[^0-9]%'
                 AND NULLIF(RTRIM(ISNULL(e.EmpCode, '')), '') IS NULL
                THEN 1 ELSE 0
            END) AS unresolved_numeric_emp_code_rows,
            SUM(CASE
                WHEN (p.nik IS NULL OR LTRIM(RTRIM(p.nik)) = '')
                 AND COALESCE(
                    NULLIF(RTRIM(ISNULL(e.NewICNo, '')), ''),
                    CASE WHEN p.emp_code LIKE '[0-9]%' AND p.emp_code NOT LIKE '%[^0-9]%' THEN RTRIM(p.emp_code) ELSE NULL END
                 ) IS NULL
                THEN 1 ELSE 0
            END) AS missing_nik_after_resolution_rows
        FROM dbo.payroll_manual_adjustments p
        OUTER APPLY (
            SELECT TOP 1 e.*
            FROM ${mainDbName}.dbo.HR_EMPLOYEE e
            WHERE
                RTRIM(e.EmpCode) = RTRIM(p.emp_code)
                OR NULLIF(RTRIM(ISNULL(e.NewICNo, '')), '') = NULLIF(RTRIM(p.emp_code), '')
                OR NULLIF(RTRIM(ISNULL(e.NewICNo, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '')
            ORDER BY
                CASE
                    WHEN RTRIM(e.EmpCode) = RTRIM(p.emp_code) THEN 0
                    WHEN NULLIF(RTRIM(ISNULL(e.NewICNo, '')), '') = NULLIF(RTRIM(p.emp_code), '') THEN 1
                    WHEN NULLIF(RTRIM(ISNULL(e.NewICNo, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '') THEN 2
                    ELSE 3
                END,
                e.EmpCode DESC
        ) e
    `);

    const historyResolvableSummary = await extendDb.query<any>(`
        SELECT
            SUM(CASE WHEN h.emp_code IS NOT NULL THEN 1 ELSE 0 END) AS history_resolvable_numeric_emp_code_rows,
            SUM(CASE WHEN h.emp_code IS NULL THEN 1 ELSE 0 END) AS unresolved_after_history_rows
        FROM dbo.payroll_manual_adjustments p
        OUTER APPLY (
            SELECT TOP 1 e.*
            FROM ${mainDbName}.dbo.HR_EMPLOYEE e
            WHERE
                RTRIM(e.EmpCode) = RTRIM(p.emp_code)
                OR NULLIF(RTRIM(ISNULL(e.NewICNo, '')), '') = NULLIF(RTRIM(p.emp_code), '')
                OR NULLIF(RTRIM(ISNULL(e.NewICNo, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '')
            ORDER BY
                CASE
                    WHEN RTRIM(e.EmpCode) = RTRIM(p.emp_code) THEN 0
                    WHEN NULLIF(RTRIM(ISNULL(e.NewICNo, '')), '') = NULLIF(RTRIM(p.emp_code), '') THEN 1
                    WHEN NULLIF(RTRIM(ISNULL(e.NewICNo, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '') THEN 2
                    ELSE 3
                END,
                e.EmpCode DESC
        ) e
        OUTER APPLY (
            SELECT COUNT(DISTINCT RTRIM(h2.emp_code)) AS distinct_emp_codes
            FROM dbo.history_hr_employee h2
            WHERE h2.period_month = p.period_month
              AND h2.period_year = p.period_year
              AND NULLIF(RTRIM(ISNULL(h2.emp_code, '')), '') IS NOT NULL
              AND (
                  NULLIF(RTRIM(ISNULL(h2.nik, '')), '') = NULLIF(RTRIM(p.emp_code), '')
                  OR NULLIF(RTRIM(ISNULL(h2.new_nik, '')), '') = NULLIF(RTRIM(p.emp_code), '')
                  OR NULLIF(RTRIM(ISNULL(h2.nik, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '')
                  OR NULLIF(RTRIM(ISNULL(h2.new_nik, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '')
                  OR (
                      NULLIF(RTRIM(ISNULL(p.emp_name, '')), '') IS NOT NULL
                      AND NULLIF(RTRIM(ISNULL(p.gang_code, '')), '') IS NOT NULL
                      AND UPPER(RTRIM(h2.emp_name)) = UPPER(RTRIM(p.emp_name))
                      AND UPPER(RTRIM(h2.gang_code)) = UPPER(RTRIM(p.gang_code))
                  )
              )
        ) hc
        OUTER APPLY (
            SELECT TOP 1 RTRIM(h1.emp_code) AS emp_code
            FROM dbo.history_hr_employee h1
            WHERE h1.period_month = p.period_month
              AND h1.period_year = p.period_year
              AND NULLIF(RTRIM(ISNULL(h1.emp_code, '')), '') IS NOT NULL
              AND hc.distinct_emp_codes = 1
              AND (
                  NULLIF(RTRIM(ISNULL(h1.nik, '')), '') = NULLIF(RTRIM(p.emp_code), '')
                  OR NULLIF(RTRIM(ISNULL(h1.new_nik, '')), '') = NULLIF(RTRIM(p.emp_code), '')
                  OR NULLIF(RTRIM(ISNULL(h1.nik, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '')
                  OR NULLIF(RTRIM(ISNULL(h1.new_nik, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '')
                  OR (
                      NULLIF(RTRIM(ISNULL(p.emp_name, '')), '') IS NOT NULL
                      AND NULLIF(RTRIM(ISNULL(p.gang_code, '')), '') IS NOT NULL
                      AND UPPER(RTRIM(h1.emp_name)) = UPPER(RTRIM(p.emp_name))
                      AND UPPER(RTRIM(h1.gang_code)) = UPPER(RTRIM(p.gang_code))
                  )
              )
            ORDER BY
                CASE
                    WHEN NULLIF(RTRIM(ISNULL(h1.nik, '')), '') = NULLIF(RTRIM(p.emp_code), '')
                      OR NULLIF(RTRIM(ISNULL(h1.new_nik, '')), '') = NULLIF(RTRIM(p.emp_code), '')
                      OR NULLIF(RTRIM(ISNULL(h1.nik, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '')
                      OR NULLIF(RTRIM(ISNULL(h1.new_nik, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '')
                    THEN 0
                    ELSE 1
                END,
                h1.created_at DESC,
                h1.id DESC
        ) h
        WHERE p.emp_code LIKE '[0-9]%'
          AND p.emp_code NOT LIKE '%[^0-9]%'
          AND NULLIF(RTRIM(ISNULL(e.EmpCode, '')), '') IS NULL
    `);

    if (UNRESOLVED_ONLY) {
        console.log(JSON.stringify({
            summary: summary[0] || {},
            identity_verification: identityVerification[0] || {},
            history_resolvable_summary: historyResolvableSummary[0] || {},
            unresolved_numeric_emp_code_preview: unresolvedNumericPreview
        }, null, 2));
        return;
    }

    const duplicateAfterNormalizationPreview = await extendDb.query<any>(`
        SELECT TOP 50
            period_month,
            period_year,
            normalized_emp_code AS emp_code,
            adjustment_type,
            adjustment_name,
            COUNT(*) AS row_count,
            SUM(CAST(amount AS DECIMAL(18, 2))) AS total_amount,
            MIN(id) AS first_id,
            MAX(id) AS last_id
        FROM (
            SELECT
                p.id,
                p.period_month,
                p.period_year,
                CASE
                    WHEN p.emp_code LIKE '[0-9]%' AND p.emp_code NOT LIKE '%[^0-9]%' AND NULLIF(RTRIM(ISNULL(e.EmpCode, '')), '') IS NOT NULL
                        THEN RTRIM(e.EmpCode)
                    ELSE RTRIM(p.emp_code)
                END AS normalized_emp_code,
                p.adjustment_type,
                p.adjustment_name,
                p.amount
            FROM dbo.payroll_manual_adjustments p
            OUTER APPLY (
                SELECT TOP 1 e.*
                FROM ${mainDbName}.dbo.HR_EMPLOYEE e
                WHERE
                    RTRIM(e.EmpCode) = RTRIM(p.emp_code)
                    OR NULLIF(RTRIM(ISNULL(e.NewICNo, '')), '') = NULLIF(RTRIM(p.emp_code), '')
                    OR NULLIF(RTRIM(ISNULL(e.NewICNo, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '')
                ORDER BY
                    CASE
                        WHEN RTRIM(e.EmpCode) = RTRIM(p.emp_code) THEN 0
                        WHEN NULLIF(RTRIM(ISNULL(e.NewICNo, '')), '') = NULLIF(RTRIM(p.emp_code), '') THEN 1
                        WHEN NULLIF(RTRIM(ISNULL(e.NewICNo, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '') THEN 2
                        ELSE 3
                    END,
                    e.EmpCode DESC
            ) e
        ) normalized
        GROUP BY period_month, period_year, normalized_emp_code, adjustment_type, adjustment_name
        HAVING COUNT(*) > 1
        ORDER BY period_year DESC, period_month DESC, normalized_emp_code, adjustment_name
    `);

    const duplicateAfterNormalizationSummary = await extendDb.query<any>(`
        SELECT COUNT(*) AS duplicate_group_after_normalization_count
        FROM (
            SELECT
                period_month,
                period_year,
                normalized_emp_code,
                adjustment_type,
                adjustment_name
            FROM (
                SELECT
                    p.period_month,
                    p.period_year,
                    CASE
                        WHEN p.emp_code LIKE '[0-9]%' AND p.emp_code NOT LIKE '%[^0-9]%' AND NULLIF(RTRIM(ISNULL(e.EmpCode, '')), '') IS NOT NULL
                            THEN RTRIM(e.EmpCode)
                        ELSE RTRIM(p.emp_code)
                    END AS normalized_emp_code,
                    p.adjustment_type,
                    p.adjustment_name
                FROM dbo.payroll_manual_adjustments p
                OUTER APPLY (
                    SELECT TOP 1 e.*
                    FROM ${mainDbName}.dbo.HR_EMPLOYEE e
                    WHERE
                        RTRIM(e.EmpCode) = RTRIM(p.emp_code)
                        OR NULLIF(RTRIM(ISNULL(e.NewICNo, '')), '') = NULLIF(RTRIM(p.emp_code), '')
                        OR NULLIF(RTRIM(ISNULL(e.NewICNo, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '')
                    ORDER BY
                        CASE
                            WHEN RTRIM(e.EmpCode) = RTRIM(p.emp_code) THEN 0
                            WHEN NULLIF(RTRIM(ISNULL(e.NewICNo, '')), '') = NULLIF(RTRIM(p.emp_code), '') THEN 1
                            WHEN NULLIF(RTRIM(ISNULL(e.NewICNo, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '') THEN 2
                            ELSE 3
                        END,
                        e.EmpCode DESC
                ) e
            ) normalized
            GROUP BY period_month, period_year, normalized_emp_code, adjustment_type, adjustment_name
            HAVING COUNT(*) > 1
        ) duplicate_groups
    `);

    console.log("payroll_manual_adjustments identity normalization preview:");
    console.log(JSON.stringify({
        apply: APPLY,
        apply_resolved: APPLY_RESOLVED,
        summary: summary[0] || {},
        identity_verification: identityVerification[0] || {},
        history_resolvable_summary: historyResolvableSummary[0] || {},
        duplicate_summary: duplicateAfterNormalizationSummary[0] || {},
        preview,
        unresolved_numeric_emp_code_preview: unresolvedNumericPreview,
        duplicate_after_normalization_preview: duplicateAfterNormalizationPreview
    }, null, 2));

    if (!APPLY && !APPLY_RESOLVED) {
        console.log("DRY RUN only. Re-run with --apply to add/backfill nik and normalize numeric emp_code rows.");
        return;
    }

    const unresolvedNumericRows = Number(identityVerification[0]?.unresolved_numeric_emp_code_rows || 0);
    if (APPLY && unresolvedNumericRows > 0) {
        throw new Error(`Tidak menjalankan --apply karena masih ada ${unresolvedNumericRows} baris emp_code numerik yang tidak bisa diresolve ke HR_EMPLOYEE.EmpCode. Perbaiki mapping HR/manual dulu agar emp_code tetap konsisten sebagai kode PTRJ.`);
    }

    const updateResult = await extendDb.query<any>(`
        UPDATE p
        SET
            nik = COALESCE(NULLIF(RTRIM(p.nik), ''), NULLIF(RTRIM(e.NewICNo), ''), CASE WHEN p.emp_code LIKE '[0-9]%' AND p.emp_code NOT LIKE '%[^0-9]%' THEN RTRIM(p.emp_code) ELSE NULL END),
            emp_code = CASE
                WHEN p.emp_code LIKE '[0-9]%' AND p.emp_code NOT LIKE '%[^0-9]%' AND NULLIF(RTRIM(e.EmpCode), '') IS NOT NULL
                    THEN RTRIM(e.EmpCode)
                ELSE RTRIM(p.emp_code)
            END,
            emp_name = COALESCE(NULLIF(RTRIM(p.emp_name), ''), NULLIF(RTRIM(e.EmpName), '')),
            updated_at = GETDATE(),
            updated_by = ?
        FROM dbo.payroll_manual_adjustments p
        OUTER APPLY (
            SELECT TOP 1 e.*
            FROM ${mainDbName}.dbo.HR_EMPLOYEE e
            WHERE
                RTRIM(e.EmpCode) = RTRIM(p.emp_code)
                OR NULLIF(RTRIM(ISNULL(e.NewICNo, '')), '') = NULLIF(RTRIM(p.emp_code), '')
                OR NULLIF(RTRIM(ISNULL(e.NewICNo, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '')
            ORDER BY
                CASE
                    WHEN RTRIM(e.EmpCode) = RTRIM(p.emp_code) THEN 0
                    WHEN NULLIF(RTRIM(ISNULL(e.NewICNo, '')), '') = NULLIF(RTRIM(p.emp_code), '') THEN 1
                    WHEN NULLIF(RTRIM(ISNULL(e.NewICNo, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '') THEN 2
                    ELSE 3
                END,
                e.EmpCode DESC
        ) e
        WHERE
            (
                (p.emp_code LIKE '[0-9]%' AND p.emp_code NOT LIKE '%[^0-9]%' AND NULLIF(RTRIM(e.EmpCode), '') IS NOT NULL)
                OR (p.nik IS NULL OR LTRIM(RTRIM(p.nik)) = '')
                OR (p.emp_name IS NULL OR LTRIM(RTRIM(p.emp_name)) = '')
            )
            AND NULLIF(RTRIM(e.EmpCode), '') IS NOT NULL
    `, [SCRIPT_USER]);

    const contextUpdateResult = await extendDb.query<any>(`
        UPDATE p
        SET
            nik = COALESCE(NULLIF(RTRIM(p.nik), ''), NULLIF(RTRIM(e.NewICNo), ''), RTRIM(p.emp_code)),
            emp_code = RTRIM(e.EmpCode),
            emp_name = COALESCE(NULLIF(RTRIM(p.emp_name), ''), NULLIF(RTRIM(e.EmpName), '')),
            updated_at = GETDATE(),
            updated_by = ?
        FROM dbo.payroll_manual_adjustments p
        OUTER APPLY (
            SELECT TOP 1 e.*
            FROM ${mainDbName}.dbo.HR_EMPLOYEE e
            JOIN ${mainDbName}.dbo.HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
            WHERE p.emp_code LIKE '[0-9]%'
              AND p.emp_code NOT LIKE '%[^0-9]%'
              AND NULLIF(RTRIM(ISNULL(p.emp_name, '')), '') IS NOT NULL
              AND NULLIF(RTRIM(ISNULL(p.gang_code, '')), '') IS NOT NULL
              AND UPPER(RTRIM(e.EmpName)) = UPPER(RTRIM(p.emp_name))
              AND UPPER(RTRIM(gl.GangCode)) = UPPER(RTRIM(p.gang_code))
            ORDER BY e.EmpCode DESC
        ) e
        WHERE p.emp_code LIKE '[0-9]%'
          AND p.emp_code NOT LIKE '%[^0-9]%'
          AND NULLIF(RTRIM(e.EmpCode), '') IS NOT NULL
    `, ["normalize_manual_adj_name_gang"]);

    const historyUpdateResult = await extendDb.query<any>(`
        ;WITH history_candidates AS (
            SELECT
                p.id,
                h.emp_code,
                h.nik,
                h.emp_name,
                h.match_source
            FROM dbo.payroll_manual_adjustments p
            OUTER APPLY (
                SELECT TOP 1 e.*
                FROM ${mainDbName}.dbo.HR_EMPLOYEE e
                WHERE
                    RTRIM(e.EmpCode) = RTRIM(p.emp_code)
                    OR NULLIF(RTRIM(ISNULL(e.NewICNo, '')), '') = NULLIF(RTRIM(p.emp_code), '')
                    OR NULLIF(RTRIM(ISNULL(e.NewICNo, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '')
                ORDER BY
                    CASE
                        WHEN RTRIM(e.EmpCode) = RTRIM(p.emp_code) THEN 0
                        WHEN NULLIF(RTRIM(ISNULL(e.NewICNo, '')), '') = NULLIF(RTRIM(p.emp_code), '') THEN 1
                        WHEN NULLIF(RTRIM(ISNULL(e.NewICNo, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '') THEN 2
                        ELSE 3
                    END,
                    e.EmpCode DESC
            ) e
            OUTER APPLY (
                SELECT COUNT(DISTINCT RTRIM(h2.emp_code)) AS distinct_emp_codes
                FROM dbo.history_hr_employee h2
                WHERE h2.period_month = p.period_month
                  AND h2.period_year = p.period_year
                  AND NULLIF(RTRIM(ISNULL(h2.emp_code, '')), '') IS NOT NULL
                  AND (
                      RTRIM(h2.emp_code) = RTRIM(p.emp_code)
                      OR NULLIF(RTRIM(ISNULL(h2.nik, '')), '') = NULLIF(RTRIM(p.emp_code), '')
                      OR NULLIF(RTRIM(ISNULL(h2.new_nik, '')), '') = NULLIF(RTRIM(p.emp_code), '')
                      OR NULLIF(RTRIM(ISNULL(h2.nik, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '')
                      OR NULLIF(RTRIM(ISNULL(h2.new_nik, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '')
                      OR (
                          NULLIF(RTRIM(ISNULL(p.emp_name, '')), '') IS NOT NULL
                          AND NULLIF(RTRIM(ISNULL(p.gang_code, '')), '') IS NOT NULL
                          AND UPPER(RTRIM(h2.emp_name)) = UPPER(RTRIM(p.emp_name))
                          AND UPPER(RTRIM(h2.gang_code)) = UPPER(RTRIM(p.gang_code))
                      )
                  )
            ) hc
            OUTER APPLY (
                SELECT TOP 1
                    RTRIM(h1.emp_code) AS emp_code,
                    COALESCE(NULLIF(RTRIM(ISNULL(h1.nik, '')), ''), NULLIF(RTRIM(ISNULL(h1.new_nik, '')), ''), RTRIM(p.emp_code)) AS nik,
                    RTRIM(ISNULL(h1.emp_name, '')) AS emp_name,
                    CASE
                        WHEN RTRIM(h1.emp_code) = RTRIM(p.emp_code) THEN 'history_emp_code'
                        WHEN NULLIF(RTRIM(ISNULL(h1.nik, '')), '') = NULLIF(RTRIM(p.emp_code), '')
                          OR NULLIF(RTRIM(ISNULL(h1.new_nik, '')), '') = NULLIF(RTRIM(p.emp_code), '')
                          OR NULLIF(RTRIM(ISNULL(h1.nik, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '')
                          OR NULLIF(RTRIM(ISNULL(h1.new_nik, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '')
                        THEN 'history_nik'
                        ELSE 'history_name_gang'
                    END AS match_source
                FROM dbo.history_hr_employee h1
                WHERE h1.period_month = p.period_month
                  AND h1.period_year = p.period_year
                  AND NULLIF(RTRIM(ISNULL(h1.emp_code, '')), '') IS NOT NULL
                  AND hc.distinct_emp_codes = 1
                  AND (
                      RTRIM(h1.emp_code) = RTRIM(p.emp_code)
                      OR NULLIF(RTRIM(ISNULL(h1.nik, '')), '') = NULLIF(RTRIM(p.emp_code), '')
                      OR NULLIF(RTRIM(ISNULL(h1.new_nik, '')), '') = NULLIF(RTRIM(p.emp_code), '')
                      OR NULLIF(RTRIM(ISNULL(h1.nik, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '')
                      OR NULLIF(RTRIM(ISNULL(h1.new_nik, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '')
                      OR (
                          NULLIF(RTRIM(ISNULL(p.emp_name, '')), '') IS NOT NULL
                          AND NULLIF(RTRIM(ISNULL(p.gang_code, '')), '') IS NOT NULL
                          AND UPPER(RTRIM(h1.emp_name)) = UPPER(RTRIM(p.emp_name))
                          AND UPPER(RTRIM(h1.gang_code)) = UPPER(RTRIM(p.gang_code))
                      )
                  )
                ORDER BY
                    CASE
                        WHEN RTRIM(h1.emp_code) = RTRIM(p.emp_code) THEN 0
                        WHEN NULLIF(RTRIM(ISNULL(h1.nik, '')), '') = NULLIF(RTRIM(p.emp_code), '')
                          OR NULLIF(RTRIM(ISNULL(h1.new_nik, '')), '') = NULLIF(RTRIM(p.emp_code), '')
                          OR NULLIF(RTRIM(ISNULL(h1.nik, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '')
                          OR NULLIF(RTRIM(ISNULL(h1.new_nik, '')), '') = NULLIF(RTRIM(ISNULL(p.nik, '')), '')
                        THEN 1
                        ELSE 2
                    END,
                    h1.created_at DESC,
                    h1.id DESC
            ) h
            WHERE h.emp_code IS NOT NULL
              AND (
                  (
                      p.emp_code LIKE '[0-9]%'
                      AND p.emp_code NOT LIKE '%[^0-9]%'
                      AND NULLIF(RTRIM(ISNULL(e.EmpCode, '')), '') IS NULL
                  )
                  OR (
                      (p.nik IS NULL OR LTRIM(RTRIM(p.nik)) = '')
                      AND h.match_source = 'history_emp_code'
                      AND NULLIF(RTRIM(ISNULL(h.nik, '')), '') IS NOT NULL
                  )
              )
        )
        UPDATE p
        SET
            nik = COALESCE(NULLIF(RTRIM(p.nik), ''), NULLIF(RTRIM(h.nik), ''), CASE WHEN p.emp_code LIKE '[0-9]%' AND p.emp_code NOT LIKE '%[^0-9]%' THEN RTRIM(p.emp_code) ELSE NULL END),
            emp_code = CASE
                WHEN p.emp_code LIKE '[0-9]%' AND p.emp_code NOT LIKE '%[^0-9]%' THEN RTRIM(h.emp_code)
                ELSE RTRIM(p.emp_code)
            END,
            emp_name = COALESCE(NULLIF(RTRIM(p.emp_name), ''), NULLIF(RTRIM(h.emp_name), '')),
            updated_at = GETDATE(),
            updated_by = ?
        FROM dbo.payroll_manual_adjustments p
        JOIN history_candidates h ON h.id = p.id
    `, ["normalize_manual_adj_history"]);

    const duplicateReport = await extendDb.query<any>(`
        SELECT
            period_month,
            period_year,
            emp_code,
            adjustment_type,
            adjustment_name,
            COUNT(*) AS row_count,
            SUM(CAST(amount AS DECIMAL(18, 2))) AS total_amount
        FROM dbo.payroll_manual_adjustments
        GROUP BY period_month, period_year, emp_code, adjustment_type, adjustment_name
        HAVING COUNT(*) > 1
        ORDER BY period_year DESC, period_month DESC, emp_code, adjustment_name
    `);

    console.log("Applied identity normalization:");
    console.log(JSON.stringify({ updateResult, contextUpdateResult, historyUpdateResult, duplicateReport }, null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
