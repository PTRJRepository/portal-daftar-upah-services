
import { Database } from "../db/client";

async function main() {
    const db = Database.getInstance();
    // Select top 1 to see columns
    // Use extend_db_ptrj or the main db? Main db has PR_TASKREGLN
    // PR_TASKREGLN is in the main payroll DB, not extend_db_ptrj

    try {
        const rows = await db.query<any>(`
            SELECT TOP 1 * FROM PR_TASKREGLN
        `);

        if (rows.length > 0) {
            console.log("PR_TASKREGLN Columns:", Object.keys(rows[0]));
            console.log("Sample Row:", rows[0]);
        } else {
            console.log("PR_TASKREGLN is empty.");
        }
    } catch (e) {
        console.error("Error querying PR_TASKREGLN:", e);
    }
}

main().catch(console.error);
