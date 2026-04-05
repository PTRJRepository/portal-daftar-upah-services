import { Database } from "../../../src/db/client";

async function main() {
    const extDb = Database.getExtendedInstance();
    
    // Query history_hr_gang with correct column names
    try {
        const rows = await extDb.query<any>(`
            SELECT TOP 20 gang_code, gang_description, division_code
            FROM dbo.history_hr_gang
            WHERE gang_code IS NOT NULL
            ORDER BY id DESC
        `);
        
        console.log("history_hr_gang gang descriptions:\n");
        const gangMap = new Map<string, string>();
        for (const row of rows) {
            gangMap.set(row.gang_code, row.gang_description || '');
            console.log(`${row.gang_code}: "${row.gang_description || '(empty)'}"`);
        }
        
        console.log(`\n\nFound ${gangMap.size} unique gangs with descriptions`);
    } catch (e: any) {
        console.log(`Error: ${e.message}`);
    }
}

main().catch(console.error);
