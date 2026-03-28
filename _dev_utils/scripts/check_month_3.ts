import { Database } from '../../backend/src/db/client';

async function check() {
    try {
        const db = Database.getExtendedInstance();
        console.log("Checking for ANY records in Month 3 (Maret) across all years...");
        const result = await db.query("SELECT income_type, period_year, period_month, COUNT(*) as count FROM employee_other_incomes WHERE period_month = 3 GROUP BY income_type, period_year, period_month");
        console.log("Stats:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Error:", error);
    }
}

check();
