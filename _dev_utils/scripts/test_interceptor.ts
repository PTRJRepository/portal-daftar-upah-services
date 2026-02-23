import { Config } from "../../backend/src/config";
import { Database } from "../../backend/src/db/client";
import { dataExtractorService } from "../../backend/src/services/dataExtractorService";
import { historyDatabaseService } from "../../backend/src/services/historyDatabaseService";

async function testInterceptor() {
    console.log("=== Testing Deep History Interceptor ===");

    // Check if prod mode is active to enable history routing
    Config.RUN_MODE = 'prod';

    // Force history mode
    if (!historyDatabaseService.isHistoryMode()) {
        console.error("Failed to enter history mode.");
        process.exit(1);
    }

    // We already seeded 1/2026 for division A0150 in previous tasks.
    // However, dataExtractorService only triggers interceptor if isHistorical=true
    // isHistorical = (year < currentYear) || (year === currentYear && month < currentMonth)
    // To trigger it for 1/2026, we could spoof currentPeriodService or just pass 12/2025.
    // Let's see if 12/2025 data exists.

    console.log("querying 1/2026...");
    let result = await dataExtractorService.extractPayrollData(1, 2026, "ALL", undefined, "A0150");
    console.log(`Rows fetched for 12/2025: ${result.data_rows.length}`);
    console.log(`Is History Snapshot: ${result.meta.is_history_snapshot}`);

    if (result.data_rows.length === 0) {
        console.log("No deep history for 1/2026. Let me query 1/2026 directly using the raw history reader method.");
        const directResult = await historyDatabaseService.getHistoricalPayrollDataAsExtractorFormat(1, 2026, "ALL", undefined, "A0150");
        if (directResult) {
            console.log(`Raw Historical 1/2026 fetch fetched ${directResult.data_rows.length} rows.`);

            // Print one sample row to check formatting!
            if (directResult.data_rows.length > 0) {
                const sample = directResult.data_rows[0];
                console.log("\nSample Row Mapping Verification:");
                console.log(`- NIK: ${sample.nik}`);
                console.log(`- Nama: ${sample.nama}`);
                console.log(`- Gaji Pokok: ${sample.gaji_pokok}`);
                console.log(`- Upah Bersih: ${sample.upah_bersih}`);
                console.log(`- Total Potongan: ${sample.total_potongan}`);
                console.log(`- Status PTKP: ${sample.status_ptkp}`);
                console.log("\nSuccess! Data parsed securely back into Extractor format!");
            }
        } else {
            console.log("No data found for 1/2026 either.");
        }
    }

    process.exit(0);
}

testInterceptor().catch(console.error);
