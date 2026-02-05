
import { Database } from "../db/client";

async function main() {
    const db = Database.getInstance("db_ptrj", "SERVER_PROFILE_2");

    console.log("QUERYING...");
    // Check HM (PG)
    const divs = await db.query<{ Division: string }>(`
        SELECT DISTINCT [Division] FROM [dbo].[HR_T_PYWeekly_M] 
        WHERE [PYNumber] LIKE 'PYW/PTRJ/202601%'
    `);
    console.log(`Active Divisions in Jan 2026: ${divs.map(d => d.Division).join(', ')}`);

    // Check Gang HM specifically without TOP 1 if possible
    /*
    const hm = await db.queryOne<{ Division: string }>(`
        SELECT TOP 1 [Division] FROM [dbo].[HR_T_PYWeekly_M] 
        WHERE [GangCode] = 'HM' AND [PYNumber] LIKE 'PYW/PTRJ/202601%'
    `);
    console.log(`HM is in: ${hm?.Division || 'NOT FOUND'}`);
    */
}

main().catch(console.error);
