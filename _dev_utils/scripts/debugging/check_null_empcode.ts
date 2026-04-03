
import { Database } from "../db/client";

async function checkNullEmpCode() {
    const db = Database.getExtendedInstance();
    try {
        const result = await db.query<any>('SELECT COUNT(*) as count FROM employee_other_incomes WHERE emp_code IS NULL');
        console.log(`Records with NULL emp_code: ${result[0]?.count}`);
        
        const types = await db.query<any>('SELECT income_type, COUNT(*) as count FROM employee_other_incomes WHERE emp_code IS NULL GROUP BY income_type');
        console.log('NULL emp_code by income_type:', types);

        const total = await db.query<any>('SELECT COUNT(*) as count FROM employee_other_incomes');
        console.log(`Total records: ${total[0]?.count}`);
    } catch (e) {
        console.error(e);
    }
}

checkNullEmpCode().then(() => process.exit());
