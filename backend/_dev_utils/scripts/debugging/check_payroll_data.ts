// Deep check: why gangs and payroll periods are empty
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
    console.log("=== Deep check SERVER_PROFILE_1 / db_ptrj ===\n");

    // 1. HR_GANG - all records
    const gangs = await query("SERVER_PROFILE_1", "db_ptrj",
        "SELECT LocCode, Descs FROM HR_GANG ORDER BY LocCode");
    console.log(`HR_GANG total: ${gangs.data?.recordset?.length || 0}`);
    gangs.data?.recordset?.slice(0, 20).forEach((r: any) => {
        console.log(`  ${r.LocCode?.trim()} - ${r.Descs?.trim()}`);
    });
    if ((gangs.data?.recordset?.length || 0) > 20) {
        console.log(`  ... and ${(gangs.data?.recordset?.length || 0) - 20} more`);
    }

    console.log("\n");

    // 2. HR_PAYROLL - raw sample
    const payrollSample = await query("SERVER_PROFILE_1", "db_ptrj",
        "SELECT TOP 5 * FROM HR_PAYROLL");
    if (payrollSample.success && payrollSample.data?.recordset?.length > 0) {
        console.log("HR_PAYROLL columns:", Object.keys(payrollSample.data.recordset[0]).join(", "));
        console.log("Sample row:", JSON.stringify(payrollSample.data.recordset[0], null, 2));
    } else {
        console.log("HR_PAYROLL sample: ❌", payrollSample.error || "No data");
    }

    console.log("\n");

    // 3. HR_PAYROLL - period check with raw query
    const periods = await query("SERVER_PROFILE_1", "db_ptrj",
        "SELECT PeriodYear, PeriodMonth, COUNT(*) as cnt FROM HR_PAYROLL GROUP BY PeriodYear, PeriodMonth ORDER BY PeriodYear DESC, PeriodMonth DESC");
    console.log(`HR_PAYROLL periods: ${periods.data?.recordset?.length || 0} periods`);
    if (periods.success) {
        periods.data?.recordset?.slice(0, 15).forEach((r: any) => {
            console.log(`  ${r.PeriodYear}-${String(r.PeriodMonth).padStart(2, '0')}: ${r.cnt} records`);
        });
    } else {
        console.log(`❌ ${periods.error}`);
    }

    console.log("\n");

    // 4. Check HR_GANGLN for gang assignments
    const gangln = await query("SERVER_PROFILE_1", "db_ptrj",
        "SELECT TOP 5 * FROM HR_GANGLN");
    if (gangln.success && gangln.data?.recordset?.length > 0) {
        console.log("HR_GANGLN columns:", Object.keys(gangln.data.recordset[0]).join(", "));
        console.log("Sample:", JSON.stringify(gangln.data.recordset[0], null, 2));
    } else {
        console.log("HR_GANGLN sample: ❌", gangln.error || "No data");
    }

    console.log("\n");

    // 5. Check PR_TASKREGLN sample
    const taskreg = await query("SERVER_PROFILE_1", "db_ptrj",
        "SELECT TOP 3 * FROM PR_TASKREGLN");
    if (taskreg.success && taskreg.data?.recordset?.length > 0) {
        console.log("PR_TASKREGLN columns:", Object.keys(taskreg.data.recordset[0]).join(", "));
        console.log("Sample:", JSON.stringify(taskreg.data.recordset[0], null, 2));
    } else {
        console.log("PR_TASKREGLN: ❌", taskreg.error || "No data");
    }

    console.log("\n");

    // 6. Check PR_ADTRANS sample
    const adtrans = await query("SERVER_PROFILE_1", "db_ptrj",
        "SELECT TOP 3 * FROM PR_ADTRANS");
    if (adtrans.success && adtrans.data?.recordset?.length > 0) {
        console.log("PR_ADTRANS columns:", Object.keys(adtrans.data.recordset[0]).join(", "));
        console.log("Sample:", JSON.stringify(adtrans.data.recordset[0], null, 2));
    } else {
        console.log("PR_ADTRANS: ❌", adtrans.error || "No data");
    }
}

main();
