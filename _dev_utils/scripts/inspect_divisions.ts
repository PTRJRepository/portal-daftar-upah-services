import { Database } from "../../backend/src/db/client";

async function main() {
    try {
        const db = Database.getInstance();
        console.log("--- LocCode in HR_GANG ---");
        const rows = await db.query("SELECT DISTINCT LocCode FROM HR_GANG WHERE LocCode IS NOT NULL");
        console.log(JSON.stringify(rows, null, 2));

        console.log("\n--- Sample Gangs ---");
        const gangs = await db.query("SELECT TOP 10 GangCode, Description, LocCode FROM HR_GANG");
        console.log(JSON.stringify(gangs, null, 2));

    } catch (e) {
        console.error(e);
    }
}

main();
