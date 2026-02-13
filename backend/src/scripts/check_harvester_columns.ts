
import { Database } from "../db/client";

async function main() {
    console.log("Checking PR_HARVESTERLN...");
    const db = Database.getInstance();
    try {
        const rows = await db.query<any>("SELECT TOP 1 * FROM PR_HARVESTERLN");
        if (rows.length > 0) {
            console.log("Columns:", Object.keys(rows[0]));
            console.log("Sample:", rows[0]);
        } else {
            console.log("PR_HARVESTERLN is empty.");
        }
    } catch (e) {
        console.log("Error:", e.message);
    }
}

main().catch(console.error);
