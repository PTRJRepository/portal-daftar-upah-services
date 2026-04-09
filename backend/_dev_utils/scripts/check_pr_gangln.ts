import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    console.log("Checking columns for PR_GANGLN...");

    const rows = await db.query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'PR_GANGLN'
    `);
    console.table(rows);
    
    console.log("\nChecking samples from PR_GANGLN...");
    const samples = await db.query("SELECT TOP 5 * FROM PR_GANGLN");
    console.table(samples);
}

main().catch(console.error).finally(() => process.exit(0));
