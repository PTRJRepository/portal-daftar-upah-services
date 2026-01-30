
import { Database } from "./src/db/client";
import { write } from "bun";

async function main() {
    try {
        const db = Database.getInstance("db_ptrj", "SERVER_PROFILE_1");

        const code = "AL3PM2201P1A";
        console.log(`Searching PR_TASKCODE for ${code}...`);

        const result = await db.query(`
            SELECT * 
            FROM PR_TASKCODE 
            WHERE TaskCode = '${code}'
        `);

        if (result.length > 0) {
            console.log("FOUND in PR_TASKCODE!");
            await write("backend/found_specific_al.json", JSON.stringify(result[0], null, 2));
        } else {
            console.log("Not found in PR_TASKCODE.");
            await write("backend/found_specific_al.json", JSON.stringify({ message: "Not found" }));
        }

    } catch (error: any) {
        const errorMsg = `Error: ${error.message}\nStack: ${error.stack}`;
        console.error(errorMsg);
        await write("backend/debug_error.log", errorMsg);
    }
}

main();
