
import { Database } from "../db/client";

async function main() {
    const db = Database.getExtendedInstance();
    try {
        const rows = await db.query<any>(`
            SELECT period_year, period_month, COUNT(*) as count 
            FROM daftar_upah_aggregation_history 
            GROUP BY period_year, period_month 
            ORDER BY period_year DESC, period_month DESC
        `);
        console.table(rows);
    } catch (e) {
        console.error("Error:", e);
    }
}
main().catch(console.error);
