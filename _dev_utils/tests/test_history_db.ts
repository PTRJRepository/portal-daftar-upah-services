import { Database } from "bun:sqlite";
import * as path from "path";

async function checkDb() {
    const dbPath = path.resolve(__dirname, "../../backend/data/payroll_history.db");
    console.log("Checking DB at:", dbPath);

    try {
        const db = new Database(dbPath, { readonly: true });

        // Check for 2025 data
        const rows = db.query("SELECT period_month, period_year, division_code, gang_code FROM payroll_history_header WHERE period_year = 2025").all();
        console.log(`Found ${rows.length} headers for 2025`);

        if (rows.length > 0) {
            console.log("Samples:", rows.slice(0, 5));
        }

        const counts = db.query(`
            SELECT period_month, period_year, COUNT(*) as c 
            FROM payroll_history_header 
            GROUP BY period_year, period_month
        `).all();
        console.log("All periods grouped:", counts);

    } catch (err) {
        console.error("DB error:", err);
    }
}

checkDb();
