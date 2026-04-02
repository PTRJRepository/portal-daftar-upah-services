import { Database } from "../db/client";
import { writeFileSync } from "fs";
import { join } from "path";

async function checkHrTablesAll() {
    const db = Database.getInstance("db_ptrj", "SERVER_PROFILE_1");

    try {
        const query = `
            SELECT TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_NAME;
        `;
        const result = await db.query(query);
        const outPath = join(process.cwd(), "tmp_tables_output.txt");
        writeFileSync(outPath, JSON.stringify(result, null, 2), "utf-8");
        console.log("Saved to " + outPath);
    } catch (e) {
        console.error("Error:", e);
    }
}

checkHrTablesAll();
