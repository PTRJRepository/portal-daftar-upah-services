
import { Database } from "./src/db/client";
import { write } from "bun";

async function main() {
    try {
        const db = Database.getInstance("db_ptrj", "SERVER_PROFILE_1");

        // 1. Get PR_AD Schema
        console.log("Fetching PR_AD Schema...");
        const adSchema = await db.query("SELECT TOP 1 * FROM PR_AD");
        await write("backend/pr_ad_schema.json", JSON.stringify(Object.keys(adSchema[0] || {}), null, 2));

        // 2. Search PR_AD for 'TUNJANGAN PREMI'
        console.log("Searching PR_AD for 'TUNJANGAN PREMI'...");
        const resultAd = await db.query(`
            SELECT TOP 20 * 
            FROM PR_AD 
            WHERE Description LIKE '%TUNJANGAN PREMI%'
        `);
        await write("backend/pr_ad_search_desc.json", JSON.stringify(resultAd, null, 2));

        // 3. Search PR_TASKCODE just in case
        console.log("Searching PR_TASKCODE for 'TUNJANGAN PREMI'...");
        const resultTask = await db.query(`
            SELECT TOP 20 * 
            FROM PR_TASKCODE 
            WHERE Description LIKE '%TUNJANGAN PREMI%'
        `);
        await write("backend/pr_taskcode_search_desc.json", JSON.stringify(resultTask, null, 2));

    } catch (error: any) {
        const errorMsg = `Error: ${error.message}\nStack: ${error.stack}`;
        console.error(errorMsg);
        await write("backend/debug_error.log", errorMsg);
    }
}

main();
