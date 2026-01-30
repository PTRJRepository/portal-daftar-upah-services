
import { Database } from "./src/db/client";

async function main() {
    const db = Database.getInstance("db_ptrj", "SERVER_PROFILE_1");

    try {
        const results = await db.query(`
            SELECT ADCode, Description, ADType, Frequency
            FROM PR_AD 
            WHERE ADCode LIKE '%AL%' OR Description LIKE '%Tun%'
            ORDER BY ADCode
        `);

        console.log("RESULTS_START");
        console.log(JSON.stringify(results.slice(0, 50), null, 2));
        console.log("RESULTS_END");

    } catch (error) {
        console.error("Error:", error);
    }
}

main();
