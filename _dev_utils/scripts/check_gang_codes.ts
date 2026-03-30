import { Database } from "../../backend/src/db/client";

async function run() {
    try {
        const db = Database.getInstance(undefined, "SERVER_PROFILE_2");
        const rows = await db.query("SELECT DISTINCT LocCode FROM HR_GANG ORDER BY LocCode");
        console.log(JSON.stringify(rows, null, 2));
    } catch (error) {
        console.error("Error:", error);
    } finally {
        process.exit(0);
    }
}

run();
