import { Database } from '../../backend/src/db/client';

async function check() {
    try {
        const db = Database.getExtendedInstance();
        console.log("Checking income types in employee_other_incomes...");
        const result = await db.query('SELECT DISTINCT income_type FROM employee_other_incomes');
        console.log("Income Types:", result);

        console.log("\nChecking records for 2/2026...");
        const sample = await db.query('SELECT TOP 10 * FROM employee_other_incomes WHERE period_month = 2 AND period_year = 2026');
        console.log("Sample records:", JSON.stringify(sample, null, 2));
    } catch (error) {
        console.error("Error:", error);
    }
}

check();
