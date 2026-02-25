import { Database } from "../../backend/src/db/client";

async function run() {
    console.log("Exploring HR_EMPLOYEE for NPWP columns...");
    const db = Database.getInstance("db_ptrj", "SERVER_PROFILE_1");

    const query = `
        SELECT COLUMN_NAME, TABLE_NAME
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'HR_EMPLOYEE' OR TABLE_NAME = 'M_EMPLOYEE'
    `;

    try {
        const results = await db.query(query);
        console.log("Sample Data:", JSON.stringify(results, null, 2));
    } catch (e) {
        console.error("Error exploring db:", e);
    }
    process.exit(0);
}

run();
