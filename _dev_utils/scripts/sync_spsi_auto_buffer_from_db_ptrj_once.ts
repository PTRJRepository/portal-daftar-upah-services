import { Database } from "../../backend/src/db/client";

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
        throw new Error("Usage: bun run _dev_utils/scripts/sync_spsi_auto_buffer_from_db_ptrj_once.ts [month] [year] [--apply]");
    }

    const extDb = Database.getExtendedInstance();
    const mainDb = Database.getInstance();
    const startDate = `${periodYear}-${String(periodMonth).padStart(2, "0")}-01`;
    const endDate = nextMonthStart(periodMonth, periodYear);

    const adjustments = await extDb.query<any>(`
        SELECT id, emp_code, emp_name, gang_code, division_code, amount, remarks
        FROM dbo.payroll_manual_adjustments
        WHERE period_month = ?
          AND period_year = ?
          AND adjustment_type = 'AUTO_BUFFER'
          AND adjustment_name = 'AUTO SPSI'
        ORDER BY division_code, gang_code, emp_name
    `, [periodMonth, periodYear]);

    const nikKeys = [...new Set(adjustments.map((row) => normalize(row.emp_code)).filter(Boolean))];
    const hrByNik = new Map<string, string[]>();
    const nameByNik = new Map<string, string>();

    for (let i = 0; i < nikKeys.length; i += 400) {
        const chunk = nikKeys.slice(i, i + 400);
        const placeholders = chunk.map(() => "?").join(",");
        const rows = await mainDb.query<any>(`
            SELECT RTRIM(EmpCode) AS emp_code, RTRIM(NewICNo) AS nik, RTRIM(EmpName) AS emp_name
            FROM HR_EMPLOYEE
            WHERE RTRIM(NewICNo) IN (${placeholders})
        `, chunk);

        for (const row of rows) {
            const nik = normalize(row.nik);
            if (!nik) continue;
            const empCode = normalize(row.emp_code).toUpperCase();
            if (!empCode) continue;
            const list = hrByNik.get(nik) || [];
            if (!list.includes(empCode)) {
                list.push(empCode);
            }
            hrByNik.set(nik, list);
            nameByNik.set(nik, normalize(row.emp_name));
        }
    }

    const spsiAmountByEmpCode = new Map<string, number>();
    const letterCodes = [...new Set([...hrByNik.values()].flat().filter(Boolean))];

    for (let i = 0; i < letterCodes.length; i += 250) {
        const chunk = letterCodes.slice(i, i + 250);
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

    const changes: any[] = [];
    for (const row of adjustments) {
        const nik = normalize(row.emp_code);
        const letterEmpCodes = hrByNik.get(nik) || [];
        let dbAmount = 0;
        for (const code of letterEmpCodes) {
            dbAmount += spsiAmountByEmpCode.get(code) || 0;
        }
        const currentAmount = toNumber(row.amount);
        const targetStatus = dbAmount > 0;
        const targetAmount = targetStatus ? dbAmount : 0;

        const currentRemarks = normalize(row.remarks);
        const targetRemarks = `AUTO SPSI | potongan spsi | ${targetAmount} | sync:SYNC | match:MATCH`;
        if (Math.abs(currentAmount - targetAmount) <= 0.01 && currentRemarks === targetRemarks) continue;

        changes.push({
            id: row.id,
            nik,
            letter_emp_code: letterEmpCodes.length ? letterEmpCodes.join(",") : null,
            emp_name: row.emp_name || nameByNik.get(nik) || null,
            gang_code: row.gang_code,
            division_code: row.division_code,
            current_amount: currentAmount,
            db_ptrj_spsi_amount: dbAmount,
            target_amount: targetAmount,
            target_remarks: targetRemarks,
            target_is_spsi_member: targetStatus
        });
    }

    console.log(JSON.stringify({
        mode: apply ? "APPLY" : "DRY_RUN",
        period_month: periodMonth,
        period_year: periodYear,
        auto_spsi_rows: adjustments.length,
        changes_count: changes.length,
        changes
    }, null, 2));

    if (!apply) {
        console.log("DRY RUN only. Re-run with --apply to update extend_db_ptrj.");
        return;
    }

    for (const change of changes) {
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
            "spsi-db-ptrj-sync-once",
            change.id
        ]);

        const nextNikIndex = await extDb.queryOne<any>(`
            SELECT ISNULL(MAX(update_index), 0) + 1 AS next_index
            FROM dbo.employee_profile_override_history
            WHERE emp_code = ?
        `, [change.nik]);

        await extDb.query(`
            INSERT INTO dbo.employee_profile_override_history (
                emp_code, nik, is_spsi_member, effective_start_date, employee_status_at_change,
                update_index, change_source, change_reason, changed_by
            ) VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?)
        `, [
            change.nik,
            change.nik,
            change.target_is_spsi_member ? 1 : 0,
            nextNikIndex?.next_index || 1,
            "SPSI_DB_PTRJ_SYNC_ONCE",
            `SPSI sync amount ${change.db_ptrj_spsi_amount}`,
            "spsi-db-ptrj-sync-once"
        ]);

        if (change.letter_emp_code) {
            const letterCodes = String(change.letter_emp_code).split(",").map((c) => c.trim()).filter(Boolean);
            for (const code of letterCodes.slice(0, 1)) {
                const nextLetterIndex = await extDb.queryOne<any>(`
                    SELECT ISNULL(MAX(update_index), 0) + 1 AS next_index
                    FROM dbo.employee_profile_override_history
                    WHERE emp_code = ?
                `, [code]);

                await extDb.query(`
                    INSERT INTO dbo.employee_profile_override_history (
                        emp_code, nik, is_spsi_member, effective_start_date, employee_status_at_change,
                        update_index, change_source, change_reason, changed_by
                    ) VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?)
                `, [
                    code,
                    change.nik,
                    change.target_is_spsi_member ? 1 : 0,
                    nextLetterIndex?.next_index || 1,
                    "SPSI_DB_PTRJ_SYNC_ONCE",
                    `SPSI sync amount ${change.db_ptrj_spsi_amount}`,
                    "spsi-db-ptrj-sync-once"
                ]);
            }
        }
    }

    console.log(`Applied ${changes.length} SPSI sync changes.`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
