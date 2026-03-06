import { OtherIncomesService } from "../../backend/src/services/otherIncomesService";

async function run() {
    console.log("Fetching other incomes details...");
    try {
        const incomes = await OtherIncomesService.getIncomesWithDetails(2026, 2, "DME", "ALL");
        console.log(`Returned ${incomes.length} records.`);
        if (incomes.length > 0) {
            console.log("Sample:", incomes[0]);
        }
    } catch (err) {
        console.error("Error:", err);
    }
    process.exit(0);
}

run();
