
import { Database } from "../../backend/src/db/client";
import { Config } from "../../backend/src/config";
import { harvesterService } from "../../backend/src/services/harvesterService";

async function testStagingMethod() {
    const dbName = 'staging_PTRJ_iFES_Plantware';
    const profile = Config.DB_PROFILE;
    const db = Database.getInstance(dbName, profile);

    console.log("Finding valid test data (EmpCode, Year, Month)...");

    // Get a recent record
    const rows = await db.query(`
        SELECT TOP 1 WORKERCODE, TRANSDATE
        FROM [${dbName}].[dbo].[Ffbscannerdata]
        WHERE YEAR(TRANSDATE) >= 2025
        AND (RIPE > 0 OR UNRIPE > 0)
        ORDER BY TRANSDATE DESC
    `);

    if (rows.length === 0) {
        console.log("No recent data found.");
        return;
    }

    const empCode = rows[0].WORKERCODE;
    const date = new Date(rows[0].TRANSDATE);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    console.log(`Found Data -> EmpCode: ${empCode}, Month: ${month}, Year: ${year}`);

    console.log("\nTesting harvesterService.getEmployeeBunchesFromStaging...");
    const result = await harvesterService.getEmployeeBunchesFromStaging(empCode, month, year);
    console.log("Result:", result);

    console.log("\nTesting harvesterService.getBatchEmployeeBunchesFromStaging...");
    const batchResult = await harvesterService.getBatchEmployeeBunchesFromStaging([empCode], month, year);
    console.log("Batch Result:", batchResult.get(empCode));
}

testStagingMethod().catch(console.error);
