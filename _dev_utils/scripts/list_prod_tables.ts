import { Database } from '../../backend/src/db/client';

async function check() {
    try {
        const db = Database.getInstance(); // db_ptrj
        console.log("Listing tables in db_ptrj...");
        const result = await db.query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME LIKE 'PR_%'");
        console.log("Tables starting with PR_:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Error:", error);
    }
}

check();
