
import { Database } from "./src/db/client";

async function main() {
    console.log("Connecting...");
    const db = Database.getInstance("db_ptrj", "SERVER_PROFILE_1");

    try {
        const codeToFind = 'AL3PM2201P1A';
        console.log(`Searching for ${codeToFind} in PR_AD...`);

        const result = await db.query("SELECT * FROM PR_AD WHERE ADCode = @p0", [codeToFind]);

        if (result.length > 0) {
            console.log("FOUND in PR_AD!");
            console.log(result[0]);
        } else {
            console.log("Not found in PR_AD.");

            // Try searching with wildcard
            console.log("Searching with wildcard 'AL3PM%'...");
            const result2 = await db.query("SELECT TOP 5 ADCode, Description FROM PR_AD WHERE ADCode LIKE 'AL3PM%'");
            console.log("Found:", result2);
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

main();
