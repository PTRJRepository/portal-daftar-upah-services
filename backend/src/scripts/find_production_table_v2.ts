
import { Database } from "../db/client";
import { write } from "bun";

async function main() {
    console.log("Starting table search...");
    try {
        const db = Database.getInstance();
        const tables = [
            "PR_HARVEST", "PR_HARVESTLN",
            "PR_TBS", "PR_TBSLN",
            "PR_WEIGHTBRIDGE", "PR_WEIGHBRIDGE",
            "PR_PRODUCTION", "PR_PROD",
            "PR_GANG_ACTIVITY",
            "PR_BUNCH", "PR_BUNCHLN",
            "PR_TASKREGLN" // Check columns for this one too
        ];

        let output = "";

        for (const table of tables) {
            try {
                // Use TOP 1 to check existence
                const rows = await db.query<any>(`SELECT TOP 1 * FROM ${table}`);
                output += `[FOUND] ${table}\n`;
                if (rows.length > 0) {
                    output += `  Columns: ${Object.keys(rows[0]).join(", ")}\n`;
                }
            } catch (e: any) {
                // output += `[MISSING] ${table}: ${e.message}\n`;
            }
        }

        await write("found_tables.txt", output);
        console.log("Search complete. Results written to found_tables.txt");

    } catch (e) {
        console.error("Fatal error:", e);
    }
}

main().catch(console.error);
