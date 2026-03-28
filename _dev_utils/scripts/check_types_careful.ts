import { Database } from '../../backend/src/db/client';

async function check() {
    try {
        const db = Database.getExtendedInstance();
        const r = await db.query('SELECT DISTINCT income_type FROM employee_other_incomes');
        console.log('Types:', JSON.stringify(r, null, 2));
    } catch (error) {
        console.error("Error:", error);
    }
}

check();
