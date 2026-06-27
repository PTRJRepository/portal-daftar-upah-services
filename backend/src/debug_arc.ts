
import { Database } from "./db/client";

async function debug() {
    console.log("Debugging PR_GANGLN_ARC content...");
    const db = Database.getInstance(undefined, "SERVER_PROFILE_2");

    try {
        console.log("Checking available Gangs for AccMonth 10, AccYear 2026...");
        const rows = await db.query(`
            SELECT DISTINCT g.Description
            FROM PR_GANGLN_ARC gl
            JOIN PR_GANG g ON g.ID = gl.MasterID
            WHERE gl.AccMonth = 10 AND gl.AccYear = 2026
            ORDER BY g.Description
        `);

        console.log(`Found ${rows.length} gangs with data:`);
        // Show first 50
        console.table(rows.slice(0, 50));

    } catch (e) {
        console.error(e);
    }

    process.exit(0);
}

debug().catch(console.error);
