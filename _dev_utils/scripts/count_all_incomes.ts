import { Database } from '../../backend/src/db/client';

async function check() {
    try {
        const db = Database.getExtendedInstance();
        console.log("Counting ALL employee_other_incomes by type and period...");
        const result = await db.query('SELECT income_type, period_year, period_month, COUNT(*) as count FROM employee_other_incomes GROUP BY income_type, period_year, period_month ORDER BY period_year DESC, period_month DESC');
        console.log("Stats:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Error:", error);
    }
}

check();
