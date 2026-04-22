import { Database } from "../../backend/src/db/client";

async function main() {
    const extendDb = Database.getExtendedInstance();
    console.log("=== Detailed check for employee_hr_data ===\n");
    try {
        const columns = await extendDb.query(`
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'employee_hr_data'
            ORDER BY ORDINAL_POSITION
        `);
        console.log(JSON.stringify(columns, null, 2));
    } catch (e: any) {
        console.error("Error:", e.message);
    }
}

main().catch(console.error);
