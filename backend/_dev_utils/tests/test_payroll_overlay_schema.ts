import { Database } from "../../src/db/client";

const REQUIRED_TABLES = [
    "employee_profile_override_history",
    "payroll_value_override_history",
    "payroll_snapshot_batch"
] as const;

const REQUIRED_INDEXES = [
    "IX_profile_override_emp_update",
    "IX_payroll_value_override_scope_update",
    "IX_payroll_snapshot_batch_scope_version"
] as const;

async function main() {
    const db = Database.getExtendedInstance();

    const tables = await db.query<{ TABLE_NAME: string }>(`
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE'
          AND TABLE_NAME IN (${REQUIRED_TABLES.map(() => "?").join(",")})
    `, [...REQUIRED_TABLES]);

    const indexes = await db.query<{ name: string }>(`
        SELECT name
        FROM sys.indexes
        WHERE name IN (${REQUIRED_INDEXES.map(() => "?").join(",")})
    `, [...REQUIRED_INDEXES]);

    const missingTables = REQUIRED_TABLES.filter(
        (name) => !tables.some((row) => row.TABLE_NAME === name)
    );
    const missingIndexes = REQUIRED_INDEXES.filter(
        (name) => !indexes.some((row) => row.name === name)
    );

    if (missingTables.length || missingIndexes.length) {
        throw new Error(
            `Missing tables=${missingTables.join(",") || "-"} indexes=${missingIndexes.join(",") || "-"}`
        );
    }

    console.log("overlay schema ready");
}

main().catch((error) => {
    console.error("PAYROLL_OVERLAY_SCHEMA_FAILED");
    console.error(error);
    process.exit(1);
});
