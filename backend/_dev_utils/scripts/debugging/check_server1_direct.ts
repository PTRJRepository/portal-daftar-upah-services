// Check SERVER_PROFILE_1 directly with extend_db_ptrj
const DB_API_URL = "http://10.0.0.110:8001";
const DB_API_KEY = "2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6";

async function query(server: string, database: string, sql: string, params: any = {}) {
    const response = await fetch(`${DB_API_URL}/v1/query`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": DB_API_KEY
        },
        body: JSON.stringify({ sql, params, server, database }),
    });
    return response.json();
}

async function main() {
    console.log("=== Testing SERVER_PROFILE_1 with extend_db_ptrj ===\n");

    // 1. Check if extend_db_ptrj has any tables
    const res1 = await query("SERVER_PROFILE_1", "extend_db_ptrj",
        "SELECT name FROM sys.tables ORDER BY name");
    if (res1.success && res1.data?.recordset?.length > 0) {
        console.log(`✅ extend_db_ptrj connected! ${res1.data.recordset.length} tables found`);
        const tables = res1.data.recordset.map((r: any) => r.name);
        console.log("Tables:", tables.slice(0, 30).join(", ") + (tables.length > 30 ? ` ... (+${tables.length-30} more)` : ""));
    } else {
        console.log(`❌ extend_db_ptrj: ${res1.error || "No tables"}`);
    }

    console.log("\n");

    // 2. Try db_ptrj on SERVER_PROFILE_1
    const res2 = await query("SERVER_PROFILE_1", "db_ptrj",
        "SELECT name FROM sys.tables ORDER BY name");
    if (res2.success && res2.data?.recordset?.length > 0) {
        console.log(`✅ db_ptrj on SERVER_PROFILE_1 connected! ${res2.data.recordset.length} tables found`);
        const tables = res2.data.recordset.map((r: any) => r.name);
        console.log("Tables:", tables.join(", "));
    } else {
        console.log(`❌ db_ptrj on SERVER_PROFILE_1: ${res2.error || "No tables/error"}`);
    }

    console.log("\n");

    // 3. Check HR_PAYROLL row counts
    const dbToCheck = [
        { server: "SERVER_PROFILE_1", db: "extend_db_ptrj", label: "extend_db_ptrj" },
        { server: "SERVER_PROFILE_1", db: "db_ptrj", label: "db_ptrj" },
    ];

    for (const { server, db, label } of dbToCheck) {
        const tables = ["HR_PAYROLL", "HR_EMPLOYEE", "HR_GANG", "PR_TASKREGLN", "PR_ADTRANS"];
        console.log(`\n=== ${server} / ${label} ===`);
        for (const tbl of tables) {
            const res = await query(server, db, `SELECT COUNT(*) as cnt FROM ${tbl}`);
            if (res.success) {
                console.log(`  ${tbl}: ${res.data?.recordset?.[0]?.cnt ?? 0} rows`);
            } else {
                console.log(`  ${tbl}: ❌ ${res.error?.substring(0, 80)}`);
            }
        }
    }

    // 4. Also check VenusHR14 on SERVER_PROFILE_1
    console.log("\n=== SERVER_PROFILE_1 / VenusHR14 ===");
    const venus = await query("SERVER_PROFILE_1", "VenusHR14", "SELECT COUNT(*) as cnt FROM HR_EMPLOYEE");
    if (venus.success) {
        console.log(`  HR_EMPLOYEE: ${venus.data?.recordset?.[0]?.cnt ?? 0} rows`);
    } else {
        console.log(`  ❌ ${venus.error?.substring(0, 100)}`);
    }
}

main();
