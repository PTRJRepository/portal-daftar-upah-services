// Check HR_GANG schema and PR_GANG data
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
    console.log("=== Check HR_GANG schema on SERVER_PROFILE_1 ===\n");

    // Schema
    const schema = await query("SERVER_PROFILE_1", "db_ptrj",
        "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'HR_GANG' ORDER BY ORDINAL_POSITION");
    if (schema.success) {
        console.log("HR_GANG columns:");
        schema.data?.recordset?.forEach((r: any) => {
            console.log(`  ${r.COLUMN_NAME}: ${r.DATA_TYPE}`);
        });
    } else {
        console.log("HR_GANG schema error:", schema.error);
    }

    console.log("\nHR_GANG sample (first 3 rows):");
    const sample = await query("SERVER_PROFILE_1", "db_ptrj", "SELECT TOP 3 * FROM HR_GANG");
    if (sample.success && sample.data?.recordset?.length > 0) {
        console.log(JSON.stringify(sample.data.recordset, null, 2));
    } else {
        console.log("No data or error:", sample.error || "empty");
    }

    console.log("\n=== Check PR_GANG schema ===\n");
    const prSchema = await query("SERVER_PROFILE_1", "db_ptrj",
        "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PR_GANG' ORDER BY ORDINAL_POSITION");
    if (prSchema.success) {
        console.log("PR_GANG columns:");
        prSchema.data?.recordset?.forEach((r: any) => {
            console.log(`  ${r.COLUMN_NAME}: ${r.DATA_TYPE}`);
        });
    }

    console.log("\nPR_GANG sample (first 10 rows):");
    const prSample = await query("SERVER_PROFILE_1", "db_ptrj", "SELECT TOP 10 * FROM PR_GANG");
    if (prSample.success && prSample.data?.recordset?.length > 0) {
        prSample.data.recordset.forEach((r: any) => {
            console.log(`  ${JSON.stringify(r)}`);
        });
    } else {
        console.log("Error:", prSample.error || "empty");
    }

    console.log("\n=== Check PR_GANGLN schema ===\n");
    const glnSchema = await query("SERVER_PROFILE_1", "db_ptrj",
        "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PR_GANGLN' ORDER BY ORDINAL_POSITION");
    if (glnSchema.success) {
        console.log("PR_GANGLN columns:");
        glnSchema.data?.recordset?.forEach((r: any) => {
            console.log(`  ${r.COLUMN_NAME}: ${r.DATA_TYPE}`);
        });
    }

    console.log("\n=== PR_TASKREGLN dates range ===");
    const dates = await query("SERVER_PROFILE_1", "db_ptrj",
        "SELECT MIN(TrxDate) as min_date, MAX(TrxDate) as max_date, COUNT(*) as cnt FROM PR_TASKREGLN");
    if (dates.success) {
        console.log(JSON.stringify(dates.data?.recordset?.[0], null, 2));
    }

    console.log("\n=== PR_ADTRANS dates range ===");
    const adtransDates = await query("SERVER_PROFILE_1", "db_ptrj",
        "SELECT MIN(DocDate) as min_date, MAX(DocDate) as max_date, COUNT(*) as cnt FROM PR_ADTRANS");
    if (adtransDates.success) {
        console.log(JSON.stringify(adtransDates.data?.recordset?.[0], null, 2));
    }

    // Check what the system expects: does HR_EMPLOYEE have gang/division info?
    console.log("\n=== HR_EMPLOYEE schema (gang/loc columns) ===");
    const empSchema = await query("SERVER_PROFILE_1", "db_ptrj",
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'HR_EMPLOYEE'");
    if (empSchema.success) {
        const cols = empSchema.data?.recordset?.map((r: any) => r.COLUMN_NAME) || [];
        console.log("All columns:", cols.join(", "));
        const gangCols = cols.filter((c: string) => /GANG|LOC|DIV|EST|AFD|BLOK/i.test(c));
        console.log("Gang/loc related:", gangCols.join(", "));
    }

    // Check PR_EMPWAGES - might be the actual payroll transaction table
    console.log("\n=== PR_EMPWAGES schema ===");
    const wagesSchema = await query("SERVER_PROFILE_1", "db_ptrj",
        "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PR_EMPWAGES' ORDER BY ORDINAL_POSITION");
    if (wagesSchema.success) {
        console.log("Columns:");
        wagesSchema.data?.recordset?.forEach((r: any) => {
            console.log(`  ${r.COLUMN_NAME}: ${r.DATA_TYPE}`);
        });
    }

    console.log("\n=== PR_EMPWAGES sample ===");
    const wagesSample = await query("SERVER_PROFILE_1", "db_ptrj", "SELECT TOP 3 * FROM PR_EMPWAGES");
    if (wagesSchema.success && wagesSchema.data?.recordset?.length > 0) {
        wagesSchema.data.recordset.forEach((r: any) => {
            console.log(`  ${JSON.stringify(r)}`);
        });
    } else {
        console.log("Error:", wagesSchema.error || "empty");
    }
}

main();
