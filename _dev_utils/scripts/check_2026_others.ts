import { Database } from '../../backend/src/db/client';

async function check() {
    try {
        const db = Database.getExtendedInstance();
        console.log("Checking for ANY non-THR incomes in ALL of 2026...");
        const result = await db.query("SELECT * FROM employee_other_incomes WHERE period_year = 2026 AND income_type <> 'THR'");
        console.log("Count:", result.length);
        if (result.length > 0) {
            console.log("Records:", JSON.stringify(result, null, 2));
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

check();
