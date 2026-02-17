
import { Database } from "../../backend/src/db/client";
import { Config } from "../../backend/src/config";
import * as fs from 'fs';
import * as path from 'path';

async function listDatabases() {
    console.log("Listing databases on all profiles...");
    const outputPath = path.join(__dirname, 'server_databases.txt');

    // Add PROFILE_3
    const profiles = [Config.DB_PROFILE, Config.DB_EXTEND_PROFILE, Config.DB_VENUS_PROFILE];
    let output = "";

    for (const profile of profiles) {
        if (!profile) continue;
        output += `\nProfile: ${profile}\n`;
        console.log(`Checking ${profile}...`);

        // Connect to 'master' to list databases
        const db = Database.getInstance('master', profile);

        try {
            const dbs = await db.query(`SELECT name FROM sys.databases ORDER BY name`);
            output += `Found ${dbs.length} databases:\n`;
            dbs.forEach(d => {
                output += `  - ${d.name}\n`;
            });

            // Check specifically for staging
            const staging = dbs.find(d => d.name.toLowerCase().includes('staging'));
            if (staging) {
                console.log(`[POTENTIAL_MATCH] Found database: ${staging.name} in ${profile}`);
            }

        } catch (e: any) {
            output += `  Error: ${e.message}\n`;
        }
    }

    fs.writeFileSync(outputPath, output);
    console.log(`Result written to ${outputPath}`);
}

listDatabases().catch(console.error);
