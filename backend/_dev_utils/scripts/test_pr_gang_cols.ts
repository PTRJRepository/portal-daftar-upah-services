import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    console.log("Checking columns for PR_GANG...");

    const rows = await db.query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'PR_GANG'
    `);
    console.table(rows);
}

main().catch(console.error).finally(() => process.exit(0));
