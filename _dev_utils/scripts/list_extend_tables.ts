import { Database } from '../../backend/src/db/client';

async function listTables() {
    try {
        const db = Database.getExtendedInstance();
        console.log("Listing tables in extend_db_ptrj...");
        const result = await db.query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'");
        console.log("Tables:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Error:", error);
    }
}

listTables();
