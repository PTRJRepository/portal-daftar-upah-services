
import { Database } from "./src/db/client";
import { write } from "bun";

async function main() {
    try {
        // Check VenusHR14 (Profile 3)
        console.log("Connecting to VenusHR14 (Profile 3)...");
        const venusDb = Database.getVenusInstance();

        console.log("Searching Venus PR_AD...");
        try {
            const venusResult = await venusDb.query(`
                SELECT TOP 10 ADCode, Description 
                FROM PR_AD 
                WHERE ADCode LIKE 'AL%' OR Description LIKE '%TUNJANGAN%'
            `);
            console.log(`Venus PR_AD found ${venusResult.length} records.`);
            if (venusResult.length > 0) {
                await write("backend/venus_found.json", JSON.stringify(venusResult, null, 2));
            }
        } catch (e) {
            console.log("Venus Query failed: " + e.message);
        }

        // Check db_ptrj PR_TASKCODE (Profile 1)
        console.log("Connecting to db_ptrj (Profile 1)...");
        const ptrjDb = Database.getInstance("db_ptrj", "SERVER_PROFILE_1");

        console.log("Searching PR_TASKCODE...");
        const taskResult = await ptrjDb.query(`
            SELECT TOP 10 TaskCode, TaskDesc 
            FROM PR_TASKCODE 
            WHERE TaskCode LIKE 'AL%' OR TaskDesc LIKE '%TUNJANGAN%'
        `);
        console.log(`PR_TASKCODE found ${taskResult.length} records.`);
        if (taskResult.length > 0) {
            await write("backend/taskcode_found.json", JSON.stringify(taskResult, null, 2));
        }

    } catch (error: any) {
        const errorMsg = `Error: ${error.message}\nStack: ${error.stack}`;
        console.error(errorMsg);
        await write("backend/debug_error.log", errorMsg);
    }
}

main();
