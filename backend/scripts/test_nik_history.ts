import { Database } from '../src/db/client';

async function verifyEmpCodes() {
    const db = Database.getInstance(undefined, "SERVER_PROFILE_2");

    console.log("--- Searching for any NIK with multiple EmpCodes ---");
    try {
        const query = await db.query(`
            SELECT RTRIM(NewICNo) as NIK, COUNT(*) as Count
            FROM HR_EMPLOYEE
            WHERE NewICNo IS NOT NULL AND RTRIM(NewICNo) <> ''
            GROUP BY RTRIM(NewICNo)
            HAVING COUNT(*) > 1
        `);

        console.log(`Found ${query.length} NIKs with multiple EmpCodes in HR_EMPLOYEE.`);

        if (query.length > 0) {
            console.log("Showing top 3:");
            for (const row of query.slice(0, 3)) {
                const emps = await db.query(`
                    SELECT RTRIM(EmpCode) as EmpCode, EmpName, LocCode, Status 
                    FROM HR_EMPLOYEE 
                    WHERE RTRIM(NewICNo) = ?
                `, [row.NIK]);
                console.log(`NIK: ${row.NIK}`);
                console.log(emps);
            }
        } else {
            console.log("No NIK has multiple EmpCodes. Trying PR_EMPLOYEE_ARC if it exists...");
            try {
                const arcCheck = await db.query(`SELECT TOP 1 * FROM sys.tables WHERE name = 'HR_EMPLOYEE_ARC'`);
                if (arcCheck.length > 0) {
                    console.log("HR_EMPLOYEE_ARC exists.");
                } else {
                    console.log("No HR_EMPLOYEE_ARC found.");
                }
            } catch (e) { }

            console.log("\nWhat about PR_EMPWAGES? Can we see multiple EmpCodes per NIK there?");
            const prWagesNik = await db.query(`
                SELECT TOP 5 w.EmpCode, e.NewICNo, w.PeriodMonth, w.PeriodYear
                FROM PR_EMPWAGES w
                LEFT JOIN HR_EMPLOYEE e ON RTRIM(w.EmpCode) = RTRIM(e.EmpCode)
                WHERE RTRIM(e.NewICNo) = '1902056811690001'
             `);
            console.log(prWagesNik);
        }
    } catch (e) {
        console.error(e);
    }
}

verifyEmpCodes();
