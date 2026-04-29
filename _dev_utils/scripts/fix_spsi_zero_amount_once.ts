import { Database } from "../../backend/src/db/client";
import { nikToNewestEmpCodeService } from "../../backend/src/services/employee/NikToNewestEmpCodeService";

/**
 * ONE-TIME SCRIPT: Sync SPSI status and amounts from db_ptrj PR_ADTRANS
 * to extend_db_ptrj payroll_manual_adjustments and employee_profile_override_history.
 *
 * Problem: Some employees have amount=0 in AUTO_BUFFER SPSI rows, but PR_ADTRANS
 * has a non-zero SPSI deduction (DocDesc LIKE '%SPSI%'). This script:
 *   1. Finds all AUTO_BUFFER SPSI rows for the period
 *   2. Uses NikToNewestEmpCodeService to resolve NIK → newest EmpCode (C > B > A)
 *   3. Looks up actual SPSI amount from PR_ADTRANS using the newest EmpCode
 *   4. Updates the AUTO_BUFFER row with correct amount
 *   5. Inserts employee_profile_override_history with is_spsi_member=1
 *      using the newest LETTER emp_code so future seedPeriod calls find it
 *
 * Usage:
 *   bun run _dev_utils/scripts/fix_spsi_zero_amount_once.ts [month] [year] [--apply]
 *
 * Example (dry run for April 2026):
 *   bun run _dev_utils/scripts/fix_spsi_zero_amount_once.ts 4 2026
 *
 * Example (apply for April 2026):
 *   bun run _dev_utils/scripts/fix_spsi_zero_amount_once.ts 4 2026 --apply
 */

const periodMonth = Number(process.argv[2] || 4);
const periodYear = Number(process.argv[3] || 2026);
const apply = process.argv.includes("--apply");

const SPSI_TASK_PREFIX = "GA9112";

function normalize(value: unknown) {
    return String(value || "").trim();
}

function toNumber(value: unknown) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
}

function nextMonthStart(month: number, year: number) {
    return month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

async function main() {
    if (periodMonth < 1 || periodMonth > 12 || periodYear < 2000) {
        throw new Error("Usage: bun run _dev_utils/scripts/fix_spsi_zero_amount_once.ts [month] [year] [--apply]");
    }

    const extDb = Database.getExtendedInstance();
    const mainDb = Database.getInstance();
    const startDate = `${periodYear}-${String(periodMonth).padStart(2, "0")}-01`;
    const endDate = nextMonthStart(periodMonth, periodYear);

    // -------------------------------------------------------------------------
    // Step 1: Find ALL AUTO_BUFFER SPSI rows for the period
    // -------------------------------------------------------------------------
    const allAdjustments = await extDb.query<any>(`
        SELECT id, emp_code, emp_name, gang_code, division_code, amount, remarks
        FROM dbo.payroll_manual_adjustments
        WHERE period_month = ?
          AND period_year = ?
          AND adjustment_type = 'AUTO_BUFFER'
          AND adjustment_name = 'AUTO SPSI'
        ORDER BY division_code, gang_code, emp_name
    `, [periodMonth, periodYear]);

    if (!allAdjustments.length) {
        console.log(`No AUTO_BUFFER SPSI rows found for ${periodMonth}/${periodYear}.`);
        return;
    }

    console.log(`Found ${allAdjustments.length} AUTO_BUFFER SPSI rows for ${periodMonth}/${periodYear}`);

    // -------------------------------------------------------------------------
    // Step 2: Resolve all NIKs → newest EmpCode via NikToNewestEmpCodeService
    //         Uses DuplicateNikMitigationService under the hood:
    //         Priority: C-prefix > B-prefix > A-prefix (alphabetical DESC)
    // -------------------------------------------------------------------------
    const niks = [...new Set(
        allAdjustments
            .map((row) => normalize(row.emp_code))
            .filter((code) => nikToNewestEmpCodeService.isValidNik(code))
    )];

    console.log(`Resolving ${niks.length} NIKs via NikToNewestEmpCodeService...`);
    const resolutionMap = await nikToNewestEmpCodeService.resolveBatch(niks);

    // Build a map of NIK → resolved newest emp_code + all emp_codes + emp_name
    const newestEmpCodeByNik = new Map<string, string>();
    const allEmpCodesByNik = new Map<string, string[]>();
    const empNameByNik = new Map<string, string>();

    for (const [nik, entry] of resolutionMap) {
        newestEmpCodeByNik.set(nik, entry.resolved_emp_code || "");
        allEmpCodesByNik.set(nik, entry.all_emp_codes || []);
        // Preserve emp_name from adjustment row (already set in allAdjustments)
    }

    // -------------------------------------------------------------------------
    // Step 3: Look up SPSI amounts from PR_ADTRANS / PR_ADTRANS_ARC
    //         using the NEWEST emp_code resolved in Step 2
    // -------------------------------------------------------------------------
    // Collect only unique newest emp_codes
    const uniqueNewestEmpCodes = [...new Set(
        [...newestEmpCodeByNik.values()].filter(Boolean)
    )];

    console.log(`Looking up SPSI amounts for ${uniqueNewestEmpCodes.length} unique newest emp_codes...`);
    const spsiAmountByEmpCode = new Map<string, number>();

    for (let i = 0; i < uniqueNewestEmpCodes.length; i += 250) {
        const chunk = uniqueNewestEmpCodes.slice(i, i + 250);
        const placeholders = chunk.map(() => "?").join(",");
        const rows = await mainDb.query<any>(`
            SELECT RTRIM(src.emp_code) AS emp_code, SUM(ABS(src.amount)) AS amount
            FROM (
                SELECT t.EmpCode AS emp_code, t.DocDesc AS doc_desc, ln.TaskCode AS task_code, ln.Amount AS amount
                FROM PR_ADTRANS t
                JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
                WHERE RTRIM(t.EmpCode) IN (${placeholders})
                  AND t.DocDate >= ?
                  AND t.DocDate < ?

                UNION ALL

                SELECT t.EmpCode AS emp_code, t.DocDesc AS doc_desc, ln.TaskCode AS task_code, ln.Amount AS amount
                FROM PR_ADTRANS_ARC t
                JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
                WHERE RTRIM(t.EmpCode) IN (${placeholders})
                  AND t.DocDate >= ?
                  AND t.DocDate < ?
            ) src
            WHERE UPPER(src.doc_desc) LIKE '%SPSI%'
               OR src.task_code LIKE '${SPSI_TASK_PREFIX}%'
            GROUP BY RTRIM(src.emp_code)
        `, [...chunk, startDate, endDate, ...chunk, startDate, endDate]);

        for (const row of rows) {
            spsiAmountByEmpCode.set(normalize(row.emp_code).toUpperCase(), toNumber(row.amount));
        }
    }

    // -------------------------------------------------------------------------
    // Step 4: Compute changes — reconcile AUTO_BUFFER SPSI with db_ptrj amounts
    // -------------------------------------------------------------------------
    const changes: any[] = [];

    for (const row of allAdjustments) {
        const nik = normalize(row.emp_code);
        const newestEmpCode = newestEmpCodeByNik.get(nik) || "";
        const allEmpCodes = allEmpCodesByNik.get(nik) || [];

        // Sum SPSI amounts from PR_ADTRANS for ALL emp_codes (not just newest)
        let dbAmount = 0;
        for (const code of allEmpCodes) {
            dbAmount += spsiAmountByEmpCode.get(code) || 0;
        }

        const currentAmount = toNumber(row.amount);
        const targetAmount = dbAmount; // always sync to db_ptrj amount
        const targetIsSpsiMember = dbAmount > 0;

        const targetRemarks = targetIsSpsiMember
            ? `AUTO SPSI | potongan spsi | ${targetAmount} | sync:FIX | db_ptrj:SPSI`
            : `AUTO SPSI | non-spsi | 0 | sync:FIX | db_ptrj:ZERO`;

        // Skip if already correct and already fixed by this script
        if (Math.abs(currentAmount - targetAmount) <= 0.01 && normalize(row.remarks).includes("sync:")) {
            continue;
        }

        changes.push({
            id: row.id,
            nik,
            newest_emp_code: newestEmpCode || null,
            all_emp_codes: allEmpCodes.length ? allEmpCodes : null,
            emp_name: row.emp_name || null,
            gang_code: row.gang_code,
            division_code: row.division_code,
            current_amount: currentAmount,
            db_ptrj_spsi_amount: dbAmount,
            target_amount: targetAmount,
            target_remarks: targetRemarks,
            target_is_spsi_member: targetIsSpsiMember
        });
    }

    // -------------------------------------------------------------------------
    // Step 5: Report
    // -------------------------------------------------------------------------
    const output = {
        mode: apply ? "APPLY" : "DRY_RUN",
        period_month: periodMonth,
        period_year: periodYear,
        total_auto_spsi_rows: allAdjustments.length,
        niks_resolved: niks.length,
        unique_newest_emp_codes: uniqueNewestEmpCodes.length,
        changes_count: changes.length,
        changes
    };

    console.log(`\n=== SPSI Zero Amount Fix — ${periodMonth}/${periodYear} ===`);
    console.log(`Total AUTO_BUFFER SPSI rows: ${allAdjustments.length}`);
    console.log(`NIKs resolved via NikToNewestEmpCodeService: ${niks.length}`);
    console.log(`Unique newest emp_codes: ${uniqueNewestEmpCodes.length}`);
    console.log(`Rows needing update: ${changes.length}`);
    console.log(`Mode: ${apply ? "APPLY" : "DRY_RUN"}\n`);

    if (changes.length > 0 && !apply) {
        console.log("DRY RUN — first 20 changes:");
        console.log(JSON.stringify({ ...output, changes: changes.slice(0, 20) }, null, 2));
    } else if (changes.length > 0) {
        console.log("Full change list:");
        console.log(JSON.stringify(output, null, 2));
    }

    if (!apply) {
        console.log("\nRe-run with --apply to apply changes.");
        return;
    }

    // -------------------------------------------------------------------------
    // Step 6: Apply changes
    // -------------------------------------------------------------------------
    let applied = 0;
    let skipped = 0;

    for (const change of changes) {
        // 6a: Update payroll_manual_adjustments amount and remarks
        await extDb.query(`
            UPDATE dbo.payroll_manual_adjustments
            SET amount = ?,
                remarks = ?,
                updated_by = ?,
                updated_at = GETDATE()
            WHERE id = ?
        `, [
            change.target_amount,
            change.target_remarks,
            "spsi-zero-fix-once",
            change.id
        ]);

        // 6b: Insert employee_profile_override_history using the NEWEST emp_code
        //     (Letter emp_code like A0713, not NIK) so future seedPeriod calls find it
        if (!change.all_emp_codes) {
            skipped++;
            continue;
        }

        for (const empCode of change.all_emp_codes) {
            if (!empCode) continue;

            const nextIdx = await extDb.queryOne<any>(`
                SELECT ISNULL(MAX(update_index), 0) + 1 AS next_index
                FROM dbo.employee_profile_override_history
                WHERE emp_code = ?
            `, [empCode]);

            await extDb.query(`
                INSERT INTO dbo.employee_profile_override_history (
                    emp_code, nik, is_spsi_member, effective_start_date,
                    employee_status_at_change, update_index, change_source,
                    change_reason, changed_by, is_active_record
                ) VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?, 1)
            `, [
                empCode,                              // letter emp_code (e.g. A0713)
                change.nik,                           // NIK
                change.target_is_spsi_member ? 1 : 0,
                nextIdx?.next_index || 1,
                "SPSI_ZERO_FIX_ONCE",
                `One-time fix: sync SPSI from db_ptrj amount ${change.db_ptrj_spsi_amount} for period ${periodMonth}/${periodYear}`,
                "spsi-zero-fix-once"
            ]);
        }

        applied++;
    }

    console.log(`\n=== Done ===`);
    console.log(`Applied: ${applied}`);
    console.log(`Skipped: ${skipped}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
