// Test the backend payroll API endpoint directly
// This uses the Bun HTTP server at localhost:8002
const BACKEND_URL = "http://localhost:8002";
const DEV_BYPASS = "dev-bypass-token-12345";

async function main() {
    console.log("=== Testing Backend Payroll API ===\n");

    // Test 1: Get divisions
    console.log("1. GET /payroll/divisions");
    try {
        const divRes = await fetch(`${BACKEND_URL}/payroll/divisions`, {
            headers: { "Authorization": `Bearer ${DEV_BYPASS}` }
        });
        const divData = await divRes.json();
        console.log(`  Status: ${divRes.status}`);
        console.log(`  Divisions: ${JSON.stringify(divData).substring(0, 200)}`);
    } catch (e: any) {
        console.log(`  ❌ Connection failed: ${e.message}`);
    }

    // Test 2: Get payroll report (ALL, March 2026)
    console.log("\n2. GET /payroll/report?month=3&year=2026&gang_code=ALL");
    try {
        const repRes = await fetch(`${BACKEND_URL}/payroll/report?month=3&year=2026&gang_code=ALL`, {
            headers: { "Authorization": `Bearer ${DEV_BYPASS}` }
        });
        const repData = await repRes.json();
        console.log(`  Status: ${repRes.status}`);
        if (repData.data_rows) {
            console.log(`  ✅ data_rows: ${repData.data_rows.length} rows`);
            if (repData.data_rows.length > 0) {
                console.log(`  Sample: ${JSON.stringify(repData.data_rows[0]).substring(0, 200)}`);
            }
        } else if (repData.error) {
            console.log(`  ❌ Error: ${repData.error}`);
        } else {
            console.log(`  Response: ${JSON.stringify(repData).substring(0, 300)}`);
        }
    } catch (e: any) {
        console.log(`  ❌ Connection failed: ${e.message}`);
    }

    // Test 3: Get payroll report for specific gang (H1H)
    console.log("\n3. GET /payroll/report?month=3&year=2026&gang_code=H1H");
    try {
        const h1hRes = await fetch(`${BACKEND_URL}/payroll/report?month=3&year=2026&gang_code=H1H`, {
            headers: { "Authorization": `Bearer ${DEV_BYPASS}` }
        });
        const h1hData = await h1hRes.json();
        console.log(`  Status: ${h1hRes.status}`);
        if (h1hData.data_rows) {
            console.log(`  ✅ data_rows: ${h1hData.data_rows.length} rows`);
        } else if (h1hData.error) {
            console.log(`  ❌ Error: ${h1hData.error}`);
        } else {
            console.log(`  Response: ${JSON.stringify(h1hData).substring(0, 300)}`);
        }
    } catch (e: any) {
        console.log(`  ❌ Connection failed: ${e.message}`);
    }
}

main();
