import { Database } from "../db/client";
import { writeFileSync } from "fs";
import { join } from "path";

async function checkDetailedHrTables() {
    const db = Database.getInstance("db_ptrj", "SERVER_PROFILE_1");
    console.log("Checking detailed HR tables on SERVER_PROFILE_1 db_ptrj...");

    try {
        const query = `
            SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME LIKE 'HR_%FAMILY%' 
               OR TABLE_NAME LIKE 'HR_%DEPENDENT%'
               OR TABLE_NAME LIKE 'HR_%TAX%'
               OR TABLE_NAME LIKE 'HR_%PTKP%'
               OR TABLE_NAME = 'HR_EMPLOYEE'
            ORDER BY TABLE_NAME, ORDINAL_POSITION;
        `;
        const result = await db.query(query);
        const filtered = result.filter(r => 
            ['HR_EMPLOYEE'].includes(r.TABLE_NAME) ? 
                r.COLUMN_NAME.toLowerCase().includes('tax') || 
                r.COLUMN_NAME.toLowerCase().includes('mar') || 
                r.COLUMN_NAME.toLowerCase().includes('depend') ||
                r.COLUMN_NAME.toLowerCase().includes('beras') ||
                r.COLUMN_NAME.toLowerCase().includes('ptkp') ||
                r.COLUMN_NAME.toLowerCase().includes('child') ||
                r.COLUMN_NAME.toLowerCase().includes('status')
            : true
        );
        
        const outPath = join(process.cwd(), "tmp_hr_columns_output.txt");
        writeFileSync(outPath, JSON.stringify(filtered, null, 2), "utf-8");
        console.log("Saved to " + outPath);
    } catch (e) {
        console.error("Error:", e);
    }
}

checkDetailedHrTables();
