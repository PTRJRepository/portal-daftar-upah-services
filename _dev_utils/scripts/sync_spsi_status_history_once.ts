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
        throw new Error("Usage: bun run _dev_utils/scripts/sync_spsi_status_history_once.ts [month] [year] [--apply]");
    }

    const extDb = Database.getExtendedInstance();
    const mainDb = Database.getInstance();
    const startDate = `${periodYear}-${String(periodMonth).padStart(2, "0")}-01`;
    const endDate = nextMonthStart(periodMonth, periodYear);

    // 1. Fetch all history rows for this period keyed by letter emp_code
    const historyRows = await extDb.query<any>(`
        SELECT id, emp_code, is_spsi_member, division_code, gang_code
        FROM dbo.history_hr_employee
        WHERE period_month = ? AND period_year = ?
    `, [periodMonth, periodYear]);

    const letterCodes = [...new Set(historyRows.map((r) => normalize(r.emp_code)).filter(Boolean))];

    // 2. Query db_ptrj for SPSI amounts per letter emp_code
    const spsiAmountByEmpCode = new Map<string, number>();
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

    // 3. Build changes for history_hr_employee where is_spsi_member != true and db_ptrj has SPSI > 0
    const historyChanges: any[] = [];
    for (const row of historyRows) {
        const empCode = normalize(row.emp_code).toUpperCase();
        const dbAmount = spsiAmountByEmpCode.get(empCode) || 0;
        if (dbAmount <= 0) continue;
        if (row.is_spsi_member === true || row.is_spsi_member === 1) continue;

        historyChanges.push({
            id: row.id,
            emp_code: empCode,
            division_code: row.division_code,
            gang_code: row.gang_code,
            db_ptrj_spsi_amount: dbAmount
        });
    }

    console.log(JSON.stringify({
        mode: apply ? "APPLY" : "DRY_RUN",
        period_month: periodMonth,
        period_year: periodYear,
        history_rows_total: historyRows.length,
        history_changes_count: historyChanges.length,
        history_changes: historyChanges
    }, null, 2));

    if (!apply) {
        console.log("DRY RUN only. Re-run with --apply to update extend_db_ptrj.");
        return;
    }

    for (const change of historyChanges) {
        await extDb.query(`
            UPDATE dbo.history_hr_employee
            SET is_spsi_member = 1
            WHERE id = ?
        `, [change.id]);
    }

    console.log(`Updated ${historyChanges.length} history_hr_employee rows.`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
