
import { Database } from "./src/db/client";
import { write } from "bun";

async function main() {
    try {
        const db = Database.getInstance("db_ptrj", "SERVER_PROFILE_1");

        console.log("Fetching PR_AD Columns...");
        const adCols = await db.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'PR_AD' 
            ORDER BY ORDINAL_POSITION
        `);
        await write("backend/schema_pr_ad.json", JSON.stringify(adCols.map(c => c.COLUMN_NAME), null, 2));

        console.log("Fetching PR_TASKCODE Columns...");
        const taskCols = await db.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'PR_TASKCODE' 
            ORDER BY ORDINAL_POSITION
        `);
        await write("backend/schema_pr_taskcode.json", JSON.stringify(taskCols.map(c => c.COLUMN_NAME), null, 2));

    } catch (error: any) {
        const errorMsg = `Error: ${error.message}\nStack: ${error.stack}`;
        console.error(errorMsg);
        await write("backend/debug_error.log", errorMsg);
    }
}

main();
