import { Database } from "../../../src/db/client";

async function main() {
    const extDb = Database.getExtendedInstance();
    
    // Check what's actually stored in gang_description
    const rows = await extDb.query<any>(`
        SELECT TOP 10 gang_code, gang_description, division_code, period_month, period_year
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = 3 AND period_year = 2026
        ORDER BY id DESC
    `);
    
    console.log("Gang descriptions in aggregation history:\n");
    for (const row of rows) {
        console.log(`gang_code: "${row.gang_code}" | gang_description: "${row.gang_description}"`);
    }
    
    // Also check HR_GANG for the real descriptions
    const db = Database.getInstance();
    const gangRows = await db.query<any>(`
        SELECT RTRIM(GangCode) as GangCode, Description
        FROM dbo.HR_GANG
        WHERE GangCode IS NOT NULL
        ORDER BY GangCode
    `);
    
    console.log("\nGang descriptions in HR_GANG:\n");
    const gangMap = new Map<string, string>();
    for (const row of gangRows) {
        gangMap.set(row.GangCode, row.Description || '');
        console.log(`${row.GangCode}: "${row.Description || '(empty)'}"`);
    }
    
    // Compare
    console.log("\n\nComparison:");
    for (const row of rows) {
        const hrDesc = gangMap.get(row.gang_code) || '';
        const storedDesc = row.gang_description || '';
        const match = hrDesc === storedDesc ? '✅' : '❌';
        console.log(`${match} ${row.gang_code}: HR_GANG="${hrDesc}" | History="${storedDesc}"`);
    }
}

main().catch(console.error);
