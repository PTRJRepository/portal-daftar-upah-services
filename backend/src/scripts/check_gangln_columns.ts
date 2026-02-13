
import { Database } from "../db/client";
import { write } from "bun";

async function main() {
    const db = Database.getInstance();
    try {
        const rows = await db.query<any>("SELECT TOP 1 * FROM HR_GANGLN");
        if (rows.length > 0) {
            const columns = Object.keys(rows[0]).join(", ");
            await write("gangln_columns.txt", columns);
            console.log("Written to gangln_columns.txt");
        } else {
            console.log("HR_GANGLN is empty.");
        }
    } catch (e) {
        console.log("Error checking HR_GANGLN:", e.message);
    }
}
main().catch(console.error);
