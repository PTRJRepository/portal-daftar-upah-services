import { Database } from '../db/client';
import * as fs from 'fs';

async function test() {
    try {
        const originDb = Database.getInstance();
        const counts = await originDb.query<any>(`
            SELECT 
                COALESCE(p.RiceRation, 0) as beras_rate,
                e.MaritalStatus,
                COUNT(*) as employee_count
            FROM HR_EMPLOYEE e
            LEFT JOIN HR_PAYROLL p ON RTRIM(p.EmpCode) = RTRIM(e.EmpCode)
            WHERE e.Status = '1'
            GROUP BY COALESCE(p.RiceRation, 0), e.MaritalStatus
            ORDER BY beras_rate ASC, e.MaritalStatus ASC
        `);
        let out = "MaritalStatus vs RiceRation mapping:\n";
        for (let c of counts) {
            out += `Rate: ${c.beras_rate} | Marital: ${c.MaritalStatus} | Count: ${c.employee_count}\n`;
        }
        fs.writeFileSync('output.txt', out);
        console.log("Wrote to output.txt");
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
test();
