import { historyDatabaseService } from '../../backend/src/services/historyDatabaseService';
import { taxReportService } from '../../backend/src/services/taxReportService';
import { Config } from '../../backend/src/config';

async function testDecemberTax() {
    try {
        console.log("=== Testing historyDatabaseService.getHistoricalPayrollDataAsExtractorFormat for Dec 2025 ===");
        const decHistory = await historyDatabaseService.getHistoricalPayrollDataAsExtractorFormat(12, 2025, 'ALL');

        if (!decHistory) {
            console.log("❌ decHistory is NULL. History for Dec 2025 is NOT available in history table.");
        } else {
            console.log(`✅ decHistory found! data_rows count: ${decHistory.data_rows.length}`);
            if (decHistory.data_rows.length > 0) {
                console.log("Sample 1 row:", JSON.stringify(decHistory.data_rows[0], null, 2));
            }
        }

        console.log("\n=== Testing taxReportService.getDecemberTaxReport ===");
        const decReport = await taxReportService.getDecemberTaxReport(2025, undefined, 'ALL');

        console.log(`Available months: ${decReport.available_months.join(', ')}`);
        console.log(`Returned employees count: ${decReport.employees.length}`);

        if (decReport.employees.length > 0) {
            console.log("Sample 1 employee:", JSON.stringify(decReport.employees[0], null, 2));
        } else {
            console.log("❌ getDecemberTaxReport returned NO employees. Filters might be dropping them.");
        }

    } catch (e) {
        console.error("Test failed with error:", e);
    } finally {
        process.exit(0);
    }
}

testDecemberTax();
