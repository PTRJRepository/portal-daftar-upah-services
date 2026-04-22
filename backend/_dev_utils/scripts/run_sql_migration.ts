import { readFileSync } from "fs";
import { resolve } from "path";
import { Database } from "../../src/db/client";

function splitSqlBatches(sql: string): string[] {
    return sql
        .split(/^\s*GO\s*$/gim)
        .map((chunk) => chunk.trim())
        .filter(Boolean);
}

async function main() {
    const migrationArg = process.argv[2];
    if (!migrationArg) {
        throw new Error("Usage: bun run .\\_dev_utils\\scripts\\run_sql_migration.ts <path-to-sql>");
    }

    const migrationPath = resolve(process.cwd(), migrationArg);
    const sql = readFileSync(migrationPath, "utf-8");
    const batches = splitSqlBatches(sql);

    if (!batches.length) {
        throw new Error(`No executable SQL batches found in ${migrationPath}`);
    }

    const db = Database.getExtendedInstance();

    for (let index = 0; index < batches.length; index++) {
        const batchNumber = index + 1;
        console.log(`Running SQL batch ${batchNumber}/${batches.length}`);
        await db.query(batches[index]);
    }

    console.log(`SQL_MIGRATION_OK ${migrationPath}`);
}

main().catch((error) => {
    console.error("SQL_MIGRATION_FAILED");
    console.error(error);
    process.exit(1);
});
