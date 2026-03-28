import { Database } from '../../backend/src/db/client';

async function check() {
    try {
        const db = Database.getExtendedInstance();
        console.log("Checking ALL distinct income types...");
        const result = await db.query('SELECT DISTINCT income_type FROM employee_other_incomes');
        console.log("Income Types:", JSON.stringify(result, null, 2));

        console.log("\nChecking for any 'Custom' or 'Bonus' incomes in 2/2026 or 3/2026...");
        const other = await db.query("SELECT * FROM employee_other_incomes WHERE period_year = 2026 AND (period_month = 2 OR period_month = 3) AND income_type <> 'THR'");
        console.log("Other incomes count:", other.length);
        if (other.length > 0) {
            console.log("Sample other incomes:", JSON.stringify(other.slice(0, 5), null, 2));
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

check();
