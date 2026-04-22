import { Database } from "../../backend/src/db/client";

async function main() {
    const query = process.argv[2];
    if (!query) {
        console.log("Usage: bun direct_query.ts \"SELECT ...\"");
        return;
    }
    
    console.log(`Executing: ${query}`);
    const db = Database.getVenusInstance();
    try {
        const results = await db.query(query);
        console.log(JSON.stringify(results, null, 2));
    } catch (e: any) {
        console.error("Error:", e.message);
    }
}

main().catch(console.error);
