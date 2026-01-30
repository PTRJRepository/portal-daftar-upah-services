
import { Database } from "./src/db/client";

async function main() {
    console.log("Connecting to SERVER_PROFILE_1 with database db_ptrj...");
    const db = Database.getInstance("db_ptrj", "SERVER_PROFILE_1");

    try {
        console.log("Fetching columns for PR_AD...");
        const columns = await db.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PR_AD' ORDER BY ORDINAL_POSITION");
        console.log("PR_AD Columns:", columns.map(c => c.COLUMN_NAME).join(", "));

        console.log("\nSearching for 'AL' in PR_AD (Code or Description)...");
        // Check for 'AL' in ADCode or where it might act as a type
        const results = await db.query(`
            SELECT TOP 20 * 
            FROM PR_AD 
            WHERE ADCode LIKE '%AL%' 
               OR Description LIKE '%AL%'
               OR ADType LIKE '%AL%'
        `);

        console.log(`Found ${results.length} rows.`);
        results.forEach(r => {
            console.log(JSON.stringify(r));
        });

        // Also check if there is an ADType = 'AL' specifically
        console.log("\nChecking distinct ADType...");
        const types = await db.query("SELECT DISTINCT ADType FROM PR_AD");
        console.log("ADTypes:", types.map(t => t.ADType).join(", "));

    } catch (error) {
        console.error("Error querying database:", error);
    }
}

main();
