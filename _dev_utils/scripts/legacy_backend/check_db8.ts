import { Database } from '../db/client';

async function test() {
    try {
        const originDb = Database.getInstance();
        const employees = await originDb.query(`
            SELECT TOP 20
                RTRIM(e.EmpCode) as emp_code,
                RTRIM(e.EmpName) as emp_name,
                COALESCE(p.RiceRation, 0) as beras_rate
            FROM HR_EMPLOYEE e
            LEFT JOIN HR_PAYROLL p ON RTRIM(p.EmpCode) = RTRIM(e.EmpCode)
            WHERE e.Status = '1' AND p.RiceRation IS NOT NULL
            ORDER BY emp_code
        `);
        console.log("Samples of RiceRation (beras_rate) from HR_PAYROLL:");
        console.log(JSON.stringify(employees));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
test();
