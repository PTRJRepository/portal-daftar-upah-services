import { Database } from "../../src/db/client";

const REQUIRED_COLUMNS = [
    { table: "payroll_history_header", column: "snapshot_batch_id" },
    { table: "payroll_history_header", column: "snapshot_version" },
    { table: "payroll_history_detail", column: "snapshot_batch_id" },
    { table: "payroll_history_detail", column: "snapshot_version" }
] as const;

async function main() {
    const db = Database.getExtendedInstance();
    const rows = await db.query<{ TABLE_NAME: string; COLUMN_NAME: string }>(`
        SELECT TABLE_NAME, COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME IN (?, ?)
          AND COLUMN_NAME IN (?, ?)
    `, [
        "payroll_history_header",
        "payroll_history_detail",
        "snapshot_batch_id",
        "snapshot_version"
    ]);

    const missing = REQUIRED_COLUMNS.filter(
        (item) => !rows.some((row) => row.TABLE_NAME === item.table && row.COLUMN_NAME === item.column)
    );

    if (missing.length > 0) {
        throw new Error(
            `Missing snapshot columns: ${missing.map((item) => `${item.table}.${item.column}`).join(", ")}`
        );
    }

    console.log("payroll snapshot columns ready");
}

main().catch((error) => {
    console.error("PAYROLL_SNAPSHOT_COLUMNS_FAILED");
    console.error(error);
    process.exit(1);
});
