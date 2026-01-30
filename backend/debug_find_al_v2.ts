
import { Database } from "./src/db/client";
import { write } from "bun";

async function main() {
    try {
        console.log("Connecting...");
        const db = Database.getInstance("db_ptrj", "SERVER_PROFILE_1");

        const codeToFind = 'AL3PM2201P1A';
        console.log(`Searching for ${codeToFind} in PR_AD...`);

        // Use manual params since prepareParams might be buggy or not needed if we hardcode
        // But let's try just raw string first to test connection
        const result = await db.query(`SELECT TOP 1 * FROM PR_AD WHERE ADCode = '${codeToFind}'`);

        if (result.length > 0) {
            console.log("FOUND in PR_AD!");
            await write("backend/found_al.json", JSON.stringify(result[0], null, 2));
        } else {
            console.log("Not found in PR_AD.");
            await write("backend/found_al.json", JSON.stringify({ message: "Not found" }));
        }

    } catch (error: any) {
        const errorMsg = `Error: ${error.message}\nStack: ${error.stack}`;
        console.error(errorMsg);
        await write("backend/debug_error.log", errorMsg);
    }
}

main();
