import { Database } from "../../backend/src/db/client";
import { Config } from "../../backend/src/config";

async function main() {
    try {
        const db = Database.getInstance(undefined, Config.DB_PROFILE);
        console.log("--- PR_GANG Schema ---");
        const columns = await db.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PR_GANG'");
        console.log(JSON.stringify(columns, null, 2));

    } catch (e) {
        console.error(e);
    }
}

main();
