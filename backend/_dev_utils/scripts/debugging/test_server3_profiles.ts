/**
 * Test SERVER_PROFILE_3 with different databases
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
    console.log("=== Testing different profiles ===\n");

    const profiles = [
        { server: "SERVER_PROFILE_1", db: "extend_db_ptrj" },
        { server: "SERVER_PROFILE_2", db: "db_ptrj" },
        { server: "SERVER_PROFILE_3", db: "VenusHR14" }
    ];

    for (const { server, db } of profiles) {
        console.log(`\n--- ${server} -> ${db} ---`);
        const result = await query(server, db, "SELECT TOP 3 name FROM sys.tables");
        if (result.success !== false && result.data) {
            console.log(`✅ Connected! (${result.data.length} tables shown)`);
            result.data.forEach((r: any) => console.log(`   - ${r.name}`));
        } else {
            console.log(`❌ ${result.error || "Failed"}`);
        }
    }
}

main().catch(console.error);
