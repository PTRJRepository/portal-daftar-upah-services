import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    console.log("Checking PR_GANG GangID for PERCOBAAN PANEN...");

    const rows = await db.query(`
        SELECT top 10 ID, GangID, Description
        FROM PR_GANG
        WHERE Description LIKE '%PERCOBAAN PANEN%'
    `);
    console.table(rows);
}

main().catch(console.error).finally(() => process.exit(0));
