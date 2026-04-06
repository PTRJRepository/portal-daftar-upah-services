/**
 * Debug: Test exact call that frontend makes
 */
import { taxReportService } from "../../../src/services/taxReportService";

async function main() {
    console.log("=== DEBUG: Exact Frontend Call Test ===\n");

    // These are the params from the frontend log
    const year = 2026;
    const month = 3;
    const division = 'ARB2';  // from user divisions
    const gang = 'H1H';
    const gangPrefix = undefined;
    const useHistory = false;  // from frontend (use_history param)

    console.log(`Params: year=${year}, month=${month}, division=${division}, gang=${gang}, useHistory=${useHistory}\n`);

    try {
        const result = await taxReportService.getMonthlyTaxReport(year, month, division, gang, gangPrefix, useHistory);
        console.log(`Result: employees=${result.employees.length}, total_pph21=${result.total_pph21}, data_source=${result.data_source}`);

        if (result.employees.length === 0) {
            console.log("\n!!! 0 employees returned !!!");
            console.log("This is the bug - data exists in extend_db_ptrj but 0 returned");
        }
    } catch (e: any) {
        console.log(`ERROR: ${e.message}`);
    }

    console.log("\n=== END ===");
}

main().catch(console.error);
