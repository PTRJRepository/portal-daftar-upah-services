
import { Database } from "../db/client";

async function main() {
    console.log("Checking PR_BUNCH...");
    const db = Database.getInstance();
    try {
        const rows = await db.query<any>("SELECT TOP 1 * FROM PR_BUNCH");
        console.log("PR_BUNCH exists!");
        console.log("Columns:", Object.keys(rows[0] || {}));
    } catch (e) {
        console.log("PR_BUNCH check failed:", e.message);
    }
}

main().catch(console.error);
