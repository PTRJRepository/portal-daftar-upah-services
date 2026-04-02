// Test the exact query path that extractPayrollData uses
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
    const srv = "SERVER_PROFILE_1";
    const db = "db_ptrj";

    console.log("=== Testing extractPayrollData query path (gangCode=ALL) ===\n");

    // Step 1: getEmployees with gangCondition = "1=1" (ALL gangs)
    console.log("1. getEmployees (ALL, March 2026):");
    const emps = await query(srv, db, `
        SELECT TOP 10
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
    `);
    if (emps.success) {
        console.log(`  ✅ ${emps.data?.recordset?.length} rows returned (query successful)`);
        emps.data?.recordset?.forEach((r: any) => {
            console.log(`  ${r.EmpCode?.trim()} | ${r.EmpName?.trim().substring(0, 25)} | Gang: ${r.GangCode?.trim()} (${r.gang_loc?.trim()})`);
        });
    } else {
        console.log(`  ❌ ${emps.error}`);
    }

    // Step 2: getAttendance for those employees
    console.log("\n2. getAttendance (March 2026, top 5 employees):");
    const empsList = emps.success ? emps.data?.recordset?.slice(0, 5).map((r: any) => r.EmpCode?.trim()) : [];
    if (empsList.length > 0) {
        const attQuery = `
            SELECT
                tr.EmpCode,
                COUNT(DISTINCT CAST(tr.TrxDate AS DATE)) as work_days,
                SUM(tr.Hours) as total_hours,
                SUM(tr.Amount) as total_amount
            FROM PR_TASKREGLN tr
            WHERE tr.EmpCode IN (${empsList.map((_, i) => `@p${i}`).join(',')})
            AND YEAR(tr.TrxDate) = 2026 AND MONTH(tr.TrxDate) = 3
            AND tr.OT = 0
            GROUP BY tr.EmpCode
        `;
        const attParams: any = {};
        empsList.forEach((code, i) => { attParams[`p${i}`] = code; });

        const att = await query(srv, db, attQuery, attParams);
        if (att.success) {
            console.log(`  ✅ ${att.data?.recordset?.length} rows`);
            att.data?.recordset?.forEach((r: any) => {
                console.log(`  ${r.EmpCode} | ${r.work_days} days | ${r.total_hours}h | Rp${r.total_amount}`);
            });
        } else {
            console.log(`  ❌ ${att.error}`);
        }
    }

    // Step 3: getPremi (PR_ADTRANS) for those employees
    console.log("\n3. getPremi (March 2026, top 5 employees):");
    if (empsList.length > 0) {
        const premiQuery = `
            SELECT
                ad.EmpCode,
                ad.DocDesc,
                SUM(ad.TrxAmount) as total_amount,
                COUNT(*) as cnt
            FROM PR_ADTRANS ad
            WHERE ad.EmpCode IN (${empsList.map((_, i) => `@p${i}`).join(',')})
            AND ad.PhyMonth = '3' AND ad.PhyYear = '2026'
            AND ad.DocDesc NOT LIKE 'POT%'
            AND ad.DocDesc NOT LIKE 'PPH%'
            AND ad.DocDesc NOT LIKE 'LEMBUR%'
            GROUP BY ad.EmpCode, ad.DocDesc
        `;
        const premiParams: any = {};
        empsList.forEach((code, i) => { premiParams[`p${i}`] = code; });

        const premi = await query(srv, db, premiQuery, premiParams);
        if (premi.success) {
            console.log(`  ✅ ${premi.data?.recordset?.length} rows`);
            premi.data?.recordset?.forEach((r: any) => {
                console.log(`  ${r.EmpCode} | ${r.DocDesc?.trim()} | Rp${r.total_amount}`);
            });
        } else {
            console.log(`  ❌ ${premi.error}`);
        }
    }

    // Step 4: Check currentPeriodService (what period is "current"?)
    console.log("\n4. Checking PR_TASKREGLN latest dates:");
    const latest = await query(srv, db,
        "SELECT MAX(TrxDate) as latest_date FROM PR_TASKREGLN");
    if (latest.success) {
        console.log(`  Latest TrxDate: ${latest.data?.recordset?.[0]?.latest_date}`);
    }

    // Step 5: Full count for ALL employees in all gangs
    console.log("\n5. Full employee count (ALL gangs, ALL divisions):");
    const countAll = await query(srv, db, `
        SELECT COUNT(DISTINCT e.EmpCode) as total_employees
        FROM HR_EMPLOYEE e
        INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
        INNER JOIN HR_GANG g ON RTRIM(g.GangCode) = RTRIM(gl.GangCode)
        WHERE e.Status = '1' AND g.Status = '1'
    `);
    if (countAll.success) {
        console.log(`  Total employees: ${countAll.data?.recordset?.[0]?.total_employees}`);
    }

    // Step 6: Check attendance for ALL employees
    console.log("\n6. Full attendance count (March 2026):");
    const attCount = await query(srv, db, `
        SELECT COUNT(DISTINCT EmpCode) as employees_with_attendance
        FROM PR_TASKREGLN
        WHERE YEAR(TrxDate) = 2026 AND MONTH(TrxDate) = 3
    `);
    if (attCount.success) {
        console.log(`  Employees with attendance: ${attCount.data?.recordset?.[0]?.employees_with_attendance}`);
    }
}

main();
