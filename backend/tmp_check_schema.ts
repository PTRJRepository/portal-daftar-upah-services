import { Database } from "../src/db/client";

async function check() {
    try {
        const db = Database.getInstance("extend_db_ptrj");
        const rows = await db.query("SELECT TOP 1 * FROM dbo.history_hr_gang");
        console.log(JSON.stringify(rows[0], null, 2));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

check();
