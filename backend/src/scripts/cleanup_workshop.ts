
import { Database } from "../db/client";

async function main() {
    console.log("Cleaning up WORKSHOP entries for Jan 2026...");
    const db = Database.getInstance("extend_db_ptrj", "SERVER_PROFILE_1"); // Ensure correct DB

    // Note: SummaryService usesSERVER_PROFILE_1 for extend_db_ptrj

    const result = db.query(`
        DELETE FROM daftar_upah_aggregation_history 
        WHERE division_code = 'WORKSHOP' AND period_month = 1 AND period_year = 2026
    `).run();

    console.log(`Deleted ${result.changes} stale WORKSHOP records.`);
}

main().catch(console.error);
