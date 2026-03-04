import { Database } from "../../backend/src/db/client";

async function main() {
    try {
        const db = Database.getInstance(undefined, "SERVER_PROFILE_2");
        console.log("--- Searching for K2 gangs in ALL divisions ---");
        const rows = await db.query(`
            SELECT GangCode, Description, LocCode
            FROM HR_GANG
            WHERE GangCode LIKE 'K%'
            ORDER BY LocCode, GangCode
        `);
        console.log(JSON.stringify(rows, null, 2));
    } catch (e) {
        console.error(e);
    }
}

main();
