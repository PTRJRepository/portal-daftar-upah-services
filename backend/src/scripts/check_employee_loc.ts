
import { Database } from "../db/client";

async function checkEmployeeLoc() {
    const db = Database.getInstance();

    const gangs = ['HM', 'HMC'];

    for (const g of gangs) {
        console.log(`\nChecking Employees in Gang ${g}...`);
        const rows = await db.query(`
            SELECT TOP 5 EmpCode, GangCode, LocCode
            FROM HR_M_Employee
            WHERE GangCode = '${g}'
        `);

        if (rows.length === 0) {
            console.log("No employees found.");
        } else {
            rows.forEach((r: any) => {
                console.log(`Emp: ${r.EmpCode}, Gang: ${r.GangCode}, Loc: ${r.LocCode}`);
            });
        }
    }
}

checkEmployeeLoc().catch(console.error);
