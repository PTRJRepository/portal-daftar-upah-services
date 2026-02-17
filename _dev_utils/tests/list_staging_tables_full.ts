
import { Database } from "../../backend/src/db/client";
import { Config } from "../../backend/src/config";
import * as fs from 'fs';
import * as path from 'path';

async function listAllTables() {
    const dbName = 'staging_PTRJ_iFES_Plantware';
    console.log(`Listing all tables in ${dbName}...`);

    const profile = Config.DB_PROFILE;
    const db = Database.getInstance(dbName, profile);
    const outputPath = path.join(__dirname, 'staging_all_tables.txt');

    try {
        const tables = await db.query(`
            SELECT TABLE_SCHEMA, TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_NAME
        `);

        let output = `Tables in ${dbName}:\n`;
        tables.forEach(t => {
            output += `- ${t.TABLE_SCHEMA}.${t.TABLE_NAME}\n`;
        });

        fs.writeFileSync(outputPath, output);
        console.log(`Result written to ${outputPath}`);

    } catch (e: any) {
        console.log(`Error: ${e.message}`);
    }
}

listAllTables().catch(console.error);
