import { Database } from "./src/db/client";

async function run() {
    const db = Database.getInstance();

    // HR_EMPLOYMENT
    console.log("=== HR_EMPLOYMENT ===");
    const empRows = await db.query(`SELECT TOP 1 * FROM HR_EMPLOYMENT`);
    console.log(Object.keys(empRows[0] || {}).join(', '));

    // HR_GANG
    console.log("=== HR_GANG ===");
    const gangRows = await db.query(`SELECT TOP 1 * FROM HR_GANG`);
    console.log(Object.keys(gangRows[0] || {}).join(', '));

    // history_hr_employee (our custom table)
    console.log("=== history_hr_employee ===");
    const hisRows = await db.query(`SELECT TOP 1 * FROM history_hr_employee`);
    console.log(Object.keys(hisRows[0] || {}).join(', '));

    process.exit(0);
}

run().catch(console.error);
