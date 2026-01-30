
import { DataExtractorService } from "./src/services/dataExtractorService";
import { Database } from "./src/db/client";

async function verify() {
    console.log("Starting verification...");
    // Initialize DB (it reads env automatically)
    // We assume .env is present in current directory
    Database.getInstance();

    const service = DataExtractorService.getInstance();
    // Use a small division or just limit inspection
    // PG1A is a common test division
    console.log("Extracting data for PG1A...");
    try {
        const result = await service.extractPayrollData(5, 2025, "ALL", "PG1A");

        console.log(`Got ${result.data_rows.length} rows.`);

        if (result.data_rows.length === 0) {
            console.log("No data found for PG1A in 5/2025. Trying default gang...");
            // Fallback or just report
        }

        // Check first 10 rows
        const first10 = result.data_rows.slice(0, 10);
        console.log("First 10 rows:");
        first10.forEach((r, i) => {
            console.log(`${i + 1}. ${r.nik} - ${r.nama}`);
        });

        // Verify sorting
        let sorted = true;
        for (let i = 0; i < result.data_rows.length - 1; i++) {
            if (result.data_rows[i].nik > result.data_rows[i + 1].nik) {
                console.error(`SORTING ERROR at index ${i}: ${result.data_rows[i].nik} > ${result.data_rows[i + 1].nik}`);
                sorted = false;
                break;
            }
        }

        if (sorted && result.data_rows.length > 0) {
            console.log("✅ SUCCESS: Data is sorted by EmpCode (NIK).");
        } else if (result.data_rows.length === 0) {
            console.log("⚠️ WARNING: No data to verify sorting.");
        } else {
            console.error("❌ FAILURE: Data is NOT sorted by EmpCode.");
        }

    } catch (e) {
        console.error("Error during verification:", e);
    }

    process.exit(0);
}

verify();
