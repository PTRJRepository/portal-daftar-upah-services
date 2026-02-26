import { Database } from "../../backend/src/db/client";
import { Config } from "../../backend/src/config";

async function main() {
    try {
        const db = Database.getInstance(undefined, Config.DB_PROFILE);
        console.log("--- Sample Gangs in Plantware (Config.DB_PROFILE) ---");
        const gangs = await db.query("SELECT TOP 10 GangCode, Description FROM PR_GANG");
        console.log(JSON.stringify(gangs, null, 2));

    } catch (e) {
        console.error(e);
    }
}

main();
