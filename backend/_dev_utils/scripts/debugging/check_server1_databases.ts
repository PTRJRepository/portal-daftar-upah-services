// Quick check: what databases exist on SERVER_PROFILE_1?
const DB_API_URL = "http://10.0.0.110:8001";
const DB_API_KEY = "2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6";

async function main() {
    console.log("=== Checking databases on SERVER_PROFILE_1 ===\n");

    const databases = ["db_ptrj", "extend_db_ptrj", "master", "VenusHR14"];

    for (const db of databases) {
        try {
            const body = {
                sql: "SELECT name FROM sys.databases WHERE name = ?",
                params: { p0: db },
                server: "SERVER_PROFILE_1",
                database: "master"
            };

            const response = await fetch(`${DB_API_URL}/v1/query`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": DB_API_KEY
                },
                body: JSON.stringify(body),
            });

            const result = await response.json();
            if (result.success && result.data?.recordset?.length > 0) {
                console.log(`✅ ${db} exists on SERVER_PROFILE_1`);

                // Now check if tables exist
                if (db === "db_ptrj" || db === "extend_db_ptrj") {
                    const tableBody = {
                        sql: "SELECT COUNT(*) as cnt FROM sys.tables",
                        params: {},
                        server: "SERVER_PROFILE_1",
                        database: db
                    };
                    const tableRes = await fetch(`${DB_API_URL}/v1/query`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "x-api-key": DB_API_KEY
                        },
                        body: JSON.stringify(tableBody),
                    });
                    const tableResult = await tableRes.json();
                    const cnt = tableResult.data?.recordset?.[0]?.cnt || 0;
                    console.log(`   -> ${cnt} tables found`);

                    // Check specific payroll tables
                    const tablesToCheck = ["HR_PAYROLL", "PR_TASKREGLN", "HR_EMPLOYEE", "HR_GANG", "PR_ADTRANS"];
                    for (const tbl of tablesToCheck) {
                        const tblBody = {
                            sql: "SELECT COUNT(*) as cnt FROM sys.tables WHERE name = ?",
                            params: { p0: tbl },
                            server: "SERVER_PROFILE_1",
                            database: db
                        };
                        const tblRes = await fetch(`${DB_API_URL}/v1/query`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "x-api-key": DB_API_KEY
                            },
                            body: JSON.stringify(tblBody),
                        });
                        const tblResult = await tblRes.json();
                        const exists = tblResult.data?.recordset?.[0]?.cnt > 0;
                        if (exists) {
                            // Get row count
                            const countBody = {
                                sql: `SELECT COUNT(*) as cnt FROM ${tbl}`,
                                params: {},
                                server: "SERVER_PROFILE_1",
                                database: db
                            };
                            const countRes = await fetch(`${DB_API_URL}/v1/query`, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    "x-api-key": DB_API_KEY
                                },
                                body: JSON.stringify(countBody),
                            });
                            const countResult = await countRes.json();
                            const rowCount = countResult.data?.recordset?.[0]?.cnt || 0;
                            console.log(`   -> ${tbl}: ${rowCount} rows`);
                        }
                    }
                }
            } else {
                console.log(`❌ ${db} NOT found on SERVER_PROFILE_1`);
            }
        } catch (e: any) {
            console.log(`❌ ${db} ERROR: ${e.message}`);
        }
        console.log("");
    }

    console.log("\n=== Checking SERVER_PROFILE_2 (current) for comparison ===\n");
    try {
        const body = {
            sql: "SELECT name FROM sys.databases WHERE name = ?",
            params: { p0: "db_ptrj" },
            server: "SERVER_PROFILE_2",
            database: "master"
        };
        const response = await fetch(`${DB_API_URL}/v1/query`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": DB_API_KEY
            },
            body: JSON.stringify(body),
        });
        const result = await response.json();
        if (result.success && result.data?.recordset?.length > 0) {
            console.log(`✅ db_ptrj exists on SERVER_PROFILE_2`);
            // Check row counts
            const tablesToCheck = ["HR_PAYROLL", "PR_TASKREGLN", "HR_EMPLOYEE", "HR_GANG", "PR_ADTRANS"];
            for (const tbl of tablesToCheck) {
                const tblBody = {
                    sql: `SELECT COUNT(*) as cnt FROM ${tbl}`,
                    params: {},
                    server: "SERVER_PROFILE_2",
                    database: "db_ptrj"
                };
                const tblRes = await fetch(`${DB_API_URL}/v1/query`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-api-key": DB_API_KEY
                    },
                    body: JSON.stringify(tblBody),
                });
                const tblResult = await tblRes.json();
                const rowCount = tblResult.data?.recordset?.[0]?.cnt || 0;
                console.log(`   -> ${tbl}: ${rowCount} rows`);
            }
        } else {
            console.log(`❌ db_ptrj NOT found on SERVER_PROFILE_2`);
            if (result.error) console.log(`   Error: ${result.error}`);
        }
    } catch (e: any) {
        console.log(`❌ SERVER_PROFILE_2 connection ERROR: ${e.message}`);
    }
}

main();
