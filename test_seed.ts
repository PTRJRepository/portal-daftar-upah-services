import { autoBufferManualAdjustmentSeederService } from "./backend/src/services/autoBufferManualAdjustmentSeederService";

async function run() {
    console.log("Running seed...");
    try {
        const seedResult = await autoBufferManualAdjustmentSeederService.seedPeriod({
            period_month: 4,
            period_year: 2026,
            division_code: "PG1B",
            gang_code: "B3M",
            created_by: "system_test"
        });
        console.log("Seed Result:", seedResult);

        console.log("\nRunning validation...");
        const valResult = await autoBufferManualAdjustmentSeederService.validatePeriod({
            period_month: 4,
            period_year: 2026,
            division_code: "PG1B",
            gang_code: "B3M",
            created_by: "system_test"
        });
        console.log("Validation Result:", valResult);
    } catch (error) {
        console.error("Error:", error);
    }
    process.exit(0);
}

run();
