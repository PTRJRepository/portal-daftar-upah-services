import { Database } from "./db/client";
import { writeFileSync } from "fs";

async function debug() {
    const db = Database.getInstance();

    const results = await db.query(`
        SELECT GangCode, Description, LocCode 
        FROM HR_GANG 
        WHERE GangCode = 'A1H'
    `);

    writeFileSync("gang_check.json", JSON.stringify(results, null, 2));
    process.exit(0);
}

debug().catch(console.error);
