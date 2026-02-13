
import { Database } from "../db/client";

async function main() {
    const db = Database.getInstance();
    const tables = [
        "PR_HARVEST", "PR_HARVESTLN",
        "PR_TBS", "PR_TBSLN",
        "PR_WEIGHTBRIDGE", "PR_WEIGHBRIDGE",
        "PR_PRODUCTION", "PR_PROD",
        "PR_GANG_ACTIVITY",
        "PR_BUNCH", "PR_BUNCHLN"
    ];

    for (const table of tables) {
        try {
            const rows = await db.query<any>(`SELECT TOP 1 * FROM ${table}`);
            console.log(`[FOUND] Table ${table} exists! Columns:`, Object.keys(rows[0] || {}));
        } catch (e: any) {
            // console.log(`[MISSING] Table ${table} does not exist.`);
        }
    }
}

main().catch(console.error);
