/**
 * Quick DB Connection Test
 * Tests whether SERVER_PROFILE_1 can reach the database and return data
 */
import { Config } from "../../src/config";
import { Database } from "../../src/db/client";

async function testConnection() {
    console.log("=== DB CONNECTION DEBUG ===");
    console.log(`DB_API_URL: ${Config.DB_API_URL}`);
    console.log(`DB_PROFILE: ${Config.DB_PROFILE}`);
    console.log(`DB_DATABASE: ${Config.DEFAULT_DATABASE}`);
    console.log(`DB_EXTEND_PROFILE: ${Config.DB_EXTEND_PROFILE}`);
    console.log(`DB_EXTEND_DATABASE: ${Config.DB_EXTEND_DATABASE}`);
    console.log("");

    // Test 1: Simple query to main DB (HR_EMPLOYEE)
    console.log("--- Test 1: Main DB (HR_EMPLOYEE count) ---");
    try {
        const db = Database.getInstance();
        const rows = await db.query<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM HR_EMPLOYEE`);
        console.log(`✅ SUCCESS: HR_EMPLOYEE has ${rows[0]?.cnt} rows`);
    } catch (e: any) {
        console.log(`❌ FAILED: ${e.message}`);
    }

    // Test 2: Simple query to main DB (HR_GANG)
    console.log("\n--- Test 2: Main DB (HR_GANG count) ---");
    try {
        const db = Database.getInstance();
        const rows = await db.query<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM HR_GANG`);
        console.log(`✅ SUCCESS: HR_GANG has ${rows[0]?.cnt} rows`);
    } catch (e: any) {
        console.log(`❌ FAILED: ${e.message}`);
    }

    // Test 3: Sample data from HR_EMPLOYEE
    console.log("\n--- Test 3: Sample HR_EMPLOYEE data ---");
    try {
        const db = Database.getInstance();
        const rows = await db.query<any>(`SELECT TOP 3 RTRIM(EmpCode) as EmpCode, RTRIM(EmpName) as EmpName FROM HR_EMPLOYEE ORDER BY EmpCode`);
        if (rows.length > 0) {
            console.log(`✅ SUCCESS: Got ${rows.length} rows`);
            rows.forEach(r => console.log(`   ${r.EmpCode} - ${r.EmpName}`));
        } else {
            console.log(`⚠️ WARNING: Query succeeded but returned 0 rows`);
        }
    } catch (e: any) {
        console.log(`❌ FAILED: ${e.message}`);
    }

    // Test 4: Extended DB
    console.log("\n--- Test 4: Extended DB (extend_db_ptrj) ---");
    try {
        const extDb = Database.getExtendedInstance();
        const rows = await extDb.query<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM dbo.employee_hr_data`);
        console.log(`✅ SUCCESS: employee_hr_data has ${rows[0]?.cnt} rows`);
    } catch (e: any) {
        console.log(`❌ FAILED: ${e.message}`);
    }

    // Test 5: PR_TASKREGLN_ARC (payroll transactions)
    console.log("\n--- Test 5: PR_TASKREGLN_ARC (payroll transactions) ---");
    try {
        const db = Database.getInstance();
        const rows = await db.query<any>(`SELECT TOP 1 MONTH(TrxDate) as m, YEAR(TrxDate) as y, COUNT(*) as cnt FROM PR_TASKREGLN_ARC GROUP BY MONTH(TrxDate), YEAR(TrxDate) ORDER BY YEAR(TrxDate) DESC, MONTH(TrxDate) DESC`);
        if (rows.length > 0) {
            console.log(`✅ SUCCESS: Latest period = ${rows[0].m}/${rows[0].y} (${rows[0].cnt} records)`);
        } else {
            console.log(`⚠️ WARNING: No transaction data found`);
        }
    } catch (e: any) {
        console.log(`❌ FAILED: ${e.message}`);
    }

    // Test 6: Raw HTTP test to Gateway
    console.log("\n--- Test 6: Raw Gateway HTTP test ---");
    try {
        const url = `${Config.DB_API_URL}/query`;
        const body = {
            server: Config.DB_PROFILE,
            db: Config.DEFAULT_DATABASE,
            query: "SELECT 1 as test_value",
            params: {}
        };
        const resp = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": Config.DB_API_KEY
            },
            body: JSON.stringify(body)
        });
        const json = await resp.json() as any;
        console.log(`HTTP Status: ${resp.status}`);
        console.log(`Response:`, JSON.stringify(json).substring(0, 300));
        if (json.success) {
            console.log(`✅ Gateway is reachable and responding`);
        } else {
            console.log(`❌ Gateway returned error: ${json.error}`);
        }
    } catch (e: any) {
        console.log(`❌ Gateway unreachable: ${e.message}`);
    }

    console.log("\n=== DONE ===");
}

testConnection().catch(e => {
    console.error("Fatal error:", e);
    process.exit(1);
});
