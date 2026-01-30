
import { Database } from "./src/db/client";
import { write } from "bun";

async function main() {
    console.log("Connecting to SERVER_PROFILE_1 with database db_ptrj...");

    const db = Database.getInstance("db_ptrj", "SERVER_PROFILE_1");

    try {
        console.log("Querying information schema...");
        const tables = await db.query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME");

        console.log(`Found ${tables.length} tables.`);

        const tableNames = tables.map(t => t.TABLE_NAME);
        await write("backend/tables_list.txt", tableNames.join("\n"));
        console.log("All tables written to backend/tables_list.txt");

        console.log("Tables containing 'dar' (case insensitive):");
        const darTables = tableNames.filter(name => name.toLowerCase().includes("dar"));
        darTables.forEach(t => console.log(`- ${t}`));

    } catch (error) {
        console.error("Error querying database:", error);
    }
}

main();
