
import { AggregationSeeder } from "../services/aggregationSeeder";

async function main() {
    console.log("Starting Aggregation Seeder for Jan 2026...");
    const seeder = new AggregationSeeder();
    const result = await seeder.seedAggregation(1, 2026);
    console.log("Seeding Result:", result);
}

main().catch(console.error);
