import { HistoryDatabaseService } from "../../backend/src/services/historyDatabaseService";
import { info } from "../../backend/src/utils/logger";

async function testFiltering() {
    const historyDb = HistoryDatabaseService.getInstance();
    const month = 3;
    const year = 2024; // Use a year with data

    console.log("--- Testing Real Division (ARA) ---");
    const araData = await historyDb.getHistoricalPayrollDataAsExtractorFormat(month, year, "ALL", "ARA");
    console.log(`ARA Total Employees: ${araData?.data_rows.length ?? 0}`);

    console.log("\n--- Testing Group Filter (ARA Group 1) ---");
    const group1Data = await historyDb.getHistoricalPayrollDataAsExtractorFormat(month, year, "ALL", "ARA", null, "1");
    console.log(`ARA Group 1 Employees: ${group1Data?.data_rows.length ?? 0}`);
    if (group1Data?.data_rows) {
        const sampleGangs = group1Data.data_rows.slice(0, 5).map(r => r.gang_code);
        console.log(`Sample Gangs in Group 1: ${sampleGangs.join(", ")}`);
    }

    console.log("\n--- Testing Virtual Division (INFRA) ---");
    const infraData = await historyDb.getHistoricalPayrollDataAsExtractorFormat(month, year, "ALL", "INFRA");
    console.log(`INFRA Total Employees: ${infraData?.data_rows.length ?? 0}`);
    if (infraData?.data_rows) {
        const sampleGangs = infraData.data_rows.slice(0, 5).map(r => r.gang_code);
        console.log(`Sample Gangs in INFRA: ${sampleGangs.join(", ")}`);
    }
}

testFiltering().catch(console.error);
