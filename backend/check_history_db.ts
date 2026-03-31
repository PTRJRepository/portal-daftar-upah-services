import { Database } from "./src/db/client";
import { Config } from "./src/config";

async function run() {
    // Config for history DB
    const db = Database.getInstance(Config.DB_EXTEND_DATABASE, Config.DB_EXTEND_PROFILE);
    const month = 3;
    const year = 2026;

    console.log(`Checking History DB (extend_db_ptrj) for March 2026...`);

    try {
        const masters = await db.query(`
            SELECT COUNT(*) as count 
            FROM dbo.payroll_history_header 
            WHERE period_month = ? AND period_year = ?
        `, [month, year]);
        console.log(`Rows in payroll_history_header for March 2026: ${masters[0].count}`);

        if (masters[0].count > 0) {
            const details = await db.query(`
                SELECT COUNT(*) as count 
                FROM dbo.payroll_history_detail d
                JOIN dbo.payroll_history_header h ON d.master_id = h.id
                WHERE h.period_month = ? AND h.period_year = ?
            `, [month, year]);
            console.log(`Rows in payroll_history_detail for March 2026: ${details[0].count}`);
        }
    } catch (err) {
        console.error("Error checking history DB:", err.message);
    }

    process.exit(0);
}

run();
