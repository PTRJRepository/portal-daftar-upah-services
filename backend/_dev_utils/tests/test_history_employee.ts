import { Database } from "../../src/db/client";
import { Config } from "../../src/config";

async function testFetchHistory() {
    console.log("=== Checking Available Seeded Employees ===");

    const db = Database.getInstance(Config.DB_EXTEND_DATABASE, Config.DB_EXTEND_PROFILE);

    try {
        console.log(`\nAvailable in payroll_history_detail (Top 5):`);
        const pRows = await db.query(`
            SELECT TOP 5 d.emp_code, d.nik, h.period_month, h.period_year
            FROM dbo.payroll_history_detail d
            JOIN dbo.payroll_history_header h ON d.master_id = h.id
            ORDER BY h.period_year DESC, h.period_month DESC
        `);
        console.table(pRows);
    } catch (e: any) {
        console.error("Error pRows:", e.message);
    }

    try {
        console.log(`\nAvailable in history_hr_employee (Top 5):`);
        const hRows = await db.query(`
            SELECT TOP 5 emp_code, nik, period_month, period_year
            FROM dbo.history_hr_employee
            ORDER BY period_year DESC, period_month DESC
        `);
        console.table(hRows);
    } catch (e: any) {
        console.error("Error hRows:", e.message);
    }
}

testFetchHistory().catch(console.error);
