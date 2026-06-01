import { historyDatabaseService } from '../services/historyDatabaseService';

async function test() {
    try {
        console.log("Testing new history query logic...");
        const result = await historyDatabaseService.getHistoricalPayrollDataAsExtractorFormat(1, 2025, "ALL", "RBM");
        console.log("Rows returned for Month 1, 2025, division RBM:");
        if (result) {
            console.log(result.data_rows.length, "rows found");
        } else {
            console.log("NULL result returned.");
        }
    } catch (e) {
        console.error("Error:", e);
    } finally {
        process.exit(0);
    }
}
test();
