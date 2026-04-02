/**
 * Test Daftar Upah endpoint directly
 */
import { Config } from "../../src/config";

const BASE = `http://localhost:${Config.PORT}`;
const TOKEN = Config.DEV_BYPASS_TOKEN;

async function testDaftarUpah() {
    console.log("=== DAFTAR UPAH DEBUG ===");
    console.log(`Base URL: ${BASE}`);
    console.log(`Token: ${TOKEN}`);
    
    // Test 1: Get current period
    console.log("\n--- Test 1: Current Period ---");
    try {
        const resp = await fetch(`${BASE}/payroll/current-period`, {
            headers: { "Authorization": `Bearer ${TOKEN}` }
        });
        const data = await resp.json() as any;
        console.log(`Status: ${resp.status}`);
        console.log(`Response:`, JSON.stringify(data));
    } catch (e: any) {
        console.log(`❌ FAILED: ${e.message}`);
    }

    // Test 2: Get locked report (main daftar upah) for Feb 2026 
    console.log("\n--- Test 2: Locked Report (Daftar Upah) - Feb 2026, gang=ALL ---");
    try {
        const resp = await fetch(`${BASE}/payroll/locked/report/raw-tree?month=2&year=2026&gang_code=ALL`, {
            headers: { "Authorization": `Bearer ${TOKEN}` }
        });
        console.log(`HTTP Status: ${resp.status}`);
        const text = await resp.text();
        // Show first 500 chars
        console.log(`Response (first 500 chars): ${text.substring(0, 500)}`);
        
        // Parse to check structure
        try {
            const json = JSON.parse(text);
            if (json.data_rows) {
                console.log(`✅ data_rows count: ${json.data_rows.length}`);
            } else if (json.error) {
                console.log(`❌ Error: ${json.error}`);
            } else {
                console.log(`Response keys: ${Object.keys(json).join(', ')}`);
            }
        } catch {}
    } catch (e: any) {
        console.log(`❌ FAILED: ${e.message}`);
    }

    // Test 3: Try extractPayrollData directly  
    console.log("\n--- Test 3: Direct extractPayrollData ---");
    try {
        const { dataExtractorService } = await import("../../src/services/dataExtractorService");
        const result = await dataExtractorService.extractPayrollData(
            2, 2026, "ALL", undefined, undefined, undefined
        );
        if (result && result.data_rows) {
            console.log(`✅ extractPayrollData returned ${result.data_rows.length} rows`);
            if (result.data_rows.length > 0) {
                const first = result.data_rows[0];
                console.log(`First row: ${first.emp_code} - ${first.nama} - HK:${first.jumlah_hk}`);
            }
        } else {
            console.log(`⚠️ extractPayrollData returned null or no data_rows`);
            console.log(`Result:`, JSON.stringify(result)?.substring(0, 300));
        }
    } catch (e: any) {
        console.log(`❌ FAILED: ${e.message}`);
        console.log(`Stack: ${e.stack?.substring(0, 500)}`);
    }

    // Test 4: Try a specific gang 
    console.log("\n--- Test 4: extractPayrollData for specific gang (H1H) ---");
    try {
        const { dataExtractorService } = await import("../../src/services/dataExtractorService");
        const result = await dataExtractorService.extractPayrollData(
            2, 2026, "H1H", undefined, undefined, undefined
        );
        if (result && result.data_rows) {
            console.log(`✅ Gang H1H: ${result.data_rows.length} rows`);
        } else {
            console.log(`⚠️ Gang H1H returned null/empty`);
        }
    } catch (e: any) {
        console.log(`❌ Gang H1H FAILED: ${e.message}`);
    }

    // Test 5: Check DB for gang data
    console.log("\n--- Test 5: Available gangs in HR_GANG ---");
    try {
        const { Database } = await import("../../src/db/client");
        const db = Database.getInstance();
        const gangs = await db.query<any>(`SELECT TOP 10 RTRIM(GangCode) as GangCode, RTRIM(LocCode) as LocCode FROM HR_GANG ORDER BY GangCode`);
        console.log(`Found ${gangs.length} gangs (showing first 10):`);
        gangs.forEach(g => console.log(`   ${g.GangCode} -> ${g.LocCode}`));
    } catch (e: any) {
        console.log(`❌ FAILED: ${e.message}`);
    }

    console.log("\n=== DONE ===");
}

testDaftarUpah().catch(e => {
    console.error("Fatal error:", e);
    process.exit(1);
});
