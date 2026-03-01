import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();

    console.log("Checking PR_GANG for ID = 140...");
    const rows = await db.query(`
        SELECT ID, GangID, Description FROM PR_GANG WHERE ID = 140
    `);
    console.table(rows);
}

main().catch(console.error).finally(() => process.exit(0));
