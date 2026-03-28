import { Database } from '../../backend/src/db/client';

async function check() {
    try {
        const db = Database.getInstance(); // This uses db_ptrj (SERVER_PROFILE_1)
        console.log("Checking if employee_other_incomes exists in db_ptrj...");
        const result = await db.query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'employee_other_incomes'");
        console.log("Table exists:", result.length > 0);
        
        if (result.length > 0) {
            const sample = await db.query("SELECT TOP 5 * FROM employee_other_incomes WHERE period_year = 2026");
            console.log("Sample records in db_ptrj:", JSON.stringify(sample, null, 2));
        }
    } catch (error) {
        console.error("Error (expected if table doesn't exist):", error);
    }
}

check();
