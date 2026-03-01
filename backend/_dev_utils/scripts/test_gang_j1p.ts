import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    console.log("Checking HR_GANG for J1P and PERCOBAAN PANEN...");

    const rows = await db.query(`
        SELECT * FROM HR_GANG 
        WHERE Description LIKE '%J1P%' OR Description LIKE '%PERCOBAAN%' OR GangCode LIKE '%J1P%'
    `);
    console.table(rows);

    // Let's check HR_EMPLOYEE LocCode for J0843
    const empRows = await db.query(`
        SELECT LocCode, DeptCode, SectCode, SubSectCode, GangCode FROM HR_EMPLOYEE WHERE EmpCode = 'J0843'
    `);
    console.table(empRows);

}

main().catch(console.error).finally(() => process.exit(0));
