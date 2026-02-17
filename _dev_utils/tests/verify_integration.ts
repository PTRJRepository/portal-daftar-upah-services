
import { Database } from "../../backend/src/db/client";
import { Config } from "../../backend/src/config";
import { harvesterService } from "../../backend/src/services/harvesterService";

async function verifyIntegration() {
    const dbName = 'staging_PTRJ_iFES_Plantware';
    const profile = Config.DB_PROFILE;
    const db = Database.getInstance(dbName, profile);

    console.log("Finding valid test data in Staging...");

    // Get a recent record
    // Get a record with interesting data (extended fields)
    console.log("Searching for records with extended data (Underripe, Overripe, etc)...");
    const rows = await db.query(`
        SELECT TOP 1 WORKERCODE, TRANSDATE, 
        RIPE, UNRIPE, UNDERRIPE, OVERRIPE, ROTTEN, ABNORMAL, LOOSEFRUIT
        FROM [${dbName}].[dbo].[Ffbscannerdata]
        WHERE YEAR(TRANSDATE) >= 2024
        AND (UNDERRIPE > 0 OR OVERRIPE > 0 OR ROTTEN > 0 OR ABNORMAL > 0 OR LOOSEFRUIT > 0)
        ORDER BY TRANSDATE DESC
    `);

    let targetRow = rows[0];

    // Fallback if no extended data found (just use whatever is available)
    if (!targetRow) {
        console.log("No extended data found, trying standard RIPE/UNRIPE data...");
        const fallbackRows = await db.query(`
            SELECT TOP 1 WORKERCODE, TRANSDATE, 
            RIPE, UNRIPE, UNDERRIPE, OVERRIPE, ROTTEN, ABNORMAL, LOOSEFRUIT
            FROM [${dbName}].[dbo].[Ffbscannerdata]
            WHERE YEAR(TRANSDATE) >= 2024
            AND (RIPE > 0 OR UNRIPE > 0)
            ORDER BY TRANSDATE DESC
        `);
        targetRow = fallbackRows[0];
    }

    if (!targetRow) {
        console.log("No valid test data found in Staging.");
        return;
    }

    const empCode = targetRow.WORKERCODE;
    const date = new Date(targetRow.TRANSDATE);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    // Values from this SPECIFIC DAY (Service aggregates by MONTH, so result >= these values)
    const expected = {
        ripe: targetRow.RIPE || 0,
        unripe: targetRow.UNRIPE || 0,
        underripe: targetRow.UNDERRIPE || 0,
        overripe: targetRow.OVERRIPE || 0,
        rotten: targetRow.ROTTEN || 0,
        abnormal: targetRow.ABNORMAL || 0,
        loosefruit: targetRow.LOOSEFRUIT || 0
    };

    console.log(`Target -> EmpCode: ${empCode}, Month: ${month}, Year: ${year}`);
    console.log("Expected AT LEAST (Single Day):", expected);

    console.log("\nTesting harvesterService.getEmployeeBunches (Integrated)...");
    const result = await harvesterService.getEmployeeBunches(empCode, month, year);
    console.log("Result:", JSON.stringify(result, null, 2));

    // Verify fields exist
    const hasExtendedFields = 'bunches_underripe' in result && 'loose_fruit' in result;
    if (hasExtendedFields) {
        console.log("SUCCESS: Extended fields are present in the response object.");

        // Check values
        if ((result.bunches_underripe || 0) >= expected.underripe && (result.loose_fruit || 0) >= expected.loosefruit) {
            console.log("SUCCESS: Extended values are >= single day expected.");
        } else {
            console.log("WARNING: Extended values match check failed (might be 0 vs null issue or date mismatch).");
        }
    } else {
        console.log("FAILURE: Extended fields missing from response object.");
    }

    console.log("\nTesting harvesterService.getBatchEmployeeBunches (Integrated)...");
    const batchResult = await harvesterService.getBatchEmployeeBunches([empCode], month, year);
    const batchData = batchResult.get(empCode);
    console.log("Batch Result:", JSON.stringify(batchData, null, 2));

    if (batchData && 'loose_fruit' in batchData) {
        console.log("SUCCESS: Batch result contains extended fields.");
    } else {
        console.log("FAILURE: Batch result missing extended fields.");
    }
}

verifyIntegration().catch(console.error);
