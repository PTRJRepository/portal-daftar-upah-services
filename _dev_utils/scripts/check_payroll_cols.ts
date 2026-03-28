import { Database } from '../../backend/src/db/client';

async function check() {
    try {
        const db = Database.getExtendedInstance();
        console.log("Checking columns of payroll_history_detail...");
        const result = await db.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'payroll_history_detail'");
        console.log("Columns:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Error:", error);
    }
}

check();
