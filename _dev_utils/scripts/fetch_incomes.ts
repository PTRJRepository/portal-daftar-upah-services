import { Database } from '../../backend/src/db/client';

async function check() {
    try {
        const db = Database.getExtendedInstance();
        console.log("Fetching first 100 records from employee_other_incomes...");
        const result = await db.query('SELECT TOP 100 * FROM employee_other_incomes ORDER BY id DESC');
        console.log("Records:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Error:", error);
    }
}

check();
