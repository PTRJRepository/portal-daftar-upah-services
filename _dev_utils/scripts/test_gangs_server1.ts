import { Database } from "./src/db/client";
import { Config } from "./src/config";

async function testGangs() {
    console.log("Testing Database Connection to Server 1...");
    console.log("Profile:", Config.DB_PROFILE);
    console.log("Database:", Config.DEFAULT_DATABASE);
    console.log("Gateway URL:", Config.DB_API_URL);

    try {
        const db = Database.getInstance();
        console.log("Fetching gangs from HR_GANG...");
        
        const rows = await db.query("SELECT TOP 10 GangCode, Description, LocCode FROM HR_GANG");
        
        console.log("Success! Found " + rows.length + " gangs.");
        if (rows.length > 0) {
            console.table(rows);
        } else {
            console.log("No gangs found in HR_GANG table.");
        }
    } catch (error: any) {
        console.error("FAILED to fetch gangs:");
        console.error(error.message);
        if (error.stack) console.error(error.stack);
    }
}

testGangs();
