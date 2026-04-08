import { TaxReportService } from "../../src/services/taxReportService";

async function main() {
    const taxService = new TaxReportService();
    
    // Test for March 2026
    const month = 3;
    const year = 2026;

    console.log(`--- Testing TaxReportService for DME (March 2026) ---`);
    try {
        const report = await taxService.getMonthlyTaxReport(
            "DME",
            month,
            year,
            undefined, // specificGangs
            undefined, // gangCodeList
            false, // forceRefresh
            true // useHistory
        );
        console.log(`DME Report generated with ${report.employees.length} employees`);
    } catch (e) {
        console.error(`DME Report failed: ${e.message}`);
    }

    console.log(`\n--- Testing TaxReportService for IJL (March 2026) ---`);
    try {
        const report = await taxService.getMonthlyTaxReport(
            "IJL",
            month,
            year,
            undefined,
            undefined,
            false,
            true
        );
        console.log(`IJL Report generated with ${report.employees.length} employees`);
    } catch (e) {
        console.error(`IJL Report failed: ${e.message}`);
    }
}

main().catch(console.error);
