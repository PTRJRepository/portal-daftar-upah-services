
import { Database } from "../../backend/src/db/client";
import { Config } from "../../backend/src/config";

async function checkFreshness() {
    const dbName = 'staging_PTRJ_iFES_Plantware';
    console.log(`Checking data freshness in ${dbName}.dbo.Ffbscannerdata...`);

    const profile = Config.DB_PROFILE;
    const db = Database.getInstance(dbName, profile);

    try {
        const rows = await db.query(`
            SELECT MAX(TRANSDATE) as LatestDate, MIN(TRANSDATE) as EarliestDate, COUNT(*) as TotalRows
            FROM [${dbName}].[dbo].[Ffbscannerdata]
        `);

        console.log("Data Summary:");
        console.log(rows[0]);

        // Also check if there is data for current year (2026) or 2025
        const currentYear = new Date().getFullYear();
        const rowsCurrent = await db.query(`
            SELECT COUNT(*) as CountCurrentYear
            FROM [${dbName}].[dbo].[Ffbscannerdata]
            WHERE YEAR(TRANSDATE) = ${currentYear}
        `);
        console.log(`Rows in ${currentYear}: ${rowsCurrent[0].CountCurrentYear}`);

        const prevYear = currentYear - 1;
        const rowsPrev = await db.query(`
            SELECT COUNT(*) as CountPrevYear
            FROM [${dbName}].[dbo].[Ffbscannerdata]
            WHERE YEAR(TRANSDATE) = ${prevYear}
        `);
        console.log(`Rows in ${prevYear}: ${rowsPrev[0].CountPrevYear}`);

    } catch (e: any) {
        console.log(`Error: ${e.message}`);
    }
}

checkFreshness().catch(console.error);
