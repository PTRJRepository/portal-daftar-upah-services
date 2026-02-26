import { Database } from "../../backend/src/db/client";

async function run() {
    const db = Database.getExtendedInstance();
    try {
        const tables = await db.query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_CATALOG = 'extend_db_ptrj'
        `);
        console.log("Tables in extend_db_ptrj:", tables.map(t => t.TABLE_NAME));

        const columns = await db.query(`
            SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_CATALOG = 'extend_db_ptrj' AND TABLE_NAME LIKE '%employee%'
        `);
        console.log("Columns:", columns);
    } catch (e) {
        console.error("Error:", e);
    }
}
run();
