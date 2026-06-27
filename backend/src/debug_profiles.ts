
import { Database } from "./db/client";

async function debug() {
    console.log("Debugging HR_GANG on Profile 1 vs Profile 2...");

    // Profile 1 (Default)
    try {
        const db1 = Database.getInstance(undefined, "SERVER_PROFILE_1");
        const rows1 = await db1.query("SELECT COUNT(*) as count FROM HR_GANG");
        console.log(`Profile 1 HR_GANG count: ${rows1[0].count}`);
    } catch (e) {
        console.error("Profile 1 Error:", e.message);
    }

    // Profile 2
    try {
        const db2 = Database.getInstance(undefined, "SERVER_PROFILE_2");
        const rows2 = await db2.query("SELECT COUNT(*) as count FROM HR_GANG");
        console.log(`Profile 2 HR_GANG count: ${rows2[0].count}`);
    } catch (e) {
        console.error("Profile 2 Error:", e.message);
    }

    process.exit(0);
}

debug().catch(console.error);
