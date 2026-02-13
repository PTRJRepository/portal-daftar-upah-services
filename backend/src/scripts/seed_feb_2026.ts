
import { seedAggregationToDb } from "../api/aggregationSeederRoutes";

async function main() {
    console.log("Seeding Feb 2026...");
    try {
        // division=undefined (all), month=2, year=2026, auth="", force=true
        const result = await seedAggregationToDb(undefined, 2, 2026, "Bearer dummy_token", true);
        console.log("Seeding Result:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Seeding failed:", e);
    }
}

main().catch(console.error);
