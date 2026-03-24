import { Database } from "./src/db/client";

const db = Database.getInstance();

async function test() {
    console.log("Testing HR_EMPLOYEE query...");

    try {
        const rows = await db.query(`
            SELECT TOP 5 RTRIM(NewICNo) as nik, RTRIM(EmpCode) as emp_code, EmpName
            FROM HR_EMPLOYEE
            WHERE NewICNo IS NOT NULL AND RTRIM(NewICNo) != ''
        `);

        console.log("Success! Found", rows.length, "employees");
        console.log(rows);
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
