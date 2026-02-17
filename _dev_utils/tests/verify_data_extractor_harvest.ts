
import { Database } from "../../backend/src/db/client";
import { Config } from "../../backend/src/config";
import { DataExtractorService } from "../../backend/src/services/dataExtractorService";
import { harvesterService } from "../../backend/src/services/harvesterService";

async function verifyDataExtractorHarvest() {
    const dbName = 'staging_PTRJ_iFES_Plantware';
    const profile = Config.DB_PROFILE;
    const db = Database.getInstance(dbName, profile);

    console.log("Finding valid test data in Staging...");

    // Get a record with interesting data (extended fields)
    console.log("Searching for records with extended data (Underripe, Overripe, etc)...");
    const rows = await db.query(`
        SELECT TOP 1 WORKERCODE, TRANSDATE, 
        RIPE, UNRIPE, UNDERRIPE, OVERRIPE, ROTTEN, ABNORMAL, LOOSEFRUIT 
        FROM [${dbName}].[dbo].[Ffbscannerdata]
        WHERE (UNDERRIPE > 0 OR OVERRIPE > 0 OR ROTTEN > 0 OR ABNORMAL > 0 OR LOOSEFRUIT > 0)
        AND WORKERCODE IS NOT NULL
        ORDER BY TRANSDATE DESC
    `);

    if (rows.length === 0) {
        console.log("No suitable test data found in Staging.");
        return;
    }

    const testRow = rows[0];
    const empCode = testRow.WORKERCODE;
    const date = new Date(testRow.TRANSDATE);
    const month = date.getMonth() + 1; // 1-12
    const year = date.getFullYear();

    console.log(`Found test employee: ${empCode} for ${month}/${year}`);
    console.log(`Expected Staging Data (Single Day):`, testRow);

    // Call DataExtractorService
    console.log(`Calling DataExtractorService.extractPayrollData(${month}, ${year}, "ALL", undefined, "${empCode}")`);

    // We assume the employee is in a harvest gang and DataExtractorService correctly identifies it.
    // If not, we might get 0s but the fields should exist.

    // Note: We need to ensure we use the same DB profile as configured in backend
    // which defaults to Config.DB_PROFILE.

    try {
        const result = await DataExtractorService.getInstance().extractPayrollData(
            month,
            year,
            "ALL",
            undefined,
            empCode,
            Config.DB_PROFILE
        );

        if (result.data_rows.length === 0) {
            console.log("DataExtractor returned no rows for this employee. Possible reasons: Not in active payroll, or gang mapping issue.");
            return;
        }

        const empRow = result.data_rows[0];
        console.log("Result Row Harvest Data:");
        const harvestData = {
            bunches_total: empRow.bunches_total,
            bunches_ripe: empRow.bunches_ripe,
            bunches_unripe: empRow.bunches_unripe,
            bunches_underripe: empRow.bunches_underripe,
            bunches_overripe: empRow.bunches_overripe,
            bunches_rotten: empRow.bunches_rotten,
            bunches_abnormal: empRow.bunches_abnormal,
            loose_fruit: empRow.loose_fruit,
            bunches_transactions: empRow.bunches_transactions
        };
        console.log(JSON.stringify(harvestData, null, 2));

        // Validation
        let checksPass = true;
        const keysCheck = ['bunches_underripe', 'bunches_overripe', 'loose_fruit'];

        for (const k of keysCheck) {
            if (empRow[k] === undefined) {
                console.error(`FAILURE: Field ${k} is MISSING from response.`);
                checksPass = false;
            }
        }

        if (checksPass) {
            console.log("SUCCESS: All extended fields are present.");

            // Check value logic
            if ((empRow.bunches_underripe || 0) >= (testRow.UNDERRIPE || 0)) {
                console.log(`SUCCESS: bunches_underripe (${empRow.bunches_underripe}) >= Staging UNDERRIPE (${testRow.UNDERRIPE})`);
            } else {
                console.warn(`WARNING: bunches_underripe (${empRow.bunches_underripe}) < Staging UNDERRIPE (${testRow.UNDERRIPE}). Date mismatch?`);
            }

            if ((empRow.loose_fruit || 0) >= (testRow.LOOSEFRUIT || 0)) {
                console.log(`SUCCESS: loose_fruit (${empRow.loose_fruit}) >= Staging LOOSEFRUIT (${testRow.LOOSEFRUIT})`);
            } else {
                console.warn(`WARNING: loose_fruit (${empRow.loose_fruit}) < Staging LOOSEFRUIT (${testRow.LOOSEFRUIT}). Date mismatch?`);
            }

        }

    } catch (e) {
        console.error("Error executing DataExtractorService:", e);
    }
}

verifyDataExtractorHarvest().catch(console.error);
