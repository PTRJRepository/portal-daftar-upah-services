import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    const rows = await db.query("SELECT TOP 1 * FROM HR_GANGLN");
    console.log("HR_GANGLN sample columns:", Object.keys(rows[0] || {}));
    
    const rows2 = await db.query("SELECT TOP 1 * FROM PR_GANGLN");
    console.log("PR_GANGLN sample columns:", Object.keys(rows2[0] || {}));
}

main().catch(console.error).finally(() => process.exit(0));
