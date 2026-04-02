// Check PR_GANGLN to see if it has the actual employee-gang mapping
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

    // 1. Count PR_GANGLN
    const prGlnCount = await query(srv, db, "SELECT COUNT(*) as cnt FROM PR_GANGLN");
    console.log(`PR_GANGLN: ${prGlnCount.data?.recordset?.[0]?.cnt ?? prGlnCount.error} rows`);

    // 2. PR_GANGLN sample - what does it contain?
    const prGlnSample = await query(srv, db, "SELECT TOP 5 * FROM PR_GANGLN");
    if (prGlnSample.success) {
        console.log("\nPR_GANGLN sample:");
        prGlnSample.data?.recordset?.forEach((r: any) => {
            console.log(`  ${JSON.stringify(r)}`);
        });
    }

    // 3. Count HR_GANGLN
    const hrGlnCount = await query(srv, db, "SELECT COUNT(*) as cnt FROM HR_GANGLN");
    console.log(`\nHR_GANGLN: ${hrGlnCount.data?.recordset?.[0]?.cnt ?? hrGlnCount.error} rows`);

    // 4. Try the actual query from dataExtractorService line 1357-1362
    console.log("\n=== Testing current query (HR_GANGLN) ===");
    const currentQ = await query(srv, db, `
        SELECT TOP 5
            e.EmpCode,
            e.EmpName,
            e.LocCode,
            gl.GangCode,
            g.LocCode as gang_loc
        FROM HR_EMPLOYEE e
        INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
        INNER JOIN HR_GANG g ON RTRIM(g.GangCode) = RTRIM(gl.GangCode)
        WHERE e.LocCode IS NOT NULL
        ORDER BY e.EmpCode
    `);
    if (currentQ.success) {
        console.log(`Got ${currentQ.data?.recordset?.length || 0} rows`);
        currentQ.data?.recordset?.forEach((r: any) => {
            console.log(`  ${r.EmpCode} | ${r.EmpName?.trim()} | Loc: ${r.LocCode?.trim()}`);
        });
    } else {
        console.log("Error:", currentQ.error);
    }

    // 5. Try the alternative with PR_GANGLN → PR_GANG
    console.log("\n=== Testing alternative query (PR_GANGLN → PR_GANG) ===");
    const altQ = await query(srv, db, `
        SELECT TOP 5
            e.EmpCode,
            e.EmpName,
            e.LocCode,
            pg.GangID,
            pg.LocCode as gang_loc
        FROM HR_EMPLOYEE e
        INNER JOIN PR_GANGLN pgl ON RTRIM(pgl.EmpCode) = RTRIM(e.EmpCode)
        INNER JOIN PR_GANG pg ON pg.ID = pgl.MasterID
        WHERE e.LocCode IS NOT NULL
        ORDER BY e.EmpCode
    `);
    if (altQ.success) {
        console.log(`Got ${altQ.data?.recordset?.length || 0} rows`);
        altQ.data?.recordset?.forEach((r: any) => {
            console.log(`  ${r.EmpCode?.trim()} | ${r.EmpName?.trim()} | Emp Loc: ${r.LocCode?.trim()} | Gang: ${r.GangID?.trim()} | Gang Loc: ${r.gang_loc?.trim()}`);
        });
    } else {
        console.log("Error:", altQ.error);
    }

    // 6. Check what AccMonth/AccYear are in PR_GANGLN
    console.log("\n=== PR_GANGLN AccMonth/AccYear ===");
    const prGlnAcc = await query(srv, db,
        "SELECT AccMonth, AccYear, COUNT(*) as cnt FROM PR_GANGLN GROUP BY AccMonth, AccYear ORDER BY AccYear DESC, AccMonth DESC");
    if (prGlnAcc.success) {
        prGlnAcc.data?.recordset?.forEach((r: any) => {
            console.log(`  ${r.AccYear}-${r.AccMonth}: ${r.cnt} records`);
        });
    }

    // 7. Check PR_GANGLN_ARC
    const prGlnArcCount = await query(srv, db, "SELECT COUNT(*) as cnt FROM PR_GANGLN_ARC");
    console.log(`\nPR_GANGLN_ARC: ${prGlnArcCount.data?.recordset?.[0]?.cnt ?? prGlnArcCount.error} rows`);

    const prGlnArcAcc = await query(srv, db,
        "SELECT AccMonth, AccYear, COUNT(*) as cnt FROM PR_GANGLN_ARC GROUP BY AccMonth, AccYear ORDER BY AccYear DESC, AccMonth DESC");
    if (prGlnArcAcc.success) {
        prGlnArcAcc.data?.recordset?.forEach((r: any) => {
            console.log(`  ${r.AccYear}-${r.AccMonth}: ${r.cnt} records`);
        });
    }
}

main();
