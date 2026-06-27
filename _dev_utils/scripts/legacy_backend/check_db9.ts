import { Database } from '../db/client';

async function test() {
    try {
        const originDb = Database.getInstance();
        const counts = await originDb.query(`
            SELECT 
                COALESCE(p.RiceRation, 0) as beras_rate,
                COUNT(*) as employee_count
            FROM HR_EMPLOYEE e
            LEFT JOIN HR_PAYROLL p ON RTRIM(p.EmpCode) = RTRIM(e.EmpCode)
            WHERE e.Status = '1'
            GROUP BY COALESCE(p.RiceRation, 0)
            ORDER BY beras_rate ASC
        `);
        console.log("Keys:");
        console.log(counts.map(c => c.beras_rate).join(', '));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
test();
