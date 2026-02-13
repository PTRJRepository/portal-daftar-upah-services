
import { Database } from "../db/client";

async function main() {
    const db = Database.getInstance();
    try {
        const rows = await db.query<any>("SELECT TOP 1 * FROM PR_EXT_PROD_SUMM");
        if (rows.length > 0) {
            console.log("PR_EXT_PROD_SUMM Columns:", Object.keys(rows[0]));
            console.log("Sample:", rows[0]);
        } else {
            console.log("PR_EXT_PROD_SUMM is empty.");
        }
    } catch (e) {
        console.log("Error:", e.message);
    }
}
main().catch(console.error);
