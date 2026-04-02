// Check VenusHR14 and gang data on all profiles
const DB_API_URL = "http://10.0.0.110:8001";
const DB_API_KEY = "2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6";

async function query(server: string, database: string, sql: string, params: any = {}) {
    try {
        const response = await fetch(`${DB_API_URL}/v1/query`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": DB_API_KEY
            },
            body: JSON.stringify({ sql, params, server, database }),
        });
        return response.json();
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

async function main() {
    console.log("=== Checking VenusHR14 on all profiles ===\n");

    const profiles = ["SERVER_PROFILE_1", "SERVER_PROFILE_2", "SERVER_PROFILE_3"];
    const databases = ["VenusHR14", "db_ptrj", "extend_db_ptrj", "db_ptrj_mill"];

    for (const server of profiles) {
        console.log(`\n--- ${server} ---`);
        for (const db of databases) {
            const res = await query(server, db,
                "SELECT name FROM sys.tables WHERE name IN ('HR_EMPLOYEE','HR_GANG','HR_GANGLN') ORDER BY name");
            if (res.success && res.data?.recordset?.length > 0) {
                console.log(`  ✅ ${db}: ${res.data.recordset.map((r: any) => r.name).join(", ")}`);
            } else if (res.success) {
                console.log(`  ⚠️  ${db}: No matching tables`);
            } else {
                console.log(`  ❌ ${db}: ${res.error?.substring(0, 80)}`);
            }
        }
    }

    console.log("\n=== Sample gang data from SERVER_PROFILE_1 / db_ptrj ===");
    const gangs = await query("SERVER_PROFILE_1", "db_ptrj",
        "SELECT TOP 10 LocCode, Descs FROM HR_GANG ORDER BY LocCode");
    if (gangs.success) {
        gangs.data?.recordset?.forEach((r: any) => {
            console.log(`  ${r.LocCode} - ${r.Descs}`);
        });
    }

    console.log("\n=== Sample employee data from SERVER_PROFILE_1 / db_ptrj ===");
    const emps = await query("SERVER_PROFILE_1", "db_ptrj",
        "SELECT TOP 5 EmpCode, EmpName, LocCode FROM HR_EMPLOYEE ORDER BY EmpCode");
    if (emps.success) {
        emps.data?.recordset?.forEach((r: any) => {
            console.log(`  ${r.EmpCode} - ${r.EmpName} (${r.LocCode})`);
        });
    }

    console.log("\n=== Latest payroll periods on SERVER_PROFILE_1 / db_ptrj ===");
    const periods = await query("SERVER_PROFILE_1", "db_ptrj",
        "SELECT TOP 10 PeriodMonth, PeriodYear, COUNT(*) as cnt FROM HR_PAYROLL GROUP BY PeriodMonth, PeriodYear ORDER BY PeriodYear DESC, PeriodMonth DESC");
    if (periods.success) {
        periods.data?.recordset?.forEach((r: any) => {
            console.log(`  ${r.PeriodYear}-${String(r.PeriodMonth).padStart(2, '0')}: ${r.cnt} records`);
        });
    }
}

main();
