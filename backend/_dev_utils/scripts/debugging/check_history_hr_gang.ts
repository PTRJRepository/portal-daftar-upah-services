import { Database } from "../../../src/db/client";

async function main() {
    const extDb = Database.getExtendedInstance();
    
    // Check history_hr_gang table
    try {
        // First check columns
        const cols = await extDb.query<any>(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'history_hr_gang'
            ORDER BY ORDINAL_POSITION
        `);
        
        console.log("history_hr_gang columns:\n");
        cols.forEach((c: any) => console.log(`  ${c.COLUMN_NAME}`));
        
        // Then check data
        const rows = await extDb.query<any>(`
            SELECT TOP 10 *
            FROM dbo.history_hr_gang
            WHERE GangCode IS NOT NULL
            ORDER BY id DESC
        `);
        
        console.log("\n\nhistory_hr_gang data:\n");
        for (const row of rows) {
            console.log(`GangCode: "${row.GangCode}" | Description: "${row.Description || '(empty)'}"`);
        }
    } catch (e: any) {
        console.log(`Error querying history_hr_gang: ${e.message}`);
    }
}

main().catch(console.error);
