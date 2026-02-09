
import { dashboardService } from "../src/services/dashboardService";
import { DataExtractorService } from "../src/services/dataExtractorService";
import { Database } from "../src/db/client";
import * as fs from 'fs';

async function verify() {
    const log = (msg: string) => {
        console.log(msg);
        fs.appendFileSync('verify_result.txt', msg + '\n');
    };

    // Clear previous result
    fs.writeFileSync('verify_result.txt', '');

    log("Verifying Refactor Consistency...");

    try {
        // 1. Get Latest Period
        const { month, year } = await dashboardService.getLatestPeriod();
        log(`Latest Period: ${month}/${year}`);

        // 2. Get a valid Division to test
        const filters = await dashboardService.getFilterOptions(month, year);
        if (!filters.divisions || filters.divisions.length === 0) {
            log("No divisions found for this period. Cannot verify.");
            return;
        }

        const testDivision = filters.divisions[0]; // Pick first division
        log(`Testing Division: ${testDivision}`);

        // 3. Fetch Aggregated Data (Source for New KPI Cards)
        log("Fetching Aggregated Gang Data...");
        const aggregatedData = await dashboardService.getAggregatedGangData(testDivision, month, year);

        let aggTotalWage = 0;
        let aggTotalHeadcount = 0;

        aggregatedData.forEach((r: any) => {
            aggTotalWage += Number(r.total_wage || 0);
            aggTotalHeadcount += Number(r.headcount || 0);
        });

        log(`[AGGREGATED] Total Wage: ${aggTotalWage.toLocaleString()}`);
        log(`[AGGREGATED] Headcount: ${aggTotalHeadcount}`);

        // 4. Fetch Raw Data (Source for Table Details)
        log("Fetching Raw Data (DataExtractorService)...");
        const dataExtractor = DataExtractorService.getInstance();

        // Pass the specific division code, NOT 'ALL'
        // Use undefined for serverProfile to use default DB configuration
        const rawResult = await dataExtractor.extractPayrollData(month, year, "ALL", testDivision, null, undefined);

        let rawTotalWage = 0;
        let rawHeadcount = 0;

        if (rawResult.data_rows) {
            rawResult.data_rows.forEach((e: any) => {
                // Raw comparison: Sum of upah_bersih
                rawTotalWage += Number(e.upah_bersih || 0);
                rawHeadcount++;
            });
        }

        log(`[RAW] Total Wage: ${rawTotalWage.toLocaleString()}`);
        log(`[RAW] Headcount: ${rawHeadcount}`);

        // 5. Compare
        const wageDiff = aggTotalWage - rawTotalWage;
        const hcDiff = aggTotalHeadcount - rawHeadcount;

        log("---------------------------------------------------");
        log(`Wage Difference: ${wageDiff.toLocaleString()} (${aggTotalWage > 0 ? ((wageDiff / aggTotalWage) * 100).toFixed(4) : 0}%)`);
        log(`Headcount Diff: ${hcDiff}`);

        // Difference threshold: < 0.1% for Wage and exact match for Headcount (ideal)
        // But some small diff is expected due to date cutoffs or rounding
        const pctDiff = aggTotalWage > 0 ? Math.abs((wageDiff / aggTotalWage) * 100) : 0;

        if (pctDiff < 0.1) {
            log("✅ SUCCESS: Data is consistent (< 0.1% difference)!");
        } else {
            log("⚠️ WARNING: Significant discrepancy found.");
        }

    } catch (e: any) {
        log(`Verification Failed: ${e.message}`);
    }
}

verify();
