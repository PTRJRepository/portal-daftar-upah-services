import { Database } from '../db/client';

async function test() {
    try {
        const originDb = Database.getInstance();
        const counts = await originDb.query(`
            SELECT TOP 10
                RTRIM(e.EmpCode) as emp_code,
                RTRIM(e.EmpName) as emp_name,
                e.TaxStatus,
                e.MaritalStatus
            FROM HR_EMPLOYEE e
            WHERE e.Status = '1'
        `);
        console.log("TaxStatus column values:");
        console.log(JSON.stringify(counts));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
test();
