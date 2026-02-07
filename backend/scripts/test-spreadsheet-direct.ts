import { Config } from "../src/config";
import { Database } from "../src/db/client";
import { PayrollDataService } from "../src/services/payrollDataService";
import { AppsScriptService } from "../src/services/appsScriptService";

async function testDirect() {
    console.log("Testing Spreadsheet Sync DIRECTLY (Bypass Server)...");
    console.log(`DB Profile: ${Config.DB_PROFILE}`);

    try {
        // Fetch Data
        console.log("Fetching employee data...");
        const division = "AB1";
        const month = 1;
        const year = 2026;

        // Auth token is unused in direct call
        const employeeData = await PayrollDataService.fetchEmployeeData(division, month, year, "Bearer direct_test");
        console.log(`Fetched ${employeeData.length} employees.`);

        if (employeeData.length > 0) {
            const sample = employeeData[0];
            console.log("Sample Employee:", sample.nama || sample.emp_name, "Upah Bersih:", sample.upah_bersih);

            // Sync
            console.log("Syncing to Apps Script...");
            const result = await AppsScriptService.syncDivisionToSpreadsheet(division, month, year, employeeData);
            console.log("Sync Success:", result);
        } else {
            console.log("No data found. This confirms DB/Logic issue if direct call fails.");
        }

    } catch (e) {
        console.error("Direct Test Error:", e);
    }
}

testDirect();
