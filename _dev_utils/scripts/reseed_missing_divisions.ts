/**
 * Re-seed P1A, P1B, AB2 with file output
 */

import { writeFileSync } from "fs";

const PORT = 8002;
const BASE_URL = `http://localhost:${PORT}/backend/upah`;
const AUTH_TOKEN = "Bearer system-reseed";

const lines: string[] = [];
function log(msg: string) {
    lines.push(msg);
    console.log(msg);
}

async function reseed() {
    log("=== Re-seeding Missing Source Divisions ===\n");

    const divisionsToSeed = ["P1A", "P1B", "AB2"];
    const month = 2;
    const year = 2026;

    for (const div of divisionsToSeed) {
        log(`\nSeeding ${div} for ${month}/${year}...`);
        try {
            const response = await fetch(`${BASE_URL}/payroll/aggregation/seed`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": AUTH_TOKEN
                },
                body: JSON.stringify({
                    division: div,
                    month: month,
                    year: year,
                    force: true
                })
            });

            const result = await response.json() as any;
            log(`  Status: ${response.status}`);
            log(`  Success: ${result.success}`);
            if (result.success && result.data) {
                for (const item of result.data) {
                    log(`    ${item.division} - ${item.gang}: ${item.employees_processed} employees [${item.status}]`);
                }
            } else if (result.error) {
                log(`  Error: ${result.error}`);
            }
            log(`  Full response: ${JSON.stringify(result).substring(0, 500)}`);
        } catch (error: any) {
            log(`  ❌ ${div}: Error - ${error.message}`);
        }
    }

    // Verify
    log("\n\n=== Verification ===");
    try {
        const verifyUrl = `${BASE_URL}/payroll/aggregation/history?month=${month}&year=${year}`;
        const verifyResp = await fetch(verifyUrl, {
            headers: { "Authorization": AUTH_TOKEN }
        });
        const verifyData = await verifyResp.json() as any;

        if (verifyData.success) {
            const targetGangs = ["AMC", "HMC", "B2N", "INF", "INT"];
            log(`Total gangs in aggregation: ${verifyData.data?.length || 0}`);

            for (const gang of targetGangs) {
                const found = verifyData.data?.find((r: any) => r.gang_code?.trim() === gang);
                if (found) {
                    log(`  ✅ ${gang}: div=${found.division_code?.trim()}, emp=${found.total_employees}, upah=${found.total_upah_bersih}`);
                } else {
                    log(`  ❌ ${gang}: NOT FOUND`);
                }
            }

            // Also show all gangs with their division_code
            log("\nAll gangs:");
            for (const r of verifyData.data || []) {
                log(`  ${r.gang_code?.trim()} (div=${r.division_code?.trim()}) emp=${r.total_employees}`);
            }
        } else {
            log(`Verify failed: ${verifyData.error}`);
        }
    } catch (error: any) {
        log(`  Verification error: ${error.message}`);
    }

    log("\n=== Done ===");
    writeFileSync("_dev_utils/scripts/reseed_output.txt", lines.join("\n"));
    log("Output written to _dev_utils/scripts/reseed_output.txt");
}

reseed().catch(console.error);
