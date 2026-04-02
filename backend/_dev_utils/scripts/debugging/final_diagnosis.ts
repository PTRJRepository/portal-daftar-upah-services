// Final verification of data availability on SERVER_PROFILE_1
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

    console.log("=== FINAL DIAGNOSIS ===\n");

    // 1. HR_GANG count
    const gangCount = await query(srv, db, "SELECT COUNT(*) as cnt FROM HR_GANG");
    console.log(`HR_GANG: ${gangCount.data?.recordset?.[0]?.cnt ?? gangCount.error} rows`);

    // 2. HR_GANG by LocCode
    const gangByLoc = await query(srv, db,
        "SELECT LocCode, COUNT(*) as cnt FROM HR_GANG GROUP BY LocCode ORDER BY LocCode");
    if (gangByLoc.success) {
        gangByLoc.data?.recordset?.forEach((r: any) => {
            console.log(`  ${r.LocCode?.trim()}: ${r.cnt} gangs`);
        });
    }

    // 3. HR_EMPLOYEE count + LocCode breakdown
    const empCount = await query(srv, db, "SELECT COUNT(*) as cnt FROM HR_EMPLOYEE");
    console.log(`\nHR_EMPLOYEE: ${empCount.data?.recordset?.[0]?.cnt ?? empCount.error} rows`);

    const empByLoc = await query(srv, db,
        "SELECT LocCode, COUNT(*) as cnt FROM HR_EMPLOYEE WHERE LocCode IS NOT NULL GROUP BY LocCode ORDER BY LocCode");
    if (empByLoc.success) {
        empByLoc.data?.recordset?.forEach((r: any) => {
            console.log(`  ${r.LocCode?.trim()}: ${r.cnt} employees`);
        });
    }

    // 4. HR_PAYROLL - check what it actually has vs what code expects
    console.log("\nHR_PAYROLL analysis:");
    const hrpSample = await query(srv, db, "SELECT TOP 1 * FROM HR_PAYROLL");
    if (hrpSample.success && hrpSample.data?.recordset?.length > 0) {
        const cols = Object.keys(hrpSample.data.recordset[0]);
        const hasPeriodMonth = cols.includes("PeriodMonth");
        const hasPeriodYear = cols.includes("PeriodYear");
        const hasEmpCode = cols.includes("EmpCode");
        console.log(`  Has EmpCode: ${hasEmpCode}`);
        console.log(`  Has PeriodMonth: ${hasPeriodMonth}`);
        console.log(`  Has PeriodYear: ${hasPeriodYear}`);
        console.log(`  All columns: ${cols.join(", ")}`);

        if (!hasPeriodMonth || !hasPeriodYear) {
            console.log("\n  ⚠️  WARNING: HR_PAYROLL is MISSING PeriodMonth/PeriodYear columns!");
            console.log("  This is likely a CONFIGURATION table, not the payroll data table.");
            console.log("  The system may need to use PR_TASKREGLN or PR_ADTRANS for period data.");
        }
    }

    // 5. Check what the code actually needs: employee + gang assignment
    console.log("\n=== Employee-Gang Relationship ===");
    const empGang = await query(srv, db,
        "SELECT TOP 5 e.EmpCode, e.EmpName, e.LocCode, g.GangCode, g.Description as GangDesc FROM HR_EMPLOYEE e LEFT JOIN HR_GANG g ON e.LocCode = g.LocCode WHERE e.LocCode IS NOT NULL ORDER BY e.EmpCode");
    if (empGang.success) {
        empGang.data?.recordset?.forEach((r: any) => {
            console.log(`  ${r.EmpCode?.trim()} - ${r.EmpName?.trim()} | Loc: ${r.LocCode?.trim()} | Gang: ${r.GangCode?.trim() || "N/A"}`);
        });
    } else {
        console.log("  Error:", empGang.error);
    }

    // 6. Check PR_TASKREGLN periods (AccMonth/AccYear equivalent from Master table)
    console.log("\n=== PR_TASKREGLN periods ===");
    const taskMaster = await query(srv, db,
        "SELECT TOP 3 m.TrxDate, m.AccMonth, m.AccYear FROM PR_TASKREG m ORDER BY m.TrxDate DESC");
    if (taskMaster.success && taskMaster.data?.recordset?.length > 0) {
        console.log("PR_TASKREG columns sample:");
        taskMaster.data.recordset.forEach((r: any) => {
            console.log(`  ${JSON.stringify(r)}`);
        });
    } else {
        console.log("  Error or no data:", taskMaster.error);
    }

    // 7. Check PR_CHECKROLLMASTER - this might be the main payroll table
    console.log("\n=== PR_CHECKROLLMASTER schema ===");
    const crmSchema = await query(srv, db,
        "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PR_CHECKROLLMASTER' ORDER BY ORDINAL_POSITION");
    if (crmSchema.success) {
        console.log("Columns:");
        crmSchema.data?.recordset?.forEach((r: any) => {
            console.log(`  ${r.COLUMN_NAME}: ${r.DATA_TYPE}`);
        });
    }

    console.log("\n=== PR_CHECKROLLMASTER sample ===");
    const crmSample = await query(srv, db, "SELECT TOP 3 * FROM PR_CHECKROLLMASTER");
    if (crmSchema.success && crmSchema.data?.recordset?.length > 0) {
        crmSchema.data.recordset.forEach((r: any) => {
            console.log(`  ${JSON.stringify(r)}`);
        });
    } else {
        console.log("  Error:", crmSchema.error || "empty");
    }

    // 8. Check PR_MTHENDPAY - monthly payroll payment
    console.log("\n=== PR_MTHENDPAY schema ===");
    const meSchema = await query(srv, db,
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PR_MTHENDPAY' ORDER BY ORDINAL_POSITION");
    if (meSchema.success) {
        console.log("Columns:", meSchema.data?.recordset?.map((r: any) => r.COLUMN_NAME).join(", "));
    }

    const meSample = await query(srv, db, "SELECT TOP 3 * FROM PR_MTHENDPAY");
    if (meSchema.success && meSchema.data?.recordset?.length > 0) {
        meSchema.data.recordset.forEach((r: any) => {
            console.log(`  ${JSON.stringify(r)}`);
        });
    } else {
        console.log("  Error:", meSchema.error || "empty");
    }
}

main();
