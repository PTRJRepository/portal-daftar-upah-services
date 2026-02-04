import { Database } from "../src/db/client";
import { dataExtractorService } from "../src/services/dataExtractorService";

async function runValidation() {
    console.log("Starting Validation for AB1 - Month 1 Year 2026");

    // 1. Get Stored Aggregation
    const db = Database.getExtendedInstance();
    const storedRows = await db.query<any>(`
        SELECT gang_code, total_upah_bersih, total_employees, total_hk
        FROM dbo.daftar_upah_aggregation_history
        WHERE division_code = 'AB1' AND period_month = 1 AND period_year = 2026
    `);

    console.log(`Stored Aggregation found ${storedRows.length} gangs.`);

    // 2. Get Live Data
    const liveData = await dataExtractorService.extractPayrollData(1, 2026, "ALL", "AB1", null, "SERVER_PROFILE_1");
    // Note: extractPayrollData returns ALL employees in division. We need to group by Gang.

    const liveGangs: Record<string, { upah: number, emp_count: number, hk: number, employees: any[] }> = {};

    // Group
    for (const row of liveData.data_rows) {
        const g = row.gang_code;
        if (!liveGangs[g]) {
            liveGangs[g] = { upah: 0, emp_count: 0, hk: 0, employees: [] };
        }

        // Filter: HK > 0 (The validation endpoint logic uses HK > 0 check on top of extraction)
        // AND ensure Effective Effective HK was handled in extractor already.
        // But validation endpoint reapplies `hk > 0` filter.
        // dataExtractorService ALREADY filtered logic.
        // So we just sum up.

        const hk = parseFloat(row.jumlah_hk) || 0;
        if (hk > 0) { // Keep consistency with aggregation logic
            liveGangs[g].employees.push(row);
            liveGangs[g].upah += (row.upah_bersih || 0);
            liveGangs[g].hk += hk;
            liveGangs[g].emp_count++;
        }
    }

    // 3. Compare
    let totalDiff = 0;

    for (const stored of storedRows) {
        const live = liveGangs[stored.gang_code];
        if (!live) {
            console.log(`[MISSING] Gang ${stored.gang_code} in Stored but NOT in Live.`);
            continue;
        }

        const diff = stored.total_upah_bersih - live.upah;
        if (Math.abs(diff) > 100) {
            console.log(`[DIFF] Gang ${stored.gang_code}: Stored=${stored.total_upah_bersih}, Live=${live.upah}, Diff=${diff}`);

            // Find employee diff if possible?
            // This requires fetching details of stored data which we don't have (only Aggregation).
            // But we can inspect Live employees to see if anyone has 'diff' amount.
        }
        totalDiff += diff;
    }

    console.log(`Total Discrepancy (Stored - Live): ${totalDiff}`);

    // Check Grand Total
    const storedTotal = storedRows.reduce((a: number, b: any) => a + b.total_upah_bersih, 0);
    const liveTotal = Object.values(liveGangs).reduce((a, b) => a + b.upah, 0);

    console.log(`Grand Total Stored: ${storedTotal}`);
    console.log(`Grand Total Live:   ${liveTotal}`);
    console.log(`Final Difference:   ${storedTotal - liveTotal}`);
}

runValidation();
