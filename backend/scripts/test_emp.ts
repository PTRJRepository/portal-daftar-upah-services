import { Database } from '../src/db/client';

async function checkCptrxData() {
    const db = Database.getInstance(undefined, "SERVER_PROFILE_2");
    console.log("--- Fetching Jamila from HR_EMPLOYEE by Name ---");
    try {
        const emps = await db.query(`
            SELECT RTRIM(EmpCode) as EmpCode, EmpName, LocCode, NewICNo 
            FROM HR_EMPLOYEE 
            WHERE EmpName LIKE '%JAMILA%'
        `);
        console.log(emps);

        const empCodes = emps.map((e: any) => `'${e.EmpCode}'`).join(',');

        if (empCodes.length > 0) {
            console.log(`\n--- Fetching HR_CPTRX for those EmpCodes ---`);
            const cptrx = await db.query(`
                SELECT TOP 10 RTRIM(EmpCode) as EmpCode, CPCode, DateFrom, LocCode, DeptCode, PosCode, Remark
                FROM HR_CPTRX
                WHERE RTRIM(EmpCode) IN (${empCodes})
                ORDER BY DateFrom DESC
            `);
            console.log(cptrx);
        }
    } catch (e) {
        console.error(e);
    }
}

checkCptrxData();
