import { Database } from '../../backend/src/db/client';

async function check() {
    try {
        const db = Database.getExtendedInstance();
        console.log("Counting employee_other_incomes by type and month for 2026...");
        const result = await db.query('SELECT income_type, period_month, COUNT(*) as count FROM employee_other_incomes WHERE period_year = 2026 GROUP BY income_type, period_month');
        console.log("Stats:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Error:", error);
    }
}

check();
