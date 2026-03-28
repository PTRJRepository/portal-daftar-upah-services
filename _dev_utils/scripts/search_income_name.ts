import { Database } from '../../backend/src/db/client';

async function check() {
    try {
        const db = Database.getExtendedInstance();
        console.log("Searching for 'Pendapatan Lainnya' in income_name for 2026...");
        const result = await db.query("SELECT * FROM employee_other_incomes WHERE period_year = 2026 AND income_name LIKE '%Pendapatan Lainnya%'");
        console.log("Count:", result.length);
        if (result.length > 0) {
            console.log("Records:", JSON.stringify(result.slice(0, 5), null, 2));
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

check();
