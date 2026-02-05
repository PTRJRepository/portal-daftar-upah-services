
import { Database } from "../db/client";

async function main() {
    const db = Database.getInstance();
    const rows = await db.query<any>(`
        SELECT DISTINCT division_code 
        FROM daftar_upah_aggregation_history 
        WHERE month = 1 AND year = 2026
    `);

    console.log("Existing divisions in aggregation history (Jan 2026):");
    rows.forEach(r => console.log(` - ${r.division_code}`));
}

main().catch(console.error);
