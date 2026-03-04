/**
 * Verify virtual divisions appear in summary after fix
 */
import { writeFileSync } from "fs";

const PORT = 8002;

async function verify() {
    const lines: string[] = [];
    function log(msg: string) { lines.push(msg); console.log(msg); }

    log("=== Verifying Virtual Divisions in Summary ===\n");

    // Need a valid auth token. Let's login first.
    const loginResp = await fetch(`http://localhost:${PORT}/backend/upah/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "admin123" })
    });
    const loginData = await loginResp.json() as any;

    if (!loginData.token) {
        log("Failed to login: " + JSON.stringify(loginData));
        writeFileSync("_dev_utils/scripts/verify_output.txt", lines.join("\n"));
        return;
    }

    const token = `Bearer ${loginData.token}`;
    log(`Logged in as admin, token obtained\n`);

    // Call summary endpoint
    const summaryResp = await fetch(`http://localhost:${PORT}/backend/upah/payroll/summary/all-divisions?month=2&year=2026`, {
        headers: { "Authorization": token }
    });
    const summaryData = await summaryResp.json() as any;

    log(`Summary response status: ${summaryResp.status}`);
    log(`Total divisions: ${summaryData.length || summaryData.data?.length || 0}\n`);

    const divisionsList = summaryData.data || summaryData;

    if (Array.isArray(divisionsList)) {
        log("Divisions found in summary:");
        for (const div of divisionsList) {
            if (div.is_grand_total || div.is_subtotal) continue;
            log(`  ${div.division_code}: ${div.description || ''} | emp=${div.total_employees} | HK=${div.total_hk} | upah=${div.total_upah_bersih} | gangs=${div.total_gangs}`);
        }

        // Check for the 4 target virtual divisions
        const targets = ["NRS", "WKS_PG", "WKS_AR", "INF", "WORKSHOP"];
        log("\n--- Target Virtual Division Status ---");
        for (const t of targets) {
            const found = divisionsList.find((d: any) => d.division_code === t && !d.is_grand_total && !d.is_subtotal);
            if (found) {
                log(`  ✅ ${t}: ${found.description} | emp=${found.total_employees} | upah=${found.total_upah_bersih}`);
            } else {
                log(`  ❌ ${t}: NOT FOUND in summary`);
            }
        }
    } else {
        log("Unexpected response format:");
        log(JSON.stringify(summaryData).substring(0, 1000));
    }

    log("\n=== Done ===");
    writeFileSync("_dev_utils/scripts/verify_output.txt", lines.join("\n"));
}

verify().catch(console.error);
