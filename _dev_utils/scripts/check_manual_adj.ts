import { Database } from '../../backend/src/db/client';

async function check() {
    try {
        const db = Database.getExtendedInstance();
        console.log("Checking payroll_manual_adjustments for 2026...");
        const result = await db.query('SELECT TOP 10 * FROM payroll_manual_adjustments WHERE period_year = 2026');
        console.log("Records:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Error:", error);
    }
}

check();
