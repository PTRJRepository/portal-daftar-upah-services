
import { Database } from "./src/db/client";


const fs = require('fs');

async function log(msg) {
    console.log(msg);
    const str = (typeof msg === 'object' ? JSON.stringify(msg, null, 2) : msg) + "\n";
    try {
        fs.appendFileSync("debug.log", str);
    } catch (e) { console.error("Log fail", e); }
}

async function debug() {
    await Bun.write("debug.log", "Starting Debug\n");
    await log("DEBUG: Checking Database State Directly");

    // Check Extended DB
    const db = Database.getExtendedInstance();
    await log(`Using DB: ${db['databaseName']} Profile: ${db['serverProfile']}`);
    await log(`Gateway URL: ${db['baseUrl']}`);

    try {
        const tables = await db.query("SELECT * FROM sys.tables WHERE name = 'employee_estate'");
        await log("Table check result:");
        await log(tables);

        if (tables.length === 0) {
            await log("CRITICAL: Table employee_estate does not exist!");
        } else {
            // Check content
            const rows = await db.query("SELECT * FROM employee_estate");
            await log(`Rows in employee_estate: ${rows.length}`);
            await log(rows);
        }

    } catch (e) {
        await log("DB Error: " + e.message);
        await log(e);
    }
}

debug();
