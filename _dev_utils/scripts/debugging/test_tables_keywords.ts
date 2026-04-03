import { Database } from "../db/client";
import { writeFileSync } from "fs";
import { join } from "path";

async function checkHrColumnsAll() {
    const db = Database.getInstance("db_ptrj", "SERVER_PROFILE_1");

    try {
        const query = `
            SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME LIKE '%EMP%' 
               OR TABLE_NAME LIKE '%FAM%' 
               OR TABLE_NAME LIKE '%TAX%' 
               OR TABLE_NAME LIKE '%BERAS%'
               OR TABLE_NAME LIKE '%RICE%'
               OR TABLE_NAME LIKE '%PTKP%'
            ORDER BY TABLE_NAME, ORDINAL_POSITION;
        `;
        const result = await db.query(query);
        const outPath = join(process.cwd(), "tmp_keywords.txt");
        writeFileSync(outPath, JSON.stringify(result, null, 2), "utf-8");
        console.log("Saved to " + outPath);
    } catch (e) {
        console.error("Error:", e);
    }
}

checkHrColumnsAll();
