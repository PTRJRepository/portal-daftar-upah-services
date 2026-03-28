import { Database } from '../../backend/src/db/client';

async function check() {
    try {
        const db = Database.getExtendedInstance();
        console.log("Checking employee_other_incomes_formulas...");
        const result = await db.query("SELECT * FROM employee_other_incomes_formulas");
        console.log("Formulas:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Error:", error);
    }
}

check();
