import { Database } from '../../backend/src/db/client';

async function check() {
    try {
        const db = Database.getInstance(); // db_ptrj
        console.log("Checking records in PR_MTHRATEDOTLN...");
        const result = await db.query("SELECT TOP 10 * FROM PR_MTHRATEDOTLN");
        console.log("Records:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Error:", error);
    }
}

check();
