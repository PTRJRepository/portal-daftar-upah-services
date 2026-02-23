import { Database } from '../db/client';

async function test() {
    try {
        const originDb = Database.getInstance();
        const counts = await originDb.query(`
            SELECT 
                COALESCE(p.RiceRation, 0) as beras_rate,
                e.MaritalStatus,
                COUNT(*) as employee_count
            FROM HR_EMPLOYEE e
            LEFT JOIN HR_PAYROLL p ON RTRIM(p.EmpCode) = RTRIM(e.EmpCode)
            WHERE e.Status = '1'
            GROUP BY COALESCE(p.RiceRation, 0), e.MaritalStatus
            ORDER BY beras_rate ASC
        `);
        console.log("MaritalStatus vs RiceRation mapping:");
        console.log(JSON.stringify(counts));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
test();
