import { dataExtractorService } from "../../src/services/dataExtractorService";
import { Config } from "../../src/config";

async function testExtraction() {
    console.log("Starting testExtraction...");
    const month = 3;
    const year = 2026;
    const divisionCode = "A";
    const gangCode = "C1B"; // Replace with your tested gangCode from UI
    
    // Test parameters exactly like API
    const result = await dataExtractorService.extractPayrollData(
        month, 
        year, 
        gangCode, 
        divisionCode, 
        null, 
        Config.DB_PROFILE, 
        false, 
        false, 
        null, // gangPrefix
        true  // skipHarvest
    );

    console.log(`\n\n--- RESULTS FOR GANG ${gangCode} ---`);
    console.log(`Employees Found: ${result.data_rows.length}`);
    console.log(`Gangs Found: ${result.gangs.length}`);
    if (result.data_rows.length > 0) {
        console.log("Sample employee:", result.data_rows[0].emp_name, result.data_rows[0].gang_code);
    }
    
    process.exit(0);
}

testExtraction().catch(e => {
    console.error("Test failed:", e);
    process.exit(1);
});
