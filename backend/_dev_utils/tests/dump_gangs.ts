import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    
    // Dump all gangs for LocCode P1A and others
    const rows = await db.query(`
        SELECT top 50 LocCode, RTRIM(GangCode) as gang, RTRIM(Description) as descri
        FROM HR_GANG 
        WHERE LocCode IN ('P1A', 'PG1A', 'ARC')
    `);
    
    console.log("HR_GANG rows:", rows);
    process.exit(0);
}

main().catch(console.error);
