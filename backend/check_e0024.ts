import { Database } from './src/db/client';

async function checkE0024() {
    const originDb = Database.getInstance();

    try {
        const row = await originDb.query(`
            SELECT e.EmpCode, e.EmpName, p.RiceRation 
            FROM HR_EMPLOYEE e
            LEFT JOIN HR_PAYROLL p ON e.EmpCode = p.EmpCode
            WHERE e.EmpCode = 'E0024'
        `);
        console.log("Current RiceRation for E0024 in HR_PAYROLL:", row);
    } catch (e) {
        console.error("Error querying origin DB:", e);
    }
}

checkE0024().catch(console.error);
