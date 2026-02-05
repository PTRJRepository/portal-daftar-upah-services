
import { Database } from "../db/client";

async function main() {
    const db = Database.getInstance("extend_db_ptrj", "SERVER_PROFILE_1"); // Ensure correct DB
    const rows = await db.query<any>(`
        SELECT * 
        FROM daftar_upah_aggregation_history 
        WHERE division_code = 'MILL' AND period_month = 1 AND period_year = 2026
    `);

    if (rows.length > 0) {
        console.log("MILL Data Found:");
        rows.forEach(r => {
            console.log(`- Gang: ${r.gang_code}, Employees: ${r.total_employees}, HK: ${r.total_hk}, Salary: ${r.total_upah_bersih.toLocaleString()}`);
            console.log(`  Source: ${r.informasi_tambahan}`);
        });
    } else {
        console.log("No MILL data found for Jan 2026.");
    }
}

main().catch(console.error);
