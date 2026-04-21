import { Database } from "./src/db/client";
import { Config } from "./src/config";
import * as fs from "fs";

async function run() {
    const db = Database.getInstance();
    const result: any = {};

    try {
        const empRows = await db.query(`SELECT TOP 1 * FROM HR_EMPLOYMENT`);
        result.hr_employment = Object.keys(empRows[0] || {});
    } catch (e: any) { console.error(e.message) }

    try {
        const gangRows = await db.query(`SELECT TOP 1 * FROM HR_GANG`);
        result.hr_gang = Object.keys(gangRows[0] || {});
    } catch (e: any) { console.error(e.message) }

    try {
        const empBaseRows = await db.query(`SELECT TOP 1 * FROM HR_EMPLOYEE`);
        result.hr_employee = Object.keys(empBaseRows[0] || {});
    } catch (e: any) { console.error(e.message) }

    try {
        const extDb = Database.getInstance(Config.DB_EXTEND_TRANS_DATABASE);
        const hisRows = await extDb.query(`SELECT TOP 1 * FROM history_hr_employee`);
        result.history_hr_employee = Object.keys(hisRows[0] || {});
    } catch (e: any) { console.error(e.message) }

    fs.writeFileSync("schema_out.json", JSON.stringify(result, null, 2));
    process.exit(0);
}

run().catch(console.error);
