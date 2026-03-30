import { Database } from "../../backend/src/db/client";

async function run() {
    try {
        const db = Database.getInstance("extend_db_ptrj", "SERVER_PROFILE_1");
        const rows = await db.query("SELECT DISTINCT TOP 20 division_code, gang_code, gang_description FROM dbo.daftar_upah_aggregation_history ORDER BY division_code, gang_code");
        console.log(JSON.stringify(rows, null, 2));
    } catch (error) {
        console.error("Error:", error);
    } finally {
        process.exit(0);
    }
}

run();
