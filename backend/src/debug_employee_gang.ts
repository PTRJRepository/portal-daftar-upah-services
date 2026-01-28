import { Database } from "./db/client";
import { writeFileSync } from "fs";

async function debug() {
    const db = Database.getInstance();

    // Check RAHMAT IQBAL's memberships
    const employeeRows = await db.query(`
        SELECT TOP 1 e.EmpCode, e.EmpName, em.AppJoinGrpDate
        FROM HR_EMPLOYEE e
        LEFT JOIN HR_EMPLOYMENT em ON em.EmpCode = e.EmpCode
        WHERE e.EmpName LIKE '%RAHMAT IQBAL%'
    `);

    writeFileSync("rahmat_check.json", JSON.stringify(employeeRows, null, 2));
    process.exit(0);
}

debug().catch(console.error);
