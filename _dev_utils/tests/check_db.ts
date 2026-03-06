import { Database } from "../../backend/src/db/client";

async function run() {
    const db = Database.getExtendedInstance();
    console.log("Connected to DB");

    // Check if there are any records for 2026/02 DME
    const res = await db.query(`SELECT TOP 10 * FROM employee_other_incomes WHERE period_year = 2026 AND period_month = 2 AND division_code = 'DME'`);
    console.log("Records length:", res.length);
    if (res.length > 0) {
        console.log("Sample:", res[0]);
    }

    process.exit(0);
}

run();
