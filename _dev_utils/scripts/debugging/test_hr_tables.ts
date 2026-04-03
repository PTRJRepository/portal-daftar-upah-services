import { Database } from "../db/client";

async function checkHrTables() {
    const db = Database.getInstance("db_ptrj", "SERVER_PROFILE_1");
    console.log("Checking HR tables structure on SERVER_PROFILE_1 db_ptrj...");

    try {
        const query = `
            SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME LIKE 'HR_%' OR TABLE_NAME LIKE '%EMPLOYEE%'
            ORDER BY TABLE_NAME, ORDINAL_POSITION;
        `;
        const result = await db.query(query);
        console.log(JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

checkHrTables();
