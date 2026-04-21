import { Database } from "../db/client";
import { OtherIncomesService } from "../services/otherIncomesService";

/**
 * Test script to simulate THR summary after user selects a division
 * Usage: bun run src/scripts/test_thr_summary.ts
 */

async function testThrSummary() {
    console.log("=== Testing THR Summary Report ===\n");

    const testCases = [
        { year: 2026, month: 2, division: undefined, label: "ALL Divisions" },
        { year: 2026, month: 2, division: "AB1", label: "AB1 Division" },
        { year: 2026, month: 2, division: "PG1A", label: "PG1A Division" },
        { year: 2026, month: 2, division: "WKS_AR", label: "WKS_AR (Workshop)" },
        { year: 2026, month: 2, division: "WKS_PG", label: "WKS_PG (Workshop PG)" },
    ];

    for (const testCase of testCases) {
        console.log(`\n--- ${testCase.label} ---`);
        console.log(`Params: year=${testCase.year}, month=${testCase.month}, division=${testCase.division || 'ALL'}`);

        try {
            // Simulate the same logic as the API endpoint
            const summary = await OtherIncomesService.getThrSummary(
                testCase.year,
                testCase.month,
                testCase.division
            );

            console.log("Summary result keys:", Object.keys(summary || {}));
            if (summary && summary.data) {
                console.log(`✓ Data rows: ${summary.data.length}`);
                console.log(`✓ Grand Total:`);
                console.log(`  - Total Employees: ${summary.grand_total?.total_employees || 0}`);
                console.log(`  - Full Workers: ${summary.grand_total?.full_workers || 0}`);
                console.log(`  - Proportional Workers: ${summary.grand_total?.prop_workers || 0}`);
                console.log(`  - Total THR: Rp ${(summary.grand_total?.total_thr || 0).toLocaleString('id-ID')}`);
                console.log(`  - Total Tunjangan Beras: Rp ${(summary.grand_total?.total_tunjangan_beras || 0).toLocaleString('id-ID')}`);
                console.log(`  - Total Tunjangan Jabatan: Rp ${(summary.grand_total?.total_tunjangan_jabatan || 0).toLocaleString('id-ID')}`);

                // Show first 3 gang summaries
                console.log(`  Sample gangs:`);
                summary.data.slice(0, 3).forEach(gang => {
                    console.log(`    - ${gang.gang_code}: ${gang.total_employees} employees, THR: Rp ${gang.total_thr?.toLocaleString('id-ID') || 0}`);
                });
            } else {
                console.log(`✗ Failed: ${summary.error || 'Unknown error'}`);
            }
        } catch (e) {
            console.log(`✗ Error: ${e.message}`);
        }
    }

    console.log("\n=== Test Complete ===");
}

testThrSummary();
