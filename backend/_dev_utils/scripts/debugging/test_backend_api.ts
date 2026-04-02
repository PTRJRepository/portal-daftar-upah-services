// Test the actual backend API endpoints
const DB_API_URL = "http://10.0.0.110:8001";
const DB_API_KEY = "2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6";

async function apiCall(path: string, method: string = "GET", body?: any) {
    try {
        const response = await fetch(`${DB_API_URL}${path}`, {
            method,
            headers: {
                "Content-Type": "application/json",
                "x-api-key": DB_API_KEY
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        return response.json();
    } catch (e: any) {
        return { error: e.message };
    }
}

async function main() {
    console.log("=== Testing SQL Gateway API ===\n");

    // 1. Test the actual getEmployees query from dataExtractorService
    console.log("1. Test getEmployees (HR_GANGLN based):");
    const employees = await apiCall("/v1/query", "POST", {
        sql: `
            SELECT TOP 5
                e.EmpCode,
                e.EmpName,
                e.LocCode,
                gl.GangCode,
                g.LocCode as gang_loc,
                g.Description as gang_desc
            FROM HR_EMPLOYEE e
            INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
            INNER JOIN HR_GANG g ON RTRIM(g.GangCode) = RTRIM(gl.GangCode)
            WHERE e.Status = '1' AND g.Status = '1'
            ORDER BY e.EmpCode
        `,
        params: {},
        server: "SERVER_PROFILE_1",
        database: "db_ptrj"
    });
    if (employees.success) {
        console.log(`  ✅ Got ${employees.data?.recordset?.length} rows`);
        employees.data?.recordset?.forEach((r: any) => {
            console.log(`  ${r.EmpCode?.trim()} | ${r.EmpName?.trim().substring(0, 30)} | Gang: ${r.GangCode?.trim()} (${r.gang_loc?.trim()})`);
        });
    } else {
        console.log(`  ❌ ${employees.error}`);
    }

    // 2. Test PR_TASKREGLN with period filter
    console.log("\n2. Test PR_TASKREGLN (March 2026):");
    const taskreg = await apiCall("/v1/query", "POST", {
        sql: `
            SELECT TOP 5
                tr.EmpCode,
                tr.EmpName,
                tr.TaskCode,
                tr.TrxDate,
                tr.Hours,
                tr.Amount,
                tr.ChargeTo
            FROM PR_TASKREGLN tr
            WHERE tr.ChargeTo = 'P1A'
            ORDER BY tr.TrxDate DESC
        `,
        params: {},
        server: "SERVER_PROFILE_1",
        database: "db_ptrj"
    });
    if (taskreg.success) {
        console.log(`  ✅ Got ${taskreg.data?.recordset?.length} rows`);
        taskreg.data?.recordset?.forEach((r: any) => {
            console.log(`  ${r.EmpCode} | ${r.EmpName?.trim().substring(0, 25)} | ${r.TaskCode} | ${r.TrxDate} | ${r.Hours}h | Rp${r.Amount} | ${r.ChargeTo}`);
        });
    } else {
        console.log(`  ❌ ${taskreg.error}`);
    }

    // 3. Test PR_ADTRANS for March 2026
    console.log("\n3. Test PR_ADTRANS (March 2026):");
    const adtrans = await apiCall("/v1/query", "POST", {
        sql: `
            SELECT TOP 10
                ad.EmpCode,
                ad.EmpName,
                ad.DocDesc,
                ad.LocCode,
                ad.PhyMonth,
                ad.PhyYear
            FROM PR_ADTRANS ad
            WHERE ad.PhyMonth = '3' AND ad.PhyYear = '2026'
            ORDER BY ad.EmpCode
        `,
        params: {},
        server: "SERVER_PROFILE_1",
        database: "db_ptrj"
    });
    if (adtrans.success) {
        console.log(`  ✅ Got ${adtrans.data?.recordset?.length} rows`);
        adtrans.data?.recordset?.forEach((r: any) => {
            console.log(`  ${r.EmpCode} | ${r.EmpName?.trim().substring(0, 25)} | ${r.DocDesc?.trim()} | ${r.LocCode} | ${r.PhyMonth}/${r.PhyYear}`);
        });
    } else {
        console.log(`  ❌ ${adtrans.error}`);
    }

    // 4. Test getAttendance query pattern
    console.log("\n4. Test PR_TASKREGLN attendance query (March 2026, P1A):");
    const attendance = await apiCall("/v1/query", "POST", {
        sql: `
            SELECT
                tr.EmpCode,
                COUNT(DISTINCT CAST(tr.TrxDate AS DATE)) as work_days,
                SUM(tr.Hours) as total_hours,
                SUM(tr.Amount) as total_amount
            FROM PR_TASKREGLN tr
            WHERE tr.ChargeTo = 'P1A'
            AND tr.OT = 0
            AND YEAR(tr.TrxDate) = 2026 AND MONTH(tr.TrxDate) = 3
            GROUP BY tr.EmpCode
            ORDER BY tr.EmpCode
        `,
        params: {},
        server: "SERVER_PROFILE_1",
        database: "db_ptrj"
    });
    if (attendance.success) {
        console.log(`  ✅ Got ${attendance.data?.recordset?.length} rows`);
        attendance.data?.recordset?.slice(0, 5).forEach((r: any) => {
            console.log(`  ${r.EmpCode} | ${r.work_days} days | ${r.total_hours}h | Rp${r.total_amount}`);
        });
    } else {
        console.log(`  ❌ ${attendance.error}`);
    }
}

main();
