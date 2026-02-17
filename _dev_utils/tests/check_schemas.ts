
import { Database } from "../../backend/src/db/client";
import { Config } from "../../backend/src/config";
import * as fs from 'fs';
import * as path from 'path';

async function verifySchemas() {
    const dbName = 'staging_PTRJ_iFES_Plantware';
    console.log(`Verifying schemas in ${dbName}...`);

    const profile = Config.DB_PROFILE;
    const db = Database.getInstance(dbName, profile);
    const outputPath = path.join(__dirname, 'schema_check.json');

    const result: any = {};
    const tablesToCheck = ['Ffbscannerdata', 'Piecemeal', 'Gwscannerdata'];

    try {
        for (const tableName of tablesToCheck) {
            console.log(`Checking ${tableName}...`);
            const rows = await db.query(`SELECT TOP 1 * FROM [${dbName}].[dbo].[${tableName}]`);

            if (rows.length > 0) {
                result[tableName] = {
                    columns: Object.keys(rows[0]),
                    sample: rows[0]
                };
                console.log(`  - Found with ${Object.keys(rows[0]).length} columns`);
            } else {
                result[tableName] = { status: 'EMPTY' };
                console.log(`  - Found but EMPTY`);

                // Get columns from schema if empty
                const cols = await db.query(`
                    SELECT COLUMN_NAME
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_NAME = '${tableName}'
                 `);
                result[tableName].columns = cols.map((c: any) => c.COLUMN_NAME);
            }
        }

        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
        console.log(`Schema written to ${outputPath}`);

    } catch (e: any) {
        console.log(`Error: ${e.message}`);
    }
}

verifySchemas().catch(console.error);
