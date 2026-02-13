
import { Database } from "../db/client";
import { write } from "bun";

async function main() {
    console.log("Listing tables...");
    const db = Database.getInstance();
    try {
        // SQL Server query to list tables
        const rows = await db.query<any>("SELECT name FROM sys.tables ORDER BY name");
        const tableNames = rows.map(r => r.name).join("\n");
        await write("all_tables.txt", tableNames);
        console.log("Written to all_tables.txt");
    } catch (e) {
        console.log("Listing tables failed:", e.message);
    }
}

main().catch(console.error);
