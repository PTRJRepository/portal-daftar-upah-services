import { taxReportService } from "./src/services/taxReportService";
import { generateMonthlyTaxExcel } from "./src/services/taxReportExcelService";
import { MasterService } from "./src/services/masterService";

async function run() {
    console.log("Starting test for ALL IJL...");
    
    try {
        console.time("getMonthlyTaxReport");
        const data = await taxReportService.getMonthlyTaxReport(2026, 3, "PG2B", undefined, undefined, false);
        console.timeEnd("getMonthlyTaxReport");
        
        console.log(`Fetched ${data.employees.length} employees`);
        if (data.employees.length > 0) {
            console.log(`First employee: ${data.employees[0].emp_code}`);
        }
        
        console.log("Generating excel...");
        console.time("generateMonthlyTaxExcel");
        const buffer = await generateMonthlyTaxExcel(data, 2026, 3, "PG2B", "ALL", data.premiKeys);
        console.timeEnd("generateMonthlyTaxExcel");
        
        console.log(`Success! Buffer size: ${buffer.length}`);
    } catch (e) {
        console.error("ERROR EXPORTING PPH21:");
        console.error(e);
    }
    process.exit(0);
}

run();
