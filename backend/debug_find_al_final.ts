
import { Database } from "./src/db/client";
import { write } from "bun";

async function main() {
    try {
        const db = Database.getInstance("db_ptrj", "SERVER_PROFILE_1");

        console.log("Searching PR_AD...");
        // Select specific columns to avoid 'Invalid column' errors if * expansion is buggy
        const sql = `
            SELECT TOP 50 ADCode, Description, ADType, PayslipADCode 
            FROM PR_AD 
            WHERE ADCode LIKE 'AL%' 
               OR Description LIKE '%TUNJANGAN PREMI%'
               OR PayslipADCode LIKE 'AL%'
               OR ADType = 'AL'
        `;

        const result = await db.query(sql);

        console.log(`Found ${result.length} records.`);
        await write("backend/pr_ad_found.json", JSON.stringify(result, null, 2));

    } catch (error: any) {
        const errorMsg = `Error: ${error.message}\nStack: ${error.stack}`;
        console.error(errorMsg);
        await write("backend/debug_error.log", errorMsg);
    }
}

main();
