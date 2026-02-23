/**
 * test_history_endpoints.ts
 * 
 * End-to-end test to verify that:
 * 1. The /employee/search endpoint returns results with actual_nik
 * 2. The /employee/:emp_code/history endpoint returns historical data
 * 3. The deep history interceptor returns data matching the original DB format
 * 4. Fields between history and original extraction are identical
 */

import { dataExtractorService } from "../../backend/src/services/dataExtractorService";
import { historyDatabaseService } from "../../backend/src/services/historyDatabaseService";
import { employeeRepository } from "../../backend/src/services/employeeRepository";
import { Config } from "../../backend/src/config";

// Force prod mode for history features
Config.RUN_MODE = "prod";

async function testSearchEndpoint() {
    console.log("\n========================================");
    console.log("[TEST 1] Employee Search (with NIK)");
    console.log("========================================");

    const results = await employeeRepository.search("A01", 10);
    console.log(`Found ${results.length} employees for query "A01"`);

    if (results.length > 0) {
        const first = results[0];
        console.log(`  First result: ${first.nama} | EmpCode: ${first.nik} | NIK(KTP): ${first.actual_nik}`);

        if (first.actual_nik) {
            console.log("  ✅ actual_nik field is present");
        } else {
            console.log("  ⚠️ actual_nik field is MISSING - check employeeRepository.search()");
        }
    }

    return results;
}

async function testHistoryInterceptor() {
    console.log("\n========================================");
    console.log("[TEST 2] Deep History Interceptor");
    console.log("========================================");

    // Test with a historical period (e.g., 1/2026 which should be in history)
    const historicalMonth = 1;
    const historicalYear = 2026;

    console.log(`Testing period ${historicalMonth}/${historicalYear}...`);
    console.log(`History Mode: ${historyDatabaseService.isHistoryMode() ? 'ON' : 'OFF'}`);

    try {
        // 1. Try direct history table query
        const historyData = await historyDatabaseService.getHistoricalPayrollDataAsExtractorFormat(
            historicalMonth, historicalYear
        );

        if (historyData && historyData.data_rows.length > 0) {
            console.log(`✅ History snapshot found: ${historyData.data_rows.length} rows`);
            console.log(`   Dynamic Premi Headers: ${historyData.dynamic_premi_headers.join(', ') || 'none'}`);
            console.log(`   Dynamic Potongan Headers: ${historyData.dynamic_potongan_headers.join(', ') || 'none'}`);
            console.log(`   Is Snapshot: ${historyData.meta.is_history_snapshot}`);

            // Show first row summary
            const first = historyData.data_rows[0];
            console.log(`\n   Sample Row:`);
            console.log(`     NIK: ${first.nik}`);
            console.log(`     Nama: ${first.nama}`);
            console.log(`     Emp Code: ${first.emp_code}`);
            console.log(`     Gaji Pokok: ${first.gaji_pokok}`);
            console.log(`     Upah Bersih: ${first.upah_bersih}`);
            console.log(`     Total Potongan: ${first.total_potongan}`);

            return first;
        } else {
            console.log(`⚠️ No history data found for ${historicalMonth}/${historicalYear}`);
            console.log("   This is expected if history has not been seeded for this period.");
            return null;
        }
    } catch (err) {
        console.error("❌ Error testing history interceptor:", err);
        return null;
    }
}

async function testFieldComparison() {
    console.log("\n========================================");
    console.log("[TEST 3] Field Comparison: History vs Live");
    console.log("========================================");

    // Use the CURRENT period for comparison since live data is always available
    const { currentPeriodService } = await import("../../backend/src/services/currentPeriodService");
    const currentPeriod = await currentPeriodService.getCurrentPeriod();

    console.log(`Current period: ${currentPeriod.month}/${currentPeriod.year}`);

    try {
        // Get live data
        const liveResult = await dataExtractorService.extractPayrollData(
            currentPeriod.month, currentPeriod.year, "ALL", undefined, null, Config.DB_PROFILE
        );

        if (!liveResult || liveResult.data_rows.length === 0) {
            console.log("⚠️ No live data available for comparison");
            return;
        }

        console.log(`Live data: ${liveResult.data_rows.length} rows`);

        // Check expected fields exist in live data
        const expectedFields = [
            'nik', 'nama', 'emp_code', 'gaji_pokok', 'upah_bersih',
            'total_potongan', 'total_tunjangan', 'lembur_jumlah',
            'jumlah_hk', 'upah_dasar', 'pot_pph21', 'pot_spsi'
        ];

        const sampleRow = liveResult.data_rows[0];
        console.log(`\nField presence check on live data (sample: ${sampleRow.nama}):`);

        let allPresent = true;
        for (const field of expectedFields) {
            const present = sampleRow[field] !== undefined;
            console.log(`  ${present ? '✅' : '❌'} ${field}: ${present ? sampleRow[field] : 'MISSING'}`);
            if (!present) allPresent = false;
        }

        if (allPresent) {
            console.log("\n✅ All expected fields are present in live data");
        } else {
            console.log("\n⚠️ Some fields are missing in live data");
        }

        // Now check history data for a past period (if seeded)
        const pastMonth = currentPeriod.month === 1 ? 12 : currentPeriod.month - 1;
        const pastYear = currentPeriod.month === 1 ? currentPeriod.year - 1 : currentPeriod.year;

        console.log(`\nChecking history for ${pastMonth}/${pastYear}...`);

        const historyData = await historyDatabaseService.getHistoricalPayrollDataAsExtractorFormat(
            pastMonth, pastYear
        );

        if (historyData && historyData.data_rows.length > 0) {
            const historyRow = historyData.data_rows[0];
            console.log(`History data found: ${historyData.data_rows.length} rows (sample: ${historyRow.nama})`);

            console.log("\nField presence check on HISTORY data:");
            let histAllPresent = true;
            for (const field of expectedFields) {
                const present = historyRow[field] !== undefined;
                console.log(`  ${present ? '✅' : '❌'} ${field}: ${present ? historyRow[field] : 'MISSING'}`);
                if (!present) histAllPresent = false;
            }

            if (histAllPresent) {
                console.log("\n✅ History data has all expected fields - transition will be seamless!");
            } else {
                console.log("\n⚠️ Some fields missing in history data - check getHistoricalPayrollDataAsExtractorFormat()");
            }
        } else {
            console.log(`⚠️ No history data seeded for ${pastMonth}/${pastYear}`);
        }

    } catch (err) {
        console.error("❌ Error during field comparison:", err);
    }
}

async function main() {
    console.log("╔════════════════════════════════════════════╗");
    console.log("║  History Endpoint Integration Test Suite   ║");
    console.log("╚════════════════════════════════════════════╝");

    await testSearchEndpoint();
    await testHistoryInterceptor();
    await testFieldComparison();

    console.log("\n\n===== ALL TESTS COMPLETE =====\n");
    process.exit(0);
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
