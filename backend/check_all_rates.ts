import { Database } from './src/db/client';

async function checkAllRates() {
    const originDb = Database.getInstance();

    try {
        const rows = await originDb.query(`
            SELECT DISTINCT p.RiceRation, COUNT(e.EmpCode) as count
            FROM HR_PAYROLL p
            JOIN HR_EMPLOYEE e ON e.EmpCode = p.EmpCode AND e.Status = '1'
            GROUP BY p.RiceRation
            ORDER BY p.RiceRation
        `);
        console.log("Unique RiceRation values for active employees:");
        console.table(rows);
    } catch (e) {
        console.error("Error:", e);
    }
}

checkAllRates().catch(console.error);
