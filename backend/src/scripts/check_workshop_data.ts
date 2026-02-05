
import { Database } from "../db/client";

async function main() {
    console.log("Checking WKS_PG and WKS_AR in aggregation history...");
    const db = Database.getExtendedInstance(); // extend_db_ptrj

    // Check counts
    const counts = await db.query<any>(`
        SELECT division_code, COUNT(*) as count, SUM(total_upah_bersih) as total_upah
        FROM daftar_upah_aggregation_history 
        WHERE division_code IN ('WKS_PG', 'WKS_AR', 'WORKSHOP') AND period_month = 1 AND period_year = 2026
        GROUP BY division_code
    `);

    console.log("Counts found:", counts);

    // Check if they are in the 'Divisi_Description' table/mapping if needed?
    // Usually summaryService just pulls distinct division_code.
}

main().catch(console.error);
