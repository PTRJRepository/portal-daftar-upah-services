
import { Database } from "../../backend/src/db/client";
import { Config } from "../../backend/src/config";
import * as fs from 'fs';
import * as path from 'path';

async function verifyGwScanner() {
    const dbName = 'staging_PTRJ_iFES_Plantware';
    console.log(`Starting verification of ${dbName}...`);

    // SERVER_PROFILE_2
    const profile = Config.DB_PROFILE;
    console.log(`Using profile: ${profile}`);

    const db = Database.getInstance(dbName, profile);
    const outputPath = path.join(__dirname, 'gwscanner_schema.json');

    try {
        // List tables matching 'scanner'
        console.log("Listing tables matching '%scanner%'...");
        const tables = await db.query(`
            SELECT TABLE_SCHEMA, TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE = 'BASE TABLE' 
            AND TABLE_NAME LIKE '%scanner%'
        `);

        console.log(`Found ${tables.length} tables:`);
        tables.forEach(t => console.log(`- ${t.TABLE_SCHEMA}.${t.TABLE_NAME}`));

        // If gwscanner found, describe it
        const target = tables.find(t => t.TABLE_NAME.toLowerCase().includes('gwscanner'));

        if (target) {
            const fullTableName = `[${dbName}].[${target.TABLE_SCHEMA}].[${target.TABLE_NAME}]`;
            console.log(`\nQuerying TOP 1 from ${fullTableName}...`);

            const rows = await db.query(`SELECT TOP 1 * FROM ${fullTableName}`);

            if (rows.length > 0) {
                console.log("SUCCESS! Row found.");
                fs.writeFileSync(outputPath, JSON.stringify({
                    database: dbName,
                    table: target.TABLE_NAME,
                    schema: target.TABLE_SCHEMA,
                    columns: Object.keys(rows[0]),
                    sample: rows[0]
                }, null, 2));
                console.log(`Schema written to ${outputPath}`);
            } else {
                console.log("Table found but is EMPTY.");
            }
        } else {
            console.log("No table similar to 'gwscanner' found.");
        }
    } catch (e: any) {
        console.log(`Error: ${e.message}`);
    }
}

verifyGwScanner().catch(console.error);
