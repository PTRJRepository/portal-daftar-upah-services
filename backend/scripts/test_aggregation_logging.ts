
import { seedAggregationToDb } from "../src/api/aggregationSeederRoutes";

async function runTest() {
    console.log("Running Aggregation Seed Test for AB1...");
    try {
        const result = await seedAggregationToDb("AB1", 1, 2026, true);
        console.log("Result:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

runTest();
