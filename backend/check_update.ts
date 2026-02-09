
import { Database } from "./src/db/client";

async function checkUpdate() {
    const db = Database.getExtendedInstance();
    const rows = await db.query(`
        SELECT TOP 5 updated_at, division_code, gang_code 
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = 1 AND period_year = 2025
        ORDER BY updated_at DESC
    `);
    console.log("Latest Updates for 12/2024:", rows);
    process.exit(0);
}

checkUpdate();
