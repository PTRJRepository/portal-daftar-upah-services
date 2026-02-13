
import { Database } from "../db/client";
import { write } from "bun";

async function main() {
    console.log("Checking PR_HARVESTERLN...");
    const db = Database.getInstance();
    try {
        const rows = await db.query<any>("SELECT TOP 1 * FROM PR_HARVESTERLN");
        let output = "";
        if (rows.length > 0) {
            output += "Columns: " + Object.keys(rows[0]).join(", ") + "\n";
            output += "Sample: " + JSON.stringify(rows[0], null, 2);
        } else {
            output += "PR_HARVESTERLN is empty.";
        }
        await write("harvester_columns.txt", output);
        console.log("Written to harvester_columns.txt");
    } catch (e) {
        console.log("Error:", e.message);
    }
}

main().catch(console.error);
