/**
 * Check available databases on SERVER_PROFILE_3
 */
const DB_API_URL = "http://10.0.0.110:8001";
const DB_API_KEY = "2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6";

async function query(server: string, database: string, sql: string) {
    try {
        const response = await fetch(`${DB_API_URL}/v1/query`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": DB_API_KEY
            },
            body: JSON.stringify({ sql, params: [], server, database }),
        });
        return response.json();
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

async function main() {
    console.log("=== Checking available databases on SERVER_PROFILE_3 ===\n");

    // Try to list databases
    const result = await query("SERVER_PROFILE_3", "master",
        "SELECT name FROM sys.databases WHERE state = 0 ORDER BY name");

    if (result.success && result.data?.recordset) {
        console.log(`Available databases on SERVER_PROFILE_3:`);
        result.data.recordset.forEach((r: any) => console.log(`  - ${r.name}`));
    } else {
        console.log('ERROR:', result);
    }

    // Also check db_ptrj_mill which was mentioned in CLAUDE.md
    console.log("\n\n=== Checking db_ptrj_mill on SERVER_PROFILE_3 ===");
    const millResult = await query("SERVER_PROFILE_3", "db_ptrj_mill",
        "SELECT TOP 5 CustomerCode, NetWeight FROM WM_TICKET");

    if (millResult.success && millResult.data?.recordset) {
        console.log(`db_ptrj_mill: Connected! Sample data:`);
        millResult.data.recordset.forEach((r: any) => console.log(`  ${r.CustomerCode} | ${r.NetWeight}`));
    } else {
        console.log(`db_ptrj_mill: ${millResult.error || "Failed"}`);
    }
}

main().catch(console.error);
