import { taxReportService } from "./src/services/taxReportService";
import { generateMonthlyTaxExcel } from "./src/services/taxReportExcelService";
import { DatabaseService } from "./src/services/databaseService";

async function run() {
    console.log("Connecting DB...");
    await DatabaseService.getInstance().connect();
    
    console.log("Testing getMonthlyTaxReport for all gangs in IJL...");
    try {
        const data = await taxReportService.getMonthlyTaxReport(2026, 3, "IJL", undefined, undefined, false);
        console.log(`Fetched ${data.employees.length} employees`);
        
        console.log("Generating excel...");
        const buffer = await generateMonthlyTaxExcel(data, 2026, 3, "IJL", "ALL", data.premiKeys);
        console.log(`Success! Buffer size: ${buffer.length}`);
    } catch (e) {
        console.error("ERROR EXPORTING PPH21:");
        console.error(e);
    }
    process.exit(0);
}

run();
