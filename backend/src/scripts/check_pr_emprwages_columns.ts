/**
 * Diagnostic script to check PR_EMPWAGES table structure
 */

import { Database } from "../db/client";
import { Config } from "../config";

async function checkPR_EMPWAGES_Structure() {
    console.log("Checking PR_EMPWAGES table structure...\n");

    const db = Database.getInstance(Config.DEFAULT_DATABASE, Config.DB_PROFILE);

    try {
        // Get column names for PR_EMPWAGES
        const query = `
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'PR_EMPWAGES'
            ORDER BY ORDINAL_POSITION
        `;

        const result = await db.query<any>(query, []);

        console.log("PR_EMPWAGES columns:");
        console.log("-".repeat(60));
        result.forEach((row: any) => {
            const maxLength = row.CHARACTER_MAXIMUM_LENGTH
                ? `(${row.CHARACTER_MAXIMUM_LENGTH})`
                : "";
            console.log(`  - ${row.COLUMN_NAME}: ${row.DATA_TYPE}${maxLength}`);
        });
        console.log("-".repeat(60));
        console.log(`Total columns: ${result.length}\n`);

        // Get column names for PR_EMPWAGES_ARC (archive)
        const queryArc = `
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'PR_EMPWAGES_ARC'
            ORDER BY ORDINAL_POSITION
        `;

        const resultArc = await db.query<any>(queryArc, []);

        console.log("PR_EMPWAGES_ARC columns:");
        console.log("-".repeat(60));
        resultArc.forEach((row: any) => {
            const maxLength = row.CHARACTER_MAXIMUM_LENGTH
                ? `(${row.CHARACTER_MAXIMUM_LENGTH})`
                : "";
            console.log(`  - ${row.COLUMN_NAME}: ${row.DATA_TYPE}${maxLength}`);
        });
        console.log("-".repeat(60));
        console.log(`Total columns: ${resultArc.length}\n`);

        // Check PR_WAGES columns as well
        const queryWages = `
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'PR_WAGES'
            ORDER BY ORDINAL_POSITION
        `;

        const resultWages = await db.query<any>(queryWages, []);

        console.log("PR_WAGES columns:");
        console.log("-".repeat(60));
        resultWages.forEach((row: any) => {
            const maxLength = row.CHARACTER_MAXIMUM_LENGTH
                ? `(${row.CHARACTER_MAXIMUM_LENGTH})`
                : "";
            console.log(`  - ${row.COLUMN_NAME}: ${row.DATA_TYPE}${maxLength}`);
        });
        console.log("-".repeat(60));
        console.log(`Total columns: ${resultWages.length}\n`);

    } catch (error: any) {
        console.error("Error:", error.message);
    }
}

checkPR_EMPWAGES_Structure();
